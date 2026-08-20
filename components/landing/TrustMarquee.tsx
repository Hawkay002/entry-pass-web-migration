// components/landing/TrustMarquee.tsx — full-width marquee of event types
// travelling along a wave path (React Bits TextLoop via shadcn registry).
//
// The component renders a 1200x520 canvas with the wave centred vertically
// (y=260). We want only the ribbon band, so the wrapper is a short box and
// the TextLoop is absolutely positioned with its centre pushed into view —
// the parts above/below simply overflow-hidden away.

import TextLoop from "@/components/TextLoop";
import { TRUST_ITEMS } from "./data";

export function TrustMarquee() {
  return (
    <div className="relative h-40 overflow-hidden md:h-48">
      {/* centre the 520-tall canvas on the wave line: top = 50% shifted by
          half the canvas height (canvas scales with width, aspect 1200:520) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-[260px] md:-translate-y-[300px] scale-[0.9] md:scale-100">
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
          ribbonWidth={64}
          pauseOnHover
        />
      </div>
    </div>
  );
}
