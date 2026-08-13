// app/actions/admin.ts — server actions for admin-only operations.
// All authenticated via session cookie + role-checked server-side.

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";
import { logAction, fetchAllLogs, deleteLogs as deleteLogsFromStore } from "@/lib/pb/log";
import { requireAdmin } from "@/lib/auth";
import type {
  ActivityLog,
  EventSettings,
  LockReasonType,
  KioskConfig,
} from "@/lib/types";
import { revalidatePath } from "next/cache";
import { disableMultiGate } from "@/app/actions/gates";

// ---------------- Activity Logs ----------------

export async function fetchActivityLogs(): Promise<
  { ok: true; logs: ActivityLog[] } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "admin")
    return { ok: false, error: "Admin role required." };

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

  const count = await deleteLogsFromStore(ids);
  await logAction(user, "LOG_DELETE", `Deleted ${count} log(s).`);
  revalidatePath("/logs");
  return { ok: true, count };
}

// ---------------- Settings ----------------

/** Fetch the event settings (authenticated). Used by the useSettings hook. */
export async function fetchSettings(): Promise<
  { ok: true; settings: EventSettings } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  try {
    const rec = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    return {
      ok: true,
      settings: {
        name: String(rec.name ?? ""),
        place: String(rec.place ?? ""),
        deadline: String(rec.deadline ?? ""),
        timezone: (rec.timezone as string) ?? "+05:30",
        multiGate: Boolean(rec.multiGate),
        gateCategories: Array.isArray(rec.gateCategories)
          ? (rec.gateCategories as string[])
          : [],
      },
    };
  } catch {
    return { ok: true, settings: { name: "", place: "", deadline: "", timezone: "+05:30", multiGate: false, gateCategories: [] } };
  }
}

export async function saveSettings(
  settings: EventSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  // Read current settings to know the existing multiGate value.
  let currentMultiGate = false;
  let currentCategories: string[] = [];
  try {
    const current = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    currentMultiGate = Boolean(current.multiGate);
    currentCategories = Array.isArray(current.gateCategories)
      ? (current.gateCategories as string[])
      : [];
  } catch {}

  const effectiveMultiGate = user.role === "admin" ? Boolean(settings.multiGate) : currentMultiGate;
  const effectiveCategories =
    user.role === "admin" && Array.isArray(settings.gateCategories)
      ? settings.gateCategories
      : currentCategories;

  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    name: settings.name,
    place: settings.place,
    deadline: settings.deadline,
    timezone: settings.timezone ?? "+05:30",
    multiGate: effectiveMultiGate,
    gateCategories: effectiveCategories,
  });

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

  const pb = await pbAdmin();

  // Cascade multi-gate off before clearing (deletes gates + clears tickets).
  await disableMultiGate();

  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    name: "",
    place: "",
    deadline: "",
    multiGate: false,
  });

  await logAction(user, "CONFIG_CHANGE", "Cleared all event settings.");
  return { ok: true };
}

// ---------------- Multi-Kiosk ----------------

function normalizePin(pin: string): string {
  return pin.replace(/\D/g, "").slice(0, 6);
}

