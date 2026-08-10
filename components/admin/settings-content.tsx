// components/admin/settings-content.tsx — client wrapper that checks if
// the settings tab is locked before rendering.
// Admins get the full form + admin panels. Staff see only the Configuration
// heading + read-only Active Settings.

"use client";

import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPanels } from "@/components/admin/admin-panels";
import { LockedTab } from "@/components/layout/locked-tab";
import { useLockedTabs } from "@/components/layout/locked-tabs-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import { getTzLabel } from "@/lib/timezones";
import { DeadlineCountdown } from "@/components/admin/settings-form";

export function SettingsContent({ isAdmin }: { isAdmin: boolean }) {
  const lockedTabs = useLockedTabs();

  if (!isAdmin && lockedTabs.includes("settings")) {
    return <LockedTab tabName="Configuration" />;
  }

  // Staff: read-only view — heading + active settings only.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <StaffSettingsView />
      </div>
    );
  }

  // Admin: full form + admin panels.
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <SettingsForm isAdmin />
      <AdminPanels />
    </div>
  );
}

/** Read-only settings display for staff. */
function StaffSettingsView() {
  const { settings, loading } = useSettings();

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="rounded-xl bg-black/30 p-4">
            <h4 className="mb-2 text-sm font-semibold text-white">Active Settings</h4>
            <p className="text-sm text-muted-foreground">
              <strong>Event:</strong>{" "}
              <span className="text-white">{settings.name || "—"}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Venue:</strong>{" "}
              <span className="text-white">{settings.place || "—"}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Time:</strong>{" "}
              <span className="text-white">
                {settings.deadline
                  ? new Date(settings.deadline).toLocaleString()
                  : "—"}
              </span>
              {settings.timezone && settings.timezone !== "auto" && (
                <span className="text-white">
                  {" "}({getTzLabel(settings.timezone) ?? `UTC${settings.timezone}`})
                </span>
              )}
            </p>
            {settings.deadline && <DeadlineCountdown deadline={settings.deadline} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
