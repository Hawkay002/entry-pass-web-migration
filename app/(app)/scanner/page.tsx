// app/(app)/scanner/page.tsx — QR scanner with camera + jsQR decoding.
// Uses the shared <QrScanner>. Validates via the validateTicket server action
// when online, and against a warm IndexedDB cache when offline, queuing scans
// for sync on reconnect.

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff, CloudUpload, AlertTriangle } from "lucide-react";
import { LockedTab } from "@/components/layout/locked-tab";
import { useLockedTabs } from "@/components/layout/locked-tabs-context";
import { QrScanner, type ScanOutcome } from "@/components/scanner/qr-scanner";
import { validateTicket, syncOfflineScans, getTicketsForOfflineCache } from "@/app/actions/tickets";
import { getScannerGate } from "@/app/actions/gates-scanner";
import { Bell } from "@/components/animate-ui/icons/bell";
import { BellOff } from "@/components/animate-ui/icons/bell-off";
import {
  cacheTickets,
  getCachedTickets,
  markCachedScanned,
  enqueueScan,
  getPendingCount,
  clearPendingScans,
  getPendingScans,
} from "@/lib/offline-db";

// Refresh the offline cache every 5 minutes instead of an always-on realtime
// listener. One snapshot covers ~5 min of scanning; a single ticket lookup at
// validation time catches anything newer. This cuts Firestore reads to a
// fraction of what a live onSnapshot would consume.
const CACHE_REFRESH_MS = 5 * 60 * 1000;

