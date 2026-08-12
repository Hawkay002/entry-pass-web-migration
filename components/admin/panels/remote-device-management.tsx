// components/admin/panels/remote-device-management.tsx — role cards → staff modal
// → lock/unlock flow + batch edit/delete.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Lock, LockOpen, Search, Pencil, MoreVertical, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { applyRemoteLocks, unlockStaff } from "@/app/actions/admin";
import { updateStaffInRole, removeStaffFromRole } from "@/app/actions/roles";
import { useRoles } from "@/hooks/use-roles";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import { useLockDashboard } from "@/hooks/use-lock-dashboard";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import type { LockReasonType, StaffRole, TabName } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOCKABLE_TABS: { value: TabName; label: string }[] = [
  { value: "create", label: "Issue Ticket Tab" },
  { value: "booked", label: "Guest List Tab" },
  { value: "scanner", label: "Scanner Tab" },
];

export function RemoteDeviceManagement() {
  const { roles, loading } = useRoles();
  const [activeRole, setActiveRole] = useState<StaffRole | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set()); // keyed by email
  const [lockedTabs, setLockedTabs] = useState<Set<TabName>>(new Set());
  const [reason, setReason] = useState<LockReasonType>("basic");

  // Real-time lock status from global_locks collection (shared with Maintenance panel).
  const { lockMap } = useLockDashboard();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [lockFilter, setLockFilter] = useState<"all" | "free" | "locked">("all");
  const [lockConfigOpen, setLockConfigOpen] = useState(false);
  // Edit/delete batch state
  const [editBatch, setEditBatch] = useState<Array<{ roleId: string; oldEmail: string; name: string; email: string; gateId: string | null }>>([]);
  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { settings: rdmSettings } = useSettings();
  const { gates: rdmGates } = useGatesMode();
  const rdmMultiGate = Boolean(rdmSettings.multiGate);

  function openRole(role: StaffRole) {
    setActiveRole(role);
    setSelectedStaff(new Set());
    setLockedTabs(new Set());
    setReason("basic");
    setStaffSearch("");
  }

  function toggleStaff(email: string) {
    setSelectedStaff((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);

      // If selecting a single staff, pre-populate checkboxes with their current locks.
      if (!next.has(email)) {
        // Deselecting — if no staff left, clear checkboxes.
        if (next.size === 0) setLockedTabs(new Set());
        return next;
      }

      // Selecting — populate checkboxes from this staff's current locks.
      const staffLocks = lockMap[email.toLowerCase()] ?? [];
      const lockSet = new Set<TabName>();
      staffLocks.forEach((t) => lockSet.add(t as TabName));

      // If multiple staff selected, intersect (show only tabs locked for ALL).
      if (next.size > 1) {
        next.forEach((e) => {
          const l = lockMap[e.toLowerCase()] ?? [];
          // Keep only tabs that are in BOTH sets.
          for (const tab of [...lockSet]) {
            if (!l.includes(tab)) lockSet.delete(tab);
          }
        });
      }

      setLockedTabs(lockSet);
      return next;
    });
  }

  function toggleTab(tab: TabName) {
    setLockedTabs((prev) => {
      const next = new Set(prev);
      next.has(tab) ? next.delete(tab) : next.add(tab);
      return next;
    });
  }

  // Build the edit batch from selected staff across all roles.
  function openEditBatch() {
    if (!activeRole || selectedStaff.size === 0) return;
    const batch: Array<{ roleId: string; oldEmail: string; name: string; email: string; gateId: string | null }> = [];
    for (const email of selectedStaff) {
      const member = activeRole.staff.find((s) => s.email === email);
      if (member) {
        batch.push({
          roleId: activeRole.id,
          oldEmail: email,
          name: member.name,
          email: member.email,
          gateId: member.gateId ?? null,
        });
      }
    }
    setEditBatch(batch);
    setEditBatchOpen(true);
  }

  async function handleSaveEditBatch() {
    setEditSaving(true);
    let updated = 0;
    for (const item of editBatch) {
      const res = await updateStaffInRole(
        item.roleId,
        item.oldEmail,
        item.name,
        item.email,
        rdmMultiGate ? item.gateId : null
      );
      if (res.ok) updated++;
    }
    setEditSaving(false);
    if (updated > 0) toast.success(`${updated} staff member(s) updated`);
    setEditBatchOpen(false);
    setEditBatch([]);
  }

  async function handleDeleteBatch() {
    if (!activeRole || selectedStaff.size === 0) return;
    setDeleting(true);
    let removed = 0;
    for (const email of selectedStaff) {
      const res = await removeStaffFromRole(activeRole.id, email);
      if (res.ok) removed++;
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    if (removed > 0) {
      toast.success(`${removed} staff member(s) removed`);
      setSelectedStaff(new Set());
    }
  }

  async function confirmLock() {
    const role = activeRole;
    if (!role || selectedStaff.size === 0) return;
    setLocking(true);

    let success = 0;
    for (const email of selectedStaff) {
      const staffMember = role.staff.find((s) => s.email === email);
      const targetName = staffMember?.name ?? email;
      const res = await applyRemoteLocks({
        targetEmail: email,
        usernames: [targetName],
        lockedTabs: [...lockedTabs],
        reason,
        duration: null,
      });
      if (res.ok) success++;
    }

    setLocking(false);
    setConfirmOpen(false);
    if (success > 0) {
      toast.success(`Locked ${lockedTabs.size} tab(s) for ${success} staff`);
    } else {
      toast.error("Lock failed");
    }
    setSelectedStaff(new Set());
    setLockedTabs(new Set());
  }

  /** Unlock — removes unchecked tabs from the lock. Keeps checked tabs locked.
   *  If ALL tabs unchecked → full unlock (deletes entry). */
  async function unlockSelected() {
    const role = activeRole;
    if (!role || selectedStaff.size === 0) return;
    setUnlocking(true);

    let success = 0;
    let errors = 0;
    for (const email of selectedStaff) {
      const staffMember = role.staff.find((s) => s.email === email);
      const targetName = staffMember?.name ?? email;
      try {
        if (lockedTabs.size === 0) {
          // No tabs checked → full unlock.
          const res = await unlockStaff({ targetEmail: email, username: targetName });
          if (res.ok) success++;
          else errors++;
        } else {
          // Keep only the checked tabs locked (removes unchecked ones).
          const res = await applyRemoteLocks({
            targetEmail: email,
            usernames: [targetName],
            lockedTabs: [...lockedTabs],
            reason: "basic",
            duration: null,
          });
          if (res.ok) success++;
          else errors++;
        }
      } catch {
        errors++;
      }
    }

    setUnlocking(false);
    if (success > 0 && errors === 0) {
      const removed = LOCKABLE_TABS.length - lockedTabs.size;
      toast.success(
        lockedTabs.size === 0
          ? `Fully unlocked ${success} staff`
          : `Removed ${removed} tab(s), kept ${lockedTabs.size} locked`
      );
    } else if (errors > 0) {
      toast.error(`Unlocked ${success}, ${errors} failed`);
    }
    setSelectedStaff(new Set());
    setLockedTabs(new Set());
  }

  const lockedCount = Object.values(lockMap).filter((tabs) => tabs.length > 0).length;

  return (
    <>
    <CollapsibleSection
      icon={<MonitorSmartphone className="h-4 w-4" />}
      title="Remote Device Management"
      badge={
        !loading && lockedCount > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-destructive">
            <Lock className="h-2.5 w-2.5" />
            {lockedCount} locked
          </span>
        ) : null
      }
    >
    <div className="space-y-4 px-6 py-5">
      <p className="mb-4 text-xs text-muted-foreground">
        Click a role to select staff and lock their tabs.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roles found. Create roles in Role Management above.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => openRole(role)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                activeRole?.id === role.id
                  ? "border-accent-secondary bg-accent-secondary/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-sm font-medium">{role.name}</p>
              <p className="text-xs text-muted-foreground">{role.staff.length} staff</p>
            </button>
          ))}
        </div>
      )}

      {/* Staff selection + lock modal */}
      <Dialog open={!!activeRole} onOpenChange={(o) => !o && setActiveRole(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{activeRole?.name} — Select Staff</DialogTitle>
            <DialogDescription>
              Click names to select/deselect. Then configure restricted tabs below.
            </DialogDescription>
          </DialogHeader>

          {activeRole && activeRole.staff.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No staff in this role. Add them in Role Management.
            </p>
          ) : (
            <>
              {/* Search + filter row */}
              <div className="mb-2 flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex shrink-0 gap-1">
                  {(["all", "free", "locked"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setLockFilter(f)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                        lockFilter === f
                          ? "bg-white text-black"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select All checkbox + Actions overflow */}
              {(() => {
                const filtered = activeRole?.staff.filter((s) => {
                  if (!staffSearch.trim()) return true;
                  const term = staffSearch.toLowerCase();
                  return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term);
                }).filter((s) => {
                  const tabs = lockMap[s.email.toLowerCase()] ?? [];
                  if (lockFilter === "free") return tabs.length === 0;
                  if (lockFilter === "locked") return tabs.length > 0;
                  return true;
                }) ?? [];
                const allSelected = filtered.length > 0 && filtered.every((s) => selectedStaff.has(s.email));
                return (
                  <div className="mb-1 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => {
                          setSelectedStaff((prev) => {
                            const next = new Set(prev);
                            if (allSelected) {
                              filtered.forEach((s) => next.delete(s.email));
                            } else {
                              filtered.forEach((s) => next.add(s.email));
                            }
                            return next;
                          });
                        }}
                      />
                      Select All
                    </label>
                    {selectedStaff.size > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditBatch()}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteConfirmOpen(true)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })()}

              {/* Staff table */}
              <div className="max-h-[440px] space-y-1.5 overflow-y-auto overflow-x-visible px-2 py-1 scrollbar-thin md:max-h-[360px]">
                {activeRole?.staff
                  .filter((s) => {
                    if (!staffSearch.trim()) return true;
                    const term = staffSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(term) ||
                      s.email.toLowerCase().includes(term)
                    );
                  })
                  .filter((s) => {
                    const tabs = lockMap[s.email.toLowerCase()] ?? [];
                    if (lockFilter === "free") return tabs.length === 0;
                    if (lockFilter === "locked") return tabs.length > 0;
                    return true;
                  })
                  .map((s) => {
                  const sel = selectedStaff.has(s.email);
                  const staffLocks = lockMap[s.email.toLowerCase()] ?? lockMap[s.email] ?? [];
                  const isLocked = staffLocks.length > 0;
                  return (
                    <button
                      key={s.email}
                      onClick={() => toggleStaff(s.email)}
                      className={cn(
                        "grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        sel
                          ? "bg-accent-secondary/20 ring-1 ring-accent-secondary"
                          : "bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <span className={cn("flex items-center gap-1.5 font-medium", sel && "text-accent-secondary")}>
                        {s.name}
                      </span>
                      <span className="truncate text-muted-foreground">{s.email}</span>
                      {isLocked ? (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-[0.65rem] font-medium text-destructive">
                          <Lock className="h-2.5 w-2.5" />
                          {staffLocks.length} locked
                        </span>
                      ) : (
                        <span className="rounded-full bg-success-green/10 px-2 py-0.5 text-[0.65rem] text-success-green">
                          Free
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action bar */}
              {selectedStaff.size > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <p className="text-sm text-muted-foreground">
                    {selectedStaff.size} selected
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setLockConfigOpen(true)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm lock dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Lock</DialogTitle>
            <DialogDescription>
              Target: {selectedStaff.size} staff from {activeRole?.name}.{" "}
              {lockedTabs.size} tab(s) restricted. Reason: {reason}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={locking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLock} disabled={locking}>
              {locking && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Sync &amp; Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock config modal — restrict tabs + reason, opened by Next button */}
      <Dialog open={lockConfigOpen} onOpenChange={setLockConfigOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Lock Configuration</DialogTitle>
            <DialogDescription>
              {selectedStaff.size} staff selected from {activeRole?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Restrict Tabs
              </h5>
              <div className="space-y-2">
                {LOCKABLE_TABS.map((tab) => {
                  const selectedEmails = [...selectedStaff];
                  const lockedByAll = selectedEmails.every((email) => {
                    const tabs = lockMap[email.toLowerCase()] ?? [];
                    return tabs.includes(tab.value);
                  });
                  return (
                    <label
                      key={tab.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors",
                        lockedByAll && "bg-destructive/10"
                      )}
                    >
                      <Checkbox
                        checked={lockedTabs.has(tab.value)}
                        onCheckedChange={() => toggleTab(tab.value)}
                      />
                      <span>{tab.label}</span>
                      {lockedByAll && (
                        <span className="ml-auto text-[0.65rem] font-medium text-destructive">
                          <Lock className="mr-1 inline h-2.5 w-2.5" />
                          Locked
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lock Reason
              </h5>
              <RadioGroup
                value={reason}
                onValueChange={(v) => setReason((v ?? "basic") as LockReasonType)}
                className="flex gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="basic" /> Basic
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="suspension" /> Review
                </label>
              </RadioGroup>
            </div>
          </div>

          {/* Unlock instructions */}
          <div className="flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs text-muted-foreground">
            <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-green" />
            <span>
              To unlock a specific tab, uncheck it above then click Unlock.
              To fully unlock all tabs, uncheck everything and click Unlock.
            </span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLockConfigOpen(false)}>
              Back
            </Button>
            <Button
              variant="outline"
              className="border-success-green text-success-green hover:bg-success-green/10"
              disabled={unlocking}
              onClick={() => {
                setLockConfigOpen(false);
                unlockSelected();
              }}
            >
              {unlocking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <LockOpen className="mr-1.5 h-3.5 w-3.5" />
              )}
              Unlock
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLockConfigOpen(false);
                setConfirmOpen(true);
              }}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Sync &amp; Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit batch dialog — lists each selected staff vertically */}
      <Dialog open={editBatchOpen} onOpenChange={(o) => { setEditBatchOpen(o); if (!o) setEditBatch([]); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editBatch.length} Staff Member{editBatch.length !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto scrollbar-thin pr-1">
            {editBatch.map((item, idx) => (
              <div key={item.oldEmail} className="space-y-2 rounded-lg border border-white/8 p-3">
                <p className="text-xs text-muted-foreground">Staff #{idx + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => setEditBatch((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={item.email}
                      onChange={(e) => setEditBatch((p) => p.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                {rdmMultiGate && (
                  <div className="space-y-1">
                    <Label className="text-xs">Gate</Label>
                    <Select value={item.gateId ?? "none"} onValueChange={(v) => setEditBatch((p) => p.map((x, i) => i === idx ? { ...x, gateId: v === "none" ? null : v } : x))}>
                      <SelectTrigger className="h-8 text-sm">
                        <span>
                          {item.gateId
                            ? (rdmGates.find((g) => g.id === item.gateId)?.name ?? item.gateId)
                            : "No gate assigned"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No gate assigned</SelectItem>
                        {rdmGates.filter((g) => g.active).map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditBatchOpen(false); setEditBatch([]); }}>Cancel</Button>
            <Button onClick={handleSaveEditBatch} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete batch confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove {selectedStaff.size} Staff Member{selectedStaff.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              Remove the selected staff from <strong>{activeRole?.name}</strong>?
              Any staff not in another role will be immediately logged out and lose all access.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteBatch} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove & Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </CollapsibleSection>
    </>
  );
}
