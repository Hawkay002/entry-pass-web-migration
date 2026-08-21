#!/usr/bin/env node
// scripts/setup.mjs — ONE-SHOT SETUP for Entry Pass Web.
//
// Interactive wizard (asks simple questions):
//   node scripts/setup.mjs
//
// Fully automatic (no questions — great for scripts/testing):
//   node scripts/setup.mjs --auto \
//     --dashboard-email admin@example.com --dashboard-pass Secret123 \
//     --app-email you@example.com        --app-pass Secret123 \
//     [--google-id ID --google-secret SECRET]
//
// What it does:
//   1. Downloads the Pocketbase program (if missing)
//   2. Starts Pocketbase
//   3. Creates the Pocketbase dashboard login (superuser)
//   4. Creates all database tables (applies the committed migrations)
//   5. Seeds the starter records
//   6. Creates YOUR app login (email + password, admin access)
//   7. (Optional) connects Google Sign-In
//   8. Writes your .env.local settings file

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform, arch } from "node:os";
import { randomBytes } from "node:crypto";
import readline from "node:readline/promises";

const ROOT = process.cwd();

/** Read a key from .env.local (lets double-click .bat users configure
 *  without a terminal). */
function envLocalKey(key) {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

/** Where Pocketbase lives: PB_HOME env var > PB_HOME in .env.local > ./pb */
const PB_DIR = process.env.PB_HOME ?? envLocalKey("PB_HOME") ?? join(ROOT, "pb");
const PB_VERSION = "0.39.10";
const PB_PORT = Number(process.env.PB_PORT ?? 8090);
const PB_URL = `http://127.0.0.1:${PB_PORT}`;

// ---------- arg parsing (for --auto mode) ----------
function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : def;
}
const AUTO = process.argv.includes("--auto");

// ---------- question helpers ----------
let rl = null;
async function ask(q, def = "") {
  if (AUTO) return def; // auto mode: always take the default/supplied value
  if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
  return a || def;
}
async function askRequired(q, def = "") {
  let v = await ask(q, def);
  while (!v) v = await ask(`${q} (required)`);
  return v;
}
const log = (msg) => console.log(`\n${msg}`);
const step = (msg) => console.log(`\n=== ${msg} ===`);

function pbBinaryName() {
  const os = { win32: "windows", darwin: "darwin", linux: "linux" }[platform()];
  const cpu = arch() === "arm64" ? "arm64" : "amd64";
  return `pocketbase_${PB_VERSION}_${os}_${cpu}.zip`;
}

async function waitHealthy(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${PB_URL}/api/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function superuserToken(email, password) {
  const r = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!r.ok) throw new Error(`Dashboard login failed: ${await r.text()}`);
  const { token } = await r.json();
  return token;
}

