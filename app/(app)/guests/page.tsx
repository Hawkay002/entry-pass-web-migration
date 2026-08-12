// app/(app)/guests/page.tsx — Guest List with filter/sort/search/select/delete.

"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { LockedTab } from "@/components/layout/locked-tab";
import { useLockedTabs } from "@/components/layout/locked-tabs-context";
import { Loader2, Search, Trash2, Filter, Eye, Users, Pencil, UserX, ChevronDown, CheckSquare, MoreVertical } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { WhatsappIcon, FileManagementIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTickets } from "@/hooks/use-tickets";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import {
  filterTickets,
  DEFAULT_FILTERS,
  type GuestListFilters,
  type SortKey,
  type StatusFilter,
  type TicketTypeFilter,
  type GenderFilter,
} from "@/lib/guest-list";
import { deleteOneTicket, updateGuestName } from "@/app/actions/tickets";
import { useIsAdmin } from "@/components/layout/app-shell";
import { TICKET_TYPE_LABELS } from "@/lib/types";
import type { TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImportExportButtons } from "@/components/guests/import-export";


const STATUS_STYLES: Record<TicketStatus, string> = {
  "coming-soon": "bg-amber-500/20 text-amber-400",
  arrived: "bg-success-green/20 text-success-green",
  absent: "bg-destructive/20 text-destructive",
};

const TYPE_STYLES: Record<string, string> = {
  Classic: "bg-[#1a1a2e] text-white border border-white/10",
  Diamond: "bg-[linear-gradient(125deg,#e2e8f0,#94a3b8)] text-[#0f2433]",
  SVIP: "bg-[linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c)] text-[#3e2704]",
  Gold: "bg-[radial-gradient(circle_at_62%_30%,#ffc691,#fe9046_45%,#ef671c)] text-[#3e2704]",
};

