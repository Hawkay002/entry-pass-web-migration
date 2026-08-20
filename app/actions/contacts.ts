// app/actions/contacts.ts — CRUD for the contacts collection.
// Admin can add/edit/delete contacts for the help tray.

"use server";

import { pbAdmin } from "@/lib/pb/server";
import { paths } from "@/lib/paths";
import { getAppUser } from "@/lib/pb/server-auth";
import { logAction } from "@/lib/pb/log";
import type { HelpContact } from "@/lib/types";

/** Fetch all contacts (any authenticated user). */
export async function fetchContacts(): Promise<
  { ok: true; contacts: HelpContact[] } | { ok: false; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const pb = await pbAdmin();
  // Insertion order ("first added stays first"): sort by createdAt epoch,
  // ties broken by PB record id — Pocketbase ids start with a random-ish
  // 4-char sequence BUT the remaining 11 chars are a monotonically increasing
  // counter, so id comparison is a stable creation tiebreak. This is what
  // makes rapid adds (same millisecond) keep their true order, and deletions
  // never reshuffle the survivors.
  const records = await pb.collection(paths.contactsCollection).getFullList();
  records.sort((a, b) => {
    const ta = Number(a.createdAt ?? 0);
    const tb = Number(b.createdAt ?? 0);
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  const contacts: HelpContact[] = records.map((r) => ({
    id: r.id,
    role: String(r.role ?? ""),
    name: String(r.name ?? ""),
    phone: r.phone ? String(r.phone) : undefined,
    whatsapp: r.whatsapp ? String(r.whatsapp) : undefined,
    description: String(r.description ?? ""),
    createdAt: Number(r.createdAt ?? 0),
  }));

  return { ok: true, contacts };
}

/** Create a new contact (admin only). */
export async function createContact(input: {
  role: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  description: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user || user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();
  await pb.collection(paths.contactsCollection).create({
    role: input.role.trim(),
    name: input.name.trim(),
    phone: input.phone?.trim() || "",
    whatsapp: input.whatsapp?.trim() || "",
    description: input.description.trim(),
    createdAt: Date.now(),
  });

  await logAction(user, "CONFIG_CHANGE", `Added contact: ${input.name} (${input.role}).`);
  return { ok: true };
}

/** Update an existing contact (admin only). */
export async function updateContact(
  contactId: string,
  input: {
    role: string;
    name: string;
    phone?: string;
    whatsapp?: string;
    description: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user || user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();
  await pb.collection(paths.contactsCollection).update(contactId, {
    role: input.role.trim(),
    name: input.name.trim(),
    phone: input.phone?.trim() || "",
    whatsapp: input.whatsapp?.trim() || "",
    description: input.description.trim(),
  });

  await logAction(user, "CONFIG_CHANGE", `Updated contact: ${input.name} (${input.role}).`);
  return { ok: true };
}

/** Delete a contact (admin only). */
export async function deleteContact(
  contactId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAppUser();
  if (!user || user.role !== "admin")
    return { ok: false, error: "Admin role required." };

  const pb = await pbAdmin();
  await pb.collection(paths.contactsCollection).delete(contactId);

  await logAction(user, "CONFIG_CHANGE", `Deleted contact: ${contactId}.`);
  return { ok: true };
}
