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
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import type { Ticket } from "@/lib/types";

// Refresh the showcased tickets / event info every 5 minutes.
export const revalidate = 300;

type TierKey = "Classic" | "Diamond" | "SVIP" | "Gold";
const TIER_ORDER: TierKey[] = ["Gold", "SVIP", "Diamond", "Classic"];

async function getShowcaseData() {
  try {
    const db = getAdminDb();

    // Event settings (name + place) for the ticket face.
    const settingsSnap = await db.doc(paths.settingsDoc).get();
    const settings = settingsSnap.data();
    const event = settings?.name as string | undefined;
    const place = settings?.place as string | undefined;

    // All tickets, newest first. We pick one per tier.
    const snap = await db
      .collection(paths.ticketsCollection)
      .orderBy("createdAt", "desc")
      .get();

    const byTier: Partial<Record<TierKey, ShowcaseTicket>> = {};
    for (const doc of snap.docs) {
      const t = doc.data() as Ticket;
      if (!t?.ticketType || !t?.name) continue;
      if (TIER_ORDER.includes(t.ticketType) && !byTier[t.ticketType]) {
        byTier[t.ticketType] = {
          id: doc.id,
          name: t.name,
          age: t.age,
          gender: t.gender,
        };
      }
      if (TIER_ORDER.every((k) => byTier[k])) break;
    }

    return { tickets: byTier, event, venue: place };
  } catch {
    // Firestore unavailable / no tickets → demo fallback in the component.
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