export default function GuestsPage() {
  const lockedTabs = useLockedTabs();
  const { tickets, loading } = useTickets();
  const [filters, setFilters] = useState<GuestListFilters>(DEFAULT_FILTERS);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const isAdmin = useIsAdmin();
  const [editName, setEditName] = useState<{ id: string; name: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const { gates, gateMap } = useGatesMode();
  const multiGate = Boolean(settings.multiGate);

  // Auto-absent: fires once exactly at the deadline moment via setTimeout.
  // No polling — calculates the ms until deadline and sets a single timer.
  // Also checks immediately on mount in case the deadline already passed.
  const hasComingSoon = tickets.some((t) => t.status === "coming-soon");
  const hasDeadline = !!settings.deadline;
  const [absentMarking, setAbsentMarking] = useState(false);

  async function triggerAutoAbsent(force = false) {
    setAbsentMarking(true);
    try {
      const r = await fetch("/api/auto-absent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const res = await r.json();
      if (res.ok && res.count > 0) {
        toast.success(`${res.count} guest(s) marked absent.`);
      } else if (res.ok && res.count === 0 && force) {
        toast.info("No pending guests to mark absent.");
      } else if (!res.ok && isAdmin) {
        toast.error("Auto-absent failed", { description: res.error ?? "Unknown error" });
      }
    } catch {
      if (isAdmin) {
        toast.error("Auto-absent failed", {
          description: "Network error. Try again from the Actions menu.",
        });
      }
    }
    setAbsentMarking(false);
  }

  useEffect(() => {
    if (!hasDeadline || !hasComingSoon) return;

    // Parse the deadline. The stored value includes a timezone offset
    // (e.g. "2026-08-04T17:00:00+05:30") so Date() parses it correctly.
    const deadlineMs = new Date(settings.deadline!).getTime();
    const msUntilDeadline = deadlineMs - Date.now();

    if (msUntilDeadline <= 0) {
      // Deadline already passed — check immediately.
      triggerAutoAbsent(false);
      return;
    }

    // Set a single timeout for the exact deadline moment.
    const timeout = setTimeout(() => triggerAutoAbsent(false), msUntilDeadline);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeadline, hasComingSoon, settings.deadline]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(
    () => filterTickets(tickets, filters),
    [tickets, filters]
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelected(new Set());
  }
  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  async function confirmDelete() {
    const ids = [...selected];
    setDeleting(true);

    let deleted = 0;
    for (const id of ids) {
      const res = await deleteOneTicket(id);
      if (res.ok) deleted++;
    }

    setDeleting(false);
    setDeleteOpen(false);
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} ticket(s)`);
      exitSelectionMode();
    } else {
      toast.error("Delete failed");
    }
  }

  async function handleSaveName() {
    if (!editName || !editName.name.trim()) return;
    setSavingName(true);
    const res = await updateGuestName(editName.id, editName.name);
    setSavingName(false);
    if (res.ok) {
      toast.success("Name updated");
      setEditName(null);
    } else {
      toast.error("Failed to update name", { description: res.error });
    }
  }

  if (lockedTabs.includes("booked")) {
    return <LockedTab tabName="Guest List" />;
  }

  return (
    <div className="glass-panel space-y-4 p-6">
      {/* Hidden ImportExportButtons — only renders the modals (Manage button hidden,
          triggered externally via manageOpen state from the Actions dropdown). */}
      <ImportExportButtons
        selectedTickets={filtered.filter((t) => selected.has(t.id))}
        allTickets={tickets}
        externalManageOpen={manageOpen}
        onManageOpenChange={setManageOpen}
      />

      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2">
          <h2 className="shrink-0 text-lg font-semibold">Guest List</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {selectionMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-destructive hover:bg-destructive/10"
              onClick={exitSelectionMode}
            >
              Cancel
            </Button>
          )}
          <ButtonGroup>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={enterSelectionMode}
              >
                Select{selectionMode && selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" className="h-8 px-2" aria-label="Select options" />}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { enterSelectionMode(); setSelected(new Set(filtered.map((t) => t.id))); }}>
                  <CheckSquare className="mr-2 h-3.5 w-3.5" />
                  Select All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => setManageOpen(true)}>
                <HugeiconsIcon icon={FileManagementIcon} size={14} className="mr-2" />
                Manage
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem
                  disabled={!hasComingSoon || absentMarking}
                  onClick={() => triggerAutoAbsent(true)}
                >
                  {absentMarking ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserX className="mr-2 h-3.5 w-3.5" />
                  )}
                  Mark All Absent
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={selected.size === 0}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete{selectionMode ? ` (${selected.size})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-b border-white/5 pb-3 text-sm sm:justify-start">
        <span className="font-semibold">{tickets.length} <span className="text-muted-foreground font-normal">Total</span></span>
        <span className="font-semibold text-success-green">{tickets.filter(t => t.status === "arrived").length} <span className="text-muted-foreground font-normal">Arrived</span></span>
        <span className="font-semibold text-amber-400">{tickets.filter(t => t.status === "coming-soon").length} <span className="text-muted-foreground font-normal">Pending</span></span>
        <span className="font-semibold text-destructive">{tickets.filter(t => t.status === "absent").length} <span className="text-muted-foreground font-normal">Absent</span></span>
      </div>

      {/* Search + filter/sort */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            className="pl-9"
          />
        </div>
        <div ref={filterRef} className="relative shrink-0">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-input/60 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-input/80"
          >
            <Filter className="h-4 w-4" /> Filter / Sort
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 max-h-[40vh] w-56 overflow-y-auto rounded-lg border border-white/10 bg-black p-1 shadow-2xl scrollbar-thin">
              <FilterSection label="Ticket Type" />
              {(["all", "Classic", "Diamond", "Gold"] as const).map((v) => (
                <FilterItem
                  key={v}
                  label={
                    v === "all" ? "All Types" : v === "Classic" ? "Classic Only" : v === "Diamond" ? "VIP" : "VVIP"
                  }
                  active={filters.ticketType === v}
                  onClick={() => {
                    setFilters((f) => ({ ...f, ticketType: v as TicketTypeFilter }));
                  }}
                />
              ))}
              <FilterDivider />
              <FilterSection label="Status" />
              {(["all", "arrived", "coming-soon", "absent"] as const).map((v) => (
                <FilterItem
                  key={v}
                  label={v === "all" ? "All Guests" : v === "coming-soon" ? "Coming Soon" : v === "arrived" ? "Arrived Only" : "Absent"}
                  active={filters.status === v}
                  onClick={() => setFilters((f) => ({ ...f, status: v as StatusFilter }))}
                />
              ))}
              <FilterDivider />
              <FilterSection label="Gender" />
              {(["all", "Male", "Female", "Other"] as const).map((v) => (
                <FilterItem
                  key={v}
                  label={v === "all" ? "All Genders" : `${v} Only`}
                  active={filters.gender === v}
                  onClick={() => setFilters((f) => ({ ...f, gender: v as GenderFilter }))}
                />
              ))}
              <FilterDivider />
              <FilterSection label="Sort Order" />
              {([
                ["newest", "Newest First"],
                ["oldest", "Oldest First"],
                ["name-asc", "Name (A-Z)"],
                ["name-desc", "Name (Z-A)"],
                ["age-asc", "Age (Youngest)"],
                ["age-desc", "Age (Oldest)"],
                ["gender", "Gender (Grouped)"],
              ] as const).map(([v, label]) => (
                <FilterItem
                  key={v}
                  label={label}
                  active={filters.sort === v}
                  onClick={() => setFilters((f) => ({ ...f, sort: v as SortKey }))}
                />
              ))}
              {multiGate && (
                <>
                  <FilterDivider />
                  <FilterSection label="Gate" />
                  <FilterItem
                    label="All Gates"
                    active={filters.gate === "all"}
                    onClick={() => setFilters((f) => ({ ...f, gate: "all" }))}
                  />
                  {gates.map((g) => (
                    <FilterItem
                      key={g.id}
                      label={g.name}
                      active={filters.gate === g.id}
                      onClick={() => setFilters((f) => ({ ...f, gate: g.id }))}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              {selectionMode && <TableHead className="w-10" />}
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Guest Name</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-center">Details</TableHead>
              <TableHead className="text-center">Contact</TableHead>
              <TableHead className="text-center">Ticket ID</TableHead>
              {multiGate && <TableHead className="text-center">Gate</TableHead>}
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-12 text-center">View</TableHead>
              <TableHead className="w-12 text-center">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={multiGate ? 10 : 9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Loading guests...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 && tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={multiGate ? 10 : 9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No guests yet.</p>
                    <p className="text-xs text-muted-foreground/60">Issue a ticket or import guests to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={multiGate ? 10 : 9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No guests match your filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t, i) => (
                <TableRow key={t.id}>
                  {selectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleRow(t.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-center text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {t.name}
                      {t.parentName && (
                        <span className="inline-block rounded-full bg-accent-secondary/15 px-2 py-0.5 text-[0.6rem] font-medium text-accent-secondary">
                          Child
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setEditName({ id: t.id, name: t.name })}
                          className="text-muted-foreground/50 transition-colors hover:text-accent-secondary"
                          title="Edit name"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        TYPE_STYLES[t.ticketType] ?? TYPE_STYLES.Classic
                      )}
                    >
                      {TICKET_TYPE_LABELS[t.ticketType]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {t.age} / {t.gender}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">{t.phone}</TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {t.id}
                  </TableCell>
                  {multiGate && (
                    <TableCell className="text-center">
                      {t.gate ? (
                        <span className="inline-block rounded-full bg-accent-secondary/15 px-2 py-0.5 text-xs font-medium text-accent-secondary">
                          {gateMap.get(t.gate)?.name ?? t.gate.slice(0, 6)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[t.status]
                      )}
                    >
                      {t.status.replace("-", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/ticket/${t.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                      >
                      <Eye className="h-4 w-4" />
                    </Button>
                    </a>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const digits = t.phone.replace(/\D/g, "");
                        const ticketUrl = `${window.location.origin}/ticket/${t.id}`;
                        const message = `Hello ${t.name}, here is your Entry Pass 🎫 (shader disabled for preview images)\n*Keep this QR code ready at the entrance.*\n\nView your interactive ticket:\n${ticketUrl}\n_This link will expire after the event ends._\n\nEnter your full phone number with country code (e.g. ${t.phone}) to unlock your ticket.`;
                        window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
                      }}
                    >
                      <HugeiconsIcon icon={WhatsappIcon} size={16} primaryColor="#25D366" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirm modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Permanently remove{" "}
              <span className="font-bold text-foreground">{selected.size}</span>{" "}
              entries from the database?
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting...
            </div>
          )}
          <DialogFooter>
            {!deleting && (
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
            )}
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit guest name dialog (admin only) */}
      <Dialog open={!!editName} onOpenChange={(o) => !o && setEditName(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Guest Name</DialogTitle>
          </DialogHeader>
          <Input
            value={editName?.name ?? ""}
            onChange={(e) => setEditName((p) => (p ? { ...p, name: e.target.value } : p))}
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            placeholder="Full name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditName(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveName} disabled={savingName || !editName?.name.trim()}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSection({ label }: { label: string }) {
  return <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>;
}

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10",
        active && "bg-white/10 font-medium text-accent-secondary"
      )}
    >
      {label}
    </button>
  );
}

function FilterDivider() {
  return <div className="my-1 border-t border-white/10" />;
}
