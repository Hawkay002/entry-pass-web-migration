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
- **Issue Tickets** — Form with country code dropdown (203 countries with flags, India default). **Paste-sanitizing phone field** — paste `+4915210899596` → auto-selects Germany (+49), shows `15210899596`. Accepts international number lengths (6–15 digits, E.164). Live ticket confirmation with animated BadgeCheck (draw-on-path loop), auto-scrolls to preview on mobile + desktop. WhatsApp share button doubles as capture-status indicator. WhatsApp share message includes link-expiry notice. **Has Kids?** toggle for family/group tickets — add kid name/gender/age rows; creates parent + kids as separate tickets sharing a `groupId` + parent's phone. One WhatsApp link covers the whole family
- **Guest List** — 7 sort options, 4 filters (type/status/gender + search), bulk delete, import/export. **Gate column** appears when multi-gate mode is on (blue gate badges per ticket). **Admin-only edit guest name** (pencil icon per row). View eye opens interactive ticket page. Share column sends WhatsApp with ticket link + expiry notice. **Button group** (Select + Select All dropdown) + **Actions overflow menu** (Manage / Mark All Absent / Delete). **Manual Mark All Absent** button (admin override, skips deadline check). **Auto-absent** fires once at exact deadline via `setTimeout` (timezone-aware, zero polling). **Family grouping** — parent + kids stay together in the sorted list (parent first, then kids by age). Kids show a blue **Child** badge. **Import dedup** uses `phone:name` composite key (same phone + different name = not a duplicate)
- **Scanner** — Camera QR decode at 480px for maximum speed, **four-way validation** (granted / already scanned / invalid / **wrong gate**). Shows **who scanned** + **when** on duplicate scans. **Camera flip** button (front/back). **Animated bell toggle** for haptic feedback (synced to localStorage, rings/shakes on toggle). **Gate badge** in header showing the scanner's assigned gate. Offline mode with IndexedDB cache + auto-sync on reconnect. Wrong-gate scans are blocked without mutating the ticket
- **4 Ticket Types** — Classic, VIP, SVIP, VVIP — each with unique shader colors, fonts (The Seasons for names + Gotham Nights for body), and VVIP engraved text effect. Ticket names auto-balance across up to 3 lines and fill the space to the perforation. Gate number shown on ticket face footer (`age / gender • Gate X`)

