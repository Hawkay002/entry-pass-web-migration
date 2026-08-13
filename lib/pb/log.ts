// lib/pb/log.ts — activity logging via the Pocketbase `logs` collection.
// Replaces the old Upstash Redis + Firestore hybrid (lib/redis-log.ts).
// All logs now live in PB directly — no Redis, no overflow logic, no quota dance.

import { pbAdmin } from "@/lib/pb/server";
import type { LogAction } from "@/lib/types";
import type { AppUser } from "@/lib/auth";

export interface LogEntry {
  id: string;
  timestamp: number;
  userEmail: string;
  username: string;
  action: LogAction;
  details: string;
}

/** Write a log entry (staff/admin actions). Silently swallows write errors so
 *  logging never breaks a primary operation. */
export async function logAction(
  user: AppUser,
  action: LogAction,
  details: string
): Promise<void> {
  try {
    const pb = await pbAdmin();
    await pb.collection("logs").create({
      timestamp: Date.now(),
      userEmail: user.email ?? "",
      username: user.username,
      action,
      details,
    });
  } catch (err) {
    console.error("[log] write failed:", err);
  }
}

/** Write a kiosk (self check-in) log entry. The public kiosk endpoint has no
 *  authenticated AppUser, so this writes a synthetic entry attributed to the
 *  KIOSK "user". Used by /api/kiosk-checkin. */
export async function logKioskAction(
  action: LogAction,
  details: string
): Promise<void> {
  try {
    const pb = await pbAdmin();
    await pb.collection("logs").create({
      timestamp: Date.now(),
      userEmail: "kiosk",
      username: "KIOSK",
      action,
      details,
    });
  } catch (err) {
    console.error("[log] kiosk write failed:", err);
  }
}

/** Fetch the latest log entries, newest-first. */
export async function fetchAllLogs(count = 500): Promise<LogEntry[]> {
  try {
    const pb = await pbAdmin();
    const page = await pb.collection("logs").getList(1, count, {
      sort: "-timestamp",
    });
    return page.items.map((r) => ({
      id: r.id,
      timestamp: r.timestamp as number,
      userEmail: r.userEmail as string,
      username: r.username as string,
      action: r.action as LogAction,
      details: r.details as string,
    }));
  } catch (err) {
    console.error("[log] fetch failed:", err);
    return [];
  }
}

/** Delete specific log entries by id. Returns the count requested. */
export async function deleteLogs(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const pb = await pbAdmin();
  for (const id of ids) {
    try {
      await pb.collection("logs").delete(id);
    } catch (err) {
      console.error("[log] delete failed for", id, err);
    }
  }
  return ids.length;
}
