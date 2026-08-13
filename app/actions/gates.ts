// app/actions/gates.ts — CRUD for event gates + gate categories + the
// multi-gate disable cascade. Admin-gated (mirrors the roles.ts pattern).

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";
import { logAction } from "@/lib/pb/log";
import { revalidatePath } from "next/cache";
import type { Gate } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------- Gates list ----------------

/** Fetch all gates (authenticated), sorted by order. Used by useGatesMode. */
export async function fetchGates(): Promise<
  { ok: true; gates: Gate[] } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const records = await pb.collection(paths.gatesCollection).getFullList({
    sort: "order",
  });
  const gates: Gate[] = records.map((d) => ({
    id: d.id,
    name: String(d.name ?? d.id),
    category: (d.category as Gate["category"]) ?? "guest-entry",
    order: Number(d.order ?? 0),
    active: Boolean(d.active ?? true),
    createdAt: Number(d.createdAt ?? 0),
    ticketTypes: Array.isArray(d.ticketTypes) ? (d.ticketTypes as Gate["ticketTypes"]) : [],
  }));
  return { ok: true, gates };
}

// ---------------- Gate Categories ----------------

/** Add a new gate category (free-text name) to the settings record. */
export async function addGateCategory(name: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Category name is required." };

  const pb = await pbAdmin();
  const rec = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
  const existing: string[] = Array.isArray(rec.gateCategories)
    ? (rec.gateCategories as string[])
    : [];

  if (existing.includes(cleanName))
    return { ok: false, error: "Category already exists." };

  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    gateCategories: [...existing, cleanName],
  });
  revalidatePath("/settings");
  return { ok: true };
}

/** Delete a gate category: removes it from settings + deletes all its gates. */
export async function deleteGateCategory(name: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();

  // 1. Remove from settings.
  const rec = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
  const existing: string[] = Array.isArray(rec.gateCategories)
    ? (rec.gateCategories as string[])
    : [];
  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    gateCategories: existing.filter((c) => c !== name),
  });

  // 2. Delete all gates in this category.
  const gates = await pb.collection(paths.gatesCollection).getFullList({
    filter: `category = "${name}"`,
  });
  await Promise.all(gates.map((g) => pb.collection(paths.gatesCollection).delete(g.id)));

  await logAction(user, "CONFIG_CHANGE", `Gate category deleted: ${name}`);
  revalidatePath("/settings");
  revalidatePath("/guests");
  return { ok: true };
}

// ---------------- Gates ----------------

/** Create a new gate within a category. */
export async function createGate(
  name: string,
  category: string,
  ticketTypes: string[] = []
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required to manage gates." };

  const pb = await pbAdmin();
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Gate name is required." };

  const snap = await pb.collection(paths.gatesCollection).getFullList();

  // Prevent duplicates within the same category — case-insensitive so
  // "Gate A" / "gate a" / "GATE A" are all treated as the same gate.
  const existsInCategory = snap.some((d) => {
    const existingName = String(d.name ?? "").trim().toLowerCase();
    const existingCat = String(d.category ?? "").trim().toLowerCase();
    return existingCat === category.trim().toLowerCase() && existingName === cleanName.toLowerCase();
  });
  if (existsInCategory)
    return { ok: false, error: `Gate "${cleanName}" already exists in ${category}.` };

  const maxOrder = snap.reduce(
    (max, d) => Math.max(max, Number(d.order ?? 0)),
    -1
  );

  const rec = await pb.collection(paths.gatesCollection).create({
    name: cleanName,
    category,
    order: maxOrder + 1,
    active: true,
    createdAt: Date.now(),
    ticketTypes,
  });

  await logAction(user, "CONFIG_CHANGE", `Gate created: ${cleanName} (${category})`);
  revalidatePath("/settings");
  return { ok: true, id: rec.id };
}

/** Update a gate's name, active status, or ticket types. */
export async function updateGate(
  id: string,
  patch: { name?: string; active?: boolean; ticketTypes?: string[] }
): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.ticketTypes !== undefined) update.ticketTypes = patch.ticketTypes;
  if (Object.keys(update).length === 0) return { ok: true };

  const pb = await pbAdmin();

  // If renaming, prevent collision with another gate in the same category.
  if (patch.name !== undefined) {
    const snap = await pb.collection(paths.gatesCollection).getFullList();
    const target = snap.find((d) => d.id === id);
    const targetCat = String(target?.category ?? "").trim().toLowerCase();
    const collision = snap.some((d) => {
      if (d.id === id) return false;
      const existingName = String(d.name ?? "").trim().toLowerCase();
      const existingCat = String(d.category ?? "").trim().toLowerCase();
      return existingCat === targetCat && existingName === patch.name!.trim().toLowerCase();
    });
    if (collision)
      return { ok: false, error: `Gate "${patch.name}" already exists in this category.` };
  }

  await pb.collection(paths.gatesCollection).update(id, update);
  revalidatePath("/settings");
  return { ok: true };
}

