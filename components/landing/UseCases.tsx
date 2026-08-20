// components/landing/UseCases.tsx — three event types as glow cards.

import { USE_CASES } from "./data";
import { Reveal } from "./Reveal";
import BorderGlow from "@/components/BorderGlow";

export function UseCases() {
  return (
    <section id="use-cases" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <Reveal>
          <h2 className="max-w-xl text-balance text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Every event has its
            <br />
            own idea of chaos.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3">
          {USE_CASES.map((useCase, i) => (
            <Reveal key={useCase.title} delay={i * 90} className="h-full">
              <BorderGlow className="h-full w-full" backgroundColor="#141414" borderRadius={20}>
                <div className="p-7 md:p-8">
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                      {useCase.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {useCase.description}
                    </p>
                    <ul className="mt-6 space-y-3 border-t border-white/8 pt-6">
                      {useCase.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-3 text-sm text-foreground/90"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-secondary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                </div>
              </BorderGlow>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
