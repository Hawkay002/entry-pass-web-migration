// components/admin/panels/role-management-panel.tsx — create roles + add/remove staff.

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Users, Plus, ChevronDown, Upload, MoreVertical } from "lucide-react";
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
import {
  createRole,
  addStaffToRole,
  bulkAddStaffToRole,
  deleteRole,
} from "@/app/actions/roles";
import { useRoles } from "@/hooks/use-roles";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { cn } from "@/lib/utils";

export function RoleManagementPanel() {
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
    <CollapsibleSection
      icon={<Users className="h-4 w-4" />}
      title="Role Management"
      badge={
        !loading && roles.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success-green/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-success-green">
            <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
            {roles.length}
          </span>
        ) : null
      }
    >
    <div className="space-y-4 px-6 py-5">
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
                <h4 className="text-sm font-semibold">{role.name} ({role.staff.length})</h4>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedRoles.has(role.id) && "rotate-180")} />
              </button>
              {expandedRoles.has(role.id) && (
                <div className="border-t border-white/8 px-4 pb-4 pt-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Staff Details</span>
                    <div className="flex items-center gap-2">
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
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteRoleConfirm(role.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Role
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
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
              Permanently delete “{deleteRoleConfirm}” and remove all{" "}
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
    </CollapsibleSection>
    </>
  );
}
