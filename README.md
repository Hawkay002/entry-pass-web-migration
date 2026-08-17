# Entry Pass Web

Self-hosted event ticketing: issue QR-coded tickets, scan guests in at the door,
run self check-in kiosks, manage staff roles and gates — with your data staying
on **your own computer**.

```
   Staff phones & iPads                Vercel                    YOUR COMPUTER
   (anywhere, any network)  ─────▶  the WEBSITE  ─────▶  tunnel ─────▶  Pocketbase
                             fixed link,          free bridge     tickets, staff,
                             always online                        logins, settings
```

- **Website** — hosted free on Vercel. One permanent public link for all staff.
- **Database** — [Pocketbase](https://pocketbase.io) runs on your PC. Every
  ticket, staff member, and setting lives in files you own.
- **Tunnel** — free Cloudflare bridge so the website can reach your PC.

> 🚀 **New here? Open [`SETUP.md`](./SETUP.md) — the complete beginner's guide.
> Setup is double-click files; going live every day is one double-click.**

---

## Quick start (the short version)

Windows: download this repo as ZIP → extract anywhere → double-click, in order:

```
0-CHECK-FIRST\0a-CHECK-SYSTEM.bat     check what your PC has
0-CHECK-FIRST\0b-INSTALL-NEEDED.bat   install anything missing (automatic)
1-INSTALL.bat                         install the app's building blocks
2-SETUP.bat                           create the database + your logins
3-GO-LIVE.bat                         🚀 publish — leave its window open
4-BACKUP.bat                          safety copies of your data, any time
5-START-LOCAL-TEST.bat                optional: test with nothing public
```

Mac/Linux equivalents: `pnpm install` · `pnpm setup` · `pnpm go:live` ·
`pnpm backup` · `pnpm start:all`.

Full plain-English walkthrough (including Google Sign-In and staff roles):
**[SETUP.md](./SETUP.md)**.

---

## Features

### Core Ticket Loop
- **Issue Tickets** — Form with country code dropdown (203 countries with flags, India default). Paste-sanitizing phone field. Live ticket confirmation with animated BadgeCheck. WhatsApp share button doubles as capture-status indicator. **Has Kids?** toggle for family/group tickets — parent + kids created as separate tickets sharing a `groupId` + parent's phone; one WhatsApp link covers the family
- **Guest List** — 7 sort options, 4 filters + search, bulk delete, import/export. Gate column in multi-gate mode. Admin-only guest name edit. View eye opens the interactive ticket. **Manual Mark All Absent** (admin override). **Auto-absent** at deadline (timezone-aware, zero polling). Family grouping with parent-first ordering + blue Child badges. Import dedupe by `phone:name` composite key
- **Scanner** — Camera QR decode with **four-way validation** (granted / already scanned / invalid / **wrong gate**). Shows who scanned + when on duplicates. Camera flip. Animated bell haptic toggle. Gate badge for assigned scanners. **Offline mode** with IndexedDB cache + auto-sync on reconnect
- **4 Ticket Types** — Classic, VIP, SVIP, VVIP — unique shader colors and fonts; gate number on the ticket face

### Admin & Security
- **Admin 2FA (TOTP)** — Google Authenticator with QR setup, smart 6-box OTP input, recovery codes (SHA-256 hashed). Staff accounts skip 2FA
- **Dynamic Roles** — Create roles, add staff singly or bulk (CSV/JSON/XLSX). Collapsible role cards. Google Sign-In maps emails automatically
- **Multi-Gate System** — Gate categories, per-gate ticket-type acceptance, round-robin auto-assignment, wrong-gate blocking with gate names, full cascade on disable
- **Multi-Kiosk System** — Self check-in kiosks each with name, PIN, gate, URL. Per-kiosk + IP rate limiting. Instant deletion detection + forced re-auth on config edits
- **Remote Device Management** — Batch edit/delete staff, lock/unlock tabs with reason, maintenance mode with auto-unlock timer
- **Staff Auto-Logout** — Removing staff kicks them out on their next request
- **Activity Logs** — 12 colored action types, CSV/XLSX/PDF export
- **Factory Reset** — Full wipe with an immutable audit trail preserved
- **Session security** — httpOnly cookies, server-side role checks, no client-trusted state

### Interactive Guest Ticket (`/ticket/[id]`)
- **Phone-verified access** (rate-limited) unlocking the guest's holographic ticket
- **WebGL shader ticket** with tilt + glare (pointer/touch/gyroscope), per-type holography, ADMIT ONE stub
- **QR code** for individual scanning; **family cycling** `‹ 1 of 3 ›` through parent + kids
- **Download as PNG** (4x, portrait), **Save to Google Wallet**, WhatsApp share, OG link previews with the exact live-shader snapshot
- **Report Issue** — floating button → Telegram notification to the organizer

### UX
- Mobile-first responsive layout; liquid-glass UI over 12 selectable atmospheric backgrounds
- Custom typography (The Seasons + Gotham Nights), 38-zone timezone selector, live deadline countdown
- PWA installable; custom 404s and error boundary
- Import/export: CSV, XLSX, PDF, TXT, DOC, JSON

---

## Architecture (what runs where)

| Piece | Where | Notes |
|---|---|---|
| Next.js website | Vercel (free) | `3-GO-LIVE.bat` / `pnpm go:live` publishes it |
| Pocketbase | your PC, `pb/` folder | database + auth + file storage; SQLite under the hood |
| Cloudflare tunnel | your PC, while go-live runs | bridges Vercel → your PC; address rotates on reboot, go-live repairs it |
| Staff devices | any browser | just the public link — nothing to install |

Key design points:
- **Auth**: email/password or Google → Pocketbase JWT in an httpOnly cookie
  (14-day). Role checks server-side; admins via `ADMIN_EMAILS` env var.
- **Data access**: all writes go through server actions using PB's superuser
  API (mirrors the original Firebase Admin-SDK pattern); collection API rules
  remain as defense-in-depth.
- **Realtime**: tiered polling (tickets 2.5s → settings 12s) — PB SSE delivers
  no events to clients that can't read a collection, and our auth token is
  httpOnly, so polling is the correct pattern here.
- **Schema**: 17 committed migrations in [`pb_migrations/`](./pb_migrations) —
  a fresh install builds the exact database automatically.

## Repository layout

```
0-CHECK-FIRST/    system check + auto-installer (Windows)
*.bat             numbered double-click entry points
scripts/          setup / go-live / start / backup (cross-platform)
pb_migrations/    database schema (applied automatically)
app/              the website (Next.js App Router)
components/       UI
hooks/            data hooks (polling)
lib/pb/           Pocketbase integration (server + client)
SETUP.md          ⭐ the beginner's guide — start here
```

## Environment variables

Managed entirely by the scripts (`.env.local` locally; pushed to Vercel by
go-live). For reference: `NEXT_PUBLIC_POCKETBASE_URL`,
`POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`, `AUTH_COOKIE_NAME`,
`ADMIN_EMAILS` — plus optional `GOOGLE_WALLET_*` and `TELEGRAM_*`.

## Backup & restore

`4-BACKUP.bat` / `pnpm backup` zips the full database into `backups/` with a
date stamp. Restore = unzip + drop `pb_data` next to `pocketbase.exe` +
go live. **The backup is your data — copy it off the machine.**

## License

TBD — add before public distribution.

---

*Entry Pass Web — built for event organizers who want ticketing without
renting their data to a cloud.*
