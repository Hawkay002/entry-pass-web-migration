// components/landing/CTA.tsx — the closer. Double-bezel + blue glow aura + serif.

import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WHATSAPP_URL } from "./data";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function CTA() {
  return (
    <section id="contact" className="relative py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <Reveal>
          {/* Double-bezel outer shell */}
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            {/* inner core */}
            <div className="relative overflow-hidden rounded-[calc(2rem-0.625rem)] border border-white/8 px-6 py-20 text-center md:px-12 md:py-28">
              {/* glow aura */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
              >
                <div
                  className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(59,130,246,0.55), transparent 75%)",
                    animation: "orb-drift-3 34s ease-in-out infinite",
                  }}
                />
                <div
                  className="absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(16,185,129,0.45), transparent 75%)",
                    animation: "orb-drift-1 22s ease-in-out infinite",
                  }}
                />
              </div>

              <h2
                className="mx-auto max-w-2xl text-balance text-foreground"
                style={{
                  fontFamily: '"The Seasons", serif',
                  fontWeight: 700,
                  fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.02em",
                }}
              >
                Every gate. Every guest.
                <br />
                <span className="text-accent-secondary">Under command.</span>
              </h2>
              <p className="mx-auto mt-7 max-w-lg text-pretty leading-relaxed text-muted-foreground md:text-lg">
                Request access and bring your next event under real control — no
                spreadsheets, no clipboard, no guesswork at the door.
              </p>

              <div className="mt-10 flex justify-center">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "group inline-flex items-center rounded-full px-7 py-4 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                    "hover:scale-[1.02] active:scale-[0.97]",
                    buttonVariants({ size: "lg" })
                  )}
                >
                  Request access
                  <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/15 transition-transform duration-500 group-hover:translate-x-[3px] group-hover:-translate-y-[2px]">
                    <ArrowRight className="size-3.5" />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}