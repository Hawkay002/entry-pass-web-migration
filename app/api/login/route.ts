// app/api/login/route.ts — authenticate against Pocketbase and mint an httpOnly
// session cookie storing the PB auth token (14-day duration).
//
// Replaces the Firebase flow (client minted an idToken, server verified it).
// With PB we authenticate server-side directly (cleaner, no client SDK auth).
//
// Supports admin 2FA (TOTP): if 2FA is enabled, the first POST returns a
// challenge. The client POSTs again with { token, code } to complete login.

import { NextResponse, type NextRequest } from "next/server";
import PocketBase from "pocketbase";
import { authConfig, serverEnv } from "@/lib/env";
import { pbAdmin, verifyUserToken } from "@/lib/pb/server";
import { logAction } from "@/lib/pb/log";
import { verifyTOTP, hashRecoveryCode, type TwoFactorConfig } from "@/lib/two-factor";
import type { AppUser } from "@/lib/auth";

/** Designated admin emails — always get admin access even if their PB `role`
 *  field isn't set. Matches the old ADMIN_EMAILS override. */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Read the admin's 2FA config from the two_factor collection. Keyed by user id. */
async function read2FAConfig(
  userId: string
): Promise<TwoFactorConfig | null> {
  try {
    const pb = await pbAdmin();
    const rec = await pb.collection("two_factor").getOne("twofactor000000");
    const admins = (rec.admins as Record<string, TwoFactorConfig>) ?? {};
    return admins[userId] ?? null;
  } catch {
    return null;
  }
}

