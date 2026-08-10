// components/layout/easter-egg.tsx — konami-style sequence plays music.mp3.
// Mirrors the original easterEggAudio (script.js:43) toggle.

"use client";

import { useEffect, useRef } from "react";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function EasterEgg() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let pos = 0;
    let active = false;

    function onKey(e: KeyboardEvent) {
      // e.key can be undefined for some synthetic/auto-repeat key events — guard it.
      const raw = e.key;
      if (!raw) return;
      const key = raw.length === 1 ? raw.toLowerCase() : raw;
      if (key === SEQUENCE[pos]) {
        pos++;
        if (pos === SEQUENCE.length) {
          pos = 0;
          active = !active;
          const audio = audioRef.current;
          if (!audio) return;
          if (active) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          } else {
            audio.pause();
          }
        }
      } else {
        pos = key === SEQUENCE[0] ? 1 : 0;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <audio ref={audioRef} src="/music.mp3" loop preload="none" />;
}
