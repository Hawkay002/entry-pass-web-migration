// components/landing/HowItWorks.tsx — four-step sequence, glass.
// Numbering is legitimate here: it IS an ordered flow.

import { STEPS } from "./data";
import { Reveal } from "./Reveal";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <Reveal>
          <h2 className="max-w-xl text-balance text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            From guest list to gate,
            <br />
            in four steps.
          </h2>
        </Reveal>

        <div className="relative mt-14 grid grid-cols-1 gap-8 md:mt-16 md:grid-cols-4 md:gap-6">
          {/* connecting line */}
          <div className="absolute left-0 right-0 top-3.5 hidden h-px bg-white/10 md:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step.index} delay={i * 90}>
              <div className="relative h-full">
                <div className="mb-5 flex items-center gap-3">
                  <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent-secondary/15 text-xs font-semibold text-accent-secondary ring-1 ring-accent-secondary/30">
                    {step.index}
                  </span>
                  <div className="h-px flex-1 bg-white/10 md:hidden" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
