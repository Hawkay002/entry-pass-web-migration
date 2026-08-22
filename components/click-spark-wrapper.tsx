// components/click-spark-wrapper.tsx — site-wide click sparks (React Bits
// ClickSpark, adapted). Runs on ALL devices (desktop + mobile/touch).
//
// The ClickSpark renders a fixed full-viewport canvas overlay (above all
// content, pointer-transparent) and listens at document level ('click'
// fires for taps too) — so this wrapper needs no layout classes; children
// render exactly as they would straight inside <body>.

"use client";

import type { ReactNode } from "react";
import ClickSpark from "@/components/ClickSpark";

export default function ClickSparkWrapper({ children }: { children: ReactNode }) {
  return (
    <ClickSpark
      sparkColor="rgba(244, 242, 238, 0.85)"
      sparkSize={10}
      sparkRadius={18}
      sparkCount={8}
    >
      {children}
    </ClickSpark>
  );
}
