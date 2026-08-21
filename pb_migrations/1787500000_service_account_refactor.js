/// <reference path="../pb_data/types.d.ts" />
// Service-account refactor prep:
//  1. og_snapshots had NULL rules (superuser-only). The app's server client
//     now authenticates as a regular `users` record with role=admin instead
//     of a superuser, so every collection the app writes must be reachable
//     through rules. Give it the same admin-role predicates the other
//     collections use. list/view stay null (superuser-only) — snapshots are
//     server-only data, read through the app's admin-role token.
//  2. settings gains `appUrl` — the public link base for ticket share URLs.
//     Previously stored in PB's superuser-only settings.meta.appURL; moving
//     it into the app-level settings record lets the service account (and
//     go-live) write it without any superuser login.
migrate((app) => {
  const og = app.findCollectionByNameOrId("pbc_3974331901");
  og.listRule = '@request.auth.role = "admin"';
  og.viewRule = '@request.auth.role = "admin"';
  og.createRule = '@request.auth.role = "admin"';
  og.updateRule = '@request.auth.role = "admin"';
  og.deleteRule = '@request.auth.role = "admin"';
  app.save(og);

  const settings = app.findCollectionByNameOrId("pbc_2769025244");
  settings.fields.add(
    new Field({
      "name": "appUrl",
      "type": "text",
      "presentable": false,
      "system": false,
      "hidden": false,
      "required": false,
    })
  );
  return app.save(settings);
}, (app) => {
  const og = app.findCollectionByNameOrId("pbc_3974331901");
  og.listRule = null;
  og.viewRule = null;
  og.createRule = null;
  og.updateRule = null;
  og.deleteRule = null;
  app.save(og);

  const settings = app.findCollectionByNameOrId("pbc_2769025244");
  settings.fields.removeByName("appUrl");
  return app.save(settings);
})
