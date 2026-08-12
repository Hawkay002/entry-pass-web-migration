// components/admin/admin-panels.tsx — admin-only section shell.
// Each panel lives in its own file under ./panels/. The order here mirrors
// the original layout: 2FA, Kiosks, Maintenance, Roles, RDM inside the glass
// panel; Factory Reset as a standalone Danger Zone card below.

"use client";

import { TwoFactorPanel } from "@/components/admin/panels/two-factor-panel";
import { KioskPanel } from "@/components/admin/panels/kiosk-panel";
import { MaintenancePanel } from "@/components/admin/panels/maintenance-panel";
import { RoleManagementPanel } from "@/components/admin/panels/role-management-panel";
import { RemoteDeviceManagement } from "@/components/admin/panels/remote-device-management";
import { FactoryResetPanel } from "@/components/admin/panels/factory-reset-panel";

export function AdminPanels() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />
        <h3 className="text-lg font-semibold">
          <span className="rounded-lg bg-black/40 px-4 py-1.5">Admin Panel</span>
        </h3>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="glass-panel overflow-hidden">
        <TwoFactorPanel />
      </div>
      <div className="glass-panel overflow-hidden">
        <KioskPanel />
      </div>
      <div className="glass-panel overflow-hidden">
        <MaintenancePanel />
      </div>
      <div className="glass-panel overflow-hidden">
        <RoleManagementPanel />
      </div>
      <div className="glass-panel overflow-hidden">
        <RemoteDeviceManagement />
      </div>
      <div className="mt-3">
        <div className="mb-3 flex items-center gap-4">
          <div className="h-px flex-1 bg-destructive/20" />
          <h3 className="text-lg font-semibold">
            <span className="rounded-lg bg-black/40 px-4 py-1.5 text-destructive">Danger Zone</span>
          </h3>
          <div className="h-px flex-1 bg-destructive/20" />
        </div>
        <FactoryResetPanel />
      </div>
    </div>
  );
}
