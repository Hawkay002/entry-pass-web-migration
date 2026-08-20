// components/landing/Nav.tsx — glass nav over Starfield, matches the app shell.
// Desktop: pill links + CTAs. Mobile: React Bits BubbleMenu (bouncing pills).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BubbleMenu from "@/components/BubbleMenu";
import { NAV_LINKS, WHATSAPP_URL } from "./data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const bubbleItems = [
    ...NAV_LINKS.map((link, i) => ({
      label: link.label.toLowerCase(),
      href: link.href,
      ariaLabel: link.label,
      rotation: i % 2 === 0 ? -8 : 8,
      hoverStyles: { bgColor: "#3b82f6", textColor: "#ffffff" },
    })),
    {
      label: "log in",
      href: "/login",
      ariaLabel: "Log in",
      rotation: 8,
      hoverStyles: { bgColor: "#10b981", textColor: "#ffffff" },
    },
    {
      label: "request access",
      href: WHATSAPP_URL,
      ariaLabel: "Request access",
      rotation: -8,
      hoverStyles: { bgColor: "#8b5cf6", textColor: "#ffffff" },
    },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Desktop glass pill */}
      <div className="flex justify-center px-4 pt-4">
        <nav
          className={cn(
            "glass-pill hidden w-full max-w-5xl items-center justify-between gap-4 rounded-2xl px-5 py-3 transition-all duration-500 md:flex",
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
          <div className="flex items-center gap-1">
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
          <div className="flex items-center gap-2">
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
        </nav>
      </div>

      {/* Mobile — BubbleMenu (logo bubble + hamburger bubble, pills pop out) */}
      <div className="md:hidden [&_.bubble-menu]:px-4 [&_.bubble]:bg-[#141414] [&_.menu-line]:bg-[#f4f2ee]">
        <BubbleMenu
          useFixedPosition
          menuBg="#141414"
          menuContentColor="#f4f2ee"
          className="pt-4"
          logo={
            <span className="flex items-center gap-2 text-sm font-light tracking-tight text-[#f4f2ee]">
              <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
              Ticketing<span className="font-semibold">System</span>.
            </span>
          }
          items={bubbleItems}
        />
      </div>
    </header>
  );
}
