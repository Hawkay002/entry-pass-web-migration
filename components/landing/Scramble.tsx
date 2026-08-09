"use client";

import { useEffect, useRef, useState } from "react";

const DIGIT_POOL = "0123456789";
const LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomCharLike(char: string) {
  if (/[0-9]/.test(char)) {
    return DIGIT_POOL[Math.floor(Math.random() * DIGIT_POOL.length)];
  }
  if (/[a-zA-Z]/.test(char)) {
    return LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
  }
  return char;
}

interface ScrambleProps {
  text: string;
  className?: string;
  delay?: number;
}

export function Scramble({ text, className = "", delay = 0 }: ScrambleProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(text);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const timeout = setTimeout(() => {
      let frame = 0;
      const totalFrames = 10;
      const interval = setInterval(() => {
        frame += 1;
        if (frame >= totalFrames) {
          setDisplay(text);
          clearInterval(interval);
          return;
        }
        const lockedChars = Math.floor((frame / totalFrames) * text.length);
        setDisplay(
          text
            .split("")
            .map((char, i) =>
              i < lockedChars || char === " " ? char : randomCharLike(char)
            )
            .join("")
        );
      }, 45);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [started, text, delay]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
