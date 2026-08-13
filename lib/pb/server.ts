// lib/pb/server.ts — Pocketbase server client (SERVER ONLY).
// Importing this from a client component fails the build (Pocketbase SDK uses
// Node/FormData APIs). Mirrors the role of the old lib/firebase/admin.ts.
//
// The server acts AS THE SUPERUSER (admin) — bypassing collection API rules —
// exactly as the Firebase Admin SDK bypassed Firestore security rules. The PB
// rules in pb_migrations remain as defense-in-depth for any client-direct access.
//
// Two modes:
//   - pbAdmin:  authenticated as superuser (CRUD on any collection). Use this in
//               server actions / route handlers that write data.
//   - pbForUser(token): authenticated as a logged-in user (respects rules). Used
//               to VERIFY a session token (authRefresh throws on invalid/expired).

import PocketBase from "pocketbase";
import { serverEnv } from "@/lib/env";

let _admin: PocketBase | null = null;

/** Admin-authenticated PB client (superuser). Lazy — auth happens once. */
export async function pbAdmin(): Promise<PocketBase> {
  if (_admin) {
    // Re-auth cheaply if the stored token is near expiry; authRefresh throws if invalid.
    try {
      await _admin.collection("_superusers").authRefresh();
      return _admin;
    } catch {
      _admin = null; // fall through and re-auth
    }
  }
  _admin = new PocketBase(serverEnv.pbUrl);
  await _admin.collection("_superusers").authWithPassword(
    serverEnv.pbAdminEmail,
    serverEnv.pbAdminPassword
  );
  return _admin;
}

/** A PB client authenticated as a specific user (respects collection rules).
 *  Used to verify a session token. Throws if the token is invalid/expired. */
export function pbForUser(token: string): PocketBase {
  const pb = new PocketBase(serverEnv.pbUrl);
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
