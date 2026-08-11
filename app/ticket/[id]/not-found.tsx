// app/ticket/[id]/not-found.tsx — ticket-specific 404.
// Shown when a guest opens /ticket/{id} and the ticket doesn't exist.
// More helpful than the generic 404 — tells the guest to check their link.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TicketX, MessageCircle } from "lucide-react";

export default function TicketNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-secondary/5 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <TicketX className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1
            className="text-3xl font-bold tracking-tight text-white"
            style={{ fontFamily: '"The Seasons", serif' }}
          >
            Ticket not found
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This ticket link is invalid or the ticket has been removed.
            Please check the link in your WhatsApp message, or contact the
            event organizer if you believe this is an error.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://wa.me/918777845713"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants(), "rounded-full")}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Contact Organizer
          </a>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
