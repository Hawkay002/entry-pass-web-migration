// app/api/og-snapshot/route.ts — stores a pre-rendered OG share preview for a
// ticket. Called by the admin browser right after a ticket is created, once
// the live shader ticket has been captured as a JPEG.
//
// Mirrors the /api/ticket-verify structure: request.json() body, getClientIp,
// recordFailure rate-limiting, Admin SDK Firestore, discriminated-union JSON.
//
// Security: validates that the ticket exists (no inventing IDs), caps the
// image size, and rate-limits by IP. og_snapshots is server-only (Admin SDK),
// so no client security rules are required.

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getClientIp, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 10;
const FAIL_WINDOW_SEC = 5 * 60; // 10 writes / IP / 5 min
const MAX_BYTES = 500_000; // ~500KB decoded — comfortably under Firestore's 1MB

type SnapshotResponse =
  | { ok: true }
  | { ok: false; error: string };

export async function POST(
  request: Request
): Promise<Response> {
  let body: { id?: unknown; image?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const image = typeof body.image === "string" ? body.image : "";

  if (!id || !image) {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Ticket ID and image are required." },
      { status: 400 }
    );
  }

  // Must be a base64 JPEG data URL.
  if (!/^data:image\/jpeg;base64,/.test(image)) {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Invalid image format." },
      { status: 400 }
    );
  }

  // Decode once to validate size before hitting Firestore.
  const base64 = image.slice("data:image/jpeg;base64,".length);
  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, "base64");
  } catch {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Invalid image data." },
      { status: 400 }
    );
  }
  if (decoded.byteLength > MAX_BYTES) {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Image too large." },
      { status: 413 }
    );
  }

  // Rate-limit by IP (fail-open on Redis errors, same as ticket-verify).
  const ip = getClientIp(request);
  const failKey = `og_snap:${ip}`;
  const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
  if (state.blocked) {
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
    );
  }

  try {
    const db = getAdminDb();

    // Confirm the ticket exists. A missing ticket still counts as a failure
    // (rate-limit churn) but does not reveal existence via a distinct error.
    const ticketSnap = await db
      .collection(paths.ticketsCollection)
      .doc(id)
      .get();
    if (!ticketSnap.exists) {
      return NextResponse.json<SnapshotResponse>(
        { ok: false, error: "Ticket not found." },
        { status: 404 }
      );
    }

    const ticketType = String(ticketSnap.data()?.ticketType ?? "Classic");

    await db.collection(paths.ogSnapshotsCollection).doc(id).set({
      image, // full data URL (stored as-is; small enough)
      ticketType,
      updatedAt: Date.now(),
    });

    return NextResponse.json<SnapshotResponse>({ ok: true });
  } catch (err) {
    console.error("[og-snapshot] store failed:", err);
    return NextResponse.json<SnapshotResponse>(
      { ok: false, error: "Could not store preview. Please try again." },
      { status: 500 }
    );
  }
}
