// components/admin/gate-panel.tsx — two-level gate configuration UI.
// Admin creates categories (free text), then adds gate names inside each.
// Includes delete confirmation modals + inline gate name editing.
// Shown below Active Settings when multi-gate mode is saved ON.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { useGatesMode } from "@/hooks/use-gates";
import {
  addGateCategory,
  deleteGateCategory,
  createGate,
  updateGate,
  deleteGate,
} from "@/app/actions/gates";

type ConfirmTarget =
  | { type: "category"; name: string }
  | { type: "gate"; id: string; name: string }
  | null;

export function GatePanel() {
  const { settings } = useSettings();
  const { gates, loading } = useGatesMode();
  const categories: string[] = settings.gateCategories ?? [];

  const [newCategory, setNewCategory] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [newGate, setNewGate] = useState<Record<string, string>>({});
  const [newGateTypes, setNewGateTypes] = useState<Record<string, string[]>>({});
  const [addingGate, setAddingGate] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Delete confirmation modal
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  // Inline gate editing
  const [editGate, setEditGate] = useState<{ id: string; name: string; category: string; ticketTypes: string[] } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    setAddingCat(true);
    const res = await addGateCategory(newCategory);
    setAddingCat(false);
    if (res.ok) {
      setNewCategory("");
      toast.success("Category added");
    } else {
      toast.error("Failed", { description: res.error });
    }
  }

  async function confirmDelete() {
    if (!confirmTarget) return;
    if (confirmTarget.type === "category") {
      setBusy(`cat-${confirmTarget.name}`);
      const res = await deleteGateCategory(confirmTarget.name);
      setBusy(null);
      if (res.ok) toast.success(`Category "${confirmTarget.name}" deleted`);
      else toast.error("Failed to delete category");
    } else {
      setBusy(confirmTarget.id);
      const res = await deleteGate(confirmTarget.id);
      setBusy(null);
      if (res.ok) toast.success(`Gate "${confirmTarget.name}" deleted`);
      else toast.error("Failed");
    }
    setConfirmTarget(null);
  }

  async function handleAddGate(cat: string) {
    const name = (newGate[cat] ?? "").trim();
    if (!name) return;
    setAddingGate(cat);
    const types = newGateTypes[cat] ?? [];
    const res = await createGate(name, cat, types);
    setAddingGate(null);
    if (res.ok) {
      setNewGate((p) => ({ ...p, [cat]: "" }));
      setNewGateTypes((p) => ({ ...p, [cat]: [] }));
      toast.success("Gate added");
    } else {
      toast.error("Failed", { description: res.error });
    }
  }

  async function handleToggleGate(id: string, active: boolean) {
    setBusy(id);
    await updateGate(id, { active });
    setBusy(null);
  }

  async function handleSaveEdit() {
    if (!editGate || !editGate.name.trim()) return;
    setSavingEdit(true);
    const isGuestCat =
      editGate.category.toLowerCase().includes("guest") ||
      editGate.category.toLowerCase().includes("entry");
    const res = await updateGate(editGate.id, {
      name: editGate.name.trim(),
      ...(isGuestCat ? { ticketTypes: editGate.ticketTypes } : {}),
    });
    setSavingEdit(false);
    if (res.ok) {
      toast.success("Gate updated");
      setEditGate(null);
    } else {
      toast.error("Failed to update", { description: res.error });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add category */}
      <div className="flex items-center gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          placeholder="e.g. Guest Entry, Staff, Security"
        />
        <Button onClick={handleAddCategory} disabled={addingCat || !newCategory.trim()}>
          {addingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Category
        </Button>
      </div>

      {/* Category sections */}
      {categories.length === 0 ? (
        <p className="rounded-xl border border-white/8 bg-black/20 py-6 text-center text-sm text-muted-foreground">
          No categories yet. Create one above to start adding gates.
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catGates = gates.filter((g) => g.category === cat);
            return (
              <div
                key={cat}
                className="rounded-xl border border-white/8 bg-black/20 p-3"
              >
                {/* Category header */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{cat}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {catGates.length} gate{catGates.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => setConfirmTarget({ type: "category", name: cat })}
                      disabled={busy === `cat-${cat}`}
                      className="flex h-6 w-6 items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/10"
                      title="Delete category + its gates"
                    >
                      {busy === `cat-${cat}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Add gate field — right beneath the category name */}
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newGate[cat] ?? ""}
                      onChange={(e) =>
                        setNewGate((p) => ({ ...p, [cat]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleAddGate(cat)}
                      placeholder="Gate name (e.g. Gate A)"
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleAddGate(cat)}
                      disabled={addingGate === cat || !(newGate[cat] ?? "").trim()}
                    >
                      {addingGate === cat ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  {/* Ticket type multi-select — only for guest-entry-type categories */}
                  {(cat.toLowerCase().includes("guest") || cat.toLowerCase().includes("entry")) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.65rem] text-muted-foreground">Accepts:</span>
                    {(["Classic", "Diamond", "SVIP", "Gold"] as const).map((tt) => {
                      const selected = (newGateTypes[cat] ?? []).includes(tt);
                      const label = tt === "Diamond" ? "VIP" : tt === "Gold" ? "VVIP" : tt;
                      return (
                        <button
                          key={tt}
                          type="button"
                          onClick={() => {
                            setNewGateTypes((p) => {
                              const cur = p[cat] ?? [];
                              return {
                                ...p,
                                [cat]: selected ? cur.filter((x) => x !== tt) : [...cur, tt],
                              };
                            });
                          }}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.65rem] font-medium transition-colors",
                            selected
                              ? "bg-accent-secondary text-white"
                              : "bg-white/5 text-muted-foreground hover:bg-white/10"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>

                {/* Separator between add field and existing gates */}
                {catGates.length > 0 && (
                  <div className="my-2 border-t border-white/8" />
                )}

                {/* Gates inside this category */}
                {catGates.length > 0 && (
                  <div className="space-y-1">
                    {catGates.map((gate) => (
                      <div
                        key={gate.id}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5"
                      >
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          <span className="text-sm">{gate.name}</span>
                          {gate.ticketTypes.map((tt) => (
                            <span
                              key={tt}
                              className="rounded-full bg-accent-secondary/15 px-1.5 py-0 text-[0.6rem] font-medium text-accent-secondary"
                            >
                              {tt === "Diamond" ? "VIP" : tt === "Gold" ? "VVIP" : tt}
                            </span>
                          ))}
                        </div>
                        <Switch
                          checked={gate.active}
                          onCheckedChange={(v) => handleToggleGate(gate.id, v)}
                        />
                        <button
                          onClick={() => setEditGate({ id: gate.id, name: gate.name, category: cat, ticketTypes: gate.ticketTypes })}
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                          title="Rename gate"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setConfirmTarget({ type: "gate", id: gate.id, name: gate.name })}
                          disabled={busy === gate.id}
                          className="flex h-6 w-6 items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/10"
                          title="Delete gate"
                        >
                          {busy === gate.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal (category or gate) */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {confirmTarget?.type === "category" ? "Category" : "Gate"}?
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.type === "category" ? (
                <>
                  This will permanently delete <strong>{confirmTarget.name}</strong> and all
                  gates inside it. Tickets assigned to these gates will have their gate cleared.
                </>
              ) : (
                <>
                  This will permanently delete gate <strong>{confirmTarget?.name}</strong>.
                  Tickets assigned to it will have their gate cleared.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit gate modal (name + ticket types for guest-entry categories) */}
      <Dialog open={!!editGate} onOpenChange={(o) => !o && setEditGate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Gate Name</label>
              <Input
                value={editGate?.name ?? ""}
                onChange={(e) => setEditGate((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="Gate name"
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
            {/* Ticket type editor — only for guest-entry-type categories */}
            {editGate && (editGate.category.toLowerCase().includes("guest") || editGate.category.toLowerCase().includes("entry")) && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Accepts Ticket Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {(["Classic", "Diamond", "SVIP", "Gold"] as const).map((tt) => {
                    const selected = editGate?.ticketTypes.includes(tt) ?? false;
                    const label = tt === "Diamond" ? "VIP" : tt === "Gold" ? "VVIP" : tt;
                    return (
                      <button
                        key={tt}
                        type="button"
                        onClick={() => {
                          setEditGate((p) => {
                            if (!p) return p;
                            const cur = p.ticketTypes;
                            return {
                              ...p,
                              ticketTypes: selected
                                ? cur.filter((x) => x !== tt)
                                : [...cur, tt],
                            };
                          });
                        }}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                          selected
                            ? "bg-accent-secondary text-white"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditGate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editGate?.name.trim()}>
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