// ========================================================================
async function main() {
  console.log(`
==========================================
  Entry Pass Web — one-shot setup wizard
==========================================${AUTO ? "\n  (automatic mode — no questions)" : ""}
Everything stays on this computer. Close this
window at any time to stop and start over.
`);

  // ---------- 1. Pocketbase binary ----------
  step("Step 1 of 6: Checking for the Pocketbase program");
  mkdirSync(PB_DIR, { recursive: true });
  const isWin = platform() === "win32";
  const pbExe = join(PB_DIR, isWin ? "pocketbase.exe" : "pocketbase");

  if (!existsSync(pbExe)) {
    const zip = pbBinaryName();
    const zipPath = join(PB_DIR, zip);
    const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zip}`;
    log(`Downloading Pocketbase (about 12 MB), one time only...\n  ${url}`);
    execSync(`curl -sL -o "${zipPath}" "${url}"`);
    const size = statSync(zipPath).size;
    if (size < 1_000_000) {
      console.error(`Download failed (got ${size} bytes — expected ~12 MB). Check your internet and try again.`);
      rmSync(zipPath, { force: true });
      process.exit(1);
    }
    execSync(
      isWin
        ? `powershell -Command "Expand-Archive -Force '${zipPath}' '${PB_DIR}'"`
        : `cd "${PB_DIR}" && unzip -o "${zip}"`,
      { stdio: "inherit" }
    );
    rmSync(zipPath, { force: true });
    if (!isWin) execSync(`chmod +x "${pbExe}"`);
    console.log("Downloaded and unpacked into the 'pb' folder.");
  } else {
    console.log("Already downloaded — skipping.");
  }

  // ---------- questions ----------
  if (!AUTO) {
    log("A few quick questions. Press Enter to accept the suggestion in [brackets].");
  }

  const dashEmail = AUTO
    ? arg("dashboard-email", "admin@example.com")
    : await askRequired("\n1. DASHBOARD login email (manages the database directly)", "admin@example.com");
  const dashPass = AUTO
    ? arg("dashboard-pass", "")
    : await askRequired("   Dashboard password (8+ characters)");

  const appEmail = AUTO
    ? arg("app-email", dashEmail)
    : await askRequired("\n2. YOUR APP LOGIN email (the website's login page)", dashEmail);
  const appPass = AUTO
    ? arg("app-pass", "")
    : await askRequired("   App password (8+ characters)");

  let googleId = arg("google-id", "");
  let googleSecret = arg("google-secret", "");
  if (!AUTO && !googleId) {
    const wantGoogle = (await ask("\n3. Set up Google Sign-In now? (y/n)", "n")).toLowerCase().startsWith("y");
    if (wantGoogle) {
      console.log(`
   Get two free codes from Google:
   a. https://console.cloud.google.com → sign in → create a project if asked.
   b. Search "OAuth consent screen" → External → Create →
      App name "Entry Pass" + your email → Save through all screens →
      under "Test users" ADD every Gmail that may sign in (important!).
   c. Search "Credentials" → Create credentials → OAuth client ID →
      Web application → Authorized redirect URI (add EXACTLY):

        http://127.0.0.1:8090/api/oauth2-redirect

   d. After clicking Create, copy the Client ID and Client Secret.`);
      googleId = await askRequired("\n   Paste the Client ID");
      googleSecret = await askRequired("   Paste the Client Secret");
    }
  }
  if (rl) rl.close();

  // ---------- 2. start PB ----------
  step("Step 2 of 6: Starting Pocketbase");
  const alreadyUp = await fetch(`${PB_URL}/api/health`).then((r) => r.ok).catch(() => false);
  if (alreadyUp) {
    console.log("Pocketbase is already running — reusing it.");
  } else {
    const migSrc = join(ROOT, "pb_migrations");
    const migDst = join(PB_DIR, "pb_migrations");
    mkdirSync(migDst, { recursive: true });
    for (const f of readdirSync(migSrc)) copyFileSync(join(migSrc, f), join(migDst, f));

    const child = spawn(pbExe, ["serve", `--http=0.0.0.0:${PB_PORT}`], {
      cwd: PB_DIR, detached: true, stdio: "ignore",
    });
    child.unref();
    // Clean up ONLY on failure — a normal setup exit must leave the
    // database running (the old kill-on-any-exit handler stopped the
    // database setup had just finished building).
    const killPb = () => { try { process.kill(-child.pid); } catch {} };
    console.log("Starting (a few seconds)...");
    if (!(await waitHealthy())) {
      console.error("Pocketbase did not start. Run it manually to see the error:");
      console.error(`  cd pb && ${isWin ? "pocketbase.exe" : "./pocketbase"} serve`);
      killPb();
      process.exit(1);
    }
    console.log("Running.");
  }

  // ---------- 3. superuser ----------
  step("Step 3 of 6: Creating the dashboard login");
  execSync(`"${pbExe}" superuser upsert "${dashEmail}" "${dashPass}" --dir "${join(PB_DIR, "pb_data")}"`, {
    stdio: "inherit",
  });
  const token = await superuserToken(dashEmail, dashPass);
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("Dashboard login ready.");

  // ---------- 4. tables + seed ----------
  step("Step 4 of 6: Creating the database tables");
  // Wait for the committed migrations to apply (PB runs them at boot).
  let ticketsReady = false;
  for (let tries = 0; tries < 20 && !ticketsReady; tries++) {
    const t = await fetch(`${PB_URL}/api/collections/tickets/records?perPage=1`, { headers: H });
    ticketsReady = t.ok;
    if (!ticketsReady) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ticketsReady) {
    console.error("Migrations did not apply — 'tickets' table missing. See SETUP.md troubleshooting.");
    process.exit(1);
  }
  console.log("Tables ready.");

  // Seed the three single-record collections (idempotent).
  const seeds = [
    ["settings", "config000000000", { name: "", place: "", deadline: "", timezone: "auto", multiGate: false, gateCategories: [] }],
    ["kiosks_config", "security0000000", { kiosks: [] }],
    ["two_factor", "twofactor000000", { admins: {} }],
  ];
  for (const [col, id, data] of seeds) {
    const existing = await fetch(`${PB_URL}/api/collections/${col}/records/${id}`, { headers: H });
    if (existing.ok) continue; // already seeded (safe re-run)
    await fetch(`${PB_URL}/api/collections/${col}/records`, {
      method: "POST", headers: H, body: JSON.stringify({ id, ...data }),
    });
  }
  console.log("Starter records ready.");

  // ---------- 5. app admin user + google ----------
  step("Step 5 of 6: Creating your app login");
  const list = await (await fetch(`${PB_URL}/api/collections/users/records?perPage=100`, { headers: H })).json();
  const userExists = (list.items ?? []).some((u) => u.email.toLowerCase() === appEmail.toLowerCase());
  if (userExists) {
    console.log("App login already exists — skipping.");
  } else {
    const r = await fetch(`${PB_URL}/api/collections/users/records`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        email: appEmail, password: appPass, passwordConfirm: appPass,
        emailVisibility: false, role: "admin", verified: true,
      }),
    });
    if (!r.ok) { console.error("Could not create the app login:", await r.text()); process.exit(1); }
    console.log("App login created (admin access).");
  }

  if (googleId && googleSecret) {
    console.log("Connecting Google Sign-In...");
    const col = await (await fetch(`${PB_URL}/api/collections/users`, { headers: H })).json();
    await fetch(`${PB_URL}/api/collections/users`, {
      method: "PATCH", headers: H,
      body: JSON.stringify({
        oauth2: {
          ...col.oauth2,
          enabled: true,
          providers: [{ name: "google", clientId: googleId, clientSecret: googleSecret }],
        },
      }),
    });
    console.log("Google Sign-In connected.");
  }

  // Service account — the WEBSITE's headless login (a users record with
  // role=admin, never a superuser). Keeps the site independent of the
  // dashboard's _superusers collection, so OTP/MFA on the dashboard can
  // never break the app.
  const svcEmail = "service@entrypass.local";
  const svcPass = arg("service-pass", "") || randomBytes(18).toString("base64url");
  const svcList = await (await fetch(`${PB_URL}/api/collections/users/records?perPage=200`, { headers: H })).json();
  const svc = (svcList.items ?? []).find((u) => u.email === svcEmail);
  if (svc) {
    await fetch(`${PB_URL}/api/collections/users/records/${svc.id}`, {
      method: "PATCH", headers: H,
      body: JSON.stringify({ password: svcPass, passwordConfirm: svcPass, role: "admin", verified: true }),
    });
    console.log("Service account ready (password rotated).");
  } else {
    const r = await fetch(`${PB_URL}/api/collections/users/records`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        email: svcEmail, password: svcPass, passwordConfirm: svcPass,
        emailVisibility: false, role: "admin", verified: true,
      }),
    });
    if (!r.ok) { console.error("Could not create the service account:", await r.text()); process.exit(1); }
    console.log("Service account created (the website's own login).");
  }

  // ---------- 6. .env.local ----------
  step("Step 6 of 6: Writing your settings file (.env.local)");
  const env = `NEXT_PUBLIC_POCKETBASE_URL=${PB_URL}
POCKETBASE_ADMIN_EMAIL=${dashEmail}
POCKETBASE_ADMIN_PASSWORD=${dashPass}
POCKETBASE_SERVICE_EMAIL=${svcEmail}
POCKETBASE_SERVICE_PASSWORD=${svcPass}
AUTH_COOKIE_NAME=pb_session
ADMIN_EMAILS=${appEmail.toLowerCase()}
`;
  // Preserve keys we don't manage (e.g. VERCEL_TOKEN) if the file exists.
  const envPath = join(ROOT, ".env.local");
  let extra = "";
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !/^(NEXT_PUBLIC_POCKETBASE_URL|POCKETBASE_ADMIN_EMAIL|POCKETBASE_ADMIN_PASSWORD|POCKETBASE_SERVICE_EMAIL|POCKETBASE_SERVICE_PASSWORD|AUTH_COOKIE_NAME|ADMIN_EMAILS)$/.test(m[1])) {
        extra += `${m[1]}=${m[2]}\n`;
      }
    }
  }
  writeFileSync(envPath, env + (extra ? `\n${extra}` : ""));
  console.log("Saved.");

  // ---------- done ----------
  console.log(`
==========================================
  SETUP COMPLETE
==========================================
START THE APP (whenever you want to use it):

  pnpm start:all

Then open:  http://localhost:3000

Website login:      ${appEmail} (the app password you chose)
Database dashboard: http://127.0.0.1:8090/_/
                    (${dashEmail} — the dashboard password)

STOP: press Ctrl+C in the app window.

Full plain-English guide: SETUP.md in this folder
(roles for staff, Google Sign-In, sharing over the internet, fixes).
`);
  process.exit(0);
}

main().catch((e) => { console.error("\nSetup failed:", e.message); process.exit(1); });
