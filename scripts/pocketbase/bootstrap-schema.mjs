// One-shot Pocketbase schema bootstrap for Entry Pass Web (v2 — idempotent).
// Creates 12 data collections and configures the built-in `users` auth collection
// (adds a `role` field). PB's automigrate captures reproducible pb_migrations/*.js.
//
// Safe to re-run: creates if missing, patches (adds missing fields) if it exists.
//
// Usage:
//   PB_URL=http://127.0.0.1:8090 \
//   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret \
//   node scripts/pocketbase/bootstrap-schema.mjs

const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (and optionally PB_URL) env vars.");
  process.exit(1);
}

// PB id pattern is ^[a-z0-9]{15}$ — pad short ids.
const id15 = (s) => (s + "0".repeat(15)).slice(0, 15).toLowerCase();

const AUTH = `@request.auth.id != ""`;
const ADMIN = `@request.auth.role = "admin"`;

const text = (name, o = {}) => ({ type: "text", name, required: false, system: false, presentable: false, ...o });
const num = (name, o = {}) => ({ type: "number", name, required: false, system: false, presentable: false, min: null, max: null, onlyInt: true, ...o });
const bool = (name, o = {}) => ({ type: "bool", name, required: false, system: false, presentable: false, ...o });
const json = (name, o = {}) => ({ type: "json", name, required: false, system: false, presentable: false, maxSize: 2000000, ...o });
const emailF = (name, o = {}) => ({ type: "email", name, required: false, system: false, presentable: false, exceptDomains: null, onlyDomains: null, ...o });
const ms = (name) => num(name);

