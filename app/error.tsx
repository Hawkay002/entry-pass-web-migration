// app/error.tsx — global error boundary. Catches runtime errors anywhere in
// the app and shows a recovery screen instead of a white crash.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/5 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Something went wrong
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Try refreshing the page — if the
            problem persists, contact the event organizer.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className={cn(buttonVariants(), "rounded-full")}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
        </div>

        {error.digest && (
          <p className="font-mono text-[0.65rem] text-muted-foreground/50">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
