// hooks/use-kiosks.ts — realtime subscription to the kiosks list.
// Admin-only: reads admin_settings/security via the client SDK.
// Returns the kiosk list WITHOUT PINs (for display only).

"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/paths";

export interface KioskListItem {
  id: string;
  name: string;
  gateId: string | null;
  createdAt: number;
}

export function useKiosks() {
  const [kiosks, setKiosks] = useState<KioskListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, paths.adminSecurityDoc),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data()?.kiosks;
          if (Array.isArray(raw)) {
            setKiosks(
              raw.map((k: Record<string, unknown>) => ({
                id: String(k.id ?? ""),
                name: String(k.name ?? ""),
                gateId: k.gateId != null ? String(k.gateId) : null,
                createdAt: Number(k.createdAt ?? 0),
              }))
            );
          } else {
            setKiosks([]);
          }
        } else {
          setKiosks([]);
        }
        setLoading(false);
      },
      (err) => {
        // Admin-only doc — staff will get permission denied, that's fine.
        setKiosks([]);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { kiosks, loading };
}
