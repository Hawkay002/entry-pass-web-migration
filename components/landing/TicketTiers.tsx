// components/landing/TicketTiers.tsx — live showcase of all 4 holographic shader
// ticket types. Magnetic glass-pill switcher. Double-bezel ticket wrapper.
// Displays real tickets from the guest list (passed as props), with a clean
// fallback when a tier has no ticket.

"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import AdmitOneTicket, {
  TICKET_TEXTURE,
  TICKET_GRADIENT,
  TICKET_LAYOUT,
} from "@/components/ui/admit-one-ticket";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/types";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type TierKey = "Classic" | "Diamond" | "SVIP" | "Gold";

export interface ShowcaseTicket {
  id: string;
  name: string;
  age: number;
  gender: Gender;
}

export interface TicketTiersProps {
  /** Real tickets keyed by internal TicketType. Missing → demo fallback. */
  tickets?: Partial<Record<TierKey, ShowcaseTicket>>;
  event?: string;
  venue?: string;
}

interface Tier {
  key: TierKey;
  label: string;
  tagline: string;
  texture: typeof TICKET_TEXTURE;
  gradient: typeof TICKET_GRADIENT;
  /** Showcase gate number shown on this tier's demo ticket. */
  gate: string;
  /** Stable demo ticket id (valid PB format; QR encodes /ticket/<id>). */
  demoId: string;
}

const TIERS: Tier[] = [
  {
    key: "Gold",
    label: "VVIP",
    tagline: "The showpiece. A warm warp shader with the strongest motion in the set.",
    texture: TICKET_TEXTURE,
    gradient: TICKET_GRADIENT,
    gate: "A1",
    demoId: "vvipdemo00000001",
  },
  {
    key: "SVIP",
    label: "SVIP",
    tagline: "Solid gold. A flowing shader that reads as engraved prestige.",
    texture: {
      ...TICKET_TEXTURE,
      colorBack: "#bf953f",
      colorFront: "#fcf6ba",
      colorHighlight: "#b38728",
      shape: "ripple",
      type: "8x8",
      speed: 0.35,
    },
    gradient: {
      ...TICKET_GRADIENT,
      colorLight: "#fcf6ba",
      colorMid: "#bf953f",
      colorDark: "#aa771c",
    },
    gate: "B3",
    demoId: "svipdemo00000002",
  },
  {
    key: "Diamond",
    label: "VIP",
    tagline: "Liquid silver. A ripple shader that catches the light like polished metal.",
    texture: {
      ...TICKET_TEXTURE,
      colorBack: "#475569",
      colorFront: "#e2e8f0",
      colorHighlight: "#cbd5e1",
      shape: "ripple",
      type: "8x8",
      speed: 0.35,
    },
    gradient: {
      ...TICKET_GRADIENT,
      colorLight: "#e2e8f0",
      colorMid: "#94a3b8",
      colorDark: "#475569",
    },
    gate: "C2",
    demoId: "vipdemo000000003",
  },
  {
    key: "Classic",
    label: "Classic",
    tagline: "Understated depth. Deep-navy simplex shader for general admission.",
    texture: {
      ...TICKET_TEXTURE,
      colorBack: "#1a1a2e",
      colorFront: "#16213e",
      colorHighlight: "#0f3460",
      shape: "simplex",
      type: "4x4",
      speed: 0.3,
    },
    gradient: {
      ...TICKET_GRADIENT,
      colorLight: "#1a1a2e",
      colorMid: "#16213e",
      colorDark: "#0f0f1a",
    },
    gate: "D4",
    demoId: "classicdemo00004",
  },
];

const MAX_WIDTH = 600;

/** Exact per-tier layout the REAL ticket uses (components/tickets/
 *  ticket-card.tsx `layout`), so the showcase typography is pixel-identical:
 *  name/footer repositioning, white ink + small faint watermark on Classic,
 *  engraved text on VVIP. */
function showcaseLayout(tierKey: TierKey) {
  const isClassic = tierKey === "Classic";
  const isVVIP = tierKey === "Gold";
  return {
    ...TICKET_LAYOUT,
    nameTop: 130 / 741,
    footerTop: 320 / 741,
    footerSize: 26 / 741,
    inkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.inkColor,
    watermarkColor: isClassic ? "#ffffff" : TICKET_LAYOUT.watermarkColor,
    ...(isClassic ? { watermarkSize: 110 / 741, watermarkOpacity: 0.15 } : {}),
    ...(isVVIP ? { engraved: true } : {}),
  };
}

