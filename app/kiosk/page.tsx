// app/kiosk/page.tsx — public self check-in kiosk for a mounted tablet.
// PIN-gated (admin sets the PIN). After unlock, the guest scans their own QR;
// the check-in is validated via /api/kiosk-checkin (no staff login required).
// Top-level route — intentionally NOT under (app) so it dodges forced auth,
// the app shell, tab locks, and the per-request auto-absent DB write.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrScanner, type ScanOutcome } from "@/components/scanner/qr-scanner";
import { cn } from "@/lib/utils";
import { WifiOff, CloudUpload, Delete, ArrowUpRight, LoaderCircle, Eye, EyeOff, TicketX, MessageCircle } from "lucide-react";
import { clientEnv } from "@/lib/pb/client";
import { paths } from "@/lib/paths";
import {
  cacheKioskTickets,
  getCachedKioskTickets,
  markKioskCachedScanned,
  enqueueKioskScan,
  clearKioskPendingScans,
  clearKioskCache,
  getKioskPendingScans,
  getKioskPendingCount,
} from "@/lib/kiosk-db";
import { playSfx, startProcessingSfx, stopProcessingSfx } from "@/lib/sfx";

const SESSION_KEY = "kiosk_pin";
const SESSION_KIOSK_KEY = "kiosk_id";
const CACHE_REFRESH_MS = 15 * 60 * 1000;

export default function KioskPage() {
  // Defer all browser-only reads (URL params, sessionStorage) until after
  // hydration to avoid server/client render mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Resolve kioskId from URL (?id=xxx) or sessionStorage.
  const [kioskId, setKioskId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("id");
    if (fromUrl) {
      sessionStorage.setItem(SESSION_KIOSK_KEY, fromUrl);
      setKioskId(fromUrl);
      return;
    }
    setKioskId(sessionStorage.getItem(SESSION_KIOSK_KEY) ?? null);
  }, []);

  // Lazy init from sessionStorage so a refresh keeps the kiosk unlocked.
  const [storedPin, setStoredPin] = useState<string | null>(null);
  useEffect(() => {
    setStoredPin(sessionStorage.getItem(SESSION_KEY));
  }, []);

  const handleUnlock = useCallback((validPin: string) => {
    sessionStorage.setItem(SESSION_KEY, validPin);
    setStoredPin(validPin);
  }, []);

  // If the kiosk is deleted while active, show 404.
  const [kioskDeleted, setKioskDeleted] = useState(false);

  // Poll the public kiosk_status record every 2s. Detects deletion instantly
  // (record gone → 404) and config edits (updatedAt changes → re-authenticate).
  // NOTE: we tried SSE subscribe first, but PB does NOT deliver delete/update
  // events for public collections to unauthenticated clients (verified — only
  // PB_CONNECT arrives, no data events). Polling is the reliable approach.
  const lastUpdatedAtRef = useRef<number>(0);
  useEffect(() => {
    if (!kioskId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `${clientEnv.pbUrl}/api/collections/${paths.kioskStatusCollection}/records/${kioskId}`
        );
        if (cancelled) return;
        if (!res.ok) {
          // Record gone — kiosk was deleted (or factory reset).
          clearKioskCache();
          sessionStorage.removeItem(SESSION_KEY);
          setStoredPin(null);
          setKioskDeleted(true);
          return; // stop polling once deleted
        }
        const data = await res.json();
        if (cancelled) return;
        const newUpdatedAt = Number(data.updatedAt ?? 0);
        if (lastUpdatedAtRef.current > 0 && newUpdatedAt !== lastUpdatedAtRef.current) {
          // Config changed (name/PIN/gate edit) — force re-authentication.
          sessionStorage.removeItem(SESSION_KEY);
          setStoredPin(null);
        }
        lastUpdatedAtRef.current = newUpdatedAt;
      } catch {
        // Network failure — keep retrying.
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [kioskId]);

  // Avoid hydration mismatch — render nothing until client mounts.
  if (!mounted) return null;

  // No kioskId — show picker.
  if (!kioskId) {
    return <KioskPicker onSelect={(id) => { setKioskId(id); sessionStorage.setItem(SESSION_KIOSK_KEY, id); }} />;
  }

  if (kioskDeleted) return <KioskNotFound />;

  if (!storedPin) {
    return <PinGate onUnlock={handleUnlock} kioskId={kioskId} />;
  }

  return <KioskScanner pin={storedPin} kioskId={kioskId}
    onLock={() => { sessionStorage.removeItem(SESSION_KEY); setStoredPin(null); }}
    onKioskDeleted={() => { setKioskDeleted(true); }}
  />;
}

/** Kiosk 404 — shown when ?id= doesn't match any kiosk. */
function KioskNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <TicketX className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: '"The Seasons", serif' }}>
        Kiosk not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This kiosk link is invalid or the kiosk has been removed.
        Please contact the event organizer.
      </p>
      <a
        href="https://wa.me/918777845713"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        <MessageCircle className="h-4 w-4" />
        Contact Organizer
      </a>
    </div>
  );
}

