// components/landing/Features.tsx — feature showcase in the glass language.
// Every feature card uses the animated glow border card. Asymmetric: the lead
// (scanner) is featured full-width; the rest flow in a fluid grid.

import { FEATURES } from "./data";
import { Reveal } from "./Reveal";
import { Card, CardCanvas } from "@/components/ui/animated-glow-card";

export function Features() {
  const [lead, ...rest] = FEATURES;

  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        {/* Section heading */}
        <Reveal>
          <h2 className="max-w-xl text-balance text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Everything a gate needs,
            <br />
            nothing it doesn't.
          </h2>
        </Reveal>

        {/* Lead feature — full-width glow card */}
        <Reveal delay={80}>
          <div className="mt-14 md:mt-16">
            <CardCanvas className="block w-full">
              <Card className="w-full">
                <LeadFeature feature={lead} />
              </Card>
            </CardCanvas>
          </div>
        </Reveal>

        {/* The rest — fluid glow-card grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {rest.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={(i % 2) * 80}>
                <CardCanvas className="block h-full w-full">
                  <Card className="h-full w-full">
                    <div className="p-7 md:p-8">
                      <div className="flex items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-secondary/15 text-accent-secondary ring-1 ring-accent-secondary/25">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              {feature.title}
                            </h3>
                            <span className="text-xs font-medium text-accent-secondary">
                              {feature.metric}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </CardCanvas>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** The headline feature, treated with more space and a metric badge. */
function LeadFeature({ feature }: { feature: (typeof FEATURES)[number] }) {
  const Icon = feature.icon;
  return (
    <div className="p-8 md:p-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
        <div className="flex shrink-0 items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-secondary/15 text-accent-secondary ring-1 ring-accent-secondary/25">
            <Icon className="h-7 w-7" />
          </span>
          <div className="md:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-green/15 px-3 py-1 text-xs font-medium text-success-green ring-1 ring-success-green/30">
              <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
              {feature.metric}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {feature.title}
          </h3>
          <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted-foreground md:text-base">
            {feature.description}
          </p>
        </div>

        <div className="hidden shrink-0 md:block">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-green/15 px-3.5 py-1.5 text-sm font-medium text-success-green ring-1 ring-success-green/30">
            <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
            {feature.metric}
          </span>
        </div>
      </div>
    </div>
  );
}
