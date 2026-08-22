// components/admin/panels/kiosk-panel.tsx — self check-in kiosk CRUD.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, ScanLine, ArrowUpRight, Pencil, MoreVertical, Eye, EyeOff, Copy } from "lucide-react";
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
import { createKiosk, updateKiosk, deleteKiosk } from "@/app/actions/admin";
import { useKiosks, type KioskListItem } from "@/hooks/use-kiosks";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { playSfx, playToastSfx, startProcessingSfx, stopProcessingSfx } from "@/lib/sfx";

export function KioskPanel() {
  const { kiosks, loading } = useKiosks();
  const [addOpen, setAddOpen] = useState(false);
  const [editKiosk, setEditKiosk] = useState<KioskListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteKioskConfirm, setDeleteKioskConfirm] = useState<{ id: string; name: string } | null>(null);
  const { settings: kioskSettings } = useSettings();
  const { gates: kioskGates } = useGatesMode();
  const kioskMultiGate = Boolean(kioskSettings.multiGate);

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newGate, setNewGate] = useState<string | null>(null);
  const [showNewPin, setShowNewPin] = useState(false);

  const [editName, setEditName] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editGate, setEditGate] = useState<string | null>(null);
  const [showEditPin, setShowEditPin] = useState(false);

  async function handleAdd() {
    if (!newName.trim() || newPin.length < 4) return;
    setBusy(true);
    startProcessingSfx();
    const res = await createKiosk(newName, newPin, kioskMultiGate ? newGate : null);
    setBusy(false);
    if (res.ok) {
      stopProcessingSfx();
      playSfx("success");
      playToastSfx();
      toast.success("Kiosk created");
      setNewName(""); setNewPin(""); setNewGate(null);
      setAddOpen(false);
    } else {
      stopProcessingSfx();
      playSfx("error");
      playToastSfx();
      toast.error("Failed", { description: res.error });
    }
  }

  async function handleEditSave() {
    if (!editKiosk || !editName.trim()) return;
    setBusy(true);
    startProcessingSfx();
    const patch: { name?: string; pin?: string; gateId?: string | null } = { name: editName };
    if (editPin.length >= 4) patch.pin = editPin;
    if (kioskMultiGate) patch.gateId = editGate;
    const res = await updateKiosk(editKiosk.id, patch);
    setBusy(false);
    if (res.ok) {
      stopProcessingSfx();
      playSfx("success");
      playToastSfx();
      toast.success("Kiosk updated");
      setEditKiosk(null);
    } else {
      stopProcessingSfx();
      playSfx("error");
      playToastSfx();
      toast.error("Failed", { description: res.error });
    }
  }

  async function handleDelete(id: string, name: string) {
    setBusy(true);
    startProcessingSfx();
    const res = await deleteKiosk(id);
    setBusy(false);
    if (res.ok) {
      stopProcessingSfx();
      playSfx("delete");
      playToastSfx();
      toast.success(`Kiosk "${name}" deleted`);
    } else {
      stopProcessingSfx();
      playSfx("error");
      playToastSfx();
      toast.error("Failed");
    }
  }

  return (
    <CollapsibleSection
      icon={<ScanLine className="h-4 w-4" />}
      title="Self Check-in Kiosks"
      badge={
        !loading && kiosks.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success-green/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-success-green">
            <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
            {kiosks.length}
          </span>
        ) : null
      }
    >
    <div className="space-y-4 px-6 py-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex-1 pr-3">
          Create kiosks for different gates. Each gets its own PIN + URL. Open <code className="rounded bg-white/10 px-1 py-0.5">/kiosk?id=…</code> on each tablet.
        </p>
        <Button
          size="sm"
          variant="outline"
          data-sfx-own=""
          onMouseEnter={() => playSfx("hover")}
          onClick={() => { playSfx("add-to-cart"); setAddOpen(true); }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Kiosk
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : kiosks.length === 0 ? (
        <p className="rounded-xl border border-white/8 bg-black/20 py-6 text-center text-sm text-muted-foreground">
          No kiosks yet. Create one to enable self check-in.
        </p>
      ) : (
        <div className="space-y-2">
          {kiosks.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{k.name}</span>
                {kioskMultiGate && k.gateId && (
                  <span className="rounded-full bg-accent-secondary/15 px-2 py-0.5 text-[0.65rem] font-medium text-accent-secondary">
                    {kioskGates.find((g) => g.id === k.gateId)?.name ?? k.gateId.slice(0, 6)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/kiosk?id=${k.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-sfx-own=""
                  onMouseEnter={() => playSfx("hover")}
                  onClick={() => playSfx("open")}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                  title="Open kiosk"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-sfx-own=""
                    onMouseEnter={() => playSfx("hover")}
                    onClick={() => playSfx("select")}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                    title="More"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      data-sfx-own=""
                      onMouseEnter={() => playSfx("hover")}
                      onClick={() => {
                        playSfx("copy");
                        const link = `${window.location.origin}/kiosk?id=${k.id}`;
                        navigator.clipboard.writeText(link).then(() => {
                          playToastSfx();
                          toast.success("Kiosk link copied to clipboard");
                        }).catch(() => {
                          playSfx("error");
                          playToastSfx();
                          toast.error("Failed to copy link");
                        });
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" /> Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-sfx-own=""
                      onMouseEnter={() => playSfx("hover")}
                      onClick={() => { playSfx("select"); setEditKiosk(k); setEditName(k.name); setEditPin(""); setEditGate(k.gateId); }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      data-sfx-own=""
                      onMouseEnter={() => playSfx("hover")}
                      onClick={() => { playSfx("delete"); setDeleteKioskConfirm({ id: k.id, name: k.name }); }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Kiosk Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Kiosk</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kiosk Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Gate A Kiosk" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PIN (4-6 digits)</Label>
              <div className="relative">
                <Input type={showNewPin ? "text" : "password"} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••" className="h-8 pr-9 text-sm" />
                <button
                  type="button"
                  data-sfx-own=""
                  onMouseEnter={() => playSfx("hover")}
                  onClick={() => { playSfx("select"); setShowNewPin((s) => !s); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showNewPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {kioskMultiGate && (
              <div className="space-y-1.5">
                <Label className="text-xs">Gate</Label>
                <Select value={newGate ?? "none"} onValueChange={(v) => setNewGate(v === "none" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <span>{newGate ? (kioskGates.find((g) => g.id === newGate)?.name ?? newGate) : "No gate (accept all)"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No gate (accept all)</SelectItem>
                    {kioskGates.filter((g) => g.active).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("cancel"); setAddOpen(false); }}
            >
              Cancel
            </Button>
            <Button
              data-sfx-own=""
              onMouseEnter={() => { if (newName.trim() && newPin.length >= 4 && !busy) playSfx("hover"); }}
              onClick={() => { if (newName.trim() && newPin.length >= 4 && !busy) { playSfx("select"); handleAdd(); } }}
              disabled={busy || !newName.trim() || newPin.length < 4}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Kiosk Dialog */}
      <Dialog open={!!editKiosk} onOpenChange={(o) => !o && setEditKiosk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Kiosk</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kiosk Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New PIN (leave blank to keep current)</Label>
              <div className="relative">
                <Input type={showEditPin ? "text" : "password"} inputMode="numeric" value={editPin} onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Unchanged" className="h-8 pr-9 text-sm" />
                <button
                  type="button"
                  data-sfx-own=""
                  onMouseEnter={() => playSfx("hover")}
                  onClick={() => { playSfx("select"); setShowEditPin((s) => !s); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showEditPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {kioskMultiGate && (
              <div className="space-y-1.5">
                <Label className="text-xs">Gate</Label>
                <Select value={editGate ?? "none"} onValueChange={(v) => setEditGate(v === "none" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <span>{editGate ? (kioskGates.find((g) => g.id === editGate)?.name ?? editGate) : "No gate (accept all)"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No gate (accept all)</SelectItem>
                    {kioskGates.filter((g) => g.active).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("cancel"); setEditKiosk(null); }}
            >
              Cancel
            </Button>
            <Button
              data-sfx-own=""
              onMouseEnter={() => { if (editName.trim() && !busy) playSfx("hover"); }}
              onClick={() => { if (editName.trim() && !busy) { playSfx("select"); handleEditSave(); } }}
              disabled={busy || !editName.trim()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Kiosk confirmation */}
      <Dialog open={!!deleteKioskConfirm} onOpenChange={(o) => !o && setDeleteKioskConfirm(null)}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Kiosk?</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteKioskConfirm?.name}</strong>?
              The kiosk URL will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("cancel"); setDeleteKioskConfirm(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={async () => {
                if (deleteKioskConfirm) {
                  playSfx("delete");
                  await handleDelete(deleteKioskConfirm.id, deleteKioskConfirm.name);
                  setDeleteKioskConfirm(null);
                }
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </CollapsibleSection>
  );
}
