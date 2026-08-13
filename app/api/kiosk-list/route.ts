// app/api/kiosk-list/route.ts — public endpoint returning the list of
// available kiosks (id + name only — no PINs). Used by the kiosk picker.

import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import type { KioskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const pb = await pbAdmin();
    const rec = await pb.collection(paths.kiosksConfigCollection).getOne(paths.kiosksConfigId);
    const kiosks = Array.isArray(rec.kiosks) ? (rec.kiosks as KioskConfig[]) : [];

    // Return only id + name — never the PIN.
    return NextResponse.json({
      ok: true,
      kiosks: kiosks.map((k) => ({ id: k.id, name: k.name })),
    });
  } catch {
    return NextResponse.json({ ok: true, kiosks: [] });
  }
}