// Each entry: { name, type, fields, indexes?, rules, idFrom? }
const dataCollections = [
  { name: "tickets", fields: [
      text("name", { required: true }), text("gender"), num("age"), text("phone"),
      text("ticketType"), text("status"), bool("scanned", { required: true }),
      ms("scannedAt"), text("scannedBy"), text("createdBy"), ms("createdAt", { required: true }),
      text("gate"), text("scannedAtGate"), text("groupId"), text("parentName"),
    ], rules: { list: AUTH, view: AUTH, create: AUTH, update: AUTH, del: ADMIN } },

  { name: "settings", fields: [
      text("name"), text("place"), text("deadline"), text("timezone"),
      bool("multiGate"), json("gateCategories"),
    ], rules: { list: AUTH, view: AUTH, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "gates", fields: [
      text("name", { required: true }), text("category"), num("order"),
      bool("active", { required: true }), ms("createdAt", { required: true }), json("ticketTypes"),
    ], rules: { list: AUTH, view: AUTH, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "roles", fields: [
      text("name", { required: true }), json("staff"), ms("createdAt", { required: true }),
    ], rules: { list: AUTH, view: AUTH, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "locks", fields: [
      emailF("userEmail", { required: true }), json("userSpecificLocks"),
      json("lockMetadata"), json("lockedTabs"), ms("updatedAt"),
    ], indexes: [`CREATE UNIQUE INDEX idx_locks_userEmail ON locks (userEmail)`],
    rules: {
      list: `(${AUTH} && @request.auth.email = userEmail) || ${ADMIN}`,
      view: `(${AUTH} && @request.auth.email = userEmail) || ${ADMIN}`,
      create: ADMIN, update: ADMIN, del: ADMIN,
    } },

  { name: "logs", fields: [
      ms("timestamp", { required: true }), text("userEmail"), text("username"),
      text("action"), text("details"),
    ], rules: { list: ADMIN, view: ADMIN, create: AUTH, update: ADMIN, del: ADMIN } },

  { name: "og_snapshots", fields: [
      text("image"), text("ticketType"), ms("updatedAt"),
    ], rules: { list: null, view: null, create: null, update: null, del: null } },

  { name: "kiosk_status", fields: [ ms("updatedAt") ],
    rules: { list: "", view: "", create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "audit_trail", fields: [
      ms("timestamp", { required: true }), text("userEmail"), text("username"),
      text("action"), text("details"),
    ], rules: { list: ADMIN, view: ADMIN, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "kiosks_config", fields: [ json("kiosks") ],
    rules: { list: ADMIN, view: ADMIN, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "two_factor", fields: [ json("admins") ],
    rules: { list: ADMIN, view: ADMIN, create: ADMIN, update: ADMIN, del: ADMIN } },

  { name: "contacts", fields: [
      text("role", { required: true }), text("name", { required: true }), text("phone"),
      text("whatsapp"), text("description"), ms("createdAt", { required: true }),
    ], rules: { list: AUTH, view: AUTH, create: ADMIN, update: ADMIN, del: ADMIN } },
];

// users: built-in auth collection — add role field + relax rules for admin.
const usersPatch = {
  fields: [
    { type: "select", name: "role", required: false, system: false, presentable: false, maxSelect: 1, values: ["admin", "staff"] },
  ],
  rules: {
    list: `id = @request.auth.id || ${ADMIN}`,
    view: `id = @request.auth.id || ${ADMIN}`,
    create: "", update: `id = @request.auth.id || ${ADMIN}`, del: `id = @request.auth.id || ${ADMIN}`,
  },
};

const seedRecords = [
  ["settings", id15("config"), { name: "", place: "", deadline: "", timezone: "auto", multiGate: false, gateCategories: [] }],
  ["kiosks_config", id15("security"), { kiosks: [] }],
  ["two_factor", id15("twofactor"), { admins: {} }],
];

async function main() {
  const authRes = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!authRes.ok) throw new Error(`admin auth failed: ${authRes.status}`);
  const { token } = await authRes.json();
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // rules: null = disabled (server-only), "" = public, "<expr>" = filter.
  // Preserve explicit null; default only undefined → "".
  const rule = (v) => (v === undefined ? "" : v);

  // --- 1. data collections: create ---
  let ok = 0;
  for (const c of dataCollections) {
    const body = {
      name: c.name, type: "base", system: false,
      fields: c.fields, indexes: c.indexes ?? [],
      listRule: rule(c.rules.list), viewRule: rule(c.rules.view),
      createRule: rule(c.rules.create), updateRule: rule(c.rules.update),
      deleteRule: rule(c.rules.del),
    };
    const res = await fetch(`${PB}/api/collections`, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (res.ok) { console.log(`  ✓ ${c.name}`); ok++; }
    else { console.error(`  ✗ ${c.name}: ${res.status} ${await res.text()}`); }
  }

  // --- 2. users: patch existing (add role + rules) ---
  const usersRes = await fetch(`${PB}/api/collections/users`, { headers: h });
  const users = await usersRes.json();
  const existingFieldNames = new Set((users.fields ?? []).map((f) => f.name));
  const newFields = usersPatch.fields.filter((f) => !existingFieldNames.has(f.name));
  const mergedFields = [...users.fields, ...newFields];
  const patchBody = {
    fields: mergedFields,
    listRule: usersPatch.rules.list, viewRule: usersPatch.rules.view,
    createRule: usersPatch.rules.create, updateRule: usersPatch.rules.update,
    deleteRule: usersPatch.rules.del,
  };
  const pres = await fetch(`${PB}/api/collections/users`, { method: "PATCH", headers: h, body: JSON.stringify(patchBody) });
  console.log(`  ${pres.ok ? "✓" : "✗"} users (role${newFields.length ? ` +${newFields.length} field` : ", rules"}) ${pres.ok ? "" : await pres.text()}`);

  // --- 3. seed singletons ---
  for (const [col, id, data] of seedRecords) {
    // create if missing (404 → not found record)
    const check = await fetch(`${PB}/api/collections/${col}/records/${id}`, { headers: h });
    if (check.ok) { console.log(`  · seed ${col}/${id}: exists`); continue; }
    const res = await fetch(`${PB}/api/collections/${col}/records`, {
      method: "POST", headers: h, body: JSON.stringify({ id, ...data }),
    });
    console.log(`  ${res.ok ? "✓" : "✗"} seed ${col}/${id} ${res.ok ? "" : await res.text()}`);
  }

  console.log(`\nDone: ${ok}/${dataCollections.length} data collections + users configured.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
