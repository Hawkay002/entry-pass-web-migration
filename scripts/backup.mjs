#!/usr/bin/env node
// scripts/backup.mjs — BACK UP YOUR DATA (one command).
//
//   pnpm backup
//
// Zips the Pocketbase data folder (all tickets, staff, settings, logins)
// into  backups/entry-pass-YYYY-MM-DD-HHmm.zip
//
// Restore = unzip it and put the pb_data folder back next to pocketbase.exe
// (inside the pb folder). That's it — the app doesn't care about anything else.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const ROOT = process.cwd();

/** Read a key from .env.local (so double-click .bat files work without a
 *  terminal — users edit .env.local in Notepad instead of setting env vars). */
function envLocal(key) {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

/** Pocketbase location: PB_HOME env var > PB_HOME in .env.local > ./pb */
const PB_DIR = process.env.PB_HOME ?? envLocal("PB_HOME") ?? join(ROOT, "pb");
const DATA_DIR = join(PB_DIR, "pb_data");
const BACKUP_DIR = join(ROOT, "backups");

if (!existsSync(DATA_DIR)) {
  console.error(`No Pocketbase data found at:\n  ${DATA_DIR}\nRun  pnpm setup  first (or set PB_HOME to your Pocketbase folder).`);
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

// date-stamp in local time: 2026-08-15-1430
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const name = `entry-pass-${stamp}`;

console.log(`Backing up:\n  ${DATA_DIR}\n`);

// Stage a consistent copy first (db + wal/shm files), then zip the staging
// folder — zipping the live folder directly can miss mid-write files.
const stage = join(BACKUP_DIR, `.staging-${name}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const f of readdirSync(DATA_DIR)) {
  // skip dot-entries (.notify is a runtime special file, not data)
  if (f.startsWith(".")) continue;
  const src = join(DATA_DIR, f);
  try {
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(stage, f));
  } catch (e) {
    console.warn(`  (skipped ${f}: ${e.code})`);
  }
}

const zipPath = join(BACKUP_DIR, `${name}.zip`);
if (platform() === "win32") {
  execSync(`powershell -Command "Compress-Archive -Force -Path '${stage}\\*' -DestinationPath '${zipPath}'"`);
} else {
  execSync(`cd "${BACKUP_DIR}" && zip -r -q "${name}.zip" ".staging-${name}" && mv ".staging-${name}.zip" "${name}.zip"`, { shell: "/bin/bash" });
}
rmSync(stage, { recursive: true, force: true });

const size = (statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`Backup created:\n  ${zipPath}  (${size} MB)\n`);
console.log(`To RESTORE on a fresh computer:\n  1. unzip this file\n  2. put the pb_data folder inside your pb folder\n     (the one containing pocketbase.exe)\n  3. run  pnpm go:live\n`);
console.log(`Tip: copy backups to a USB drive or cloud folder —\nthe backup IS your data.`);
