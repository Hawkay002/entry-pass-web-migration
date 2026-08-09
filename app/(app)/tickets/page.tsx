// app/(app)/tickets/page.tsx — Issue Ticket: form + live ticket preview.

"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserRound, Smartphone, Tickets, ExternalLink, CheckCircle2 } from "lucide-react";
import { FaVenusMars } from "react-icons/fa6";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddInvoiceIcon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LockedTab } from "@/components/layout/locked-tab";
import { useLockedTabs } from "@/components/layout/locked-tabs-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import { createTicket } from "@/app/actions/tickets";
import { sortedCountryCodes, DEFAULT_DIAL_CODE } from "@/lib/country-codes";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TicketCard } from "@/components/tickets/ticket-card";
import { captureTicketAsJpeg } from "@/lib/capture-ticket";
import type { Gender, Ticket, TicketType } from "@/lib/types";

// Custom calendar-date-1 inline SVG (age icon).
function CalendarDateIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path d="M16 2V6M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 18H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18V14.4878C12 13.6127 12 13.1752 11.7927 13.0367C11.5854 12.8981 11.3236 13.1606 10.8 13.6856L10.5 13.9864" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  gender: z.enum(["Male", "Female", "Other"]),
  age: z
    .string()
    .min(1, "Enter a valid age")
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 120, {
      message: "Enter a valid age (1–120)",
    }),
  phone: z
    .string()
    .min(10, "Enter 10 digits")
    .regex(/^\d{10}$/, "Must be exactly 10 digits"),
  ticketType: z.enum(["Classic", "Diamond", "SVIP", "Gold"]),
});
type FormValues = z.infer<typeof schema>;

