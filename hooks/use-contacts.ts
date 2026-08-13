// hooks/use-contacts.ts — polled subscription to help contacts.

"use client";

import { useMemo } from "react";
import { usePolledData } from "@/lib/pb/realtime";
import { fetchContacts } from "@/app/actions/contacts";
import type { HelpContact } from "@/lib/types";

/** Poll help contacts. Pass `enabled: false` to skip until the consumer
 *  actually needs the data (e.g. HelpTray closed). */
export function useContacts(enabled = true) {
  const { data, loading } = usePolledData(
    async () => {
      const res = await fetchContacts();
      return res.ok ? res.contacts : [];
    },
    5000,
    enabled
  );

  const contacts = useMemo(() => data ?? [], [data]);
  return { contacts, loading };
}
