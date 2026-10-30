# Clout City on Steam

Owner, Oct 30: "I want to publish to Steam". Three steps:

1. **Desktop mode** (done, PR #199): from 900 × 560 px the game fills the window (CLAUDE.md "Desktop mode").
2. **The Steam app and Steam sign-in** (this doc): `desktop/`, migration 0133, `/api/steam/session`.
3. **Steam checkout** (next): one-time real-money items through Steam's own checkout (Steam doesn't allow Stripe inside
   a Steam game). VIP comes later: Steam subscriptions need Valve's approval.

## How it works

- **The app is a window around the live site.** `desktop/` is an Electron app that opens `https://cloutcity.app/` (set
  in `desktop/steam.json`). The game isn't bundled, so every site deploy reaches Steam players at once. A new Steam
  build is only needed when `desktop/` itself changes.
- **Steam sign-in.**
  1. The Steam client gives the app a Web API ticket (`desktop/main.js`, identity `cloutcity`).
  2. The start page (`components/SteamBridge.tsx`, only inside the app) posts the ticket to `/api/steam/session`.
  3. The server checks the ticket with Steam (`lib/steam.ts`, publisher key) and signs the window in. It uses the account
     linked to that Steam ID (`steam_accounts`), or makes a new one with a placeholder address that is never mailed.
  4. A new player then goes through the creator, which asks for the date of birth because sign-up didn't.
- **Players who already play on the web:**
  1. Inside the Steam app, they Log out, then sign in with their email.
  2. The start page links their Steam ID to that account, so later launches sign them straight in.
  3. If the Steam app had already made an account for them with no character, the link moves over. An account with a
     character keeps its link (the player is told it's taken).
- **Log out inside the app** goes to `/?bye=1`. That page waits for **Continue with Steam** instead of signing straight
  back in, so a player can choose email.
- **What the app can reach:** links to other sites open in the player's browser. The page only reaches Steam through
  `window.cloutSteam` (`ticket()`, `name()`). F11 toggles fullscreen. Shift+Tab opens the Steam overlay.

## What the owner sets up (once)

1. **Steamworks account:** partner.steamgames.com. Pay the app fee and fill in the bank and tax forms.
2. **Create the app:** note its **App ID**.
3. **App ID in two places:**
   - `desktop/steam.json` (`appId`; 480 is Valve's test app).
   - Vercel: `STEAM_APP_ID`.
4. **Publisher Web API key:** create one (docs/SETUP.md 2h) and put it in Vercel as `STEAM_WEB_API_KEY`.
5. **Migration:** run `0133_steam_accounts.sql`.
6. **Store page:** description, screenshots and capsules, "Free to Play", and the content survey. The game is 18+ satire
   with a virtual-currency scratch card. No real money touches the lotto, so say that in the survey.

## Building the app (desktop/README.md has the commands)

1. **Install:** `cd desktop && npm install`.
2. **Steam libraries:** copy them from the Steamworks SDK (`sdk/redistributable_bin/`) into `desktop/redist/`. They are
   never committed.
   - Windows: `win64/steam_api64.dll` into `desktop/redist/win64/`.
   - Mac: `osx/libsteam_api.dylib` into `desktop/redist/osx/`.
3. **Build:** `npm run build:win` (or `build:mac`, `build:linux`). The app lands in `desktop/dist/*-unpacked` (Mac:
   `dist/mac`).
4. **Upload:** use SteamPipe (the Steamworks SDK's `ContentBuilder`, or the Steamworks web uploader for a zip).
   - Point the depot at that folder.
   - Set the launch option to `CloutCity.exe` (Windows), `Clout City.app` (Mac) or `CloutCity` (Linux).
5. **Mac only:** Steam needs the Mac app signed and notarized with an Apple Developer account. Ship Windows first if that
   isn't ready.

## Trying it before Steam is set up

- Run `cd desktop && CLOUT_CITY_URL=http://localhost:3000/ npm start` against `npm run dev`. The window opens the game.
- With Steam closed, sign-in shows "Steam sign-in didn't work" (no ticket).
- With Steam open, logged in, and `STEAM_APP_ID=480` plus a key that matches, sign-in runs against Valve's test app.
