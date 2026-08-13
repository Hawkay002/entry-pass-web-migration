// app/(app)/layout.tsx — server component. Reads the session cookie,
// redirects to /login if absent, and renders the authenticated shell.
// Also runs the auto-absent check server-side on every request.

import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAppUser } from "@/lib/pb/server-auth";
import { isAdmin } from "@/lib/auth";
import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login?reason=expired");

  // Auto-absent: check if deadline passed and mark coming-soon tickets.
  // Runs directly via the admin PB client — no server action dependency.
  try {
    const pb = await pbAdmin();
    let deadline: string | undefined;
    try {
      const settings = await pb.collection(paths.settingsCollection).getOne(paths.settingsId);
      deadline = settings.deadline as string | undefined;
    } catch {
      /* settings missing — skip */
    }

    if (deadline) {
      const deadlineMs = new Date(deadline).getTime();
      // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is fine here
      const now = Date.now();

      if (!isNaN(deadlineMs) && now > deadlineMs) {
        const snap = await pb.collection(paths.ticketsCollection).getFullList({
          filter: `status = "coming-soon"`,
          fields: "id",
        });
        if (snap.length > 0) {
          await Promise.all(
            snap.map((d) =>
              pb.collection(paths.ticketsCollection).update(d.id, { status: "absent" })
            )
          );
        }
      }
    }
  } catch (err) {
    console.error("[layout] auto-absent check failed:", err);
  }

  return (
    <AppShell
      isAdmin={isAdmin(user)}
      userEmail={user.email ?? "—"}
      username={user.username}
    >
      {children}
    </AppShell>
  );
}
