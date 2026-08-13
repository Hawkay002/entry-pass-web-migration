// app/api/ticket-verify/route.ts — public phone verification for guest tickets.
// Two-factor guest access: ticket ID (URL) + phone number (this endpoint).
// Rate-limited: 5 wrong phone attempts per IP per 5 minutes.

import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type VerifyResponse =
  | { ok: true }
  | { ok: false; error: string };

export async function POST(request: Request): Promise<Response> {
  let body: { ticketId?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<VerifyResponse>(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";

  if (!ticketId || !phone) {
    return NextResponse.json<VerifyResponse>(
      { ok: false, error: "Ticket ID and phone number are required." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const failKey = `ticket_fail:${ip}`;

  try {
    const pb = await pbAdmin();
    let rec;
    try {
      rec = await pb.collection(paths.ticketsCollection).getOne(ticketId);
    } catch {
      // Don't reveal whether the ticket exists.
      const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
      if (state.blocked) {
        return NextResponse.json<VerifyResponse>(
          { ok: false, error: "Too many attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
        );
      }
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: "Verification failed. Check your details." },
        { status: 403 }
      );
    }

    const storedPhone = String(rec.phone ?? "").replace(/\D/g, "");

    // Match the full phone number including country code.
    const phoneMatches = storedPhone === phone;

    if (!phoneMatches) {
      const state = await recordFailure(failKey, FAIL_LIMIT, FAIL_WINDOW_SEC);
      if (state.blocked) {
        return NextResponse.json<VerifyResponse>(
          { ok: false, error: "Too many attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
        );
      }
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: "Phone number does not match this ticket." },
        { status: 403 }
      );
    }

    // Correct phone — reset the failure counter.
    await clearRateLimit(failKey);
    return NextResponse.json<VerifyResponse>({ ok: true });
  } catch (err) {
    console.error("[ticket-verify] ERROR:", err);
    return NextResponse.json<VerifyResponse>(
      { ok: false, error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
