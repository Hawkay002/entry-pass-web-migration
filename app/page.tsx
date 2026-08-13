// app/page.tsx — Landing page (EntryPass design system).
// Public route. Server component that renders the new premium landing.
// Pulls one real ticket per tier (newest first) + event settings via Admin SDK,
// cached for 5 min via ISR. Gracefully falls back to demo tickets on failure.

import { Starfield } from "@/components/layout/starfield";
import { Atmosphere } from "@/components/layout/atmosphere";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { TrustMarquee } from "@/components/landing/TrustMarquee";
import {
  TicketTiers,
  type ShowcaseTicket,
} from "@/components/landing/TicketTiers";
import { Stats } from "@/components/landing/Stats";
import { Features } from "@/components/landing/Features";
import { Manifesto } from "@/components/landing/Manifesto";
import { UseCases } from "@/components/landing/UseCases";
import { SecurityControl } from "@/components/landing/SecurityControl";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import type { Ticket } from "@/lib/types";

// Refresh the showcased tickets / event info every 5 minutes.
export const revalidate = 300;

type TierKey = "Classic" | "Diamond" | "SVIP" | "Gold";
const TIER_ORDER: TierKey[] = ["Gold", "SVIP", "Diamond", "Classic"];

async function getShowcaseData() {
  try {
    const pb = await pbAdmin();

    // Event settings (name + place) for the ticket face.
    let event: string | undefined;
    let place: string | undefined;
    try {
      const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
      event = settings.name as string | undefined;
      place = settings.place as string | undefined;
    } catch {}

    // All tickets, newest first. We pick one per tier.
    const records = await pb.collection(paths.ticketsCollection).getFullList({
      sort: "-createdAt",
      fields: "id,name,age,gender,ticketType",
    });

    const byTier: Partial<Record<TierKey, ShowcaseTicket>> = {};
    for (const r of records) {
      const t = r as unknown as Ticket;
      if (!t?.ticketType || !t?.name) continue;
      if (TIER_ORDER.includes(t.ticketType) && !byTier[t.ticketType]) {
        byTier[t.ticketType] = {
          id: r.id,
          name: t.name,
          age: t.age,
          gender: t.gender,
        };
      }
      if (TIER_ORDER.every((k) => byTier[k])) break;
    }

    return { tickets: byTier, event, venue: place };
  } catch {
    // DB unavailable / no tickets → demo fallback in the component.
    return { tickets: {}, event: undefined, venue: undefined };
  }
}

export default async function LandingPage() {
  const { tickets, event, venue } = await getShowcaseData();

  return (
    <div className="relative min-h-screen antialiased">
      <SmoothScroll />
      <Atmosphere />
      <Starfield />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <TrustMarquee />
          <TicketTiers tickets={tickets} event={event} venue={venue} />
          <Stats />
          <Features />
          <Manifesto />
          <UseCases />
          <SecurityControl />
          <HowItWorks />
          <CTA />
        </main>
        <Footer />
      </div>
    </div>
  );
}