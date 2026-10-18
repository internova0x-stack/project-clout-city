# Clout City

Mobile-first browser life game: arrive in New York as a nobody and chase clout.

**Current version: v0.14 "On Air"** (v0.1 to v0.13 are done; v1.0 "Launch" is next) (see `docs/07-milestones-and-versions.md`).

## Read first
- `docs/testing-feedback.md`: decisions and fixes from the Oct 13 testing round. **Wins over the older docs.**
- `docs/08-new-features-spec.md`: hunts, News, the cast and NPCs, the Astoria neighborhood, travel and groceries, Lucky Star Lotto, neighborhood gossip, and v0.11's content automation, exclusive events update and interface changes (sections 9 to 11), the modeled avatars and Shop outfits (section 12), bigger homes and venues, including the clubs' restroom and VIP floors (section 13), meeting players at every place, with 20 messages a day and unlimited chat (section 14), v0.12's player ranks and businesses (section 15), v0.13's together bonuses and Jobs board (section 16), v0.14's Real Clout FM and Clout TV (section 17) and the proposed v0.15 campus life (section 18). **Wins over the older docs** for those features.
- `docs/HUNTS.md`: weekly treasure hunts: how they play, writing a week file, approving in the Studio.
- `docs/WEEKLY-CONTENT.md`: the weekly drafting routine (hunt, news and gossip), the Studio Calendar and the approval loop.
- `docs/CAST.md`: the recurring cast (celebrities, wannabes, regulars at places). Every name invented.
- `docs/01-game-concept-note.md`: the big picture.
- `docs/02-clarifications-and-updates-v2.md`: game rules and P1 scope. **Wins on rules.**
- `docs/03-world-state-layer-brief-v2.md`: story engine. **Wins on the World State layer.**
- `docs/05-design-system-guide-v2.md`: UI tokens and components C1 to C42.
- `docs/07-milestones-and-versions.md`: what ships in which version. Build only the
  current version's "In scope" list; anything else gets a "Coming soon" card.
- `docs/SETUP.md`: Supabase, email template and Vercel setup.
- `docs/STORIES.md`: adding, approving, scheduling and pausing stories in the Story Studio (`/studio`).

## Stack
Next.js 16 (App Router, `proxy.ts` instead of middleware), React 19, Supabase
(auth + Postgres), three.js for the avatar, Vercel. No UI framework: tokens and
components live in `app/globals.css`.

## Commands
- `npm run dev`: local server. Without Supabase env vars the guest map works and
  sign-up says accounts aren't on yet. `/preview/guest|creator|home` show screens
  with sample data (development only, 404 in production).
- `npm run typecheck`, `npm test` (Node's built-in test runner, `tests/*.test.ts`),
  `npm run build`.
- `npm run test:db`: runs every migration on a throwaway local Postgres (needs the
  Postgres 16 binaries) and the SQL scenario tests in `supabase/tests/`
  (`ONLY=$PWD/supabase/tests/dating.test.sql npm run test:db` runs one).
- `/preview/creator?step=0-3` and `/preview/home?state=new` walk the creator and the
  first session with sample data (development only). `/preview/home` runs the city on an
  in-memory simulator (`lib/citySim.ts`); `?city=off` shows the home screen before migration 0004;
  `?story=3` starts the Sarah Bird story on Day 3; `?dating=match|invite|tonight|alone` starts crushes and
  date nights in that state; `?crew=invite|tonight|full|empty` does the same for crew outings;
  `?hunt=new|joined|question|wrong|finale|done` for the treasure hunt; `?lotto=win|big|back|lose` sets the next scratch cards' results and `?lotto=jackpot` makes the next card win its pot; `?gossip=new|some|almost|done` starts the Tea app in that state; `?chat=out` starts with today's 20 messages used (the unlimited chat offer); `?crowd=50` puts 50 sample players at any place you enter; `?biz=some|rich|public` starts with businesses (rich: the whole ladder, ready to go public); `?rankup=1-10` opens that rank's rank-up reveal; `?together=invite|ride|plan|bonus|decorate|approve` starts v0.13's together plans, ride requests, the bonus card, decorating someone's home or approving a decorator; `?radio=new|sent|full|notpicked|mine` starts Real Clout FM in that state (shared with the Studio preview's Shoutouts tab); `?tv=new|sent|mine|empty` does the same for Clout TV (shared with the Big Screen tab). Sample players stand at every place in the preview. `/preview/studio` shows the Story Studio.
