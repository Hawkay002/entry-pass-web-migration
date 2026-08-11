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
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/hooks/use-settings";
import { getTzLabel } from "@/lib/timezones";
import { DeadlineCountdown } from "@/components/admin/settings-form";
import { MapPin, Clock, Sparkles, DoorOpen } from "lucide-react";

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
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-secondary/5 blur-2xl" />

            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-secondary" />
              <h4 className="text-sm font-semibold tracking-tight text-white">Active Settings</h4>
            </div>

            {/* Event name — the hero */}
            {settings.name && (
              <p className="mb-4 text-2xl font-bold tracking-tight text-white">
                {settings.name}
              </p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-xl bg-black/30 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-secondary/10">
                  <MapPin className="h-4 w-4 text-accent-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Venue</p>
                  <p className="truncate text-sm font-medium text-white">{settings.place || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-black/30 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-secondary/10">
                  <Clock className="h-4 w-4 text-accent-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Deadline</p>
                  <p className="truncate text-sm font-medium text-white">
                    {settings.deadline
                      ? new Date(settings.deadline).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Badges */}
            {(settings.timezone || settings.multiGate) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.timezone && settings.timezone !== "auto" && (
                  <Badge variant="outline" className="gap-1 text-[0.65rem] font-normal text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {getTzLabel(settings.timezone) ?? `UTC${settings.timezone}`}
                  </Badge>
                )}
                {settings.multiGate && (
                  <Badge variant="outline" className="gap-1 border-accent-secondary/30 text-[0.65rem] font-normal text-accent-secondary">
                    <DoorOpen className="h-2.5 w-2.5" />
                    Multi-Gate Active
                  </Badge>
                )}
              </div>
            )}

            {settings.deadline && <DeadlineCountdown deadline={settings.deadline} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
