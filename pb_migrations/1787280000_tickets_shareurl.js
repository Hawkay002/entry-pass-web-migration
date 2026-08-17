/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tickets")

  // Plain-text link columns, filled automatically by the ticket-create
  // server action. Empty until PB settings has a proper appURL (go-live
  // sets it), so backfill stays a no-op on fresh installs.
  collection.fields.add(
    new Field({
      "name": "ticketUrl",
      "type": "text",
      "presentable": true,
      "system": false,
      "hidden": false,
      "required": false,
    })
  )
  collection.fields.add(
    new Field({
      "name": "whatsappUrl",
      "type": "text",
      "presentable": false,
      "system": false,
      "hidden": false,
      "required": false,
    })
  )

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("tickets")
  for (const name of ["ticketUrl", "whatsappUrl"]) {
    const f = collection.fields.getByName(name)
    if (f) collection.fields.remove(f)
  }
  return app.save(collection)
})
