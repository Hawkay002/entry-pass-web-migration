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
  ticket,
  settings,
}: {
  ticket: TicketData;
  settings: SettingsData;
}) {
  const [verified, setVerified] = useState(false);

  if (!verified) {
    return <PhoneGate ticketId={ticket.id} onVerified={() => setVerified(true)} />;
  }

  return (
    <InteractiveTicket ticket={ticket} settings={settings} />
  );
}