export default function TicketsPage() {
  const { settings } = useSettings();
  const [preview, setPreview] = useState<
    Pick<Ticket, "id" | "name" | "age" | "gender" | "phone" | "ticketType">
  >({
    id: "—",
    name: "",
    age: 0,
    gender: "Male",
    phone: "",
    ticketType: "Classic",
  });
  const [isSharing, setIsSharing] = useState(false);
  const [ticketTypeVal, setTicketTypeVal] = useState<TicketType>("Classic");
  const [genderVal, setGenderVal] = useState<Gender>("Male");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);

  async function handleShare() {
    if (preview.id === "—") return;
    setIsSharing(true);
    try {
      const digits = preview.phone.replace(/\D/g, "");
      const ticketUrl = `${window.location.origin}/ticket/${preview.id}`;
      const message = `Hello ${preview.name}, here is your Entry Pass 🎫 (shader disabled for preview images)\n*Keep this QR code ready at the entrance.*\n\nView your interactive ticket:\n${ticketUrl}\n\nEnter your full phone number with country code (e.g. ${dialCode}${preview.phone}) to unlock your ticket.`;
      window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    } catch {
      toast.error("Could not open WhatsApp");
    } finally {
      setIsSharing(false);
    }
  }

  const lockedTabs = useLockedTabs();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      gender: "Male",
      age: "",
      phone: "",
      ticketType: "Classic",
    },
  });

  // Preview only reflects the last *generated* ticket — no live-typing preview.
  const livePreview = preview;

  async function onSubmit(values: FormValues) {
    const res = await createTicket({
      name: values.name,
      gender: values.gender,
      age: Number(values.age),
      phone: values.phone,
      ticketType: values.ticketType,
      dialCode,
    });
    if (res.ok) {
      setPreview({
        id: res.id,
        name: values.name,
        age: Number(values.age),
        gender: values.gender,
        phone: dialCode + values.phone,
        ticketType: values.ticketType,
      });
      toast.success("Pass generated", { description: values.name });
      reset();
      setValue("gender", "Male");
      setValue("ticketType", "Classic");
    } else {
      toast.error("Could not issue pass", { description: res.error });
    }
  }

  if (lockedTabs.includes("create")) {
    return <LockedTab tabName="Issue Ticket" />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">New Guest Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> Full Name
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Full Name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Phone
              </Label>
              <div className="flex gap-2">
                <SearchableSelect
                  value={dialCode}
                  onChange={setDialCode}
                  options={sortedCountryCodes.map((c) => ({
                    value: c.code,
                    label: `${c.code} ${c.country}`,
                    triggerLabel: c.code,
                    flag: c.iso,
                    key: c.iso,
                  }))}
                  placeholder="Code"
                  dropAlign="right"
                  panelWidth="w-56"
                  className="w-[110px] shrink-0"
                />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  {...register("phone")}
                  placeholder="Phone Number"
                  className="flex-1"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="grid grid-cols-[1fr_1fr_1fr] gap-1">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Tickets className="h-3.5 w-3.5" /> Type
                </Label>
                <Select
                  value={ticketTypeVal}
                  onValueChange={(v) => {
                    const t = (v ?? "Classic") as TicketType;
                    setTicketTypeVal(t);
                    setValue("ticketType", t);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {ticketTypeVal === "Diamond"
                        ? "VIP"
                        : ticketTypeVal === "SVIP"
                        ? "SVIP"
                        : ticketTypeVal === "Gold"
                        ? "VVIP"
                        : "Classic"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false} className="min-w-[120px]">
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Diamond">VIP</SelectItem>
                    <SelectItem value="SVIP">SVIP</SelectItem>
                    <SelectItem value="Gold">VVIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FaVenusMars className="text-xs" /> Gender
                </Label>
                <Select
                  value={genderVal}
                  onValueChange={(v) => {
                    const g = (v ?? "Male") as Gender;
                    setGenderVal(g);
                    setValue("gender", g);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false} className="min-w-[120px]">
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age" className="flex items-center gap-1">
                  <CalendarDateIcon size={14} /> Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  min={1}
                  {...register("age")}
                  placeholder="Age"
                />
                {errors.age && (
                  <p className="text-xs text-destructive">{errors.age.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <HugeiconsIcon icon={AddInvoiceIcon} size={16} className="mr-2" />
              )}
              Generate Pass
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {preview.id !== "—" ? (
          <ConfirmationPanel
            ticket={preview}
            eventName={settings.name || undefined}
            venue={settings.place || undefined}
            isSharing={isSharing}
            onShare={handleShare}
            onIssueAnother={() => {
              setPreview({ id: "—", name: "", age: 0, gender: "Male", phone: "", ticketType: "Classic" });
              reset();
              setValue("gender", "Male");
              setValue("ticketType", "Classic");
            }}
          />
        ) : (
          <div className="glass-panel flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            <span>Fill the form and click <span className="font-medium text-foreground">Generate Pass</span> to issue a ticket.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation panel shown after a ticket is created. Renders the LIVE ticket
 * (admin sees exactly what the guest will see) and auto-captures a JPEG
 * snapshot for the OG share preview. Capture is fire-and-forget — a failure
 * degrades to the SVG fallback OG image and never blocks issuance.
 */
function ConfirmationPanel({
  ticket,
  eventName,
  venue,
  isSharing,
  onShare,
  onIssueAnother,
}: {
  ticket: Pick<Ticket, "id" | "name" | "age" | "gender" | "phone" | "ticketType">;
  eventName?: string;
  venue?: string;
  isSharing: boolean;
  onShare: () => void;
  onIssueAnother: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [captured, setCaptured] = useState<null | "done" | "failed">(null);

  // Auto-capture the OG snapshot once the live shader ticket has drawn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const el = cardRef.current;
      if (!el) return;
      const jpeg = await captureTicketAsJpeg(el);
      if (cancelled || !jpeg) {
        if (!cancelled) setCaptured("failed");
        return;
      }
      // Fire-and-forget upload. Never throw.
      fetch("/api/og-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, image: jpeg }),
      })
        .then(() => !cancelled && setCaptured("done"))
        .catch(() => !cancelled && setCaptured("failed"));
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.id]);

  return (
    <div className="glass-panel flex flex-1 flex-col items-center gap-5 p-6 text-center">
      {/* Success header */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-green/20">
          <CheckCircle2 className="h-6 w-6 text-success-green" />
        </div>
        <h3 className="text-lg font-semibold">Pass Generated</h3>
        <p className="text-sm text-muted-foreground">
          Ticket for <span className="font-medium text-foreground">{ticket.name}</span> is ready to share.
        </p>
      </div>

      {/* Live ticket preview (also the capture source). Wide enough that the
          full landscape ticket stays visible (not cropped) even on narrow
          mobile columns. text-left resets the inherited text-center so the
          ticket's presenter label + guest name stay left-aligned. */}
      <div className="w-full overflow-hidden rounded-xl text-left">
        <TicketCard
          ref={cardRef}
          ticket={ticket}
          eventName={eventName}
          venue={venue}
        />
      </div>

      <div className="w-full max-w-sm space-y-3">
        <a
          href={`${typeof window !== "undefined" ? window.location.origin : ""}/ticket/${ticket.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4" />
          View Interactive Ticket
        </a>

        {/* WhatsApp button doubles as the share-preview status: shows a loader
            + "Preparing share preview…" until the snapshot is captured, then
            becomes the normal Share via WhatsApp button. */}
        <Button
          className="w-full bg-[#25D366] text-white hover:bg-[#1faa54]"
          disabled={isSharing || captured === null}
          onClick={onShare}
        >
          {isSharing || captured === null ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <HugeiconsIcon icon={WhatsappIcon} size={16} className="mr-2" primaryColor="currentColor" />
          )}
          {captured === null
            ? "Preparing share preview…"
            : isSharing
            ? "Opening WhatsApp…"
            : "Share via WhatsApp"}
        </Button>
        <Button variant="outline" className="w-full" onClick={onIssueAnother}>
          Issue Another
        </Button>
      </div>
    </div>
  );
}