export default function ScannerPage() {
  const lockedTabs = useLockedTabs();
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [haptics, setHaptics] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("scannerHaptics");
    return stored === null ? true : stored === "true";
  });
  const [scannerGate, setScannerGate] = useState<{ id: string; name: string } | null>(null);
  const [multiGateOn, setMultiGateOn] = useState(false);

  // Resolve this scanner's gate on mount (from staff assignment + settings).
  useEffect(() => {
    getScannerGate()
      .then((g) => { setScannerGate(g.gate); setMultiGateOn(g.multiGate); })
      .catch(() => { setScannerGate(null); setMultiGateOn(false); });
  }, []);

  // Warm + periodically refresh the IndexedDB ticket cache. One-shot on mount
  // (so the cache is ready immediately), then every 5 minutes. Skipped while
  // offline — the cached snapshot is what we scan against in that case.
  const refreshCache = useCallback(async () => {
    const res = await getTicketsForOfflineCache();
    if (res.ok) await cacheTickets(res.tickets);
  }, []);

  useEffect(() => {
    refreshCache().catch(() => {});
    const interval = setInterval(() => {
      if (navigator.onLine) refreshCache().catch(() => {});
    }, CACHE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshCache]);

  // Drain the offline queue when connectivity returns.
  const drainQueue = useCallback(async () => {
    const queued = await getPendingScans();
    if (queued.length === 0) return;
    setSyncing(true);
    try {
      const res = await syncOfflineScans(queued.map((q) => q.id), scannerGate?.id ?? null);
      if (res.ok) {
        const granted = Object.values(res.results).filter((r) => r === "granted").length;
        const already = Object.values(res.results).filter((r) => r === "already").length;
        await clearPendingScans(queued.map((q) => q.id));
        setPending(0);
        if (granted > 0 || already > 0) {
          toast.success(`Synced ${granted + already} offline scan(s)`, {
            description:
              already > 0 ? `${already} were already scanned by staff.` : undefined,
          });
        }
      } else {
        toast.error("Sync failed", { description: res.error });
      }
    } catch (err) {
      toast.error("Sync failed", { description: (err as Error).message });
    }
    setSyncing(false);
  }, []);

  // Track connection state + drain the queue the moment we reconnect.
  // setState happens in event callbacks (allowed), not in the effect body.
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      drainQueue();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [drainQueue]);

  // Refresh the pending count on mount (async — no synchronous setState).
  useEffect(() => {
    getPendingCount()
      .then(setPending)
      .catch(() => {});
  }, []);

  // Validate a decoded QR — online via server action, offline via cache.
  const handleCode = useCallback(
    async (ticketId: string): Promise<ScanOutcome> => {
      if (online) {
        const res = await validateTicket(ticketId, scannerGate?.id ?? null);
        if (!res.ok) return { kind: "error", message: res.error };
        if (res.outcome === "granted")
          return { kind: "granted", name: res.ticket?.name ?? "", id: ticketId };
        if (res.outcome === "already")
          return {
            kind: "already",
            name: res.ticket?.name ?? "",
            id: ticketId,
            status: res.ticket?.status ?? "",
            scannedBy: res.ticket?.scannedBy,
            scannedAt: res.ticket?.scannedAt,
          };
        if (res.outcome === "wrong-gate")
          return {
            kind: "wrong-gate",
            name: res.ticket?.name ?? "",
            id: ticketId,
            expectedGate: res.ticket?.expectedGate ?? null,
          };
        return { kind: "invalid", id: ticketId };
      }

      // Offline: validate against the IndexedDB cache.
      const cached = await getCachedTickets();
      const t = cached.find((x) => x.id === ticketId);
      if (!t) {
        return {
          kind: "error",
          message: "Ticket not found in offline cache. Reconnect to verify.",
        };
      }
      // Multi-gate enforcement (offline): check the ticket's assigned gate.
      if (
        scannerGate?.id &&
        t.gate &&
        t.gate !== scannerGate.id
      ) {
        return {
          kind: "wrong-gate",
          name: t.name,
          id: ticketId,
          expectedGate: t.gate,
        };
      }
      if (t.status === "coming-soon" && !t.scanned) {
        await enqueueScan({ id: ticketId, name: t.name, timestamp: Date.now() });
        await markCachedScanned(ticketId);
        setPending((p) => p + 1);
        return { kind: "granted", name: t.name, id: ticketId };
      }
      return {
        kind: "already",
        name: t.name,
        id: ticketId,
        status: t.status,
      };
    },
    [online, scannerGate]
  );

  if (lockedTabs.includes("scanner")) {
    return <LockedTab tabName="Scanner" />;
  }

  return (
    <div className="glass-panel mx-auto max-w-lg p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Entry Validation</h2>
          {scannerGate && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-secondary/15 px-3 py-1 text-xs font-medium text-accent-secondary ring-1 ring-accent-secondary/30 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-secondary" />
              Gate {scannerGate.name}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            const next = !haptics;
            setHaptics(next);
            if (typeof window !== "undefined") {
              localStorage.setItem("scannerHaptics", String(next));
            }
          }}
          className="flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/5"
          title={haptics ? "Haptic feedback on — click to mute" : "Haptic feedback off — click to enable"}
          style={{ color: haptics ? "var(--color-accent-secondary)" : "rgb(255 255 255 / 0.5)" }}
        >
          {haptics ? (
            <Bell key="on" size={20} animate />
          ) : (
            <BellOff key="off" size={20} animate />
          )}
        </button>
      </div>

      <div className="text-center">
      {/* No gate assigned warning */}
      {multiGateOn && !scannerGate && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          No gate assigned — this scanner accepts ALL tickets. Contact an admin to assign a gate.
        </div>
      )}
      {/* Offline / sync status banner */}
      {!online && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <WifiOff className="h-4 w-4" />
          Offline mode — scans are saved locally and will sync automatically.
        </div>
      )}
      {online && pending > 0 && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <CloudUpload className={syncing ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
          {syncing
            ? `Syncing ${pending} scan(s)…`
            : `${pending} scan(s) pending sync`}
        </div>
      )}

      <QrScanner
        onCode={handleCode}
        haptics={haptics}
        showHapticsToggle={false}
      />
      </div>
    </div>
  );
}
