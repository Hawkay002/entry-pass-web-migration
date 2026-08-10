// components/admin/settings-content.tsx — client wrapper that checks if
// the settings tab is locked before rendering the form + admin panels.

"use client";

import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPanels } from "@/components/admin/admin-panels";
import { LockedTab } from "@/components/layout/locked-tab";
import { useLockedTabs } from "@/components/layout/locked-tabs-context";

export function SettingsContent({ isAdmin }: { isAdmin: boolean }) {
  const lockedTabs = useLockedTabs();

  if (!isAdmin && lockedTabs.includes("settings")) {
    return <LockedTab tabName="Configuration" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <SettingsForm isAdmin={isAdmin} />
      {isAdmin && <AdminPanels />}
    </div>
  );
}
