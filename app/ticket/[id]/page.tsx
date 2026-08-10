// app/ticket/[id]/page.tsx — public guest ticket page.
// Fetches ticket + event settings server-side, gates behind phone verification.
// Shows an interactive tilt-shine ticket with live status + Google Wallet button.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { TicketView } from "@/components/tickets/ticket-view";

// ISR: cache the ticket page for fast repeat visits, revalidate every 5 min,
// and bust immediately when the ticket data changes (scan, edit, auto-absent).
export const revalidate = 300;

// Dynamic OG metadata for link previews (WhatsApp, social media).
// OG image is served at /ticket/{id}/og-image — a JPEG snapshot of the exact
// live shader ticket when one has been captured at creation time, else an SVG.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const db = getAdminDb();
  const [snap, ogSnap] = await Promise.all([
    db.collection(paths.ticketsCollection).doc(id).get(),
    db.collection(paths.ogSnapshotsCollection).doc(id).get(),
  ]);

  if (!snap.exists) {
    return { title: "Entry Pass", description: "View your interactive event ticket." };
  }

  const data = snap.data() as Record<string, unknown>;
  const name = String(data.name ?? "Guest");
  const ticketType = String(data.ticketType ?? "Classic");
  const typeLabel = ticketType === "Gold" ? "VVIP" : ticketType === "Diamond" ? "VIP" : ticketType === "SVIP" ? "SVIP" : "Classic";

  const settingsSnap = await db.doc(paths.settingsDoc).get();
  const eventName = String(settingsSnap.data()?.name ?? "Event");

  // JPEG snapshot of the live shader if one exists, else the SVG fallback.
  const hasSnapshot = Boolean(
    ogSnap.exists &&
      String(ogSnap.data()?.image ?? "").startsWith("data:image/jpeg;base64,")
  );
  const imageType = hasSnapshot ? "image/jpeg" : "image/svg+xml";

  const images = [
    {
      url: `/ticket/${id}/og-image`,
      alt: `${name}'s Entry Pass`,
    },
  ];

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
    other: {
      "og:image:type": imageType,
    },
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

  // Fetch ticket + settings server-side (Admin SDK bypasses rules).
  const db = getAdminDb();
  const [ticketSnap, settingsSnap] = await Promise.all([
    db.collection(paths.ticketsCollection).doc(id).get(),
    db.doc(paths.settingsDoc).get(),
  ]);

  if (!ticketSnap.exists) {
    notFound();
  }

  const t = ticketSnap.data() as Record<string, unknown>;

  // Resolve the gate name if this ticket has an assigned gate.
  let gateName: string | undefined;
  const ticketGateId = t.gate != null ? String(t.gate) : null;
  if (ticketGateId) {
    const gateSnap = await db.collection(paths.gatesCollection).doc(ticketGateId).get();
    if (gateSnap.exists) {
      gateName = String(gateSnap.data()?.name ?? ticketGateId);
    }
  }

  const ticket: TicketData = {
    id,
    name: String(t.name ?? ""),
    gender: String(t.gender ?? "Other"),
    age: Number(t.age ?? 0),
    ticketType: String(t.ticketType ?? "Classic"),
    status: String(t.status ?? "coming-soon"),
    gate: gateName,
  };

  const s = settingsSnap.data();
  const settings: SettingsData = {
    name: String(s?.name ?? ""),
    place: String(s?.place ?? ""),
  };

  return <TicketView ticket={ticket} settings={settings} />;
}
