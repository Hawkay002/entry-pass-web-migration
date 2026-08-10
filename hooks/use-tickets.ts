// hooks/use-tickets.ts — realtime subscription to the tickets collection.
// Mirrors the original app's ticketsUnsubscribe onSnapshot (script.js:1478).
// Pulls the whole subcollection unordered (same as original), then the
// Guest List component applies client-side filter/sort.

"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/paths";
import type { Ticket } from "@/lib/types";

function coerce(raw: Record<string, unknown> | undefined, id: string): Ticket {
  return {
    id,
    name: String(raw?.name ?? ""),
    gender: (raw?.gender as Ticket["gender"]) ?? "Other",
    age: Number(raw?.age ?? 0),
    phone: String(raw?.phone ?? ""),
    ticketType: (raw?.ticketType as Ticket["ticketType"]) ?? "Classic",
    status: (raw?.status as Ticket["status"]) ?? "coming-soon",
    scanned: Boolean(raw?.scanned),
    scannedAt:
      raw?.scannedAt == null ? null : Number(raw.scannedAt),
    scannedBy:
      raw?.scannedBy == null ? null : String(raw.scannedBy),
    createdBy: String(raw?.createdBy ?? ""),
    createdAt: Number(raw?.createdAt ?? 0),
    gate: raw?.gate != null ? String(raw.gate) : null,
    scannedAtGate: raw?.scannedAtGate != null ? String(raw.scannedAtGate) : null,
  };
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, paths.ticketsCollection));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Ticket[] = [];
        snap.forEach((docSnap) =>
          next.push(coerce(docSnap.data(), docSnap.id))
        );
        setTickets(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useTickets] listener error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { tickets, loading };
}
