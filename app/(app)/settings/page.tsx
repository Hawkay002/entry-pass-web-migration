// app/(app)/settings/page.tsx — Configuration (event settings form +
// live display). Admin sees the Remote Lock + Staff management panels below.
// Staff with settings locked see a locked screen instead.

import { getAppUser } from "@/lib/pb/server-auth";
import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPanels } from "@/components/admin/admin-panels";
import { SettingsContent } from "@/components/admin/settings-content";

export default async function SettingsPage() {
  const user = await getAppUser();
  const isAdmin = user?.role === "admin";

  return <SettingsContent isAdmin={isAdmin} />;
}
