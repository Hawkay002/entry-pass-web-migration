// lib/firebase/server-auth.ts — resolve the session cookie into an AppUser.
//
// Uses firebase-admin's verifySessionCookie (matches the cookie created in
// /api/login via firebase-admin). Custom claims (role) are read from the
// decoded token. Staff usernames are resolved from the roles collection.

import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { authConfig } from "@/lib/env";
import { paths } from "@/lib/paths";
import { ROLE_CLAIM, type AppUser } from "@/lib/auth";
import type { Role, StaffMember } from "@/lib/types";

function decodeRole(claim: unknown): Role {
  if (claim === "admin") return "admin";
  // Staff roles are dynamic — return the claim or a default.
  return (claim as Role) ?? "staff";
}

// Same list as the login route — ensures designated admin emails always
// get admin access even before their custom claim propagates.
const ADMIN_EMAILS = ["admin.test@gmail.com", "shovith2@gmail.com"];

export async function getAppUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(authConfig.cookieName)?.value;
  if (!cookie) return null;

  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(cookie, true);
  } catch (err) {
    console.error("[server-auth] session cookie invalid:", err);
    return null;
  }

  const role = decodeRole(decoded[ROLE_CLAIM]);
  const email = decoded.email ?? "";

  // Override: designated admin emails always get admin, even if the claim
  // hasn't propagated to the session cookie yet (first login case).
  const isAdmin = role === "admin" || ADMIN_EMAILS.includes(email.toLowerCase());

  let username = "ADMIN";

  if (!isAdmin) {
    // Staff: find their name from the roles collection by email.
    // If they're NOT in any role, return null (auto-kicks them out).
    try {
      const rolesSnap = await getAdminDb().collection(paths.rolesCollection).get();
      let foundName = "";
      let foundRole: Role = "staff";
      let foundGateId: string | null = null;
      rolesSnap.docs.forEach((d) => {
        const data = d.data();
        const staff = (data.staff as StaffMember[]) ?? [];
        const match = staff.find(
          (s) => s.email.toLowerCase() === email.toLowerCase()
        );
        if (match) {
          foundName = match.name;
          foundRole = d.id;
          foundGateId = match.gateId ?? null;
        }
      });
      // If not found in any role, they've been removed — reject them.
      if (!foundName) {
        console.log("[server-auth] staff not in any role, rejecting:", email);
        return null;
      }
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        username: foundName,
        role: foundRole,
        gateId: foundGateId,
      };
    } catch {
      return null;
    }
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    username,
    role: isAdmin ? "admin" : role,
  };
}
