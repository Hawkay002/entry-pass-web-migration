// app/ticket/[id]/page.tsx — public guest ticket page.
// Fetches ticket + event settings server-side, gates behind phone verification.
// Shows an interactive tilt-shine ticket with live status + Google Wallet button.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { TicketView } from "@/components/tickets/ticket-view";

// ISR: cache the ticket page for fast repeat visits, revalidate every 5 min,
// and bust immediately when the ticket data changes (scan, edit, auto-absent).
export const revalidate = 300;

// Dynamic OG metadata for link previews (WhatsApp, social media).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pb = await pbAdmin();

  let ticketRec: Record<string, unknown> | null = null;
  let ogImage = "";
  try {
    ticketRec = await pb.collection(paths.ticketsCollection).getOne(id);
  } catch {
    ticketRec = null;
  }
  try {
    const og = await pb.collection(paths.ogSnapshotsCollection).getOne(id);
    ogImage = String(og.image ?? "");
  } catch {
    /* no snapshot — SVG fallback */
  }

  if (!ticketRec) {
    return { title: "Entry Pass", description: "View your interactive event ticket." };
  }

  const name = String(ticketRec.name ?? "Guest");
  const ticketType = String(ticketRec.ticketType ?? "Classic");
  const typeLabel = ticketType === "Gold" ? "VVIP" : ticketType === "Diamond" ? "VIP" : ticketType === "SVIP" ? "SVIP" : "Classic";

  let eventName = "Event";
  try {
    const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    eventName = String(settings.name ?? "Event");
  } catch {}

  const hasSnapshot = ogImage.startsWith("data:image/jpeg;base64,");
  const imageType = hasSnapshot ? "image/jpeg" : "image/svg+xml";

  const images = [{ url: `/ticket/${id}/og-image`, alt: `${name}'s Entry Pass` }];

  return {
    title: `${name}'s Entry Pass — ${typeLabel}`,
    description: `${eventName} • ${typeLabel} pass for ${name}. Scan your QR code at the entrance.`,
    openGraph: {
      title: `${name}'s Entry Pass — ${typeLabel}`,
      description: `${eventName} • ${typeLabel} pass. Scan your QR code at the entrance for admission.`,
      images,
      type: "website",
      siteName: "Entry Pass",
    },
    other: { "og:image:type": imageType },
    twitter: {
      card: "summary_large_image",
      title: `${name}'s Entry Pass — ${typeLabel}`,
      description: `${eventName} • ${typeLabel} pass. Scan your QR code at the entrance.`,
      images,
    },
  };
}

interface TicketData {
  id: string;
  name: string;
  gender: string;
  age: number;
  ticketType: string;
  status: string;
  gate?: string;
}

interface SettingsData {
  name: string;
  place: string;
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pb = await pbAdmin();

  let t: Record<string, unknown>;
  try {
    t = await pb.collection(paths.ticketsCollection).getOne(id);
  } catch {
    notFound();
  }

  const groupId = t.groupId ? String(t.groupId) : null;

  // Resolve the gate name if this ticket has an assigned gate.
  let gateName: string | undefined;
  const ticketGateId = t.gate ? String(t.gate) : null;
  if (ticketGateId) {
    try {
      const gateRec = await pb.collection(paths.gatesCollection).getOne(ticketGateId);
      gateName = String(gateRec.name ?? ticketGateId);
    } catch {}
  }

  let settings: SettingsData = { name: "", place: "" };
  try {
    const s = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    settings = { name: String(s.name ?? ""), place: String(s.place ?? "") };
  } catch {}

  // Fetch all family members if this ticket belongs to a group.
  let tickets: TicketData[] = [];
  if (groupId) {
    const groupRecs = await pb.collection(paths.ticketsCollection).getFullList({
      filter: `groupId = "${groupId}"`,
    });

    const gateCache = new Map<string, string>();
    tickets = await Promise.all(
      groupRecs.map(async (doc) => {
        const d = doc as Record<string, unknown>;
        let gName: string | undefined;
        const gId = d.gate ? String(d.gate) : null;
        if (gId) {
          if (gateCache.has(gId)) {
            gName = gateCache.get(gId);
          } else {
            try {
              const gs = await pb.collection(paths.gatesCollection).getOne(gId);
              gName = String(gs.name ?? gId);
            } catch {
              gName = gId;
            }
            gateCache.set(gId, gName!);
          }
        }
        return {
          id: doc.id,
          name: String(d.name ?? ""),
          gender: String(d.gender ?? "Other"),
          age: Number(d.age ?? 0),
          ticketType: String(d.ticketType ?? "Classic"),
          status: String(d.status ?? "coming-soon"),
          gate: gName,
        } as TicketData;
      })
    );

    // Sort: parent first (no parentName), then kids by age descending.
    tickets.sort((a, b) => {
      const aRec = groupRecs.find((d) => d.id === a.id) as Record<string, unknown> | undefined;
      const bRec = groupRecs.find((d) => d.id === b.id) as Record<string, unknown> | undefined;
      const aIsParent = !aRec?.parentName;
      const bIsParent = !bRec?.parentName;
      if (aIsParent && !bIsParent) return -1;
      if (!aIsParent && bIsParent) return 1;
      return b.age - a.age;
    });
  } else {
    tickets = [
      {
        id,
        name: String(t.name ?? ""),
        gender: String(t.gender ?? "Other"),
        age: Number(t.age ?? 0),
        ticketType: String(t.ticketType ?? "Classic"),
        status: String(t.status ?? "coming-soon"),
        gate: gateName,
      },
    ];
  }

  return <TicketView tickets={tickets} settings={settings} />;
}
