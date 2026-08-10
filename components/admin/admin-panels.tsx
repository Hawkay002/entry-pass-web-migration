// components/admin/admin-panels.tsx — admin-only section: Role Management,
// Remote Device Management (role cards → staff modal → lock flow),
// and Factory Reset.

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Lock, LockOpen, Plus, X, Search, Wrench, ScanLine, ExternalLink, Eye, EyeOff, Pencil, Upload, ChevronDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  fetchRoles,
  createRole,
  addStaffToRole,
  bulkAddStaffToRole,
  updateStaffInRole,
  removeStaffFromRole,
  deleteRole,
} from "@/app/actions/roles";
import { applyRemoteLocks, factoryReset, fetchAllLocks, fetchMaintenanceInfo, checkAndEndMaintenance, unlockStaff, saveKioskPin, getKioskStatus } from "@/app/actions/admin";
import { useRoles } from "@/hooks/use-roles";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import type { LockReasonType, StaffMember, StaffRole, TabName } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fetch all global_locks via server action (admin can read all via Admin SDK).
 *  Returns a map of email → lockedTabs array. Polled every 5s for realtime.
 */
function useLockStatus() {
  const [lockMap, setLockMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetchAllLocks();
        if (active && res.ok) {
          setLockMap(res.map);
        }
      } catch {
        // ignore
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return lockMap;
}

const LOCKABLE_TABS: { value: TabName; label: string }[] = [
  { value: "create", label: "Issue Ticket Tab" },
  { value: "booked", label: "Guest List Tab" },
  { value: "scanner", label: "Scanner Tab" },
  { value: "settings", label: "Configuration Tab" },
];

export function AdminPanels() {
  return (
    <div className="border-t border-white/5 pt-8">
      <div className="glass-panel overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-semibold">Admin Panel</h3>
        </div>
        <KioskPanel />
        <MaintenancePanel />
        <RoleManagementPanel />
        <RemoteDeviceManagement />
      </div>
      <FactoryResetPanel />
    </div>
  );
}

// ============== Maintenance Mode (locks ALL roles) ==============

function MaintenancePanel() {
  const { roles } = useRoles();
  const [open, setOpen] = useState(false);
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [applying, setApplying] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{ active: boolean; duration: string | null }>({ active: false, duration: null });

  // Poll maintenance status every 5s + auto-end if duration elapsed
  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetchMaintenanceInfo();
      if (active && res.ok) {
        setMaintInfo({ active: res.active, duration: res.duration });
        if (res.active) {
          const endRes = await checkAndEndMaintenance();
          if (active && endRes.ok && endRes.ended) {
            toast.success("Maintenance time over — all staff unlocked automatically");
          }
        }
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  async function startMaintenance() {
    setApplying(true);
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
    setOpen(false);
    toast.success(`Maintenance mode activated for all staff (${roles.reduce((n, r) => n + r.staff.length, 0)} total)`);
  }

  /** Auto-end maintenance if the duration has elapsed. Called from the poll. */
  async function autoEndMaintenanceIfOver() {
    if (!maintInfo.active || applying) return;
    const res = await checkAndEndMaintenance();
    if (res.ok && res.ended) {
      toast.success("Maintenance time over — all staff unlocked automatically");
    }
  }

  async function endMaintenance() {
    setApplying(true);
    // Unlock ALL staff across ALL roles
    for (const role of roles) {
      for (const staff of role.staff) {
        await unlockStaff({ targetEmail: staff.email, username: staff.name });
      }
    }
    setApplying(false);
    toast.success("Maintenance mode ended — all staff unlocked");
  }

  return (
    <>
    <div className="mx-6 border-t border-white/10" />
    <div className="space-y-4 px-6 py-5">
      <div className="mb-1 flex items-center gap-2">
        <Wrench className="h-5 w-5 text-amber-500" />
        <h4 className="text-sm font-semibold">Maintenance Mode</h4>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Locks all tabs for all staff across all roles simultaneously.
      </p>

      {maintInfo.active && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm text-amber-500">
            Maintenance Active
            {maintInfo.duration && maintInfo.duration !== "Unknown" && (
              <span className="ml-1 text-muted-foreground">— Est. {maintInfo.duration}</span>
            )}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
          onClick={() => setOpen(true)}
        >
          <Wrench className="mr-1.5 h-3.5 w-3.5" />
          Start Maintenance
        </Button>
        <Button
          variant="outline"
          className="border-success-green text-success-green hover:bg-success-green/10"
          disabled={applying}
          onClick={endMaintenance}
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
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="outline"
              className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
              disabled={applying}
              onClick={startMaintenance}
            >
              {applying && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              <Wrench className="mr-1.5 h-3.5 w-3.5" />
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

// ============== Role Management ==============

function RoleManagementPanel() {
  const { roles, loading } = useRoles();
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);

  // Add-staff dialog state
  const [addStaffOpen, setAddStaffOpen] = useState<string | null>(null); // roleId
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [addingStaff, setAddingStaff] = useState(false);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set()); // collapsed by default
  // Bulk upload state
  const [bulkParsed, setBulkParsed] = useState<{ name: string; email: string }[]>([]);
  const [bulkAdding, setBulkAdding] = useState(false);
  // Edit staff state — moved to RemoteDeviceManagement
  const [editingStaff, setEditingStaff] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  // Gate assignment (multi-gate mode)
  const { settings } = useSettings();
  const { gates } = useGatesMode();
  const multiGate = Boolean(settings.multiGate);
  const [staffGateId, setStaffGateId] = useState<string | null>(null);

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    setCreating(true);
    const res = await createRole(newRoleName);
    setCreating(false);
    if (res.ok) {
      toast.success(`Role "${newRoleName}" created`);
      setNewRoleName("");
    } else {
      toast.error("Create failed", { description: res.error });
    }
  }

  async function handleAddStaff() {
    if (!addStaffOpen || !staffName.trim() || !staffEmail.trim()) return;
    setAddingStaff(true);
    const res = await addStaffToRole(addStaffOpen, staffName, staffEmail, multiGate ? staffGateId : null);
    setAddingStaff(false);
    if (res.ok) {
      toast.success("Staff member added");
      setStaffName("");
      setStaffEmail("");
      setStaffGateId(null);
    } else {
      toast.error("Add failed", { description: res.error });
    }
  }

  async function handleRemoveStaff(roleId: string, email: string) {
    const res = await removeStaffFromRole(roleId, email);
    if (res.ok) toast.success("Staff removed");
    else toast.error("Remove failed", { description: res.error });
  }

  async function handleDeleteRole(roleId: string) {
    const res = await deleteRole(roleId);
    if (res.ok) toast.success(`Role "${roleId}" deleted`);
    else toast.error("Delete failed", { description: res.error });
  }

  async function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let records: { name: string; email: string }[] = [];

      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim());
        // Skip header if it looks like one
        const first = lines[0].toLowerCase();
        const hasHeader = first.includes("name") || first.includes("email");
        const dataLines = hasHeader ? lines.slice(1) : lines;
        for (const line of dataLines) {
          const cells = line.split(/[,\t;|]/).map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cells.length >= 2) records.push({ name: cells[0], email: cells[1] });
        }
      } else if (ext === "json") {
        const data = JSON.parse(await file.text());
        records = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => {
          const keys = Object.keys(r);
          const nameKey = keys.find((k) => /name/i.test(k)) ?? keys[0];
          const emailKey = keys.find((k) => /email|mail/i.test(k)) ?? keys[1];
          return { name: String(r[nameKey] ?? ""), email: String(r[emailKey] ?? "") };
        });
      } else if (ext === "xlsx") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        records = rows.map((r) => {
          const keys = Object.keys(r);
          const nameKey = keys.find((k) => /name/i.test(k)) ?? keys[0];
          const emailKey = keys.find((k) => /email|mail/i.test(k)) ?? keys[1];
          return { name: String(r[nameKey] ?? ""), email: String(r[emailKey] ?? "") };
        });
      }

      const valid = records.filter((r) => r.name.trim() && r.email.trim());
      if (valid.length === 0) {
        toast.error("No valid rows found", { description: "Make sure the file has name and email columns." });
        return;
      }
      setBulkParsed(valid);
      toast.success(`Found ${valid.length} staff member(s)`);
    } catch (err) {
      toast.error("Parse failed", { description: (err as Error).message });
    }
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  }

  async function handleBulkAdd() {
    if (!addStaffOpen || bulkParsed.length === 0) return;
    setBulkAdding(true);
    const res = await bulkAddStaffToRole(addStaffOpen, bulkParsed);
    setBulkAdding(false);
    if (res.ok) {
      toast.success(`Added ${res.added} staff member(s)`, {
        description: res.skipped > 0 ? `${res.skipped} duplicate(s) skipped` : undefined,
      });
      setBulkParsed([]);
    } else {
      toast.error("Bulk add failed", { description: res.error });
    }
  }


  return (
    <>
    <div className="mx-6 border-t border-white/10" />
    <div className="space-y-4 px-6 py-5">
      <div className="mb-1 flex items-center gap-2">
        <Lock className="h-5 w-5 text-accent-secondary" />
        <h4 className="text-sm font-semibold">Role Management</h4>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Create roles and add staff members. Staff log in with Google using their email.
      </p>

      {/* Create role */}
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Role name (e.g. Event Manager)"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateRole()}
        />
        <Button onClick={handleCreateRole} disabled={creating || !newRoleName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* Role list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roles yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-white/10 bg-white/5">
              <button
                onClick={() => setExpandedRoles((prev) => {
                  const next = new Set(prev);
                  next.has(role.id) ? next.delete(role.id) : next.add(role.id);
                  return next;
                })}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <h4 className="font-medium">{role.name} ({role.staff.length})</h4>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedRoles.has(role.id) && "rotate-180")} />
              </button>
              {expandedRoles.has(role.id) && (
                <div className="border-t border-white/8 px-4 pb-4 pt-3">
                  <div className="mb-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddStaffOpen(role.id);
                        setStaffName("");
                        setStaffEmail("");
                      }}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Staff
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteRoleConfirm(role.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Role
                    </Button>
                  </div>
                  {role.staff.length > 0 && (
                <div className="space-y-1">
                  {role.staff.map((s) => (
                    <div
                      key={s.email}
                      className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{s.email}</span>
                      {multiGate && s.gateId && (
                        <span className="inline-block rounded-full bg-accent-secondary/15 px-2 py-0.5 text-[0.65rem] font-medium text-accent-secondary">
                          {gates.find((g) => g.id === s.gateId)?.name ?? s.gateId.slice(0, 6)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add staff dialog (single + bulk upload) */}
      <Dialog open={!!addStaffOpen} onOpenChange={(o) => { if (!o) { setAddStaffOpen(null); setBulkParsed([]); } }}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add individually or bulk upload from CSV, JSON, or XLSX.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-6 py-4">
            {/* Single add */}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Email (Google account)</Label>
              <Input value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="staff@gmail.com" type="email" />
            </div>
            {multiGate && (
              <div className="space-y-2">
                <Label>Assigned Gate</Label>
                <Select value={staffGateId ?? "none"} onValueChange={(v) => setStaffGateId(v === "none" ? null : v)}>
                  <SelectTrigger>
                    <span>
                      {staffGateId
                        ? (gates.find((g) => g.id === staffGateId)?.name ?? staffGateId)
                        : "No gate assigned"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No gate assigned</SelectItem>
                    {gates.filter((g) => g.active).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Divider */}
            <div className="relative py-1">
              <div className="border-t border-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[rgb(10,10,10)] px-2 text-xs text-muted-foreground">
                or bulk upload
              </span>
            </div>

            {/* Bulk upload */}
            <input
              ref={bulkFileRef}
              type="file"
              accept=".csv,.json,.xlsx,.txt"
              onChange={handleBulkFile}
              className="absolute h-0 w-0 opacity-0"
            />
            <Button variant="outline" className="w-full" onClick={() => bulkFileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload File (CSV/JSON/XLSX)
            </Button>

            {/* Bulk preview */}
            {bulkParsed.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-sm font-medium text-success-green">
                  {bulkParsed.length} staff member(s) will be added
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
                  {bulkParsed.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-xs">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">{m.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-white/8 bg-[rgb(10,10,10)] px-6 py-4">
            <Button variant="ghost" onClick={() => { setAddStaffOpen(null); setBulkParsed([]); }}>Cancel</Button>
            {bulkParsed.length > 0 ? (
              <Button onClick={handleBulkAdd} disabled={bulkAdding}>
                {bulkAdding && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Add {bulkParsed.length} Staff
              </Button>
            ) : (
              <Button onClick={handleAddStaff} disabled={addingStaff || !staffName.trim() || !staffEmail.trim()}>
                {addingStaff && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Add
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit staff dialog */}
      {/* Delete role confirmation */}
      <Dialog open={!!deleteRoleConfirm} onOpenChange={(o) => !o && setDeleteRoleConfirm(null)}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Role?</DialogTitle>
            <DialogDescription>
              Permanently delete &ldquo;{deleteRoleConfirm}&rdquo; and remove all{" "}
              {roles.find((r) => r.id === deleteRoleConfirm)?.staff.length ?? 0} staff members
              from this role. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteRoleConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteRoleConfirm) await handleDeleteRole(deleteRoleConfirm);
                setDeleteRoleConfirm(null);
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </>
  );
}

// ============== Remote Device Management ==============

function RemoteDeviceManagement() {
  const { roles, loading } = useRoles();
  const [activeRole, setActiveRole] = useState<StaffRole | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set()); // keyed by email
  const [lockedTabs, setLockedTabs] = useState<Set<TabName>>(new Set());
  const [reason, setReason] = useState<LockReasonType>("basic");

  // Real-time lock status from global_locks collection.
  const lockMap = useLockStatus();
  const [maintHrs, setMaintHrs] = useState("");
  const [maintMins, setMaintMins] = useState("");
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

  function durationString(): string | null {
    if (reason !== "maintenance") return null;
    const h = Number(maintHrs) || 0;
    const m = Number(maintMins) || 0;
    if (h === 0 && m === 0) return "Unknown";
    let s = "";
    if (h > 0) s += `${h} hr `;
    if (m > 0) s += `${m} min`;
    return s.trim() || "Unknown";
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
        duration: durationString(),
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

  return (
    <>
    <div className="mx-6 border-t border-white/10" />
    <div className="space-y-4 px-6 py-5">
      <div className="mb-1 flex items-center gap-2">
        <Lock className="h-5 w-5 text-accent-secondary" />
        <h4 className="text-sm font-semibold">Remote Device Management</h4>
      </div>
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

              {/* Select All / Deselect All + Edit/Delete */}
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => {
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
                  className="text-xs font-medium text-accent-secondary hover:underline"
                >
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
                    return allSelected ? "Deselect All" : "Select All";
                  })()}
                </button>
                {selectedStaff.size > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => openEditBatch()}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {/* Staff table */}
              <div className="max-h-[75vh] space-y-1.5 overflow-y-auto overflow-x-visible px-2 py-1 scrollbar-thin md:max-h-[55vh]">
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
    </>
  );
}

// ============== Kiosk (Self Check-in) ==============

function KioskPanel() {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load enabled status once on mount.
  useEffect(() => {
    let active = true;
    getKioskStatus()
      .then((res) => {
        if (active && res.ok) setEnabled(res.enabled);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await saveKioskPin(pin);
    setSaving(false);
    if (res.ok) {
      const isSetting = pin.replace(/\D/g, "").length >= 4;
      setEnabled(isSetting);
      setPin("");
      toast.success(isSetting ? "Kiosk PIN saved" : "Kiosk disabled");
    } else {
      toast.error("Save failed", { description: res.error });
    }
  }

  async function handleDisable() {
    setSaving(true);
    const res = await saveKioskPin("");
    setSaving(false);
    if (res.ok) {
      setEnabled(false);
      toast.success("Kiosk disabled");
    } else {
      toast.error("Failed to disable", { description: res.error });
    }
  }

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="mb-1 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-emerald-400" />
        <h4 className="text-sm font-semibold">Self Check-in Kiosk</h4>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Set a PIN to enable a public kiosk at <code className="rounded bg-white/10 px-1 py-0.5 text-xs">/kiosk</code> where guests
        scan their own QR code on a mounted tablet. Leave empty to disable.
      </p>

      {enabled && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-sm text-emerald-400">Kiosk enabled — PIN required to scan</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="4-8 digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && handleSave()}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPin((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            tabIndex={-1}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || pin.length < 4}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {enabled ? "Update PIN" : "Enable Kiosk"}
        </Button>
        {enabled && (
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleDisable}
            disabled={saving}
          >
            Disable
          </Button>
        )}
        {enabled && (
          <a
            href="/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open Kiosk
          </a>
        )}
      </div>

      {!loaded && (
        <p className="mt-3 text-xs text-muted-foreground">Loading status…</p>
      )}
    </div>
  );
}

// ============== Factory Reset ==============

function FactoryResetPanel() {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    const res = await factoryReset();
    setResetting(false);
    if (res.ok) {
      toast.success("System reset complete");
      setOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error("Reset failed", { description: res.error });
    }
  }

  return (
    <div className="p-6 pt-2 text-center">
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-destructive text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Factory Reset Database
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠ Danger Zone</DialogTitle>
            <DialogDescription>
              This will <strong>permanently erase</strong> all tickets, settings,
              and lock configurations. An immutable audit record will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Nuke Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
