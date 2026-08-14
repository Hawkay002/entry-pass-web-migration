# Entry Pass Web — Complete Setup Guide (Vercel + Pocketbase)

This guide explains how to run this app the way it's designed to run:

- **The website** lives on **Vercel** — free hosting that's always online, with a
  fixed public link like `https://your-event.vercel.app` that you share with staff.
- **The database** (tickets, staff, logins) lives on **YOUR computer**, in a free
  program called **Pocketbase**.
- A free **Cloudflare tunnel** connects the two, so Vercel can reach your computer.

No technical background needed — every step is spelled out. First-time setup takes
about 30 minutes; after that, going live every day is **one command**.

---

## The big picture (read this first — it makes everything else easy)

```
   Staff phones & iPads                Vercel                    YOUR COMPUTER
   (anywhere, any network)  ─────▶  the WEBSITE  ─────▶  tunnel ─────▶  Pocketbase
                             fixed link,          free bridge     tickets, staff,
                             always online                        logins, settings
```

Two things to understand:

1. **The website (Vercel) is always online**, even when your computer is off.
   People can still open the link — but logging in or loading tickets needs your
   computer ON (the database lives there). Turn your computer on before the event.
2. **Your data never leaves your computer.** It's files in the `pb` folder here.
   Back them up by copying that folder.

> The tunnel's address changes every time your computer restarts — that's normal
> for the free version. The `pnpm go:live` command fixes everything automatically,
> and **the public staff link never changes.**

---

## What you need (one time)

| What | Where to get it | Cost |
|---|---|---|
| GitHub account | https://github.com → Sign up | free |
| Vercel account | https://vercel.com → Sign up (use "Continue with GitHub") | free |
| Google account | for Google Sign-In (optional) | free |
| Node.js | https://nodejs.org → download **LTS**, install | free |
| pnpm | after Node.js: open a terminal, run `npm install -g pnpm` | free |
| Vercel CLI | `npm install -g vercel` | free |
| cloudflared (the tunnel) | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ → download for your system, install | free |
| The app's code | download this repo as ZIP (and unzip) — or `git clone` | — |

