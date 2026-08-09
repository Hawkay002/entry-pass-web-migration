// components/landing/TrustMarquee.tsx — full-width edge-to-edge marquee of
// event types, with fade masks on both sides. Not container-capped.

import { TRUST_ITEMS } from "./data";

export function TrustMarquee() {
  // Repeat enough times to fill wide viewports without a visible seam.
  const loop = [...TRUST_ITEMS, ...TRUST_ITEMS, ...TRUST_ITEMS, ...TRUST_ITEMS];

  return (
    <div className="relative py-6">
      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee items-center">
          {loop.map((item, i) => (
            <div key={i} className="flex shrink-0 items-center">
              <span className="px-8 text-sm font-medium text-muted-foreground md:text-base">
                {item}
              </span>
              <span className="h-1 w-1 rounded-full bg-accent-secondary/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}