/** Kiosk picker — shown when no ?id= param and nothing in sessionStorage. */
function KioskPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [kiosks, setKiosks] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available kiosks via a lightweight public endpoint.
    fetch("/api/kiosk-list")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setKiosks(data.kiosks); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-4 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-white">Select Kiosk</h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose which gate this tablet is at.</p>
      {loading ? (
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : kiosks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No kiosks configured. Ask an admin to create one.</p>
      ) : (
        <div className="grid w-full max-w-sm gap-2">
          {kiosks.map((k) => (
            <button
              key={k.id}
              onClick={() => onSelect(k.id)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              {k.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- PIN Gate ----------------

function PinGate({ onUnlock, kioskId }: { onUnlock: (pin: string) => void; kioskId: string }) {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Refs so the keydown handler always sees the latest values without
  // re-registering on every keystroke.
  const entryRef = useRef(entry);
  const checkingRef = useRef(checking);
  useEffect(() => {
    entryRef.current = entry;
    checkingRef.current = checking;
  });

  function press(d: string) {
    setError("");
    if (d === "del") {
      playSfx("delete", 2); // extra-hot: kiosk hall is loud
      setEntry((e) => e.slice(0, -1));
      return;
    }
    playSfx("typing", 2); // extra-hot
    setEntry((e) => (e.length >= 6 ? e : e + d));
  }

  async function submit() {
    if (entry.length < 4) return;
    setChecking(true);
    setError("");
    startProcessingSfx();
    try {
      // Verify the PIN against the server before unlocking.
      const res = await fetch("/api/kiosk-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: entry, ticketId: "kiosk-pin-check", kioskId }),
      });
      if (res.status === 403) {
        // Check if kiosk doesn't exist vs wrong PIN.
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("not found")) {
          stopProcessingSfx();
          setNotFound(true);
        } else {
          stopProcessingSfx();
          playSfx("error");
          setError("Incorrect PIN or kiosk not enabled.");
        }
      } else if (res.ok) {
        stopProcessingSfx();
        playSfx("success");
        onUnlock(entry);
      } else {
        stopProcessingSfx();
        playSfx("error");
        setError("Unable to reach the server. Check your connection.");
      }
    } catch {
      stopProcessingSfx();
      playSfx("error");
      setError("Network error. Check your connection.");
    }
    setChecking(false);
  }

  // Physical keyboard support: numpad + number row + Backspace + Enter.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (checkingRef.current) return;
      // Digits (numpad when NumLock on, or number row). Shift+digit (e.g. "!") ignored.
      if (/^[0-9]$/.test(e.key) && !e.shiftKey) {
        press(e.key);
        return;
      }
      if (e.key === "Backspace") {
        press("del");
        return;
      }
      if (e.key === "Enter" && entryRef.current.length >= 4) {
        submitRef.current();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (notFound) return <KioskNotFound />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-4">
      <div className="glass-panel flex w-full max-w-md flex-col items-center px-6 py-8 text-white md:py-6">
        <div className="mb-2 flex items-center gap-2 text-emerald-400">
          <ScanLineIcon className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">Self Check-in</h1>
        </div>
        <p className="mb-6 text-sm text-white/60">Enter the event PIN to begin</p>

        {/* PIN display — centered alone so it aligns with the numpad grid */}
        <div className="mb-4 flex items-center justify-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "flex h-10 w-8 items-center justify-center rounded-lg border text-lg transition-colors",
                i < entry.length ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400" : "border-white/15 bg-white/5"
              )}
            >
              {i < entry.length ? (showPin ? entry[i] : "●") : ""}
            </span>
          ))}
        </div>
        {/* Show/hide toggle — separate row so the boxes stay centered */}
        <div className="mb-6 flex w-full justify-end">
          <button
            onClick={() => { playSfx("select"); setShowPin((s) => !s); }}
            data-sfx-own=""
            onMouseEnter={() => playSfx("hover")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title={showPin ? "Hide PIN" : "Show PIN"}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeypadButton key={d} onClick={() => press(d)}>{d}</KeypadButton>
          ))}
          <KeypadButton onClick={() => press("del")} variant="ghost">
            <Delete className="h-7 w-7" />
          </KeypadButton>
          <KeypadButton onClick={() => press("0")}>0</KeypadButton>
          <KeypadButton
            onClick={submit}
            disabled={entry.length < 4 || checking}
            variant="primary"
          >
            {checking ? (
              <LoaderCircle className="h-7 w-7 !animate-spin" />
            ) : (
              <ArrowUpRight className="h-7 w-7" />
            )}
          </KeypadButton>
        </div>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-medium transition-all active:scale-95 disabled:opacity-40 md:h-[4.5rem] md:w-[4.5rem]",
        variant === "default" && "bg-white/10 hover:bg-white/20",
        variant === "primary" && "bg-emerald-500 text-black hover:bg-emerald-400",
        variant === "ghost" && "bg-transparent text-white/70 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

// ---------------- Kiosk Scanner ----------------

