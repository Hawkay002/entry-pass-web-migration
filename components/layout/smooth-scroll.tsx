// components/layout/smooth-scroll.tsx — Lenis-powered smooth scrolling for the
// landing page. Disabled when prefers-reduced-motion is set.

"use client";

import { useEffect } from "react";
import type Lenis from "lenis";

declare global {
  interface Window {
    /** Landing-page Lenis instance (set by SmoothScroll) — used for anchor scrolls. */
    __lenis?: Lenis | null;
  }
}

export function SmoothScroll() {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (prefersReduced.matches) return;

    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let rafId = 0;

    // Dynamic import keeps Lenis out of the initial bundle.
    import("lenis").then(({ default: Lenis }) => {
      const l = new Lenis({
        duration: 1.15,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5,
      });
      lenis = l;
      window.__lenis = l;

      const raf = (time: number) => {
        l.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      window.__lenis = null;
    };
  }, []);

  return null;
}