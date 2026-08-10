// components/scanner/qr-scanner.tsx — reusable camera QR scanner.
// Extracted from app/(app)/scanner/page.tsx so both the admin scanner and
// the public kiosk share the same decode loop, audio cues, and result UI.
// The parent provides the validation logic via onCode.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScanOutcome =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "granted"; name: string; id: string }
  | { kind: "already"; name: string; id: string; status: string; scannedBy?: string; scannedAt?: number | null }
  | { kind: "wrong-gate"; name: string; id: string; expectedGate?: string | null }
  | { kind: "invalid"; id: string }
  | { kind: "error"; message: string };

export interface QrScannerProps {
  /** Validate a decoded QR string. Return the outcome to display. */
  onCode: (data: string) => Promise<ScanOutcome>;
  /** Auto-activate the camera on mount (kiosk mode). Default false. */
  autoStart?: boolean;
  /** Show the Activate/Deactivate button. Default true. */
  showControls?: boolean;
  /** Show the internal haptics toggle (parent renders its own when false). Default true. */
  showHapticsToggle?: boolean;
  /** Haptic feedback on scan results. Default true. */
  haptics?: boolean;
  /** Preferred camera: "environment" (back, default) or "user" (front). */
  facingMode?: "environment" | "user";
  /** Extra class for the video preview container. */
  previewClassName?: string;
  /** Called after each scan resolves (kiosk uses it to reset). */
  onScanResolved?: () => void;
}

interface ScanCtx {
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  rafId: number | null;
  cooldown: boolean;
  onCode: (data: string) => void;
}

// Module-scope frame loop. Takes explicit deps via ctx so there are no
// closures over component state and no ref writes during render.
const scanCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
const scanCtx2d = scanCanvas?.getContext("2d", { willReadFrequently: true }) ?? null;
const MAX_SCAN_DIM = 480;

function frameLoop(ctx: ScanCtx) {
  const video = ctx.video;
  if (!video || !ctx.stream) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA && scanCtx2d) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw > 0 && vh > 0) {
      const scale = Math.min(1, MAX_SCAN_DIM / Math.max(vw, vh));
      const sw = Math.round(vw * scale);
      const sh = Math.round(vh * scale);
      scanCanvas!.width = sw;
      scanCanvas!.height = sh;
      scanCtx2d.drawImage(video, 0, 0, sw, sh);
      const imageData = scanCtx2d.getImageData(0, 0, sw, sh);
      const code = jsQR(imageData.data, sw, sh, { inversionAttempts: "dontInvert" });
      if (code && !ctx.cooldown) {
        ctx.cooldown = true;
        ctx.onCode(code.data);
        setTimeout(() => {
          ctx.cooldown = false;
        }, 3000);
      }
    }
  }
  if (ctx.stream) {
    ctx.rafId = requestAnimationFrame(() => frameLoop(ctx));
  }
}

