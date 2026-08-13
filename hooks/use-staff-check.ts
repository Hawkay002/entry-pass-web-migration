// hooks/use-staff-check.ts — polled check: is the current staff still in any role?
// If not (admin removed them), immediately sign out and redirect to /login.
// Replaces the Firestore onSnapshot on the roles collection with polling.

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchRoles } from "@/app/actions/roles";

export function useStaffCheck(userEmail: string | null, isAdmin: boolean) {
  const router = useRouter();
  const kickedRef = useRef(false);

  useEffect(() => {
    // Only run for non-admin staff.
    if (!userEmail || isAdmin) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        const res = await fetchRoles();
        if (!res.ok || cancelled) {
          if (!cancelled) timer = setTimeout(check, 4000);
          return;
        }
        const found = res.roles.some((r) =>
          (r.staff ?? []).some((s) => s.email.toLowerCase() === userEmail!.toLowerCase())
        );
        if (!found && !kickedRef.current) {
          // Staff has been removed — kick them out immediately.
          kickedRef.current = true;
          console.log("[staff-check] User removed from all roles, signing out");
          fetch("/api/logout", { method: "POST" }).then(() => {
            router.push("/login");
            router.refresh();
          });
          return;
        }
        if (!cancelled) timer = setTimeout(check, 5000);
      } catch (err) {
        console.error("[staff-check] check error:", err);
        if (!cancelled) timer = setTimeout(check, 5000);
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userEmail, isAdmin, router]);
}
