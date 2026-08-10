// components/tickets/interactive-ticket.tsx — guest-facing interactive ticket.
// Wraps AdmitOneTicket (tilt disabled) in a custom tilt container so QR +
// ticket ID overlays move together with the ticket.

"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/paths";
import { TICKET_TYPE_LABELS } from "@/lib/types";
import { Download, Loader2, Flag, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import AdmitOneTicket, { TICKET_TEXTURE, TICKET_GRADIENT, TICKET_LAYOUT, TICKET_GEOMETRY, ticketClipPath } from "@/components/ui/admit-one-ticket";
import { HoloOverlay } from "@/components/tickets/holo-overlay";
import { RadiantOverlay } from "@/components/tickets/radiant-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check";
import { sortedCountryCodes, DEFAULT_DIAL_CODE } from "@/lib/country-codes";
import QRCode from "qrcode";

interface TicketData {
  id: string;
  name: string;
  gender: string;
  age: number;
  ticketType: string;
  status: string;
  gate?: string;
}

interface SettingsData {
  name: string;
  place: string;
}

const TYPE_STYLES: Record<string, { texture: typeof TICKET_TEXTURE; gradient: typeof TICKET_GRADIENT }> = {
  Classic: {
    texture: { ...TICKET_TEXTURE, colorBack: "#1a1a2e", colorFront: "#16213e", colorHighlight: "#0f3460", shape: "simplex", type: "4x4", speed: 0.3 },
    gradient: { ...TICKET_GRADIENT, colorLight: "#1a1a2e", colorMid: "#16213e", colorDark: "#0f0f1a" },
  },
  Diamond: {
    texture: { ...TICKET_TEXTURE, colorBack: "#475569", colorFront: "#e2e8f0", colorHighlight: "#cbd5e1", shape: "ripple", type: "8x8", speed: 0.35 },
    gradient: { ...TICKET_GRADIENT, colorLight: "#e2e8f0", colorMid: "#94a3b8", colorDark: "#475569" },
  },
  SVIP: {
    // VIP base (ripple shader) but golden colors
    texture: { ...TICKET_TEXTURE, colorBack: "#bf953f", colorFront: "#fcf6ba", colorHighlight: "#b38728", shape: "ripple", type: "8x8", speed: 0.35 },
    gradient: { ...TICKET_GRADIENT, colorLight: "#fcf6ba", colorMid: "#bf953f", colorDark: "#aa771c" },
  },
  Gold: { texture: TICKET_TEXTURE, gradient: TICKET_GRADIENT },
};

export function InteractiveTicket({ ticket, settings }: { ticket: TicketData; settings: SettingsData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const [showTip, setShowTip] = useState(true);

  // Auto-dismiss the tip overlay after 5 seconds.
  useEffect(() => {
    const t = setTimeout(() => setShowTip(false), 5000);
    return () => clearTimeout(t);
  }, []);
  const [hovering, setHovering] = useState(false);
  const [ticketWidth, setTicketWidth] = useState(741);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [holoVars, setHoloVars] = useState({
    px: 50, py: 50, bx: 50, by: 50, fromCenter: 0, opacity: 0,
  });

  useEffect(() => {
    const update = () => setTicketWidth(Math.min(741, window.innerWidth - 32));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Gyroscope support — tilt based on device orientation (iOS/Android).
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      const el = tiltRef.current;
      if (!el) return;
      // gamma = left/right tilt (-90 to 90), beta = front/back tilt (-180 to 180).
      const gamma = e.gamma ?? 0; // left/right
      const beta = e.beta ?? 0;   // front/back

      // Limit tilt range — amplified for stronger effect.
      const maxTilt = 20;
      const rotX = Math.max(-maxTilt, Math.min(maxTilt, -(beta - 45) / 2));
      const rotY = Math.max(-maxTilt, Math.min(maxTilt, gamma / 2));

      el.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;

      // Normalize to 0-100 for holo vars.
      const px = ((gamma / 45) + 1) * 50;
      const py = ((beta - 45) / 45 + 1) * 50;
      const dx = (px - 50) / 50;
      const dy = (py - 50) / 50;
      const fromCenter = Math.min(1, Math.sqrt(dx * dx + dy * dy));

      setHoloVars({
        px: Math.max(0, Math.min(100, Math.round(px))),
        py: Math.max(0, Math.min(100, Math.round(py))),
        bx: Math.round(37 + (px / 100) * 26),
        by: Math.round(33 + (py / 100) * 34),
        fromCenter,
        opacity: 1,
      });

      if (glareRef.current) {
        glareRef.current.style.background = `radial-gradient(38% 55% at ${px}% ${py}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)`;
      }
    }

    // iOS 13+ requires permission request.
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (D.requestPermission) {
      // Permission must be requested from a user gesture — we'll listen for first touch.
      const requestOnTouch = async () => {
        try {
          const state = await D.requestPermission!();
          if (state === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        } catch {}
        document.removeEventListener("touchstart", requestOnTouch);
      };
      document.addEventListener("touchstart", requestOnTouch, { once: true });
      return () => {
        document.removeEventListener("touchstart", requestOnTouch);
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }

    // Android/other — no permission needed.
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  useEffect(() => {
    QRCode.toDataURL(ticket.id, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "H" }).then(setQrDataUrl).catch(() => {});
  }, [ticket.id]);

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, ticket.id, { width: 100, errorCorrectionLevel: "H" }).catch(() => {});
  }, [ticket.id]);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Handle both pointer and touch events.
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const dx = px - 0.5;
    const dy = py - 0.5;
    const fromCenter = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.5);

    el.style.transform = `perspective(1200px) rotateX(${-(dy * 2) * 20}deg) rotateY(${dx * 2 * 20}deg) scale(1.02)`;
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(38% 55% at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)`;
    }

    // Update holo vars for the overlay.
    setHoloVars({
      px: Math.round(px * 100),
      py: Math.round(py * 100),
      bx: Math.round(37 + px * 26),
      by: Math.round(33 + py * 34),
      fromCenter,
      opacity: 1,
    });
  }, []);

  const onLeave = useCallback(() => {
    setHovering(false);
    if (tiltRef.current) tiltRef.current.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
    if (glareRef.current) glareRef.current.style.background = "transparent";
    setHoloVars((v) => ({ ...v, opacity: 0, bx: 50, by: 50 }));
  }, []);

  const typeLabel = TICKET_TYPE_LABELS[ticket.ticketType as keyof typeof TICKET_TYPE_LABELS] ?? ticket.ticketType;
  const ticketStyle = TYPE_STYLES[ticket.ticketType] ?? TYPE_STYLES.Gold;
  const hasSettings = !!(settings.name || settings.place);
  const isClassic = ticket.ticketType === "Classic";
  const inkColor = isClassic ? "#ffffff" : "#5a3520";

  // Custom layout: move content up, bigger footer text.
  const customLayout = {
    ...TICKET_LAYOUT,
    nameTop: 130 / 741,      // moved up
    footerTop: 320 / 741,    // moved up
    footerSize: 26 / 741,    // bigger footer text
    inkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.inkColor,
    watermarkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.watermarkColor,
    // Smaller watermark for Classic tickets
    ...(isClassic ? { watermarkSize: 110 / 741, watermarkOpacity: 0.15 } : {}),
    // Engraved text effect for VVIP tickets
    ...(ticket.ticketType === "Gold" ? { engraved: true } : {}),
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 py-8">
      {/* Tilt container — transparent bg so notch cutouts don't show white */}
      <div
        ref={tiltRef}
        onPointerEnter={() => setHovering(true)}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onTouchMove={onMove}
        onTouchEnd={onLeave}
        className="relative w-fit will-change-transform"
        style={{
          transition: hovering ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)",
          transformStyle: "preserve-3d",
          background: "transparent",
          backfaceVisibility: "hidden",
          touchAction: "none",
        }}
      >
        {/* No holographic overlays — clean shader tickets only */}

        <AdmitOneTicket
          tilt={false}
          name={ticket.name}
          presenter={`ENTRY PASS — ${typeLabel.toUpperCase()}`}
          event={hasSettings ? `${settings.name || ""}${settings.place ? `  •  ${settings.place}` : ""}` : ""}
          venue={""}
          dates={ticket.gate ? `${ticket.age} / ${ticket.gender}  \u2022  Gate ${ticket.gate}` : `${ticket.age} / ${ticket.gender}`}
          stubText="ADMIT ONE"
          watermark={typeLabel.toUpperCase()}
          width={ticketWidth}
          layout={customLayout}
          texture={ticketStyle.texture}
          gradient={ticketStyle.gradient}
        />

        {/* QR code overlay — bigger, moves with tilt */}
        {qrDataUrl && (
          <div
            className="pointer-events-none absolute rounded-lg bg-white p-1.5"
            style={{
              bottom: `${(30 / 741) * ticketWidth}px`,
              left: `${(425 / 741) * ticketWidth}px`,
              width: `${(110 / 741) * ticketWidth}px`,
              zIndex: 20,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" className="w-full" />
          </div>
        )}

        {/* Ticket ID overlay — right beneath the age/gender footer */}
        <div
          className="pointer-events-none absolute font-medium uppercase whitespace-nowrap"
          style={{
            top: `${(355 / 741) * ticketWidth}px`,
            left: `${(57 / 741) * ticketWidth}px`,
            fontSize: `${customLayout.footerSize * ticketWidth}px`,
            letterSpacing: `${customLayout.footerTracking}em`,
            fontFamily: "Gotham Nights",
            color: inkColor,
            opacity: 0.85,
            zIndex: 20,
          }}
        >
          ID: {ticket.id}
        </div>

        {/* Glare overlay — clipped to ticket shape so it doesn't show on cutouts */}
        <div
          ref={glareRef}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transition: hovering ? "none" : "background 420ms ease-out",
            clipPath: `path('${ticketClipPath(ticketWidth, ticketWidth / TICKET_GEOMETRY.aspect)}')`,
          }}
        />
      </div>

      {/* Hidden QR canvas for Wallet */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Buttons row: Google Wallet + Download */}
      <div className="mt-6 flex w-full max-w-[380px] items-start gap-2 sm:gap-3"
        style={{ transform: "scale(0.73)", transformOrigin: "top center" }}>
        <div className="flex-1">
          <WalletButton ticketId={ticket.id} name={ticket.name} typeLabel={typeLabel} eventName={settings.name} venue={settings.place} gender={ticket.gender} age={String(ticket.age)} />
        </div>
        <DownloadButton tiltRef={tiltRef} ticketId={ticket.id} />
      </div>

      {/* Tip overlay — blurred backdrop, auto-dismisses after 5s */}
      {showTip && (
        <div
          onClick={() => setShowTip(false)}
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md transition-opacity duration-700"
          style={{ background: "rgba(0,0,0,0.4)", opacity: showTip ? 1 : 0 }}
        >
          <div className="rounded-2xl border border-white/10 bg-black/60 px-8 py-6 text-center">
            <p className="text-base font-medium text-white">
              Touch, Tilt or use Mouse to interact
            </p>
            <p className="mt-1 text-xs text-white/40">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}

      {/* Report Issue floating button + modal */}
      <ReportIssueButton ticketId={ticket.id} />
    </div>
  );
}

function WalletButton({ ticketId, name, typeLabel, eventName, venue, gender, age }: { ticketId: string; name: string; typeLabel: string; eventName: string; venue: string; gender: string; age: string; }) {
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, name, typeLabel, eventName, venue, gender, age }) });
      const data = await res.json();
      if (data.ok && data.url) window.location.href = data.url;
    } catch {}
    setLoading(false);
  }

  return (
    <button onClick={handleSave} disabled={loading} className="w-full disabled:opacity-40">
      {loading ? (
        <span className="flex items-center justify-center py-3 text-sm text-white/60">Preparing...</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/img/wallet-button.svg" alt="Add to Google Wallet" className="w-full" />
      )}
    </button>
  );
}

/** Download button — snapshots the ticket as PNG using html-to-image. */
function DownloadButton({ tiltRef, ticketId }: { tiltRef: RefObject<HTMLDivElement | null>; ticketId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!tiltRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");

      // Capture the original element (WebGL canvas doesn't clone).
      // Reset transform temporarily so we get a flat capture.
      const el = tiltRef.current;
      const prevTransform = el.style.transform;
      el.style.transform = "none";

      // Wait for fonts + render.
      if (document.fonts) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const sourceDataUrl = await toPng(el, {
        pixelRatio: 4,
        backgroundColor: "#000000",
        cacheBust: true,
        style: { transform: "none" },
      });

      el.style.transform = prevTransform;

      // Rotate 90° clockwise into portrait using a canvas.
      const img = new Image();
      img.src = sourceDataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const sw = img.naturalWidth;
      const sh = img.naturalHeight;

      const canvas = document.createElement("canvas");
      canvas.width = sh;   // portrait width = landscape height
      canvas.height = sw;  // portrait height = landscape width
      const ctx = canvas.getContext("2d")!;
      ctx.translate(sh, 0);   // move origin to top-right
      ctx.rotate(Math.PI / 2); // 90° clockwise
      ctx.drawImage(img, 0, 0, sw, sh);

      const portraitDataUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = portraitDataUrl;
      link.download = `ticket-${ticketId.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Download failed:", err);
    }
    setDownloading(false);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="mt-0.5 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[50%] bg-[#1F1F1F] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ border: "1.9px solid #747775" }}
      title="Download ticket image"
    >
      {downloading ? (
        <Loader2 className="h-5 w-5 !animate-spin" />
      ) : (
        <Download className="h-5 w-5" />
      )}
    </button>
  );
}

