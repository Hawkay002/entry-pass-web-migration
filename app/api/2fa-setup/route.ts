// app/api/2fa-setup/route.ts — admin 2FA setup endpoints.
// GET: returns QR code + secret for scanning. POST: verifies first code, enables 2FA.
// DELETE: disables 2FA. All admin-only.

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";
import { logAction } from "@/lib/firebase/log";
import {
  generate2FASecret,
  generateQRUrl,
  generateQRDataUrl,
  verifyTOTP,
  generateRecoveryCodes,
  hashRecoveryCode,
  type TwoFactorConfig,
} from "@/lib/two-factor";

export const dynamic = "force-dynamic";

const TWO_FACTOR_DOC = "admin_settings/two_factor";

/** Read the admin's 2FA config (or null if not set up). */
async function readConfig(uid: string): Promise<TwoFactorConfig | null> {
  const snap = await getAdminDb().doc(TWO_FACTOR_DOC).get();
  const admins = snap.data()?.admins as Record<string, TwoFactorConfig> | undefined;
  return admins?.[uid] ?? null;
}

/** Write the admin's 2FA config. */
async function writeConfig(uid: string, config: TwoFactorConfig): Promise<void> {
  const db = getAdminDb();
  const ref = db.doc(TWO_FACTOR_DOC);
  const snap = await ref.get();
  const admins = (snap.data()?.admins as Record<string, TwoFactorConfig>) ?? {};
  admins[uid] = config;
  await ref.set({ admins }, { merge: true });
}

/** Remove the admin's 2FA config. */
async function removeConfig(uid: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.doc(TWO_FACTOR_DOC);
  const snap = await ref.get();
  const admins = (snap.data()?.admins as Record<string, TwoFactorConfig>) ?? {};
  delete admins[uid];
  await ref.set({ admins }, { merge: true });
}

// GET — returns QR code + secret for setup (does NOT enable yet).
export async function GET(): Promise<Response> {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin required." }, { status: 403 });
  }

  // Check if already enabled.
  const existing = await readConfig(user.uid);
  if (existing?.enabled) {
    return NextResponse.json({ ok: true, status: "already_enabled" });
  }

  // Generate a new secret (temporary — only persisted on POST after verification).
  const secret = generate2FASecret();
  const uri = generateQRUrl(secret, user.email ?? "admin");
  const qrDataUrl = await generateQRDataUrl(uri);

  return NextResponse.json({
    ok: true,
    status: "setup",
    secret,
    qrDataUrl,
  });
}

// POST — verify the first code, enable 2FA, return recovery codes.
export async function POST(request: Request): Promise<Response> {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin required." }, { status: 403 });
  }

  let body: { secret?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const secret = typeof body.secret === "string" ? body.secret : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";

  if (!secret || !code) {
    return NextResponse.json({ ok: false, error: "Secret and code required." }, { status: 400 });
  }

  if (!verifyTOTP(code, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid code. Try again." }, { status: 400 });
  }

  // Generate recovery codes.
  const recoveryCodes = generateRecoveryCodes();
  const hashedCodes = recoveryCodes.map(hashRecoveryCode);

  await writeConfig(user.uid, {
    secret,
    enabled: true,
    recoveryCodes: hashedCodes,
    setupAt: Date.now(),
  });

  await logAction(user, "LOGIN", "2FA enabled for admin account");

  return NextResponse.json({
    ok: true,
    recoveryCodes, // plaintext — shown once, never again.
  });
}

// DELETE — disable 2FA (requires current TOTP code for safety).
export async function DELETE(request: Request): Promise<Response> {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin required." }, { status: 403 });
  }

  const config = await readConfig(user.uid);
  if (!config?.enabled) {
    return NextResponse.json({ ok: false, error: "2FA not enabled." }, { status: 400 });
  }

  // Require a valid code to disable (prevent unauthorized removal).
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";

  if (!verifyTOTP(code, config.secret)) {
    return NextResponse.json({ ok: false, error: "Invalid code." }, { status: 400 });
  }

  await removeConfig(user.uid);
  await logAction(user, "LOGIN", "2FA disabled for admin account");

  return NextResponse.json({ ok: true });
}
