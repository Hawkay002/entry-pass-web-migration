// lib/guest-list.ts — pure filter + sort helpers for the Guest List.
// Faithful to the original app (script.js:1696-1711) with the fix that
// all 7 sort options are implemented (the original left 4 as no-ops).

import type { Ticket } from "@/lib/types";

export type StatusFilter = "all" | "arrived" | "coming-soon" | "absent";
export type TicketTypeFilter = "all" | "Classic" | "Diamond" | "Gold";
export type GenderFilter = "all" | "Male" | "Female" | "Other";
export type SortKey =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "age-asc"
  | "age-desc"
  | "gender";

export interface GuestListFilters {
  search: string;
  status: StatusFilter;
  ticketType: TicketTypeFilter;
  gender: GenderFilter;
  sort: SortKey;
  gate: string; // "all" or a gate id
}

export const DEFAULT_FILTERS: GuestListFilters = {
  search: "",
  status: "all",
  ticketType: "all",
  gender: "all",
  sort: "newest",
  gate: "all",
};

export function filterTickets(
  tickets: Ticket[],
  filters: GuestListFilters
): Ticket[] {
  const term = filters.search.trim().toLowerCase();

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      !term ||
      t.name.toLowerCase().includes(term) ||
      t.phone.includes(filters.search.trim());
    if (!matchesSearch) return false;
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.gender !== "all" && t.gender !== filters.gender) return false;
    if (
      filters.ticketType !== "all" &&
      (t.ticketType || "Classic") !== filters.ticketType
    )
      return false;
    if (filters.gate !== "all") {
      if (filters.gate === "none" && t.gate) return false;
      if (filters.gate !== "none" && t.gate !== filters.gate) return false;
    }
    return true;
  });

  return sortTickets(filtered, filters.sort);
}

export function sortTickets(tickets: Ticket[], sort: SortKey): Ticket[] {
  const arr = [...tickets];

  // First pass: apply the user-selected sort.
  switch (sort) {
    case "newest":
      arr.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "oldest":
      arr.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "name-asc":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      arr.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "age-asc":
      arr.sort((a, b) => a.age - b.age);
      break;
    case "age-desc":
      arr.sort((a, b) => b.age - a.age);
      break;
    case "gender":
      arr.sort((a, b) => a.gender.localeCompare(b.gender));
      break;
  }

  // Second pass: re-group family members so kids follow their parent.
  // Standalone tickets (no groupId) stay in their sorted position.
  // Group tickets are clustered: parent (no parentName) first, then kids
  // by age descending. The group takes the position of its first member
  // in the sorted array.
  const seen = new Set<string>();
  const result: Ticket[] = [];

  for (const ticket of arr) {
    // Skip if already added as part of a group.
    if (ticket.id && seen.has(ticket.id)) continue;

    if (!ticket.groupId) {
      // Standalone — just add it.
      result.push(ticket);
      if (ticket.id) seen.add(ticket.id);
      continue;
    }

    // Group member — find all tickets in this group from the full set.
    const groupMembers = arr.filter((t) => t.groupId === ticket.groupId);
    if (groupMembers.length <= 1) {
      result.push(ticket);
      if (ticket.id) seen.add(ticket.id);
      continue;
    }

    // Sort: parent first (no parentName), then kids by age descending.
    groupMembers.sort((a, b) => {
      const aIsParent = !a.parentName;
      const bIsParent = !b.parentName;
      if (aIsParent && !bIsParent) return -1;
      if (!aIsParent && bIsParent) return 1;
      return b.age - a.age;
    });

    for (const member of groupMembers) {
      if (member.id && !seen.has(member.id)) {
        result.push(member);
        seen.add(member.id);
      }
    }
  }

  return result;
}
