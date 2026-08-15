#!/usr/bin/env node
// scripts/start.mjs — START EVERYTHING (run this whenever you want to use the app).
//
// Usage:
//   node scripts/start.mjs           → Pocketbase + the app (dev mode)
//   node scripts/start.mjs --prod    → Pocketbase + the app (faster, for events)
//
// Press Ctrl+C in this window to stop both.

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const ROOT = process.cwd();

/** Read a key from .env.local (for double-click .bat users). */
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
const prod = process.argv.includes("--prod");

if (!existsSync(pbExe)) {
  console.error("Pocketbase not found. Run the setup first:  node scripts/setup.mjs");
  process.exit(1);
}
if (!existsSync(join(ROOT, "node_modules"))) {
  console.log("Installing app packages (first run only)...");
  execSync("pnpm install", { stdio: "inherit", cwd: ROOT });
}

console.log("\nStarting Pocketbase (the database)...");
const pb = spawn(pbExe, ["serve", "--http=0.0.0.0:8090"], {
  cwd: PB_DIR, stdio: "inherit",
});
await new Promise((r) => setTimeout(r, 1500));

console.log("\nStarting the website. Wait for the 'Ready' line, then open the link it shows.\n");
const app = spawn(prod ? "pnpm" : "pnpm",
  prod ? ["exec", "next", "build"] : ["dev"],
  { cwd: ROOT, stdio: "inherit", shell: isWin }
);

if (prod) {
  // build first, then run
  app.on("exit", (code) => {
    if (code !== 0) process.exit(code);
    const run = spawn("pnpm", ["exec", "next", "start"], { cwd: ROOT, stdio: "inherit", shell: isWin });
    run.on("exit", () => pb.kill());
  });
}

const stop = () => { pb.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
pb.on("exit", () => { console.log("\nPocketbase stopped."); process.exit(0); });
