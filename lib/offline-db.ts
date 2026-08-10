// lib/offline-db.ts — IndexedDB-backed offline cache for the scanner.
// Deliberately NOT localStorage: IndexedDB is async, larger, and survives
// across the PWA lifecycle. Stores the warm ticket snapshot + a pending
// scan queue so the scanner works with no network.
//
// Two object stores:
//   - kv:    single-record key/value (used for the ticket snapshot)
//   - queue: pending offline scans keyed by id

import type { Ticket } from "@/lib/types";

const DB_NAME = "entry-pass-offline";
const DB_VERSION = 1;
const STORE_KV = "kv";
const STORE_QUEUE = "queue";
const KV_TICKETS_KEY = "tickets";

/** Minimal ticket shape cached for offline validation (no PII like phone). */
export type OfflineTicket = Pick<Ticket, "id" | "name" | "status" | "scanned" | "gate">;

export interface PendingScan {
  id: string;       // ticket id (also the queue key)
  name: string;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = fn(s);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

// ---------------- Ticket cache ----------------

/** Replace the cached ticket snapshot (called by the scanner's periodic refresh). */
export async function cacheTickets(tickets: OfflineTicket[]): Promise<void> {
  try {
    await tx(STORE_KV, "readwrite", (s) => s.put(tickets, KV_TICKETS_KEY));
  } catch (err) {
    console.error("[offline-db] cacheTickets failed:", err);
  }
}

/** Read the last cached ticket snapshot (or [] if none / unavailable). */
export async function getCachedTickets(): Promise<OfflineTicket[]> {
  try {
    const val = await tx<OfflineTicket[]>(STORE_KV, "readonly", (s) =>
      s.get(KV_TICKETS_KEY)
    );
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

/**
 * Mark a cached ticket as scanned locally so a second offline scan of the same
 * ticket returns "already" instead of granting again. No-op if the ticket
 * isn't in the cache.
 */
export async function markCachedScanned(id: string): Promise<void> {
  try {
    const cached = await getCachedTickets();
    const idx = cached.findIndex((t) => t.id === id);
    if (idx === -1) return;
    cached[idx] = { ...cached[idx], status: "arrived", scanned: true };
    await tx(STORE_KV, "readwrite", (s) => s.put(cached, KV_TICKETS_KEY));
  } catch (err) {
    console.error("[offline-db] markCachedScanned failed:", err);
  }
}

// ---------------- Pending scan queue ----------------

/** Add a scan to the offline queue (keyed by ticket id — dedupes repeats). */
export async function enqueueScan(entry: PendingScan): Promise<void> {
  try {
    await tx(STORE_QUEUE, "readwrite", (s) => s.put(entry));
  } catch (err) {
    console.error("[offline-db] enqueueScan failed:", err);
  }
}

/** Read all pending scans (oldest first by timestamp). */
export async function getPendingScans(): Promise<PendingScan[]> {
  try {
    const all = await tx<PendingScan[]>(STORE_QUEUE, "readonly", (s) =>
      s.getAll()
    );
    return (all ?? []).sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

/** Remove specific scans from the queue after a successful sync. */
export async function clearPendingScans(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await openDb().then((db) => {
      return new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE_QUEUE, "readwrite");
        const s = t.objectStore(STORE_QUEUE);
        ids.forEach((id) => s.delete(id));
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => reject(t.error);
      });
    });
  } catch (err) {
    console.error("[offline-db] clearPendingScans failed:", err);
  }
}

/** Count of pending scans (for the UI badge). */
export async function getPendingCount(): Promise<number> {
  try {
    const n = await tx<number>(STORE_QUEUE, "readonly", (s) => s.count());
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}
