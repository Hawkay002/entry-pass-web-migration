// components/layout/app-header.tsx — top bar.
// Mobile: centered title + wrapped account/signout, actions on right edge.
// Desktop: original single-row layout (title left, actions right).

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackgroundPickerButton } from "./background-picker";
import { AppNav } from "./app-nav";
import { Volume2 } from "@/components/animate-ui/icons/volume-2";
import { VolumeOff } from "@/components/animate-ui/icons/volume-off";
import { playSfx, isSfxEnabled, setSfxEnabled } from "@/lib/sfx";
import type { TabName } from "@/lib/types";

export function AppHeader({
  isAdmin,
  userEmail,
  lockedTabs = [],
  unreadCount = 0,
  onOpenNotifications,
  onOpenChat,
  hideActions = false,
}: {
  isAdmin: boolean;
  userEmail: string;
  lockedTabs?: TabName[];
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onOpenChat?: () => void;
  hideActions?: boolean;
}) {
  const router = useRouter();
  const [sfxOn, setSfxOn] = useState(true);

  // Seed from the persisted preference (client only — avoids hydration flip).
  useEffect(() => {
    setSfxOn(isSfxEnabled());
  }, []);

  function toggleSfx() {
    const next = setSfxEnabled(!sfxOn);
    setSfxOn(next);
    // The cue for the new state plays AFTER enabling (unmute) or right
    // before muting (the last sound you hear).
    playSfx(next ? "toggle-on" : "toggle-off");
  }

  const sfxToggle = (
    <button
      onClick={toggleSfx}
      data-sfx-own=""
      onMouseEnter={() => playSfx("hover")}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/5"
      title={sfxOn ? "Sound on — click to mute" : "Sound off — click to enable"}
      style={{ color: sfxOn ? "var(--color-accent-secondary)" : "rgb(255 255 255 / 0.5)" }}
    >
      {sfxOn ? (
        <Volume2 key="on" size={18} animate className="flex size-[18px] items-center justify-center" />
      ) : (
        <VolumeOff key="off" size={18} animate className="flex size-[18px] items-center justify-center" />
      )}
    </button>
  );

  async function handleSignOut() {
    await fetch("/api/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const bell = (
    <button
      onClick={onOpenNotifications}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-secondary px-1 text-[0.6rem] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  const chat = (
    <button
      onClick={onOpenChat}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
      aria-label="Comms Center"
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );

  const signOutBtn = (
    <Button
      variant="ghost"
      size="sm"
      data-sfx-own=""
      onMouseEnter={() => playSfx("hover")}
      onClick={() => { playSfx("disconnect"); handleSignOut(); }}
      className="text-muted-foreground hover:text-white"
    >
      <LogOut className="mr-1.5 h-4 w-4" />
      Sign Out
    </Button>
  );

  const accountInline = (
    <span className="mx-2 hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
      {sfxToggle}
      <BackgroundPickerButton />
      <span className="h-2 w-2 rounded-full bg-success-green" />
      <span className="font-semibold text-accent-secondary">{userEmail}</span>
    </span>
  );

  return (
    <header className="relative z-10 border-b border-white/5 px-6 py-4">
      {/* ===== MOBILE: centered title + wrapped account, actions right ===== */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Top row: spacer | centered title | actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="w-16 shrink-0" />
          <h1 className="text-3xl font-light tracking-tight">
            Ticketing<span className="font-semibold">System</span>.
          </h1>
          <div className="flex w-16 shrink-0 items-center justify-end gap-1">
            {!hideActions && bell}
            {!hideActions && chat}
          </div>
        </div>
        {/* Account + signout wrapper, centered */}
        <div className="flex justify-center">
          <div className="glass-pill inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm">
            {sfxToggle}
            <BackgroundPickerButton />
            <span className="h-5 w-px bg-white/10" />
            <span className="h-2 w-2 rounded-full bg-success-green" />
            <span className="font-semibold text-accent-secondary">{userEmail}</span>
            <Button
              variant="ghost"
              size="sm"
              data-sfx-own=""
              onMouseEnter={() => playSfx("hover")}
              onClick={() => { playSfx("disconnect"); handleSignOut(); }}
              className="h-7 px-2 text-muted-foreground hover:text-white"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP: original single-row layout ===== */}
      <div className="hidden items-center justify-between gap-4 sm:flex">
        <h1 className="text-3xl font-light tracking-tight">
          Ticketing<span className="font-semibold">System</span>.
        </h1>
        <div className="flex items-center gap-2">
          {!hideActions && bell}
          {!hideActions && chat}
          {accountInline}
          {signOutBtn}
        </div>
      </div>

      {/* Nav (shared) */}
      <div className="mt-4 flex justify-center">
        <AppNav isAdmin={isAdmin} lockedTabs={lockedTabs} />
      </div>
    </header>
  );
}
