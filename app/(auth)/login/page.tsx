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
import { Loader2, ShieldCheck, Eye, EyeOff, KeyRound, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ensureSfxUnlock, playSfx, playToastSfx, resumeCtx, startProcessingSfx, stopProcessingSfx, unlockSfx } from "@/lib/sfx";

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
  // Landing back from Google's account picker (?oauth_code=...) must START
  // in the Authenticating state — initializing from the URL means no idle
  // form flashes before the exchange effect kicks in.
  const isOauthReturn = () =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("oauth_code");
  const [loading, setLoading] = useState(isOauthReturn);
  // Which button gets the green ✓ Authenticated state after success.
  const [authedVia, setAuthedVia] = useState<"password" | "google" | null>(null);
  // True while the GOOGLE flow is the active one (initiating or the return
  // exchange) — puts the spinner on the Google button, not Authenticate.
  const [googleBusy, setGoogleBusy] = useState(isOauthReturn);
  const authed = authedVia !== null;
  const [showPw, setShowPw] = useState(false);

  // Audio must be unlocked from a real user gesture (mobile requirement).
  useEffect(() => {
    ensureSfxUnlock();
  }, []);

  // 2FA state.
  const [pending2FA, setPending2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Guards the OAuth-return exchange against ever running twice.
  const oauthHandledRef = useRef(false);

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
      playToastSfx();
      toast.info("Your session has expired — please sign in again.");
    }
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      playSfx("error");
      setError("Google sign-in was cancelled or failed. Please try again.");
    }
  }, [searchParams]);

  // OAuth callback: /api/oauth/callback redirected back here with
  // ?oauth_code=&state=. Two possible contexts:
  //  a) POPUP return (window.opener set) — the opening login page is polling
  //     this popup and runs the exchange itself (its document keeps the user
  //     gesture, so the SFX play). This page just shows a standby message.
  //  b) DIRECT return (full-page redirect flow, or popup blocked fallback) —
  //     this document completes the exchange. On a fresh page load Chrome
  //     keeps the AudioContext suspended without a gesture, so we try to
  //     resume it first; some browsers stay silent — inherent, not a bug.
  useEffect(() => {
    const code = searchParams.get("oauth_code");
    const state = searchParams.get("state");
    if (!code) return;
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      // Case (a): the opener drives. Show the busy state (URL-initialized)
      // and do nothing — the opener will close this popup.
      setLoading(true);
      setGoogleBusy(true);
      return;
    }
    if (oauthHandledRef.current) return;
    oauthHandledRef.current = true;
    setLoading(true);
    setGoogleBusy(true);
    unlockSfx();
    void runOAuthExchange(code, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Complete the OAuth code exchange + all state/sfx handling. Shared by
   *  the redirect-return effect and the popup flow (same document). */
  async function runOAuthExchange(code: string, state: string | null) {
    // Guarantee the Authenticating state is perceptible even when the token
    // exchange is near-instant: keep the spinner at least 600ms total.
    const startedAt = Date.now();
    const holdSpinner = () =>
      new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - startedAt))));
    let success = false;
    try {
      // Settle the audio-resume attempt BEFORE scheduling the loop, so the
      // processing cue isn't scheduled onto a still-pending context.
      await resumeCtx();
      startProcessingSfx();
      const stored = JSON.parse(sessionStorage.getItem("pb_oauth") ?? "null") as
        | { codeVerifier: string; state: string }
        | null;
      if (!stored || stored.state !== state) {
        stopProcessingSfx();
        playSfx("error");
        setError("Sign-in session expired. Please try again.");
        sessionStorage.removeItem("pb_oauth");
        return;
      }
      sessionStorage.removeItem("pb_oauth");
      const { res, data } = await postLogin({
        oauthCode: code,
        codeVerifier: stored.codeVerifier,
        // The exact redirect_uri used at the authorize step — the server
        // MUST send Google a byte-identical one at the token exchange.
        redirectUri: window.location.origin + "/api/oauth/callback",
      });
      if (data.status === "2fa_required" && data.token) {
        stopProcessingSfx();
        playSfx("notification");
        setPendingToken(data.token);
        setPending2FA(true);
        setOtpCode(["", "", "", "", "", ""]);
        setError("");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (res.ok) {
        await holdSpinner();
        stopProcessingSfx();
        playSfx("complete");
        // Green ✓ Authenticated state — held a full second so it is
        // clearly seen and heard before the page navigates away.
        setAuthedVia("google");
        await new Promise((r) => setTimeout(r, 1000));
        success = true;
        // HARD navigation — full page load. The OAuth return lands on a
        // service-worker-served page; client-side router navigation can
        // resolve /tickets from stale router/page cache and bounce back.
        // A hard load forces a fresh authenticated render.
        window.location.replace("/tickets");
        return; // page unloads — skip state updates below
      } else {
        stopProcessingSfx();
        playSfx("error");
        setError(data.error ?? "Google sign-in failed.");
      }
    } catch {
      stopProcessingSfx();
      playSfx("error");
      setError("Network error during sign-in. Try again.");
    } finally {
      // Only stand the buttons back up when the exchange did NOT succeed —
      // on success the ✓ state must persist through the navigation.
      if (!success) {
        setLoading(false);
        setGoogleBusy(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    startProcessingSfx();

    try {
      const { res, data } = await postLogin({ email, password });

      if (data.status === "2fa_required" && data.token) {
        // Admin needs to enter a TOTP code. Store the pending PB token.
        stopProcessingSfx();
        playSfx("notification");
        setPendingToken(data.token);
        setPending2FA(true);
        setOtpCode(["", "", "", "", "", ""]);
        setError("");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (res.ok) {
        // Authenticated — show the green-tick state + complete sfx briefly
        // so the success lands perceptibly, then navigate.
        stopProcessingSfx();
        playSfx("complete");
        setAuthedVia("password");
        await new Promise((r) => setTimeout(r, 1000));
        router.push("/tickets");
        router.refresh();
        return;
      }

      stopProcessingSfx();
      playSfx("error");
      setError(data.error ?? "Authentication failed.");
    } catch {
      stopProcessingSfx();
      playSfx("error");
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    setError("");
    playSfx("select");
    // POPUP flow (preferred): the login page NEVER navigates away, so its
    // AudioContext (unlocked by this very click) keeps running — the
    // processing/complete SFX play during the exchange. The popup is opened
    // synchronously inside the click handler, which makes it gesture-legal
    // (not popup-blocked). We poll the popup until it lands back on our
    // origin with ?oauth_code=..., then run the exchange HERE.
    // Fallback: popup blocked / blocked-by-browser → the old full-page
    // redirect flow (sounds may be silent on the return page — browser
    // autoplay policy, not fixable without a gesture).
    // 0.0.0.0 (how the LAN server may be opened) is normalized to localhost so
    // the OAuth return always lands on the Google-registered loopback origin.
    const originUrl = new URL(window.location.origin);
    if (originUrl.hostname === "0.0.0.0") originUrl.hostname = "localhost";
    const redirectUri = originUrl.origin + "/api/oauth/callback";
    pb().collection("users").listAuthMethods().then((res) => {
      const google = (res.oauth2?.providers || []).find((p) => p.name === "google");
      if (!google) {
        playSfx("error");
        setError("Google sign-in is not configured. Ask the admin to enable it.");
        return;
      }
      sessionStorage.setItem("pb_oauth", JSON.stringify({
        codeVerifier: google.codeVerifier,
        state: google.state,
      }));
      // PB leaves redirect_uri empty in listAuthMethods — set our callback.
      const url = new URL(google.authURL);
      url.searchParams.set("redirect_uri", redirectUri);
      // Always show the account picker — without this, Google auto-selects
      // the last-used account (prompt=none) and skips the chooser.
      url.searchParams.set("prompt", "select_account");

      // NO "noopener" here — it severs the window handle (window.open returns
      // null) AND the opener link, which broke the handoff: main window fell
      // back to the redirect flow while the popup ALSO opened, and the popup
      // then ran the whole exchange itself. We need the handle to poll the
      // popup and close it after the code arrives.
      const popup = window.open(url.toString(), "google_oauth", "width=500,height=620");
      if (popup && !popup.closed) {
        // Popup is up — the busy state starts NOW (user is picking an
        // account), and the exchange will run in THIS document.
        setLoading(true);
        setGoogleBusy(true);
        startProcessingSfx();
        const poll = setInterval(() => {
          let done = false;
          let handedOff = false;
          try {
            if (popup.closed) {
              done = true; // user closed the popup without signing in
            } else {
              const pu = popup.location;
              if (pu && pu.origin === window.location.origin && pu.pathname === "/login") {
                const params = new URLSearchParams(pu.search);
                const code = params.get("oauth_code");
                if (code) {
                  done = true;
                  handedOff = true;
                  stopProcessingSfx(); // runOAuthExchange restarts its own loop
                  popup.close();
                  void runOAuthExchange(code, params.get("state"));
                }
              }
            }
          } catch {
            // Cross-origin while on Google — keep polling.
          }
          if (done) {
            clearInterval(poll);
            if (!handedOff) {
              // Abandoned (popup closed) — restore the buttons.
              stopProcessingSfx();
              setLoading(false);
              setGoogleBusy(false);
            }
          }
        }, 300);
        // Safety: stop polling after 5 minutes.
        setTimeout(() => clearInterval(poll), 300_000);
      } else {
        // Popup blocked — full-page redirect fallback.
        window.location.href = url.toString();
      }
    }).catch((err) => {
      playSfx("error");
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("network") || msg.includes("fetch")) {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(msg || "Could not start Google sign-in.");
      }
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
    startProcessingSfx();
    try {
      const { res, data } = await postLogin({ token: pendingToken, code: prefilledCode ?? code });
      if (res.ok) {
        stopProcessingSfx();
        playSfx("complete");
        setAuthedVia("password");
        await new Promise((r) => setTimeout(r, 1000));
        router.push("/tickets");
        router.refresh();
      } else {
        stopProcessingSfx();
        playSfx("error");
        setError(data.error ?? "Invalid code.");
      }
    } catch {
      stopProcessingSfx();
      playSfx("error");
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRecovery() {
    if (!recoveryCodeInput.trim()) return;
    setLoading(true);
    setError("");
    startProcessingSfx();
    try {
      const { res, data } = await postLogin({ token: pendingToken, recoveryCode: recoveryCodeInput.trim() });
      if (res.ok) {
        stopProcessingSfx();
        playSfx("complete");
        setAuthedVia("password");
        await new Promise((r) => setTimeout(r, 1000));
        router.push("/tickets");
        router.refresh();
      } else {
        stopProcessingSfx();
        playSfx("error");
        setError(data.error ?? "Invalid recovery code.");
      }
    } catch {
      stopProcessingSfx();
      playSfx("error");
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
                <Button
                  className={cn(
                    "mt-6 w-full",
                    authedVia === "password" &&
                      "border border-success-green/60 bg-success-green/15 text-success-green hover:bg-success-green/20"
                  )}
                  onClick={() => submit2FA()}
                  disabled={loading || authed || otpCode.join("").length !== 6}
                  onMouseEnter={() => playSfx("hover")}
                >
                  {authed ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Authenticated
                    </>
                  ) : (
                    <>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify
                    </>
                  )}
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
                <Button
                  className={cn(
                    "mt-6 w-full",
                    authedVia === "password" &&
                      "border border-success-green/60 bg-success-green/15 text-success-green hover:bg-success-green/20"
                  )}
                  onClick={submitRecovery}
                  disabled={loading || authed || !recoveryCodeInput.trim()}
                  onMouseEnter={() => playSfx("hover")}
                >
                  {authed ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Authenticated
                    </>
                  ) : (
                    <>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify Recovery Code
                    </>
                  )}
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
            <Button
              type="submit"
              data-sfx-own
              className={cn(
                "w-full",
                authedVia === "password" &&
                  "border border-success-green/60 bg-success-green/15 text-success-green hover:bg-success-green/20"
              )}
              disabled={loading || authed}
              onMouseEnter={() => playSfx("hover")}
              onClick={() => playSfx("select")}
            >
              {authedVia === "password" ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Authenticated
                </>
              ) : (
                <>
                  {!googleBusy && loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Authenticate
                </>
              )}
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
            data-sfx-own
            className={cn(
              "w-full",
              authedVia === "google" &&
                "border border-success-green/60 bg-success-green/15 text-success-green hover:bg-success-green/20"
            )}
            disabled={loading}
            onClick={handleGoogleSignIn}
            onMouseEnter={() => playSfx("hover")}
          >
            {authedVia === "google" ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Authenticated
              </>
            ) : googleBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating…
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
