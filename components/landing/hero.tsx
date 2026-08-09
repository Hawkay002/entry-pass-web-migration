// components/landing/Hero.tsx — glass hero over Atmosphere + Starfield.
// Outfit body + The Seasons display. Magnetic CTAs with nested trailing icons.

import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WHATSAPP_URL } from "./data";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden pb-28 pt-40 md:pb-36 md:pt-52"
    >
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center md:px-10">
        <span
          className="glass-pill mb-9 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{
            opacity: 0,
            transform: "translate3d(0,16px,0)",
            animation: `reveal 900ms ${EASE} 100ms forwards`,
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-green opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-green" />
          </span>
          Server-secured entry control
        </span>

        <h1
          className="text-balance text-foreground"
          style={{
            fontFamily: '"The Seasons", serif',
            fontWeight: 700,
            fontSize: "clamp(3.5rem, 8.5vw, 6.5rem)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            opacity: 0,
            transform: "translate3d(0,28px,0)",
            animation: `reveal 1100ms ${EASE} 200ms forwards`,
          }}
        >
          Command every gate.
        </h1>

        <p
          className="mt-7 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={{
            opacity: 0,
            transform: "translate3d(0,20px,0)",
            animation: `reveal 900ms ${EASE} 380ms forwards`,
          }}
        >
          Issue QR tickets, scan guests in milliseconds, and control every
          entry point — server-secured, offline-ready, and built for events
          that don&apos;t get second chances.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          style={{
            opacity: 0,
            transform: "translate3d(0,20px,0)",
            animation: `reveal 900ms ${EASE} 500ms forwards`,
          }}
        >
          <MagneticCTA href={WHATSAPP_URL} primary external>
            Request access
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/15 transition-transform duration-500 group-hover:translate-x-[3px] group-hover:-translate-y-[2px]">
              <ArrowRight className="size-3.5" />
            </span>
          </MagneticCTA>
          <MagneticCTA href="#how-it-works">
            See how it works
          </MagneticCTA>
        </div>
      </div>

      {/* local keyframe — keep inline so it doesn't bloat globals */}
      <style>{`
        @keyframes reveal {
          to { opacity: 1; transform: translate3d(0,0,0); }
        }
      `}</style>
    </section>
  );
}

/** Magnetic CTA: button-in-button trailing icon, active scale, fluid easing. */
function MagneticCTA({
  href,
  primary,
  external,
  children,
}: {
  href: string;
  primary?: boolean;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "group inline-flex items-center rounded-full px-6 py-3.5 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
        "hover:scale-[1.02] active:scale-[0.97]",
        buttonVariants({
          variant: primary ? "default" : "outline",
          size: "lg",
        })
      )}
      style={{ letterSpacing: "0.005em" }}
    >
      {children}
    </a>
  );
}