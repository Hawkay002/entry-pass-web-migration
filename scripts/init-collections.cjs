// scripts/init-collections.cjs — one-shot: creates all Firestore collections
// with a placeholder doc, then deletes it. This "initializes" the collection
// so it shows up in the Firebase Console.
//
// Run: node scripts/init-collections.cjs

const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

const envRaw = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const getKey = (k) => {
  const m = envRaw.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1] : null;
};

const sa = JSON.parse(getKey("FIREBASE_SERVICE_ACCOUNT_KEY"));
const app = admin.initializeApp(
  { credential: admin.cert(sa), projectId: sa.project_id },
  "init-collections"
);

const db = app.firestore();

// All collections used by the app.
const collections = [
  "ticket_events_data/shared_event_db/tickets",
  "ticket_events_data/shared_event_db/settings",
  "ticket_events_data/shared_event_db/gates",
  "roles",
  "global_locks",
  "help_contacts",
  "activity_logs",
  "og_snapshots",
  "admin_settings",
  "audit_trail",
];

async function init() {
  console.log(`Initializing ${collections.length} collections...\n`);
  for (const col of collections) {
    try {
      const ref = db.collection(col).doc("__init__");
      await ref.set({ _init: true, createdAt: Date.now() });
      await ref.delete();
      console.log(`  ✓ ${col}`);
    } catch (err) {
      console.error(`  ✗ ${col}: ${err.message}`);
    }
  }
  console.log("\nDone. Collections are now visible in the Firebase Console.");
  await app.delete();
}

init().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
