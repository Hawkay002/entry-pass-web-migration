#!/usr/bin/env node
// scripts/dashboard-unlock.mjs — emergency dashboard unlock.
//
// MFA on _superusers blocks BOTH the UI login and API logins without the
// email code (verified live) — so the only guaranteed no-email method is
// the superuser CLI, which resets the password and works offline.
// New password → password-only login → turn OTP/MFA off from inside.
//
// This script:
//   1. stops Pocketbase
//   2. resets the dashboard (superuser) password via CLI
//   3. restarts Pocketbase
//   4. prints the temporary password + next steps

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { platform } from "node:os";
import crypto from "node:crypto";

const ROOT = process.cwd();

function envLocal(key) {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

const PB_DIR = process.env.PB_HOME ?? envLocal("PB_HOME") ?? join(ROOT, "pb");
const PB_URL = "http://127.0.0.1:8090";
const isWin = platform() === "win32";
const pbExe = join(PB_DIR, isWin ? "pocketbase.exe" : "pocketbase");
const pbData = join(PB_DIR, "pb_data");

async function main() {
  const email = envLocal("POCKETBASE_ADMIN_EMAIL");
  if (!email) {
    console.error("Missing POCKETBASE_ADMIN_EMAIL in .env.local — cannot unlock.");
    process.exit(1);
  }
  if (!existsSync(pbExe)) {
    console.error(`Pocketbase not found at ${pbExe}. Check PB_HOME in .env.local.`);
    process.exit(1);
  }

  const tempPass = "EntryPass-" + crypto.randomBytes(4).toString("hex");

  console.log("Step 1/3  Stopping Pocketbase...");
  if (isWin) spawnSync("taskkill", ["/F", "/IM", "pocketbase.exe"], { stdio: "ignore" });
  else spawnSync("pkill", ["-f", "pocketbase"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Step 2/3  Resetting the dashboard password (CLI — no email needed)...");
  const up = spawnSync(`"${pbExe}"`, ["superuser", "upsert", email, tempPass, "--dir", `"${pbData}"`], {
    shell: true, encoding: "utf8",
  });
  const out = (up.stdout || "") + (up.stderr || "");
  if (up.status !== 0 || !/saved|success/i.test(out)) {
    console.error("Password reset failed:\n" + out.slice(0, 300));
    process.exit(1);
  }
  console.log("  password reset OK");

  console.log("Step 3/3  Restarting Pocketbase...");
  const child = spawn(pbExe, ["serve", "--http=0.0.0.0:8090"], { cwd: PB_DIR, stdio: "ignore", detached: true });
  child.unref();
  let ok = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { if ((await fetch(`${PB_URL}/api/health`)).ok) { ok = true; break; } } catch {}
  }

  console.log(`
==========================================
  DASHBOARD PASSWORD RESET DONE
==========================================
Sign in at  http://127.0.0.1:8090/_/  with:

  Email:    ${email}
  Password: ${tempPass}

CASE 1 — email codes still arrive:
  Sign in (password + code), then change the password
  to your own (superusers -> your record).
  Done.

CASE 2 — email codes are broken (that's why you were
  locked out): the password alone cannot bypass the
  email code (that is the security working). Recover
  from your latest backup instead:
  1. Close the go-live window (stop Pocketbase).
  2. Unzip your newest  backups\\entry-pass-*.zip
  3. Replace the  pb\\pb_data  folder with the one
     from the zip (backup was made before the email
     code was switched on, or codes worked then).
  4. Run  3-GO-LIVE.bat  — sign in with the password
     that was valid at backup time.
  5. Fix SMTP (Settings -> SMTP) or turn off OTP/MFA
     (Collections -> _superusers -> Auth) at leisure.
${ok ? "" : "\n(Note: Pocketbase restart not detected — run 3-GO-LIVE.bat.)"}
Write the password down before closing this window!`);
  process.exit(0);
}

main().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
