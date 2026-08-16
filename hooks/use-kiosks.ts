// hooks/use-kiosks.ts — polled subscription to the kiosks list.
// Admin-only. Returns the kiosk list WITHOUT PINs (for display only).

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { getKiosksList } from "@/app/actions/admin";

export interface KioskListItem {
  id: string;
  name: string;
  gateId: string | null;
  createdAt: number;
}

export function useKiosks() {
  const { data, loading } = usePolledData(
    async () => {
      const res = await getKiosksList();
      return res.ok ? (res.kiosks as KioskListItem[]) : [];
    },
    12000
  );

  const kiosks = useMemo(() => data ?? [], [data]);
  return { kiosks, loading };
}
