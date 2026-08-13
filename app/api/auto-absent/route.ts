// app/api/auto-absent/route.ts — standalone API endpoint for auto-absent.
// Called by the Guest List page on mount.

import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb/server";
import { getAppUser } from "@/lib/pb/server-auth";
import { paths } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Parse optional `force` flag — admin manual override skips deadline checks.
    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch {
      // Empty body = automatic trigger (respect deadline checks).
    }

    const pb = await pbAdmin();

    if (!force) {
      // Automatic trigger — only act if deadline is set AND has passed.
      let deadline: string | undefined;
      try {
        const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
        deadline = settings.deadline as string | undefined;
      } catch {}

      if (!deadline) {
        return NextResponse.json({ ok: true, count: 0, reason: "no deadline" });
      }

      const deadlineMs = new Date(deadline).getTime();
      if (isNaN(deadlineMs) || Date.now() <= deadlineMs) {
        return NextResponse.json({ ok: true, count: 0, reason: "not passed" });
      }
    }

    // Mark all coming-soon tickets as absent.
    const snap = await pb.collection(paths.ticketsCollection).getFullList({
      filter: `status = "coming-soon"`,
    });

    if (snap.length === 0) {
      return NextResponse.json({ ok: true, count: 0, reason: "none to mark" });
    }

    await Promise.all(
      snap.map((d) => pb.collection(paths.ticketsCollection).update(d.id, { status: "absent" }))
    );

    console.log(`[auto-absent] ✅ Marked ${snap.length} ticket(s) as absent`);
    return NextResponse.json({ ok: true, count: snap.length });
  } catch (err) {
    console.error("[auto-absent] ERROR:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
