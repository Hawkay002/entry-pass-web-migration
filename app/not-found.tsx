// app/not-found.tsx — custom 404 page matching the app's glass aesthetic.
// Shown for any unmatched route + notFound() calls.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Ticket } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-secondary/5 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* 404 hero */}
        <p
          className="text-8xl font-bold tracking-tighter text-white/10 sm:text-9xl"
          style={{ fontFamily: '"The Seasons", serif' }}
        >
          404
        </p>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Page not found
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
            If you're looking for your ticket, check the link in your WhatsApp message.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants(), "rounded-full")}
          >
            <Ticket className="mr-2 h-4 w-4" />
            Staff Login
          </Link>
        </div>
      </div>
    </div>
  );
}
