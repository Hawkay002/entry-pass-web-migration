// app/actions/tickets.ts — server actions for ticket CRUD + scan validation.
// All operations are authenticated via the session cookie and authorized
// server-side.

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";
import { logAction } from "@/lib/pb/log";
import type { Gender, TicketStatus, TicketType, Ticket } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { pickGateForTicket } from "@/app/actions/gates";

/** Short random ID for group tickets. */
function generateGroupId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Fill the ticketUrl / whatsappUrl columns shown in the PB dashboard.
 *  Base = the appUrl field on the settings record (go-live keeps it = the
 *  public link), so the URLs are absolute and copy-pasteable from the
 *  dashboard. Reading the record — not PB's superuser-only /api/settings —
 *  means this works with the rules-gated service account, and keeps working
 *  when OTP/MFA guards _superusers.
 *  The WhatsApp URL mirrors the Guest List share EXACTLY: addressed to the
 *  guest's phone (wa.me/<digits>) with the same personalized message. */
export async function fillShareUrls(pb: Awaited<ReturnType<typeof pbAdmin>>, ticketId: string): Promise<void> {
  try {
    const st = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    const base = String(st?.appUrl ?? "").replace(/\/$/, "");
    if (!base) return;

    const t = await pb.collection(paths.ticketsCollection).getOne(ticketId);
    const ticketUrl = `${base}/ticket/${ticketId}`;
    const digits = String(t.phone ?? "").replace(/\D/g, "");
    const message =
      `Hello ${t.name}, here is your Entry Pass 🎫 (shader disabled for preview images)\n` +
      `*Keep this QR code ready at the entrance.*\n\n` +
      `View your interactive ticket:\n${ticketUrl}\n` +
      `_This link will expire after the event ends._\n\n` +
      `Enter your full phone number with country code (e.g. ${t.phone}) to unlock your ticket.`;

    await pb.collection(paths.ticketsCollection).update(ticketId, {
      ticketUrl,
      whatsappUrl: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    });
  } catch { /* non-fatal */ }
}

/** Fetch ALL tickets (authenticated). Used by the useTickets realtime hook.
 *  Returns the full ticket shape for the Guest List (client-side filter/sort). */
export async function fetchTickets(): Promise<
  { ok: true; tickets: Ticket[] } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const records = await pb.collection(paths.ticketsCollection).getFullList();
  const tickets: Ticket[] = records.map((d) => ({
    id: d.id,
    name: String(d.name ?? ""),
    gender: (d.gender as Ticket["gender"]) ?? "Other",
    age: Number(d.age ?? 0),
    phone: String(d.phone ?? ""),
    ticketType: (d.ticketType as Ticket["ticketType"]) ?? "Classic",
    status: (d.status as Ticket["status"]) ?? "coming-soon",
    scanned: Boolean(d.scanned),
    scannedAt: d.scannedAt ? Number(d.scannedAt) : null,
    scannedBy: d.scannedBy ? String(d.scannedBy) : null,
    createdBy: String(d.createdBy ?? ""),
    createdAt: Number(d.createdAt ?? 0),
    gate: d.gate ? String(d.gate) : null,
    scannedAtGate: d.scannedAtGate ? String(d.scannedAtGate) : null,
    groupId: d.groupId ? String(d.groupId) : null,
    parentName: d.parentName ? String(d.parentName) : null,
  }));
  return { ok: true, tickets };
}

/**
 * Fetch the full ticket list for offline-cache warming on the scanner.
 * Returns ONLY the fields the offline validator needs (id/name/status/scanned)
 * — no phone/PII.
 */
export async function getTicketsForOfflineCache(): Promise<
  { ok: true; tickets: { id: string; name: string; status: TicketStatus; scanned: boolean; gate: string | null }[] }
  | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const records = await pb.collection(paths.ticketsCollection).getFullList({
    fields: "id,name,status,scanned,gate",
  });
  const tickets = records.map((d) => {
    const status = String(d.status ?? "coming-soon");
    return {
      id: d.id,
      name: String(d.name ?? ""),
      status: (status === "arrived" || status === "absent" ? status : "coming-soon") as TicketStatus,
      scanned: Boolean(d.scanned),
      gate: d.gate ? String(d.gate) : null,
    };
  });
  return { ok: true, tickets };
}

