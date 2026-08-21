/// <reference path="../pb_data/types.d.ts" />
// Live-DB patch: 1787500000 initially left og_snapshots list/view as NULL
// (superuser-only). The og-image route READS snapshots through the app's
// service account (role=admin, rules-gated) — NULL read rules would 403 it.
// This brings the live DB to the same state as the corrected 1787500000.
migrate((app) => {
  const og = app.findCollectionByNameOrId("pbc_3974331901");
  og.listRule = '@request.auth.role = "admin"';
  og.viewRule = '@request.auth.role = "admin"';
  return app.save(og);
}, (app) => {
  const og = app.findCollectionByNameOrId("pbc_3974331901");
  og.listRule = null;
  og.viewRule = null;
  return app.save(og);
})