/** Floating Report Issue button + modal. Sends to Telegram via API. */
function ReportIssueButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  function reset() {
    setName("");
    setPhone("");
    setDialCode(DEFAULT_DIAL_CODE);
    setReason("");
    setMessage("");
    setReportId(null);
    setCopied(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    setOpen(v);
  }

  async function handleSubmit() {
    if (!name.trim() || !phone.trim() || !reason.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: dialCode + phone, reason, message }),
      });
      const data = await res.json();
      if (data.ok) {
        setReportId(data.reportId);
      } else {
        toast.error(data.error || "Failed to submit report");
      }
    } catch {
      toast.error("Failed to submit report");
    }
    setSubmitting(false);
  }

  async function handleCopy() {
    if (!reportId) return;
    try {
      await navigator.clipboard.writeText(reportId);
      setCopied(true);
      toast.success("Report ID copied");
    } catch {
      toast.error("Couldn't copy — please write it down");
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black/80 hover:border-white/20"
      >
        <Flag className="h-4 w-4" />
        <span className="hidden sm:inline">Report Issue</span>
      </button>

      {/* Floating panel — opens above the button, right-aligned, no blur overlay */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[calc(100%-3rem)] max-w-sm rounded-2xl border border-white/10 bg-[rgb(10,10,10)] p-5 shadow-2xl">
          {reportId ? (
            /* Confirmation */
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-green/20 text-success-green">
                <BadgeCheck size={26} animation="path" animateOnView animateOnViewOnce />
              </div>
              <div>
                <h3 className="text-base font-semibold">Report Submitted</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your report has been received. Keep this ID for future reference.
                </p>
              </div>
              <div className="w-full rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[0.65rem] text-muted-foreground">Report ID</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold text-white">{reportId}</code>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <Button className="w-full" size="sm" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            /* Form */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Report an Issue</h3>
                <button onClick={() => handleOpenChange(false)} className="text-muted-foreground hover:text-white">
                  <span className="text-lg leading-none">✕</span>
                </button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpt-name" className="text-xs">Name</Label>
                <Input id="rpt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpt-phone" className="text-xs">Phone Number</Label>
                <div className="flex gap-2">
                  <SearchableSelect
                    value={dialCode}
                    onChange={setDialCode}
                    options={sortedCountryCodes.map((c) => ({
                      value: c.code,
                      label: `${c.code} ${c.country}`,
                      triggerLabel: c.code,
                      flag: c.iso,
                      key: c.iso,
                    }))}
                    placeholder="Code"
                    dropAlign="right"
                    panelWidth="w-56"
                    className="w-[100px] shrink-0"
                  />
                  <Input
                    id="rpt-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="h-8 flex-1 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpt-reason" className="text-xs">Reason</Label>
                <Input id="rpt-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ticket not loading" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpt-msg" className="text-xs">Message</Label>
                <Textarea id="rpt-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue..." rows={3} className="text-sm" />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !name.trim() || !phone.trim() || !reason.trim() || !message.trim()}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Report
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
