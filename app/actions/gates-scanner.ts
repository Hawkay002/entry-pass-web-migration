// app/actions/gates-scanner.ts — resolves the current scanner's gate status.
// Called by the scanner page on mount to know whether to enforce gates,
// and which gate this device enforces.

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";

export interface ScannerGateState {
  multiGate: boolean;
  gate: { id: string; name: string } | null;
}

export async function getScannerGate(): Promise<ScannerGateState> {
  const user = await getAppUser();
  if (!user) return { multiGate: false, gate: null };

  const pb = await pbAdmin();
  let isMultiGate = false;
  try {
    const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
    isMultiGate = Boolean(settings.multiGate);
  } catch {
    /* settings doc missing — treat as off */
  }

  if (!isMultiGate) return { multiGate: false, gate: null };

  // Multi-gate is ON — does the staff have an assigned gate?
  const gateId = user.gateId;
  if (!gateId) return { multiGate: true, gate: null };

  try {
    const gateSnap = await pb.collection(paths.gatesCollection).getOne(gateId);
    return {
      multiGate: true,
      gate: { id: gateId, name: String(gateSnap.name ?? gateId) },
    };
  } catch {
    return { multiGate: true, gate: null };
  }
}
