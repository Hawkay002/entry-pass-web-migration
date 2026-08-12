// app/actions/import.ts — batch import tickets with dedupe-by-phone.

"use server";

import { getAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/firebase/server-auth";
import { logAction } from "@/lib/firebase/log";
import { parseImportedDate, type ParsedTicket } from "@/lib/import-export";
import type { Ticket } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function importTickets(
  records: ParsedTicket[],
  existingKeys: string[]
): Promise<
  | { ok: true; imported: number; duplicates: number }
  | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = getAdminDb();
  // Dedup by composite key: phone + name (so parent + kids with same phone but
  // different names are NOT treated as duplicates).
  const existingSet = new Set(existingKeys);
  let imported = 0;
  let duplicates = 0;

  for (const record of records) {
    const dedupKey = record.phone + ":" + record.name.toLowerCase();
    if (existingSet.has(dedupKey)) {
      duplicates++;
      continue;
    }
    existingSet.add(dedupKey);

    const scannedState = record.status === "arrived";
    const scannedAtTime = scannedState
      ? (parseImportedDate(record.entryTimeRaw) ?? Date.now())
      : null;

    const ticketData: Omit<Ticket, "id"> = {
      name: record.name,
      gender: record.gender,
      age: Number(record.age) || 18,
      phone: "+91" + record.phone,
      ticketType: record.ticketType,
      status: record.status,
      scanned: scannedState,
      scannedAt: scannedAtTime,
      scannedBy: scannedState ? "Import" : null,
      createdBy: user.username,
      createdAt: Date.now(),
      groupId: record.groupId ?? null,
      parentName: record.parentName ?? null,
    };

    if (record.id) {
      await db
        .collection(paths.ticketsCollection)
        .doc(String(record.id).trim())
        .set(ticketData);
    } else {
      await db.collection(paths.ticketsCollection).add(ticketData);
    }
    imported++;
  }

  await logAction(
    user,
    "IMPORT_DATA",
    `Imported ${imported} guests (${duplicates} duplicates skipped).`
  );
  revalidatePath("/guests");
  return { ok: true, imported, duplicates };
}
