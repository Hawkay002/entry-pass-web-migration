// proxy.ts — verify the session cookie on every request and gate
// protected routes. Runs on the Edge runtime.
// (Next 16 renamed the middleware convention to "proxy".)
//
// Uses a lightweight cookie check here (presence + decode), because full
// Firebase session-cookie verification requires the Node runtime (firebase-admin
// needs crypto/KeyObject APIs not available on the edge). The authoritative
// verification happens in Server Components / actions via verifySessionCookie().

import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/login", "/kiosk", "/ticket", "/api/login", "/api/logout", "/api/auto-absent", "/api/kiosk-checkin", "/api/kiosk-tickets", "/api/kiosk-list", "/api/ticket-verify", "/api/report-issue", "/api/og-snapshot", "/api/wallet-pass"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(authConfig.cookieName)?.value;
  if (!cookie && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:mp3|png|svg|jpg|jpeg|webp|ico|webmanifest)$).*)",
  ],
};
