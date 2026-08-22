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
  getCue,
  type CueName,
  type PlayingSFX,
  type UISFXPlayer,
} from "uisfx";

let player: UISFXPlayer | null = null;
let ctx: AudioContext | null = null;
let unlockWired = false;
let processingLoop: PlayingSFX | null = null;
let scanningLoop: PlayingSFX | null = null;
/** True once OUR context has reached the "running" state at least once. */
let everRan = false;
/** Coarse-pointer (phone/tablet) devices get an extra boost — small
 *  speakers lose a lot of the quiet synthesized cues. */
let volumeMult = 1;

/** Global loudness boost applied on top of each cue's default volume.
 *  uisfx cue defaults are conservative (0.06–0.26); 2.2x reads as
 *  "clearly audible" without clipping (values clamp at 1.0). */
const CUE_BOOST = 2.2;

function detectMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** The app-wide player (organic personality). We create the AudioContext
 *  OURSELVES and hand it to uisfx — that lets us eagerly attempt resume()
 *  at the right moments and inspect the state (blocked vs running). */
export function sfx(): UISFXPlayer {
  if (!player) {
    if (typeof window !== "undefined" && !ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC({ latencyHint: "interactive" });
        ctx.addEventListener("statechange", () => {
          if (ctx?.state === "running") everRan = true;
        });
      }
    }
    if (typeof window !== "undefined" && volumeMult === 1 && detectMobile()) {
      volumeMult = 1.5;
    }
    player = createUISFX({
      pack: "organic",
      volume: Math.min(1, 1.0 * volumeMult),
      ...(ctx ? { context: ctx } : {}),
    });
  }
  return player;
}

/** Try to resume the context. Safe to call anywhere; resolves when the
 *  attempt settles. Outside a user gesture some browsers keep it suspended. */
export async function resumeCtx(): Promise<boolean> {
  sfx(); // ensure ctx exists
  const c = ctx;
  if (!c) return false;
  const state = c.state as AudioContext["state"];
  if (state === "running") return true;
  try {
    await c.resume();
  } catch {}
  return (c.state as AudioContext["state"]) === "running";
}

/** Diagnostic state (used for debugging audio-unlock issues). */
export function sfxState(): { ctxState: string | null; everRan: boolean } {
  return { ctxState: ctx ? ctx.state : null, everRan };
}

if (typeof window !== "undefined") {
  // Console-accessible audio diagnostic: window.__sfxState()
  (window as unknown as { __sfxState?: () => { ctxState: string | null; everRan: boolean } }).__sfxState = sfxState;
}

/** Wire one-time gesture listeners that unlock audio on ANY device.
 *  Mobile browsers only allow audio started inside a user gesture — this
 *  catches the first tap/click/keypress anywhere on the page. */
export function ensureSfxUnlock() {
  if (unlockWired || typeof window === "undefined") return;
  unlockWired = true;
  sfx(); // create the context eagerly so the gesture can start it
  const unlock = () => {
    resumeCtx();
    sfx()
      .unlock()
      .catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

let pressWired = false;

/** Global "press" cue on EVERY click — except on elements marked
 *  `data-sfx-own` (or inside one), which carry their own click sound
 *  (e.g. the login buttons playing "select") and must not double-fire.
 *  Capture phase at document level so it fires before page handlers and
 *  survives stopPropagation. */
export function ensureGlobalPressSfx() {
  if (pressWired || typeof document === "undefined") return;
  pressWired = true;
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-sfx-own]")) return;
      playSfx("press");
    },
    true
  );
}

/** One-call SFX bootstrap for the whole app: gesture unlock + global press. */
export function initSfx() {
  ensureSfxUnlock();
  ensureGlobalPressSfx();
}

/** Fire-and-forget one-shot cue. Never throws. Each cue's default volume
 *  is boosted by CUE_BOOST (clamped at 1.0) so everything reads louder. */
export function playSfx(cue: CueName) {
  try {
    let vol = 1;
    try {
      vol = Math.min(1, getCue(cue).defaultVolume * CUE_BOOST);
    } catch {}
    sfx().play(cue, { volume: vol });
  } catch {}
}

/** Sonner toasts ALWAYS use the notification cue (house rule). */
export function playToastSfx() {
  playSfx("notification");
}

/** Try to unlock audio outside a gesture — e.g. returning from an OAuth
 *  redirect, where the earlier click's activation may or may not have
 *  carried over the navigation. No-op if already unlocked; silently
 *  still-blocked on browsers that demand a fresh gesture. */
export function unlockSfx() {
  resumeCtx();
  try {
    sfx().unlock().catch(() => {});
  } catch {}
}

/** Start the shared processing loop (loading states). Stops any previous.
 *  The processing cue's pack default is the quietest of all cues (a
 *  background bed) — boosted here so it stays audible on phone speakers. */
export function startProcessingSfx() {
  stopProcessingSfx();
  try {
    processingLoop = sfx().play("processing", { volume: Math.min(1, 0.5 * volumeMult) });
  } catch {}
}

/** Stop the shared processing loop. Never throws. */
export function stopProcessingSfx() {
  try {
    processingLoop?.stop();
  } catch {}
  processingLoop = null;
}

/** Start the shared scanning loop (camera feed active). Boosted like the
 *  processing loop so it reads on phone speakers. Stops any previous. */
export function startScanningSfx() {
  stopScanningSfx();
  try {
    scanningLoop = sfx().play("scanning", { volume: Math.min(1, 0.45 * volumeMult) });
  } catch {}
}

/** Stop the shared scanning loop. Never throws. */
export function stopScanningSfx() {
  try {
    scanningLoop?.stop();
  } catch {}
  scanningLoop = null;
}
