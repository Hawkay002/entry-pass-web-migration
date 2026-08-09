"use client";

import { useEffect, useState } from "react";
import { GATES, ACTIVITY_EVENTS, ACTIVITY_GATE_IDS } from "./data";

interface LogLine {
  id: number;
  gate: string;
  event: string;
}

export function OperationsPanel() {
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
      const activeIdxs = GATES.map((g, i) => (g.status === "active" ? i : -1)).filter(
        (i) => i !== -1
      );
      const target = activeIdxs[Math.floor(Math.random() * activeIdxs.length)];
      setCounts((prev) => prev.map((c, i) => (i === target ? c + 1 : c)));
      setPulseIndex(target);
      setTimeout(() => setPulseIndex(null), 900);

      id += 1;
      const gate =
        ACTIVITY_GATE_IDS[Math.floor(Math.random() * ACTIVITY_GATE_IDS.length)];
      const event =
        ACTIVITY_EVENTS[Math.floor(Math.random() * ACTIVITY_EVENTS.length)];
      setLog((prev) => [...prev.slice(-2), { id, gate, event }]);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const total = counts.reduce((sum, c) => sum + c, 0);

  return (
    <div className="relative w-full max-w-2xl border border-steel-800 bg-surface shadow-[0_0_120px_-20px_rgba(47,92,255,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-signal-soft to-transparent animate-sweep" />
      </div>

      <div className="relative flex items-center justify-between px-6 py-4 border-b border-steel-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-signal" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-steel-300">
            Live Operations
          </span>
        </div>
        <span className="font-mono text-xs text-steel-500 tabular-nums">
          {clock} IST
        </span>
      </div>

      <div className="relative">
        {GATES.map((gate, i) => (
          <div
            key={gate.id}
            className={`flex items-center justify-between px-6 py-4 border-b border-steel-800 last:border-b-0 transition-colors duration-500 ${
              pulseIndex === i ? "bg-signal-dim/50" : ""
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  gate.status === "active" ? "bg-signal" : "bg-steel-700"
                }`}
              />
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-steel-500 tracking-widest">
                  {gate.id}
                </div>
                <div className="font-body text-base text-bone truncate">
                  {gate.name}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-base text-bone tabular-nums">
                {String(counts[i]).padStart(4, "0")}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
                {gate.status === "active" ? "Active" : "Standby"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative border-b border-steel-800 bg-void/60 px-6 py-3.5 space-y-1.5">
        {log.map((line) => (
          <div
            key={line.id}
            className="flex items-center gap-3 font-mono text-[11px] text-steel-500 animate-fade-up"
          >
            <span className="text-steel-700">›</span>
            <span className="text-steel-400">{line.gate}</span>
            <span>{line.event}</span>
          </div>
        ))}
      </div>

      <div className="relative flex items-center justify-between px-6 py-5 bg-void">
        <span className="font-mono text-xs uppercase tracking-widest text-steel-300">
          Total Entries
        </span>
        <span className="font-mono text-2xl text-bone tabular-nums">
          {String(total).padStart(4, "0")}
        </span>
      </div>
    </div>
  );
}
