// components/landing/Stats.tsx — a narrative glass band, not a hero-metric grid.
// A statement with the metrics woven in, avoiding the SaaS big-number template.

import { STATS } from "./data";
import { Reveal } from "./Reveal";

export function Stats() {
  return (
    <section className="relative py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <Reveal>
          <div className="glass-panel rounded-2xl px-8 py-10 md:px-12 md:py-12">
            <p className="text-balance text-xl leading-snug tracking-tight text-foreground sm:text-2xl md:text-3xl">
              Built for events that don't get second chances. Verified
              <span className="text-accent-secondary"> under a second</span>,
              <span className="text-accent-secondary"> zero</span> duplicate
              entries, <span className="text-accent-secondary">24/7</span> live
              visibility, and every scan
              <span className="text-accent-secondary"> logged</span>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/8 pt-6">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-foreground">
                    {stat.value}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
