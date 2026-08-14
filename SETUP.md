# Entry Pass Web — The Complete Beginner's Setup Guide

This guide assumes you have **never installed software like this before**. Every step is
spelled out. If you can copy and paste, you can do this. Total time: about 15 minutes
(plus 5 extra minutes if you want Google Sign-In).

---

## First, what IS this? (read this — it makes everything else easier)

This app is made of **three things** that work together:

1. **The Website** — the part people see. Tickets, scanning, settings. This is the
   code in this folder.
2. **The Database** — the app's memory. It stores every ticket, every staff member,
   every setting. We use a free program called **Pocketbase** for this. It's a single
   file that runs on your computer — no accounts, no cloud, no monthly fees.
3. **Google Sign-In** (optional) — lets people sign in with their Gmail instead of
   typing a password. Needs free codes from Google, which we'll get together.

**Where does everything live?** On YOUR computer. Nothing is uploaded anywhere.
If your computer is off, the website is off. That's normal and expected.

---

## What you need before starting

- A computer (Windows, Mac, or Linux) with internet
- **Node.js** installed — this runs the website. Download the "LTS" version from
  https://nodejs.org (click the big green button, then Next-Next-Install).
- **pnpm** installed — this fetches the website's parts. After installing Node.js,
  open a terminal (see below) and paste: `npm install -g pnpm` then press Enter.

**What's a "terminal"?** A window where you type commands instead of clicking.
- **Windows:** press the Start button, type `Git Bash`, and open it.
  (No Git Bash? Install it from https://git-scm.com/download/win — click Next
  through every screen.) *Why Git Bash and not CMD? The commands in this guide
  are written for it.*
- **Mac:** press Cmd+Space, type `terminal`, press Enter.

**How to "run a command":** type or paste it into the terminal and press Enter.

---

## PART 1 — One-time setup (about 15 minutes)

### Step 1. Get this folder onto your computer

If you downloaded this as a ZIP: right-click it → Extract All.
If you're using Git: `git clone <this-repo-url> entry-pass && cd entry-pass`.

For the rest of this guide, we'll call this folder **"the app folder"**.

### Step 2. Open a terminal INSIDE the app folder

In your terminal, type `cd ` (the letters c and d, then a **space**) — then drag the
app folder from your file explorer onto the terminal window. The folder's address
appears. Press Enter. You're now "inside" the folder.

> **Check you're in the right place:** run `ls` and press Enter. You should see
> names like `package.json`, `app`, `SETUP.md`. If not, repeat Step 2.

### Step 3. Fetch the website's parts (once)

```bash
pnpm install
```

Lots of text scrolls by for a minute or two. That's normal. It's downloading the
building blocks the website needs.

### Step 4. Run the setup wizard

```bash
pnpm setup
```

This starts an automatic wizard. It will:

1. Download Pocketbase (the database program) into a `pb` folder inside the app
   folder. Happens once.
2. Ask you to create **two logins** — read carefully, these are different things:

   | Login | Where you use it | Example |
   |---|---|---|
   | **Dashboard login** | The Pocketbase control panel (rarely needed — for looking directly at raw data) | `admin@example.com` |
   | **Your app login** | The website's login page (what you'll use daily) | `yourname@gmail.com` |

   Choose an email + password (8+ characters) for each. **Write them down.**

3. Ask about **Google Sign-In**. Two choices:
   - **Type `n` and Enter** → skip it. You can add it later (see Part 4). Email +
     password login works fine without it.
   - **Type `y` and Enter** → the wizard prints step-by-step Google instructions
     (also in Part 4 below, with more detail). You'll fetch two codes from Google
     and paste them when asked.
4. Create all the database tables automatically.
5. Save your settings to a file called `.env.local`.

When you see **SETUP COMPLETE**, you're done with this part. 🎉

---

## PART 2 — Everyday use

### Start the app

```bash
pnpm start:all
```