- `npm run validate:stories`: checks every file in `content/stories/`.
- `npm run validate:content`: checks every hunt, news and gossip week file in `content/` (the Studio's rules).

## Rules for this codebase
- Player data is permanent from day one: change the schema only with a new file in
  `supabase/migrations/`, never by editing an applied one.
- Writes to `players`/`invites` go through security-definer SQL functions; RLS
  blocks direct writes.
- Tunable numbers live in `lib/config.ts` (client) and `game_settings` (economy, in the
  database, mirrored by `lib/economy.ts` and checked by `tests/economy.test.ts`). City content
  (places, events, gigs, Shop) lives in `lib/city.ts`; its database seed is generated by
  `scripts/gen-city-seed.ts` and checked by `tests/city.test.ts`.
- Hardening (migration 0049): helpers the browser shouldn't call are revoked from `public, anon, authenticated`
  (Supabase grants new functions to `authenticated`; the test stub does too). Dev tools need a Studio admin.
  Invites pay at once for the first 5 friends, then when a friend comes back a second day.
- Every cash and clout change writes a `ledger` row, unique per (player, currency, kind, ref),
  so rewards pay once and refunds can take back exactly what was given.
- Game data stores real lat/lng (`lib/map/geo.ts`); the map is swappable behind
  the `MapApi` interface in `components/map/CityMap.tsx`.
- Gold (`--gold-*`, `--g-gold`) is only for real-money products. The logo is the neon "Clout City" wordmark
  (`.studio-mark`, the `--g-neon` gradient) on the sign-in card, the Studio and the app icons (owner, Oct 14).
- Real money: only the Stripe webhook (`app/api/stripe/webhook`, service role) grants or revokes
  entitlements, idempotent per Stripe event; `has_entitlement(player, sku)` is the single gate.
  Prices live in `store_products` (or Stripe), never in code. Real money never buys virtual cash.
  VIP (migrations 0047, 0051, 0052: $4.99 a month, $39.99 a year; "chat forever" $119.99 is chat only) is the only
  subscription: the monthly and yearly entitlements follow the Stripe subscription (`payment_subscription`).
  `chat_unlimited(player)` is the chat check; `has_entitlement` also unlocks every side story for a VIP (`vip_member`).
- Insights (migration 0053): `admin_insights()` is the Studio's numbers (admin only). Sessions come from
  `session_ping()` (GameShell, every `GAME_CONFIG.sessionPingMs`); VIP renewals from the webhook's `invoice.paid`
  (`payment_renewal`). Revenue counts paid, unrefunded purchases plus renewals.
- Studio Players (migration 0055): `admin_players()`, `admin_player()` and `admin_player_ban()` (admins only) list
  players, show a profile and activity timeline (ledger, purchases, reports, admin actions) and ban/unban with a
  reason logged in `admin_actions`. Message texts never appear there (only counts); reported chats stay in Reports.
- Skills (migration 0056, owner Oct 16): nine skills, 0 to 10 (`lib/skills.ts` mirrors the practice table). Practice
  comes from triggers on `ledger`, `messages` and cooking, once per thing (`skill_log`); rust is worked out on read
  (`skill_effective`); a new best level pays 10 × level clout once (ledger 'skill'), and 5 and 10 earn a badge.
- Clout TV (migration 0058): player photos live in the private `big-screen` storage bucket, uploaded from the
  browser into the player's own folder after cropping to 1080 × 1350; storage policies decide who can read one
  (its player, Studio admins, everyone once it has been on screen). The server decides what's on screen
  (`tv_current()`, the 3-hour rotation); the browser never picks it.
- Players see "Crew" for their invited friends; code, types and database tables still say `clique`
  (renaming stored data isn't worth the risk). Keep player-facing copy on "crew".
- No real brand names; businesses are invented. One exception (owner, Oct 16): Real Clout FM and Clout TV ask
  for the player's Instagram handle by name (v0.14). Copy is satirical and never
  promises features that aren't built.
- Lucky Star Lotto: the server draws every card's prize at purchase and pays it on scratch
  (`buy_lotto_card`/`scratch_lotto_card`, migrations 0032 and 0041: the prize, the pot win and the card's numbers); the browser only names a game. Never send
  a result, price or limit from the client, and real money never touches the lotto.
- Story content lives in `content/stories/*.json` and is read only on the server or by the
  Studio (answers must never reach a player's bundle); players get `story_feed()`. Hunts are the
  same: `content/hunts/*.json` carries answers; players get `hunt_state()`. Gossip too: `content/gossip/*.json`
  holds every piece and goes live on its own (`lib/gossipImport.ts`); players get only what they've found.
- Modules imported by tests use explicit `.ts` extensions for their own imports.
