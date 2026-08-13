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

/** Create a fresh admin client and authenticate it as superuser. */
async function createAdminClient(): Promise<PocketBase> {
  const pb = new PocketBase(serverEnv.pbUrl);
  pb.autoCancellation(false); // critical for concurrent server use
  await pb.collection("_superusers").authWithPassword(
    serverEnv.pbAdminEmail,
    serverEnv.pbAdminPassword
  );
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
 *  Authoritative check — authRefresh validates the JWT signature server-side. */
export async function verifyUserToken(
  token: string
): Promise<{ id: string; email: string; role: string | null } | null> {
  try {
    const pb = pbForUser(token);
    await pb.collection("users").authRefresh();
    const u = pb.authStore.model as { id: string; email: string; role?: string } | null;
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role ?? null };
  } catch {
    return null;
  }
}
