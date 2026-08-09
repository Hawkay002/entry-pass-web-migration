// components/landing/OperationsPreview.tsx — live "command center" preview.
// Animated gate counts + activity feed, restyled in glass. Shows the
// operational side of the product: what an organizer sees during an event.

"use client";

import { useEffect, useState } from "react";
import { GATES, ACTIVITY_EVENTS, ACTIVITY_GATE_IDS } from "./data";

interface LogLine {
  id: number;
  gate: string;
  event: string;
}

export function OperationsPreview() {
  const [counts, setCounts] = useState(() => GATES.map((g) => g.baseCount));
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);
  const [clock, setClock] = useState("");
  const [log, setLog] = useState<LogLine[]>([
    { id: -3, gate: "GATE-A", event: "Guest verified" },
    { id: -2, gate: "GATE-B", event: "Guest verified" },
    { id: -1, gate: "GATE-C", event: "Ticket scanned — granted" },
  ]);

  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    setClock(format());
    const clockTimer = setInterval(() => setClock(format()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    let id = 0;
    const timer = setInterval(() => {
      const activeIdxs = GATES.map((g, i) =>
        g.status === "active" ? i : -1
      ).filter((i) => i !== -1);
      const target =
        activeIdxs[Math.floor(Math.random() * activeIdxs.length)];
      setCounts((prev) => prev.map((c, i) => (i === target ? c + 1 : c)));
      setPulseIndex(target);
      setTimeout(() => setPulseIndex(null), 900);

      id += 1;
      const gate =
        ACTIVITY_GATE_IDS[
          Math.floor(Math.random() * ACTIVITY_GATE_IDS.length)
        ];
      const event =
        ACTIVITY_EVENTS[Math.floor(Math.random() * ACTIVITY_EVENTS.length)];
      setLog((prev) => [...prev.slice(-2), { id, gate, event }]);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const total = counts.reduce((sum, c) => sum + c, 0);

  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-12">
          {/* Copy */}
          <div className="order-2 lg:order-1">
            <h2 className="max-w-md text-balance text-3xl leading-[1.08] tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Watch every gate,
              <br />
              live.
            </h2>
            <p className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground md:text-lg">
              Entry counts update in real time across every entrance. A misread,
              a duplicate scan, a locked tab — you see it the moment it happens,
              from anywhere in the venue.
            </p>
            <ul className="mt-8 max-w-md space-y-3">
              {[
                "Per-gate live counts and status",
                "Streaming activity feed of every scan",
                "Lock or unlock staff tabs without leaving the floor",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90 md:text-base"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success-green" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Live operations panel */}
          <div className="order-1 lg:order-2">
            <div className="glass-panel mx-auto w-full max-w-md rounded-2xl">
              {/* header */}
              <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-green opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-green" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    Live Operations
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {clock} IST
                </span>
              </div>

              {/* gates */}
              <div>
                {GATES.map((gate, i) => (
                  <div
                    key={gate.id}
                    className={`flex items-center justify-between border-b border-white/8 px-6 py-4 transition-colors duration-500 ${
                      pulseIndex === i ? "bg-accent-secondary/10" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          gate.status === "active"
                            ? "bg-success-green"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {gate.id}
                        </div>
                        <div className="truncate text-sm text-foreground">
                          {gate.name}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base tabular-nums text-foreground">
                        {String(counts[i]).padStart(4, "0")}
                      </div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {gate.status === "active" ? "Active" : "Standby"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* activity feed */}
              <div className="space-y-1.5 border-b border-white/8 bg-black/20 px-6 py-3.5">
                {log.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-500"
                  >
                    <span className="text-muted-foreground/50">›</span>
                    <span className="text-muted-foreground">{line.gate}</span>
                    <span className="text-foreground/70">{line.event}</span>
                  </div>
                ))}
              </div>

              {/* total */}
              <div className="flex items-center justify-between px-6 py-5">
                <span className="text-sm text-muted-foreground">Total entries</span>
                <span className="text-2xl tabular-nums text-foreground">
                  {String(total).padStart(4, "0")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