Wait until you see a line like `- Local: http://localhost:3000`.
Then open **http://localhost:3000** in your browser (Chrome recommended).

**Log in** with your *app login* (email + password from setup).

> **Tip for events:** `pnpm start:all --prod` runs a faster version of the website
> (takes longer to start, but pages load quicker and it survives weak laptops better).
> Use this on event day.

### Stop the app

Click the terminal window and press **Ctrl+C**. Everything stops safely.

> Your data never disappears when you stop — it's saved in files inside the `pb`
> folder. Stopping and starting is like closing and reopening a notebook.

### Useful addresses

| Address | What it is |
|---|---|
| `http://localhost:3000` | The website |
| `http://localhost:3000/login` | The login page |
| `http://127.0.0.1:8090/_/` | The database dashboard (uses the *dashboard login*) |

---

## PART 3 — Letting staff in (roles)

Staff cannot sign in until you add them. That's on purpose — random people who find
the link shouldn't get in.

1. Open the website and log in.
2. Go to **Configuration** (the settings tab).
3. Find **Roles** and create one — e.g. "Scanner" or "Ticket Desk".
4. Inside the role, click **Add Staff** and enter their **name** and **email**.
   The email is their key: it must match the Gmail/email they'll sign in with.
5. They can now go to the website's login page and:
   - sign in with **Google** (if you set it up — and if you added their Gmail as a
     *test user* in Google, see Part 4 Step 3), or
   - sign in with **email + password** — but first you must create them a password:
     open the database dashboard (`http://127.0.0.1:8090/_/`) → **users** →
     **New record** → their email + a password + role `staff`.

**Removing someone:** delete them from their role. The moment you do, they're locked
out on their next click. (You may also delete their record under `users` in the
dashboard.)

**Making someone an admin:** add their email to the `ADMIN_EMAILS=` line inside the
`.env.local` file (separate multiple emails with commas), stop the app, start it
again. Admins see every tab and setting.

---

## PART 4 — Google Sign-In, explained slowly (optional, ~10 minutes)

You only do this once. After it, anyone whose Gmail you've approved can click
"Sign in with Google."

### Step 1. Get your two codes from Google

1. Go to https://console.cloud.google.com and sign in with **your** Google account.
2. If asked to "select a project," click **New Project**, name it anything
   (e.g. `entry-pass`), click **Create**, wait a few seconds.
