// hooks/use-tickets.ts — polled subscription to the tickets collection.
// Replaces the Firestore onSnapshot listener. Auth-gated data is fetched via
// a server action (pbAdmin) on an interval; the Guest List filters/sorts
// client-side, same as before.

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchTickets } from "@/app/actions/tickets";
import type { Ticket } from "@/lib/types";

export function useTickets() {
  const { data, loading, refresh } = usePolledData(
    async () => {
      const res = await fetchTickets();
      return res.ok ? res.tickets : [];
    },
    2500
  );

  const tickets = useMemo(() => data ?? [], [data]);
  return { tickets, loading, refresh };
}
