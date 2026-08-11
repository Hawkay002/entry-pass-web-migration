// lib/types.ts — shared data model mirroring the existing Firestore schema.
// All collections are documented in docs/superpowers/specs/2026-07-29-nextjs-rewrite-design.md

export type TicketType = "Classic" | "Diamond" | "Gold" | "SVIP";
export type TicketStatus = "coming-soon" | "arrived" | "absent";
export type Gender = "Male" | "Female" | "Other";

export type Role = "admin" | string; // admin is fixed; others are dynamic from roles collection

/** Gate categories are free-text strings the admin defines (e.g. "Guest Entry", "Staff"). */
export type GateCategory = string;

/** A staff member within a role. */
export interface StaffMember {
  name: string;
  email: string;
  /** Gate this scanner is assigned to (gate id), when multi-gate mode is on. */
  gateId?: string | null;
}

/** Path: roles/{roleName} — dynamically managed by admin. */
export interface StaffRole {
  id: string;        // document id = role name (e.g. "Event Manager")
  name: string;      // display name
  staff: StaffMember[];
  createdAt: number;
}

/** Path: ticket_events_data/shared_event_db/tickets/{autoId} */
export interface Ticket {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  phone: string; // stored as +91XXXXXXXXXX
  ticketType: TicketType;
  status: TicketStatus;
  scanned: boolean;
  scannedAt: number | null; // epoch ms
  scannedBy: string | null; // staff username
  createdBy: string; // staff username
  createdAt: number; // epoch ms
  /** Assigned gate id (multi-gate mode). null when multi-gate is off. */
  gate?: string | null;
  /** Gate id where the ticket was actually scanned. */
  scannedAtGate?: string | null;
}

/** Path: ticket_events_data/shared_event_db/gates/{gateId} */
export interface Gate {
  id: string;
  name: string;
  category: GateCategory;
  order: number;
  active: boolean;
  createdAt: number;
  /** Which ticket types this gate accepts (drives auto-assignment). */
  ticketTypes: TicketType[];
}

/** Stored inside admin_settings/security.kiosks[] — admin-only (contains PINs). */
export interface KioskConfig {
  id: string;
  name: string;
  pin: string;
  gateId: string | null;
  createdAt: number;
}

/** Path: ticket_events_data/shared_event_db/settings/config */
export interface EventSettings {
  name: string;
  place: string;
  deadline: string; // ISO datetime-local string
  timezone?: string; // selected timezone offset (e.g. "+05:30", "auto")
  /** When true, multi-gate mode is active — gates enforce wrong-gate checks. */
  multiGate?: boolean;
  /** Custom category names the admin created (e.g. "Guest Entry", "Staff"). */
  gateCategories?: string[];
}

export type LogAction =
  | "LOGIN"
  | "TICKET_CREATE"
  | "SCAN_ENTRY"
  | "SELF_CHECKIN"
  | "CONFIG_CHANGE"
  | "HELP_CALL"
  | "TICKET_DELETE"
  | "FACTORY_RESET"
  | "LOCK_ACTION"
  | "LOG_DELETE"
  | "EXPORT_DATA"
  | "IMPORT_DATA";

/** Path: activity_logs/{autoId} */
export interface ActivityLog {
  id: string;
  timestamp: number; // epoch ms
  userEmail: string;
  username: string;
  action: LogAction;
  details: string;
}

export type LockReasonType = "basic" | "maintenance" | "suspension";

export interface LockMetadata {
  type: LockReasonType;
  duration: string | null; // e.g. "2 hr 30 min"
  updatedAt: number;
}

/** Path: global_locks/{userEmail} */
export interface GlobalLockDoc {
  userSpecificLocks: Record<string, string[]>; // username -> tab names
  lockMetadata: Record<string, LockMetadata>; // username -> metadata
  lockedTabs?: string[]; // legacy fallback
  updatedAt: number;
}

/** Tabs that can be remotely locked by an admin. */
export type TabName = "create" | "booked" | "scanner" | "settings";

/** Admin lock reason radio option metadata. */
export interface LockReasonOption {
  value: LockReasonType;
  label: string;
  icon: string; // lucide icon name
}

export const LOCK_REASON_OPTIONS: LockReasonOption[] = [
  { value: "basic", label: "Basic", icon: "Info" },
  { value: "maintenance", label: "Maintenance", icon: "Wrench" },
  { value: "suspension", label: "Review", icon: "TriangleAlert" },
];

/** Display label per ticket type (original used "VIP"/"VVIP" for Diamond/Gold). */
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  Classic: "Classic",
  Diamond: "VIP",
  SVIP: "SVIP",
  Gold: "VVIP",
};

/** Human-readable label for the nav tabs. */
export const TAB_LABELS: Record<TabName, string> = {
  create: "Issue Ticket",
  booked: "Guest List",
  scanner: "Scanner",
  settings: "Configuration",
};

/** Path: help_contacts/{autoId} — admin-managed contact list for help tray. */
export interface HelpContact {
  id: string;
  role: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  description: string;
  createdAt: number;
}
