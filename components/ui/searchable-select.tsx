// components/ui/searchable-select.tsx — searchable dropdown for long lists
// (timezones, country codes). Uses a button trigger + popover with a search
// input and scrollable list. Matches the existing Select styling.

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/sfx";

export interface SearchableOption {
  value: string;
  label: string;       // shown in the dropdown list
  triggerLabel?: string; // shown in the trigger button (shorter, e.g. just the code)
  flag?: string; // ISO 3166-1 alpha-2 lowercase for flag-icons (e.g. "in")
  key?: string;  // unique key (defaults to value, but should be unique for duplicates)
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  dropAlign = "left",
  mobileDropAlign,
  belowAlign = "left",
  panelWidth = "w-72",
  className,
}: {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** "below" = opens below (default), "right" = opens RIGHT centered, "left" = opens LEFT centered */
  dropAlign?: "below" | "left" | "right";
  /** Override dropAlign on mobile (sm breakpoint). e.g. dropAlign="left" + mobileDropAlign="below" */
  mobileDropAlign?: "below" | "left" | "right";
  /** When opening below, align to "left" (default) or "right" */
  belowAlign?: "left" | "right";
  /** Custom width class for the side panel (e.g. "w-72", "w-80") */
  panelWidth?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track mobile/desktop for responsive dropAlign.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const effectiveAlign = isMobile && mobileDropAlign ? mobileDropAlign : dropAlign;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear search on open
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        data-sfx-own=""
        onMouseEnter={() => playSfx("hover")}
        onClick={() => { playSfx("select"); setOpen((o) => !o); }}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm whitespace-nowrap transition-colors outline-none hover:bg-input/80 dark:bg-input/60 dark:hover:bg-input/80"
      >
        <span className={cn("flex min-w-0 items-center gap-1.5", !selected && "text-muted-foreground")}>
          {selected?.flag && <span className={cn("fi text-base leading-none shrink-0", `fi-${selected.flag}`)} />}
          <span className="truncate">{selected ? (selected.triggerLabel ?? selected.label) : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
          "absolute z-50 overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl",
          effectiveAlign === "right"
            ? `left-full top-1/2 ml-1 -translate-y-1/2 ${panelWidth}`
            : effectiveAlign === "left"
            ? `right-full top-1/2 mr-1 -translate-y-1/2 ${panelWidth}`
            : `${belowAlign === "right" ? "right-0" : "left-0"} top-full mt-1 ${panelWidth} min-w-[200px]`
        )}>
          {/* Search */}
          <div className="relative border-b border-white/10 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md bg-white/5 py-1.5 pl-7 pr-2 text-sm text-white outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No results
              </p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.key ?? opt.value + '-' + opt.flag}
                  type="button"
                  data-sfx-own=""
                  onClick={() => {
                    playSfx("select");
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    opt.value === value
                      ? "bg-accent-secondary/20 text-accent-secondary"
                      : "text-foreground hover:bg-white/10"
                  )}
                >
                  {opt.flag && <span className={cn("fi text-sm leading-none shrink-0", `fi-${opt.flag}`)} />}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
