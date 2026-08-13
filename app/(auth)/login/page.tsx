// app/(auth)/login/page.tsx — the only public route.
// Posts credentials to /api/login, which mints the httpOnly session cookie.
// Supports admin 2FA: if the server returns "2fa_required", shows an OTP input.

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { pb, clientEnv } from "@/lib/pb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Suspense } from "react";
import { Starfield } from "@/components/layout/starfield";
import { Loader2, ShieldCheck, Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // 2FA state.
  const [pending2FA, setPending2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /** Issue a login request to /api/login. Returns the parsed response. */
  async function postLogin(payload: Record<string, string>): Promise<{ res: Response; data: { ok?: boolean; status?: string; error?: string; token?: string } }> {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  useEffect(() => {
    if (searchParams.get("reason") === "expired") {
      toast.info("Your session has expired — please sign in again.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { res, data } = await postLogin({ email, password });

      if (data.status === "2fa_required" && data.token) {
        // Admin needs to enter a TOTP code. Store the pending PB token.
        setPendingToken(data.token);
        setPending2FA(true);
        setOtpCode(["", "", "", "", "", ""]);
        setError("");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (res.ok) {
        router.push("/tickets");
        router.refresh();
        return;
      }

      setError(data.error ?? "Authentication failed.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    // The OAuth redirect URL must point to the Pocketbase server's
    // /api/oauth2-redirect handler (derived from NEXT_PUBLIC_POCKETBASE_URL).
    const redirectUrl = clientEnv.pbUrl.replace(/\/$/, "") + "/api/oauth2-redirect";
    // The SDK opens its own popup with Google's consent screen, then delivers
    // the auth result back over a realtime channel and closes the popup.
    // NOTE: handleGoogleSignIn is NOT async so the popup isn't blocked by
    // the browser's popup-guard heuristics (the SDK handles the async work).
    pb().collection("users").authWithOAuth2({
      provider: "google",
      redirectUrl,
    }).then(async () => {
      const token = (pb().authStore.token as string) ?? "";
      const { res, data } = await postLogin({ token });
      if (data.status === "2fa_required" && data.token) {
        setPendingToken(data.token);
        setPending2FA(true);
        setOtpCode(["", "", "", "", "", ""]);
        setError("");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (res.ok) {
        router.push("/tickets");
        router.refresh();
      } else {
        setError(data.error ?? "Google sign-in failed.");
      }
    }).catch((err) => {
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("popup") || msg.includes("cancelled")) {
        setError("Sign-in cancelled.");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setError("Network error. Check your connection and try again.");
      } else if (msg.includes("provider") || msg.includes("not found") || msg.includes("not configured")) {
        setError("Google sign-in is not configured. Ask the admin to enable it.");
      } else {
        setError(msg || "Google sign-in failed.");
      }
    }).finally(() => {
      setLoading(false);
    });
  }

  // --- 2FA OTP handling (smart input — type anywhere, auto-fills boxes) ---
  function handleOtpInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setOtpCode(next);
    setError("");
    // Auto-submit when 6 digits entered.
    if (digits.length === 6) submit2FA(digits);
  }

  function handleOtpKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      // If current value is empty, clear the last filled digit.
      const joined = otpCode.join("");
      if (joined.length > 0) {
        e.preventDefault();
        const next = ["", "", "", "", "", ""];
        for (let i = 0; i < joined.length - 1; i++) next[i] = joined[i];
        setOtpCode(next);
      }
    }
    if (e.key === "Enter") {
      const joined = otpCode.join("");
      if (joined.length === 6) submit2FA();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const next = ["", "", "", "", "", ""];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setOtpCode(next);
      if (pasted.length === 6) submit2FA(pasted);
    }
  }

  async function submit2FA(prefilledCode?: string) {
    const code = otpCode.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await postLogin({ token: pendingToken, code: prefilledCode ?? code });
      if (res.ok) {
        router.push("/tickets");
        router.refresh();
      } else {
        setError(data.error ?? "Invalid code.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRecovery() {
    if (!recoveryCodeInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await postLogin({ token: pendingToken, recoveryCode: recoveryCodeInput.trim() });
      if (res.ok) {
        router.push("/tickets");
        router.refresh();
      } else {
        setError(data.error ?? "Invalid recovery code.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Render ---

  // 2FA screen (OTP or recovery code).
  if (pending2FA) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <Starfield />
        <Card className="glass-panel relative z-10 w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-secondary/20">
              <KeyRound className="h-6 w-6 text-accent-secondary" />
            </div>
            <CardTitle className="text-2xl">{recoveryMode ? "Recovery Code" : "Verification Code"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {recoveryMode
                ? "Enter one of your saved recovery codes."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </CardHeader>
          <CardContent>
            {!recoveryMode ? (
              <>
                {/* Smart OTP boxes */}
                <div
                  className="relative flex justify-center gap-2"
                  onPaste={handleOtpPaste}
                  onClick={() => otpRefs.current[0]?.focus()}
                >
                  {otpCode.map((digit, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex h-14 w-12 items-center justify-center rounded-lg border text-center text-xl font-semibold transition-colors",
                        otpCode.join("").length === i
                          ? "border-accent-secondary bg-accent-secondary/5 ring-2 ring-accent-secondary/30"
                          : digit
                          ? "border-accent-secondary/40 bg-accent-secondary/10 text-white"
                          : "border-white/15 bg-white/5"
                      )}
                    >
                      {digit}
                    </div>
                  ))}
                  <input
                    ref={(el) => { otpRefs.current[0] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={otpCode.join("")}
                    onChange={handleOtpInput}
                    onKeyDown={handleOtpKeyDown}
                    onPaste={handleOtpPaste}
                    className="absolute inset-0 w-full cursor-text opacity-0"
                    autoFocus
                  />
                </div>
                {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
                <Button className="mt-6 w-full" onClick={() => submit2FA()} disabled={loading || otpCode.join("").length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <button
                  className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-white"
                  onClick={() => { setRecoveryMode(true); setError(""); setOtpCode(["", "", "", "", "", ""]); }}
                >
                  Lost your device? Use a recovery code
                </button>
              </>
            ) : (
              <>
                {/* Recovery code input */}
                <Input
                  type="text"
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && submitRecovery()}
                  placeholder="XXXX-XXXX"
                  className="text-center text-lg tracking-widest"
                  autoFocus
                />
                {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
                <Button className="mt-6 w-full" onClick={submitRecovery} disabled={loading || !recoveryCodeInput.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Recovery Code
                </Button>
                <button
                  className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-white"
                  onClick={() => { setRecoveryMode(false); setError(""); setRecoveryCodeInput(""); }}
                >
                  ← Back to verification code
                </button>
              </>
            )}
            <button
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-white"
              onClick={() => { setPending2FA(false); setPendingToken(""); setError(""); setRecoveryMode(false); }}
            >
              ← Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Standard login screen.
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Starfield />
      <Card className="glass-panel relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-secondary/20">
            <ShieldCheck className="h-6 w-6 text-accent-secondary" />
          </div>
          <CardTitle className="text-2xl">Authorized Access</CardTitle>
          <p className="text-sm text-muted-foreground">
            Verify your identity to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Authenticate
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[rgb(20,20,20)] px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>
          </div>

          {/* Google Sign-In */}
          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={handleGoogleSignIn}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
