// components/landing/HeroTicket.tsx — client wrapper around the real product
// holographic shader ticket, for the landing hero. Guards against WebGL
// failure and SSR, measures width responsively, reserves space to avoid CLS.

"use client";

import { Component, useEffect, useState } from "react";
import AdmitOneTicket from "@/components/ui/admit-one-ticket";

/** Catches "WebGL is not supported" so the hero still renders without the ticket. */
class TicketBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function supportsWebGL2() {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

const REF = 741;
const ASPECT = 741 / 425;
const MAX_WIDTH = 540;

export function HeroTicket() {
  const [width, setWidth] = useState(MAX_WIDTH);
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(supportsWebGL2());
    const measure = () =>
      setWidth(Math.min(MAX_WIDTH, Math.max(260, window.innerWidth - 48)));
    measure();
    window.addEventListener("resize", measure);
    // small delay so fonts + layout settle before the shader mounts
    const t = setTimeout(() => setReady(true), 60);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, []);

  // Reserve the box to avoid layout shift before/during mount.
  if (!ok) return null;
  if (!ready) {
    return (
      <div
        aria-hidden
        style={{ width, height: width / ASPECT }}
        className="opacity-0"
      />
    );
  }

  return (
    <TicketBoundary
      fallback={
        <div
          aria-hidden
          style={{ width, height: width / ASPECT }}
          className="opacity-0"
        />
      }
    >
      <AdmitOneTicket
        name="Aarav Sharma"
        presenter="ENTRY PASS — VVIP"
        event="Annual Gala  •  The Grand Ballroom"
        dates="27 / Male"
        stubText="ADMIT ONE"
        watermark="VVIP"
        width={width}
        tilt={{ maxTilt: 10, glare: 0.18 }}
      />
    </TicketBoundary>
  );
}
