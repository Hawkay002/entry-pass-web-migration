// app/actions/gates-scanner.ts — resolves the current scanner's assigned gate.
// Called by the scanner page on mount to know which gate this device enforces.

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";

export async function getScannerGate(): Promise<{
  id: string;
  name: string;
} | null> {
  const user = await getAppUser();
  if (!user) return null;

  // Multi-gate must be on, AND the staff must have an assigned gateId.
  const db = getAdminDb();
  const settingsSnap = await db.doc(paths.settingsDoc).get();
  if (!Boolean(settingsSnap.data()?.multiGate)) return null;

  const gateId = user.gateId;
  if (!gateId) return null;

  const gateSnap = await db.collection(paths.gatesCollection).doc(gateId).get();
  if (!gateSnap.exists) return null;

  return {
    id: gateId,
    name: String(gateSnap.data()?.name ?? gateId),
  };
}
