// lib/paths.ts — Firestore collection/doc path constants.
// Pure constants (no env validation), safe to import from client and server.

/** Firestore root collection + shared data doc (unchanged from original app). */
export const APP_COLLECTION_ROOT = "ticket_events_data";
export const SHARED_DATA_ID = "shared_event_db";

/** Derived Firestore paths used across the app. */
export const paths = {
  ticketsCollection: `${APP_COLLECTION_ROOT}/${SHARED_DATA_ID}/tickets`,
  settingsDoc: `${APP_COLLECTION_ROOT}/${SHARED_DATA_ID}/settings/config`,
  gatesCollection: `${APP_COLLECTION_ROOT}/${SHARED_DATA_ID}/gates`,
  logsCollection: "activity_logs",
  rolesCollection: "roles",
  locksCollection: "global_locks",
  adminSecurityDoc: "admin_settings/security",
  contactsCollection: "help_contacts",
  /** Pre-rendered OG share previews (base64 JPEG), keyed by ticket id. */
  ogSnapshotsCollection: "og_snapshots",
  /** Public kiosk status docs — existence-only signal (no PIN/PII).
   *  Read by the unauthenticated /kiosk page via onSnapshot for instant
   *  deletion detection. `{ updatedAt: number }` is the only field. */
  kioskStatusDoc: (kioskId: string) => `kiosk_status/${kioskId}`,
  kioskStatusCollection: "kiosk_status",
} as const;