3. In the search bar at the top, type `OAuth consent screen` and open it.
   - Choose **External** → click **Create**.
   - Fill in: App name = `Entry Pass`, your email in both email boxes.
     Click **Save and Continue** through every screen (skip the rest).
   - On the left, click **Audience** (or "Test users") → **Add users** →
     type every Gmail that should be allowed to sign in (yours, your staff's).
     **This step is what actually authorizes people.** Without it, Google will
     say "access blocked" for everyone.
4. In the search bar, type `Credentials` and open it.
   - Click **+ Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs** click **Add URI** and paste exactly:

     ```
     http://127.0.0.1:8090/api/oauth2-redirect
     ```

   - Click **Create**. A small window shows your **Client ID** and
     **Client Secret**. Keep this window open — or copy both into a text file.

### Step 2. Give the codes to the app

If you answered "no" during setup, connect Google now:

1. Open the database dashboard: `http://127.0.0.1:8090/_/` → log in with the
   *dashboard login*.
2. Left sidebar → **Collections** → click **users** → top-right **⚙ Options/Edit
   collection** → **OAuth2** tab.
3. Turn OAuth2 **on**. Under providers click **Add provider** → **Google** → paste
   your Client ID and Client Secret → **Save**.

Done. The "Sign in with Google" button on the website now works.

> **Using the website over the internet (tunnel/domain)?** Google also needs that
> address. Add `https://YOUR-ADDRESS/api/oauth2-redirect` as a second line in the
> same "Authorized redirect URIs" list from Step 1.4.

---

## PART 5 — Sharing the website with staff over the internet

By default the website only works on YOUR computer. Options, simplest first:

### Option A — Same Wi-Fi (e.g. your venue's network)
1. Start the app: `pnpm start:all`
2. Find your computer's local address: the terminal prints a line like
   `Network: http://192.168.x.x:3000` when the website starts.
3. Staff on the **same Wi-Fi** open that address on their phone/iPad.

*Google Sign-In does not work over Wi-Fi addresses (Google's rule). Email+password
does.*

### Option B — Anywhere on the internet (Cloudflare quick tunnel, free)
1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. In a **new** terminal window (keep the app running in the first one):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. It prints a random address like `https://random-words-here.trycloudflare.com`.
   That's your website's public link — share it with anyone.
4. For Google Sign-In through this link, you ALSO need the database public:
   run a second tunnel for `http://localhost:8090`, then update two places:
   - the `NEXT_PUBLIC_POCKETBASE_URL=` line inside `.env.local` → set it to the
     **database's** trycloudflare address (starting with `https://`), restart the app;
   - Google's "Authorized redirect URIs" → add
     `https://DATABASE-ADDRESS/api/oauth2-redirect`.

> ⚠️ The free tunnel's address **changes every time your computer restarts.**
> For a permanent address, see the "Deployment" section of the main README —
> hosting the website on Vercel (free) keeps one fixed link forever.

---

## PART 6 — Troubleshooting (plain words)

| What you see | What it means | Fix |
|---|---|---|
| `command not found: pnpm` | pnpm isn't installed | Run `npm install -g pnpm` |
| Website says "can't reach the page" | The app isn't running | Run `pnpm start:all`, wait for "Ready" |
| Login says "not authorized" | That email has no role and isn't in ADMIN_EMAILS | Part 3 — add them to a role or ADMIN_EMAILS |
| Google button says "not configured" | Google codes aren't connected | Part 4, Step 2 |
| Google says "redirect_uri_mismatch" | The address in Google Console doesn't match | Re-check Part 4 Step 1.4 — no typos, no trailing `/` |
| Google says "app not verified" / "access blocked" | Their Gmail isn't a test user | Part 4 Step 1.3 — add them as a test user |
| "Sign in with Google" picks the wrong account | Google remembered the last one | It now always shows the account picker — pick the other one |
| Setup says "port 8090 in use" | Pocketbase is already running | Fine — setup reuses it |
| Staff on same Wi-Fi can't open the address | Wrong address or different Wi-Fi | Use the `Network:` address the terminal prints; check they're on the same Wi-Fi |
| Everything suddenly broken after restart | The tunnel address changed | Re-run the tunnel command, share the new link (Part 5B) |

**Start completely fresh** (deletes ALL data — tickets, staff, everything):
stop the app, delete the `pb` folder inside the app folder, run `pnpm setup` again.

---

## The little dictionary

- **Pocketbase** — the free program that stores your data. Lives in the `pb` folder.
- **Terminal** — the typing window. Git Bash on Windows, Terminal on Mac.
- **`.env.local`** — a small settings file the setup wizard writes for you.
  Open it in any text editor (Notepad works). After changing it: stop the app,
  start again.
- **Dashboard** — the Pocketbase control panel at `http://127.0.0.1:8090/_/`.
  For looking at (or manually fixing) raw data. Use the *dashboard login*.
- **Tunnel** — a temporary bridge that lets people on the internet reach the
  website running on your computer.

---

## Quick reference card

```bash
pnpm install          # once — fetch the parts
pnpm setup            # once — database + logins + settings
pnpm start:all        # every day — start everything
pnpm start:all --prod # event day — faster version
(Ctrl+C to stop)
```

| Address | Use |
|---|---|
| http://localhost:3000 | the website |
| http://127.0.0.1:8090/_/ | database dashboard |