function generateKioskId(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function readKiosks(): Promise<KioskConfig[]> {
  const pb = await pbAdmin();
  try {
    const rec = await pb.collection(paths.kiosksConfigCollection).getOne(paths.kiosksConfigId);
    const arr = rec.kiosks;
    return Array.isArray(arr) ? (arr as KioskConfig[]) : [];
  } catch {
    return [];
  }
}

async function writeKiosks(kiosks: KioskConfig[]): Promise<void> {
  const pb = await pbAdmin();
  await pb.collection(paths.kiosksConfigCollection).update(paths.kiosksConfigId, { kiosks });
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

  // Create the public status record so the kiosk page can listen via subscribe.
  const pb = await pbAdmin();
  try {
    await pb.collection(paths.kioskStatusCollection).create({ id, updatedAt: Date.now() });
  } catch {
    // already exists — update instead
    try {
      await pb.collection(paths.kioskStatusCollection).update(id, { updatedAt: Date.now() });
    } catch {}
  }

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
  // Bump the public status record so the kiosk page re-authenticates.
  const pb = await pbAdmin();
  try {
    await pb.collection(paths.kioskStatusCollection).update(id, { updatedAt: Date.now() });
  } catch {}
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
  const filtered = kiosks.filter((k) => k.id === id);
  await writeKiosks(filtered);

  // Delete the public status record — kiosk page detects this instantly via subscribe.
  const pb = await pbAdmin();
  try {
    await pb.collection(paths.kioskStatusCollection).delete(id);
  } catch {}

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

/** Find a lock record by email (case-insensitive). Returns the record or null. */
async function findLockRecord(pb: Awaited<ReturnType<typeof pbAdmin>>, email: string) {
  try {
    const recs = await pb.collection(paths.locksCollection).getFullList({
      filter: `userEmail = "${email.toLowerCase()}"`,
    });
    return recs[0] ?? null;
  } catch {
    return null;
  }
}

export async function applyRemoteLocks(input: {
  targetEmail: string;
  usernames: string[];
  lockedTabs: string[];
  reason: LockReasonType;
  duration: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  requireAdmin(user);

  const pb = await pbAdmin();
  const now = Date.now();
  const meta = { type: input.reason, duration: input.duration, updatedAt: now };

  let existing = await findLockRecord(pb, input.targetEmail);
  if (!existing) {
    // Create a new lock record.
    const rec = await pb.collection(paths.locksCollection).create({
      userEmail: input.targetEmail.toLowerCase(),
      userSpecificLocks: Object.fromEntries(
        input.usernames.map((u) => [u, input.lockedTabs])
      ),
      lockMetadata: Object.fromEntries(input.usernames.map((u) => [u, meta])),
      lockedTabs: [],
      updatedAt: now,
    });
    existing = rec;
  } else {
    // Read-modify-write the JSON fields (PB has no dot-notation field ops).
    const userLocks = (existing.userSpecificLocks as Record<string, string[]>) ?? {};
    const lockMeta = (existing.lockMetadata as Record<string, unknown>) ?? {};
    for (const username of input.usernames) {
      userLocks[username] = input.lockedTabs;
      lockMeta[username] = meta;
    }
    await pb.collection(paths.locksCollection).update(existing.id, {
      userSpecificLocks: userLocks,
      lockMetadata: lockMeta,
      updatedAt: now,
    });
  }

  await logAction(
    user,
    "LOCK_ACTION",
    `Locked tabs (${input.lockedTabs.join(", ") || "none"}) for [${input.usernames.join(", ")}]. Reason: ${input.reason.toUpperCase()}`
  );
  return { ok: true };
}

/** Unlock staff by removing their lock entries from the locks record. */
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

    const pb = await pbAdmin();
    const rec = await findLockRecord(pb, input.targetEmail);
    if (!rec) {
      console.log("[unlockStaff] doc not found:", input.targetEmail);
      return { ok: true };
    }

    // Read-modify-write: delete the username keys from both JSON maps.
    const userLocks = (rec.userSpecificLocks as Record<string, string[]>) ?? {};
    const lockMeta = (rec.lockMetadata as Record<string, unknown>) ?? {};
    delete userLocks[input.username];
    delete lockMeta[input.username];
    await pb.collection(paths.locksCollection).update(rec.id, {
      userSpecificLocks: userLocks,
      lockMetadata: lockMeta,
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

/** Check if maintenance time is over and auto-end if so. */
export async function checkAndEndMaintenance(): Promise<
  { ok: true; ended: boolean } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const snap = await pb.collection(paths.locksCollection).getFullList();
  const now = Date.now();
  let maintenanceFound = false;
  let isOver = false;

  snap.forEach((d) => {
    const meta = d.lockMetadata as Record<string, { type?: string; duration?: string; updatedAt?: number }> | undefined;
    if (meta) {
      for (const [, m] of Object.entries(meta)) {
        if (m?.type === "maintenance") {
          maintenanceFound = true;
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
    // Auto-unlock all maintenance locks (read-modify-write per record).
    for (const doc of snap) {
      const meta = doc.lockMetadata as Record<string, { type?: string }> | undefined;
      const userLocks = (doc.userSpecificLocks as Record<string, string[]>) ?? {};
      const lockMeta = (doc.lockMetadata as Record<string, unknown>) ?? {};
      let changed = false;
      if (meta) {
        for (const [username, m] of Object.entries(meta)) {
          if (m?.type === "maintenance") {
            delete userLocks[username];
            delete lockMeta[username];
            changed = true;
          }
        }
        if (changed) {
          await pb.collection(paths.locksCollection).update(doc.id, {
            userSpecificLocks: userLocks,
            lockMetadata: lockMeta,
            updatedAt: now,
          });
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

  const pb = await pbAdmin();

  // 1. Write an audit record to a RESET-PROOF collection BEFORE wiping,
  //    so the FACTORY_RESET survives.
  await pb.collection(paths.auditTrailCollection).create({
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

  // 3. Delete tickets.
  const ticketsSnap = await pb.collection(paths.ticketsCollection).getFullList({ fields: "id" });
  await Promise.all(ticketsSnap.map((d) => pb.collection(paths.ticketsCollection).delete(d.id)));

  // 4. Reset settings/config (keep the record, clear values).
  await pb.collection(paths.settingsCollection).update(paths.settingsId, {
    name: "",
    place: "",
    deadline: "",
    timezone: "auto",
    multiGate: false,
    gateCategories: [],
  });

  // 4b. Delete all gates.
  const gatesSnap = await pb.collection(paths.gatesCollection).getFullList({ fields: "id" });
  await Promise.all(gatesSnap.map((d) => pb.collection(paths.gatesCollection).delete(d.id)));

  // 5. Delete all locks.
  const locksSnap = await pb.collection(paths.locksCollection).getFullList({ fields: "id" });
  await Promise.all(locksSnap.map((d) => pb.collection(paths.locksCollection).delete(d.id)));

  // 6. Reset kiosks config + delete all public kiosk_status records.
  const kiosksBeforeReset = await readKiosks();
  await Promise.all(
    kiosksBeforeReset.map((k) =>
      pb.collection(paths.kioskStatusCollection).delete(k.id).catch(() => {})
    )
  );
  await pb.collection(paths.kiosksConfigCollection).update(paths.kiosksConfigId, { kiosks: [] });

  // 7. Delete all activity_logs.
  const logsSnap = await pb.collection(paths.logsCollection).getFullList({ fields: "id" });
  await Promise.all(logsSnap.map((d) => pb.collection(paths.logsCollection).delete(d.id)));

  revalidatePath("/guests");
  revalidatePath("/settings");
  revalidatePath("/logs");
  return { ok: true };
}

/** Combined read of locks — returns lock map + maintenance info in ONE read. */
export async function fetchLockDashboard(): Promise<{
  ok: true;
  lockMap: Record<string, string[]>;
  maintActive: boolean;
  maintDuration: string | null;
  maintUpdatedAt: number | null;
} | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  const snap = await pb.collection(paths.locksCollection).getFullList();
  const lockMap: Record<string, string[]> = {};
  let maintActive = false;
  let maintDuration: string | null = null;
  let maintUpdatedAt: number | null = null;

  snap.forEach((d) => {
    const email = String(d.userEmail ?? "").toLowerCase();

    // Build lock map
    const userLocks = d.userSpecificLocks as Record<string, string[]> | undefined;
    if (userLocks) {
      const allTabs = new Set<string>();
      Object.values(userLocks).forEach((tabs) => {
        if (Array.isArray(tabs)) tabs.forEach((t) => allTabs.add(t));
      });
      if (allTabs.size > 0) lockMap[email] = [...allTabs];
    }
    const legacyTabs = d.lockedTabs;
    if (Array.isArray(legacyTabs) && legacyTabs.length > 0) {
      lockMap[email] = legacyTabs as string[];
    }

    // Check for maintenance locks
    const meta = d.lockMetadata as Record<string, { type?: string; duration?: string; updatedAt?: number }> | undefined;
    if (meta) {
      for (const [, m] of Object.entries(meta)) {
        if (m?.type === "maintenance") {
          maintActive = true;
          if (m.duration && m.duration !== "Unknown") maintDuration = m.duration;
          if (m.updatedAt) maintUpdatedAt = m.updatedAt;
        }
      }
    }
  });

  return { ok: true, lockMap, maintActive, maintDuration, maintUpdatedAt };
}
