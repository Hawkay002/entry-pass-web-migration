// components/landing/SecurityControl.tsx — authority section, glass panel mock.

import { Reveal } from "./Reveal";
import { SECURITY_POINTS } from "./data";
import { Lock } from "lucide-react";
import BorderGlow from "@/components/BorderGlow";

export function SecurityControl() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-12">
          {/* Copy */}
          <Reveal>
            <h2 className="max-w-md text-balance text-3xl leading-[1.08] tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Nothing enters
              <br />
              without your say.
            </h2>
            <p className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground md:text-base">
              Every door has a person behind it. EntryPass makes sure that
              person is always you — even from across the venue.
            </p>
            <ul className="mt-9 max-w-lg space-y-4">
              {SECURITY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-secondary" />
                  <span className="text-sm leading-relaxed text-foreground/90 md:text-base">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Staff access mock */}
          <Reveal delay={150}>
            <StaffAccessMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StaffAccessMock() {
  const staff = [
    { name: "R. Sharma", role: "Gate Lead · GATE-A", active: true },
    { name: "K. Iyer", role: "Scanner · GATE-B", active: true },
    { name: "A. Mehta", role: "Scanner · GATE-C", active: false },
    { name: "S. Rao", role: "Kiosk Admin · GATE-D", active: true },
  ];
  return (
    <BorderGlow className="mx-auto w-full max-w-sm" backgroundColor="#141414" borderRadius={16}>
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
        <span className="text-sm font-semibold text-foreground">
          Staff Access
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
          3/4 active
        </span>
      </div>
      <div>
        {staff.map((m) => (
          <div
            key={m.name}
            className="flex items-center justify-between border-b border-white/8 px-6 py-4 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-foreground">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.role}</div>
            </div>
            {m.active ? (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-success-green">
                <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
                Active
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>
        ))}
      </div>
    </BorderGlow>
  );
}
