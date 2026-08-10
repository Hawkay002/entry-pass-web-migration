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
  "dom-add"
);

const domainToAdd = process.argv[2];
if (!domainToAdd) {
  console.error("Usage: node scripts/add-domain.cjs <domain>");
  process.exit(1);
}

app.options.credential.getAccessToken().then((token) => {
  const https = require("node:https");
  const projectId = sa.project_id;

  // 1. GET current config
  https.get(
    {
      hostname: "identitytoolkit.googleapis.com",
      path: `/v2/projects/${projectId}/config`,
      headers: { Authorization: `Bearer ${token.access_token}` },
    },
    (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const cfg = JSON.parse(data);
        const existing = cfg.authorizedDomains || [];
        if (existing.includes(domainToAdd)) {
          console.log("Domain already authorized. Current list:");
          existing.forEach((d) => console.log("  -", d));
          app.delete();
          return;
        }
        const updated = [...existing, domainToAdd];
        // 2. PATCH with full list
        const body = JSON.stringify({ authorizedDomains: updated });
        const req = https.request(
          {
            hostname: "identitytoolkit.googleapis.com",
            path: `/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          (res2) => {
            let data2 = "";
            res2.on("data", (c) => (data2 += c));
            res2.on("end", () => {
              const result = JSON.parse(data2);
              if (result.error) {
                console.error("Failed:", JSON.stringify(result.error));
              } else {
                console.log("Updated authorized domains:");
                (result.authorizedDomains || []).forEach((d) => console.log("  -", d));
              }
              app.delete();
            });
          }
        );
        req.write(body);
        req.end();
      });
    }
  );
});
