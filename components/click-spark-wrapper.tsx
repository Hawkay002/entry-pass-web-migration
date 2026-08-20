// components/click-spark-wrapper.tsx — site-wide click sparks (React Bits
// ClickSpark), DESKTOP ONLY. Rendered as a plain pass-through div on mobile /
// touch devices so nothing changes there (taps don't produce desktop-style
// sparks, and the extra canvas layer is skipped entirely).

"use client";

import { useEffect, useState, type ReactNode } from "react";
import ClickSpark from "@/components/ClickSpark";

export default function ClickSparkWrapper({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => {
      // hover-capable pointer + desktop width — mirrors the (hover:hover)
      // media query but readable in JS, with a live resize listener.
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
