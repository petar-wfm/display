# West Falmouth Market — Deli Counter Board

A self-running slide deck for the deli counter's customer-facing TV. Built from
`West_Falmouth_Market_Deli_Menu_Menu_.csv` and styled from `LogoGuidelines.pdf`
(navy `#0C233F`, Playfair Display headlines, Montserrat body text).

## What's in this folder
```
index.html          the board itself (what the TV shows)
styles.css           board styling
app.js               slide logic, daypart rules, fullscreen/kiosk handling
admin.html           the management panel — edit the board from any browser
admin.css            management panel styling
admin.js             management panel logic
functions/api/board.js   the server-side storage (Cloudflare Pages Function)
data.js              the built-in default menu — categories, items, prices, promos, settings
assets/logo.png      your logo file
assets/images/       drop your own category photos here (see below)
```

## 1. Deploy to Cloudflare Pages
1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Upload assets**.
2. Give it a project name (e.g. `wfm-deli-board`).
3. Drag this whole folder in (or a zip of it) and deploy.
4. Cloudflare gives you a URL like `wfm-deli-board.pages.dev` — that's what you'll point the TV at.
   You can later add a custom subdomain (e.g. `deli.westfalmouthmarket.com`) under the project's
   **Custom domains** tab if you want.
5. Any time you edit `data.js` (or add photos) and re-upload, the live board updates for everyone.

## 2. Run it on the Samsung TV / Android box
The board is just a webpage, so the Android box needs a browser that can:
- open automatically on boot
- stay full-screen with no address bar
- reload if the network hiccups

Two easy paths:
- **Fully Kiosk Browser** (free tier is fine) — install from the Play Store on the Android box,
  set the Start URL to your `pages.dev` link, turn on "Start on boot" and "Screensaver disabled."
  This is the most reliable option for a TV that runs all day, since Fully Kiosk forces true
  fullscreen itself and doesn't depend on the page asking for it.
- **Chrome** (including old Android 5 devices) — open the link in Chrome. The page now asks
  the browser for fullscreen itself: on first load you'll see a "Tap anywhere to start the
  display" screen — tap it once and the board expands to fill the whole screen, address bar and
  all, and stays that way. This is a one-time tap per boot/reload, because mobile Chrome (even
  old versions on Android 5) only allows a page to go fullscreen right after a real tap, as an
  anti-annoyance rule — there's no way for the page to skip that first tap on its own. After that
  tap, if Chrome ever drops out of fullscreen (e.g. after a reload), the same "tap to start"
  screen quietly reappears so a passing employee can tap it again.
  For a completely hands-off boot (no tap needed at all, ever), Fully Kiosk Browser above is the
  more reliable choice for an unattended TV.

Either way, leave the box's screensaver/sleep settings off so the TV doesn't blank the page.

## 3. Add your own photos
Each category can show a photo. Just export/save your photos with these exact filenames and
drop them into `assets/images/` (then re-upload the folder to Cloudflare):

| Category | Filename |
|---|---|
| Breakfast | `assets/images/breakfast.jpg` |
| Cold Sandwiches | `assets/images/cold-sandwiches.jpg` |
| Hot Sandwiches | `assets/images/hot-sandwiches.jpg` |
| Signature | `assets/images/signature.jpg` |
| Burgers | `assets/images/burgers.jpg` |
| New York Deli | `assets/images/new-york-deli.jpg` |
| Kids | `assets/images/kids.jpg` |

If a photo isn't there yet, that slide just uses the navy brand background — nothing breaks.
Landscape photos around 1600×1000px work best. Categories with a handful of items (Signature,
Kids, New York Deli) show the photo big, next to the items; busy categories (Hot Sandwiches,
Cold Sandwiches) use it as a soft full-bleed background behind the grid.

## 4. Breakfast / lunch daypart logic
The Breakfast slide only appears in the rotation between the hours set in `data.js` →
`settings.daypart` (default: 7:00–11:00am Mon–Sat, 7:00–12:00pm Sunday). The board re-checks the
clock once a minute, so breakfast quietly drops off the rotation right on schedule without
anyone touching it. You can change the hours, or turn this off entirely, from the gear icon →
Settings tab, or by editing `data.js` directly.

## 5. The management panel (admin.html) — one setup step required
Editing now happens on its own page, `admin.html`, reachable from **any** phone, tablet, or
computer browser — not just the TV. Whatever you save there shows up on every screen running
`index.html` within a few minutes, because both pages read/write one shared file on the server
instead of each browser's own local storage.

This needs a small one-time setup in Cloudflare, since a static Pages site has nowhere to save
files by default:

1. In the Cloudflare dashboard, go to **Workers & Pages → KV** and create a namespace — call it
   something like `wfm-deli-board`.
2. Open your Pages project → **Settings → Functions → KV namespace bindings → Add binding**:
   - Variable name: `BOARD_KV`
   - KV namespace: the one you just created
3. Still in Settings, go to **Environment variables** and add a **secret** named `ADMIN_PASSWORD`
   set to whatever password your staff should use to save changes (reading the board doesn't need
   a password — only saving edits from `admin.html` does).
4. Redeploy the Pages project (re-upload the folder, or trigger a redeploy) so the binding and
   variable take effect.
5. Visit `yoursite.pages.dev/admin.html`, enter the password, and start editing. The board itself
   (`index.html`) automatically re-checks the server every few minutes, so a TV showing the board
   doesn't need to be touched or reloaded for a change to appear.

Until this is set up, `admin.html` will show a "server storage isn't set up yet" message, and
every screen just falls back to showing the built-in menu baked into `data.js` — nothing breaks,
it just can't be edited remotely yet.

**Permanent baseline changes** (a full menu overhaul, new default photos, etc.) can still be made
by editing `data.js` directly and redeploying — that's the fallback every screen uses before any
admin edits are saved, and what "Reset to built-in defaults" in the Backup tab restores.

## 6. Promos
Two kinds, both added from `admin.html` → Promos tab:
- **Ribbon** — a small hanging flag shown in the corner of every slide. Good for short one-liners.
- **Full slide** — gets its own turn in the rotation, shown every few category slides (adjustable
  in Settings). Good for a bigger announcement with more detail.
