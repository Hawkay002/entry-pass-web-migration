// components/layout/app-shell.tsx — client wrapper around the app layout.
// Runs the remote-lock listener for staff and renders lock/unlock popups.

"use client";

import { useEffect, useRef, useState, createContext, useContext } from "react";
import { Starfield } from "./starfield";
import { AppHeader } from "./app-header";
import { useBackground } from "@/hooks/use-background";
import { useRemoteLocks } from "@/hooks/use-remote-locks";
import { useStaffCheck } from "@/hooks/use-staff-check";
import { HelpTray } from "@/components/layout/help-tray";
import { EasterEgg } from "@/components/layout/easter-egg";
import { LockedTabsProvider } from "@/components/layout/locked-tabs-context";
import type { LockMetadata, TabName } from "@/lib/types";

/** Exposes whether the current user is admin to child components. */
const IsAdminContext = createContext(false);
export function useIsAdmin() {
  return useContext(IsAdminContext);
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, CheckCircle2, Wrench, TriangleAlert } from "lucide-react";

export function AppShell({
  isAdmin,
  userEmail,
  username,
  children,
}: {
  isAdmin: boolean;
  userEmail: string;
  username: string;
  children: React.ReactNode;
}) {
  const { lockedTabs, metadata } = useRemoteLocks(
    isAdmin ? null : userEmail,
    username
  );
  const { preset } = useBackground();

  // Staff check: if admin removes this staff member, auto-logout instantly.
  useStaffCheck(userEmail, isAdmin);

  // Lock/unlock popups are derived from transitions, tracked via a ref so
  // we don't setState synchronously inside a render-derived effect.
  const wasLockedRef = useRef(false);
  const [lockPopupOpen, setLockPopupOpen] = useState(false);
  const [unlockPopupOpen, setUnlockPopupOpen] = useState(false);

  const isLocked = lockedTabs.length > 0;
  useEffect(() => {
    const wasLocked = wasLockedRef.current;
    if (isLocked && !wasLocked) {
      setLockPopupOpen(true);
      wasLockedRef.current = true;
    } else if (!isLocked && wasLocked) {
      setUnlockPopupOpen(true);
      wasLockedRef.current = false;
    }
  }, [isLocked]);

  return (
    <IsAdminContext.Provider value={isAdmin}>
    <div className="relative min-h-screen">
      {preset.url ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${preset.url})` }}
        />
      ) : (
        <Starfield />
      )}
      <div className="relative z-10">
        <AppHeader
          isAdmin={isAdmin}
          userEmail={userEmail}
          lockedTabs={lockedTabs}
          onOpenNotifications={() => {}}
          onOpenChat={() => {}}
          hideActions
        />
        <main className="mx-auto max-w-6xl p-6">
          <LockedTabsProvider lockedTabs={lockedTabs}>
            {children}
          </LockedTabsProvider>
        </main>
      </div>

      {/* Lock popup (basic / maintenance / suspension) */}
      <Dialog open={lockPopupOpen} onOpenChange={(o) => { if (!o) setLockPopupOpen(false); }}>
        <DialogContent>
          <LockPopupContent metadata={metadata} />
        </DialogContent>
      </Dialog>

      {/* Unlock popup (green, shown when locks cleared) */}
      <Dialog open={unlockPopupOpen} onOpenChange={(o) => { if (!o) setUnlockPopupOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success-green/20">
              <CheckCircle2 className="h-6 w-6 text-success-green" />
            </div>
            <DialogTitle>Access Restored</DialogTitle>
            <DialogDescription>
              Tabs are unlocked for you now. Click refresh to apply changes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </DialogContent>
      </Dialog>

      <HelpTray isAdmin={isAdmin} />
      <EasterEgg />
    </div>
    </IsAdminContext.Provider>
  );
}

function LockPopupContent({ metadata }: { metadata: LockMetadata | null }) {
  const type = metadata?.type ?? "basic";
  const Icon = type === "maintenance" ? Wrench : type === "suspension" ? TriangleAlert : Info;
  const title = type === "maintenance" ? "Maintenance Mode" : type === "suspension" ? "Access Review" : "Role Update";
  const msg = type === "maintenance"
    ? "Admin is performing updates. Some tabs are temporarily locked."
    : type === "suspension"
    ? "Your access to certain features has been flagged for review. Please contact support."
    : "Access to these tabs is currently restricted for your role.";

  return (
    <DialogHeader>
      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-secondary/20">
        <Icon className="h-6 w-6 text-accent-secondary" />
      </div>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{msg}</DialogDescription>
      {type === "maintenance" && metadata?.duration && (
        <div className="rounded-lg bg-black/30 p-3 text-center text-sm">
          Est. Time: <span className="font-semibold">{metadata.duration}</span>
        </div>
      )}
      <p className="pt-2 text-center text-xs text-muted-foreground">
        If you believe this is a mistake, please contact the administrator or try refreshing.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    </DialogHeader>
  );
}
