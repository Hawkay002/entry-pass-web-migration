// lib/paths.ts — Pocketbase collection-name constants.
// Pure constants (no env validation), safe to import from client and server.
//
// Pocketbase uses flat collection names (no Firestore-style nested doc paths).
// These mirror the committed pb_migrations/ schema exactly.

export const paths = {
  ticketsCollection: "tickets",
  /** Single-record settings collection. The one record's id (padded to 15). */
  settingsCollection: "settings",
  settingsId: "config000000000",
  gatesCollection: "gates",
  logsCollection: "logs",
  rolesCollection: "roles",
  locksCollection: "locks",
  /** Single-record kiosks config (was admin_settings/security). */
  kiosksConfigCollection: "kiosks_config",
  kiosksConfigId: "security0000000",
  contactsCollection: "contacts",
  /** Pre-rendered OG share previews (base64 JPEG), keyed by ticket id. */
  ogSnapshotsCollection: "og_snapshots",
  /** Public kiosk status records — existence-only signal (no PIN/PII).
   *  Read by the unauthenticated /kiosk page via subscribe for instant
   *  deletion detection. `{ updatedAt: number }` is the only field. */
  kioskStatusCollection: "kiosk_status",
  kioskStatusId: (kioskId: string) => kioskId,
  auditTrailCollection: "audit_trail",
  /** Single-record admin 2FA config. */
  twoFactorCollection: "two_factor",
  twoFactorId: "twofactor000000",
  usersCollection: "users",
} as const;
