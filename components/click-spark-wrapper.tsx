// components/click-spark-wrapper.tsx — site-wide click sparks (React Bits
// ClickSpark), DESKTOP ONLY. Pass-through on mobile/touch devices.
//
// LAYOUT NOTE: the wrapper carries the layout classes the body used to apply
// to its direct child (flex min-h-full flex-col), so pages render
// identically whether or not the spark layer is active — and the canvas
// covers the full page height instead of collapsing to 0.

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

  if (!isDesktop) {
    return <div className="flex min-h-full flex-col">{children}</div>;
  }

  return (
    <ClickSpark
      sparkColor="rgba(244, 242, 238, 0.85)"
      sparkSize={10}
      sparkRadius={18}
      sparkCount={8}
    >
      <div className="flex min-h-full flex-col">{children}</div>
    </ClickSpark>
  );
}
