// components/admin/panels/two-factor-panel.tsx — Admin 2FA (TOTP) setup/disable.

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function TwoFactorPanel() {
  const [status, setStatus] = useState<"loading" | "disabled" | "enabled">("loading");
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  function checkStatus() {
    fetch("/api/2fa-setup")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "already_enabled") setStatus("enabled");
        else setStatus("disabled");
      })
      .catch(() => setStatus("disabled"));
  }

  useEffect(() => { checkStatus(); }, []);

  async function startSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa-setup");
      const data = await res.json();
      if (data.ok && data.status === "setup") {
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
        setVerifyCode("");
        setRecoveryCodes([]);
        setShowRecovery(false);
        setSetupOpen(true);
      } else if (data.status === "already_enabled") {
        setStatus("enabled");
      }
    } catch {}
    setBusy(false);
  }

  async function confirmSetup() {
    if (verifyCode.length !== 6) return;
    setBusy(true);
    try {
      const res = await fetch("/api/2fa-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code: verifyCode }),
      });
      const data = await res.json();
      if (data.ok) {
        setRecoveryCodes(data.recoveryCodes);
        setShowRecovery(true);
        setStatus("enabled");
      } else {
        toast.error(data.error ?? "Invalid code");
      }
    } catch {
      toast.error("Failed to enable 2FA");
    }
    setBusy(false);
  }

  async function confirmDisable() {
    if (disableCode.length !== 6) return;
    setBusy(true);
    try {
      const res = await fetch("/api/2fa-setup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("disabled");
        setDisableOpen(false);
        setDisableCode("");
        toast.success("2FA disabled");
      } else {
        toast.error(data.error ?? "Invalid code");
      }
    } catch {
      toast.error("Failed to disable");
    }
    setBusy(false);
  }

  const statusBadge =
    status === "enabled" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-success-green/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-success-green">
        <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
        Active
      </span>
    ) : status === "disabled" ? (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.65rem] font-medium text-amber-400">
        Not configured
      </span>
    ) : null;

  return (
    <>
      <CollapsibleSection
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Two-Factor Authentication"
        badge={statusBadge}
      >
        <div className="space-y-3 px-6 pb-5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Require a 6-digit code from Google Authenticator on every admin login.
            </p>
            {status === "disabled" && (
              <Button size="sm" variant="outline" onClick={startSetup} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Enable 2FA
              </Button>
            )}
            {status === "enabled" && (
              <Button size="sm" variant="outline" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setDisableOpen(true)}>
                Disable 2FA
              </Button>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Setup dialog — QR + verify + recovery codes */}
      <Dialog open={setupOpen} onOpenChange={(o) => { if (!showRecovery) setSetupOpen(o); }}>
        <DialogContent>
          {!showRecovery ? (
            <>
              <DialogHeader>
                <DialogTitle>Set Up 2FA</DialogTitle>
                <DialogDescription>
                  Scan the QR code with Google Authenticator (or similar), then enter the 6-digit code.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="2FA QR Code" className="rounded-lg" />
                )}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Can't scan? Show manual key</summary>
                  <code className="mt-1 block break-all rounded bg-white/5 p-2">{secret}</code>
                </details>
                {/* Smart OTP: single invisible input, visual boxes */}
                <div
                  className="relative flex justify-center gap-2"
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                    if (pasted) {
                      setVerifyCode(pasted);
                      if (pasted.length === 6) confirmSetup();
                    }
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex h-12 w-10 items-center justify-center rounded-lg border text-center text-lg font-semibold transition-colors",
                        verifyCode.length === i
                          ? "border-accent-secondary bg-accent-secondary/5 ring-2 ring-accent-secondary/30"
                          : i < verifyCode.length
                          ? "border-accent-secondary/40 bg-accent-secondary/10 text-white"
                          : "border-white/15 bg-white/5"
                      )}
                    >
                      {verifyCode[i] ?? ""}
                    </div>
                  ))}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={verifyCode}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setVerifyCode(digits);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && verifyCode.length > 0) {
                        e.preventDefault();
                        setVerifyCode(verifyCode.slice(0, -1));
                      }
                      if (e.key === "Enter" && verifyCode.length === 6) {
                        confirmSetup();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      if (pasted) {
                        setVerifyCode(pasted);
                        if (pasted.length === 6) confirmSetup();
                      }
                    }}
                    className="absolute inset-0 w-full cursor-text opacity-0"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSetupOpen(false)}>Cancel</Button>
                <Button onClick={confirmSetup} disabled={busy || verifyCode.length !== 6}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify &amp; Enable
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-success-green">2FA Enabled</DialogTitle>
                <DialogDescription>
                  Save these recovery codes. Each can be used once if you lose access to your authenticator.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-4">
                {recoveryCodes.map((code, i) => (
                  <code key={i} className="text-center text-sm font-medium text-white">{code}</code>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const text = `EntryPass — 2FA Recovery Codes\n\n${recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nEach code can be used once. Store securely.`;
                    const blob = new Blob([text], { type: "text/plain" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "entrypass-recovery-codes.txt";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .txt
                </Button>
                <Button onClick={() => { setSetupOpen(false); setShowRecovery(false); }}>
                  I&apos;ve saved them
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">Disable 2FA?</DialogTitle>
            <DialogDescription>Enter your current 6-digit code to confirm.</DialogDescription>
          </DialogHeader>
          {/* Smart OTP boxes */}
          <div className="relative flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-12 w-10 items-center justify-center rounded-lg border text-center text-lg font-semibold transition-colors",
                  disableCode.length === i
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/30"
                    : i < disableCode.length
                    ? "border-destructive/40 bg-destructive/10 text-white"
                    : "border-white/15 bg-white/5"
                )}
              >
                {disableCode[i] ?? ""}
              </div>
            ))}
            <input
              type="text"
              inputMode="numeric"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && disableCode.length > 0) {
                  e.preventDefault();
                  setDisableCode(disableCode.slice(0, -1));
                }
                if (e.key === "Enter" && disableCode.length === 6) {
                  confirmDisable();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                if (pasted) {
                  setDisableCode(pasted);
                  if (pasted.length === 6) confirmDisable();
                }
              }}
              className="absolute inset-0 w-full cursor-text opacity-0"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDisable} disabled={busy || disableCode.length !== 6}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
