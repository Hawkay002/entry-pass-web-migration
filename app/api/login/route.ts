// app/api/login/route.ts — receives a Firebase ID token (minted by the browser),
// verifies it server-side, and exchanges it for an httpOnly session cookie.
//
// Supports admin 2FA (TOTP): if 2FA is enabled, the first POST returns a
// challenge. The client POSTs again with { idToken, code } to complete login.

import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { authConfig } from "@/lib/env";
import { paths } from "@/lib/paths";
import { logActionToRedis } from "@/lib/redis-log";
import { verifyTOTP, hashRecoveryCode, type TwoFactorConfig } from "@/lib/two-factor";
import type { AppUser } from "@/lib/auth";

/** Admin emails that auto-receive the admin role claim on login. */
const ADMIN_EMAILS = ["admin.test@gmail.com", "shovith2@gmail.com"];

const TWO_FACTOR_DOC = "admin_settings/two_factor";

/** Read the admin's 2FA config. */
async function read2FAConfig(uid: string): Promise<TwoFactorConfig | null> {
  const snap = await getAdminDb().doc(TWO_FACTOR_DOC).get();
  const admins = snap.data()?.admins as Record<string, TwoFactorConfig> | undefined;
  return admins?.[uid] ?? null;
}

export async function POST(req: NextRequest) {
  let body: { idToken?: unknown; code?: unknown; recoveryCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";

  if (!idToken) {
    return NextResponse.json(
      { ok: false, error: "ID token is required." },
      { status: 400 }
    );
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = decoded.email ?? "";

    const isAdminLogin = ADMIN_EMAILS.includes(email.toLowerCase());

    if (isAdminLogin) {
      // Auto-assign admin role for designated emails.
      const user = await auth.getUser(decoded.uid);
      if (!user.customClaims?.role) {
        await auth.setCustomUserClaims(decoded.uid, {
          ...user.customClaims,
          role: "admin",
        });
      }

      // Check if 2FA is enabled for this admin.
      const twoFA = await read2FAConfig(decoded.uid);
      if (twoFA?.enabled) {
        // 2FA is on — require a code.
        if (!code && !recoveryCode) {
          // Challenge: ask for the code.
          return NextResponse.json(
            { ok: false, status: "2fa_required" },
            { status: 200 }
          );
        }

        // Verify the code.
        if (code) {
          if (!verifyTOTP(code, twoFA.secret)) {
            return NextResponse.json(
              { ok: false, error: "Invalid verification code. Try again." },
              { status: 403 }
            );
          }
        } else if (recoveryCode) {
          // Check recovery codes.
          const hash = hashRecoveryCode(recoveryCode);
          const idx = twoFA.recoveryCodes.indexOf(hash);
          if (idx === -1) {
            return NextResponse.json(
              { ok: false, error: "Invalid recovery code." },
              { status: 403 }
            );
          }
          // Consume the recovery code (remove it from the list).
          const db = getAdminDb();
          const ref = db.doc(TWO_FACTOR_DOC);
          const snap = await ref.get();
          const admins = (snap.data()?.admins as Record<string, TwoFactorConfig>) ?? {};
          if (admins[decoded.uid]) {
            admins[decoded.uid].recoveryCodes.splice(idx, 1);
            await ref.set({ admins }, { merge: true });
          }
        }
      }
    } else {
      // Staff: verify email exists in the roles collection.
      const rolesSnap = await getAdminDb().collection(paths.rolesCollection).get();
      const allStaff = rolesSnap.docs.flatMap((d) => {
        const data = d.data();
        return (data.staff as { email: string }[]) ?? [];
      });
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

    // Mint a long-lived session cookie (14 days).
    const expiresInMs = 1000 * 60 * 60 * 24 * 14;
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });

    // Log the login.
    const displayName =
      typeof decoded.name === "string" && decoded.name.trim()
        ? decoded.name.trim()
        : email;
    const logUser: AppUser = {
      uid: decoded.uid,
      email,
      username: isAdminLogin ? "ADMIN" : displayName,
      role: isAdminLogin ? "admin" : "staff",
    };
    await logActionToRedis(logUser, "LOGIN", `${logUser.username} signed in`);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(authConfig.cookieName, sessionCookie, {
      ...authConfig.cookieSerializeOptions,
      httpOnly: true,
    });
    return res;
  } catch (err) {
    console.error("[login] session cookie creation failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not create session. Please try again." },
      { status: 401 }
    );
  }
}