/** Create a new ticket. Returns the new ticket id, or null on auth failure. */
export async function createTicket(input: {
  name: string;
  gender: Gender;
  age: number;
  phone: string; // raw digits, will be prefixed with the selected dial code
  ticketType: TicketType;
  dialCode?: string; // e.g. "+91" (default "+91")
  kids?: { name: string; gender: Gender; age: number }[];
}): Promise<{ ok: true; id: string; gate?: string | null } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const dial = input.dialCode ?? "+91";
  const now = Date.now();
  const fullPhone = dial + input.phone.replace(/\D/g, "");

  // Multi-gate: auto-assign a gate via category match + round-robin (if enabled).
  let assignedGate: string | null = null;
  const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
  if (Boolean(settings.multiGate)) {
    assignedGate = await pickGateForTicket(input.ticketType);
  }

  // Generate a shared groupId only if kids are present.
  const hasKids = input.kids && input.kids.length > 0;
  const groupId = hasKids ? generateGroupId() : null;

  const ticket = {
    name: input.name.trim(),
    gender: input.gender,
    age: input.age,
    phone: fullPhone,
    ticketType: input.ticketType,
    status: "coming-soon" as const,
    scanned: false,
    scannedAt: 0,
    scannedBy: "",
    createdBy: user.username,
    createdAt: now,
    gate: assignedGate ?? "",
    scannedAtGate: "",
    groupId: groupId ?? "",
    parentName: "",
  };

  const rec = await pb.collection(paths.ticketsCollection).create(ticket);
  await fillShareUrls(pb, rec.id);

  // Create kid tickets — they share the parent's phone + ticketType + gate.
  if (hasKids && groupId) {
    for (const kid of input.kids!) {
      const kidRec = await pb.collection(paths.ticketsCollection).create({
        name: kid.name.trim(),
        gender: kid.gender,
        age: kid.age,
        phone: fullPhone,
        ticketType: input.ticketType,
        status: "coming-soon" as const,
        scanned: false,
        scannedAt: 0,
        scannedBy: "",
        createdBy: user.username,
        createdAt: now,
        gate: assignedGate ?? "",
        scannedAtGate: "",
        groupId,
        parentName: input.name.trim(),
      });
      await fillShareUrls(pb, kidRec.id);
    }

    await logAction(
      user,
      "TICKET_CREATE",
      `Ticket issued for ${ticket.name} + ${input.kids!.length} kid(s) (ID: ${rec.id.slice(0, 6)})`
    );
  } else {
    await logAction(
      user,
      "TICKET_CREATE",
      `Ticket issued for ${ticket.name} (ID: ${rec.id.slice(0, 6)})`
    );
  }

  revalidatePath("/guests");
  return { ok: true, id: rec.id, gate: assignedGate };
}

/** Mark a ticket as arrived on scan. Returns the outcome for UI feedback. */
export async function validateTicket(
  ticketId: string,
  scannerGateId?: string | null
): Promise<
  | { ok: true; outcome: "granted" | "already" | "invalid" | "wrong-gate"; ticket: { name: string; id: string; status: string; scannedBy?: string; scannedAt?: number | null; expectedGate?: string | null } | null }
  | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  let rec;
  try {
    rec = await pb.collection(paths.ticketsCollection).getOne(ticketId);
  } catch {
    await logAction(user, "SCAN_ENTRY", `Invalid scan: ${ticketId.slice(0, 8)}`);
    return { ok: true, outcome: "invalid", ticket: null };
  }

  const name = String(rec.name ?? "");
  const status = String(rec.status ?? "coming-soon");
  const scanned = Boolean(rec.scanned);
  const ticketGate = rec.gate ? String(rec.gate) : null;

  if (status === "coming-soon" && !scanned) {
    // Multi-gate enforcement: mismatch blocks entry WITHOUT mutating the ticket.
    if (ticketGate && scannerGateId && ticketGate !== scannerGateId) {
      let gateName = ticketGate;
      try {
        const gateRec = await pb.collection(paths.gatesCollection).getOne(ticketGate);
        gateName = String(gateRec.name ?? ticketGate);
      } catch {}
      await logAction(
        user,
        "SCAN_ENTRY",
        `Wrong gate: ${name} (ID: ${ticketId.slice(0, 6)}) — expected ${gateName}, scanned at ${scannerGateId}`
      );
      return {
        ok: true,
        outcome: "wrong-gate",
        ticket: { name, id: ticketId, status, expectedGate: gateName },
      };
    }

    await pb.collection(paths.ticketsCollection).update(ticketId, {
      status: "arrived",
      scanned: true,
      scannedAt: Date.now(),
      scannedBy: user.username,
      scannedAtGate: scannerGateId ?? "",
    });
    await logAction(
      user,
      "SCAN_ENTRY",
      `Scanned: ${name} (ID: ${ticketId.slice(0, 6)})`
    );
    revalidatePath(`/ticket/${ticketId}`);
    return {
      ok: true,
      outcome: "granted",
      ticket: { name, id: ticketId, status: "arrived" },
    };
  }

  // Already scanned or in another status — report without mutating.
  const scannedBy = rec.scannedBy ? String(rec.scannedBy) : undefined;
  const scannedAt = rec.scannedAt ? Number(rec.scannedAt) : undefined;
  return {
    ok: true,
    outcome: "already",
    ticket: { name, id: ticketId, status, scannedBy, scannedAt },
  };
}