export function TicketTiers({ tickets = {}, event, venue }: TicketTiersProps) {
  const [active, setActive] = useState(0); // VVIP — the showpiece
  const [width, setWidth] = useState(MAX_WIDTH);
  const tier = TIERS[active];

  // Showcase identity is FIXED (not pulled from the guest list) — the landing
  // always presents the same demo guest with a stable-looking id/QR per tier.
  const real = tickets[tier.key];
  void real;
  const name = "Shovith Debnath";
  const dates = "24 / Male · Gate " + tier.gate;
  const eventLine =
    event && venue
      ? `${event}  •  ${venue}`
      : event || "Event Name  •  Event Venue";

  useEffect(() => {
    const measure = () =>
      setWidth(Math.min(MAX_WIDTH, Math.max(280, window.innerWidth - 48)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        {/* Magnetic switcher */}
        <div className="glass-pill mx-auto mb-14 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full p-1.5">
          {TIERS.map((t, i) => (
            <button
              key={t.key}
              onClick={() => setActive(i)}
              className={cn(
                "group relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                "active:scale-[0.97]",
                active === i
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* Copy */}
          <div>
            <h2
              className="text-balance leading-tight tracking-tight text-foreground"
              style={{
                fontFamily: '"The Seasons", serif',
                fontWeight: 700,
                fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)",
                letterSpacing: "-0.02em",
              }}
            >
              Four tiers.
              <br />
              One holographic language.
            </h2>
            <p
              key={tier.key + "-tag"}
              className="mt-5 max-w-md text-pretty leading-relaxed text-muted-foreground md:text-lg"
              style={{
                animation: `tier-fade 600ms ${EASE}`,
              }}
            >
              {tier.tagline}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Each ticket is a live WebGL shader — tilts with touch or cursor,
              carries a unique QR, and saves straight to Google Wallet.
            </p>
          </div>

          {/* Double-bezel ticket wrapper */}
          <div className="relative flex justify-center lg:justify-end">
            {/* glow aura — color shifts with tier */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
            >
              <div
                key={tier.key + "-glow"}
                className="h-[75%] w-[90%] rounded-full opacity-35 blur-3xl"
                style={{
                  background: `radial-gradient(closest-side, ${tier.gradient.colorMid}, transparent 75%)`,
                  animation: `tier-fade 800ms ${EASE}`,
                }}
              />
            </div>

            {/* Ticket (no border frame) */}
            <div style={{ transition: `transform 700ms ${EASE}` }}>
              <TiltedTicket
                tier={tier}
                name={name}
                dates={dates}
                eventLine={eventLine}
                width={width}
                ticketId={tier.demoId}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tier-fade {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}

/** Ticket + QR + ID overlay, all wrapped in a shared 3D-tilt container so
 *  the overlays tilt together with the shader ticket. */
function TiltedTicket({
  tier,
  name,
  dates,
  eventLine,
  width,
  ticketId,
}: {
  tier: Tier;
  name: string;
  dates: string;
  eventLine: string;
  width: number;
  ticketId?: string;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // QR encodes the interactive ticket URL — same as the real product.
  useEffect(() => {
    if (!ticketId) {
      setQrDataUrl("");
      return;
    }
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/ticket/${ticketId}`
        : ticketId;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [ticketId]);

  // Pointer + touch-driven tilt (transform/opacity only — GPU-safe).
  useEffect(() => {
    const node = tiltRef.current;
    if (!node) return;
    const maxTilt = 11;

    const applyTilt = (clientX: number, clientY: number) => {
      const rect = node.getBoundingClientRect();
      const dx = (clientX - rect.left) / rect.width - 0.5;
      const dy = (clientY - rect.top) / rect.height - 0.5;
      node.style.transform = `perspective(1200px) rotateX(${-(dy * 2) * maxTilt}deg) rotateY(${dx * 2 * maxTilt}deg) scale(1.02)`;
    };
    const reset = () => {
      node.style.transform = "perspective(1200px) rotateX(0) rotateY(0) scale(1)";
    };

    // Mouse
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") applyTilt(e.clientX, e.clientY);
    };
    const onPointerLeave = () => reset();

    // Touch — pointermove with touch doesn't fire reliably during scroll;
    // listen to touchmove explicitly and preventDefault so the tilt captures
    // the gesture instead of the page scrolling.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        applyTilt(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => reset();

    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerleave", onPointerLeave);
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchEnd);
    return () => {
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const isClassic = tier.key === "Classic";
  const inkColor = isClassic ? "#ffffff" : TICKET_LAYOUT.inkColor;

  return (
    <div
      ref={tiltRef}
      style={{
        width,
        maxWidth: "100%",
        transformStyle: "preserve-3d",
        transition: `transform 600ms ${EASE}`,
        touchAction: "none",
      }}
    >
      <div style={{ width, position: "relative" }}>
        <AdmitOneTicket
          key={tier.key}
          tilt={false}
          name={name}
          presenter={`ENTRY PASS — ${tier.label.toUpperCase()}`}
          event={eventLine}
          venue={""}
          dates={dates}
          stubText="ADMIT ONE"
          watermark={tier.label.toUpperCase()}
          width={width}
          layout={showcaseLayout(tier.key)}
          texture={tier.texture}
          gradient={tier.gradient}
        />

        {/* QR code overlay — bottom-left of the stub */}
        {qrDataUrl && (
          <div
            className="pointer-events-none absolute rounded-lg bg-white p-1.5"
            style={{
              bottom: `${(30 / 741) * width}px`,
              left: `${(425 / 741) * width}px`,
              width: `${(110 / 741) * width}px`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Ticket QR code"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        )}

        {/* Ticket ID overlay */}
        {ticketId && (
          <div
            className="pointer-events-none absolute font-medium uppercase whitespace-nowrap"
            style={{
              top: `${(355 / 741) * width}px`,
              left: `${(57 / 741) * width}px`,
              fontSize: `${showcaseLayout(tier.key).footerSize * width}px`,
              letterSpacing: `${TICKET_LAYOUT.footerTracking}em`,
              fontFamily: "Gotham Nights",
              color: inkColor,
              opacity: 0.85,
            }}
          >
            ID: {ticketId}
          </div>
        )}
      </div>
    </div>
  );
}