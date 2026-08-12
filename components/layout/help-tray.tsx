// components/layout/help-tray.tsx — slide-out quick-help contact tray.
// Contacts are stored in Firestore (help_contacts collection).
// Admin can add/delete contacts from the Configuration page.

"use client";

import { useState } from "react";
import { Headset, ChevronLeft, X, Phone, Trash2, UserPlus, Pencil } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { WhatsappIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { useContacts } from "@/hooks/use-contacts";
import { createContact, deleteContact, updateContact } from "@/app/actions/contacts";

export function HelpTray({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const { contacts, loading } = useContacts(open);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ role: "", name: "", phone: "", whatsapp: "", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ role: "", name: "", phone: "", whatsapp: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  return (
    <div
      className={cn(
        "fixed right-0 top-[70%] z-50 flex max-h-[45vh] w-[300px] flex-col -translate-y-1/2 rounded-l-[20px] border border-r-0 border-white/20 bg-black shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-400 sm:top-1/2 sm:max-h-[65vh]",
        open ? "translate-x-0" : "translate-x-full"
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
    >
      {/* Handle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute -left-10 top-1/2 flex h-20 w-10 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-l-xl border border-white/20 bg-[#0f0f0f] text-white shadow-[-5px_0_15px_rgba(0,0,0,0.3)] transition-colors hover:bg-[#1a1a1a]"
        aria-label="Quick Help"
      >
        {open ? <X className="h-5 w-5" /> : <Headset className="h-5 w-5" />}
        <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {/* Content */}
      <div className="overflow-y-auto p-6 scrollbar-thin">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Help Tray</h2>
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-secondary/10 text-accent-secondary transition-colors hover:bg-accent-secondary/20"
              title="Add contact"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contacts yet. Admin can add them in Configuration.
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="relative rounded-xl bg-white/5 p-3">
                {isAdmin && (
                  <div className="absolute right-2 top-2 flex gap-2">
                    <button
                      onClick={() => {
                        setEditId(c.id);
                        setEditForm({ role: c.role, name: c.name, phone: c.phone || "", whatsapp: c.whatsapp || "", description: c.description });
                        setEditOpen(true);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition-colors hover:text-accent-secondary hover:border-accent-secondary/30"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: c.id, name: c.name })}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <p className="text-sm font-semibold">{c.role}</p>
                <p className="text-sm text-accent-secondary">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                {(c.phone || c.whatsapp) && (
                  <div className="mt-2 flex gap-2">
                    {c.whatsapp && (
                      <a
                        href={`https://wa.me/${c.whatsapp}`}
                        target="_blank"
                        className="flex items-center gap-1 rounded-lg bg-[#25D366]/20 px-2 py-1 text-xs text-[#25D366]"
                      >
                        <HugeiconsIcon icon={WhatsappIcon} size={12} /> WhatsApp
                      </a>
                    )}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1 rounded-lg bg-accent-secondary/20 px-2 py-1 text-xs text-accent-secondary"
                      >
                        <Phone className="h-3 w-3" /> Call
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add contact dialog (admin only) */}
      {isAdmin && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Help Contact</DialogTitle>
              <DialogDescription>This person will appear in the Quick Help Tray.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Role / Title</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Event Manager" />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="91..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this person helps with" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                if (!form.role.trim() || !form.name.trim()) { toast.error("Role and name required"); return; }
                const res = await createContact({
                  role: form.role, name: form.name,
                  phone: form.phone || undefined, whatsapp: form.whatsapp || undefined,
                  description: form.description || "Contact for assistance.",
                });
                if (res.ok) { toast.success("Contact added"); setForm({ role: "", name: "", phone: "", whatsapp: "", description: "" }); setAddOpen(false); }
                else toast.error("Failed", { description: res.error });
              }}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit contact dialog (admin only) */}
      {isAdmin && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>Update this contact&apos;s details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Role / Title</Label>
                <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+91..." />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} placeholder="91..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                if (!editForm.role.trim() || !editForm.name.trim()) { toast.error("Role and name required"); return; }
                const res = await updateContact(editId!, {
                  role: editForm.role, name: editForm.name,
                  phone: editForm.phone || undefined, whatsapp: editForm.whatsapp || undefined,
                  description: editForm.description || "Contact for assistance.",
                });
                if (res.ok) { toast.success("Contact updated"); setEditOpen(false); }
                else toast.error("Failed", { description: res.error });
              }}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation (admin only) */}
      {isAdmin && (
        <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
          <DialogContent className="border-destructive">
            <DialogHeader>
              <DialogTitle className="text-destructive">Remove Contact?</DialogTitle>
              <DialogDescription>
                Remove <strong>{deleteConfirm?.name}</strong> from the help tray? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={async () => {
                if (deleteConfirm) {
                  const res = await deleteContact(deleteConfirm.id);
                  if (res.ok) toast.success("Contact removed");
                  else toast.error("Failed");
                }
                setDeleteConfirm(null);
              }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
export function ContactManagementPanel() {
  const { contacts, loading } = useContacts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role: "", name: "", phone: "", whatsapp: "", description: "" });

  async function handleAdd() {
    if (!form.role.trim() || !form.name.trim()) {
      toast.error("Role and name are required");
      return;
    }
    const res = await createContact({
      role: form.role,
      name: form.name,
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      description: form.description || "Contact for assistance.",
    });
    if (res.ok) {
      toast.success("Contact added");
      setForm({ role: "", name: "", phone: "", whatsapp: "", description: "" });
      setOpen(false);
    } else {
      toast.error("Add failed", { description: res.error });
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteContact(id);
    if (res.ok) toast.success("Contact removed");
    else toast.error("Delete failed");
  }

  return (
    <div className="border-t border-white/5 pt-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Help Contacts</h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Add Contact
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-1.5 text-sm"
            >
              <div>
                <span className="font-medium">{c.role}: {c.name}</span>
                <span className="ml-2 text-muted-foreground">{c.phone || c.whatsapp || "—"}</span>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Help Contact</DialogTitle>
            <DialogDescription>This person will appear in the Quick Help Tray.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Role / Title</Label>
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Event Manager" />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
              </div>
              <div className="flex-1 space-y-2">
                <Label>WhatsApp (optional)</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="91..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this person helps with" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
