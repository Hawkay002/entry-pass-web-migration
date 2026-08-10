// app/actions/tickets.ts — server actions for ticket CRUD + scan validation.
// All operations are authenticated via the session cookie and authorized
// server-side (replacing the original client-side-only writes).

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";
import { logAction } from "@/lib/firebase/log";
import type { Gender, TicketStatus, TicketType } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { pickGateForTicket } from "@/app/actions/gates";

/**
 * Fetch the full ticket list for offline-cache warming on the scanner.
 * Returns ONLY the fields the offline validator needs (id/name/status/scanned)
 * — no phone/PII — and is used by a one-shot + interval refresh instead of an
 * always-on realtime listener, which cuts Firestore reads to ~1 query / 5 min.
 */
export async function getTicketsForOfflineCache(): Promise<
  { ok: true; tickets: { id: string; name: string; status: TicketStatus; scanned: boolean }[] }
  | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const snap = await getAdminDb().collection(paths.ticketsCollection).get();
  const tickets = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const status = String(data.status ?? "coming-soon");
    return {
      id: d.id,
      name: String(data.name ?? ""),
      status: (status === "arrived" || status === "absent" ? status : "coming-soon") as TicketStatus,
      scanned: Boolean(data.scanned),
      gate: data.gate != null ? String(data.gate) : null,
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
}): Promise<{ ok: true; id: string; gate?: string | null } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getAdminDb();
  const dial = input.dialCode ?? "+91";
  const now = Date.now();

  // Multi-gate: auto-assign a gate via category match + round-robin (if enabled).
  let assignedGate: string | null = null;
  const settingsSnap = await db.doc(paths.settingsDoc).get();
  if (Boolean(settingsSnap.data()?.multiGate)) {
    assignedGate = await pickGateForTicket(input.ticketType);
  }

  const ticket = {
    name: input.name.trim(),
    gender: input.gender,
    age: input.age,
    phone: dial + input.phone.replace(/\D/g, ""),
    ticketType: input.ticketType,
    status: "coming-soon" as const,
    scanned: false,
    scannedAt: null,
    scannedBy: null,
    createdBy: user.username,
    createdAt: now,
    gate: assignedGate,
    scannedAtGate: null,
  };

  const ref = await db.collection(paths.ticketsCollection).add(ticket);

  await logAction(
    user,
    "TICKET_CREATE",
    `Ticket issued for ${ticket.name} (ID: ${ref.id.slice(0, 6)})`
  );

  revalidatePath("/guests");
  return { ok: true, id: ref.id, gate: assignedGate };
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

  const db = getAdminDb();
  const ref = db.collection(paths.ticketsCollection).doc(ticketId);
  const snap = await ref.get();

  if (!snap.exists) {
    await logAction(user, "SCAN_ENTRY", `Invalid scan: ${ticketId.slice(0, 8)}`);
    return { ok: true, outcome: "invalid", ticket: null };
  }

  const data = snap.data() as Record<string, unknown>;
  const name = String(data.name ?? "");
  const status = String(data.status ?? "coming-soon");
  const scanned = Boolean(data.scanned);
  const ticketGate = data.gate != null ? String(data.gate) : null;

  if (status === "coming-soon" && !scanned) {
    // Multi-gate enforcement: if the ticket has an assigned gate and this
    // scanner's gate doesn't match, block entry WITHOUT mutating the ticket.
    if (ticketGate && scannerGateId && ticketGate !== scannerGateId) {
      await logAction(
        user,
        "SCAN_ENTRY",
        `Wrong gate: ${name} (ID: ${ticketId.slice(0, 6)}) — expected ${ticketGate}, scanned at ${scannerGateId}`
      );
      return {
        ok: true,
        outcome: "wrong-gate",
        ticket: { name, id: ticketId, status, expectedGate: ticketGate },
      };
    }

    await ref.update({
      status: "arrived",
      scanned: true,
      scannedAt: Date.now(),
      scannedBy: user.username,
      scannedAtGate: scannerGateId ?? null,
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
  // Include who scanned it and when, to help staff resolve door disputes.
  const scannedBy = data.scannedBy != null ? String(data.scannedBy) : undefined;
  const scannedAt =
    data.scannedAt != null ? Number(data.scannedAt) : undefined;
  return {
    ok: true,
    outcome: "already",
    ticket: { name, id: ticketId, status, scannedBy, scannedAt },
  };
}

/**
 * Sync offline scans: for each id that is still coming-soon & unscanned,
 * mark it arrived (attributed to the syncing staff member). Idempotent —
 * ids already scanned (e.g. by admin meanwhile) are reported as "already".
 * Returns a per-id outcome map for client reconciliation.
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

  const db = getAdminDb();
  const results: Record<string, "granted" | "already" | "invalid" | "wrong-gate"> = {};
  let grantedCount = 0;

  for (const id of ids) {
    const snap = await db.collection(paths.ticketsCollection).doc(id).get();
    if (!snap.exists) {
      results[id] = "invalid";
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    const status = String(data.status ?? "coming-soon");
    const scanned = Boolean(data.scanned);
    const name = String(data.name ?? "");
    const ticketGate = data.gate != null ? String(data.gate) : null;
    if (status === "coming-soon" && !scanned) {
      // Multi-gate check — skip mutation on mismatch.
      if (ticketGate && scannerGateId && ticketGate !== scannerGateId) {
        results[id] = "wrong-gate";
        continue;
      }
      await snap.ref.update({
        status: "arrived",
        scanned: true,
        scannedAt: Date.now(),
        scannedBy: user.username,
        scannedAtGate: scannerGateId ?? null,
      });
      results[id] = "granted";
      grantedCount++;
    } else {
      results[id] = "already";
      void name;
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

  const db = getAdminDb();
  let count = 0;
  // Sequential to match original progress UX; Admin SDK has no client-facing
  // batch progress, and small N keeps this fast.
  for (const id of ids) {
    await db.collection(paths.ticketsCollection).doc(id).delete();
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

  const db = getAdminDb();
  // Read the ticket first so the log entry can name the deleted guest.
  const snap = await db.collection(paths.ticketsCollection).doc(id).get();
  const name = snap.exists ? String(snap.data()?.name ?? "unknown") : "unknown";

  await db.collection(paths.ticketsCollection).doc(id).delete();

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

  const db = getAdminDb();
  const ref = db.collection(paths.ticketsCollection).doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Ticket not found." };

  const oldName = String(snap.data()?.name ?? "");
  await ref.update({ name: cleanName });

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
 * as "absent". Mirrors the original performSync logic (script.js:1525-1539).
 * Returns the count of tickets marked absent.
 */
export async function autoMarkAbsent(): Promise<
  { ok: true; count: number; deadline: string | null } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getAdminDb();

  // Read the deadline from settings.
  const settingsSnap = await db.doc(paths.settingsDoc).get();
  const settingsData = settingsSnap.data();
  const deadline = settingsData?.deadline as string | undefined;

  if (!deadline) return { ok: true, count: 0, deadline: null };

  const deadlineMs = new Date(deadline).getTime();
  if (isNaN(deadlineMs)) return { ok: true, count: 0, deadline };

  if (Date.now() <= deadlineMs) {
    return { ok: true, count: 0, deadline };
  }

  // Deadline has passed — mark all coming-soon tickets as absent.
  const snap = await db
    .collection(paths.ticketsCollection)
    .where("status", "==", "coming-soon")
    .get();

  if (snap.empty) return { ok: true, count: 0, deadline };

  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: "absent" }));
  await batch.commit();

  revalidatePath("/guests");
  // Bust the ISR cache for each affected ticket page.
  snap.docs.forEach((d) => revalidatePath(`/ticket/${d.id}`));
  return { ok: true, count: snap.size, deadline };
}
