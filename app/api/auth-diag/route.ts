// app/api/auth-diag/route.ts — TEMPORARY diagnostic endpoint.
// Reports exactly what the server sees: cookie presence, verification outcome,
// and timing. Hit it in the browser right after a login bounce to determine
// whether the session cookie exists client-side.
// DELETE THIS FILE once the OAuth login issue is resolved.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/env";
import { verifyUserToken } from "@/lib/pb/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authConfig.cookieName)?.value;

  if (!token) {
    console.log("[auth-diag] NO COOKIE reached the server");
    return NextResponse.json({
      ok: false,
      cookiePresent: false,
      diagnosis: "The pb_session cookie was NOT sent by the browser. If you logged in moments ago, the cookie either was never stored or is being blocked/stripped client-side.",
    });
  }

  const t0 = Date.now();
  const verified = await verifyUserToken(token);
  const elapsed = Date.now() - t0;

  return NextResponse.json({
    ok: true,
    cookiePresent: true,
    tokenLength: token.length,
    verified: Boolean(verified),
    email: verified?.email ?? null,
    role: verified?.role ?? null,
    verifyMs: elapsed,
    diagnosis: verified
      ? "Cookie present AND token verifies. You ARE authenticated — any bounce you see is a client-side rendering/navigation issue, not auth."
      : "Cookie present but token did NOT verify against Pocketbase (tunnel or PB issue).",
  });
}
