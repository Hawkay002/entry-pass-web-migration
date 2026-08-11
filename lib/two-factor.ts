// lib/two-factor.ts — TOTP (Time-based One-Time Password) utilities for admin 2FA.
// Uses otplib v13 API (generateSecret, generateSync, verifySync).

import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import { createHash, randomBytes } from "crypto";

/** Generate a new base32 TOTP secret. */
export function generate2FASecret(): string {
  return generateSecret();
}

/** Generate the current 6-digit TOTP code for a secret (testing/debugging). */
export function generateTOTP(secret: string): string {
  return generateSync({ secret });
}

/** Verify a 6-digit TOTP code against a secret. */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token: token.replace(/\s/g, ""), secret });
    return result.valid === true;
  } catch {
    return false;
  }
}

/** Generate the otpauth:// URI for QR code scanning. */
export function generateQRUrl(secret: string, email: string): string {
  return generateURI({ secret, label: email, issuer: "EntryPass" });
}

/** Generate a QR code data URL from an otpauth URI (for inline display). */
export async function generateQRDataUrl(uri: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(uri, { width: 220, margin: 1 });
}

/** Generate 8 one-time recovery codes (format: XXXX-XXXX). */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = randomBytes(4);
    const hex = bytes.toString("hex").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}

/** Hash a recovery code for storage (SHA-256). */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Per-admin 2FA config stored in Firestore. */
export interface TwoFactorConfig {
  secret: string;
  enabled: boolean;
  recoveryCodes: string[]; // hashed (SHA-256)
  setupAt: number;
}
