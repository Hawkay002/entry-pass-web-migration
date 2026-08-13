// app/(app)/logs/page.tsx — Activity Logs (admin only).
// Server component guards role, fetches logs via Admin SDK, renders the
// client table for filter/search/select/delete.

import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/pb/server-auth";
import { fetchActivityLogs } from "@/app/actions/admin";
import { LogsTable } from "@/components/logs/logs-table";

export default async function LogsPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?reason=expired");
  if (user.role !== "admin") redirect("/tickets");

  const res = await fetchActivityLogs();
  const logs = res.ok ? res.logs : [];

  return <LogsTable initialLogs={logs} />;
}
