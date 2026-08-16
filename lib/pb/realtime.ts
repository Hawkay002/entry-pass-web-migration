// lib/pb/realtime.ts — client-side polling helper.
//
// ARCHITECTURE NOTE: our auth token is httpOnly (browser JS can't read it),
// so the Pocketbase SDK's authStore is empty on the client and SSE subscribe
// delivers no change events for auth-gated collections (verified empirically
// — only PB_CONNECT arrives). All realtime needs are therefore met by polling
// server actions (pbAdmin server-side, rules don't block them).
//
// Intervals are tiered by how fast data changes at an event:
//   tickets/remote-locks ~2.5s (scan-sensitive),
//   contacts 5s, staff-check 5s,
//   settings/gates/kiosks/roles 12s (rarely change mid-event).

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
