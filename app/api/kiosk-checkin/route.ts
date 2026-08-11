// app/api/kiosk-checkin/route.ts — public self check-in endpoint.
// Validates a kiosk PIN + ticket id, marks the ticket arrived.
// Rate-limited: 5 failed PIN attempts per IP per 5 minutes.
// Supports multiple kiosks — each identified by kioskId, with its own PIN + gate.

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";
import { logKioskAction } from "@/lib/redis-log";
import type { KioskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type CheckinResponse =
  | { ok: true; outcome: "granted" | "already" | "invalid" | "wrong-gate"; ticket: { name: string; id: string; status: string; expectedGate?: string | null } | null }
  | { ok: false; error: string };

async function findKiosk(db: ReturnType<typeof getAdminDb>, kioskId: string): Promise<KioskConfig | null> {
  const snap = await db.doc(paths.adminSecurityDoc).get();
  const kiosks = Array.isArray(snap.data()?.kiosks) ? (snap.data()!.kiosks as KioskConfig[]) : [];
  return kiosks.find((k) => k.id === kioskId) ?? null;
}

export async function POST(request: Request): Promise<Response> {
  let body: { pin?: unknown; ticketId?: unknown; kioskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<CheckinResponse>(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const pin = typeof body.pin === "string" ? body.pin.replace(/\D/g, "") : "";
  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const kioskId = typeof body.kioskId === "string" ? body.kioskId.trim() : "";

  if (!pin || !ticketId || !kioskId) {
    return NextResponse.json<CheckinResponse>(
      { ok: false, error: "PIN, ticketId, and kioskId are required." },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();

    // Rate-limit by IP + kioskId.
    const ip = getClientIp(request);
    const failKey = `kiosk_fail:${kioskId}:${ip}`;

    // Find the kiosk config.
    const kiosk = await findKiosk(db, kioskId);
    if (!kiosk || kiosk.pin.length < 4 || pin !== kiosk.pin) {
      const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
      if (state.blocked) {
        return NextResponse.json<CheckinResponse>(
          { ok: false, error: "Too many attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
        );
      }
      return NextResponse.json<CheckinResponse>(
        { ok: false, error: "Incorrect PIN or kiosk not found." },
        { status: 403 }
      );
    }

    await clearRateLimit(failKey);

    // Look up the ticket.
    const ref = db.collection(paths.ticketsCollection).doc(ticketId);
    const snap = await ref.get();

    if (!snap.exists) {
      await logKioskAction("SELF_CHECKIN", `Invalid self check-in: ${ticketId.slice(0, 8)}`);
      return NextResponse.json<CheckinResponse>({
        ok: true,
        outcome: "invalid",
        ticket: null,
      });
    }

    const data = snap.data() as Record<string, unknown>;
    const name = String(data.name ?? "");
    const status = String(data.status ?? "coming-soon");
    const scanned = Boolean(data.scanned);
    const ticketGate = data.gate != null ? String(data.gate) : null;

    // Idempotent: only grant if still coming-soon & unscanned.
    if (status === "coming-soon" && !scanned) {
      // Multi-gate enforcement.
      if (ticketGate && kiosk.gateId && ticketGate !== kiosk.gateId) {
        // Resolve gate name so the kiosk UI shows "Gate A" not the raw id.
        let gateName = ticketGate;
        try {
          const gateSnap = await db.collection(paths.gatesCollection).doc(ticketGate).get();
          if (gateSnap.exists) gateName = String(gateSnap.data()?.name ?? ticketGate);
        } catch {}
        await logKioskAction(
          "SELF_CHECKIN",
          `Wrong gate: ${name} (ID: ${ticketId.slice(0, 6)}) — expected ${gateName}, kiosk ${kiosk.name} at ${kiosk.gateId}`
        );
        return NextResponse.json<CheckinResponse>({
          ok: true,
          outcome: "wrong-gate",
          ticket: { name, id: ticketId, status, expectedGate: gateName },
        });
      }

      await ref.update({
        status: "arrived",
        scanned: true,
        scannedAt: Date.now(),
        scannedBy: `KIOSK:${kiosk.name}`,
        scannedAtGate: kiosk.gateId ?? null,
      });
      await logKioskAction(
        "SELF_CHECKIN",
        `Self check-in (${kiosk.name}): ${name} (ID: ${ticketId.slice(0, 6)})`
      );
      return NextResponse.json<CheckinResponse>({
        ok: true,
        outcome: "granted",
        ticket: { name, id: ticketId, status: "arrived" },
      });
    }

    // Already scanned or otherwise not grantable.
    return NextResponse.json<CheckinResponse>({
      ok: true,
      outcome: "already",
      ticket: { name, id: ticketId, status },
    });
  } catch (err) {
    console.error("[kiosk-checkin] ERROR:", err);
    return NextResponse.json<CheckinResponse>(
      { ok: false, error: "Check-in failed. Please try again." },
      { status: 500 }
    );
  }
}
