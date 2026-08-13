// hooks/use-settings.ts — realtime subscription to event settings/config.
// Pocketbase SSE subscribe replaces the Firestore onSnapshot listener.

"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pb/client";
import { paths } from "@/lib/paths";
import type { EventSettings } from "@/lib/types";

const EMPTY: EventSettings = { name: "", place: "", deadline: "", timezone: "+05:30", multiGate: false, gateCategories: [] };

function mapRecord(d: Record<string, unknown>): EventSettings {
  return {
    name: (d.name as string) ?? "",
    place: (d.place as string) ?? "",
    deadline: (d.deadline as string) ?? "",
    timezone: (d.timezone as string) ?? "+05:30",
    multiGate: Boolean(d.multiGate),
    gateCategories: Array.isArray(d.gateCategories) ? (d.gateCategories as string[]) : [],
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<EventSettings>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // PB client auth: settings collection has list/view rules requiring auth.
    // We read with the cookie-bound client; for public settings reads use a
    // server action if needed. Here the admin/staff dashboard is authed.
    const client = pb();

    // 1. Initial fetch (settings is a single-record collection).
    client
      .collection(paths.settingsCollection)
      .getOne(paths.settingsId)
      .then((rec) => {
        if (!cancelled) {
          setSettings(mapRecord(rec as unknown as Record<string, unknown>));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    // 2. Realtime subscribe to changes on the settings record.
    let unsub: (() => void) | null = null;
    client
      .collection(paths.settingsCollection)
      .subscribe(paths.settingsId, (e) => {
        if (cancelled) return;
        if (e.record) {
          setSettings(mapRecord(e.record as unknown as Record<string, unknown>));
        }
      })
      .then((fn) => {
        unsub = fn;
      })
      .catch((err) => {
        console.error("[useSettings] subscribe error:", err);
      });

    return () => {
      cancelled = true;
      if (unsub) {
        try {
          client.collection(paths.settingsCollection).unsubscribe(paths.settingsId);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { settings, loading };
}
