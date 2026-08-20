// lib/pb/server.ts — Pocketbase server client (SERVER ONLY).
// Importing this from a client component fails the build. Mirrors the role of
// the old lib/firebase/admin.ts.
//
// The server acts AS THE SUPERUSER (admin) — bypassing collection API rules —
// exactly as the Firebase Admin SDK bypassed Firestore security rules. The PB
// rules in pb_migrations remain as defense-in-depth for any client-direct access.
//
// IMPORTANT: Pocketbase JS SDK auto-cancels overlapping requests from the same
// client instance by default. In a server context where many requests run
// concurrently, this causes deadlocks (one request aborts another mid-flight,
// which then hangs). We disable autoCancel AND auth-once-reuse to avoid this.

import PocketBase from "pocketbase";
import { serverEnv } from "@/lib/env";

let _admin: PocketBase | null = null;
let _adminAuthedAt = 0;
// PB token duration is 14d (set via bootstrap). Re-auth once per hour to be safe,
// not on every call (avoids the autoCancel deadlock under concurrency).
const REAUTH_INTERVAL_MS = 60 * 60 * 1000;

/** Create a fresh admin client and authenticate it as superuser.
 *  NOTE: _superusers MUST NOT have OTP/MFA enabled — this is a headless
 *  password-only API login; an MFA challenge here breaks every request
 *  ("Could not create session"). Dashboard-level MFA is incompatible with
 *  this app's architecture; the dashboard is instead protected by being
 *  reachable only from this machine. */
async function createAdminClient(): Promise<PocketBase> {
  const pb = new PocketBase(serverEnv.pbUrl);
  pb.autoCancellation(false); // critical for concurrent server use
  try {
    await pb.collection("_superusers").authWithPassword(
      serverEnv.pbAdminEmail,
      serverEnv.pbAdminPassword
    );
  } catch (err) {
    const resp = (err as { response?: { data?: { mfaId?: string } } }).response;
    if (resp?.data?.mfaId) {
      throw new Error(
        "Pocketbase dashboard OTP/MFA is ON — it blocks the app's server login. " +
        "Turn OFF OTP and MFA on the _superusers collection (dashboard → Collections → _superusers → Auth), " +
        "or run 6-DASHBOARD-UNLOCK.bat. The dashboard is already protected by being local-only."
      );
    }
    throw err;
  }
  return pb;
}

/** Admin-authenticated PB client (superuser). Auth happens once then reused. */
export async function pbAdmin(): Promise<PocketBase> {
  const now = Date.now();
  if (_admin && now - _adminAuthedAt < REAUTH_INTERVAL_MS) {
    return _admin;
  }
  _admin = await createAdminClient();
  _adminAuthedAt = now;
  return _admin;
}

/** A PB client authenticated as a specific user (respects collection rules).
 *  Used to verify a session token. Throws if the token is invalid/expired. */
export function pbForUser(token: string): PocketBase {
  const pb = new PocketBase(serverEnv.pbUrl);
  pb.autoCancellation(false);
  pb.authStore.save(token, null);
  return pb;
}

/** Verify a user's auth token. Returns the user record on success, null on failure.
 *  Authoritative check — authRefresh validates the JWT signature server-side.
 *
 *  Resilience: the PB server may be behind a tunnel with occasional hiccups.
 *  A single failed roundtrip must NOT log the user out, so:
 *   - verified tokens are cached briefly (60s) — avoids one tunnel hit per request
 *   - network-level failures (status 0) are retried once
 *   - only a definitive auth rejection (401) returns null */
interface VerifiedUser {
  id: string;
  email: string;
  role: string | null;
}

const verifiedCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();
const VERIFY_CACHE_MS = 60_000;

function isNetworkError(err: unknown): boolean {
  const e = err as { status?: number; isAbort?: boolean };
  return !e?.status || e.status === 0 || Boolean(e.isAbort);
}

export async function verifyUserToken(
  token: string
): Promise<VerifiedUser | null> {
  // Recently verified — skip the roundtrip.
  const cached = verifiedCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const pb = pbForUser(token);
      await pb.collection("users").authRefresh();
      const u = pb.authStore.model as { id: string; email: string; role?: string } | null;
      if (!u) return null; // token structurally invalid
      const user: VerifiedUser = { id: u.id, email: u.email, role: u.role ?? null };
      verifiedCache.set(token, { user, expiresAt: Date.now() + VERIFY_CACHE_MS });
      return user;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        // Definitive rejection — token genuinely invalid/expired.
        console.log("[auth] token definitively rejected (401/403)");
        verifiedCache.delete(token);
        return null;
      }
      // Network-level failure — retry with backoff, then fail OPEN with the
      // last known-good result if we have one. A fresh token's FIRST
      // verification has no fallback, so give the tunnel every chance.
      console.log(`[auth] verify network failure (attempt ${attempt}/3, status ${status ?? "none"})`);
      if (attempt === 3) {
        const lastGood = verifiedCache.get(token);
        if (lastGood) {
          console.log("[auth] failing OPEN with last-known-good");
          return lastGood.user;
        }
        console.error("[auth] BOUNCE: tunnel unreachable for fresh token — user will be logged out");
        return null;
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return null;
}
