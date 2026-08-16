// hooks/use-roles.ts — polled subscription to the roles collection.
// Used by admin to display role cards + staff in Remote Device Management.

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchRoles } from "@/app/actions/roles";
import type { StaffRole } from "@/lib/types";

export function useRoles() {
  const { data, loading } = usePolledData(
    async () => {
      const res = await fetchRoles();
      return res.ok ? res.roles : [];
    },
    12000
  );

  const roles = useMemo(() => data ?? [], [data]);
  return { roles, loading };
}
