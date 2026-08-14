// app/api/oauth/callback/route.ts — Google OAuth redirect target.
// Google sends the user back here with ?code=&state=. We bounce them to the
// login page, whose effect completes the exchange (the PKCE verifier lives in
// the browser's sessionStorage, so the client must finish it).

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    const err = searchParams.get("error") ?? "oauth_failed";
    return NextResponse.redirect(new URL(`/login?oauth_error=${encodeURIComponent(err)}`, req.url));
  }

  return NextResponse.redirect(
    new URL(`/login?oauth_code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? "")}`, req.url)
  );
}