/**
 * Sync offline scans: for each id that is still coming-soon & unscanned,
 * mark it arrived (attributed to the syncing staff member). Idempotent.
 */
export async function syncOfflineScans(
  ids: string[],
  scannerGateId?: string | null
): Promise<
  | { ok: true; results: Record<string, "granted" | "already" | "invalid" | "wrong-gate"> }
  | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const results: Record<string, "granted" | "already" | "invalid" | "wrong-gate"> = {};
  let grantedCount = 0;

  for (const id of ids) {
    let rec;
    try {
      rec = await pb.collection(paths.ticketsCollection).getOne(id);
    } catch {
      results[id] = "invalid";
      continue;
    }
    const status = String(rec.status ?? "coming-soon");
    const scanned = Boolean(rec.scanned);
    const ticketGate = rec.gate ? String(rec.gate) : null;
    if (status === "coming-soon" && !scanned) {
      if (ticketGate && scannerGateId && ticketGate !== scannerGateId) {
        results[id] = "wrong-gate";
        continue;
      }
      await pb.collection(paths.ticketsCollection).update(id, {
        status: "arrived",
        scanned: true,
        scannedAt: Date.now(),
        scannedBy: user.username,
        scannedAtGate: scannerGateId ?? "",
      });
      results[id] = "granted";
      grantedCount++;
    } else {
      results[id] = "already";
    }
  }

  if (grantedCount > 0) {
    await logAction(
      user,
      "SCAN_ENTRY",
      `Synced ${grantedCount} offline scan(s) (offline)`
    );
  }

  return { ok: true, results };
}

/** Bulk-delete tickets by id (admin only). Returns count deleted. */
export async function deleteTickets(
  ids: string[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required to delete tickets." };

  const pb = await pbAdmin();
  let count = 0;
  for (const id of ids) {
    await pb.collection(paths.ticketsCollection).delete(id);
    count++;
  }

  await logAction(
    user,
    "TICKET_DELETE",
    `Deleted ${count} ticket(s): ${ids.map((i) => i.slice(0, 6)).join(", ")}`
  );

  revalidatePath("/guests");
  return { ok: true, count };
}

/** Delete a single ticket by id (admin only). For client-side progress loops. */
export async function deleteOneTicket(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required to delete tickets." };

  const pb = await pbAdmin();
  let name = "unknown";
  try {
    const rec = await pb.collection(paths.ticketsCollection).getOne(id);
    name = String(rec.name ?? "unknown");
  } catch {}

  await pb.collection(paths.ticketsCollection).delete(id);

  await logAction(
    user,
    "TICKET_DELETE",
    `Deleted ${name} (${id.slice(0, 6)})`
  );

  revalidatePath("/guests");
  return { ok: true };
}

/** Update a guest's name (admin only). Busts the ticket page cache. */
export async function updateGuestName(
  ticketId: string,
  newName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const cleanName = newName.trim();
  if (!cleanName) return { ok: false, error: "Name cannot be empty." };

  const pb = await pbAdmin();
  let rec;
  try {
    rec = await pb.collection(paths.ticketsCollection).getOne(ticketId);
  } catch {
    return { ok: false, error: "Ticket not found." };
  }

  const oldName = String(rec.name ?? "");
  await pb.collection(paths.ticketsCollection).update(ticketId, { name: cleanName });

  await logAction(
    user,
    "TICKET_CREATE",
    `Renamed guest: ${oldName} → ${cleanName} (${ticketId.slice(0, 6)})`
  );

  revalidatePath("/guests");
  revalidatePath(`/ticket/${ticketId}`);
  return { ok: true };
}

/**
 * Auto-absent: if the deadline has passed, mark all "coming-soon" tickets
 * as "absent". Returns the count of tickets marked absent.
 */
export async function autoMarkAbsent(): Promise<
  { ok: true; count: number; deadline: string | null } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();

  // Read the deadline from settings.
  let deadline: string | undefined;
  try {
    const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    deadline = settings.deadline as string | undefined;
  } catch {}

  if (!deadline) return { ok: true, count: 0, deadline: null };

  const deadlineMs = new Date(deadline).getTime();
  if (isNaN(deadlineMs)) return { ok: true, count: 0, deadline };

  if (Date.now() <= deadlineMs) {
    return { ok: true, count: 0, deadline };
  }

  // Deadline has passed — mark all coming-soon tickets as absent.
  const snap = await pb.collection(paths.ticketsCollection).getFullList({
    filter: `status = "coming-soon"`,
  });

  if (snap.length === 0) return { ok: true, count: 0, deadline };

  await Promise.all(
    snap.map((d) => pb.collection(paths.ticketsCollection).update(d.id, { status: "absent" }))
  );

  revalidatePath("/guests");
  snap.forEach((d) => revalidatePath(`/ticket/${d.id}`));
  return { ok: true, count: snap.length, deadline };
}
