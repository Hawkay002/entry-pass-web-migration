// app/api/kiosk-checkin/route.ts — public self check-in endpoint.
// Validates a kiosk PIN + ticket id, marks the ticket arrived.
// Rate-limited: 5 failed PIN attempts per IP per 5 minutes.

import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";
import { logKioskAction } from "@/lib/pb/log";
import type { KioskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type CheckinResponse =
  | { ok: true; outcome: "granted" | "already" | "invalid" | "wrong-gate"; ticket: { name: string; id: string; status: string; expectedGate?: string | null } | null }
  | { ok: false; error: string };

async function findKiosk(pb: Awaited<ReturnType<typeof pbAdmin>>, kioskId: string): Promise<KioskConfig | null> {
  try {
    const rec = await pb.collection(paths.kiosksConfigCollection).getOne(paths.kiosksConfigId);
    const kiosks = Array.isArray(rec.kiosks) ? (rec.kiosks as KioskConfig[]) : [];
    return kiosks.find((k) => k.id === kioskId) ?? null;
  } catch {
    return null;
  }
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

  // PIN check sentinel — used to validate the PIN without consuming a check-in.
  if (ticketId === "kiosk-pin-check") {
    try {
      const pb = await pbAdmin();
      const kiosk = await findKiosk(pb, kioskId);
      if (!kiosk || kiosk.pin.length < 4 || pin !== kiosk.pin) {
        return NextResponse.json<CheckinResponse>(
          { ok: false, error: kiosk ? "Incorrect PIN." : "Kiosk not found." },
          { status: 403 }
        );
      }
      return NextResponse.json<CheckinResponse>({ ok: true, outcome: "granted", ticket: null });
    } catch {
      return NextResponse.json<CheckinResponse>(
        { ok: false, error: "Kiosk not found." },
        { status: 403 }
      );
    }
  }

  try {
    const pb = await pbAdmin();

    // Rate-limit by IP + kioskId.
    const ip = getClientIp(request);
    const failKey = `kiosk_fail:${kioskId}:${ip}`;

    // Find the kiosk config.
    const kiosk = await findKiosk(pb, kioskId);
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
    let rec;
    try {
      rec = await pb.collection(paths.ticketsCollection).getOne(ticketId);
    } catch {
      await logKioskAction("SELF_CHECKIN", `Invalid self check-in: ${ticketId.slice(0, 8)}`);
      return NextResponse.json<CheckinResponse>({
        ok: true,
        outcome: "invalid",
        ticket: null,
      });
    }

    const name = String(rec.name ?? "");
    const status = String(rec.status ?? "coming-soon");
    const scanned = Boolean(rec.scanned);
    const ticketGate = rec.gate ? String(rec.gate) : null;

    // Idempotent: only grant if still coming-soon & unscanned.
    if (status === "coming-soon" && !scanned) {
      // Multi-gate enforcement.
      if (ticketGate && kiosk.gateId && ticketGate !== kiosk.gateId) {
        let gateName = ticketGate;
        try {
          const gateRec = await pb.collection(paths.gatesCollection).getOne(ticketGate);
          gateName = String(gateRec.name ?? ticketGate);
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

      await pb.collection(paths.ticketsCollection).update(ticketId, {
        status: "arrived",
        scanned: true,
        scannedAt: Date.now(),
        scannedBy: `KIOSK:${kiosk.name}`,
        scannedAtGate: kiosk.gateId ?? "",
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