/** Update the 2FA config for a user (e.g. consume a recovery code). */
async function update2FAConfig(
  userId: string,
  updater: (cfg: TwoFactorConfig) => void
): Promise<void> {
  const pb = await pbAdmin();
  const rec = await pb.collection("two_factor").getOne("twofactor000000");
  const admins = (rec.admins as Record<string, TwoFactorConfig>) ?? {};
  if (admins[userId]) {
    updater(admins[userId]);
    await pb.collection("two_factor").update(rec.id, { admins });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    email?: unknown;
    password?: unknown;
    token?: unknown; // PB token from a prior auth (2FA continuation)
    oauthCode?: unknown; // Google OAuth authorization code (redirect flow)
    codeVerifier?: unknown; // PKCE verifier from listAuthMethods
    redirectUri?: unknown; // exact redirect_uri used at the authorize step
    code?: unknown;
    recoveryCode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  const recoveryCode =
    typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";

  try {
    let pbToken = "";
    let email = "";
    let userId = "";
    let isAdminLogin = false;

    if (typeof body.oauthCode === "string" && body.oauthCode) {
      // Google OAuth redirect-flow completion: exchange the authorization code
      // with Pocketbase server-side. The redirect_uri MUST match the one used
      // when starting the flow (our /api/oauth/callback on this origin).
      const codeVerifier = typeof body.codeVerifier === "string" ? body.codeVerifier : "";
      // The client sends the EXACT redirect_uri it used at the authorize step.
      // Google requires a byte-identical redirect_uri at the token exchange —
      // deriving it from req.url here is unreliable on serverless (Vercel),
      // where req.url may not carry the public origin.
      const redirectUrl =
        typeof body.redirectUri === "string" && body.redirectUri
          ? body.redirectUri
          : new URL(req.url).origin + "/api/oauth/callback";
      const pb = new PocketBase(serverEnv.pbUrl);
      pb.autoCancellation(false);
      let auth;
      try {
        auth = await pb.collection("users").authWithOAuth2Code(
          "google",
          body.oauthCode,
          codeVerifier,
          redirectUrl
        );
      } catch (ex) {
        const exErr = ex as { status?: number; message?: string; response?: unknown };
        console.error("[login][oauth] exchange failed:", {
          status: exErr.status,
          message: exErr.message,
          response: JSON.stringify(exErr.response ?? {}).slice(0, 500),
          redirectUrl,
          verifierLen: codeVerifier.length,
        });
        return NextResponse.json(
          { ok: false, error: "Google sign-in failed (code exchange). Please try again." },
          { status: 401 }
        );
      }
      const record = auth.record as unknown as { id: string; email: string; role?: string } | null;
      if (!record) {
        return NextResponse.json({ ok: false, error: "Google sign-in failed." }, { status: 401 });
      }
      userId = record.id;
      email = record.email;
      pbToken = (pb.authStore.token as string) ?? "";
      isAdminLogin =
        ADMIN_EMAILS.includes(email.toLowerCase()) || record.role === "admin";
    } else if (typeof body.token === "string" && body.token) {
      // Token continuation: either an OAuth-issued token OR a 2FA resume.
      // Verify it authoritatively via authRefresh (validates JWT signature).
      pbToken = body.token;
      const verified = await verifyUserToken(pbToken);
      if (!verified) {
        return NextResponse.json({ ok: false, error: "Session expired. Try again." }, { status: 401 });
      }
      userId = verified.id;
      email = verified.email;
      isAdminLogin =
        ADMIN_EMAILS.includes(email.toLowerCase()) || verified.role === "admin";
    } else {
      // Step 1: authenticate with email/password.
      const emailIn = typeof body.email === "string" ? body.email.trim() : "";
      const passwordIn = typeof body.password === "string" ? body.password : "";
      if (!emailIn || !passwordIn) {
        return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
      }

      const pb = new PocketBase(serverEnv.pbUrl);
      pb.autoCancellation(false);
      const auth = await pb.collection("users").authWithPassword(emailIn, passwordIn);
      const record = auth.record;
      if (!record) {
        return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
      }
      userId = record.id;
      email = record.email;
      pbToken = (pb.authStore.token as string) ?? "";
      isAdminLogin =
        ADMIN_EMAILS.includes(email.toLowerCase()) ||
        record.role === "admin";
    }

    if (isAdminLogin) {
      // Ensure the admin role is set on the user record (lazy backfill).
      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        const pb = await pbAdmin();
        try {
          const rec = await pb.collection("users").getOne(userId);
          if (rec.role !== "admin") {
            await pb.collection("users").update(userId, { role: "admin" });
          }
        } catch {
          /* ignore — role will be resolved by ADMIN_EMAILS anyway */
        }
      }

      // Check if 2FA is enabled for this admin.
      const twoFA = await read2FAConfig(userId);
      if (twoFA?.enabled) {
        if (!code && !recoveryCode) {
          // Challenge: ask for the code. Return the pending token.
          return NextResponse.json({ ok: false, status: "2fa_required", token: pbToken }, { status: 200 });
        }

        if (code) {
          if (!verifyTOTP(code, twoFA.secret)) {
            return NextResponse.json(
              { ok: false, error: "Invalid verification code. Try again." },
              { status: 403 }
            );
          }
        } else if (recoveryCode) {
          const hash = hashRecoveryCode(recoveryCode);
          const idx = twoFA.recoveryCodes.indexOf(hash);
          if (idx === -1) {
            return NextResponse.json({ ok: false, error: "Invalid recovery code." }, { status: 403 });
          }
          // Consume the recovery code.
          await update2FAConfig(userId, (cfg) => {
            cfg.recoveryCodes.splice(idx, 1);
          });
        }
      }
    } else {
      // Staff: verify their email exists in the roles collection.
      const pb = await pbAdmin();
      const roles = await pb.collection("roles").getFullList({ fields: "staff" });
      const allStaff = roles.flatMap((r) => (r.staff as { email: string }[]) ?? []);
      const found = allStaff.some(
        (s) => s.email.toLowerCase() === email.toLowerCase()
      );
      if (!found) {
        return NextResponse.json(
          { ok: false, error: "This email is not authorized. Contact admin." },
          { status: 403 }
        );
      }
    }

    // Log the login.
    const username = isAdminLogin ? "ADMIN" : email;
    const logUser: AppUser = {
      uid: userId,
      email,
      username,
      role: isAdminLogin ? "admin" : "staff",
    };
    await logAction(logUser, "LOGIN", `${username} signed in`).catch(() => {});

    if (!pbToken) {
      // Defensive: an empty token would make Next drop the Set-Cookie header
      // silently — fail loudly instead of returning a fake success.
      return NextResponse.json(
        { ok: false, error: "Session could not be created. Please try again." },
        { status: 500 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(authConfig.cookieName, pbToken, {
      ...authConfig.cookieSerializeOptions,
      httpOnly: true,
    });
    return res;
  } catch (err) {
    const msg = (err as { message?: string }).message ?? "";
    // Pocketbase throws ClientResponseError with these messages on bad creds.
    if (msg.includes("Failed to authenticate") || msg.includes("Invalid login")) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }
    console.error("[login] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not create session. Please try again." },
      { status: 401 }
    );
  }
}
