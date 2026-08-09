// components/landing/Manifesto.tsx — the statement. The Seasons serif, glass.

import { Reveal } from "./Reveal";

export function Manifesto() {
  return (
    <section className="relative py-28 md:py-36">
      <div className="mx-auto max-w-4xl px-6 text-center md:px-10">
        <Reveal>
          <p
            className="text-balance text-3xl leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-5xl"
            style={{ fontFamily: '"The Seasons", serif', fontWeight: 700 }}
          >
            Ticketing tells you who is invited.
            <br />
            <span className="text-muted-foreground">EntryPass tells you</span>
            <br />
            <span className="text-accent-secondary">who is actually inside.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
