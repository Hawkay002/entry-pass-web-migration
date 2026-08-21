// lib/sfx.ts — global UI sound-effects singleton (uisfx, ORGANIC pack).
//
// One player for the whole app so pack/volume are set in a single place.
// Playback is Web Audio synthesized (no fetches); the AudioContext is created
// lazily and MUST be unlocked from inside a real user gesture — iOS/Android
// browsers permanently block audio otherwise. ensureSfxUnlock() wires
// one-time pointer/touch/key listeners that call unlock(); it is safe to call
// repeatedly (idempotent) and every play call is try/catch-guarded so a
// blocked/old AudioContext can never crash the UI.

"use client";

import {
  createUISFX,
  type CueName,
  type PlayingSFX,
  type UISFXPlayer,
} from "uisfx";

let player: UISFXPlayer | null = null;
let unlockWired = false;
let processingLoop: PlayingSFX | null = null;

/** The app-wide player (organic personality). Created lazily, client-side. */
export function sfx(): UISFXPlayer {
  if (!player) {
    player = createUISFX({ pack: "organic", volume: 0.8 });
  }
  return player;
}

/** Wire one-time gesture listeners that unlock audio on ANY device.
 *  Mobile browsers only allow audio started inside a user gesture — this
 *  catches the first tap/click/keypress anywhere on the page. */
export function ensureSfxUnlock() {
  if (unlockWired || typeof window === "undefined") return;
  unlockWired = true;
  const unlock = () => {
    sfx()
      .unlock()
      .catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

/** Fire-and-forget one-shot cue. Never throws. */
export function playSfx(cue: CueName) {
  try {
    sfx().play(cue);
  } catch {}
}

/** Sonner toasts ALWAYS use the notification cue (house rule). */
export function playToastSfx() {
  playSfx("notification");
}

/** Start the shared processing loop (loading states). Stops any previous. */
export function startProcessingSfx() {
  stopProcessingSfx();
  try {
    processingLoop = sfx().play("processing");
  } catch {}
}

/** Stop the shared processing loop. Never throws. */
export function stopProcessingSfx() {
  try {
    processingLoop?.stop();
  } catch {}
  processingLoop = null;
}
