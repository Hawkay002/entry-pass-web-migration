// app/api/kiosk-tickets/route.ts — public, PIN-gated fetch of the minimal
// ticket list for a kiosk's offline cache. Returns ONLY id + status + scanned
// (NO names, phones, or other PII). Validates against a specific kiosk's PIN.

import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";
import type { KioskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type TicketsResponse =
  | { ok: true; tickets: { id: string; status: string; scanned: boolean }[] }
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
  let body: { pin?: unknown; kioskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<TicketsResponse>(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const pin = typeof body.pin === "string" ? body.pin.replace(/\D/g, "") : "";
  const kioskId = typeof body.kioskId === "string" ? body.kioskId.trim() : "";

  if (!pin || !kioskId) {
    return NextResponse.json<TicketsResponse>(
      { ok: false, error: "PIN and kioskId are required." },
      { status: 400 }
    );
  }

  try {
    const pb = await pbAdmin();
    const ip = getClientIp(request);
    const failKey = `kiosk_fail:${kioskId}:${ip}`;

    // Find the kiosk + validate PIN.
    const kiosk = await findKiosk(pb, kioskId);
    if (!kiosk || kiosk.pin.length < 4 || pin !== kiosk.pin) {
      const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
      if (state.blocked) {
        return NextResponse.json<TicketsResponse>(
          { ok: false, error: "Too many failed attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
        );
      }
      return NextResponse.json<TicketsResponse>(
        { ok: false, error: "Kiosk is not available. Contact the event organizer." },
        { status: 403 }
      );
    }

    await clearRateLimit(failKey);

    // Return ONLY the minimal fields needed for offline validation. No PII.
    const snap = await pb.collection(paths.ticketsCollection).getFullList({
      fields: "id,status,scanned",
    });
    const tickets = snap.map((d) => ({
      id: d.id,
      status: String(d.status ?? "coming-soon"),
      scanned: Boolean(d.scanned),
    }));

    return NextResponse.json<TicketsResponse>({ ok: true, tickets });
  } catch (err) {
    console.error("[kiosk-tickets] ERROR:", err);
    return NextResponse.json<TicketsResponse>(
      { ok: false, error: "Failed to load tickets." },
      { status: 500 }
    );
  }
}
