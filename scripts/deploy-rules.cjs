// Deploys firestore.rules to the live Firebase project via the Rules REST API.
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
  "deploy-rules"
);

const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
const projectId = sa.project_id;

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = require("node:https").request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function deploy() {
  const token = await app.options.credential.getAccessToken();
  const auth = `Bearer ${token.access_token}`;

  // 1. Create a new ruleset.
  console.log("Creating ruleset...");
  const createRes = await httpsRequest({
    hostname: "firebaserules.googleapis.com",
    path: `/v1/projects/${projectId}/rulesets`,
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
  }, JSON.stringify({ source: { files: [{ name: "firestore.rules", content: rules }] } }));

  const created = JSON.parse(createRes.body);
  if (created.error) {
    console.error("Failed:", JSON.stringify(created.error));
    process.exit(1);
  }
  console.log("Ruleset created:", created.name);

  // 2. Update the release to point to the new ruleset (PATCH the cloud.firestore release).
  console.log("Updating release...");
  const releaseBody = JSON.stringify({ name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: created.name });
  const patchRes = await httpsRequest({
    hostname: "firebaserules.googleapis.com",
    path: `/v1/projects/${projectId}/releases/cloud.firestore`,
    method: "PATCH",
    headers: { Authorization: auth, "Content-Type": "application/json" },
  }, releaseBody);

  const patched = JSON.parse(patchRes.body);
  if (patched.error) {
    // Release doesn't exist yet — create it.
    console.log("Release doesn't exist, creating...");
    const postRes = await httpsRequest({
      hostname: "firebaserules.googleapis.com",
      path: `/v1/projects/${projectId}/releases`,
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
    }, releaseBody);
    const posted = JSON.parse(postRes.body);
    if (posted.error) {
      console.error("Failed:", JSON.stringify(posted.error));
      process.exit(1);
    }
  }

  console.log("✅ Rules deployed successfully to Firebase!");
  await app.delete();
}

deploy().catch((err) => { console.error(err.message); process.exit(1); });
