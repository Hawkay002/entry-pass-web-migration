// components/admin/panels/factory-reset-panel.tsx — standalone "Danger Zone" card.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { factoryReset } from "@/app/actions/admin";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { playSfx, playToastSfx, startProcessingSfx, stopProcessingSfx } from "@/lib/sfx";

export function FactoryResetPanel() {
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    startProcessingSfx();
    const res = await factoryReset();
    setResetting(false);
    stopProcessingSfx();
    setConfirmOpen(false);
    setConfirmText("");
    if (res.ok) {
      playSfx("delete");
      playToastSfx();
      toast.success("Database reset complete");
    } else {
      playSfx("error");
      playToastSfx();
      toast.error("Reset failed", { description: res.error });
    }
  }

  return (
    <div className="glass-panel overflow-hidden border-destructive/20">
      <CollapsibleSection
        icon={<Trash2 className="h-4 w-4" />}
        title="Factory Reset"
        variant="danger"
      >
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            Factory reset permanently deletes all tickets, settings, roles, gates, kiosks,
            logs, and locks. An immutable audit record is preserved. This cannot be undone.
          </p>
          <Button
            variant="destructive"
            data-sfx-own=""
            disabled={resetting}
            onMouseEnter={() => { if (!resetting) playSfx("hover"); }}
            onClick={() => { if (!resetting) { playSfx("delete"); setConfirmOpen(true); } }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Reset Database
          </Button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="border-destructive">
            <DialogHeader>
              <DialogTitle className="text-destructive">Factory Reset?</DialogTitle>
              <DialogDescription>
                Type <strong>RESET</strong> to confirm. All data will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="border-destructive/30"
            />
            <DialogFooter>
              <Button
                variant="ghost"
                data-sfx-own=""
                onMouseEnter={() => playSfx("hover")}
                onClick={() => { playSfx("cancel"); setConfirmOpen(false); setConfirmText(""); }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                data-sfx-own=""
                onClick={() => { if (confirmText === "RESET" && !resetting) { playSfx("delete"); handleReset(); } }}
                disabled={resetting || confirmText !== "RESET"}
                onMouseEnter={() => { if (confirmText === "RESET" && !resetting) playSfx("hover"); }}
              >
                {resetting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                Reset Everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CollapsibleSection>
    </div>
  );
}
