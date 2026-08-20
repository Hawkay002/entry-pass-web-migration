// components/click-spark-wrapper.tsx — site-wide click sparks (React Bits
// ClickSpark, adapted), DESKTOP ONLY. Pass-through on mobile/touch devices.
//
// The ClickSpark renders a fixed full-viewport canvas overlay (above all
// content, pointer-transparent) and listens at document level — so this
// wrapper no longer needs any layout classes; children render exactly as
// they would straight inside <body>.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import ClickSpark from "@/components/ClickSpark";

export default function ClickSparkWrapper({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => {
      const fine = window.matchMedia("(pointer: fine)").matches;
      const wide = window.innerWidth >= 768;
      setIsDesktop(fine && wide);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isDesktop) return <>{children}</>;

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
