import type { LucideIcon } from "lucide-react";
import {
  ScanLine,
  Radar,
  Lock,
  Users,
  WifiOff,
  ScrollText,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
}

/** WhatsApp deep-link for all "Request access" / "Contact" CTAs. */
export const WHATSAPP_URL =
  "https://wa.me/918777845713?text=" +
  encodeURIComponent(
    "Hi Shovith, I'd like to request access to EntryPass."
  );

export interface Feature {
  tag: string;
  title: string;
  description: string;
  metric: string;
  icon: LucideIcon;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Step {
  index: string;
  title: string;
  description: string;
}

export interface UseCase {
  title: string;
  description: string;
  points: string[];
}

export interface Gate {
  id: string;
  name: string;
  status: "active" | "standby";
  baseCount: number;
}

export interface StaffMember {
  name: string;
  role: string;
  gate: string;
  status: "active" | "locked";
}

export const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Contact", href: WHATSAPP_URL },
];

export const TRUST_ITEMS: string[] = [
  "Weddings",
  "Corporate Summits",
  "Galas",
  "Product Launches",
  "Award Nights",
  "Private Celebrations",
  "Milestone Events",
  "Conferences",
];

export const FEATURES: Feature[] = [
  {
    tag: "SCANNER",
    title: "Verify in milliseconds",
    description:
      "Every ticket is checked the instant it's scanned — granted, already used, or invalid, decided before the guest finishes stepping through.",
    metric: "~400ms",
    icon: ScanLine,
  },
  {
    tag: "GATES",
    title: "Every gate, one view",
    description:
      "Watch entries update live across every gate you're running, from the main entrance to the VIP line, without walking the floor.",
    metric: "Live",
    icon: Radar,
  },
  {
    tag: "STAFF",
    title: "Control access remotely",
    description:
      "Lock a staff tab the moment something looks wrong. Unlock it just as fast. No one loses control of the door but you.",
    metric: "Instant",
    icon: Lock,
  },
  {
    tag: "GUESTS",
    title: "One list, always current",
    description:
      "Import, sort, and filter your guest list in seconds. Arrived, pending, and absent counts update themselves.",
    metric: "Auto-sync",
    icon: Users,
  },
  {
    tag: "OFFLINE",
    title: "Works when the network doesn't",
    description:
      "Gates keep scanning through dead zones and dropped signal, then sync the moment connection returns.",
    metric: "0 signal req.",
    icon: WifiOff,
  },
  {
    tag: "AUDIT",
    title: "Nothing goes unrecorded",
    description:
      "Every scan, lock, and override is timestamped and logged — a complete record if anyone asks what happened.",
    metric: "Full trail",
    icon: ScrollText,
  },
];

export const STATS: Stat[] = [
  { value: "<1s", label: "Verification per guest" },
  { value: "Zero", label: "Duplicate entries missed" },
  { value: "24/7", label: "Live visibility per gate" },
  { value: "100%", label: "Scans logged automatically" },
];

export const STEPS: Step[] = [
  {
    index: "01",
    title: "Issue",
    description:
      "Create tickets with a live QR preview and send them straight to WhatsApp.",
  },
  {
    index: "02",
    title: "Assign",
    description:
      "Set up gates, staff roles, and access tiers before doors open.",
  },
  {
    index: "03",
    title: "Verify",
    description:
      "Scan and confirm every guest at the door, online or off.",
  },
  {
    index: "04",
    title: "Command",
    description:
      "Watch every gate, lock any tab, and review the log — all from one screen.",
  },
];

export const USE_CASES: UseCase[] = [
  {
    title: "Weddings",
    description:
      "Multi-day functions, multiple families, one gate list that never gets confused.",
    points: [
      "Sangeet to reception, tracked as one event",
      "Separate access for family, vendors, and guests",
      "WhatsApp tickets your relatives will actually open",
    ],
  },
  {
    title: "Galas & Celebrations",
    description:
      "VIP tiers and red-carpet flow, without a clipboard in sight.",
    points: [
      "Tiered access for VIP, press, and general entry",
      "Real-time headcount for the room",
      "Instant flag on anyone re-entering on a used pass",
    ],
  },
  {
    title: "Corporate Events",
    description:
      "Badge-level control for launches, summits, and offsites.",
    points: [
      "Role-based staff access by department",
      "Self check-in kiosk for high-volume arrivals",
      "Full audit trail for security and compliance",
    ],
  },
];

export const GATES: Gate[] = [
  { id: "GATE-A", name: "Main Entrance", status: "active", baseCount: 214 },
  { id: "GATE-B", name: "Garden Lawn", status: "active", baseCount: 189 },
  { id: "GATE-C", name: "VIP Entrance", status: "active", baseCount: 42 },
  { id: "GATE-D", name: "Service Gate", status: "standby", baseCount: 0 },
];

export const STAFF: StaffMember[] = [
  { name: "R. Sharma", role: "Gate Lead", gate: "GATE-A", status: "active" },
  { name: "K. Iyer", role: "Scanner", gate: "GATE-B", status: "active" },
  { name: "A. Mehta", role: "Scanner", gate: "GATE-C", status: "locked" },
  { name: "S. Rao", role: "Kiosk Admin", gate: "GATE-D", status: "active" },
];

export const SECURITY_POINTS: string[] = [
  "Lock any staff tab the instant something looks wrong — unlock it just as fast.",
  "Freeze every gate at once with Maintenance Mode. Set a timer and it lifts itself.",
  "Remove a staff member and their session ends immediately. No lingering access.",
  "The self check-in kiosk locks out after five wrong PINs, every time, per device.",
  "Every lock, override, and reset is timestamped — even a factory reset keeps its own record.",
];

export const ACTIVITY_EVENTS: string[] = [
  "Guest verified",
  "Ticket scanned — granted",
  "Guest verified",
  "Self check-in — kiosk",
  "Guest verified",
  "Duplicate scan flagged",
  "Guest verified",
];

export const ACTIVITY_GATE_IDS: string[] = ["GATE-A", "GATE-B", "GATE-C"];
