// app/actions/gates.ts — CRUD for event gates + gate categories + the
// multi-gate disable cascade. Admin-gated (mirrors the roles.ts pattern).

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";
import { logAction } from "@/lib/firebase/log";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------- Gate Categories ----------------

/** Add a new gate category (free-text name) to the settings doc. */
export async function addGateCategory(name: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Category name is required." };

  const db = getAdminDb();
  const ref = db.doc(paths.settingsDoc);
  const snap = await ref.get();
  const existing: string[] = Array.isArray(snap.data()?.gateCategories)
    ? snap.data()!.gateCategories
    : [];

  if (existing.includes(cleanName))
    return { ok: false, error: "Category already exists." };

  await ref.set({ gateCategories: [...existing, cleanName] }, { merge: true });
  revalidatePath("/settings");
  return { ok: true };
}

/** Delete a gate category: removes it from settings + deletes all its gates. */
export async function deleteGateCategory(name: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const db = getAdminDb();

  // 1. Remove from settings.
  const ref = db.doc(paths.settingsDoc);
  const snap = await ref.get();
  const existing: string[] = Array.isArray(snap.data()?.gateCategories)
    ? snap.data()!.gateCategories
    : [];
  await ref.set(
    { gateCategories: existing.filter((c) => c !== name) },
    { merge: true }
  );

  // 2. Delete all gates in this category.
  const gatesSnap = await db
    .collection(paths.gatesCollection)
    .where("category", "==", name)
    .get();
  await Promise.all(gatesSnap.docs.map((d) => d.ref.delete()));

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

  const db = getAdminDb();
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Gate name is required." };

  const snap = await db.collection(paths.gatesCollection).get();

  // Prevent duplicates within the same category — case-insensitive so
  // "Gate A" / "gate a" / "GATE A" are all treated as the same gate.
  const existsInCategory = snap.docs.some((d) => {
    const data = d.data();
    const existingName = String(data?.name ?? "").trim().toLowerCase();
    const existingCat = String(data?.category ?? "").trim().toLowerCase();
    return existingCat === category.trim().toLowerCase() && existingName === cleanName.toLowerCase();
  });
  if (existsInCategory)
    return { ok: false, error: `Gate "${cleanName}" already exists in ${category}.` };

  const maxOrder = snap.docs.reduce(
    (max, d) => Math.max(max, Number(d.data()?.order ?? 0)),
    -1
  );

  const ref = await db.collection(paths.gatesCollection).add({
    name: cleanName,
    category,
    order: maxOrder + 1,
    active: true,
    createdAt: Date.now(),
    ticketTypes,
  });

  await logAction(user, "CONFIG_CHANGE", `Gate created: ${cleanName} (${category})`);
  revalidatePath("/settings");
  return { ok: true, id: ref.id };
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

  // If renaming, prevent collision with another gate in the same category.
  if (patch.name !== undefined) {
    const db = getAdminDb();
    const snap = await db.collection(paths.gatesCollection).get();
    const target = snap.docs.find((d) => d.id === id);
    const targetCat = String(target?.data()?.category ?? "").trim().toLowerCase();
    const collision = snap.docs.some((d) => {
      if (d.id === id) return false;
      const data = d.data();
      const existingName = String(data?.name ?? "").trim().toLowerCase();
      const existingCat = String(data?.category ?? "").trim().toLowerCase();
      return existingCat === targetCat && existingName === patch.name!.trim().toLowerCase();
    });
    if (collision)
      return { ok: false, error: `Gate "${patch.name}" already exists in this category.` };
  }

  await getAdminDb().collection(paths.gatesCollection).doc(id).update(update);
  revalidatePath("/settings");
  return { ok: true };
}

/** Delete a gate. Also clears this gate from assigned staff. */
export async function deleteGate(id: string): Promise<ActionResult> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const db = getAdminDb();
  await db.collection(paths.gatesCollection).doc(id).delete();

  // Clear from staff.
  const rolesSnap = await db.collection(paths.rolesCollection).get();
  for (const roleDoc of rolesSnap.docs) {
    const data = roleDoc.data();
    const staff = Array.isArray(data.staff) ? data.staff : [];
    if (staff.some((s: { gateId?: string | null }) => s?.gateId === id)) {
      await roleDoc.ref.update({
        staff: staff.map((s: { gateId?: string | null }) =>
          s?.gateId === id ? { ...s, gateId: null } : s
        ),
      });
    }
  }

  // Clear from tickets.
  const ticketsSnap = await db
    .collection(paths.ticketsCollection)
    .where("gate", "==", id)
    .get();
  for (const tDoc of ticketsSnap.docs) {
    await tDoc.ref.update({ gate: null });
  }

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

  const db = getAdminDb();

  // 1. Delete all gate docs.
  const gatesSnap = await db.collection(paths.gatesCollection).get();
  await Promise.all(gatesSnap.docs.map((d) => d.ref.delete()));

  // 2. Clear gate categories from settings.
  await db.doc(paths.settingsDoc).set(
    { gateCategories: [], multiGate: false },
    { merge: true }
  );

  // 3. Clear gate from all staff.
  const rolesSnap = await db.collection(paths.rolesCollection).get();
  for (const roleDoc of rolesSnap.docs) {
    const data = roleDoc.data();
    const staff = Array.isArray(data.staff) ? data.staff : [];
    if (staff.some((s: { gateId?: string | null }) => s?.gateId)) {
      await roleDoc.ref.update({
        staff: staff.map((s: { gateId?: string | null }) =>
          s?.gateId ? { ...s, gateId: null } : s
        ),
      });
    }
  }

  // 4. Clear gate from all tickets.
  const ticketsSnap = await db.collection(paths.ticketsCollection).get();
  const batch = db.batch();
  ticketsSnap.docs.forEach((d) => {
    batch.update(d.ref, { gate: null, scannedAtGate: null });
  });
  await batch.commit();

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
  const db = getAdminDb();

  const gatesSnap = await db
    .collection(paths.gatesCollection)
    .where("active", "==", true)
    .orderBy("order", "asc")
    .get();

  // Filter to gates that accept this ticket type.
  const eligible = gatesSnap.docs
    .filter((d) => {
      const types: string[] = Array.isArray(d.data()?.ticketTypes) ? d.data()!.ticketTypes : [];
      return types.length === 0 || types.includes(ticketType);
    })
    .map((d) => ({ id: d.id, order: Number(d.data()?.order ?? 0) }));
  if (eligible.length === 0) return null;

  // Count existing tickets per gate.
  const counts = new Map<string, number>();
  for (const g of eligible) counts.set(g.id, 0);
  const ticketsSnap = await db.collection(paths.ticketsCollection).get();
  ticketsSnap.docs.forEach((d) => {
    const g = d.data()?.gate;
    if (typeof g === "string" && counts.has(g)) {
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
