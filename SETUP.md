# Entry Pass Web — Complete Setup Guide (Vercel + Pocketbase)

This guide explains how to run this app the way it's designed to run:

- **The website** lives on **Vercel** — free hosting that's always online, with a
  fixed public link like `https://your-event.vercel.app` that you share with staff.
- **The database** (tickets, staff, logins) lives on **YOUR computer**, in a free
  program called **Pocketbase**.
- A free **Cloudflare tunnel** connects the two, so Vercel can reach your computer.

No technical background needed — every step is spelled out. First-time setup takes
about 30 minutes; after that, going live every day is **one double-click**.

---

## 🙋 THE BIG QUESTIONS — read before touching anything

**Q: Do I have to deploy the website to Vercel myself?**
**No.** You never open Vercel's dashboard to deploy, never click "Deploy",
never upload anything. The `3-GO-LIVE.bat` file publishes the website for
you automatically (it creates your project AND publishes it). The only
moment Vercel needs *you* is one **Approve** click when first connecting
your account — and even that opens in your browser automatically.

**Q: Do I have to set environment variables (settings) anywhere?**
**No.** All settings are handled by the scripts — `2-SETUP.bat` writes
your local settings file, `3-GO-LIVE.bat` pushes them to your website.
You never edit settings by hand. (The ONE optional exception: adding
another admin's email — explained in PART 4.)

**Q: Do I need a copy of the app on my PC? Where does it go?**
**Yes — one folder on your PC is the whole system on your side.**
Download the ZIP from GitHub (green **Code** button → **Download ZIP** —
no GitHub account needed), right-click it → **Extract All** → put the
folder **anywhere you like**: Desktop, Documents, anywhere.
That folder becomes permanent — it holds the scripts, your database
(`pb` folder), and your backups (`backups` folder). It doesn't "install"
anywhere or move; it just lives wherever you put it. **Don't delete it.**

**Q: Do I need a GitHub account?**
**No.** Downloading the ZIP needs no account. Nothing in the setup uses
GitHub login.

**Q: What exactly lives where?**

| Where | What lives there | Who manages it |
|---|---|---|
| **Your PC** (the app folder) | database, tickets, staff, backups, all scripts | you (automatically) |
| **Vercel** (the cloud, free) | the website itself — the pages people open | `3-GO-LIVE.bat` |
| **The tunnel** (a bridge) | lets Vercel reach your PC's database | created fresh daily by the script |

**Q: Does my PC need to stay on?**
**While staff are using the app — yes** (the database is on your PC).
The public link always opens, but logins/tickets need your computer on
and the `3-GO-LIVE` window left open. Turn the PC on before the event;
at day's end, close the window.

**Q: What happens after a restart / tomorrow?**
Double-click `3-GO-LIVE.bat` again. It repairs everything and your public
link stays the same. That's the entire daily routine.

---

## ⭐ The easy way: double-click files (Windows)

Everything lives in the **`STRESS FREE INSTALLATION`** folder inside the app
folder. Open it — you'll see four numbered subfolders. Run the files in
order, just double-click, no typing:

| File (inside `STRESS FREE INSTALLATION`) | What it does | When to run it |
|---|---|---|
| **`0-CHECK-FIRST\0a-CHECK-SYSTEM.bat`** | 🔍 Checks what this computer has ([OK] / [MISSING] list) | Always the very first file |
| **`0-CHECK-FIRST\0b-INSTALL-NEEDED.bat`** | 🧰 Installs whatever 0a showed as MISSING — downloads Node.js, pnpm, the tunnel program, the Vercel tool automatically | Only if 0a showed any [MISSING] |
| **`1-FIRST-TIME-INSTALL\1-INSTALL.bat`** | Installs the app's building blocks | Once, right after the 0 folder |
| **`1-FIRST-TIME-INSTALL\2-SETUP.bat`** | Prepares the database + your logins (asks simple questions) | Once, right after 1 |
| **`2-EVERYDAY\3-GO-LIVE.bat`** | 🚀 Makes your website public. **Leave its window open** | **Every day / after any reboot** |
| **`3-OPTIONAL\4-BACKUP.bat`** | Saves all your data into a dated zip in the `backups` folder | Whenever you want a safety copy (before events!) |
| **`3-OPTIONAL\5-START-LOCAL-TEST.bat`** | Runs everything on this PC only (nothing public) | Optional — safe testing |
| **`3-OPTIONAL\6-DASHBOARD-UNLOCK.bat`** | Emergency unlock for the database dashboard | Only if locked out (PART 7) |

**The golden rule: 0 → 1 → 2 once, then 3 every day. 4 before important moments.**

> **Brand-new computer?** You can skip 0a and go straight to `0b-INSTALL-NEEDED.bat`
> — it only installs what's missing, so it's safe either way. When 0b says
> ALL INSTALLED, continue with `1-FIRST-TIME-INSTALL\1-INSTALL.bat`.

> ⚠️ If Windows shows a "Windows protected your PC" (SmartScreen) blue box when
> you double-click: click **More info** → **Run anyway**. That warning appears for
> any new script, not just this one.
>
> 💡 If your Pocketbase lives somewhere other than the `pb` folder inside this
> folder, open `.env.local` in Notepad and add a line:
> `PB_HOME=C:/path/to/your/pocketbase/folder` — all the scripts will use it.

*(Mac users: the same steps work with the terminal commands listed in each part
below — `pnpm install`, `pnpm setup`, `pnpm go:live`, `pnpm backup`.)*

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
| Vercel account | https://vercel.com → Sign up | free |
| Google account | for Google Sign-In (optional) | free |
| Node.js, pnpm, tunnel program, Vercel tool | **installed automatically** by `0b-INSTALL-NEEDED.bat` — you don't download anything yourself | free |
| The app's code | download this repo as ZIP → right-click → Extract All (or `git clone`) | — |

**You do NOT need a terminal on Windows.** Everything runs by double-clicking
the numbered files. (Mac/Linux users: the same steps work with `pnpm` commands
listed in each part.)

---

## PART 1 — Prepare the database on your computer (once, ~10 min)

1. Double-click **`STRESS FREE INSTALLATION\\1-FIRST-TIME-INSTALL\\1-INSTALL.bat`** — installs the website's building blocks
   (a window opens, waits for "DONE", closes).

2. Double-click **`STRESS FREE INSTALLATION\\1-FIRST-TIME-INSTALL\\2-SETUP.bat`** — the setup wizard. It asks simple questions
   and does everything else automatically:
   - Downloads Pocketbase into a `pb` folder (once)
   - Creates all the database tables
   - Asks you to create **two different logins** — write them down:

   | Login | Where you'll use it |
   |---|---|
   | **Dashboard login** | The Pocketbase control panel (rarely needed) |
   | **Your app login** | The website's login page (your daily login) |

   - Optionally takes your Google codes (see PART 3 — you can skip now and add later)

   *(Mac/Linux instead: `pnpm install` then `pnpm setup`.)*

   When it prints **SETUP COMPLETE**, continue.

---

## PART 2 — Put the website on Vercel and go live (once, ~2 min)

1. Open **`STRESS FREE INSTALLATION\\2-EVERYDAY`** and double-click **`3-GO-LIVE.bat`**. That's the whole step.

   **First run only:** it notices you're not connected to Vercel yet and
   starts the connection itself — your browser opens a Vercel page →
   click **Approve / Continue** → come back to the window. This click is
   needed once ever, because only you can approve your own account.
   (If the browser doesn't open by itself, the window prints an address
   to copy into your browser.)

   The window then does everything else automatically:
   - creates your Vercel project (named after this folder)
   - starts the database (if not running)
   - starts the tunnel and gets its address
   - points your Vercel website at it (updates the settings, publishes the site)
   - prints your **public link** — e.g. `https://your-project.vercel.app`
   - prints the one-line Google Sign-In setup (if you use it — see PART 3)

2. Open the public link, log in with your **app login**. Done — you're live. 🎉

**⚠️ Keep the `go:live` window open** (minimize it). It keeps the tunnel alive.
Closing it = the website can't reach the database.
**Stop everything:** click that window and press Ctrl+C.
**Computer restarted?** Just double-click `STRESS FREE INSTALLATION\\2-EVERYDAY\\3-GO-LIVE.bat` again — it repairs
everything, and the public link stays the same.

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
| Morning of the event | Double-click **`STRESS FREE INSTALLATION\\2-EVERYDAY\\3-GO-LIVE.bat`**, leave the window open, share the link |
| Computer restarted / login suddenly broken | Double-click **`STRESS FREE INSTALLATION\\2-EVERYDAY\\3-GO-LIVE.bat`** again — it repairs everything |
| End of day | Close the go-live window (or Ctrl+C) |
| Back up the data | Double-click **`STRESS FREE INSTALLATION\\3-OPTIONAL\\4-BACKUP.bat`** → dated zip in `backups` — copy it to a USB drive / cloud folder |

---

## PART 6 — Testing on your own computer (optional)

You can run everything locally without Vercel (e.g. to try things safely):

```bash
pnpm start:all        # database + website on your PC only
```
Open `http://localhost:3000` — same app, same logins, nothing public.
Only people on your Wi-Fi could reach it via the `Network:` address it prints.

---

## PART 7 — Extra protection for the database dashboard (optional, ~10 min)

By default the dashboard (`http://127.0.0.1:8090/_/`) opens with just your
dashboard password. You can add a **second lock**: after the password,
Pocketbase emails you a one-time code, and you type it to get in.
Even someone who steals your password can't get in without your email.

**How it works:** login = password → a code arrives in your email → type
the code → you're in. Adds ~10 seconds per login.

### Step 1 — Let Pocketbase send email (Gmail, free)

1. Go to **https://myaccount.google.com/security** — make sure
   **2-Step Verification** is ON for your Google account
   (it must be, for the next step to exist).
2. Open **https://myaccount.google.com/apppasswords** → name it
   `pocketbase` → **Create** → copy the **16-character password** shown.
3. Database dashboard → **Settings → SMTP**, fill:
   - Sender address: `yourname@gmail.com`
   - SMTP host: `smtp.gmail.com` · Port: `587`
   - Username: `yourname@gmail.com`
   - Password: **the 16-character app password** (not your normal one!)
   - Enable SMTP: ON → Save

   Sending Gmail→Gmail is instant and never lands in spam.

### Step 2 — Turn on the two toggles

1. Dashboard → **Collections → `_superusers` → Edit collection → Auth tab**
2. Enable **OTP** and enable **MFA** (defaults are fine)
3. Log out, log back in: password → code arrives in Gmail → you're in.

### If you get locked out (emergency unlock)

**Forgot the password, email still works** → double-click
**`STRESS FREE INSTALLATION\\3-OPTIONAL\\6-DASHBOARD-UNLOCK.bat`**. It resets the dashboard password to a
temporary one (shown in its window) and restarts the database. Sign in
with it + the emailed code, then set your own password.

**Email codes broken (Gmail/app password problem)** → the email code
cannot be bypassed — that's the security doing its job. Recover from
your latest backup instead:
1. Close the go-live window (stops the database)
2. Unzip your newest `backups\entry-pass-*.zip`
3. Replace the `pb\pb_data` folder with the one from the zip
4. Run `STRESS FREE INSTALLATION\\2-EVERYDAY\\3-GO-LIVE.bat` — sign in with the password that was valid at
   backup time
5. Fix Settings → SMTP (fresh Gmail app password) before re-enabling
   anything

> This is also why `STRESS FREE INSTALLATION\\3-OPTIONAL\\4-BACKUP.bat` before enabling protection is a good
> habit: the backup is your no-email way back in.

> Note: Google can auto-retire app passwords (e.g. after you change your
> Google password). If codes stop arriving someday, generate a fresh app
> password at the same link and update Settings → SMTP — 2-minute fix.

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

```
DOUBLE-CLICK (Windows)                  or type in a terminal
------------------------------------    ---------------------------
0-CHECK-FIRST\0a-CHECK-SYSTEM.bat       (checks everything)
0-CHECK-FIRST\0b-INSTALL-NEEDED.bat     (installs anything missing)
1-FIRST-TIME\1-INSTALL.bat    (once)     pnpm install
1-FIRST-TIME\2-SETUP.bat      (once)     pnpm setup
2-EVERYDAY\3-GO-LIVE.bat      (daily)    pnpm go:live   ← keep open
3-OPTIONAL\4-BACKUP.bat       (safety)   pnpm backup
3-OPTIONAL\5-START-LOCAL-TEST (optional) pnpm start:all

Plus ONE TIME:  vercel login   (one command + one click
in your browser — SETUP.md Part 2)
```

| Address | What |
|---|---|
| your `*.vercel.app` link | the website (from `pnpm go:live`) |
| http://127.0.0.1:8090/_/ | database dashboard (this computer only) |
| http://localhost:3000 | local test website |
