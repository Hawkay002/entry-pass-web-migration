#!/usr/bin/env node
// scripts/go-live.mjs — GO LIVE / FIX AFTER REBOOT (one command).
//
//   pnpm go:live
//
// This is the EVERYDAY command for the real deployment, where:
//   - the WEBSITE lives on Vercel (fixed public link)
//   - the DATABASE (Pocketbase) runs on THIS computer
//   - a free Cloudflare "tunnel" connects them
//
// It automatically:
//   1. Starts the database (if not already running)
//   2. Starts the tunnel and gets its public address
//   3. Points your Vercel website at that address (updates the setting)
//   4. Publishes the website
//   5. Keeps the tunnel alive — LEAVE THIS WINDOW OPEN while the app is in use
//
// After a PC reboot the tunnel address changes — just run this again.
// Your public staff link NEVER changes.
//
// First run needs ONE manual step: `vercel login` (opens your browser).
// Project linking + env setup + deploys are all automatic after that.

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const ROOT = process.cwd();

/** Read a key from .env.local (works for double-click .bat users, who edit
 *  the file in Notepad instead of setting terminal env vars). */
function envLocalKey(key) {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

/** Pocketbase location: PB_HOME env var > PB_HOME in .env.local > ./pb */
const PB_DIR = process.env.PB_HOME ?? envLocalKey("PB_HOME") ?? join(ROOT, "pb");
const isWin = platform() === "win32";
const pbExe = join(PB_DIR, isWin ? "pocketbase.exe" : "pocketbase");
const PB_URL = "http://127.0.0.1:8090";
const TUNNEL_TARGET = "http://localhost:8090";
const URL_VAR = "NEXT_PUBLIC_POCKETBASE_URL";

/** Resolve cloudflared: PATH first, then the copy 0b-INSTALL downloads. */
function findCloudflared() {
  const local = join(ROOT, "tools", isWin ? "cloudflared.exe" : "cloudflared");
  if (existsSync(local)) return local;
  return "cloudflared";
}
const CLOUDFLARED = findCloudflared();

const log = (m = "") => console.log(m);
const step = (m) => console.log(`\n=== ${m} ===`);

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", cwd: ROOT, ...opts });
}

/** Parse key=value lines out of .env.local */
function readEnvLocal() {
  const file = join(ROOT, ".env.local");
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Run a vercel CLI command, feeding it stdin answers. Returns stdout.
 *  Hard 3-minute timeout so a stuck prompt can never hang the script. */
function vercel(args, answers = "") {
  return new Promise((resolve, reject) => {
    const p = spawn("vercel", args, { shell: true, cwd: ROOT });
    let out = "", err = "";
    p.stdout.on("data", (d) => {
      out += d;
      if (answers) p.stdin.write(answers);
    });
    p.stderr.on("data", (d) => {
      err += d;
      if (answers) p.stdin.write(answers);
    });
    const timer = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error(`vercel ${args.join(" ")} timed out after 3 minutes`));
    }, 180_000);
    p.on("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out)
        : reject(new Error(`vercel ${args.join(" ")} failed:\n${err || out}`));
    });
  });
}

// ---------- env updates via the CLI (piped values) ----------
// Vercel CLI 59+ accepts piped stdin for `env add`, and `env rm -y` is
// fully non-interactive — no API token needed. This keeps a lone user's
// setup entirely inside the scripts (they only ever run `vercel login`).

/** Clean idempotent upsert: --value + --force overwrites in place (no
 *  stdin, no prompts, no remove/recreate churn, no duplicate entries).
 *  Works for all environments incl. preview (with -y). */
async function cliSetEnv(name, value, targets = ["production", "preview", "development"]) {
  for (const t of targets) {
    sh(`vercel env add ${name} ${t} --value ${JSON.stringify(value)} --force -y`, { timeout: 90_000 });
    log(`  set ${name} for ${t}`);
  }
}

async function pbHealthy() {
  try { return (await fetch(`${PB_URL}/api/health`)).ok; } catch { return false; }
}

