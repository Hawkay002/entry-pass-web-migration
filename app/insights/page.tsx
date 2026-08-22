// app/insights/page.tsx — full-page event analytics dashboard (admin-only).
// Top-level route on purpose: no app shell / tab navigation — a dedicated
// whole-page surface for event-day monitoring + the post-event report.

import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/pb/server-auth";
import { InsightsDashboard } from "@/components/insights/insights-dashboard";

export const metadata = { title: "Event Insights — Event Ticketing System" };

export default async function InsightsPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?reason=expired");
  if (user.role !== "admin") redirect("/tickets");
  return <InsightsDashboard />;
}
