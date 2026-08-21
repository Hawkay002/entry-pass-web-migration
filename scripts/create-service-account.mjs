#!/usr/bin/env node
// scripts/create-service-account.mjs — ONE-SHOT (existing installs).
//
//   node scripts/create-service-account.mjs
//
// Creates the app's service account: a `users` record with role=admin that
// the website's server code logs in as (instead of a PB superuser), so
// OTP/MFA can guard the dashboard (_superusers) without breaking the site.
// Idempotent: if the record exists, its password is rotated to match
// .env.local. Writes POCKETBASE_SERVICE_EMAIL/PASSWORD into .env.local.
//
// Fresh installs don't need this — 2-SETUP creates the account for you.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = process.cwd();
const ENV_PATH = join(ROOT, ".env.local");
const PB_URL = "http://127.0.0.1:8090";
const SVC_EMAIL = "service@entrypass.local";

function readEnv() {
  const out = {};
  if (!existsSync(ENV_PATH)) return out;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function genPassword() {
  // 24 chars, unambiguous alphabet — strong enough for a headless account.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const env = readEnv();
const superEmail = env.POCKETBASE_ADMIN_EMAIL;
const superPass = env.POCKETBASE_ADMIN_PASSWORD;
if (!superEmail || !superPass) {
  console.error("Missing POCKETBASE_ADMIN_EMAIL/PASSWORD in .env.local — run 2-SETUP first.");
  process.exit(1);
}

// 1. Superuser token (this script runs BEFORE MFA is (re-)enabled; after that
//    it can never run again headlessly — by design).
const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: superEmail, password: superPass }),
}).then((r) => r.json());
if (!auth.token) {
  console.error("Superuser login failed (is OTP/MFA already enabled on _superusers?).");
  console.error("If so, temporarily disable MFA in the PB dashboard, run this, then re-enable.");
  process.exit(1);
}
const H = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

// 2. Find or create the service account (idempotent by email).
const list = await fetch(`${PB_URL}/api/collections/users/records?filter=${encodeURIComponent(`email = "${SVC_EMAIL}"`)}`, { headers: H }).then((r) => r.json());
const existing = (list.items ?? [])[0];
const password = genPassword();
let recordId;
if (existing) {
  recordId = existing.id;
  const r = await fetch(`${PB_URL}/api/collections/users/records/${recordId}`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({ password, passwordConfirm: password, role: "admin", verified: true }),
  });
  if (!r.ok) { console.error("Could not update the service account:", await r.text()); process.exit(1); }
  console.log("Service account already existed — password rotated, role re-asserted.");
} else {
  const r = await fetch(`${PB_URL}/api/collections/users/records`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      email: SVC_EMAIL, password, passwordConfirm: password,
      emailVisibility: false, role: "admin", verified: true,
    }),
  });
  if (!r.ok) { console.error("Could not create the service account:", await r.text()); process.exit(1); }
  recordId = (await r.json()).id;
  console.log("Service account created.");
}

// 3. Verify the account can actually log in (password + role are correct).
const check = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: SVC_EMAIL, password }),
}).then((r) => r.json());
if (!check.token || check.record?.role !== "admin") {
  console.error("Verification failed — the account exists but cannot log in as role=admin.");
  process.exit(1);
}

// 4. Persist to .env.local (preserving every other key).
const managed = new Set(["POCKETBASE_SERVICE_EMAIL", "POCKETBASE_SERVICE_PASSWORD"]);
const lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/).filter((l) => {
  const m = l.match(/^([A-Z_]+)=/);
  return !(m && managed.has(m[1]));
});
lines.push(`POCKETBASE_SERVICE_EMAIL=${SVC_EMAIL}`);
lines.push(`POCKETBASE_SERVICE_PASSWORD=${password}`);
writeFileSync(ENV_PATH, lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");

console.log(`Saved POCKETBASE_SERVICE_* to .env.local (user id ${recordId}).`);
console.log("Next: restart Pocketbase (applies the og_snapshots rules + settings.appUrl migration),");
console.log("then deploy — the site logs in as the service account from then on.");
