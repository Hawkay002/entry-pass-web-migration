// hooks/use-settings.ts — polled subscription to event settings/config.
// Replaces the Firestore onSnapshot listener. Auth-gated data is fetched via
// a server action (pbAdmin) on an interval.

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchSettings } from "@/app/actions/admin";
import type { EventSettings } from "@/lib/types";

const EMPTY: EventSettings = { name: "", place: "", deadline: "", timezone: "+05:30", multiGate: false, gateCategories: [] };

export function useSettings() {
  const { data, loading } = usePolledData(
    async () => {
      const res = await fetchSettings();
      return res.ok ? res.settings : EMPTY;
    },
    3000
  );

  const settings = useMemo(() => data ?? EMPTY, [data]);
  return { settings, loading };
}
