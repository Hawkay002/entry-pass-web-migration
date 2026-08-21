// components/landing/TrustMarquee.tsx — full-width marquee of event types
// travelling along a wave path (React Bits TextLoop via shadcn registry).
//
// The component renders a 1200x520 SVG canvas (scales with viewport width)
// with the wave centred vertically. We want only the ribbon band visible, so
// the wrapper is a short box and the TextLoop is absolutely positioned with
// its CENTRE pushed to the wrapper's centre — percentage math that scales
// with the canvas on any screen size (fixed px offsets broke mobile).

import TextLoop from "@/components/TextLoop";
import { TRUST_ITEMS } from "./data";

export function TrustMarquee() {
  return (
    <div className="relative h-44 overflow-hidden md:h-48">
      {/* canvas is w-full (SVG 1200x520 aspect). Its centre sits at 50% of its
          own height; to align the wave line (canvas centre) with this box's
          centre: top 50% of box, minus 50% of the canvas. Left edge anchored
          so the scaling canvas never leaks past the box (no horizontal scroll). */}
      <div className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2">
        <TextLoop
          text={TRUST_ITEMS.join("   ✦   ")}
          shape="wave"
          curviness={30}
          speed={110}
          direction="forward"
          separator="✦"
          fontSize={26}
          fontWeight={700}
          letterSpacing={3}
          uppercase
          color="#f4f2ee"
          ribbon
          ribbonColor="rgba(82, 39, 255, 0.16)"
          ribbonWidth={78}
          pauseOnHover
        />
      </div>
    </div>
  );
}
