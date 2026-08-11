// app/actions/gates-scanner.ts — resolves the current scanner's gate status.
// Called by the scanner page on mount to know whether to enforce gates,
// and which gate this device enforces.

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";

export interface ScannerGateState {
  multiGate: boolean;
  gate: { id: string; name: string } | null;
}

export async function getScannerGate(): Promise<ScannerGateState> {
  const user = await getAppUser();
  if (!user) return { multiGate: false, gate: null };

  const db = getAdminDb();
  const settingsSnap = await db.doc(paths.settingsDoc).get();
  const isMultiGate = Boolean(settingsSnap.data()?.multiGate);

  if (!isMultiGate) return { multiGate: false, gate: null };

  // Multi-gate is ON — does the staff have an assigned gate?
  const gateId = user.gateId;
  if (!gateId) return { multiGate: true, gate: null };

  const gateSnap = await db.collection(paths.gatesCollection).doc(gateId).get();
  if (!gateSnap.exists) return { multiGate: true, gate: null };

  return {
    multiGate: true,
    gate: {
      id: gateId,
      name: String(gateSnap.data()?.name ?? gateId),
    },
  };
}
