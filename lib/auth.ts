// lib/auth.ts — role + claim helpers shared between server and client.
//
// Roles are stored as a custom claim `role` on each Firebase Auth user,
// set via the Admin SDK (see lib/firebase/admin-claims.ts, Phase 2 staff mgmt).

import type { Role } from "@/lib/types";

/** Name of the custom claim that holds the user's role. */
export const ROLE_CLAIM = "role";

/** Name of the custom claim holding the staff's chosen username. */
export const USERNAME_CLAIM = "username";

/**
 * The authenticated user as resolved from the session cookie.
 * `username` is "ADMIN" for admins, otherwise the staff username.
 */
export interface AppUser {
  uid: string;
  email: string | null;
  username: string;
  role: Role;
  /** Gate id this scanner is assigned to (multi-gate mode). null/undefined otherwise. */
  gateId?: string | null;
}

export function isAdmin(user: AppUser | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Guard for server actions / route handlers. Throws if the user is not an admin.
 * The thrown message is for logs; route handlers map it to a 403 response.
 */
export function requireAdmin(user: AppUser | null): asserts user {
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden: admin role required.");
  }
}
