// components/layout/app-nav.tsx — primary tab navigation with icons.
// "Activity Logs" is admin-only. Locked tabs grey out via lockedTabs prop.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, BadgePlus, ScanQrCode, ClipboardClock } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserListIcon, Settings05Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/sfx";
import type { TabName } from "@/lib/types";
import type { ReactNode } from "react";

interface NavTab {
  href: string;
  label: string;
  tabKey?: TabName;
  adminOnly?: boolean;
  icon: ReactNode;
}

const ICON_SIZE = 14;

const TABS: NavTab[] = [
  {
    href: "/tickets",
    label: "Issue Ticket",
    tabKey: "create",
    icon: <BadgePlus className="h-3.5 w-3.5" />,
  },
  {
    href: "/guests",
    label: "Guest List",
    tabKey: "booked",
    icon: <HugeiconsIcon icon={UserListIcon} size={ICON_SIZE} />,
  },
  {
    href: "/scanner",
    label: "Scanner",
    tabKey: "scanner",
    icon: <ScanQrCode className="h-3.5 w-3.5" />,
  },
  {
    href: "/settings",
    label: "Configuration",
    icon: <HugeiconsIcon icon={Settings05Icon} size={ICON_SIZE} />,
  },
  {
    href: "/logs",
    label: "Activity Logs",
    adminOnly: true,
    icon: <ClipboardClock className="h-3.5 w-3.5" />,
  },
];

export function AppNav({
  isAdmin,
  lockedTabs = [],
}: {
  isAdmin: boolean;
  lockedTabs?: TabName[];
}) {
  const pathname = usePathname();

  const visible = TABS.filter((t) => !t.adminOnly || isAdmin);
  const row1 = visible.filter((t) => t.href !== "/settings" && !t.adminOnly);
  const row2 = visible.filter((t) => t.adminOnly || t.href === "/settings");

    const renderTab = (tab: NavTab) => {
    const locked =
      tab.tabKey !== undefined && lockedTabs.includes(tab.tabKey);
    const active = pathname === tab.href;
    return (
      <Link
        key={tab.href}
        href={locked ? "#" : tab.href}
        aria-disabled={locked || undefined}
        data-sfx-own=""
        onMouseEnter={() => playSfx("hover")}
        onClick={(e) => {
          if (locked) {
            e.preventDefault();
            playSfx("blocked");
            return;
          }
          playSfx("select");
          if (typeof window !== "undefined") localStorage.setItem("lastTab", tab.href);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
          active
            ? "bg-white text-black"
            : "text-muted-foreground hover:bg-white/5 hover:text-white",
          locked && "cursor-not-allowed opacity-40 hover:bg-transparent"
        )}
      >
        {locked ? <Lock className="h-3.5 w-3.5" /> : tab.icon}
        {tab.label}
      </Link>
    );
  };

  return (
    <div className="glass-pill inline-flex flex-col items-center gap-2 rounded-xl p-2">
      <nav className="flex flex-col items-center gap-2 sm:flex-row sm:gap-2 scrollbar-thin">
        <div className="flex justify-center gap-2">{row1.map(renderTab)}</div>
        {row2.length > 0 && (
          <div className="flex justify-center gap-2">{row2.map(renderTab)}</div>
        )}
      </nav>
    </div>
  );
}
