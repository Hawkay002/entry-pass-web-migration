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
  "dom-check"
);

// The Admin SDK's Auth config (authorized domains) is part of the project config.
// We use the Identity Toolkit REST API via the access token.
const { getAuth } = require("firebase-admin/auth");
const auth = getAuth(app);

// Try the getConfig approach (newer SDKs)
if (typeof auth.getConfig === "function") {
  auth.getConfig()
    .then((cfg) => {
      console.log("Authorized domains:");
      (cfg.authorizedDomains || []).forEach((d) => console.log("  -", d));
      return app.delete();
    })
    .catch((e) => {
      console.error("getConfig failed:", e.message);
      return app.delete();
    });
} else {
  // Fall back to the REST API
  return app.options.credential.getAccessToken().then((token) => {
    const https = require("node:https");
    const projectId = sa.project_id;
    const options = {
      hostname: "identitytoolkit.googleapis.com",
      path: `/v2/projects/${projectId}/config`,
      headers: { Authorization: `Bearer ${token.access_token}` },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const cfg = JSON.parse(data);
          console.log("Authorized domains:");
          (cfg.authorizedDomains || []).forEach((d) => console.log("  -", d));
        } catch (e) {
          console.error("Parse error:", e.message, "\nRaw:", data.slice(0, 500));
        }
        app.delete();
      });
    });
  });
}
