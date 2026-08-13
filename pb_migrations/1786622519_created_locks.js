/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.role = \"admin\"",
    "deleteRule": "@request.auth.role = \"admin\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "help": "",
        "hidden": false,
        "id": "email32993186",
        "name": "userEmail",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "email"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json3546437860",
        "maxSize": 2000000,
        "name": "userSpecificLocks",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json2718411833",
        "maxSize": 2000000,
        "name": "lockMetadata",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json3681034911",
        "maxSize": 2000000,
        "name": "lockedTabs",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number3175243278",
        "max": null,
        "min": null,
        "name": "updatedAt",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_930599804",
    "indexes": [
      "CREATE UNIQUE INDEX idx_locks_userEmail ON locks (userEmail)"
    ],
    "listRule": "(@request.auth.id != \"\" && @request.auth.email = userEmail) || @request.auth.role = \"admin\"",
    "name": "locks",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.role = \"admin\"",
    "viewRule": "(@request.auth.id != \"\" && @request.auth.email = userEmail) || @request.auth.role = \"admin\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_930599804");

  return app.delete(collection);
})
