// components/logs/logs-table.tsx — client filter/search/select/delete for logs.

"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Loader2, Search, Trash2, Filter, ChevronDown, CheckSquare, MoreVertical } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseExportIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteLogs } from "@/app/actions/admin";
import { exportLogsCSV, exportLogsXLSX, exportLogsPDF } from "@/lib/import-export";
import { playSfx, playToastSfx, startProcessingSfx, stopProcessingSfx } from "@/lib/sfx";
import type { ActivityLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Logins",
  TICKET_CREATE: "Ticket Issues",
  SCAN_ENTRY: "Scans",
  SELF_CHECKIN: "Self Check-in",
  CONFIG_CHANGE: "Settings",
  HELP_CALL: "Help Calls",
  TICKET_DELETE: "Ticket Deletions",
  FACTORY_RESET: "Factory Resets",
  LOCK_ACTION: "Admin Locks",
  LOG_DELETE: "Log Deletions",
  EXPORT_DATA: "Data Exports",
  IMPORT_DATA: "Import Data",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-500/20 text-blue-400",
  TICKET_CREATE: "bg-success-green/20 text-success-green",
  SCAN_ENTRY: "bg-accent-secondary/20 text-accent-secondary",
  SELF_CHECKIN: "bg-emerald-500/20 text-emerald-400",
  CONFIG_CHANGE: "bg-purple-500/20 text-purple-400",
  HELP_CALL: "bg-amber-500/20 text-amber-400",
  TICKET_DELETE: "bg-red-500/20 text-red-400",
  FACTORY_RESET: "bg-red-700/20 text-red-500",
  LOCK_ACTION: "bg-pink-500/20 text-pink-400",
  LOG_DELETE: "bg-orange-500/20 text-orange-400",
  EXPORT_DATA: "bg-teal-500/20 text-teal-400",
  IMPORT_DATA: "bg-indigo-500/20 text-indigo-400",
};

const ACTION_FILTERS = [
  "LOGIN",
  "TICKET_CREATE",
  "SCAN_ENTRY",
  "SELF_CHECKIN",
  "CONFIG_CHANGE",
  "HELP_CALL",
  "TICKET_DELETE",
  "FACTORY_RESET",
  "LOCK_ACTION",
  "LOG_DELETE",
  "EXPORT_DATA",
  "IMPORT_DATA",
] as const;

