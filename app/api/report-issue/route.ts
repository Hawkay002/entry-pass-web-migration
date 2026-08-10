// app/api/report-issue/route.ts — receives issue reports from the interactive
// ticket page and forwards them to a Telegram chat via the Bot API.
// Rate-limited: 5 submissions per IP per 5 minutes.

import { NextResponse } from "next/server";
import { getClientIp, recordFailure, clearRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_SEC = 5 * 60;

type ReportResponse =
  | { ok: true; reportId: string }
  | { ok: false; error: string };

/** Short, unique-ish report ID: RPT-{base36-timestamp}-{4-random}. */
function generateReportId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `RPT-${ts}-${rand}`;
}

export async function POST(request: Request): Promise<Response> {
  // Parse + validate body.
  let body: { name?: unknown; phone?: unknown; reason?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !phone || !reason || !message) {
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "All fields are required." },
      { status: 400 }
    );
  }
  if (message.length > 2000) {
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "Message is too long (max 2000 characters)." },
      { status: 400 }
    );
  }

  // Rate-limit by IP.
  const ip = getClientIp(request);
  const key = `report_issue:${ip}`;
  const state = await recordFailure(key, FAIL_LIMIT, FAIL_WINDOW_SEC);
  if (state.blocked) {
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(state.retryAfter) } }
    );
  }

  // Telegram credentials — fail gracefully if not configured.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!botToken || !chatId) {
    console.error("[report-issue] TELEGRAM_BOT_TOKEN or CHAT_ID not configured.");
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "Reporting is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const reportId = generateReportId();

  // Format the Telegram message.
  const text =
    `🎫 *EntryPass — Issue Report*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `*ID:* \`${reportId}\`\n` +
    `*Name:* ${escapeMd(name)}\n` +
    `*Phone:* ${escapeMd(phone)}\n` +
    `*Reason:* ${escapeMd(reason)}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `${escapeMd(message)}`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[report-issue] Telegram API error:", res.status, errBody);
      return NextResponse.json<ReportResponse>(
        { ok: false, error: "Failed to submit report. Please try again." },
        { status: 502 }
      );
    }

    // Success — clear the rate-limit counter so legit users aren't penalized.
    await clearRateLimit(key);

    return NextResponse.json<ReportResponse>(
      { ok: true, reportId },
      { status: 200 }
    );
  } catch (err) {
    console.error("[report-issue] send failed:", err);
    return NextResponse.json<ReportResponse>(
      { ok: false, error: "Failed to submit report. Please try again." },
      { status: 500 }
    );
  }
}

/** Escape special characters for Telegram MarkdownV2. */
function escapeMd(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
