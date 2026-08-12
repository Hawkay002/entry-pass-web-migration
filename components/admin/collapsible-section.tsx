// components/admin/collapsible-section.tsx — presentational collapsible wrapper.
// Pure CSS height animation via grid-template-rows (no JS measurement, no deps).

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "danger";
  className?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  variant = "default",
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          variant === "danger" ? "bg-destructive/10 text-destructive" : "bg-white/5 text-accent-secondary"
        )}>
          {icon}
        </span>
        <span className="flex-1">
          <span className={cn(
            "text-sm font-semibold",
            variant === "danger" && "text-destructive"
          )}>
            {title}
          </span>
        </span>
        {badge && <span className="mr-1">{badge}</span>}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Grid-row animation: grid-template-rows 0fr ↔ 1fr gives smooth
          height auto with zero JS measurement. Inline styles because
          Tailwind's grid-rows-* utilities use repeat() syntax, not bare fr. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-fluid"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
