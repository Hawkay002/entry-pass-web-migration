// hooks/use-lock-status.ts — polls global_locks via the Admin SDK (admin only).
// Returns a map of email → lockedTabs array, refreshed every 5s for realtime.

"use client";

import { useEffect, useState } from "react";
import { fetchAllLocks } from "@/app/actions/admin";

/** Fetch all global_locks via server action (admin can read all via Admin SDK).
 *  Returns a map of email → lockedTabs array. Polled every 5s for realtime.
 */
export function useLockStatus() {
  const [lockMap, setLockMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetchAllLocks();
        if (active && res.ok) {
          setLockMap(res.map);
        }
      } catch {
        // ignore
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return lockMap;
}