export function LogsTable({ initialLogs }: { initialLogs: ActivityLog[] }) {
  const [logs] = useState(initialLogs);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleExport(format: string, filename: string) {
    const selectedLogs = logs.filter((l) => selected.has(l.id));
    const name = filename || "activity_logs";
    try {
      if (format === "csv") exportLogsCSV(selectedLogs, name);
      else if (format === "xlsx") await exportLogsXLSX(selectedLogs, name);
      else if (format === "pdf") await exportLogsPDF(selectedLogs, name);
      playSfx("success");
      playToastSfx();
      toast.success(`Exported ${selectedLogs.length} log(s) as ${format.toUpperCase()}`);
      setExportOpen(false);
    } catch (err) {
      playSfx("error");
      playToastSfx();
      toast.error("Export failed", { description: (err as Error).message });
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (!term) return true;
      return (
        l.username.toLowerCase().includes(term) ||
        l.userEmail.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        l.details.toLowerCase().includes(term)
      );
    });
  }, [logs, search, actionFilter]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmDelete() {
    const ids = [...selected];
    setDeleting(true);
    startProcessingSfx();
    const res = await deleteLogs(ids);
    setDeleting(false);
    if (res.ok) {
      stopProcessingSfx();
      playSfx("delete");
      playToastSfx();
      toast.success(`Deleted ${res.count} log(s)`);
      setSelected(new Set());
      setSelectionMode(false);
      // Refresh server data.
      window.location.reload();
    } else {
      stopProcessingSfx();
      playSfx("error");
      playToastSfx();
      toast.error("Delete failed", { description: res.error });
    }
  }

  return (
    <div className="glass-panel space-y-4 p-6">
      <div className="flex items-start justify-between gap-1">
        <h2 className="shrink-0 text-lg font-semibold">Activity Logs</h2>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {selectionMode && (
            <Button
              variant="outline"
              size="sm"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("cancel"); setSelectionMode(false); setSelected(new Set()); }}
              className="h-8 rounded-lg text-destructive hover:bg-destructive/10"
            >
              Cancel
            </Button>
          )}
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("select"); setSelectionMode(true); }}
              className="h-8"
            >
              Select{selectionMode && selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                data-sfx-own=""
                onMouseEnter={() => playSfx("hover")}
                onClick={() => playSfx("select")}
                render={<Button variant="outline" size="sm" className="h-8 px-2" aria-label="Select options" />}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem data-sfx-own="" onMouseEnter={() => playSfx("hover")} onClick={() => { playSfx("select"); setSelectionMode(true); setSelected(new Set(filtered.map((l) => l.id))); }}>
                  <CheckSquare className="mr-2 h-3.5 w-3.5" />
                  Select All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          <DropdownMenu>
            <DropdownMenuTrigger
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => playSfx("select")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem
                data-sfx-own=""
                disabled={selected.size === 0}
                onMouseEnter={() => { if (selected.size > 0) playSfx("hover"); }}
                onClick={() => { if (selected.size > 0) { playSfx("select"); setExportOpen(true); } }}
              >
                <HugeiconsIcon icon={DatabaseExportIcon} size={14} className="mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                data-sfx-own=""
                disabled={selected.size === 0 || deleting}
                onMouseEnter={() => { if (selected.size > 0 && !deleting) playSfx("hover"); }}
                onClick={() => { if (selected.size > 0 && !deleting) { playSfx("delete"); setDeleteOpen(true); } }}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                )}
                Delete{selectionMode ? ` (${selected.size})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search user, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div ref={typeRef} className="relative shrink-0">
          <button
            data-sfx-own=""
            onMouseEnter={() => playSfx("hover")}
            onClick={() => { playSfx("select"); setTypeOpen((o) => !o); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-input/60 px-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-input/80"
          >
            <Filter className="h-4 w-4" />
            {actionFilter === "all" ? "All Types" : ACTION_LABELS[actionFilter] || "Type"}
          </button>
          {typeOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 max-h-[50vh] w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#0f0f0f] p-1 shadow-2xl scrollbar-thin">
              <FilterSection label="Filter by Action" />
              <button
                data-sfx-own=""
                onMouseEnter={() => playSfx("hover")}
                onClick={() => { playSfx("select"); setActionFilter("all"); }}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10",
                  actionFilter === "all" && "bg-white/10 font-medium text-accent-secondary"
                )}
              >
                All Actions
              </button>
              <FilterDivider />
              {ACTION_FILTERS.map((a) => (
                <button
                  key={a}
                  data-sfx-own=""
                  onMouseEnter={() => playSfx("hover")}
                  onClick={() => { playSfx("select"); setActionFilter(a); }}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10",
                    actionFilter === a && "bg-white/10 font-medium text-accent-secondary"
                  )}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              {selectionMode && <TableHead className="w-10" />}
              <TableHead className="w-44">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  {selectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(l.id)}
                        data-sfx-own=""
                        onCheckedChange={() => {
                          // check/uncheck cues for INDIVIDUAL rows only.
                          playSfx(selected.has(l.id) ? "uncheck" : "check");
                          toggleRow(l.id);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {new Date(l.timestamp).toISOString().replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {l.username}
                    <span className="block text-xs text-muted-foreground">
                      {l.userEmail}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", ACTION_COLORS[l.action] ?? "bg-white/10 text-white")}>
                      {l.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.details}</TableCell>
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
            <DialogTitle className="text-destructive">Delete Logs?</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <span className="font-bold text-foreground">{selected.size}</span>{" "}
              log entries? This cannot be undone.
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
              <Button
                variant="ghost"
                data-sfx-own=""
                onMouseEnter={() => playSfx("hover")}
                onClick={() => { playSfx("cancel"); setDeleteOpen(false); }}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="destructive"
              data-sfx-own=""
              disabled={deleting}
              onMouseEnter={() => { if (!deleting) playSfx("hover"); }}
              onClick={() => { if (!deleting) { playSfx("delete"); confirmDelete(); } }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export modal (exports selected logs) */}
      <ExportLogsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        count={selected.size}
        onExport={handleExport}
      />
    </div>
  );
}

function ExportLogsModal({
  open,
  onOpenChange,
  count,
  onExport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  onExport: (format: string, filename: string) => Promise<void>;
}) {
  const [filename, setFilename] = useState("");
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);

  async function handleDownload() {
    setExporting(true);
    await onExport(format, filename || "activity_logs");
    setExporting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Logs</DialogTitle>
          <DialogDescription>
            Exporting {count} selected log(s).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-name">File Name</Label>
            <Input
              id="export-name"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="activity_logs"
            />
          </div>
          <div className="space-y-2">
            <Label>File Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v ?? "csv")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            data-sfx-own=""
            onMouseEnter={() => playSfx("hover")}
            onClick={() => { playSfx("cancel"); onOpenChange(false); }}
          >
            Cancel
          </Button>
          <Button
            data-sfx-own=""
            disabled={exporting || count === 0}
            onMouseEnter={() => { if (!exporting && count > 0) playSfx("hover"); }}
            onClick={() => { if (!exporting && count > 0) { playSfx("select"); handleDownload(); } }}
          >
            {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSection({ label }: { label: string }) {
  return <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>;
}

function FilterDivider() {
  return <div className="my-1 border-t border-white/10" />;
}