**What's a terminal?** A window where you type commands instead of clicking.
- **Windows:** Start menu → type `Git Bash` → open it. (No Git Bash? Install from
  https://git-scm.com/download/win — click Next through everything.)
- **Mac:** Cmd+Space → type `terminal` → Enter.

**Opening the app folder in the terminal:** type `cd ` (c, d, space) and DRAG the
folder from your file explorer into the terminal window, then press Enter.
Check it worked: run `ls` — you should see `package.json` and `SETUP.md`.

---

## PART 1 — Prepare the database on your computer (once, ~10 min)

1. Open a terminal in the app folder (see above).

2. Install the website's building blocks:
   ```bash
   pnpm install
   ```

3. Run the setup wizard:
   ```bash
   pnpm setup
   ```
   It asks simple questions and does everything else automatically:
   - Downloads Pocketbase into a `pb` folder (once)
   - Creates all the database tables
   - Asks you to create **two different logins** — write them down:

   | Login | Where you'll use it |
   |---|---|
   | **Dashboard login** | The Pocketbase control panel (rarely needed) |
   | **Your app login** | The website's login page (your daily login) |

   - Optionally takes your Google codes (see PART 3 — you can skip now and add later)

   When it prints **SETUP COMPLETE**, continue.

---

## PART 2 — Put the website on Vercel and go live (once, ~5 min)

1. Connect this computer to your Vercel account (one time):
   ```bash
   vercel login        # opens your browser, click Approve
   vercel link         # connect this folder to a Vercel project — accept the defaults
   ```

2. Create a Vercel access token (one time) — this lets the go-live command
   update your website's settings automatically:
   - Open **https://vercel.com/account/tokens** → click **Create**
   - Name it anything (e.g. `entry-pass`), scope: your account → **Create**
   - Copy the token shown
   - Open the `.env.local` file (in this folder, any text editor) and add a line:
     ```
     VERCEL_TOKEN=paste-the-token-here
     ```
   - Save the file. (`.env.local` already exists if you ran `pnpm setup`;
     create it if not. It's private — never share it.)

3. **Go live:**
   ```bash
   pnpm go:live
   ```
   This one command:
   - starts the database (if not running)
   - starts the tunnel and gets its address
   - points your Vercel website at it (updates the settings, publishes the site)
   - prints your **public link** — e.g. `https://entry-pass-web-migration.vercel.app`

4. Open the public link, log in with your **app login**. Done — you're live. 🎉

**⚠️ Keep the `go:live` window open** (minimize it). It keeps the tunnel alive.
Closing it = the website can't reach the database.
**Stop everything:** click that window and press Ctrl+C.
**Computer restarted?** Just run `pnpm go:live` again — it repairs everything, and
the public link stays the same.

---

## PART 3 — Google Sign-In (optional, once, ~10 min)

Lets people click "Sign in with Google" instead of typing a password.

### Step 1 — Get two codes from Google

1. Go to https://console.cloud.google.com signed in with any Google account.
2. If asked, create a project (any name).
3. Search `OAuth consent screen` → choose **External** → Create:
   - App name: `Entry Pass` — your email in both email fields
   - Click **Save and Continue** through every screen
4. Still on the consent screen, find **Audience / Test users** → **Add users** →
   add the Gmail of every person allowed to sign in (you + staff).
   **This is what actually authorizes people** — skip it and Google blocks everyone.
5. Search `Credentials` → **Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Under **Authorized redirect URIs**, click Add URI and paste your public link
     with `/api/oauth/callback` at the end, for example:

     ```
     https://entry-pass-web-migration.vercel.app/api/oauth/callback
     ```

     (Use YOUR link from `pnpm go:live`. Adding a second line
     `http://localhost:3000/api/oauth/callback` is handy for testing on your PC.)
   - Click **Create** → copy the **Client ID** and **Client Secret** shown.

### Step 2 — Give the codes to Pocketbase

Either re-run `pnpm setup` and answer **y** to Google Sign-In — or manually:
database dashboard `http://127.0.0.1:8090/_/` → Collections → **users** →
**Edit collection** (⚙ / Options) → **OAuth2** tab → enable → Add provider →
**Google** → paste both codes → Save.

Done — the "Sign in with Google" button on your website now works, and it always
shows the account picker so people can choose between multiple Gmails.

---

## PART 4 — Letting staff in (roles)

Nobody can sign in until you add them — that's on purpose.

1. Log in to the website → **Configuration** tab.
2. Under **Roles**, create a role (e.g. "Scanner").
3. Inside it, **Add Staff**: their name + the email they'll sign in with.
4. Staff sign in at your public link with **Google** (their Gmail must be in the
   Google test-users list from PART 3) — or with email+password:
   dashboard → **users** → New record → their email, a password, role `staff`.

**Remove someone:** delete them from their role → they're locked out instantly.
**Make someone an admin:** add their email to the `ADMIN_EMAILS=` line inside the
`.env.local` file (comma-separate several), then run `pnpm go:live` again so the
website picks it up.

---

## PART 5 — Every day at the event

| Situation | What to do |
|---|---|
| Morning of the event | Run `pnpm go:live`, leave the window open, share the link |
| Computer restarted / login suddenly broken | Run `pnpm go:live` again |
| End of day | Ctrl+C in the go-live window |
| Back up the data | Copy the `pb` folder to a USB drive / cloud folder |

---

## PART 6 — Testing on your own computer (optional)

You can run everything locally without Vercel (e.g. to try things safely):

```bash
pnpm start:all        # database + website on your PC only
```
Open `http://localhost:3000` — same app, same logins, nothing public.
Only people on your Wi-Fi could reach it via the `Network:` address it prints.

---

## Troubleshooting — in plain words

| What you see | What it means | Fix |
|---|---|---|
| Website loads but login fails / spins | Your computer or the go-live window is closed — website can't reach the database | Run `pnpm go:live` |
| It worked yesterday, broken today | Tunnel address changed after a reboot | Run `pnpm go:live` (auto-repairs) |
| `cloudflared: command not found` | Tunnel program missing | Install it (link in "What you need") |
| go:live says "Not logged in to Vercel" | Vercel CLI has no account | Run `vercel login`, then `pnpm go:live` |
| Login says "not authorized" | That email has no role and isn't an admin | PART 4 — add them |
| Google: "redirect_uri_mismatch" | The redirect address in Google Console doesn't match | PART 3 step 5 — paste YOUR link + `/api/oauth/callback` exactly, no typos |
| Google blocks the sign-in | Their Gmail isn't a test user | PART 3 step 4 — add them |
| Google button does nothing / wrong account | — | Button always opens the account picker — pick the right Gmail |
| `pnpm` / `node` not found | Node.js or pnpm missing | Reinstall (see "What you need") |
| Setup says "port 8090 in use" | Pocketbase already running | Fine — it reuses it |
| Want to start over completely | — | Ctrl+C everything, delete the `pb` folder, `pnpm setup` again (**erases all data**) |

---

## Quick reference card

```bash
# ONE TIME
pnpm install
pnpm setup
vercel login
vercel link

# EVERY DAY — one command, leave the window open
pnpm go:live

# OPTIONAL — local testing only
pnpm start:all
```

| Address | What |
|---|---|
| your `*.vercel.app` link | the website (from `pnpm go:live`) |
| http://127.0.0.1:8090/_/ | database dashboard (this computer only) |
| http://localhost:3000 | local test website |