/** Delete a gate. Also clears this gate from assigned staff. */
export async function deleteGate(id: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();
  await pb.collection(paths.gatesCollection).delete(id);

  // Clear from staff.
  const rolesSnap = await pb.collection(paths.rolesCollection).getFullList();
  for (const roleRec of rolesSnap) {
    const staff = Array.isArray(roleRec.staff) ? roleRec.staff : [];
    if (staff.some((s: { gateId?: string | null }) => s?.gateId === id)) {
      await pb.collection(paths.rolesCollection).update(roleRec.id, {
        staff: staff.map((s: { gateId?: string | null }) =>
          s?.gateId === id ? { ...s, gateId: null } : s
        ),
      });
    }
  }

  // Clear from tickets.
  const ticketsSnap = await pb.collection(paths.ticketsCollection).getFullList({
    filter: `gate = "${id}"`,
  });
  await Promise.all(
    ticketsSnap.map((t) => pb.collection(paths.ticketsCollection).update(t.id, { gate: "" }))
  );

  await logAction(user, "CONFIG_CHANGE", `Gate deleted: ${id}`);
  revalidatePath("/settings");
  revalidatePath("/guests");
  return { ok: true };
}

/**
 * Disable multi-gate mode and cascade: delete ALL gates, categories, and
 * clear gate assignments from every ticket + staff member.
 */
export async function disableMultiGate(): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();

  // 1. Delete all gate docs.
  const gatesSnap = await pb.collection(paths.gatesCollection).getFullList();
  await Promise.all(gatesSnap.map((d) => pb.collection(paths.gatesCollection).delete(d.id)));

  // 2. Clear gate categories + multiGate in settings.
  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    gateCategories: [],
    multiGate: false,
  });

  // 3. Clear gate from all staff.
  const rolesSnap = await pb.collection(paths.rolesCollection).getFullList();
  for (const roleRec of rolesSnap) {
    const staff = Array.isArray(roleRec.staff) ? roleRec.staff : [];
    if (staff.some((s: { gateId?: string | null }) => s?.gateId)) {
      await pb.collection(paths.rolesCollection).update(roleRec.id, {
        staff: staff.map((s: { gateId?: string | null }) =>
          s?.gateId ? { ...s, gateId: null } : s
        ),
      });
    }
  }

  // 4. Clear gate from all tickets.
  const ticketsSnap = await pb.collection(paths.ticketsCollection).getFullList();
  await Promise.all(
    ticketsSnap.map((d) =>
      pb.collection(paths.ticketsCollection).update(d.id, { gate: "", scannedAtGate: "" })
    )
  );

  await logAction(user, "CONFIG_CHANGE", "Multi-gate mode disabled. All gates cleared.");
  revalidatePath("/settings");
  revalidatePath("/guests");
  return { ok: true };
}

/**
 * Pick the best gate for a new ticket: find active gates that ACCEPT this
 * ticket type, then round-robin (fewest assigned). Returns null if none match.
 */
export async function pickGateForTicket(ticketType: string): Promise<string | null> {
  const pb = await pbAdmin();

  // Fetch all active gates.
  const gatesSnap = await pb.collection(paths.gatesCollection).getFullList({
    filter: `active = true`,
  });

  // Filter to gates that accept this ticket type, sort by order.
  const eligible = gatesSnap
    .filter((d) => {
      const types: string[] = Array.isArray(d.ticketTypes) ? (d.ticketTypes as string[]) : [];
      return types.length === 0 || types.includes(ticketType);
    })
    .map((d) => ({ id: d.id, order: Number(d.order ?? 0) }))
    .sort((a, b) => a.order - b.order);
  if (eligible.length === 0) return null;

  // Count existing tickets per gate.
  const counts = new Map<string, number>();
  for (const g of eligible) counts.set(g.id, 0);
  const ticketsSnap = await pb.collection(paths.ticketsCollection).getFullList({ fields: "gate" });
  ticketsSnap.forEach((d) => {
    const g = d.gate as string | undefined;
    if (typeof g === "string" && g && counts.has(g)) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  });

  // Fewest assigned; ties → lowest order.
  let best = eligible[0];
  for (const g of eligible) {
    const gc = counts.get(g.id) ?? 0;
    const bc = counts.get(best.id) ?? 0;
    if (gc < bc || (gc === bc && g.order < best.order)) best = g;
  }

  return best.id;
}
