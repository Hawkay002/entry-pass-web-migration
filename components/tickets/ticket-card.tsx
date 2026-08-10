// components/tickets/ticket-card.tsx — the printable ticket card with QR.
// Uses AdmitOneTicket (WebGL shader) with tilt disabled.
// Passes the measured container width directly to AdmitOneTicket — no
// CSS transforms, no overflow hacks.

"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { TICKET_TYPE_LABELS } from "@/lib/types";
import type { Ticket } from "@/lib/types";
import AdmitOneTicket, { TICKET_TEXTURE, TICKET_GRADIENT, TICKET_LAYOUT } from "@/components/ui/admit-one-ticket";

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
    texture: { ...TICKET_TEXTURE, colorBack: "#bf953f", colorFront: "#fcf6ba", colorHighlight: "#b38728", shape: "ripple", type: "8x8", speed: 0.35 },
    gradient: { ...TICKET_GRADIENT, colorLight: "#fcf6ba", colorMid: "#bf953f", colorDark: "#aa771c" },
  },
  Gold: { texture: TICKET_TEXTURE, gradient: TICKET_GRADIENT },
};

export const TicketCard = forwardRef<HTMLDivElement, {
  ticket: Pick<Ticket, "id" | "name" | "age" | "gender" | "phone" | "ticketType" | "gate">;
  eventName?: string;
  venue?: string;
  /** Gate name to display on the ticket face (resolved from gate id by caller). */
  gateName?: string;
}>(function TicketCard({
  ticket,
  eventName,
  venue,
  gateName,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [ticketWidth, setTicketWidth] = useState(380);

  // Measure the available width and pass it directly to AdmitOneTicket.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function recalc() {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      if (w > 0) setTicketWidth(Math.min(w, 741));
    }

    recalc();
    const timers = [16, 50, 200, 500].map((ms) => setTimeout(recalc, ms));
    const ro = new ResizeObserver(recalc);
    ro.observe(el.parentElement ?? el);

    return () => {
      ro.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const typeLabel = TICKET_TYPE_LABELS[ticket.ticketType] ?? ticket.ticketType;
  const style = TYPE_STYLES[ticket.ticketType] ?? TYPE_STYLES.Gold;
  const isClassic = ticket.ticketType === "Classic";
  const isVVIP = ticket.ticketType === "Gold";

  useEffect(() => {
    QRCode.toDataURL(ticket.id, {
      width: 150,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl).catch(() => {});
  }, [ticket.id]);

  const layout = {
    ...TICKET_LAYOUT,
    nameTop: 130 / 741,
    footerTop: 320 / 741,
    footerSize: 26 / 741,
    inkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.inkColor,
    watermarkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.watermarkColor,
    ...(isClassic ? { watermarkSize: 110 / 741, watermarkOpacity: 0.15 } : {}),
    ...(isVVIP ? { engraved: true } : {}),
  };

  // Position overlays as ratios of the actual ticket width (not 741).
  const w = ticketWidth;

  return (
    <div ref={ref} style={{ width: w, height: w / (741 / 425), position: "relative" }}>
      <div ref={containerRef} style={{ width: w, position: "relative" }}>
        <AdmitOneTicket
          tilt={false}
          name={ticket.name}
          presenter={`ENTRY PASS — ${typeLabel.toUpperCase()}`}
          event={eventName ? `${eventName}${venue ? `  •  ${venue}` : ""}` : ""}
          venue={gateName ? `Gate ${gateName}` : ""}
          dates={`${ticket.age} / ${ticket.gender}`}
          stubText="ADMIT ONE"
          watermark={typeLabel.toUpperCase()}
          width={w}
          layout={layout}
          texture={style.texture}
          gradient={style.gradient}
        />

        {/* QR code overlay */}
        {qrDataUrl && (
          <div
            className="pointer-events-none absolute rounded-lg bg-white p-1"
            style={{
              bottom: `${(30 / 741) * w}px`,
              left: `${(425 / 741) * w}px`,
              width: `${(90 / 741) * w}px`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        )}

        {/* Ticket ID overlay */}
        <div
          className="pointer-events-none absolute font-medium uppercase whitespace-nowrap"
          style={{
            top: `${(355 / 741) * w}px`,
            left: `${(57 / 741) * w}px`,
            fontSize: `${(22 / 741) * w}px`,
            letterSpacing: `${layout.footerTracking}em`,
            fontFamily: "Gotham Nights",
            color: layout.inkColor,
            opacity: 0.85,
            ...(isVVIP ? { textShadow: "0 1px 0 rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.15)" } : {}),
          }}
        >
          ID: {ticket.id}
        </div>
      </div>
    </div>
  );
});
