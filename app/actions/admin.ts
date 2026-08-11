// app/actions/admin.ts — server actions for admin-only operations.
// All authenticated via session cookie + role-checked server-side.
// Replaces the original app's client-side-only admin writes + plaintext passwords.

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";
import { logAction } from "@/lib/firebase/log";
import { requireAdmin } from "@/lib/auth";
import type {
  ActivityLog,
  EventSettings,
  LockReasonType,
  KioskConfig,
} from "@/lib/types";
import { revalidatePath } from "next/cache";
import { fetchAllLogs, deleteLogsFromRedis } from "@/lib/redis-log";
import { disableMultiGate } from "@/app/actions/gates";

// ---------------- Activity Logs (Redis + Firestore) ----------------

export async function fetchActivityLogs(): Promise<
  { ok: true; logs: ActivityLog[] } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  // Full history: Redis (oldest batch) + Firestore (newer overflow).
  const entries = await fetchAllLogs();
  const logs: ActivityLog[] = entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    userEmail: e.userEmail,
    username: e.username,
    action: e.action as ActivityLog["action"],
    details: e.details,
  }));

  return { ok: true, logs };
}

export async function deleteLogs(
  ids: string[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getAppUser();
  requireAdmin(user);

  const count = await deleteLogsFromRedis(ids);
  await logAction(user, "LOG_DELETE", `Deleted ${count} log(s).`);
  revalidatePath("/logs");
  return { ok: true, count };
}

// ---------------- Settings ----------------

export async function saveSettings(
  settings: EventSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // multiGate + gateCategories are admin-only — staff can save name/place/
  // deadline but cannot toggle multi-gate mode or change categories.
  const isMultiGateChanged =
    settings.multiGate !== undefined || settings.gateCategories !== undefined;

  // Read current settings to know the existing multiGate value.
  const db = getAdminDb();
  const currentSnap = await db.doc(paths.settingsDoc).get();
  const currentMultiGate = Boolean(currentSnap.data()?.multiGate);

  // If a non-admin tries to change multi-gate fields, silently keep the
  // existing value rather than erroring (they can't see the toggle anyway).
  const effectiveMultiGate = user.role === "admin" ? Boolean(settings.multiGate) : currentMultiGate;
  const effectiveCategories =
    user.role === "admin" && Array.isArray(settings.gateCategories)
      ? settings.gateCategories
      : Array.isArray(currentSnap.data()?.gateCategories)
        ? currentSnap.data()!.gateCategories
        : [];

  await db.doc(paths.settingsDoc).set(
    {
      name: settings.name,
      place: settings.place,
      deadline: settings.deadline,
      timezone: settings.timezone ?? "+05:30",
      multiGate: effectiveMultiGate,
      gateCategories: effectiveCategories,
    },
      { merge: true }
    );

  await logAction(
    user,
    "CONFIG_CHANGE",
    `Settings updated: "${settings.name}" at ${settings.place}`
  );
  return { ok: true };
}

/**
 * Clear all event settings (name, place, deadline) from the database.
 * Also cascades multi-gate off (deletes gates, clears ticket gate assignments).
 */
export async function clearSettings(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getAdminDb();

  // Cascade multi-gate off before clearing (deletes gates + clears tickets).
  await disableMultiGate();

  await db.doc(paths.settingsDoc).set(
    { name: "", place: "", deadline: "", multiGate: false },
    { merge: true }
  );

  await logAction(user, "CONFIG_CHANGE", "Cleared all event settings.");
  return { ok: true };
}

/**
 * Save (or clear) the kiosk PIN. Empty string disables the public kiosk.
 * Stored in the admin-only security doc (NOT the public settings doc) so
 * regular staff cannot read it via the client SDK.
 */
// ---------------- Multi-Kiosk ----------------

function normalizePin(pin: string): string {
  return pin.replace(/\D/g, "").slice(0, 8);
}

function generateKioskId(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function readKiosks(): Promise<KioskConfig[]> {
  const snap = await getAdminDb().doc(paths.adminSecurityDoc).get();
  const arr = snap.data()?.kiosks;
  return Array.isArray(arr) ? (arr as KioskConfig[]) : [];
}

async function writeKiosks(kiosks: KioskConfig[]): Promise<void> {
  await getAdminDb()
    .doc(paths.adminSecurityDoc)
    .set({ kiosks }, { merge: true });
}

/** Create a new kiosk. Returns its id. */
export async function createKiosk(
  name: string,
  pin: string,
  gateId: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin") return { ok: false, error: "Admin role required." };

  const cleanPin = normalizePin(pin);
  if (cleanPin.length < 4) return { ok: false, error: "PIN must be 4-8 digits." };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Name is required." };

  const kiosks = await readKiosks();
  const id = generateKioskId();
  kiosks.push({ id, name: cleanName, pin: cleanPin, gateId, createdAt: Date.now() });
  await writeKiosks(kiosks);

  await logAction(user, "CONFIG_CHANGE", `Kiosk created: ${cleanName}`);
  return { ok: true, id };
}

/** Update a kiosk's name, PIN, and/or gate. */
export async function updateKiosk(
  id: string,
  patch: { name?: string; pin?: string; gateId?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin") return { ok: false, error: "Admin role required." };

  const kiosks = await readKiosks();
  const idx = kiosks.findIndex((k) => k.id === id);
  if (idx === -1) return { ok: false, error: "Kiosk not found." };

  if (patch.name !== undefined) kiosks[idx].name = patch.name.trim();
  if (patch.pin !== undefined) {
    const clean = normalizePin(patch.pin);
    if (clean.length > 0 && clean.length < 4) return { ok: false, error: "PIN must be 4-8 digits." };
    if (clean.length >= 4) kiosks[idx].pin = clean;
  }
  if (patch.gateId !== undefined) kiosks[idx].gateId = patch.gateId;

  await writeKiosks(kiosks);
  await logAction(user, "CONFIG_CHANGE", `Kiosk updated: ${kiosks[idx].name}`);
  return { ok: true };
}

/** Delete a kiosk by id. */
export async function deleteKiosk(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin") return { ok: false, error: "Admin role required." };

  const kiosks = await readKiosks();
  const filtered = kiosks.filter((k) => k.id !== id);
  await writeKiosks(filtered);

  await logAction(user, "CONFIG_CHANGE", `Kiosk deleted: ${id}`);
  return { ok: true };
}

/** Returns the list of kiosks (id, name, gateId — NEVER the PIN). */
export async function getKiosksList(): Promise<
  { ok: true; kiosks: Array<{ id: string; name: string; gateId: string | null }> } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin") return { ok: false, error: "Admin role required." };

  const kiosks = await readKiosks();
  return {
    ok: true,
    kiosks: kiosks.map((k) => ({ id: k.id, name: k.name, gateId: k.gateId })),
  };
}

// ---------------- Remote Lock ----------------

export async function applyRemoteLocks(input: {
  targetEmail: string;
  usernames: string[];
  lockedTabs: string[];
  reason: LockReasonType;
  duration: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  requireAdmin(user);

  const ref = getAdminDb().collection(paths.locksCollection).doc(input.targetEmail);
  const now = Date.now();
  const meta = { type: input.reason, duration: input.duration, updatedAt: now };

  // Write per-username locks via update() for dot-notation path support.
  const update: Record<string, unknown> = { updatedAt: now };
  for (const username of input.usernames) {
    update[`userSpecificLocks.${username}`] = input.lockedTabs;
    update[`lockMetadata.${username}`] = meta;
  }

  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      userSpecificLocks: Object.fromEntries(
        input.usernames.map((u) => [u, input.lockedTabs])
      ),
      lockMetadata: Object.fromEntries(input.usernames.map((u) => [u, meta])),
      updatedAt: now,
    });
  } else {
    // Use update() — it correctly interprets dot-notation as nested paths.
    await ref.update(update);
  }

  await logAction(
    user,
    "LOCK_ACTION",
    `Locked tabs (${input.lockedTabs.join(", ") || "none"}) for [${input.usernames.join(", ")}]. Reason: ${input.reason.toUpperCase()}`
  );
  return { ok: true };
}

