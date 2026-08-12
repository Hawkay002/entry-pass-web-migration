// lib/kiosk-db.ts — IndexedDB offline cache for the PUBLIC kiosk.
// Deliberately separate from lib/offline-db.ts (the staff scanner):
//   - its own DB namespace (so staff + kiosk caches never collide)
//   - stores ONLY { id, status, scanned } — NO names/phones/PII, because the
//     kiosk is an unauthenticated public tablet
//
// Two object stores:
//   - kv:    the PII-free ticket snapshot (keyed by "tickets")
//   - queue: pending offline self check-ins keyed by ticket id

const DB_NAME = "entry-pass-kiosk";
const DB_VERSION = 1;
const STORE_KV = "kv";
const STORE_QUEUE = "queue";
const KV_TICKETS_KEY = "tickets";

/** PII-free ticket shape cached for offline kiosk validation. */
export interface KioskTicket {
  id: string;
  status: string;
  scanned: boolean;
}

export interface KioskPendingScan {
  id: string;
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

export async function cacheKioskTickets(tickets: KioskTicket[]): Promise<void> {
  try {
    await tx(STORE_KV, "readwrite", (s) => s.put(tickets, KV_TICKETS_KEY));
  } catch (err) {
    console.error("[kiosk-db] cacheKioskTickets failed:", err);
  }
}

export async function getCachedKioskTickets(): Promise<KioskTicket[]> {
  try {
    const val = await tx<KioskTicket[]>(STORE_KV, "readonly", (s) =>
      s.get(KV_TICKETS_KEY)
    );
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

/** Mark a cached ticket as scanned locally so a repeat offline scan says "already". */
export async function markKioskCachedScanned(id: string): Promise<void> {
  try {
    const cached = await getCachedKioskTickets();
    const idx = cached.findIndex((t) => t.id === id);
    if (idx === -1) return;
    cached[idx] = { ...cached[idx], status: "arrived", scanned: true };
    await tx(STORE_KV, "readwrite", (s) => s.put(cached, KV_TICKETS_KEY));
  } catch (err) {
    console.error("[kiosk-db] markKioskCachedScanned failed:", err);
  }
}

// ---------------- Pending scan queue ----------------

export async function enqueueKioskScan(entry: KioskPendingScan): Promise<void> {
  try {
    await tx(STORE_QUEUE, "readwrite", (s) => s.put(entry));
  } catch (err) {
    console.error("[kiosk-db] enqueueKioskScan failed:", err);
  }
}

export async function getKioskPendingScans(): Promise<KioskPendingScan[]> {
  try {
    const all = await tx<KioskPendingScan[]>(STORE_QUEUE, "readonly", (s) =>
      s.getAll()
    );
    return (all ?? []).sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

export async function clearKioskPendingScans(ids: string[]): Promise<void> {
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
    console.error("[kiosk-db] clearKioskPendingScans failed:", err);
  }
}

export async function getKioskPendingCount(): Promise<number> {
  try {
    const n = await tx<number>(STORE_QUEUE, "readonly", (s) => s.count());
    return typeof n === "number" ? n : 0;
  } catch {
    return 0;
  }
}

/** Wipe the PII-free ticket snapshot (the `kv` store). Called when a kiosk
 *  is deleted or config is changed so stale cached data doesn't linger. */
export async function clearKioskCache(): Promise<void> {
  try {
    await openDb().then((db) => {
      return new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE_KV, "readwrite");
        const s = t.objectStore(STORE_KV);
        s.delete(KV_TICKETS_KEY);
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => reject(t.error);
      });
    });
  } catch (err) {
    console.error("[kiosk-db] clearKioskCache failed:", err);
  }
}
