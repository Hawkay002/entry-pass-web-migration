// components/landing/Nav.tsx — glass nav over Starfield, matches the app shell.
// Outfit wordmark, sentence-case links, shadcn Button CTA.

"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { NAV_LINKS, WHATSAPP_URL } from "./data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "glass-pill flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl px-5 py-3 transition-all duration-500",
          scrolled ? "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]" : "shadow-none"
        )}
      >
        {/* Wordmark — matches the app header exactly */}
        <Link href="#top" className="flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success-green" />
          </span>
          <span className="text-xl font-light tracking-tight">
            Ticketing<span className="font-semibold">System</span>.
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const external = link.href.startsWith("http");
            return (
              <a
                key={link.href}
                href={link.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            );
          })}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          <a
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Log in
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Request access
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-white md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="glass-surface absolute inset-x-4 top-20 z-40 rounded-2xl p-3 md:hidden">
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => {
              const external = link.href.startsWith("http");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </a>
              );
            })}
            <a
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              Log in
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "sm" }), "w-full")}
            >
              Request access
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