function KioskScanner({ pin, kioskId, onLock, onKioskDeleted }: { pin: string; kioskId: string; onLock: () => void; onKioskDeleted: () => void }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Warm + periodically refresh the PII-free ticket cache. The kiosk is public,
  // so this fetch carries only { id, status, scanned } — no names or phones.
  const refreshCache = useCallback(async () => {
    try {
      const res = await fetch("/api/kiosk-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, kioskId }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("not available") || data.error?.includes("not found")) {
          onKioskDeleted();
          return;
        }
        onLock();
        return;
      }
      const data = await res.json();
      if (res.ok && data.ok) {
        await cacheKioskTickets(data.tickets);
      }
    } catch {
      // Network down — keep using whatever's cached.
    }
  }, [pin, onLock, onKioskDeleted]);

  useEffect(() => {
    refreshCache();
    const interval = setInterval(() => {
      if (navigator.onLine) refreshCache();
    }, CACHE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshCache]);

  // Track connectivity. On reconnect: refresh cache + drain queue.
  useEffect(() => {
    const on = () => {
      setOnline(true);
      refreshCache();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refreshCache]);

  // Pending count on mount.
  useEffect(() => {
    getKioskPendingCount().then(setPending).catch(() => {});
  }, []);

  // Drain the offline queue when connectivity returns.
  const drainQueue = useCallback(async () => {
    const queued = await getKioskPendingScans();
    if (queued.length === 0) return;
    setSyncing(true);
    try {
      // Fire each pending check-in sequentially against the live endpoint.
      const ok: string[] = [];
      for (const q of queued) {
        try {
          const res = await fetch("/api/kiosk-checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin, ticketId: q.id, kioskId }),
          });
          if (res.ok) ok.push(q.id);
          if (res.status === 403) {
            // PIN changed/disabled — the kiosk session is over.
            onLock();
            return;
          }
        } catch {
          break; // network dropped again mid-sync
        }
      }
      if (ok.length > 0) {
        await clearKioskPendingScans(ok);
        setPending((p) => Math.max(0, p - ok.length));
      }
    } finally {
      setSyncing(false);
    }
  }, [pin, onLock]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      drainQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [drainQueue]);

  // Validate a decoded QR — online via the check-in endpoint, offline via cache.
  async function handleCode(ticketId: string): Promise<ScanOutcome> {
    // Online path.
    try {
      const res = await fetch("/api/kiosk-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, ticketId, kioskId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 403) {
          onLock();
          return { kind: "error", message: "Kiosk session ended. Contact staff." };
        }
        if (res.status === 429) {
          return { kind: "error", message: data.error ?? "Too many attempts." };
        }
        return { kind: "error", message: data.error ?? "Check-in failed." };
      }
      if (data.outcome === "granted") {
        return { kind: "granted", name: data.ticket?.name ?? "", id: ticketId };
      }
      if (data.outcome === "already") {
        return {
          kind: "already",
          name: data.ticket?.name ?? "",
          id: ticketId,
          status: data.ticket?.status ?? "",
        };
      }
      if (data.outcome === "wrong-gate") {
        return {
          kind: "wrong-gate",
          name: data.ticket?.name ?? "",
          id: ticketId,
          expectedGate: data.ticket?.expectedGate ?? null,
        };
      }
      return { kind: "invalid", id: ticketId };
    } catch {
      // Network failed — fall through to offline validation below.
    }

    // Offline path: validate against the PII-free cache.
    const cached = await getCachedKioskTickets();
    const t = cached.find((x) => x.id === ticketId);
    if (!t) {
      return {
        kind: "error",
        message: "Cannot verify while offline. Find staff for assistance.",
      };
    }
    if (t.status === "coming-soon" && !t.scanned) {
      await enqueueKioskScan({ id: ticketId, timestamp: Date.now() });
      await markKioskCachedScanned(ticketId);
      setPending((p) => p + 1);
      // No name locally (PII-free cache) — show a generic success.
      return { kind: "granted", name: "", id: ticketId };
    }
    return {
      kind: "already",
      name: "",
      id: ticketId,
      status: t.status,
    };
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-4">
      <div className="glass-panel flex w-full max-w-md flex-col items-center px-6 py-8 text-white">
      <div className="mb-6 flex items-center gap-2 text-emerald-400">
        <ScanLineIcon className="h-6 w-6" />
        <h1 className="text-xl font-semibold">Self Check-in</h1>
      </div>

      {!online && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <WifiOff className="h-4 w-4" />
          Offline — check-ins are saved and will sync automatically.
        </div>
      )}
      {online && pending > 0 && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <CloudUpload className={syncing ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
          {syncing ? `Syncing ${pending}…` : `${pending} pending sync`}
        </div>
      )}

      <div className="w-full max-w-md">
        <QrScanner
          onCode={handleCode}
          autoStart
          showControls={false}
          facingMode="user"
          previewClassName="!max-w-[260px]"
        />
        <p className="mt-6 text-center text-sm text-white/50">
          Point your camera at the QR code on your pass
        </p>
      </div>
      </div>
    </div>
  );
}

// Inline scan-line icon (avoids an extra import for the kiosk bundle).
function ScanLineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}
