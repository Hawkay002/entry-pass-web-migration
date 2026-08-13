// hooks/use-remote-locks.ts — staff-side polled listener for remote locks.
// Replaces the Firestore onSnapshot on global_locks/{userEmail}. Resolves the
// locked tabs + metadata for the current username, exposed so the nav + layout
// can enforce them.

"use client";

import { useState } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchLockDashboard } from "@/app/actions/admin";
import type { LockMetadata, TabName } from "@/lib/types";

export interface RemoteLockState {
  lockedTabs: TabName[];
  metadata: LockMetadata | null;
}

export function useRemoteLocks(userEmail: string | null, username: string | null) {
  // No polling for admins / unauthenticated — they have no staff locks.
  const enabled = Boolean(userEmail && username && username !== "ADMIN");

  const { data } = usePolledData(
    async () => {
      if (!userEmail) return null;
      const res = await fetchLockDashboard();
      if (!res.ok) return null;
      // The dashboard aggregates all locks; find this user's email.
      const emailKey = userEmail.toLowerCase();
      const meta = res.maintActive
        ? ({ type: "maintenance", duration: res.maintDuration, updatedAt: res.maintUpdatedAt ?? 0 } as LockMetadata)
        : null;
      const tabs = (res.lockMap[emailKey] as TabName[]) ?? [];
      return { lockedTabs: tabs, metadata: meta };
    },
    2500,
    enabled
  );

  const [empty] = useState<RemoteLockState>({ lockedTabs: [], metadata: null });
  return data ?? empty;
}