// ========================================================================
async function main() {
  console.log(`
==========================================
  GO LIVE  (database + tunnel + website)
==========================================
Leave this window OPEN while the app is in
use — it keeps the tunnel alive. Press
Ctrl+C to stop everything.
`);

  // ---------- preflight ----------
  if (!existsSync(pbExe)) {
    console.error("Pocketbase not found. Run the setup first:  pnpm setup");
    process.exit(1);
  }
  let loggedIn = false;
  try {
    const who = sh(`vercel whoami`).trim().split("\n").pop();
    if (who && !who.includes("vercel login")) {
      log(`Vercel account: ${who}`);
      loggedIn = true;
    }
  } catch { /* not logged in */ }
  if (!loggedIn) {
    log(`Not connected to Vercel yet.

Starting the connection now — your browser will
open a Vercel page: click Approve / Continue
there, then come back to THIS window.
(If the browser doesn't open by itself, copy the
address this window prints into your browser.)`);
    const okLogin = await new Promise((resolve) => {
      const p = spawn("vercel", ["login"], { shell: true, stdio: "inherit", cwd: ROOT });
      p.on("exit", (code) => resolve(code === 0));
    });
    if (!okLogin) {
      console.error("\nLogin did not complete. Run this again (3-GO-LIVE.bat)\nand click Approve in the browser when it opens.");
      process.exit(1);
    }
    log("Connected to Vercel.");
  }
  if (!existsSync(join(ROOT, ".vercel", "project.json"))) {
    log("First run here — connecting this folder to your Vercel account...");
    try {
      await vercel(["link", "--yes"]);
      log("Connected (a new Vercel project was created for you).");
    } catch (e) {
      console.error("Could not connect to Vercel automatically:\n" + e.message);
      process.exit(1);
    }
  }
  try { sh(`"${CLOUDFLARED}" --version`); } catch {
    console.error("cloudflared (the tunnel program) isn't installed.\nFix: open the 0-CHECK-FIRST folder and double-click 0b-INSTALL-NEEDED.bat\n(or install manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)\nThen run pnpm go:live again.");
    process.exit(1);
  }

  // ---------- 1. database ----------
  step("1/4  Starting the database (if needed)");
  let pbChild = null;
  if (await pbHealthy()) {
    log("Already running.");
  } else {
    pbChild = spawn(pbExe, ["serve", "--http=0.0.0.0:8090"], { cwd: PB_DIR, stdio: "ignore", detached: !isWin });
    for (let i = 0; i < 20 && !(await pbHealthy()); i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!(await pbHealthy())) {
      console.error("The database didn't start. Try running it manually to see the error:");
      console.error(`  cd pb && ${isWin ? "pocketbase.exe" : "./pocketbase"} serve`);
      process.exit(1);
    }
    log("Started.");
  }

  // ---------- 2. tunnel ----------
  step("2/4  Starting the tunnel (gets a public address for your database)");
  const tunnel = spawn(`"${CLOUDFLARED}" tunnel --url ${TUNNEL_TARGET}`, { shell: true });
  let tunnelUrl = "";
  tunnel.stderr.on("data", (d) => {
    const s = d.toString();
    if (!tunnelUrl) {
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) tunnelUrl = m[0];
    }
  });
  tunnel.stdout.on("data", (d) => {
    if (!tunnelUrl) {
      const m = d.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) tunnelUrl = m[0];
    }
  });
  for (let i = 0; i < 30 && !tunnelUrl; i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!tunnelUrl) {
    console.error("Could not get a tunnel address. Is your internet connection working? Try again.");
    tunnel.kill(); if (pbChild) pbChild.kill();
    process.exit(1);
  }
  log(`Tunnel address: ${tunnelUrl}`);

  // ---------- 3. point Vercel at the tunnel ----------
  step("3/4  Pointing your website at the database");
  // Always sync every var (--force is idempotent) — never skip on a
  // same-URL shortcut, which previously let stale/missing vars drift.
  log("Updating website settings (takes a minute)...");
  // Every var goes to ALL environments: git pushes trigger Preview builds
  // that die without them, and --force makes each set an idempotent
  // overwrite (no duplicate entries accumulating).
  await cliSetEnv(URL_VAR, tunnelUrl);

  // keep the other required settings in sync from .env.local every run —
  // idempotent, fixes any that are missing/stale in any environment
  const envLocal = readEnvLocal();
  for (const name of ["POCKETBASE_ADMIN_EMAIL", "POCKETBASE_ADMIN_PASSWORD", "AUTH_COOKIE_NAME", "ADMIN_EMAILS"]) {
    if (envLocal[name]) {
      await cliSetEnv(name, envLocal[name]);
    }
  }

  // ---------- 4. publish ----------
  step("4/4  Publishing the website");
  const out = await vercel(["--prod"]);

  // The link to share is the project's PERMANENT domain:
  //   https://<projectName>.vercel.app
  // (Vercel derives it from the project name; the one-off deployment URL
  // in the deploy output carries a random hash and Google Sign-In only
  // trusts the permanent one.) Verify it responds before printing it.
  const { projectName } = JSON.parse(readFileSync(join(ROOT, ".vercel", "project.json"), "utf8"));
  const alias = `https://${projectName}.vercel.app`;
  let publicLink = "";
  try {
    const r = await fetch(alias, { redirect: "follow" });
    if (r.ok) publicLink = alias;
  } catch { /* alias didn't respond — fall back below */ }
  if (!publicLink) {
    const oneOff = (out.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) || []).pop() ?? "";
    log(`\nNOTE: the permanent link (${alias}) did not respond yet — it can take\na minute after the very first publish. Check it in your browser soon.`);
    publicLink = oneOff;
  }
  return finish(tunnel, pbChild, publicLink);
}

function finish(tunnel, pbChild, alias) {
  console.log(`
==========================================
  YOU ARE LIVE
==========================================
${alias ? `Public link (share with staff — NEVER changes):\n\n  ${alias}\n` : ""}
Database dashboard (only on this computer):
  http://127.0.0.1:8090/_/

KEEP THIS WINDOW OPEN — it keeps the tunnel
alive. Minimize it; don't close it.

Stop everything: click here and press Ctrl+C.
After a PC reboot, just run:  pnpm go:live
${alias ? `
------------------------------------------
GOOGLE SIGN-IN (one-time setup — skip if you
don't use the "Sign in with Google" button):

1. Open  console.cloud.google.com → Credentials
2. Your OAuth client → Authorized redirect URIs
3. Paste this EXACTLY as one new line:

   ${alias}/api/oauth/callback

(Local testing too? also add:
   http://localhost:3000/api/oauth/callback )
Done — the Google button now works.
------------------------------------------` : ""}
`);
  const stop = () => {
    try { tunnel.kill(); } catch {}
    if (pbChild) { try { pbChild.kill(); } catch {} }
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  tunnel.on("exit", () => {
    console.log("\nTunnel stopped. Run  pnpm go:live  to go live again.");
    if (pbChild) { try { pbChild.kill(); } catch {} }
    process.exit(0);
  });
  // keep the process alive with the tunnel
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => { console.error("\nFailed:", e.message); process.exit(1); });
