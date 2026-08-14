// lib/pb/server-auth.ts — resolve the session cookie into an AppUser.
//
// The session cookie stores a Pocketbase auth token (minted by /api/login).
// We verify it server-side via authRefresh (validates the JWT signature),
// then resolve the user's identity the same way the old Firebase code did:
//   - Designated admin emails → role "admin", username "ADMIN".
//   - Everyone else → looked up in the `roles` collection by email. If they
//     are not in any role, they are rejected (auto-kicked, matching Firebase).

import { cookies } from "next/headers";
import { authConfig } from "@/lib/env";
import { verifyUserToken, pbAdmin } from "@/lib/pb/server";
import type { AppUser } from "@/lib/auth";
import type { Role, StaffMember } from "@/lib/types";

/** Designated admin emails — always get admin access even if their PB `role`
 *  field isn't set. Matches the old ADMIN_EMAILS override in server-auth.ts. */
const ADMIN_EMAILS = ["admin.test@gmail.com", "shovith2@gmail.com"];

/** Short-lived cache of staff lookups (email → resolved AppUser). */
const staffCache = new Map<string, { user: AppUser; expiresAt: number }>();
const STAFF_CACHE_MS = 60_000;

export async function getAppUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authConfig.cookieName)?.value;
  if (!token) return null;

  const verified = await verifyUserToken(token);
  if (!verified) return null;

  const email = verified.email ?? "";
  const isAdminByEmail = ADMIN_EMAILS.includes(email.toLowerCase());

  if (isAdminByEmail || verified.role === "admin") {
    return {
      uid: verified.id,
      email,
      username: "ADMIN",
      role: "admin",
    };
  }

  // Staff: find their name + gate from the roles collection by email.
  // Cached briefly — this runs on every request and each lookup is a tunnel
  // roundtrip; role membership changes are picked up within the cache window.
  try {
    const cached = staffCache.get(email.toLowerCase());
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    const pb = await pbAdmin();
    const roles = await pb.collection("roles").getFullList({ fields: "name,staff" });
    let foundName = "";
    let foundRole: Role = "staff";
    let foundGateId: string | null = null;
    for (const r of roles) {
      const staff = (r.staff as StaffMember[]) ?? [];
      const match = staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
      if (match) {
        foundName = match.name;
        foundRole = r.name;
        foundGateId = match.gateId ?? null;
        break;
      }
    }
    if (!foundName) {
      console.log("[server-auth] staff not in any role, rejecting:", email);
      return null;
    }
    const user = {
      uid: verified.id,
      email,
      username: foundName,
      role: foundRole,
      gateId: foundGateId,
    };
    staffCache.set(email.toLowerCase(), { user, expiresAt: Date.now() + STAFF_CACHE_MS });
    return user;
  } catch (err) {
    console.error("[server-auth] roles lookup failed:", err);
    return null;
  }
}
