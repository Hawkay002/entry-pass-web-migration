// app/api/kiosk-checkin/route.ts — public self check-in endpoint for the
// kiosk tablet. Gated by a PIN set by the admin (stored in the admin-only
// security doc, never sent to the client SDK). Mirrors validateTicket's
// idempotent logic but attributes scans to "KIOSK" and logs SELF_CHECKIN.

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { logKioskAction } from "@/lib/redis-log";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Brute-force throttling: 5 wrong-PIN attempts per IP per 5 minutes. A correct
// PIN always passes (and resets the counter), so a spammer cannot DOS-lock a
// legitimate kiosk that knows the PIN. At 5/5min, cracking a 4-digit PIN
// (10k combos) takes ~7 days minimum; an 8-digit PIN is effectively uncrackable.
const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type CheckinResponse =
  | { ok: true; outcome: "granted" | "already" | "invalid" | "wrong-gate"; ticket: { name: string; id: string; status: string; expectedGate?: string | null } | null }
  | { ok: false; error: string };

export async function POST(request: Request): Promise<Response> {
  let body: { pin?: unknown; ticketId?: unknown };
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

  if (!pin || !ticketId) {
    return NextResponse.json<CheckinResponse>(
      { ok: false, error: "PIN and ticketId are required." },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const ip = getClientIp(request);
    const failKey = `kiosk_fail:${ip}`;

    // Verify the PIN against the admin-only security doc.
    const secSnap = await db.doc(paths.adminSecurityDoc).get();
    const configuredPin = (secSnap.data()?.kioskPin as string | undefined) ?? "";
    const pinCorrect = configuredPin.length >= 4 && pin === configuredPin;

    if (!pinCorrect) {
      // Wrong PIN — record the failure and throttle repeated guessing.
      const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
      if (state.blocked) {
        return NextResponse.json<CheckinResponse>(
          { ok: false, error: "Too many failed attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
        );
      }
      // Same response for missing/mismatch to avoid PIN enumeration.
      return NextResponse.json<CheckinResponse>(
        { ok: false, error: "Kiosk is not available. Contact the event organizer." },
        { status: 403 }
      );
    }

    // Correct PIN — reset the failure counter so a legitimate kiosk is never
    // DOS-locked by someone else spamming wrong PINs from the same IP.
    await clearRateLimit(failKey);

    // Look up the ticket (Admin SDK bypasses firestore.rules).
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

    // Multi-gate enforcement: read the kiosk's assigned gate.
    const securitySnap = await db.doc(paths.adminSecurityDoc).get();
    const kioskGateId = securitySnap.exists
      ? String(securitySnap.data()?.kioskGateId ?? "")
      : "";

    // Idempotent: only grant if still coming-soon & unscanned.
    if (status === "coming-soon" && !scanned) {
      // Gate check — block wrong-gate scans without mutating the ticket.
      if (ticketGate && kioskGateId && ticketGate !== kioskGateId) {
        await logKioskAction(
          "SELF_CHECKIN",
          `Wrong gate: ${name} (ID: ${ticketId.slice(0, 6)}) — expected ${ticketGate}, kiosk at ${kioskGateId}`
        );
        return NextResponse.json<CheckinResponse>({
          ok: true,
          outcome: "wrong-gate",
          ticket: { name, id: ticketId, status, expectedGate: ticketGate },
        });
      }

      await ref.update({
        status: "arrived",
        scanned: true,
        scannedAt: Date.now(),
        scannedBy: "KIOSK",
        scannedAtGate: kioskGateId || null,
      });
      await logKioskAction(
        "SELF_CHECKIN",
        `Self check-in: ${name} (ID: ${ticketId.slice(0, 6)})`
      );
      return NextResponse.json<CheckinResponse>({
        ok: true,
        outcome: "granted",
        ticket: { name, id: ticketId, status: "arrived" },
      });
    }

    // Already scanned or otherwise not grantable — report without mutating.
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