/** Unlock staff by deleting their lock entries from the global_locks doc. */
export async function unlockStaff(input: {
  targetEmail: string;
  username: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getAppUser();
    if (!user || user.role !== "admin") {
      console.log("[unlockStaff] rejected: role=", user?.role, "email=", user?.email);
      return { ok: false, error: "Admin role required." };
    }

    const ref = getAdminDb().collection(paths.locksCollection).doc(input.targetEmail);

    const snap = await ref.get();
    if (!snap.exists) {
      console.log("[unlockStaff] doc not found:", input.targetEmail);
      return { ok: true };
    }

    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.update({
      [`userSpecificLocks.${input.username}`]: FieldValue.delete(),
      [`lockMetadata.${input.username}`]: FieldValue.delete(),
      updatedAt: Date.now(),
    });
    console.log("[unlockStaff] success:", input.targetEmail, input.username);

    await logAction(
      user,
      "LOCK_ACTION",
      `Unlocked all tabs for ${input.username} (${input.targetEmail}).`
    );
    return { ok: true };
  } catch (err) {
    console.error("[unlockStaff] error:", err);
    return { ok: false, error: (err as Error).message };
  }
}

/** Fetch maintenance metadata (duration + endsAt) from any staff's lock doc. */
export async function fetchMaintenanceInfo(): Promise<
  { ok: true; active: boolean; duration: string | null; updatedAt: number | null } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const snap = await getAdminDb().collection(paths.locksCollection).get();
  let active = false;
  let duration: string | null = null;
  let updatedAt: number | null = null;

  snap.docs.forEach((d) => {
    const data = d.data();
    const meta = data.lockMetadata as Record<string, { type?: string; duration?: string; updatedAt?: number }> | undefined;
    if (meta) {
      for (const [, m] of Object.entries(meta)) {
        if (m?.type === "maintenance") {
          active = true;
          if (m.duration && m.duration !== "Unknown") duration = m.duration;
          if (m.updatedAt) updatedAt = m.updatedAt;
        }
      }
    }
  });

  return { ok: true, active, duration, updatedAt };
}

