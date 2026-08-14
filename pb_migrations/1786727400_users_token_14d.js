/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // 14-day auth tokens — must match the app's 14-day session cookie
  // (lib/env.ts cookieSerializeOptions.maxAge). Default is 5 days.
  unmarshal({
    "authToken": {
      "duration": 1209600
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({
    "authToken": {
      "duration": 432000
    }
  }, collection)

  return app.save(collection)
})
