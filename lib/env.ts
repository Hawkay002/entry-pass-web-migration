// lib/env.ts — typed, validated environment access (Pocketbase backend).
// Throws early if a required variable is missing, with a clear message.

function required(name: string, val: string | undefined): string {
  if (!val || val.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`
    );
  }
  return val;
}

/** Public Pocketbase URL — safe to expose to the browser. */
export const clientEnv = {
  pbUrl: required("NEXT_PUBLIC_POCKETBASE_URL", process.env.NEXT_PUBLIC_POCKETBASE_URL),
} as const;

/** Server-only Pocketbase config (admin SDK + session cookie). */
export const serverEnv = {
  pbUrl: process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090",
  pbAdminEmail: required("POCKETBASE_ADMIN_EMAIL", process.env.POCKETBASE_ADMIN_EMAIL),
  pbAdminPassword: required("POCKETBASE_ADMIN_PASSWORD", process.env.POCKETBASE_ADMIN_PASSWORD),
} as const;

/**
 * Auth/session cookie config. Matches the shape the old Firebase app used, so
 * proxy.ts and the login/logout routes stay nearly identical.
 */
export const authConfig = {
  cookieName: process.env.AUTH_COOKIE_NAME ?? "pb_session",
  // 14-day session, matching the previous app's cookie lifetime. The PB auth
  // token duration is also set to 14d via the collections API (see bootstrap).
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  },
} as const;

/** Optional: Google Wallet pass class ID for the "Save to Wallet" button.
 *  Set this after creating a pass class in the Google Pay & Wallet Console.
 *  If absent, the Wallet button shows "Coming Soon". */
export const GOOGLE_WALLET_PASS_CLASS_ID = process.env.GOOGLE_WALLET_PASS_CLASS_ID ?? "";
export const GOOGLE_WALLET_ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? "";
