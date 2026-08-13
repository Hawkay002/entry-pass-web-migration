// lib/pb/client.ts — Pocketbase client SDK singleton.
// Used for realtime `subscribe` listeners (replacing Firestore onSnapshot) and
// is isomorphic: imported by both client components and server code that needs
// a plain client (auth cookie applied per-request via pbWithCookie()).
//
// IMPORTANT: reads ONLY NEXT_PUBLIC_* env directly (not via lib/env.ts), because
// lib/env.ts validates server secrets and would throw in the browser bundle.

import PocketBase from "pocketbase";

export const clientEnv = {
  pbUrl: process.env.NEXT_PUBLIC_POCKETBASE_URL!,
};

let _pb: PocketBase | null = null;

/** Shared client singleton for client components (realtime subscriptions, etc.). */
export function pb(): PocketBase {
  if (!_pb) _pb = new PocketBase(clientEnv.pbUrl);
  return _pb;
}

/** Server-side client authenticated from a request's auth cookie. Pass the raw
 *  token (the cookie value). Returns a fresh PocketBase bound to that token. */
export function pbWithCookie(token: string): PocketBase {
  const client = new PocketBase(clientEnv.pbUrl);
  client.authStore.save(token, null);
  return client;
}
