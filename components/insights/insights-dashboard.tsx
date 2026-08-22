// components/insights/insights-dashboard.tsx — full-page event analytics.
// Admin-only (page-level guard). Live: auto-polls every 30s. Post-event:
// Download Report builds a CSV summary client-side.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchInsights, type InsightsData } from "@/app/actions/insights";
import { playSfx, playToastSfx } from "@/lib/sfx";
import { toast } from "sonner";

const TIER_COLORS = ["#f59e0b", "#bf953f", "#94a3b8", "#3b82f6", "#8b5cf6"];

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function InsightsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const res = await fetchInsights();
    if (res.ok) setData(res.data);
    if (firstLoad.current) {
      firstLoad.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000); // live: 30s auto-poll (silent)
    return () => clearInterval(i);
  }, [load]);

  function handleRefresh() {
    if (refreshing) return;
    playSfx("select");
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  function handleDownload() {
    if (!data) return;
    playSfx("select");
    try {
      const lines: string[] = [];
      lines.push("Entry Pass — Event Insights Report");
      lines.push(`Generated,${new Date(data.generatedAt).toLocaleString()}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(`Total guests,${data.totals.total}`);
      lines.push(`Arrived,${data.totals.arrived}`);
      lines.push(`Pending,${data.totals.pending}`);
      lines.push(`Absent,${data.totals.absent}`);
      if (data.totals.total > 0) {
        lines.push(`Show rate,${Math.round((data.totals.arrived / data.totals.total) * 100)}%`);
      }
      if (data.peak) lines.push(`Peak arrival window,${data.peak.label} (${data.peak.count} in 15 min)`);
      lines.push("");
      lines.push("GATES,gate,total,arrived");
      for (const g of data.gates) lines.push(`,${g.label},${g.total},${g.arrived}`);
      lines.push("");
      lines.push("TICKET TIERS,tier,total,arrived");
      for (const t of data.tiers) lines.push(`,${t.label},${t.total},${t.arrived}`);
      lines.push("");
      lines.push("STAFF SCANS,staff,scans");
      for (const s of data.staff) lines.push(`,${s.name},${s.scans}`);
      lines.push("");
      lines.push("ARRIVAL CURVE,window,check-ins");
      for (const p of data.curve) lines.push(`,${hhmm(p.t)},${p.count}`);

      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `event-insights-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      playSfx("success");
      playToastSfx();
      toast.success("Report downloaded");
    } catch {
      playSfx("error");
      toast.error("Could not build the report");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] p-4 text-center">
        <p className="text-sm text-muted-foreground">Could not load insights.</p>
        <Button variant="outline" onClick={() => router.push("/tickets")}>Back to app</Button>
      </div>
    );
  }

  const curveData = data.curve.map((p) => ({ time: hhmm(p.t), count: p.count }));
  const showRate = data.totals.total > 0 ? Math.round((data.totals.arrived / data.totals.total) * 100) : 0;

  const curveConfig = { count: { label: "Check-ins", color: "#10b981" } } satisfies ChartConfig;
  const gateConfig = { arrived: { label: "Arrived", color: "#10b981" } } satisfies ChartConfig;
  const tierConfig = { total: { label: "Guests" } } satisfies ChartConfig;
  const staffConfig = { scans: { label: "Scans", color: "#3b82f6" } } satisfies ChartConfig;

  const stats = [
    { label: "Total Guests", value: String(data.totals.total), accent: "text-white" },
    { label: "Arrived", value: String(data.totals.arrived), accent: "text-success-green" },
    { label: "Show Rate", value: `${showRate}%`, accent: "text-accent-secondary" },
    { label: "Pending", value: String(data.totals.pending), accent: "text-amber-400" },
    { label: "Absent", value: String(data.totals.absent), accent: "text-destructive" },
    {
      label: "Peak Window",
      value: data.peak ? `${data.peak.label}` : "—",
      sub: data.peak ? `${data.peak.count} in 15 min` : "no scans yet",
      accent: "text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: '"The Seasons", serif' }}>
              Event Insights
            </h1>
            <p className="text-sm text-muted-foreground">
              Live overview — auto-refreshes every 30s.
              {" "}Last updated {new Date(data.generatedAt).toLocaleTimeString()}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("back"); router.push("/tickets"); }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to App
            </Button>
            <Button
              variant="outline"
              data-sfx-own=""
              disabled={refreshing}
              onMouseEnter={() => { if (!refreshing) playSfx("hover"); }}
              onClick={handleRefresh}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" /> Download Report
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} className="glass-panel">
              <CardContent className="p-4">
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={`mt-1 text-2xl font-bold ${s.accent}`}>{s.value}</p>
                {s.sub && <p className="text-[0.65rem] text-muted-foreground">{s.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Arrival curve */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Arrivals Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {curveData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No scans yet — the curve appears once check-ins start.
              </p>
            ) : (
              <ChartContainer config={curveConfig} className="h-[260px] w-full">
                <AreaChart data={curveData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="count" stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Gates + tiers */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Gate Load</CardTitle>
            </CardHeader>
            <CardContent>
              {data.gates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No tickets yet.</p>
              ) : (
                <ChartContainer config={gateConfig} className="h-[220px] w-full">
                  <BarChart data={data.gates} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="arrived" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Ticket Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tiers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No tickets yet.</p>
              ) : (
                <div className="flex h-[220px] items-center">
                  <ChartContainer config={tierConfig} className="h-full w-1/2">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={data.tiers} dataKey="total" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {data.tiers.map((_, i) => (
                          <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="w-1/2 space-y-2 pl-2">
                    {data.tiers.map((t, i) => (
                      <li key={t.label} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: TIER_COLORS[i % TIER_COLORS.length] }}
                        />
                        <span className="flex-1 truncate text-muted-foreground">{t.label}</span>
                        <span className="font-medium text-white">{t.arrived}/{t.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff scans */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Scans per Staff</CardTitle>
          </CardHeader>
          <CardContent>
            {data.staff.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No scans logged yet.</p>
            ) : (
              <ChartContainer config={staffConfig} className="h-[220px] w-full">
                <BarChart data={data.staff} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="scans" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
