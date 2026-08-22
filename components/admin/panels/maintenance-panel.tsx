// components/admin/panels/maintenance-panel.tsx — locks ALL roles at once.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, LockOpen, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyRemoteLocks, unlockStaff } from "@/app/actions/admin";
import { useRoles } from "@/hooks/use-roles";
import { useLockDashboard } from "@/hooks/use-lock-dashboard";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { playSfx, playToastSfx, startProcessingSfx, stopProcessingSfx } from "@/lib/sfx";

export function MaintenancePanel() {
  const { roles } = useRoles();
  const { maintActive, maintDuration } = useLockDashboard();
  const [open, setOpen] = useState(false);
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [applying, setApplying] = useState(false);

  async function startMaintenance() {
    setApplying(true);
    startProcessingSfx();
    const h = Number(hrs) || 0;
    const m = Number(mins) || 0;
    let duration = "Unknown";
    if (h > 0 || m > 0) {
      duration = "";
      if (h > 0) duration += `${h} hr `;
      if (m > 0) duration += `${m} min`;
      duration = duration.trim();
    }

    // Lock ALL tabs for ALL staff across ALL roles
    for (const role of roles) {
      for (const staff of role.staff) {
        await applyRemoteLocks({
          targetEmail: staff.email,
          usernames: [staff.name],
          lockedTabs: ["create", "booked", "scanner", "settings"],
          reason: "maintenance",
          duration,
        });
      }
    }

    setApplying(false);
    stopProcessingSfx();
    playSfx("lock");
    playToastSfx();
    setOpen(false);
    toast.success(`Maintenance mode activated for all staff (${roles.reduce((n, r) => n + r.staff.length, 0)} total)`);
  }

  async function endMaintenance() {
    setApplying(true);
    startProcessingSfx();
    // Unlock ALL staff across ALL roles
    for (const role of roles) {
      for (const staff of role.staff) {
        await unlockStaff({ targetEmail: staff.email, username: staff.name });
      }
    }
    setApplying(false);
    stopProcessingSfx();
    playSfx("unlock");
    playToastSfx();
    toast.success("Maintenance mode ended — all staff unlocked");
  }

  const maintBadge = maintActive ? (
    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Active
    </span>
  ) : null;

  return (
    <>
    <CollapsibleSection
      icon={<OctagonAlert className="h-4 w-4" />}
      title="Maintenance Mode"
      badge={maintBadge}
      defaultOpen={maintActive}
    >
    <div className="space-y-4 px-6 py-5">
      <p className="mb-4 text-xs text-muted-foreground">
        Locks all tabs for all staff across all roles simultaneously.
      </p>

      {maintActive && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm text-amber-500">
            Maintenance Active
            {maintDuration && maintDuration !== "Unknown" && (
              <span className="ml-1 text-muted-foreground">— Est. {maintDuration}</span>
            )}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          data-sfx-own=""
          className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
          onMouseEnter={() => playSfx("hover")}
          onClick={() => { playSfx("select"); setOpen(true); }}
        >
          <OctagonAlert className="mr-1.5 h-3.5 w-3.5" />
          Start Maintenance
        </Button>
        <Button
          variant="outline"
          data-sfx-own=""
          className="border-success-green text-success-green hover:bg-success-green/10"
          disabled={applying}
          onMouseEnter={() => { if (!applying) playSfx("hover"); }}
          onClick={() => { if (!applying) { playSfx("unlock"); endMaintenance(); } }}
        >
          {applying ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <LockOpen className="mr-1.5 h-3.5 w-3.5" />
          )}
          End Maintenance
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Maintenance Mode</DialogTitle>
            <DialogDescription>
              This will lock ALL tabs for ALL staff ({roles.reduce((n, r) => n + r.staff.length, 0)} members).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Estimated Duration (optional)</Label>
              <div className="mt-2 flex gap-3">
                <Input type="number" min={0} placeholder="Hrs" value={hrs} onChange={(e) => setHrs(e.target.value)} />
                <Input type="number" min={0} placeholder="Mins" value={mins} onChange={(e) => setMins(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("cancel"); setOpen(false); }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              data-sfx-own=""
              className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
              disabled={applying}
              onMouseEnter={() => { if (!applying) playSfx("hover"); }}
              onClick={() => { if (!applying) { playSfx("lock"); startMaintenance(); } }}
            >
              {applying && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <OctagonAlert className="mr-1.5 h-3.5 w-3.5" />
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </CollapsibleSection>
    </>
  );
}