/** Check if maintenance time is over and auto-end if so. */
export async function checkAndEndMaintenance(): Promise<
  { ok: true; ended: boolean } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const snap = await getAdminDb().collection(paths.locksCollection).get();
  const now = Date.now();
  let maintenanceFound = false;
  let isOver = false;

  snap.docs.forEach((d) => {
    const data = d.data();
    const meta = data.lockMetadata as Record<string, { type?: string; duration?: string; updatedAt?: number }> | undefined;
    if (meta) {
      for (const [, m] of Object.entries(meta)) {
        if (m?.type === "maintenance") {
          maintenanceFound = true;
          // Parse duration string like "2 hr 30 min"
          const dur = m.duration ?? "";
          if (dur && dur !== "Unknown" && m.updatedAt) {
            const hrMatch = dur.match(/(\d+)\s*hr/);
            const minMatch = dur.match(/(\d+)\s*min/);
            const hrs = hrMatch ? Number(hrMatch[1]) : 0;
            const mins = minMatch ? Number(minMatch[1]) : 0;
            const durationMs = (hrs * 60 + mins) * 60 * 1000;
            if (now > m.updatedAt + durationMs) {
              isOver = true;
            }
          }
        }
      }
    }
  });

  if (maintenanceFound && isOver) {
    // Auto-unlock all maintenance locks
    const { FieldValue } = await import("firebase-admin/firestore");
    for (const doc of snap.docs) {
      const data = doc.data();
      const meta = data.lockMetadata as Record<string, { type?: string }> | undefined;
      if (meta) {
        const update: Record<string, unknown> = { updatedAt: now };
        for (const [username, m] of Object.entries(meta)) {
          if (m?.type === "maintenance") {
            update[`userSpecificLocks.${username}`] = FieldValue.delete();
            update[`lockMetadata.${username}`] = FieldValue.delete();
          }
        }
        if (Object.keys(update).length > 1) {
          await doc.ref.update(update);
        }
      }
    }
    await logAction(user, "LOCK_ACTION", "Maintenance auto-ended (duration elapsed).");
    return { ok: true, ended: true };
  }

  return { ok: true, ended: false };
}

// ---------------- Factory Reset ----------------

export async function factoryReset(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getAppUser();
  requireAdmin(user);

  // 1. Write an audit record to a RESET-PROOF collection BEFORE wiping,
  //    so the FACTORY_RESET survives (unlike the original which deleted its own log).
  await getAdminDb()
    .collection("audit_trail")
    .add({
      timestamp: Date.now(),
      userEmail: user.email ?? "",
      username: user.username,
      action: "FACTORY_RESET",
      details: `Admin (${user.username}) initiated FACTORY RESET. All data wiped.`,
    });

  // 2. Also log to activity_logs (will be wiped below, but kept for parity).
  await logAction(
    user,
    "FACTORY_RESET",
    `Admin (${user.username}) initiated FACTORY RESET. All data wiped.`
  );

  const db = getAdminDb();

  // 3. Delete tickets.
  const ticketsSnap = await db.collection(paths.ticketsCollection).get();
  await Promise.all(ticketsSnap.docs.map((d) => d.ref.delete()));

  // 4. Delete settings/config.
  await db.doc(paths.settingsDoc).delete();

  // 4b. Delete all gates (multi-gate system).
  const gatesSnap = await db.collection(paths.gatesCollection).get();
  await Promise.all(gatesSnap.docs.map((d) => d.ref.delete()));

  // 5. Delete all global_locks.
  const locksSnap = await db.collection(paths.locksCollection).get();
  await Promise.all(locksSnap.docs.map((d) => d.ref.delete()));

  // 6. Delete admin_settings/security (legacy password doc — now empty).
  await db.doc(paths.adminSecurityDoc).delete();

  // 7. Delete all activity_logs.
  const logsSnap = await db.collection(paths.logsCollection).get();
  await Promise.all(logsSnap.docs.map((d) => d.ref.delete()));

  revalidatePath("/guests");
  revalidatePath("/settings");
  revalidatePath("/logs");
  return { ok: true };
}

/** Fetch all global_locks (admin only). Returns email → lockedTabs array map. */
export async function fetchAllLocks(): Promise<
  { ok: true; map: Record<string, string[]> } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const snap = await getAdminDb().collection(paths.locksCollection).get();
  const map: Record<string, string[]> = {};

  snap.docs.forEach((d) => {
    const data = d.data();
    const email = d.id.toLowerCase();
    const userLocks = data.userSpecificLocks as Record<string, string[]> | undefined;
    if (userLocks) {
      const allTabs = new Set<string>();
      Object.values(userLocks).forEach((tabs) => {
        if (Array.isArray(tabs)) tabs.forEach((t) => allTabs.add(t));
      });
      if (allTabs.size > 0) {
        map[email] = [...allTabs];
      }
    }
    if (data.lockedTabs && Array.isArray(data.lockedTabs) && data.lockedTabs.length > 0) {
      map[email] = data.lockedTabs;
    }
  });

  return { ok: true, map };
}
