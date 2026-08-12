// hooks/use-contacts.ts — realtime subscription to help contacts.

"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { paths } from "@/lib/paths";
import type { HelpContact } from "@/lib/types";

/** Subscribe to help contacts. Pass `enabled: false` to skip the Firestore
 *  listener until the consumer actually needs the data (e.g. HelpTray closed). */
export function useContacts(enabled = true) {
  const [contacts, setContacts] = useState<HelpContact[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(
      query(collection(db, paths.contactsCollection), orderBy("createdAt", "asc")),
      (snap) => {
        const next: HelpContact[] = [];
        snap.forEach((d) => {
          const data = d.data();
          next.push({
            id: d.id,
            role: String(data.role ?? ""),
            name: String(data.name ?? ""),
            phone: data.phone ? String(data.phone) : undefined,
            whatsapp: data.whatsapp ? String(data.whatsapp) : undefined,
            description: String(data.description ?? ""),
            createdAt: Number(data.createdAt ?? 0),
          });
        });
        setContacts(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useContacts] listener error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [enabled]);

  return { contacts, loading };
}
