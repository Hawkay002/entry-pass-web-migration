// hooks/use-lock-dashboard.ts — combined lock + maintenance status.
// Polls fetchLockDashboard() every 15s (single read of global_locks).
// Replaces the former pattern of 3 separate 5s polls (useLockStatus +
// fetchMaintenanceInfo + checkAndEndMaintenance = 3 reads per 5s).

"use client";

import { useEffect, useState } from "react";
import { fetchLockDashboard, checkAndEndMaintenance } from "@/app/actions/admin";
import { toast } from "sonner";

interface LockDashboard {
  lockMap: Record<string, string[]>;
  maintActive: boolean;
  maintDuration: string | null;
  maintUpdatedAt: number | null;
}

/** Polls global_locks once every 15s. Returns lock map + maintenance info.
 *  Also auto-ends maintenance if duration has elapsed (client-side check
 *  triggers the server action only when needed). */
export function useLockDashboard() {
  const [data, setData] = useState<LockDashboard>({
    lockMap: {},
    maintActive: false,
    maintDuration: null,
    maintUpdatedAt: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetchLockDashboard();
        if (!active || !res.ok) return;

        setData({
          lockMap: res.lockMap,
          maintActive: res.maintActive,
          maintDuration: res.maintDuration,
          maintUpdatedAt: res.maintUpdatedAt,
        });

        // Only call checkAndEndMaintenance when maintenance is active —
        // avoids a redundant server call when there's nothing to end.
        if (res.maintActive && res.maintUpdatedAt && res.maintDuration) {
          const now = Date.now();
          const dur = res.maintDuration;
          const hrMatch = dur.match(/(\d+)\s*hr/);
          const minMatch = dur.match(/(\d+)\s*min/);
          const hrs = hrMatch ? Number(hrMatch[1]) : 0;
          const mins = minMatch ? Number(minMatch[1]) : 0;
          const durationMs = (hrs * 60 + mins) * 60 * 1000;
          if (now > res.maintUpdatedAt + durationMs) {
            const endRes = await checkAndEndMaintenance();
            if (active && endRes.ok && endRes.ended) {
              toast.success("Maintenance time over — all staff unlocked automatically");
            }
          }
        }
      } catch {
        // ignore
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return data;
}
