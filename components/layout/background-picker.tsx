// components/layout/background-picker.tsx — modal to pick a background image.
// Replaces the default Starfield across all app tabs when a preset is chosen.

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/sfx";
import { BACKGROUND_PRESETS, useBackground } from "@/hooks/use-background";

export function BackgroundPickerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-sfx-own=""
        onMouseEnter={() => playSfx("hover")}
        onClick={() => { playSfx("select"); setOpen(true); }}
        title="Change background"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
      >
        <HugeiconsIcon icon={Image03Icon} size={16} />
      </button>
      <BackgroundPickerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function BackgroundPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { bgId, setBackground } = useBackground();
  const [selected, setSelected] = useState(bgId);

  // Keep the selection synced with the live background whenever the dialog
  // opens or the background changes underneath.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync picker to live value
    setSelected(bgId);
  }, [bgId]);

  function handleConfirm() {
    setBackground(selected);
    const preset = BACKGROUND_PRESETS.find((p) => p.id === selected);
    toast.success(`Background set to ${preset?.label ?? "default"}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setSelected(bgId); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Background</DialogTitle>
          <DialogDescription>
            Choose a background for the app. Applies to all tabs on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[50vh] grid-cols-2 gap-4 overflow-y-auto py-2 pr-1 scrollbar-thin">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("select"); setSelected(preset.id); }}
              className={cn(
                "group relative h-24 w-full shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                selected === preset.id
                  ? "border-accent-secondary ring-2 ring-accent-secondary/40"
                  : "border-white/10 hover:border-white/30"
              )}
            >
              {preset.thumb ? (
                // Tiny WebP thumbnail (~5KB) — instant load. Full-res PNG only
                // fetches when selected as the active background.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preset.thumb}
                  alt={preset.label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#050505]">
                  {/* Mini starfield preview */}
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className="h-0.5 w-0.5 rounded-full bg-white/50"
                        style={{ animation: `twinkle 2s ${i * 0.3}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[0.65rem] font-medium text-white">
                {preset.label}
              </span>
            </button>
          ))}
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
            onMouseEnter={() => playSfx("hover")}
            onClick={() => { playSfx("select"); handleConfirm(); }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
