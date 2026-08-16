// hooks/use-gates.ts — polled subscription to the gates collection.
// Replaces the Firestore onSnapshot listener. Returns gates sorted by `order`,
// and a map of { gateId → gate } for lookups.

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchGates } from "@/app/actions/gates";
import type { Gate } from "@/lib/types";

export function useGatesMode() {
  const { data, loading } = usePolledData(
    async () => {
      const res = await fetchGates();
      return res.ok ? res.gates : [];
    },
    12000
  );

  const gates = useMemo(() => data ?? [], [data]);

  // Lookup map for resolving gate names from ids.
  const gateMap = useMemo(() => {
    const m = new Map<string, Gate>();
    for (const g of gates) m.set(g.id, g);
    return m;
  }, [gates]);

  return { gates, gateMap, loading };
}
