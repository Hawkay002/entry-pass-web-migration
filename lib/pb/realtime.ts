// lib/pb/realtime.ts — client-side realtime + polling helper.
//
// IMPORTANT ARCHITECTURE NOTE:
// Our auth token is httpOnly (browser JS can't read it), so the Pocketbase JS
// SDK's authStore is empty on the client. SSE `subscribe()` only delivers change
// events for collections the client can READ — auth-gated collections therefore
// get NO change events when unauthenticated (verified empirically).
//
// Strategy:
//   - Auth-gated data: poll via server actions on an interval (near-realtime,
//     ~2.5s). The actions use pbAdmin server-side, so rules don't block them.
//   - PUBLIC collections (kiosk_status): subscribe directly via SSE — instant.
//
// `usePolledData` handles the polling case (the common one). `subscribePublic`
// handles the public-SSE case (kiosk only).

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Poll a server action on an interval and keep its result in state.
 * Fires immediately on mount, then every `intervalMs`. Cleans up on unmount.
 *
 * @param fetcher async fn returning T (or null while loading)
 * @param intervalMs poll interval (default 2500ms)
 * @param enabled pass false to pause polling
 */
export function usePolledData<T>(
  fetcher: () => Promise<T>,
  intervalMs = 2500,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("[usePolledData] fetch error:", err);
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, enabled]);

  return { data, loading, refresh: () => fetcherRef.current().then(setData) };
}

// ---------------- Public SSE subscribe (kiosk_status only) ----------------

import { pb } from "@/lib/pb/client";

export type RealtimeEvent = "create" | "update" | "delete";

/**
 * Subscribe to changes on a PUBLIC-read collection via SSE.
 * Returns an unsubscribe function. Only works for collections with a public
 * list/view rule (e.g. kiosk_status). The callback receives the full record.
 */
export async function subscribePublicCollection(
  collection: string,
  recordId: string | "*",
  onChange: (event: RealtimeEvent, record: Record<string, unknown> | null) => void
): Promise<() => void> {
  const client = pb();
  await client.collection(collection).subscribe(recordId, (e) => {
    onChange((e.action as RealtimeEvent) ?? "update", (e.record as Record<string, unknown>) ?? null);
  });
  return () => {
    try {
      client.collection(collection).unsubscribe(recordId);
    } catch {
      /* ignore */
    }
  };
}
