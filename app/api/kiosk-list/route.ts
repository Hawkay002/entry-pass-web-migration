// app/api/kiosk-list/route.ts — public endpoint returning the list of
// available kiosks (id + name only — no PINs). Used by the kiosk picker.

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import type { KioskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const snap = await getAdminDb().doc(paths.adminSecurityDoc).get();
    const kiosks = Array.isArray(snap.data()?.kiosks)
      ? (snap.data()!.kiosks as KioskConfig[])
      : [];

    // Return only id + name — never the PIN.
    return NextResponse.json({
      ok: true,
      kiosks: kiosks.map((k) => ({ id: k.id, name: k.name })),
    });
  } catch {
    return NextResponse.json({ ok: true, kiosks: [] });
  }
}
