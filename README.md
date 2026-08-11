# TicketingSystem.

> **Server-secured event ticketing & entry management.** Issue QR-coded tickets, scan guests at the door in milliseconds, lock staff tabs remotely, and track every action in real time — all with zero compromise on security.

Built with Next.js 16, React 19, Tailwind v4, Firebase Admin SDK, and Upstash Redis. A complete rewrite of a Firebase client-only app into a server-secured architecture.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Self-Hosting Guide](#self-hosting-guide)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Upstash Redis Setup](#upstash-redis-setup)
- [Firestore Security Rules](#firestore-security-rules)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Ticket Loop
- **Issue Tickets** — Form with country code dropdown (203 countries with flags, India default). **Paste-sanitizing phone field** — paste `+4915210899596` → auto-selects Germany (+49), shows `15210899596`. Accepts international number lengths (6–15 digits, E.164). Live ticket confirmation with animated BadgeCheck (draw-on-path loop), auto-scrolls to preview on mobile + desktop. WhatsApp share button doubles as capture-status indicator. WhatsApp share message includes link-expiry notice
- **Guest List** — 7 sort options, 4 filters (type/status/gender + search), bulk delete, import/export. **Gate column** appears when multi-gate mode is on (blue gate badges per ticket). **Admin-only edit guest name** (pencil icon per row). View eye opens interactive ticket page. Share column sends WhatsApp with ticket link + expiry notice
- **Scanner** — Camera QR decode at 480px for maximum speed, **four-way validation** (granted / already scanned / invalid / **wrong gate**). Shows **who scanned** + **when** on duplicate scans. **Camera flip** button (front/back). **Animated bell toggle** for haptic feedback (synced to localStorage, rings/shakes on toggle). **Gate badge** in header showing the scanner's assigned gate. Offline mode with IndexedDB cache + auto-sync on reconnect. Wrong-gate scans are blocked without mutating the ticket
- **4 Ticket Types** — Classic, VIP, SVIP, VVIP — each with unique shader colors, fonts (The Seasons for names + Gotham Nights for body), and VVIP engraved text effect. Ticket names auto-balance across up to 3 lines and fill the space to the perforation. Gate number shown on ticket face footer (`age / gender • Gate X`)

### Admin & Security
- **Dynamic Roles** — Admin creates roles and adds staff (single or **bulk upload** via CSV/JSON/XLSX). **Collapsible role cards** (collapsed by default). Edit/delete staff moved to **Remote Device Management** — select staff, then batch edit (vertical list in modal) or batch delete. Google Sign-In maps emails automatically
- **Multi-Gate System** — Toggle multi-gate mode in Configuration (**admin-only** UI + server enforcement). Create gate categories (Guest Entry, Staff, Security, Management — free text). **Collapsible categories** (collapsed by default). Add gates inside categories with ticket-type acceptance (Classic/VIP/SVIP/VVIP). **Round-robin auto-assignment** balances tickets across gates. Staff assigned to specific gates. Wrong-gate scans blocked with "WRONG GATE" error. Gate column in guest list. Ticket face shows assigned gate. Full cascade delete on disable/clear/factory-reset. **Multi-device realtime sync** for the toggle
- **Configuration** — **Calendar + time picker** for deadline (shadcn Calendar with month/year dropdown selectors, 12-hour AM/PM time input). **Premium Active Settings card** (gradient, hero event name, icon chips for venue/deadline, timezone + multi-gate badges). Staff see a **read-only** version of this card (no form, no gate config). **Admin-only** edit form
- **Remote Device Management** — Select staff from role → batch **edit** (name/email/gate) or **delete**. Staff selection modal shows 10 rows on mobile, 8 on desktop before scrolling. Lock/unlock tabs with reason (basic/review/maintenance)
- **Remote Lock** — Lock or unlock specific tabs per staff member with live status badges. Selective unlock
- **Maintenance Mode** — Lock all staff instantly with duration timer (OctagonAlert icon). Auto-unlock when time expires
- **Staff Auto-Logout** — Removing a staff member instantly revokes their session and kicks them out
- **Auto-Absent** — Deadline-based status automation with **timezone-aware** offsets (38 zones, UTC-12 to UTC+14). Zero page reload
- **Activity Logs** — 12 colored action types. **Unlimited** — Redis stores first 1000, overflow routes to Firestore. CSV/XLSX/PDF export of selected logs. All logins logged (incl. Google display name). Single ticket deletions now logged with guest name
- **Factory Reset** — Nukes the database with an immutable audit trail preserved. Also deletes gates + OG snapshots
- **Session-Expired UX** — Expired cookies redirect to `/login?reason=expired` with a toast explanation

### Help & Support
- **Help Tray** — Slide-out contact directory. Admin can add/edit/delete contacts from the tray or Configuration page. Firestore-backed, realtime updates.

### UX
- **Import / Export** — CSV, XLSX, PDF, TXT, DOC, JSON. Auto-dedupe by phone on import
- **Mobile-First** — Fully responsive. 2-row nav on mobile. Fixed 380px ticket dimensions across devices
- **Guest List Summary Bar** — Live counts: Total, Arrived, Pending, Absent with color coding
- **Scanner Haptics** — Vibration feedback on scan results with **animated bell toggle** (rings when on, shakes when off, synced to localStorage)
- **Remember Last Tab** — Returns to your last visited tab on page refresh
- **Deadline Countdown** — Live timer in Settings showing time remaining until deadline
- **Delete Confirmations** — Both guest list + activity logs + gate categories/gates have confirmation modals before destructive actions
- **Login Logging** — All staff/admin logins recorded (incl. Google display name). Session expiry shows a toast on the login page
- **Landing Page** — Premium glass aesthetic matching the app: Starfield + atmospheric drifting gradient orbs, Lenis smooth scroll, live holographic shader ticket showcase (all 4 tiers), glass-pill nav, animated glow cards, magnetic CTAs with button-in-button trailing icons, Outfit + The Seasons typography. Motion forced past prefers-reduced-motion for ambient effects

### Customization
- **Custom Backgrounds** — Pick from 12 atmospheric background images (or Starfield default) via the image icon in the header. Applies live across all tabs, per-device via localStorage. Tiny WebP thumbnails for instant modal load; full-res only fetches on selection.
- **Liquid Glass UI** — All cards, nav, and panels use a frosted glass effect (`backdrop-blur` + saturation + edge highlights) that dynamically blurs the chosen background.
- **Timezone Selector** — 38 curated timezones (UTC-12 to UTC+14) for deadline accuracy. India (+5:30) default. Persisted per-event.
- **Country Code Selector** — 203-country dial code dropdown with rectangular SVG flags (flag-icons). India (+91) default.
- **Custom Fonts** — The Seasons (bold/regular) for guest names + ticket type watermark; Gotham Nights (bold/regular) for labels, footer, stub text. Preloaded via `<link>` tags.

### Interactive Guest Ticket (`/ticket/[id]`)
- **Phone-Verified Access** — Guests enter their full phone number with country code to unlock their ticket (rate-limited: 5 attempts/IP/5min)
- **WebGL Shader Ticket** — AdmitOneTicket component with per-type holographic shader textures, perforation notch, ADMIT ONE stub, and ticket type watermark
- **Tilt + Glare** — 3D perspective tilt following pointer/touch/gyroscope (20° max, iOS permission support). **Gyro pauses during touch** to prevent clash — touch takes priority while finger is down, gyro resumes on release. Specular glare overlay clipped to ticket shape. **Tip overlay** on load ("Touch, Tilt or use Mouse to interact") with blurred backdrop, auto-dismisses after 5s
- **Live Status** — Realtime status badge via Firestore onSnapshot (Coming Soon / Arrived / Absent)
- **QR Code** — Rendered as data URL, overlaid on ticket, scaled proportionally
- **Gate Number** — When multi-gate is on, the assigned gate shows on the ticket face footer (`age / gender • Gate X`)
- **Download** — Captures ticket at 4x resolution, rotates 90° to portrait, downloads as PNG
- **Save to Google Wallet** — Official Google Wallet button. Generates signed JWT pass with per-type hero images, logo, guest name, gender, age, and event info. Per-type branded hero images (Classic/VIP/SVIP/VVIP)
- **OG Link Preview** — **Exact live shader ticket snapshot** captured at creation time (in the admin's browser via html-to-image) and stored in Firestore (`og_snapshots`). Served as JPEG for WhatsApp/social link previews. Falls back to SVG for tickets created before the feature
- **WhatsApp Share** — Message includes interactive ticket URL + phone unlock instructions + "(shader disabled for preview images)" + link-expiry notice
- **Report Issue** — Floating button (bottom-right) opens a form panel (name, phone with country code dropdown, reason, message). Submits via **Telegram Bot API** to admin's chat. Rate-limited (5/IP/5min). Confirmation screen with animated BadgeCheck + Report ID + copy button. Uses `TELEGRAM_BOT_TOKEN` + `CHAT_ID` env vars

### Offline & Kiosk
- **PWA / Offline Scanner** — Installable app (manifest + service worker, network-first caching). Staff scanner caches a minimal ticket snapshot in IndexedDB (refreshed every 5 min, not an always-on listener) and works with no WiFi; queued scans sync automatically on reconnect. Critical for venues with poor connectivity.
- **Self Check-in Kiosk** — A public PIN-gated URL (`/kiosk`) where guests scan their own QR code on a mounted tablet. Admin sets the PIN in Configuration (kill-switch: clear the PIN). Separate from the staff scanner; scans are logged as `SELF_CHECKIN`. **Works offline** the same way as the staff scanner, but caches only `{id, status, scanned}` (no guest PII) since it's a public device. Brute-force protected: 5 wrong-PIN attempts per IP per 5 minutes (Upstash-backed; a correct PIN resets the counter). Features: **front camera** (selfie mode for guest-facing tablet), physical **keyboard input** for the PIN (numpad + number row + Backspace + Enter), stays active permanently after unlock (no exit button), rectangular SVG country flags in dropdown.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | [Next.js](https://nextjs.org) (App Router) | 16.2.12 |
| **UI** | [React](https://react.dev) | 19.2.8 |
| **Language** | [TypeScript](https://www.typescriptlang.org) | 6.0.3 |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) v4 | 4.3.3 |
| **Components** | [shadcn/ui](https://ui.shadcn.com) (Base UI / base-nova style) | — |
| **Icons** | [lucide-react](https://lucide.dev), [react-icons](https://react-icons.github.io/react-icons), [@hugeicons/react](https://hugeicons.com) | 1.27 / 5.7 / 1.1.9 |
| **Backend** | [Firebase](https://firebase.google.com) (Auth + Firestore + Admin SDK) | 12.16 / 14.2 |
| **Auth Edge** | [next-firebase-auth-edge](https://github.com/awinogrd/next-firebase-auth-edge) | 1.12.0 |
| **Logs** | [Upstash Redis](https://upstash.com) | @upstash/redis |
| **Forms** | [react-hook-form](https://react-hook-form.com) + [zod](https://zod.dev) | 7.83 / 4.4 |
| **Tables** | [TanStack Table](https://tanstack.com/table) | 8.21.3 |
| **QR** | [qrcode](https://github.com/soldair/node-qrcode) + [jsQR](https://github.com/cozmo/jsQR) | 1.5.4 / 1.4.0 |
| **Export** | [jsPDF](https://github.com/parallax/jsPDF), [xlsx](https://github.com/SheetJS/sheetjs) | 4.2 / 0.18 |
| **WhatsApp** | [html-to-image](https://github.com/bubkoo/html-to-image) | 1.11.13 |
| **Motion** | [Framer Motion](https://www.framer.com/motion) + [motion](https://motion.dev) | 12.43 |
| **Animated Icons** | [@animate-ui](https://animate-ui.com) (BadgeCheck, Bell, BellOff) | — |
| **Smooth Scroll** | [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.26 |
| **Calendar** | [react-day-picker](https://github.com/gpbl/react-day-picker) (shadcn) | 10.0 |
| **Date Utils** | [date-fns](https://date-fns.org) | 4.4 |
| **Toasts** | [Sonner](https://sonner.emilkowal.ski) | 2.0.7 |
| **Flags** | [flag-icons](https://github.com/lipis/flag-icons) | 7.5 |
| **Wallet** | [Google Wallet API](https://developers.google.com/wallet) | JWT RS256 |
| **Shaders** | [Paper Shaders](https://github.com/simeydotme/pokemon-cards-css) (AdmitOneTicket) | — |

---

## Architecture

```
+-------------------------------------------------------------+
|                    Browser (Client)                         |
|  +----------+  +----------+  +----------+  +---------+    |
|  |  React   |  | Firebase |  |  Camera  |  |  html   |    |
|  |  Pages   |  |  Client  |  |  jsQR    |  |  to     |    |
|  | (RSC +   |  |  SDK     |  |  Decode  |  |  Image  |    |
|  |  Client) |  | onSnapshot| |          |  |         |    |
|  +----+-----+  +----+-----+  +----------+  +---------+    |
|       |             |                                      |
+-------+-------------+--------------------------------------+
        |             |
        v             v
+-------------------------------------------------------------+
|              Next.js Server (Vercel / Node)                 |
|                                                             |
|  +---------+  +----------+  +----------+  +-----------+    |
|  |  Proxy  |  |  Server  |  |  Route   |  |  Server   |    |
|  |(Edge MW)|  | Components| | Handlers |  |  Actions  |    |
|  | Cookie  |  | getAppUser| | /api/*   |  |  CRUD +   |    |
|  |  Gate   |  |  verify  | |  login   |  |  biz logic|    |
|  +---------+  +----+-----+  +----+-----+  +-----+-----+    |
|                    |             |              |          |
|                    v             v              v          |
|              +--------------------------------------+      |
|              |     Firebase Admin SDK (server)     |      |
|              |  verifySessionCookie - createCookie |      |
|              |  Firestore CRUD - revokeTokens      |      |
|              |  setCustomClaims - getUserByEmail   |      |
|              +------------------+-------------------+      |
+--------------------------------+----------------------------+
                                 |
              +------------------+------------------+
              v                  v                  v
     +--------------+   +--------------+   +------------+
     |  Firestore   |   | Firebase Auth|   |  Upstash   |
     |              |   |              |   |   Redis    |
     | - tickets    |   | - users      |   |            |
     | - settings   |   | - claims     |   | - activity |
     | - roles      |   | - sessions   |   |   logs     |
     | - locks      |   | - revocation |   | (1000 max) |
     | - contacts   |   |              |   |     +      |
     | - audit_trail|   |              |   | overflow→  |
     | - act_logs   |   |              |   |  Firestore |
     +--------------+   +--------------+   +------------+
```

**Security model:** All role checks happen server-side via custom claims + session cookie verification. No client-side email checks. No plaintext passwords. Staff removed from roles are instantly logged out via token revocation + realtime listener.

---

## Quick Start

```bash
# Clone
git clone https://github.com/Hawkay002/entry-pass-web.git
cd entry-pass-web

# Install
pnpm install

# Copy env template
cp .env.local.example .env.local
# Fill in your Firebase + Redis credentials (see below)

# Run
pnpm dev
```

Open `http://localhost:3000`

---

## Self-Hosting Guide

### Prerequisites

- **Node.js** 20+ (tested on 24.x)
- **pnpm** 10+ (`npm install -g pnpm`)
- A **Firebase** project (Blaze plan recommended for Auth + Firestore)
- An **Upstash Redis** database (free tier is fine)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) -> **Create Project**
2. Enable **Authentication** -> Sign-in method -> enable **Email/Password** and **Google**
3. Create **Firestore Database** (production mode)
4. Go to **Project Settings -> Service Accounts** -> **Generate new private key** -> download JSON
5. Copy the **Web App config** (apiKey, authDomain, etc.) from Project Settings -> General

### Step 2: Create an Upstash Redis Database

1. Go to [Upstash](https://console.upstash.com) -> **Create Database**
2. Copy the **REST URL** and **REST Token**

### Step 3: Configure Environment Variables

Create `.env.local` in the project root:

```bash
# Firebase client config (from Project Settings -> General -> Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Session cookies
AUTH_COOKIE_NAME=session
# Generate with: openssl rand -base64 32
COOKIE_SIGNATURE_KEY_CURRENT=your_random_32_char_secret

# Firebase Admin SDK (paste the ENTIRE service account JSON on ONE line)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Upstash Redis (for activity logs)
KV_REST_API_URL=https://your-db.upstash.io
KV_REST_API_TOKEN=your_token
```

### Step 4: Set Admin Email

In `app/api/login/route.ts` and `lib/firebase/server-auth.ts`, update the `ADMIN_EMAILS` array:

```ts
const ADMIN_EMAILS = ["your-email@gmail.com"];
```

### Step 5b: Enable the Self Check-in Kiosk (optional)

The public `/kiosk` route is disabled by default. To enable it:

1. Sign in as admin → **Configuration** → **Self Check-in Kiosk**
2. Enter a 4–8 digit PIN → **Enable Kiosk**
3. Open `/kiosk` on a mounted tablet (e.g. `https://etsweb.vercel.app/kiosk`)
4. Guests enter the PIN once, then scan their own QR code

The PIN is stored in the admin-only `admin_settings/security` Firestore doc — regular staff cannot read it. To disable the kiosk instantly, clear the PIN (or change it). Kiosk scans are attributed to `KIOSK` and logged as `SELF_CHECKIN` in the Activity Logs.

### Step 5: Deploy Firestore Security Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

Or paste the contents of [`firestore.rules`](./firestore.rules) into the Firebase Console -> Firestore -> Rules.

### Step 6: Set Custom Claims (one-time)

Create a script to set admin role on your Firebase Auth account:

```js
const admin = require("firebase-admin");
const sa = require("./service-account.json");
const app = admin.initializeApp({ credential: admin.cert(sa) });

admin.auth(app).getUserByEmail("your-email@gmail.com")
  .then(user => admin.auth(app).setCustomUserClaims(user.uid, { role: "admin" }))
  .then(() => { console.log("Admin role set"); return app.delete(); });
```

Run: `node set-admin.js`

### Step 7: Run Locally

```bash
pnpm dev
```

### Step 8: Deploy to Vercel

1. Push to GitHub
2. Go to [Vercel](https://vercel.com/new) -> Import the repo
3. Add all environment variables (same as `.env.local`)
4. Deploy
5. Add your Vercel domain to **Firebase Console -> Authentication -> Settings -> Authorized domains**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | `project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | `project.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes | Full service account JSON (one line) |
| `AUTH_COOKIE_NAME` | No | Default: `session` |
| `COOKIE_SIGNATURE_KEY_CURRENT` | Yes | Random 32+ char string for cookie signing |
| `KV_REST_API_URL` | Yes | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Yes | Upstash Redis REST token |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for issue reports (optional — feature degrades gracefully) |
| `CHAT_ID` | No | Telegram chat ID to receive issue reports |

---

## Firebase Setup

### Authentication

1. **Enable Email/Password** - For admin login
2. **Enable Google** - For staff Google Sign-In
3. **Add authorized domains** - Add localhost + your deployment URL

### Firestore Collections

Collections are created automatically on first write. The app uses:

| Collection | Purpose |
|---|---|
| `ticket_events_data/shared_event_db/tickets` | Guest tickets (incl. `gate`, `scannedAtGate`) |
| `ticket_events_data/shared_event_db/settings/config` | Event settings (name, venue, deadline, timezone, `multiGate`, `gateCategories`) |
| `ticket_events_data/shared_event_db/gates/{gateId}` | Event gates (name, category, order, active, `ticketTypes[]`) |
| `roles/{roleName}` | Dynamic staff roles (staff incl. `gateId`) |
| `global_locks/{userEmail}` | Remote tab locks per staff |
| `help_contacts` | Admin-managed help tray contacts |
| `activity_logs/{logId}` | Overflow activity logs (when Redis is full) |
| `og_snapshots/{ticketId}` | Pre-rendered OG share previews (base64 JPEG) |
| `admin_settings/security` | Kiosk PIN (admin-only) |
| `audit_trail/{doc}` | Factory reset audit records |

---

## Upstash Redis Setup

Activity logs are stored in [Upstash Redis](https://upstash.com) (not Firestore) to save write quota.

1. Create a free account at [Upstash](https://console.upstash.com)
2. **Create Database** -> choose a region close to your deployment
3. Copy the **REST URL** (`https://xxx.upstash.io`) and **REST Token**
4. Add them to your environment variables

**Free tier limits:** 500K commands/month, 256MB storage, 10GB transfer. Logs are **unlimited** — the first 1000 entries store in Redis; once full, overflow routes automatically to Firestore (`activity_logs` collection). Nothing is ever lost.

---

## Firestore Security Rules

The complete rules are in [`firestore.rules`](./firestore.rules). Key principles:

- **Default deny** - anything not explicitly allowed is blocked
- **Admin-gated** - destructive operations require `request.auth.token.role == 'admin'`
- **Self-only** - users read their own locks
- **Authenticated reads** - all app data requires sign-in

Deploy with:
```bash
firebase deploy --only firestore:rules
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Next.js** (auto-detected)
4. Add all [environment variables](#environment-variables)
5. Deploy

**Note:** The `jose` ESM compatibility issue is handled via:
- `pnpm-workspace.yaml` override: `jose: 5.10.0`
- `scripts/fix-jose.mjs` prebuild script (patches any jose@6 -> jose@5)

### Self-Host (Docker / VPS / Other)

```bash
# Build
pnpm build

# Start production server
pnpm start

# Or with a process manager
pm2 start "pnpm start" --name entry-pass
```

Requirements:
- Node.js 20+
- The server needs to be reachable from Firebase Auth (for session cookie verification)
- Add your domain to Firebase Authorized Domains

---

## Project Structure

```
entry-pass-web/
|-- app/
|   |-- (app)/              # Authenticated routes (gated by layout)
|   |   |-- layout.tsx      # Server-side auth check + auto-absent
|   |   |-- tickets/        # Issue Ticket (form + QR + WhatsApp + live ticket preview + OG capture)
|   |   |-- guests/         # Guest List (table + filter + import/export + gate column)
|   |   |-- scanner/        # Camera QR scanner (gate-aware, wrong-gate blocking)
|   |   |-- settings/       # Configuration + admin panels (multi-gate toggle + gate CRUD)
|   |   `-- logs/           # Activity Logs (admin only)
|   |-- (auth)/login/       # Login page (email + Google)
|   |-- actions/            # Server Actions (tickets, admin, roles, gates, gates-scanner)
|   |-- api/                # Route Handlers (login, logout, auto-absent, kiosk, ticket-verify, og-snapshot, wallet-pass)
|   |-- kiosk/              # Public self check-in kiosk (PIN-gated)
|   |-- ticket/[id]/        # Interactive guest ticket (phone gate + tilt ticket)
|   |-- layout.tsx          # Root layout (fonts, toaster, theme, SW registration)
|   `-- page.tsx            # Landing page (glass aesthetic, Starfield, Lenis, shader ticket showcase)
|-- components/
|   |-- admin/              # Admin panels (roles, RDM, maintenance, kiosk, factory reset, gate-panel)
|   |-- animate-ui/         # @animate-ui registry icons (BadgeCheck, Bell, BellOff + IconWrapper engine)
|   |-- guests/             # Import/Export modals
|   |-- landing/            # Landing sections (Nav, Hero, TicketTiers, Features, CTA, Atmosphere, etc.)
|   |-- layout/             # App shell, header, nav, starfield, atmosphere, smooth-scroll, help tray
|   |-- logs/               # Activity logs table
|   |-- scanner/            # Shared QR scanner (admin + kiosk, wrong-gate support)
|   |-- tickets/            # Interactive ticket, phone gate, ticket card, view modal
|   `-- ui/                 # shadcn/ui primitives + AdmitOneTicket (WebGL shader) + Switch + animated-glow-card
|-- hooks/                  # React hooks (settings, tickets, roles, gates, remote-locks, staff-check, contacts, background)
|-- lib/
|   |-- firebase/           # Admin SDK, client SDK, server-auth, logging
|   |-- auth.ts             # AppUser type (incl. gateId), role helpers
|   |-- env.ts              # Typed + validated env access
|   |-- types.ts            # Shared data model (Ticket, Gate, EventSettings, StaffMember)
|   |-- paths.ts            # Firestore collection paths
|   |-- capture-ticket.ts   # html-to-image ticket snapshot for OG previews
|   |-- phone-sanitize.ts   # Paste-sanitizing phone field (dial code extraction)
|   |-- redis-log.ts        # Upstash activity logging + Firestore overflow (incl. kiosk)
|   |-- rate-limit.ts       # Upstash-backed failure rate limiter
|   |-- offline-db.ts       # IndexedDB offline cache + scan queue (staff scanner, incl. gate)
|   |-- kiosk-db.ts         # IndexedDB offline cache + scan queue (kiosk, PII-free)
|   |-- timezones.ts        # 38 curated timezone offsets (UTC-12 to UTC+14)
|   |-- country-codes.ts    # 203 country dial codes with ISO flags
|   |-- google-wallet.ts    # Google Wallet JWT signing (inline class+object, RS256)
|   |-- guest-list.ts       # Filter/sort helpers (pure)
|   |-- import-export.ts    # Parse + format (CSV/XLSX/PDF/TXT/DOC/JSON + logs export)
|   `-- whatsapp.ts         # Ticket snapshot -> WhatsApp share (ticket URL)
|-- public/                 # Static assets (icons, PWA manifest + SW, backgrounds, fonts, wallet images, audio)
|-- scripts/                # Dev utilities (jose fix, claim setup, Firebase domain management)
|-- firestore.rules         # Security rules
|-- proxy.ts                # Edge middleware (cookie gate)
|-- next.config.ts          # Next.js config
|-- vercel.json             # Vercel deployment config
`-- package.json
```

---

## Data Model

### Ticket
```typescript
interface Ticket {
  id: string;              // Firestore auto-id
  name: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  phone: string;           // +91XXXXXXXXXX
  ticketType: "Classic" | "Diamond" | "Gold" | "SVIP";  // Diamond=VIP, Gold=VVIP
  status: "coming-soon" | "arrived" | "absent";
  scanned: boolean;
  scannedAt: number | null;
  scannedBy: string | null;
  createdBy: string;       // username
  createdAt: number;       // epoch ms
  gate?: string | null;    // assigned gate id (multi-gate mode)
  scannedAtGate?: string | null; // gate id where actually scanned
}
```

### Gate
```typescript
interface Gate {
  id: string;
  name: string;
  category: string;        // free-text: "Guest Entry", "Staff", "Security", etc.
  order: number;
  active: boolean;
  ticketTypes: TicketType[]; // which ticket types this gate accepts
  createdAt: number;
}
```

### Staff Role
```typescript
interface StaffRole {
  id: string;              // document id = role name
  name: string;
  staff: { name: string; email: string; gateId?: string | null }[];
  createdAt: number;
}
```

### Event Settings
```typescript
interface EventSettings {
  name: string;
  place: string;
  deadline: string;         // ISO datetime-local string
  timezone?: string;        // e.g. "+05:30", "auto"
  multiGate?: boolean;      // multi-gate mode toggle
  gateCategories?: string[]; // custom category names
}
```

### Remote Lock
```typescript
interface GlobalLockDoc {
  userSpecificLocks: Record<string, string[]>;  // username -> locked tab names
  lockMetadata: Record<string, {
    type: "basic" | "maintenance" | "suspension";
    duration: string | null;
    updatedAt: number;
  }>;
  updatedAt: number;
}
```

---

## API Reference

### Authentication

| Endpoint | Method | Description |
|---|---|---|
| `/api/login` | POST | Verify Firebase ID token, create httpOnly session cookie |
| `/api/logout` | POST | Clear session cookie |
| `/api/auto-absent` | POST | Check deadline, mark coming-soon tickets as absent |
| `/api/kiosk-checkin` | POST | Public self check-in — validates a PIN + marks a ticket arrived (logged as `SELF_CHECKIN`). Rate-limited: 5 failed PIN attempts/IP/5min. |
| `/api/kiosk-tickets` | POST | Public, PIN-gated fetch of the PII-free ticket list (`{id, status, scanned}` only) for the kiosk's offline cache. Same rate limit. |
| `/api/ticket-verify` | POST | Public phone verification for guest ticket access (full number + country code, rate-limited 5/IP/5min) |
| `/api/og-snapshot` | POST | Stores a pre-rendered OG share preview JPEG for a ticket (captured at creation time). Rate-limited 10/IP/5min. |
| `/api/report-issue` | POST | Receives issue reports from the interactive ticket page, forwards to Telegram Bot API. Rate-limited 5/IP/5min. |
| `/api/wallet-pass` | POST | Generates signed Google Wallet JWT with inline class+object, per-type hero images |

**Login flow:**
1. Client signs in with Firebase (email/password or Google popup)
2. Gets Firebase ID token
3. POSTs to `/api/login` with `{ idToken }`
4. Server verifies token, creates 14-day session cookie
5. Client redirects to dashboard

### Server Actions

| Action | File | Description |
|---|---|---|
| `createTicket` | `actions/tickets.ts` | Create a new ticket with QR (accepts dial code) |
| `validateTicket` | `actions/tickets.ts` | Scan validation (granted/already/invalid + scannedBy attribution) |
| `deleteOneTicket` | `actions/tickets.ts` | Delete a single ticket |
| `updateGuestName` | `actions/tickets.ts` | Edit a guest's name (admin-only, busts ISR cache) |
| `autoMarkAbsent` | `actions/tickets.ts` | Deadline-based absent marking (timezone-aware) |
| `syncOfflineScans` | `actions/tickets.ts` | Sync queued offline scans on reconnect (idempotent) |
| `getTicketsForOfflineCache` | `actions/tickets.ts` | Minimal-fields ticket list for scanner offline cache |
| `saveSettings` | `actions/admin.ts` | Save event configuration (name, venue, deadline, timezone) |
| `clearSettings` | `actions/admin.ts` | Clear event settings |
| `saveKioskPin` | `actions/admin.ts` | Set/clear the kiosk PIN (admin-only doc) |
| `getKioskStatus` | `actions/admin.ts` | Whether the kiosk PIN is enabled (no value exposed) |
| `factoryReset` | `actions/admin.ts` | Wipe database (preserves audit trail + deletes gates + OG snapshots) |
| `applyRemoteLocks` | `actions/admin.ts` | Lock/unlock staff tabs |
| `unlockStaff` | `actions/admin.ts` | Fully unlock a staff member |
| `createGate` | `actions/gates.ts` | Create a gate within a category (admin-only) |
| `updateGate` | `actions/gates.ts` | Rename / toggle active / update ticket types |
| `deleteGate` | `actions/gates.ts` | Delete a gate + clear assignments |
| `addGateCategory` | `actions/gates.ts` | Add a gate category (free text) |
| `deleteGateCategory` | `actions/gates.ts` | Delete category + all its gates |
| `disableMultiGate` | `actions/gates.ts` | Cascade: delete gates, clear ticket/staff gate fields |
| `createRole` | `actions/roles.ts` | Create a new staff role |
| `addStaffToRole` | `actions/roles.ts` | Add staff member to a role |
| `bulkAddStaffToRole` | `actions/roles.ts` | Bulk add staff (CSV/JSON/XLSX) with dedup |
| `updateStaffInRole` | `actions/roles.ts` | Edit staff name/email |
| `removeStaffFromRole` | `actions/roles.ts` | Remove staff + revoke tokens |
| `deleteRole` | `actions/roles.ts` | Delete a role entirely |
| `importTickets` | `actions/import.ts` | Bulk import with phone dedupe |

---

## How It Works

### Authentication & Authorization

```
Browser                    Server                      Firebase
  |                          |                            |
  |-- Firebase Sign-in ---------------------------------->  |
  |<-- ID Token ------------------------------------------|
  |                          |                            |
  |-- POST /api/login ----->|                            |
  |   { idToken }            |-- verifyIdToken --------->|
  |                          |<-- decoded token ---------|
  |                          |-- createSessionCookie --->|
  |                          |<-- session cookie --------|
  |<-- Set-Cookie: session --|                            |
  |                          |                            |
  |-- GET /tickets --------->|                            |
  |   Cookie: session=xxx    |-- verifySessionCookie --->|
  |                          |<-- decoded claims --------|
  |                          |-- read roles collection ->|
  |                          |<-- staff data -------------|
  |<-- Rendered page --------|                            |
```

### Remote Lock Enforcement

1. Admin selects staff -> chooses tabs -> clicks Lock
2. Server writes to `global_locks/{email}` via Admin SDK
3. Staff's `useRemoteLocks` hook fires `onSnapshot` instantly
4. `LockedTabsProvider` context updates
5. Locked pages render `<LockedTab />` component (fully blocked, not just hidden)
6. Unlocking removes the entry -> pages restore instantly

### Staff Removal (Instant Kick)

1. Admin removes staff from role -> confirmation modal
2. `removeStaffFromRole` action:
   - Removes email from role's staff array
   - If email not in any other role -> `revokeRefreshTokens(uid)`
3. Staff's `useStaffCheck` hook fires `onSnapshot` instantly
4. Email not found in roles -> `fetch("/api/logout")` + redirect to `/login`
5. Login attempt -> `/api/login` checks roles -> email not found -> rejected

### Auto-Absent

1. Admin selects a timezone from 38 options (UTC-12 to UTC+14, India default) and sets a deadline
2. The timezone offset is appended to the deadline before storing (e.g., `2026-08-04T17:00:00+05:30`)
3. Guest List page polls `/api/auto-absent` every 10s (only when deadline set + coming-soon tickets exist)
4. Server (always UTC on Vercel) parses the offset-aware ISO string and checks `Date.now() > deadline`
5. Batch updates all `coming-soon` -> `absent`
6. `onSnapshot` picks up the change -> table updates live (no refresh)

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check (no emit)
```

---

## License

(c) 2026 **Shovith Debnath**. All rights reserved.

---

**Built with:** Next.js - React - Tailwind CSS - Firebase - Upstash Redis - Framer Motion
