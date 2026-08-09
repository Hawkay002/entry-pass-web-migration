// components/landing/Reveal.tsx — IntersectionObserver-driven entry reveal.
// Transform + opacity ONLY (GPU-composited → smooth alongside Lenis smooth
// scroll). Opacity lags transform so the fade builds gently rather than
// snapping on with the motion.

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

// Gentle ease-out — soft acceleration at the start (no jolt), long settle.
const TRANSFORM_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const OPACITY_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : "translate3d(0,42px,0)",
        transition: `transform 1100ms ${TRANSFORM_EASE} ${delay}ms, opacity 1500ms ${OPACITY_EASE} ${delay}ms`,
        willChange: visible ? "auto" : "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}