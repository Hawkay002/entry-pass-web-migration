// hooks/use-gates.ts — realtime subscription to the gates collection.
// Mirrors the use-settings / use-roles pattern (onSnapshot listener).
// Returns gates sorted by `order`, and a map of { gateId → gate } for lookups.

"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/paths";
import type { Gate } from "@/lib/types";

export function useGatesMode() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, paths.gatesCollection),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Gate[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? d.id),
            category: (data.category as Gate["category"]) ?? "guest-entry",
            order: Number(data.order ?? 0),
            active: Boolean(data.active ?? true),
            createdAt: Number(data.createdAt ?? 0),
            ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
          };
        });
        setGates(list);
        setLoading(false);
      },
      (err) => {
        console.error("[useGates] listener error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Lookup map for resolving gate names from ids.
  const gateMap = useMemo(() => {
    const m = new Map<string, Gate>();
    for (const g of gates) m.set(g.id, g);
    return m;
  }, [gates]);

  return { gates, gateMap, loading };
}
