#!/usr/bin/env node
// scripts/verify-service-account.mjs — one-shot verification that the
// service account (users role=admin) can perform every operation the app's
// server code performs, THROUGH RULES (no superuser bypass). Run against a
// LOCAL test instance before deploying; cleans up its test records.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const env = {};
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const PB = env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

const auth = await fetch(`${PB}/api/collections/users/auth-with-password`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: env.POCKETBASE_SERVICE_EMAIL, password: env.POCKETBASE_SERVICE_PASSWORD }),
}).then((r) => r.json());
if (!auth.token) { console.error("SERVICE LOGIN FAILED:", JSON.stringify(auth).slice(0, 200)); process.exit(1); }
const H = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };
console.log(`logged in as ${auth.record.email} (role=${auth.record.role})`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  [OK] ${name}`); }
  else { fail++; console.log(`  [FAIL] ${name} ${extra}`); }
};

// helper: create/get/patch/delete on a collection with a unique marker record
async function crud(name, col, body) {
  const marker = ("svctest" + Date.now().toString(36)).slice(0, 15);
  const payload = { id: marker, ...body };
  const c = await fetch(`${PB}/api/collections/${col}/records`, { method: "POST", headers: H, body: JSON.stringify(payload) });
  const cBody = await c.clone().json().catch(() => ({}));
  ok(`${name}: create`, c.ok, `→ ${c.status} ${JSON.stringify(cBody).slice(0, 120)}`);
  if (!c.ok) return;
  const id = cBody.id ?? payload.id;
  const g = await fetch(`${PB}/api/collections/${col}/records/${id}`, { headers: H });
  ok(`${name}: view`, g.ok, `→ ${g.status}`);
  const u = await fetch(`${PB}/api/collections/${col}/records/${id}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
  ok(`${name}: update`, u.ok, `→ ${u.status} ${(await u.text()).slice(0, 120)}`);
  const l = await fetch(`${PB}/api/collections/${col}/records?perPage=1`, { headers: H });
  ok(`${name}: list`, l.ok, `→ ${l.status}`);
  const d = await fetch(`${PB}/api/collections/${col}/records/${id}`, { method: "DELETE", headers: H });
  ok(`${name}: delete`, d.ok || d.status === 204, `→ ${d.status}`);
}

console.log("\n— tickets (create/view/update/list/delete) —");
await crud("tickets", "tickets", {
  name: "Svc Test", gender: "Male", age: 30, phone: "+919999999999",
  ticketType: "Classic", status: "coming-soon", scanned: false,
  createdBy: "svctest", createdAt: Date.now(),
});

console.log("\n— gates —");
await crud("gates", "gates", { name: "SvcGate", active: false, allowedTypes: [] });

console.log("\n— logs (create + admin list/delete) —");
await crud("logs", "logs", { action: "SVC_TEST", message: "verify", timestamp: Date.now() });

console.log("\n— roles (read-modify-write of staff array) —");
await crud("roles", "roles", { name: "SvcRole", staff: [] });

console.log("\n— locks —");
await crud("locks", "locks", { userEmail: "svctest@x.test", lockedTabs: ["tickets"] });

console.log("\n— contacts —");
await crud("contacts", "contacts", { name: "Svc Contact", phone: "+910000000000", role: "staff", order: 999 });

console.log("\n— kiosk_status —");
await crud("kiosk_status", "kiosk_status", { updatedAt: Date.now() });

console.log("\n— og_snapshots —");
await crud("og_snapshots", "og_snapshots", { image: "data:image/jpeg;base64,svctest", ticketType: "Classic", updatedAt: Date.now() });

console.log("\n— audit_trail —");
await crud("audit_trail", "audit_trail", { action: "SVC_TEST", timestamp: Date.now() });

console.log("\n— single-record collections (view + update, no delete) —");
for (const [col, id] of [["settings", "config000000000"], ["kiosks_config", "security0000000"], ["two_factor", "twofactor000000"]]) {
  const g = await fetch(`${PB}/api/collections/${col}/records/${id}`, { headers: H });
  ok(`${col}: view`, g.ok, `→ ${g.status}`);
  const u = await fetch(`${PB}/api/collections/${col}/records/${id}`, { method: "PATCH", headers: H, body: JSON.stringify(col === "settings" ? { appUrl: "https://entry-pass-web-migration.vercel.app" } : {}) });
  ok(`${col}: update`, u.ok, `→ ${u.status} ${(await u.text()).slice(0, 120)}`);
}

console.log("\n— share-URL write path (tickets.ticketUrl/whatsappUrl via settings.appUrl) —");
{
  const st = await fetch(`${PB}/api/collections/settings/records/config000000000`, { headers: H }).then((r) => r.json());
  ok("settings.appUrl readable", Boolean(st.appUrl), `→ ${JSON.stringify(st.appUrl)}`);
}

console.log(`\n==========================================\n  ${pass} passed, ${fail} failed\n==========================================`);
process.exit(fail ? 1 : 0);
