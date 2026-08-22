// components/sfx-provider.tsx — app-wide SFX bootstrap (organic pack).
// Mounted once in the root layout: wires the gesture-based audio unlock
// (mobile requirement) and the global "press" cue for clicks on elements
// that don't carry their own sound. Renders nothing.

"use client";

import { useEffect } from "react";
import { initSfx, applyPersistedSfxPreference } from "@/lib/sfx";

export function SfxProvider() {
  useEffect(() => {
    initSfx();
    applyPersistedSfxPreference();
  }, []);
  return null;
}
