// components/tickets/ticket-view.tsx — client wrapper for the guest ticket page.
// Shows the phone gate first, then reveals the interactive tilt-shine ticket.

"use client";

import { useState } from "react";
import { PhoneGate } from "./phone-gate";
import { InteractiveTicket } from "./interactive-ticket";

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

export function TicketView({
  tickets,
  settings,
}: {
  tickets: TicketData[];
  settings: SettingsData;
}) {
  const [verified, setVerified] = useState(false);

  // Gate against the first ticket (parent) — all family members share its phone.
  if (!verified) {
    return <PhoneGate ticketId={tickets[0].id} onVerified={() => setVerified(true)} />;
  }

  return (
    <InteractiveTicket tickets={tickets} settings={settings} />
  );
}