export function QrScanner({
  onCode,
  autoStart = false,
  showControls = true,
  showHapticsToggle = true,
  haptics: hapticsProp = true,
  facingMode: facingModeProp = "environment",
  previewClassName,
  onScanResolved,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctxRef = useRef<ScanCtx>({
    video: null,
    stream: null,
    rafId: null,
    cooldown: false,
    onCode: () => {},
  });
  const [active, setActive] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome>({ kind: "idle" });
  const [haptics, setHaptics] = useState(hapticsProp);
  // Sync from the parent prop when controlled externally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHaptics(hapticsProp);
  }, [hapticsProp]);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(facingModeProp);
  const [canFlip, setCanFlip] = useState(false);
  // Keep latest callbacks in refs so the frame loop never goes stale.
  const onCodeRef = useRef(onCode);
  const onScanResolvedRef = useRef(onScanResolved);
  useEffect(() => {
    onCodeRef.current = onCode;
    onScanResolvedRef.current = onScanResolved;
  });

  // Vibrate only when enabled. Depends on `haptics` directly (not a ref) so
  // the closure always has the current value — an uncheck takes effect on
  // the very next scan, with no ref-sync timing gap.
  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (haptics) navigator.vibrate?.(pattern);
    },
    [haptics]
  );

  useEffect(() => {
    ctxRef.current.onCode = async (ticketId: string) => {
      setOutcome({ kind: "searching" });
      const result = await onCodeRef.current(ticketId);
      setOutcome(result);
      if (result.kind === "granted") {
        playSuccess();
        vibrate(100);
      } else if (result.kind !== "idle" && result.kind !== "searching") {
        playError();
        if (result.kind === "invalid") vibrate([100, 50, 100, 50, 100]);
        else vibrate([100, 50, 100]);
      }
      onScanResolvedRef.current?.();
    };
  }, [vibrate]);

  const startScan = useCallback(async () => {
    // Try the preferred facing mode; if it's unavailable, fall back to any
    // camera so the scanner still works on single-camera devices.
    const tryGet = async (mode: "environment" | "user") =>
      navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });

    let stream: MediaStream;
    try {
      stream = await tryGet(facingMode);
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        setOutcome({ kind: "error", message: "Camera error: " + (err as Error).message });
        return;
      }
    }
    const ctx = ctxRef.current;
    ctx.stream = stream;
    ctx.video = videoRef.current;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();
    }
    setActive(true);
    setOutcome({ kind: "searching" });
    ctx.rafId = requestAnimationFrame(() => frameLoop(ctx));
  }, [facingMode]);

  const stopScan = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx.rafId) cancelAnimationFrame(ctx.rafId);
    ctx.rafId = null;
    ctx.stream?.getTracks().forEach((t) => t.stop());
    ctx.stream = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setOutcome({ kind: "idle" });
  }, []);

  // Flip between front/back camera. Only shown when the device actually has
  // more than one video input (checked once on mount).
  const switchCamera = useCallback(async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    stopScan();
    setFacingMode(next);
  }, [facingMode, stopScan]);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => {
        const cams = devices.filter((d) => d.kind === "videoinput").length;
        if (active) setCanFlip(cams > 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    const ctx = ctxRef.current;
    return () => {
      if (ctx.rafId) cancelAnimationFrame(ctx.rafId);
      ctx.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-start the camera on mount (kiosk mode). setState here reflects the
  // external camera state — a legitimate effect-driven side effect.
  useEffect(() => {
    if (!autoStart) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startScan();
    return () => stopScan();
  }, [autoStart, startScan, stopScan]);

  return (
    <div className="text-center">
      <div
        className={cn(
          "relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-black",
          previewClassName
        )}
      >
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover", facingMode === "user" && "scale-x-[-1]")}
          muted
        />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <CameraOff className="h-10 w-10" />
          </div>
        )}
        {canFlip && active && (
          <button
            type="button"
            onClick={switchCamera}
            title="Switch camera"
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        )}
      </div>

      {showControls && (
        <>
          <Button
            onClick={active ? stopScan : startScan}
            className="mx-auto mt-4"
            variant={active ? "destructive" : "default"}
          >
            {active ? (
              <>
                <CameraOff className="mr-2 h-4 w-4" /> Deactivate Camera
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" /> Activate Camera
              </>
            )}
          </Button>

          {showHapticsToggle && (
            <label className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={haptics}
                onChange={(e) => setHaptics(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent-secondary"
              />
              Haptic Feedback
            </label>
          )}
        </>
      )}

      <ScanResult outcome={outcome} />
    </div>
  );
}

function ScanResult({ outcome }: { outcome: ScanOutcome }) {
  if (outcome.kind === "idle") return null;

  const styleMap: Record<string, string> = {
    searching: "bg-white/10 text-white border-white/20",
    granted: "bg-success-green/20 text-success-green border-success-green/40",
    already: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    "wrong-gate": "bg-amber-500/20 text-amber-300 border-amber-400/50",
    invalid: "bg-destructive/20 text-destructive border-destructive/40",
    error: "bg-destructive/20 text-destructive border-destructive/40",
  };
  const key = outcome.kind === "searching" ? "searching" : outcome.kind;

  return (
    <div className={cn("mt-5 rounded-xl border p-4 text-left", styleMap[key])}>
      {outcome.kind === "searching" && <p>Searching for QR Code...</p>}
      {outcome.kind === "granted" && (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">ACCESS GRANTED</p>
            <p>{outcome.name}</p>
            <p className="font-mono text-xs opacity-70">ID: {outcome.id}</p>
          </div>
        </div>
      )}
      {outcome.kind === "already" && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">ALREADY SCANNED</p>
            <p>{outcome.name}</p>
            <p className="font-mono text-xs opacity-70">ID: {outcome.id}</p>
            <p className="text-xs opacity-70">Current status: {outcome.status}</p>
            {outcome.scannedBy && (
              <p className="text-xs opacity-70">
                Scanned by: <span className="font-medium">{outcome.scannedBy}</span>
                {outcome.scannedAt
                  ? ` · ${new Date(outcome.scannedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      )}
      {outcome.kind === "invalid" && (
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">INVALID TICKET</p>
            <p className="font-mono text-xs opacity-70">{outcome.id}</p>
            <p className="text-xs opacity-70">Not found in database</p>
          </div>
        </div>
      )}
      {outcome.kind === "wrong-gate" && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">WRONG GATE</p>
            <p className="text-sm">{outcome.name}</p>
            <p className="text-xs opacity-80">
              This guest should enter at{" "}
              <span className="font-semibold">
                {outcome.expectedGate ? `Gate ${outcome.expectedGate}` : "another gate"}
              </span>
              . Entry blocked here.
            </p>
          </div>
        </div>
      )}
      {outcome.kind === "error" && <p>{outcome.message}</p>}
    </div>
  );
}

function playSuccess() {
  const audio = new Audio("/success.mp3");
  audio.play().catch(() => {});
}
function playError() {
  const audio = new Audio("/error.mp3");
  audio.play().catch(() => {});
}
