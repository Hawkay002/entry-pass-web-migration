// components/guests/import-export.tsx — import + export modals for the Guest List.

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DatabaseImportIcon,
  DatabaseExportIcon,
  FileManagementIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
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
import { parseImportFile, exportTickets } from "@/lib/import-export";
import { importTickets } from "@/app/actions/import";
import type { ParsedTicket } from "@/lib/import-export";
import type { Ticket as TicketType } from "@/lib/types";

export function ImportExportButtons({
  selectedTickets,
  allTickets,
  externalManageOpen,
  onManageOpenChange,
}: {
  selectedTickets: TicketType[];
  allTickets: TicketType[];
  /** When provided, the standalone Manage button is hidden and the modal is
   *  controlled externally (e.g. from a dropdown menu). */
  externalManageOpen?: boolean;
  onManageOpenChange?: (open: boolean) => void;
}) {
  const [internalManageOpen, setInternalManageOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const isExternal = externalManageOpen !== undefined;
  const manageOpen = isExternal ? externalManageOpen! : internalManageOpen;
  const setManageOpen = isExternal ? (onManageOpenChange ?? (() => {})) : setInternalManageOpen;

  return (
    <>
      {!isExternal && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManageOpen(true)}
        >
          <HugeiconsIcon icon={FileManagementIcon} size={16} className="mr-1.5" />
          Manage
        </Button>
      )}

      {/* Manage modal — choose Import or Export */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Guest Data</DialogTitle>
            <DialogDescription>
              Import guests from a file or export the selected guests.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 py-2">
            <button
              onClick={() => {
                setManageOpen(false);
                setImportOpen(true);
              }}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-white/10 p-6 transition-colors hover:bg-white/5"
            >
              <HugeiconsIcon icon={DatabaseImportIcon} size={28} primaryColor="#3b82f6" />
              <span className="text-sm font-medium">Import Guests</span>
            </button>
            <button
              onClick={() => {
                setManageOpen(false);
                setExportOpen(true);
              }}
              disabled={selectedTickets.length === 0}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-white/10 p-6 transition-colors hover:bg-white/5 disabled:opacity-40"
            >
              <HugeiconsIcon icon={DatabaseExportIcon} size={28} primaryColor="#10b981" />
              <span className="text-sm font-medium">
                Export ({selectedTickets.length})
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        existingPhones={allTickets.map((t) =>
          t.phone.replace("+91", "") + ":" + t.name.toLowerCase()
        )}
      />
      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        tickets={selectedTickets}
      />
    </>
  );
}

function ImportModal({
  open,
  onOpenChange,
  existingPhones,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingPhones: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTicket[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed([]);
    try {
      const records = await parseImportFile(file);
      if (records.length === 0) {
        toast.error("No valid rows found", { description: "Make sure the file has name and phone columns." });
        return;
      }
      setParsed(records);
      toast.success(`Found ${records.length} records`);
    } catch (err) {
      toast.error("Parse failed", { description: (err as Error).message });
    }
  }

  async function handleImport() {
    if (parsed.length === 0) {
      toast.error("No data to import", { description: "Select a file first." });
      return;
    }
    setImporting(true);
    try {
      const res = await importTickets(parsed, existingPhones);
      if (res.ok) {
        toast.success(
          `Imported ${res.imported} guests (${res.duplicates} duplicates skipped)`
        );
        onOpenChange(false);
        setParsed([]);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error("Import failed", { description: res.error });
      }
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    }
    setImporting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Guests</DialogTitle>
          <DialogDescription>
            Upload a file to bulk import tickets. Supported: CSV, JSON, XLSX.
            Duplicates are skipped based on phone number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,.json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            className="absolute h-0 w-0 opacity-0"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <HugeiconsIcon icon={DatabaseImportIcon} size={16} className="mr-2" /> Browse Files
          </Button>
          {fileName && (
            <p className="text-sm text-success-green">
              Selected: {fileName} ({parsed.length} records)
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsed.length === 0 || importing}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {parsed.length > 0 ? `${parsed.length} Records` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportModal({
  open,
  onOpenChange,
  tickets,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tickets: TicketType[];
}) {
  const [filename, setFilename] = useState("");
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const name = filename || "guest_list";
    try {
      await exportTickets(tickets, name, format);
      toast.success(`Exported ${tickets.length} records as ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    }
    setExporting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Exporting {tickets.length} selected guest(s).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-name">File Name</Label>
            <Input
              id="export-name"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="guest_list"
            />
          </div>
          <div className="space-y-2">
            <Label>File Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v ?? "csv")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                <SelectItem value="txt">Text (.txt)</SelectItem>
                <SelectItem value="doc">Word (.doc)</SelectItem>
                <SelectItem value="json">JSON (.json)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