### Admin & Security
- **Admin 2FA (TOTP)** — Two-factor authentication via Google Authenticator. Admin scans a QR code in Configuration, then enters a 6-digit code on every login. Smart OTP input (type anywhere, auto-fill boxes, paste support, auto-submit). **Recovery code login** — "Lost your device? Use a recovery code" link switches to a single-input recovery mode. 8 one-time recovery codes generated on enable (downloadable as .txt). Staff accounts skip 2FA entirely. Session cookie only minted after 2FA passes. Recovery codes hashed with SHA-256
- **Dynamic Roles** — Admin creates roles and adds staff (single or **bulk upload** via CSV/JSON/XLSX). **Collapsible role cards** (collapsed by default). Edit/delete staff moved to **Remote Device Management** — select staff, then batch edit (vertical list in modal) or batch delete. Google Sign-In maps emails automatically
- **Multi-Gate System** — Toggle multi-gate mode in Configuration (**admin-only** UI + server enforcement). Create gate categories (Guest Entry, Staff, Security, Management — free text). **Collapsible categories** (collapsed by default). Add gates inside categories with ticket-type acceptance (Classic/VIP/SVIP/VVIP). **Round-robin auto-assignment** balances tickets across gates. Staff assigned to specific gates. Wrong-gate scans blocked with "WRONG GATE" error (shows gate **name** not ID). Gate column in guest list + **gate filter**. Export includes gate. Ticket face shows assigned gate. Full cascade delete on disable/clear/factory-reset. **Multi-device realtime sync** for the toggle
- **Multi-Kiosk System** — Create multiple self check-in kiosks, each with its own **name, PIN (4–6 digits), gate assignment, and URL** (`/kiosk?id={kioskId}`). Admin CRUD via Configuration (**realtime onSnapshot**). Kiosk picker shown if no `?id=` param. Each kiosk validates its own PIN + enforces its gate. Per-kiosk+IP rate limiting. Kiosk 404 page if link is invalid/deleted. **Instant deletion detection** — a Firestore `onSnapshot` on a public `kiosk_status/{id}` doc fires the moment a kiosk is deleted or factory-reset, showing the 404 within ~1 second (no more 2-min poll delay). Config edits (name/PIN/gate change) instantly force re-authentication on the kiosk tablet
- **Configuration** — **Calendar + time picker** for deadline (shadcn Calendar with month/year dropdown selectors, 12-hour AM/PM two-box time input). **Premium Active Settings card** (gradient, hero event name, icon chips for venue/deadline, timezone + multi-gate badges). Staff see a **read-only** version of this card (no form, no gate config). **Admin-only** edit form. Admin panel uses **collapsible section cards** (2FA, Kiosks, Maintenance, Roles, RDM, Danger Zone) — each collapsed by default with live status badges (Active/Not configured/count/locked), expand on click. Secondary row actions (Edit/Delete) consolidated into `⋯` overflow menus. Pure CSS grid height animation (no JS measurement)
- **Remote Device Management** — Select staff from role → batch **edit** (name/email/gate) or **delete** via overflow menu. Staff selection modal shows 10 rows on mobile, 8 on desktop before scrolling. **Select All checkbox** (matches guest list / activity log pattern). Lock/unlock tabs with reason (basic/review). **Configuration tab excluded** from lockable tabs (staff can only view, not edit)
- **Remote Lock** — Lock or unlock specific tabs per staff member with live status badges. Selective unlock. **3 lockable tabs** (Issue Ticket, Guest List, Scanner) — Configuration excluded since staff view-only
- **Maintenance Mode** — Lock all staff instantly with duration timer (OctagonAlert icon). Auto-unlock when time expires
- **Staff Auto-Logout** — Removing a staff member instantly revokes their session and kicks them out
- **Auto-Absent** — Deadline-based status automation with **timezone-aware** offsets (38 zones, UTC-12 to UTC+14). Zero page reload
- **Activity Logs** — 12 colored action types. **Unlimited** — Redis stores first 1000, overflow routes to Firestore. CSV/XLSX/PDF export of selected logs. All logins logged (incl. Google display name). Single ticket deletions logged with guest name
- **Factory Reset** — Nukes the database with an immutable audit trail preserved. Also deletes gates + OG snapshots + kiosks. Separate glass card with "Danger Zone" heading
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
- **Error Pages** — Custom **404** (ticket-specific + generic) and global **error boundary** with glass aesthetic, The Seasons serif, and contextual CTAs (Contact Organizer, Go Home, Try Again)

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
- **Family Ticket Cycling** — When a parent ticket has kids (shared `groupId`), circular chevron buttons appear above the Wallet/Download row: `‹ Name — 1 of 3 ›`. Cycles through parent + all kids; each ticket has its own QR for individual scanning. One phone verification unlocks the whole family
- **Mobile Pinch-to-Zoom** — Viewport allows user scaling (pinch to zoom on mobile). Ticket width auto-fits to `visualViewport` changes
- **Save to Google Wallet** — Official Google Wallet button. Generates signed JWT pass with per-type hero images, logo, guest name, gender, age, and event info. Per-type branded hero images (Classic/VIP/SVIP/VVIP)
- **OG Link Preview** — **Exact live shader ticket snapshot** captured at creation time (in the admin's browser via html-to-image) and stored in Firestore (`og_snapshots`). Served as JPEG for WhatsApp/social link previews. Falls back to SVG for tickets created before the feature
- **WhatsApp Share** — Message includes interactive ticket URL + phone unlock instructions + "(shader disabled for preview images)" + link-expiry notice
- **Report Issue** — Floating button (bottom-right) opens a form panel (name, phone with country code dropdown, reason, message). Submits via **Telegram Bot API** to admin's chat. Rate-limited (5/IP/5min). Confirmation screen with animated BadgeCheck + Report ID + copy button. Uses `TELEGRAM_BOT_TOKEN` + `CHAT_ID` env vars

### Offline & Kiosk
- **PWA / Offline Scanner** — Installable app (manifest + service worker, network-first caching). Staff scanner caches a minimal ticket snapshot in IndexedDB (refreshed every 5 min, not an always-on listener) and works with no WiFi; queued scans sync automatically on reconnect. **Scanner warning** if multi-gate is on but staff has no gate assigned. Critical for venues with poor connectivity.
- **Self Check-in Kiosk** — **Multiple kiosks**, each with its own PIN (4–6 digits, show/hide eye toggle) + gate + URL (`/kiosk?id={kioskId}`). Admin creates/manages kiosks in Configuration (realtime sync). Kiosk picker shown when no `?id=` param. Each kiosk validates its own PIN and enforces its assigned gate (wrong-gate blocked). Per-kiosk+IP rate limiting (5 wrong PINs/5min). **6-box PIN entry** with show/hide toggle. Front camera (selfie mode). Physical keyboard input. **Instant deletion detection** via Firestore `onSnapshot` on `kiosk_status/{id}` — shows 404 within ~1s of admin delete (no 2-min poll). Config edits force instant re-authentication. Works offline (caches `{id, status, scanned}` — no guest PII).

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
| **2FA** | [otplib](https://github.com/yeojz/otplib) (TOTP) | 13.4 |
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
     | - gates      |   | - sessions   |   |   logs     |
     | - roles      |   | - revocation |   | (1000 max) |
     | - locks      |   |              |   |     +      |
     | - contacts   |   |              |   | overflow→  |
     | - audit_trail|   |              |   |  Firestore |
     | - act_logs   |   |              |   |            |
     | - og_snapshots|  |              |   | - rate     |
     | - kiosk_status| |              |   |   limiting |
     +--------------+   +--------------+   |            |
                                           +------------+
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

# Upstash Redis (for activity logs + rate limiting)
KV_REST_API_URL=https://your-db.upstash.io
KV_REST_API_TOKEN=your_token

# Telegram Bot (optional — issue reports from interactive ticket page)
# Create a bot via @BotFather, get your chat ID via @userinfobot
TELEGRAM_BOT_TOKEN=your_bot_token
CHAT_ID=your_chat_id
```

### Step 4: Set Admin Email

In `app/api/login/route.ts` and `lib/firebase/server-auth.ts`, update the `ADMIN_EMAILS` array:

```ts
const ADMIN_EMAILS = ["your-email@gmail.com"];
```

### Step 5: Deploy Firestore Security Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

Or paste the contents of [`firestore.rules`](./firestore.rules) into the Firebase Console -> Firestore -> Rules.

### Step 5b: Initialize Firestore Collections (one-time)

Collections are created automatically on first write, but you can pre-initialize them with placeholder docs using the included script:

```bash
node scripts/init-collections.cjs
```

This creates all 12 collections with a single placeholder doc each (then deletes them). See **Firebase Setup → Firestore Collections** below for the full list.

### Step 5c: Enable the Self Check-in Kiosk (optional)

The public `/kiosk` route is disabled by default. To enable it:

1. Sign in as admin → **Configuration** → **Self Check-in Kiosk**
2. Enter a 4–8 digit PIN → **Enable Kiosk**
3. Open `/kiosk` on a mounted tablet (e.g. `https://etsweb.vercel.app/kiosk`)
4. Guests enter the PIN once, then scan their own QR code

The PIN is stored in the admin-only `admin_settings/security` Firestore doc — regular staff cannot read it. To disable the kiosk instantly, clear the PIN (or change it). Kiosk scans are attributed to `KIOSK` and logged as `SELF_CHECKIN` in the Activity Logs.

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

Collections are created automatically on first write, or pre-initialize with `node scripts/init-collections.cjs`. The app uses:

| Collection | Purpose |
|---|---|
| `ticket_events_data/shared_event_db/tickets` | Guest tickets (incl. `gate`, `scannedAtGate`) |
| `ticket_events_data/shared_event_db/settings/config` | Event settings (name, venue, deadline, timezone, `multiGate`, `gateCategories`) |
| `ticket_events_data/shared_event_db/gates/{gateId}` | Event gates (name, category, order, active, `ticketTypes[]`) |
| `roles/{roleName}` | Dynamic staff roles (staff incl. `gateId`) |
| `global_locks/{userEmail}` | Remote tab locks per staff |
| `help_contacts` | Admin-managed help tray contacts |
| `activity_logs/{logId}` | Overflow activity logs (when Redis is full) |
| `og_snapshots/{ticketId}` | Pre-rendered OG share previews (base64 JPEG, server-only) |
| `admin_settings/security` | Multi-kiosk configs (`kiosks[]`) — admin-only |
| `admin_settings/two_factor` | Admin 2FA secrets + recovery codes — admin-only |
| `kiosk_status/{kioskId}` | Public kiosk existence signal (`{ updatedAt: number }` only — no PIN/PII). Read by the unauthenticated `/kiosk` page via `onSnapshot` for instant deletion detection. Public read, admin write |
| `audit_trail/{doc}` | Factory reset audit records |
| `communications` | Legacy chat messages (backwards compat, unused) |
| `typing_status` | Legacy typing indicators (backwards compat, unused) |

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
|   |   |-- tickets/        # Issue Ticket (form + QR + WhatsApp + live preview + OG capture + Has Kids? group tickets)
|   |   |-- guests/         # Guest List (table + filter + import/export + gate column + edit name)
|   |   |-- scanner/        # Camera QR scanner (gate-aware, wrong-gate blocking, bell toggle)
|   |   |-- settings/       # Configuration (admin: form + multi-gate + gate CRUD; staff: read-only)
|   |   `-- logs/           # Activity Logs (admin only)
|   |-- (auth)/login/       # Login page (email + Google)
|   |-- actions/            # Server Actions (tickets, admin, roles, gates, gates-scanner)
|   |-- api/                # Route Handlers (login, logout, auto-absent, kiosk, ticket-verify, og-snapshot, report-issue, wallet-pass)
|   |-- kiosk/              # Public self check-in kiosk (PIN-gated)
|   |-- ticket/[id]/        # Interactive guest ticket (phone gate + tilt ticket + report issue)
|   |-- not-found.tsx       # Custom 404 (glass aesthetic)
|   |-- error.tsx           # Global error boundary
|   |-- layout.tsx          # Root layout (fonts, toaster, theme, SW registration)
|   `-- page.tsx            # Landing page (glass aesthetic, Starfield, Lenis, shader ticket showcase)
|-- components/
|   |-- admin/              # Admin Configuration section
|   |   |-- admin-panels.tsx        # Thin shell — stacks panels in separate glass cards
|   |   |-- collapsible-section.tsx # Collapsible wrapper (CSS grid height animation, live status badges)
|   |   |-- panels/                 # One file per panel (split from former 1900-line monolith)
|   |   |   |-- two-factor-panel.tsx         # Admin 2FA (TOTP) setup/disable + OTP boxes
|   |   |   |-- maintenance-panel.tsx        # Lock-all-roles maintenance mode
|   |   |   |-- role-management-panel.tsx    # Create roles + add/bulk-import staff
|   |   |   |-- remote-device-management.tsx # Role cards → staff modal → lock/unlock + batch edit/delete
|   |   |   |-- kiosk-panel.tsx              # Self check-in kiosk CRUD
|   |   |   `-- factory-reset-panel.tsx      # Danger Zone (nukes DB, preserves audit trail)
|   |   |-- gate-panel.tsx       # Gate CRUD (categories + gates)
|   |   |-- settings-form.tsx   # Event config form + DeadlineCountdown
|   |   `-- settings-content.tsx # Settings page shell (admin form vs staff read-only)
|   |-- animate-ui/         # @animate-ui registry icons (BadgeCheck, Bell, BellOff + IconWrapper engine)
|   |-- guests/             # Import/Export modals
|   |-- landing/            # Landing sections (Nav, Hero, TicketTiers, Features, CTA, Atmosphere, etc.)
|   |-- layout/             # App shell, header, nav, starfield, atmosphere, smooth-scroll, help tray, IsAdminContext
|   |-- logs/               # Activity logs table
|   |-- scanner/            # Shared QR scanner (admin + kiosk, wrong-gate support)
|   |-- tickets/            # Interactive ticket, phone gate, ticket card, view modal, report issue panel
|   `-- ui/                 # shadcn/ui primitives + AdmitOneTicket (WebGL shader) + Switch + animated-glow-card + Calendar + Popover + Textarea
|-- hooks/                  # React hooks (settings, tickets, roles, gates, kiosks, remote-locks, lock-status, staff-check, contacts, background, is-in-view)
|-- lib/
|   |-- firebase/           # Admin SDK, client SDK, server-auth (resolves gateId), logging
|   |-- auth.ts             # AppUser type (incl. gateId), role helpers, IsAdminContext
|   |-- env.ts              # Typed + validated env access
|   |-- types.ts            # Shared data model (Ticket, Gate, EventSettings, StaffMember)
|   |-- paths.ts            # Firestore collection paths (incl. gates, og_snapshots)
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
|-- scripts/                # Dev utilities (jose fix, claim setup, domain mgmt, init-collections, generate-staff, deploy-rules)
|-- firestore.rules         # Security rules (incl. gates + og_snapshots)
|-- firebase.json           # Firebase CLI config (for rules deployment)
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
  groupId?: string | null;     // shared by parent + kids; null for standalone
  parentName?: string | null;  // set on kid tickets only; null on parent/standalone
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

### Kiosk Config
```typescript
interface KioskConfig {      // stored in admin_settings/security.kiosks[]
  id: string;                // short random id (for URL)
  name: string;              // e.g. "Gate A Kiosk"
  pin: string;               // 4-6 digits
  gateId: string | null;     // assigned gate (null = accept all)
  createdAt: number;
}
```

### 2FA Config
```typescript
interface TwoFactorConfig {  // stored in admin_settings/two_factor.admins[uid]
  secret: string;            // base32 TOTP secret
  enabled: boolean;
  recoveryCodes: string[];   // hashed (SHA-256)
  setupAt: number;
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
| `/api/kiosk-list` | GET | Public list of available kiosks (id + name only, no PINs). Used by kiosk picker. |
| `/api/2fa-setup` | GET/POST/DELETE | Admin 2FA setup: GET returns QR+secret, POST verifies code + enables, DELETE disables. |
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
| `createTicket` | `actions/tickets.ts` | Create a new ticket with QR + auto-gate assignment (round-robin) |
| `validateTicket` | `actions/tickets.ts` | Scan validation (granted/already/invalid/wrong-gate + scannedBy + gate enforcement) |
| `deleteOneTicket` | `actions/tickets.ts` | Delete a single ticket (logs with guest name) |
| `updateGuestName` | `actions/tickets.ts` | Edit a guest's name (admin-only, busts ISR cache) |
| `autoMarkAbsent` | `actions/tickets.ts` | Deadline-based absent marking (timezone-aware, busts ISR) |
| `syncOfflineScans` | `actions/tickets.ts` | Sync queued offline scans on reconnect (idempotent, gate-aware) |
| `getTicketsForOfflineCache` | `actions/tickets.ts` | Minimal-fields ticket list for scanner offline cache (incl. gate) |
| `saveSettings` | `actions/admin.ts` | Save event configuration (name, venue, deadline, timezone, multiGate, gateCategories) |
| `clearSettings` | `actions/admin.ts` | Clear settings + cascade (disables multi-gate, deletes gates) |
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
| `createKiosk` | `actions/admin.ts` | Create a kiosk (name + PIN + gateId) |
| `updateKiosk` | `actions/admin.ts` | Update kiosk name/PIN/gate |
| `deleteKiosk` | `actions/admin.ts` | Delete a kiosk by id |
| `createRole` | `actions/roles.ts` | Create a new staff role |
| `addStaffToRole` | `actions/roles.ts` | Add staff member to a role (incl. gateId) |
| `bulkAddStaffToRole` | `actions/roles.ts` | Bulk add staff (CSV/JSON/XLSX) with dedup |
| `updateStaffInRole` | `actions/roles.ts` | Edit staff name/email/gate (spread-merge preserves gateId) |
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

## Firebase Read Cost Estimate (Spark / Free Tier)

The Spark (free) plan includes these daily quotas (**separate, not shared**):

| Quota | Daily Limit |
|---|---|
| Document reads | 50,000 |
| Document writes | 20,000 |
| Document deletes | 20,000 |

### What event sizes can the free tier handle?

The bottleneck is always **reads** (writes stay under 12% even at maximum capacity). The read cost scales with **ticket count × number of active scanner/kiosk devices**. Here's what fits on the free tier:

| Event size | Scanners | Kiosks | Duration | Est. reads/day | Free tier |
|---|---|---|---|---|---|
| **Small** — birthday, private party | 1 | 0 | 4h | ~6,500 | ✅ 13% |
| **Small + kiosk** — small gig, meetup | 1 | 1 | 6h | ~13,000 | ✅ 26% |
| **Medium** — conference, workshop, club night | 2 | 1 | 8h | ~22,000 | ✅ 45% |
| **Medium+** — 300 tickets, more devices | 2 | 1 | 8h | ~30,000 | ✅ 60% |
| **Large** — wedding, corporate event, festival | 2 | 1 | 8h | ~38,000 | ✅ 76% |
| **Max** — 450 tickets, 6 staff, 900 scans | 2 | 1 | 8h | ~49,800 | ⚠️ 99.5% |
| **Over capacity** — 500+ tickets or 3+ scanners | 3 | 1 | 8h | ~58,000+ | ❌ Exceeds |

**Rules of thumb:**
- **Under 200 tickets**: unlimited staff/kiosks — you'll never hit the cap
- **200–450 tickets**: keep to ≤2 scanners + ≤1 kiosk to stay safe
- **450+ tickets**: exceeds free tier — either reduce active devices, increase poll interval beyond 15 min, or upgrade to Blaze ($0.036/100K reads)
- **Adding a 3rd scanner**: costs ~6,600 reads/day per 100 tickets — reduces max capacity by ~100 tickets
- **Removing the kiosk**: frees ~6,500 reads/day — extends max capacity to ~530 tickets
- **Multi-day events**: quota resets daily at midnight Pacific time, so a 2-day event at 200 tickets/day is fine

The **Typical** column shows a standard event; the **Optimal** column shows the maximum event size that stays just under the 50K read cap.

> **Typical:** 200 tickets · 1 admin (8h, 2h on Settings) · 4 staff (8h) · 1 kiosk (8h) · 2 scanners (8h, 500 scans)
>
> **Optimal:** 450 tickets · 1 admin (8h, 2h on Settings) · 6 staff (8h) · 1 kiosk (8h) · 2 scanners (8h, 900 scans)

| Component | Mechanism | Typical | Optimal |
|---|---|---|---|
| **Staff remote-locks** (`useRemoteLocks`) | Single-doc `onSnapshot` per staff | ~24 | ~36 |
| **Kiosk status** (`onSnapshot`) | Single-doc listener (public, existence-only) | ~3 | ~3 |
| **Scanner offline cache** | Full tickets poll every **15 min** + on reconnect | ~12,933 | ~29,700 |
| **Kiosk offline cache** | Full tickets poll every **15 min** + on reconnect | ~6,461 | ~14,883 |
| **Per-scan validation** | 1 ticket + 1 gate doc per scan | ~1,500 | ~2,700 |
| **Phone verification** | 1 doc per verify | ~100 | ~225 |
| **Ticket creation** | ~3 reads per ticket | ~600 | ~1,350 |
| **Lock dashboard** (admin Settings) | Single `global_locks` read every **15 s** (merged) | ~480 | ~480 |
| **Roles/Settings/Gates listeners** | `onSnapshot` on doc/collection | ~50 | ~65 |
| **Help contacts** | `onSnapshot` — lazy-mounted (only when tray opens) | ~10 | ~10 |
| **Auto-absent** | `setTimeout` at deadline — fires once (no polling) | ~1 | ~1 |
| **`getAppUser()` server calls** | Reads `roles` collection to resolve identity | ~200 | ~300 |
| | **Total estimated** | **~22,362** | **~49,753** |
| | **% of 50K free tier** | **~45%** ✅ | **~99.5%** ⚠️ |

> **⚠️ The Optimal column is the hard ceiling.** At ~450 tickets with 2 scanners + 1 kiosk active for 8 hours, you consume ~99.5% of the daily quota. Beyond this (more tickets, more scanner/kiosk devices, or longer active hours) you'll exceed the free tier. To scale further, either reduce the scanner/kiosk poll frequency (already at 15 min), reduce the number of active scanner/kiosk tabs, or upgrade to the Blaze plan ($0.036 per 100K reads).

### What scales linearly (the bottleneck)
The two largest costs scale **proportionally with ticket count** because each poll fetches the entire tickets collection:

| Cost driver | Per 100 extra tickets | Notes |
|---|---|---|
| Scanner cache (per device) | +3,300 reads/day | 33 polls/day × 100 tickets |
| Kiosk cache (per device) | +3,300 reads/day | 33 polls/day × 100 tickets |

Adding a **3rd scanner tab** adds ~6,600 reads/day at 200 tickets (reduces max capacity to ~350 tickets). Removing the kiosk frees ~6,461 reads/day (extends capacity to ~530 tickets).

### Key optimizations
- **Merged lock polling** — formerly 3 separate 5s polls (3 full `global_locks` reads per 5s = ~21K/day) merged into a single 15s `fetchLockDashboard` call (~480/day)
- **Scanner/kiosk cache** — poll interval increased from 2–5 min to 15 min + refresh on reconnect (offline-first design, onSnapshot dies when WiFi drops)
- **Auto-absent** — replaced 10s polling with a single `setTimeout` at the exact deadline moment (timezone-aware)
- **Help contacts** — `onSnapshot` only activates when the Help Tray opens (was on every authenticated page)
- **Kiosk deletion** — instant via `onSnapshot` on `kiosk_status/{id}` (replaced 2-min poll)

### Write estimate (20K writes/day limit)

Writes are **not a bottleneck** — the read-heavy polling dominates by 200×. A typical event uses <10% of the write quota:

| Write source | Typical (200 tix) | Optimal (450 tix) |
|---|---|---|
| Ticket creation | ~200 | ~450 |
| Per-scan update (`scanned`, `scannedAt`, `scannedBy`) | ~500 | ~900 |
| Kiosk self check-in writes | ~200 | ~450 |
| Remote lock/unlock operations | ~10 | ~15 |
| Maintenance mode (lock all staff) | ~4 | ~6 |
| Auto-absent batch update | ~200 | ~450 |
| Settings save | ~5 | ~5 |
| Kiosk CRUD (`kiosk_status` doc) | ~3 | ~3 |
| Role/gate CRUD | ~10 | ~15 |
| Activity log overflow → Firestore | ~0 | ~0 |
| | **~1,132** | **~2,294** |
| | **% of 20K writes** | **~5.7%** ✅ | **~11.5%** ✅ |

---

## License

(c) 2026 **Shovith Debnath**. All rights reserved.

---

**Built with:** Next.js - React - Tailwind CSS - Firebase - Upstash Redis - Framer Motion
