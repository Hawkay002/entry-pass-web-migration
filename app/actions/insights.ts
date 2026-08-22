// app/actions/insights.ts — aggregated analytics for the Insights page.
// Admin-only. All math happens server-side; the page gets ready-to-chart
// arrays so no raw ticket data crosses the wire twice.

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";

export interface InsightsCurvePoint {
  /** Bucket start (ms epoch). */
  t: number;
  count: number;
}

export interface InsightsGroup {
  label: string;
  total: number;
  arrived: number;
}

export interface InsightsData {
  generatedAt: number;
  totals: { total: number; arrived: number; pending: number; absent: number };
  /** Scans bucketed into 15-minute windows (arrivals over time). */
  curve: InsightsCurvePoint[];
  /** Busiest 15-minute window label, e.g. "18:45". */
  peak: { label: string; count: number } | null;
  gates: InsightsGroup[];
  tiers: InsightsGroup[];
  staff: Array<{ name: string; scans: number }>;
}

const BUCKET_MS = 15 * 60 * 1000;

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function fetchInsights(): Promise<
  { ok: true; data: InsightsData } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Not authorized." };

  const pb = await pbAdmin();
  const tickets = await pb.collection(paths.ticketsCollection).getFullList({
    fields: "id,status,ticketType,gate,scanned,scannedAt",
  });
  const gates = await pb.collection(paths.gatesCollection).getFullList({ fields: "id,name" });
  const gateName = new Map(gates.map((g) => [g.id, g.name]));

  let logs: Array<{ username: string }> = [];
  try {
    logs = await pb.collection(paths.logsCollection).getFullList({
      filter: 'action = "SCAN_ENTRY" || action = "SELF_CHECKIN"',
      fields: "username",
    });
  } catch {
    // Logs unavailable — staff counts stay empty, everything else still works.
  }

  // Totals
  const total = tickets.length;
  const arrived = tickets.filter((t) => t.status === "arrived").length;
  const pending = tickets.filter((t) => t.status === "coming-soon").length;
  const absent = tickets.filter((t) => t.status === "absent").length;

  // Arrival curve (15-min buckets over scannedAt)
  const bucket = new Map<number, number>();
  for (const t of tickets) {
    const ts = Number(t.scannedAt ?? 0);
    if (!ts) continue;
    const b = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
    bucket.set(b, (bucket.get(b) ?? 0) + 1);
  }
  const curve: InsightsCurvePoint[] = [...bucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, count]) => ({ t, count }));
  const peakEntry = curve.reduce<InsightsCurvePoint | null>(
    (max, p) => (!max || p.count > max.count ? p : max),
    null
  );
  const peak = peakEntry && peakEntry.count > 0 ? { label: hhmm(peakEntry.t), count: peakEntry.count } : null;

  // Group helper
  const group = (keyOf: (t: (typeof tickets)[number]) => string): InsightsGroup[] => {
    const m = new Map<string, InsightsGroup>();
    for (const t of tickets) {
      const k = keyOf(t) || "Unassigned";
      const g = m.get(k) ?? { label: k, total: 0, arrived: 0 };
      g.total += 1;
      if (t.status === "arrived") g.arrived += 1;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  const gatesData = group((t) => (t.gate ? gateName.get(t.gate) ?? t.gate.slice(0, 8) : "No gate"));
  const tiersData = group((t) => String(t.ticketType ?? "Classic"));

  // Scans per staff (from activity logs)
  const staffMap = new Map<string, number>();
  for (const l of logs) {
    const n = String(l.username ?? "").trim() || "Unknown";
    staffMap.set(n, (staffMap.get(n) ?? 0) + 1);
  }
  const staff = [...staffMap.entries()]
    .map(([name, scans]) => ({ name, scans }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 10);

  const data: InsightsData = {
    generatedAt: Date.now(),
    totals: { total, arrived, pending, absent },
    curve,
    peak,
    gates: gatesData,
    tiers: tiersData,
    staff,
  };
  return { ok: true, data };
}
