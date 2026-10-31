# Clout City

Mobile-first browser life game: arrive in New York as a nobody and chase clout.

**Current version: v0.15 "Campus"** (v0.1 to v0.15 are done, with daily tasks 2.0, push notifications and Membership & purchases; v1.0 "Launch" is next) (see `docs/07-milestones-and-versions.md`).

## Read first
- `docs/testing-feedback.md`: decisions and fixes from the Oct 13 testing round. **Wins over the older docs.**
- `docs/08-new-features-spec.md`: hunts, News, the cast and NPCs, the Astoria neighborhood, travel and groceries, Lucky Star Lotto, neighborhood gossip, and v0.11's content automation, exclusive events update and interface changes (sections 9 to 11), the modeled avatars and Shop outfits (section 12), bigger homes and venues, including the clubs' restroom and VIP floors (section 13), meeting players at every place, with 20 messages a day and unlimited chat (section 14), v0.12's player ranks and businesses (section 15), v0.13's together bonuses and Jobs board (section 16), v0.14's Real Clout FM and Clout TV (section 17), v0.15's campus life (section 18), daily tasks 2.0: goals, streaks and guest-list passes (section 19), push notifications (section 20), the creator affiliates and UGC engine (section 21), skill perks (section 22) and careers (section 30). **Wins over the older docs** for those features.
- `docs/culture/README.md`: the culture packs C1 to C6 (NYC food, slang, transit, events, characters), their status and
  the owner's Oct 20 decisions; `docs/culture/VOICE.md` holds the voice rules for every character and generated line.
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
- `docs/CAMPAIGN-MODE.md`: Campaign Mode (spec v0.5; the 4-week test build is in, migrations 0127 and 0128): the player manages one of four challengers' campaigns
  against Mayor Papa-Dani; his campaign voice rules are in `docs/CAST.md`.
- `docs/CREATORS.md`: the creator program end to end: adding creators, links, sign-up credit, commissions, the
  creator page, payouts and video tracking.

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
  `?story=3` starts the Sarah Bird story on Day 3 (`&arc=diss-and-tell` runs another main story); `?dating=match|invite|tonight|alone` starts crushes and
  date nights in that state; `?crew=invite|tonight|full|empty` does the same for crew outings;
  `?hunt=new|joined|question|wrong|finale|done` for the treasure hunt; `?lotto=win|big|back|lose` sets the next scratch cards' results and `?lotto=jackpot` makes the next card win its pot; `?gossip=new|some|almost|done` starts the Tea app in that state; `?chat=out` starts with today's 20 messages used (the unlimited chat offer); `?crowd=50` puts 50 sample players at any place you enter; `?biz=some|rich|public` starts with businesses (rich: the whole ladder, ready to go public); `?rankup=1-10` opens that rank's rank-up reveal; `?together=invite|ride|plan|bonus|decorate|approve` starts v0.13's together plans, ride requests, the bonus card, decorating someone's home or approving a decorator; `?radio=new|sent|full|notpicked|mine` starts Real Clout FM in that state (shared with the Studio preview's Shoutouts tab); `?tv=new|sent|mine|empty` does the same for Clout TV (shared with the Big Screen tab). `?goals=new|streak|pass|tonight|chapter` starts goals and streaks (`day3|day7|day14|goaldone` open a reveal); `?campus=new|pick|week|friday|done` starts campus life (v0.15) standing at St. Johnsons (open its card's Campus life); `?hint=daily` shows Lola's daily-tasks nudge after 2 seconds; `?push=ask` shows Lola's notifications ask (`?push=on` starts with a device on); `?member=vip|monthly|cancelling|pastdue|forever|free|none` sets Membership & purchases (Settings' top row, the profile's VIP line); `?transit=showtime` puts showtime dancers on every subway ride and `?transit=pass` starts with an OMG Card (the preview's News always has a live 7-train delay, C4); `?mayor=new|reply` starts the Mayor app with no letters, or with a reply waiting; `?calendar=today` moves every calendar event to now and `?calendar=gift` does that with a gift box in hand (C5); `?skills=pro` starts with high skill levels (skill gigs, invites and Dance's club access open; preview skill gigs finish in 8 seconds). Sample players stand at every place in the preview. `/preview/studio` shows the Story Studio (its Affiliates tab runs on sample creators); `/preview/guest?via=tasha` shows a guest who followed a creator's link (`?via=tasha-signup` lands on sign-up); `/preview/affiliate` shows the creator page (`?state=new|paused`).
  `/preview/moves` shows every move on the new avatar bodies (`?skin`, `?build`; `?outfit=hoodie&size=460` for the hoodie); `?graphics=low` and `?bodies=new` work on any screen.
- `npm run validate:stories`: checks every file in `content/stories/`.
- `npm run validate:content`: checks every hunt, news, gossip and exam week file in `content/` (the Studio's rules).

## Rules for this codebase
- Player data is permanent from day one: change the schema only with a new file in
  `supabase/migrations/`, never by editing an applied one. Every new migration gets a row in
  `scripts/migration-status.sql` (the read-only "which have run" check; `tests/migrationStatus.test.ts` enforces it):
  something only that file leaves behind, tested false before it and true after it (`npm run test:db`).
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
  the `MapApi` interface in `components/map/types.ts`.
- Gold (`--gold-*`, `--g-gold`) is only for real-money products. The logo is the neon "Clout City" wordmark
  (`.studio-mark`, the `--g-neon` gradient) on the sign-in card, the Studio and the app icons (owner, Oct 14).
- Creators (migration 0087, spec section 21, step 1 of 5): admins make creators (rate 20% default, 30% high performer,
  0 to 50; length 12, 24 months or life) and `/c/<slug>` links in Studio → Affiliates; links are retired, never deleted.
  `app/c/[slug]` counts the click (`creator_link`, service role, a daily count per link) and keeps the slug 30 days in
  `cc_creator`; sign-up carries it (or a typed creator code) and `createPlayer` calls `creator_attach`, which fixes the
  attribution once (`creator_referrals`, first creator wins, never the creator's own email, new accounts only) and pays
  the in-game welcome gift (ledger 'creator_welcome': C$ and a Shop fashion item).
  Step 2 (migration 0088): the webhook writes `creator_commissions` for a referred player's purchase or renewal inside
  their window (once per payment, on net: price − Stripe fee − tax, at the creator's rate that day); `charge.refunded`
  (full or partial) adds proportional reversals. Held/payable/paid are worked out on read (`payable_on` = +45 days,
  `paid_at`). Studio: Overview, money columns and each affiliate's page (`admin_affiliates_overview`, `admin_creator`).
  Step 3 (migration 0089): `/creator` is the creator's own page (`creator_me()`, matched on the signed-in email; counts
  only, never player names); `StudioSignIn` serves it (`dest="/creator"`, `afterSignIn` knows both destinations).
  Step 4 (migration 0090): payouts by hand (`creator_payouts`; `admin_payout_mark` pays everything payable for a creator
  in one row, $50 minimum unless overridden; `admin_payout_void` undoes with a reason; never bank details).
  Step 5 (migration 0091): `creator_videos` (fee, post date, optional link); `admin_creator_videos()` gives results per
  video link and each creator's spend vs. results. How-to for the team: `docs/CREATORS.md`.
- Real money: only the Stripe webhook (`app/api/stripe/webhook`, service role) grants or revokes
  entitlements, idempotent per Stripe event; `has_entitlement(player, sku)` is the single gate.
  Prices live in `store_products` (or Stripe), never in code. Real money never buys virtual cash.
  VIP (migrations 0047, 0051, 0052: $4.99 a month, $39.99 a year; "chat forever" $119.99 is chat only) is the only
  subscription: the monthly and yearly entitlements follow the Stripe subscription (`payment_subscription`).
  `chat_unlimited(player)` is the chat check; `has_entitlement` also unlocks every side story for a VIP (`vip_member`).
  Membership & purchases (migration 0079): `membership_state()` is the player's screen (no Stripe ids); the server
  (`app/home/membershipActions.ts`) reads the renewal date and cancel/payment status live from Stripe and opens the
  billing portal for the customer in `stripe_customers` (saved by the webhook, server only). Cancelling runs to the
  end of the paid period (owner, Oct 18).
  Chargebacks (migration 0125, owner Oct 27): `charge.dispute.created`/`closed` → `payment_dispute` (`payment_disputes`,
  service role). Open: recorded only. Lost: `payment_refund` under `<event>:lost`, the creator's commission reversed, and
  for a VIP charge (no purchase matches; player found by the charge's customer) the webhook cancels their subscriptions.
  Won or closed otherwise: nothing changes.
  EU/UK withdrawal (owner, Oct 27): every Checkout Session requires the buyer's tick (`consent_collection.terms_of_service`,
  `withdrawalText` in lib/stripe.ts: delivered at once, the 14-day right ends); without the Terms URL in Stripe's public details
  it falls back to the same words by the pay button (`consent: "notice"`).
- Insights (migration 0053): `admin_insights()` is the Studio's numbers (admin only). Sessions come from
  `session_ping()` (GameShell, every `GAME_CONFIG.sessionPingMs`); VIP renewals from the webhook's `invoice.paid`
  (`payment_renewal`). Revenue counts paid, unrefunded purchases plus renewals.
- Studio Players (migration 0055): `admin_players()`, `admin_player()` and `admin_player_ban()` (admins only) list
  players, show a profile and activity timeline (ledger, purchases, reports, admin actions) and ban/unban with a
  reason logged in `admin_actions`. Message texts never appear there (only counts); reported chats stay in Reports.
- Skills (migration 0056, owner Oct 16): nine skills, 0 to 10 (`lib/skills.ts` mirrors the practice table). Practice
  comes from triggers on `ledger`, `messages` and cooking, once per thing (`skill_log`); rust is worked out on read
  (`skill_effective`); a new best level pays 10 × level clout once (ledger 'skill'), and 5 and 10 earn a badge.
  Skill perks (migration 0092, owner Oct 19, spec section 22): `SKILL_PERKS` (lib/skills.ts, copied to game_settings
  'skill_perks', checked by tests/skills.test.ts) opens a gig, invite or access at levels 3, 6 and 9, by the level now
  (`skill_now`, rust counts). Skill gigs: once a week each, one gig at a time with the board (`skill_gig_take/collect`,
  ledger 'skill_gig'); invites pay clout once (`skill_invite_accept`, ledger 'skill_invite', badge "perk-<id>" at 9);
  Dance 3 passes every club door (`travel`, `use_guest_pass`), Dance 9 opens every VIP floor (`vip_access` = 'skill').
- Clout TV (migration 0058): player photos live in the private `big-screen` storage bucket, uploaded from the
  browser into the player's own folder after cropping to 1080 × 1350; storage policies decide who can read one
  (its player, Studio admins, everyone once it has been on screen). The server decides what's on screen
  (`tv_current()`, the 3-hour rotation); the browser never picks it.
- Campus (migration 0072, v0.15): students enrol at one of the two Queens campuses; `campus_*` functions do classes,
  exams, the dining hall and the leaderboard. Exam answers live only in `campus_questions` (no browser access); players
  get the questions without answers. Dorms are homes with a `campus` field: students only, never an eviction target.
  Campus areas (migration 0075) are the campus place's floors (`CAMPUS_AREAS`: Quad 1, Lecture Hall 2, Library 3,
  Dining Hall 4, Greek Row 5). Events may carry `days` (ISO weekdays, New York): `attend_event` and the task list
  honour them (Greek Row party night: Tue, Thu, Fri, Sat). Migration 0076: students' "Go to class" task (kind 'class',
  done by `campus_attend`) and free study dates (`date_target` treats a campus as a date spot at C$0). Exam weeks
  (migration 0077) live in `content/exams/<Monday>.json` with answers (server and scripts only, `lib/exams.ts`);
  the game stores them with `content_import_exams`, locking a course once someone has sat it.
- Daily tasks 2.0 (migrations 0073, 0074, spec section 19): the goal ladder is data (`GOALS.ladder`: 25 goals, each
  unlocked at a rank's clout, with a `check` the server's `goal_list` reads); five tasks = 1 gossip, 2 goal-linked (the game's suggested goal,
  `goal_current`), 1 skill, 1 random. Goal rewards pay once (ledger 'goal'); a streak of all-five days (one missed day a
  week forgiven) pays clout, reward-only furniture (`reward: true`, never sold or sellable) and guest-list passes
  (`use_guest_pass`: one night past a club door or onto a VIP floor; `travel` and `vip_access` accept it).
- Push notifications (migration 0078, owner Oct 18: push only): game events only add rows with `push_enqueue`
  (one per dedupe key, only for players with a device); `lib/pushServer.ts` (run by `/api/push/run` with `CRON_SECRET`, and
  nudged by game traffic) applies `lib/push.ts`: tier score + deadline urgency + close-person bonus − fatigue, merging by
  group, 4 a day plus chat, 15 min apart (chat 10), quiet 10 PM to 9 AM local, expiry, the morning roundup for news, no
  push while in the game. `public/sw.js` only shows pushes (no caching). VAPID keys in env (docs/SETUP.md 2d).
  Step 2 (migration 0082): P0 pushes come from row triggers (`push_on_*`, which swallow their own errors), P1 from
  `push_scan()` (service role, run by the sender first; one push per key). Taps open `/home?open=<screen>`.
  Step 3 (migration 0083): rewards from ledger/rank triggers, on air and on screen and the P3 morning roundup and
  win-back from `push_scan()` (`push_scan_rewards`, `push_roundup`; P3 only for players not in the game today).
  Migration 0084: date tonight, crew there, party night and guest pass tonight (`push_on_crew_went`, `push_scan_tonight`;
  real New York evening, since the city clock loops every two hours).
  Rent alarm (migration 0112, owner Oct 22): rent due within 3 days and too little in the bank sends 'rent_short' once per
  rent date (`push_scan_rent_short`, run by the sender after push_scan, opens Gigs); in the game, `rentAlert()` (lib/cityState.ts)
  shows a card on the home screen (short, late, eviction countdown; Find a gig / Bills) and turns the Bills button's pin into a ❗ (the bank pill stays the balance)
  (`?rent=short|late|evict` in the preview).
- HUD entry points (owner, Oct 23): the task counter (1/5) is the way into Tasks (Daily, Goals, Hunt) and its
  pin pulses until the day's tasks are opened; the side column's Tasks button is Skills (`SkillsSheet`, components/game/Skills.tsx:
  today's skill task on top, then every skill; pinned when a perk is ready). The skill task links back ("See skills ›").
- Loading (owner, Oct 23-24): the launch splash `AppLoading` is `/`'s Suspense fallback only (no loading.tsx, so Continue
  keeps the welcome screen and its spinner up until the game is ready); it shows at once and `SplashHold` keeps it up
  `GAME_CONFIG.splashMinMs` (2.2 s) from launch (owner, Oct 28: the poster `public/loading-poster.webp`, wordmark and line in
  the picture, a little wider than tall phones so the title keeps its margins; spinner pill and Mayor Papa-Dani's tips from
  `lib/loadingTips.ts` over the cast); Continue spins.
  iPhone launch images are `public/splash/` (lib/launchImages.ts; regenerate with `npm run build:launch-images` on a running
  dev server after changing the loader; `/preview/loading?still=1` is what they show).
- Desktop mode (owner, Oct 30; step 1 of Steam): from 900 × 560 px the game fills the window instead of the phone frame
  (globals.css "Desktop mode"): the bottom bar and sheets keep a phone width in the middle, sheets float above the bottom
  edge, and the creator and the demo's pick put the avatar beside its panel (`.creator-main`). 600 to 900 px keeps the frame.
- Steam (owner, Oct 30; docs/STEAM.md): `desktop/` is the Steam app (Electron + steamworks.js; a window around the live site,
  `desktop/steam.json` holds the App ID and address; built with electron-builder, uploaded with SteamPipe). Steam sign-in
  (migration 0133): the app's `window.cloutSteam.ticket()` → `components/SteamBridge.tsx` on `/` → `/api/steam/session`,
  which checks the ticket with Steam (lib/steam.ts, env `STEAM_APP_ID`, `STEAM_WEB_API_KEY`) and signs in the account in
  `steam_accounts` (or makes one, `steam-<id>@users.cloutcity.app`, never mailed); signed in with email inside the app, it
  links instead. `/?bye=1` waits for "Continue with Steam". Steam checkout (migration 0134, app/home/steamStoreActions.ts):
  in the app only (user agent `CloutCitySteam/`; Stripe refuses there, Steam refuses on the web): `start_purchase` with
  session `steam:<order>`, `InitTxn` in the wallet currency (game_settings 'steam_store' rates), the app relays Steam's
  answer (`cloutSteam.authorized`), `FinalizeTxn` then `payment_grant`. One-time items only (VIP later); refunds by hand.
- Fewer server checks (owner, Oct 30; lib/live.ts): polls use `everyVisible` (paused while the game is off screen, one
  catch-up when it's back), never a bare setInterval. Chat, party rooms and home visits ring a doorbell (`ring`/`useDoorbell`:
  a Supabase Realtime broadcast with no data; listeners re-fetch through their own calls) and keep a slow backup check
  (chat 30 s, party and visit rooms 15 s). New live features ring their own topic instead of polling fast.
- Resume (owner, Oct 24): the game opens where the player last was (`players.at_place`): inside that place on its ground
  floor (or on the map beside it), never over a push's `?open=` or the first-session flow (`?at=<place id>` in the preview).
- Welcome back and Start over (migration 0114, owner Oct 22): `/` shows a signed-in player who has a home the welcome
  screen (components/WelcomeBack.tsx: their home in 3D behind the account card, Continue to `/home`, Log out, Start over;
  `/preview/welcome`, `?restart=wait`). `restart_player()` (once every 30 days, `GAME_CONFIG.restartDays`; `restart_status()`)
  keeps the account, username, real money (entitlements, purchases, 'collector' items taken off, a Couture car), crew,
  chats, dates, badges and story votes; it resets cash, clout, rank, home, C$ items, bills, skills, tasks, goals, streaks,
  businesses, campus, hunts, gossip and lotto, moves the ledger to `ledger_archive` (so rewards pay again) and sends the
  player back to the creator: `restart_pending()` opens it on the look step with the name kept (`restart_look`), then traits,
  a new birth lottery and a home. Realistic weekly rent (migration 0113, owner Oct 22): rent is about a quarter of New York's
  monthly rent (room share C$225, studio C$425, 1BR C$600, Sunnyside C$750, LIC C$1,050, dorms C$250); the lottery rolls
  C$1,500 to 3,000.
- Contact the Mayor (migration 0105, owner Oct 22): the Phone's Mayor app is players' feedback to the team. Letters
  (`mayor_write`: bug, idea, complaint, praise, other; 10 to 1000 characters; 5 a New York day; the server adds the
  player's place and device) land in Studio → Mayor's Inbox (`admin_mayor_letters`, `admin_mayor_letter`: read, done,
  a reply the player sees in the app with a badge until opened, `mayor_seen`). Letters never reach other players.
  Mayor Papa-Dani (lib/cast.ts `OFFICIALS`, docs/CAST.md "Voices") welcomes players in the app and is in City News
  every week from 2026-10-26 (`validateNewsWeek` requires a city item with him in its cast). Renamed Mayor Papa-Dani
  (owner, Oct 22; id `mayor-papa-dani`, the old `mayor-mama-mandee` still accepted); he has a step in Lola's tour
  (components/game/Tutorial.tsx, `who: "mayor"`).
- Autopilot (migration 0107, owner Oct 22; lib/autopilot.ts): game_settings 'autopilot' {news, hunts, gossip, stories},
  all on, switched in Studio → Calendar (`autopilot()`, `admin_autopilot_set`). `syncWeeklyContent` stores news and
  hunt files only while theirs is on; a new gossip week arrives held ('review') while Tea is paused (`gossip_import`);
  `story_autopilot()` (service role, run by the sync) starts the next main story in the Studio's order today when none is
  running or scheduled (declined and retired never start; a paused story mid-run keeps the slot). The weekly routine
  merges its own pull request once its checks pass (docs/WEEKLY-CONTENT.md).
  Saturdays (migration 0137, owner Oct 31): hunts run Saturday to Friday from 2026-11-07 (`HUNT_SATURDAYS_FROM`,
  `huntWeekOk`; content/hunts/<Saturday>.json, announced in that Monday news week on its Saturday) and `story_autopilot`
  starts the next main story only on a Saturday (Day 1 that Saturday). Friday is the owner's veto window: the Calendar names
  the Saturday's hunt and story. News and gossip keep their Monday weeks and a 24-hour window.
- Relationships (migration 0118, owner Oct 26; spec section 24): a match goes official after 3 completed date nights
  (`couple_ask`/`couple_answer`; accounts 7+ days old, one partner each, 14-day cool-off after a breakup, blocking ends it,
  other crushes end and none can be made while dating). `couple_state()` is the "Us" screen (Phone → Messages → Us,
  components/dating/Couple.tsx, `?open=us`) and pays what's due: the couple streak (a completed date, a together bonus or
  5 messages each way per New York day, one miss a week forgiven; days 3/7/14/30, ledger 'couple_streak', badges
  couple-7/14/30) and weekly/monthly anniversaries (ledger 'couple_anniv'). Gift boxes go to the partner (`couple_gift`,
  once a day). Partners' date nights pay 15 Mood and 35 clout. "💞 Dating @name" on the player card unless hidden
  (`couple_show`). Settings: game_settings 'couples', mirrored by lib/couples.ts (tests/couples.test.ts).
  `?couple=progress|ask|dating|gift|ended` in the preview.
  Living together (migration 0149, owner Oct 31): a couple official 7+ days moves into one partner's home (`cohabit_ask` from the
  host, `cohabit_answer`; `cohabit_block_reason`: not a dorm or the room share, any owned house fits; no live sublet, open listing
  or rent due on either side; the mover owns no house). The mover's home_id becomes the host's, their layout goes to storage and
  next_rent_due lines up with the host's (no fee). `bills_cohabit_split` makes each rent bill the player's part
  (`cohabit_rent_part`: mover floor(rent × rentShare), host the rest; none for the mover in an owned house; `cohabit_rent()`
  feeds the Bills' next rent, CityPlayer.rent_part). "Home together" (`cohabit_hang`: both tap it the same New York day, Mood +8
  and clout +5 once, ledger 'cohabit_home'). `cohabit_leave` (either), a breakup or block, either one moving or being evicted,
  and Start over end it through `cohabit_close`: the host keeps the home at full rent, the mover goes to `cheapest_home()` with
  an empty layout. While together the mover can't host visits ('partner_hosts') and neither can sublet ('living_together').
  Lola's Blotter gets a 'win' line on move-in unless either partner opted out of News (removed when it ends). Us shows Move in
  together, Living together since…, Home together and Move out; the mover's Home tab shows the host's place (`cohabit_home`,
  `CohabitHomeBar`); "🏠 Living with @name" on the player card follows `couple_show`. Couple Shop pieces: content/shop/couple.json
  (six C$ furniture pieces, extra.couplesOnly and emojiOnly, `COUPLE_ITEMS`), buyable only while dating (`shop_couples_guard`,
  'couples_only'); they go on sale through the Studio. game_settings 'couples' gains moveInDays, moveInAskDays, rentShare,
  homeMood, homeClout (lib/couples.ts); rate bucket 'cohabit'; facts 'couple.moved_in', 'couple.moved_out'.
  `?couple=movein|together` in the preview.
- Sublets (migration 0119, owner Oct 26; spec section 25): renters of the 1BR, Sunnyside or LIC let a spare room
  (`sublet_list`: a quarter to half their rent, 1 to 8 weeks, crew-first for 24 hours); `sublet_apply`, `sublet_answer`
  (first week + a one-week deposit, ledger 'sublet_rent'/'sublet_income'/'sublet_deposit'); rent every 7 days ahead
  (`sublet_settle`, also the push sender's `sublet_settle_all`; unpaid ends it); the subtenant's own rent bills are held
  (`bills_sublet_hold`) and the Home tab shows the host's place with a second bed (`sublet_home`, components/city/Sublets.tsx
  `SubletHomeBar`); notice 7 days, leave any time, the deposit always comes back; moving, blocking and Start over end it
  (`players_sublet_moves`, `block_sublet_trigger`); ratings, renewals, roommate hang, card lines (`sublet_public`).
  Settings: game_settings 'sublets', mirrored by lib/sublets.ts (tests/sublets.test.ts). `?sublet=browse|listed|living|
  hosting|notice|ended` in the preview (Phone → Apartments → Sublets).
- Crib Rating (migration 0120, owner Oct 26; spec section 26; code and database say home score): `home_score(player)`
  scores placed bought pieces 0 to 100 (rooms 4 × 10, quality: distinct lines' stars against the home's target, wall art
  5 each up to 20); `home_score_state()` pays 40/70/100 once (ledger 'home_score'); lib/homeScore.ts mirrors game_settings
  'home_score' (tests/homeScore.test.ts) and works it out on the client for the 🏠 pill beside "Invite your Crew"
  (components/home/HomeScore.tsx). Wall art: content/shop/wall-art.json, live in Furniture → Art, kind 'painting'
  (`CATALOG_FURNITURE`, `shopBase`, pictures in public/art/). `?homescore=furnished` in the preview.
- Having people over (migration 0121, owner Oct 26; spec section 27): `visit_host` (hangout now for an hour, 3 a day;
  party up to 12 h ahead for two hours, 1 a day, snacks paid), guests from `visit_invitable` (crew, partner, chats, may_reach),
  capacity by home (`visit_capacity`); guests `visit_answer`/`visit_arrive`/`visit_leave`; `visit_room` is the 4-second poll
  (presence, chat after an id, and `visit_settle`: 2 minutes there pays guest and host once, host clout × (1 + Crib Rating
  / 100), a partner's couple day). lib/visits.ts mirrors game_settings 'visits' (tests/visits.test.ts); components/home/
  Visits.tsx (sheet, home card, bar); the entry is the stats panel's Mood row, which like every stat lists up to three
  actions (`contextTipLists`, lib/statTips.ts). `?visit=none|hosting|invite|guest` in the preview.
- Starter Week (migration 0122, owner Oct 26; spec section 28): ten missions for players who joined after it (game_settings
  'starter', mirrored by lib/starter.ts, tests/starter.test.ts), marked by error-swallowing triggers (`starter_mark`) and paid by
  `starter_state()` (ledger 'starter' per mission, 'starter_finish': C$500, badge 'starter-week', the violet rug); 7 days, (migration 0123: the park mission, consoling Sir Barksley, pays a C$500 tip; a mission pays once in any currency);
  `starter_hide`. The pill sits under "Invite your Crew" (components/game/Starter.tsx); the current mission's place glows on
  the map (`PlacePin.glow`). Businesses and Jobs open at Rank 2 (`APP_UNLOCKS`, Lola's `UnlockReveal` once); the daily tasks
  open once when onboarding ends. `?starter=0-10` in the preview (lib/starterSim.ts marks from the simulated city's calls).
  Satire pass (owner, Oct 27): missions, the first-day tasks and the first goals read as New York satire; the first party is
  celebrity influencer Peyton Pastel's, on tickets "found" at a coat check (FirstSession.tsx `PARTY_HOST`). Sir Barksley
  (lib/barksley.ts, components/city/Barksley.tsx): the billionaire's depressed Pomeranian in Astoria Park; his scene opens on
  the first visit during Starter Week (met once per device), then a row on the park card with Dmitri's daily update.
- Analytics (owner, Oct 27): PostHog starts in `instrumentation-client.ts` (Next 15.3+; env `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`,
  `NEXT_PUBLIC_POSTHOG_HOST`; no token, nothing starts): autocapture, page views, session replay with every input masked and
  `.ph-sensitive` masked (put that class on anything players type for others: chat, letters, shoutouts, notes; autocapture skips
  it too). Never on the Story Studio (`analyticsOff`). `identify(supabase user id)` only, never an email or name
  (`AnalyticsUser`); `/auth/signout` lands on `/?bye=1`, which resets. Custom events: lib/analyticsEvents.ts (pure, tested by
  tests/analytics.test.ts); `trackedCity` wraps the city API in GameShell (tasks, rent, places, events, C$ Shop); chat sends,
  story posts and real-money purchases are tracked where they happen. Never put typed text in a property.
  Consent (owner, Oct 27; GDPR/ePrivacy): PostHog starts opted out (`opt_out_capturing_by_default`, no cookies or storage) until
  the player taps Accept on `ConsentBanner` (app/layout.tsx); Reject keeps it off; Settings has the `ConsentSwitch`
  (`setConsent`, `consentStatus` in lib/analytics.ts). VIP plans state the renewal and how to cancel above the button (ChatPass).
- Rate limits (migration 0126, owner Oct 27): PostgREST's pre-request hook (`pgrst.db_pre_request` = `check_request()`) counts each
  signed-in player's writes per minute (`rate_counters`, `rate_hit`): 240 in all, plus buckets for guesses (hunt answers, exams,
  gossip, name checks: 20), reviewed posts (10), chat (30) and checkouts (10). Reads, signed-out requests and the service role are
  never counted; over a limit is HTTP 429 'rate_limited'; a broken check lets requests through. game_settings 'rate_limits',
  mirrored by lib/rateLimits.ts (tests/rateLimits.test.ts). The browser client shows "slow down" (`SLOW_DOWN_EVENT`, GameShell).
  A new function players can spam: add it to a bucket.
- Demo mode (owner, Oct 27): `/demo` (components/demo/DemoGame.tsx) runs a one-tap character pick (QuickPick, owner Oct 28: four
  ready-made New Yorkers, a made-up name, a lottery roll, the room share) and the first session on the in-memory
  city (lib/citySim.ts) in the browser only: nothing reaches the server, no social features. A top strip and `DemoSignUp`
  (GameShell's `demo` prop: "Invite your Crew" and the end of the first session) send guests to `/?signup=1`. The guest card leads
  with "Play now, no sign-up", then one "Sign in" for both (SignUpSheet mode 'signin': a known email gets its link, a new one
  carries on to the birthday step as a sign-up); invites and creator links lead with Sign up. Its leaderboard is made up
  (`demoLeaderboard`: invented New Yorkers around a newcomer's clout; Crew is only you). Development only: `/demo?flow=leaderboard` jumps to the end card.
- Campaign Mode (migration 0127, owner Oct 29; docs/CAMPAIGN-MODE.md, the 4-week test build): the player manages one of four
  challengers' campaigns (content/campaign/*.json: Goldcrest, Castellano, Kowalczyk, Starr) against Mayor Papa-Dani, one campaign
  week per real New York day. The rules are TypeScript, not SQL: lib/campaignEngine.ts (pure, every roll from an injected random
  source) runs in app/home/campaignActions.ts with a crypto random source and the service role, and in the preview's memory
  (lib/campaignSim.ts, results in 6 seconds; `?campaign=locked|pick|week|situation|bribe|debate|waiting|election`). Players only get
  `campaignView` (no traces, fact-checks, queued trouble, fail odds or effects; results hidden until the next New York day);
  the content files hold the odds, so only the server and the preview import lib/campaignContent.ts (its client chunk is referenced only by /preview, a 404 in production). public.campaigns (state jsonb,
  RLS on, no grants) is written by `campaign_begin` (Rank 2, one running, one start every 7 days, a seed up to C$1,000: ledger
  'campaign_seed') and `campaign_save` (versioned; pays once per kind/ref: 'campaign_poll' and 'campaign_reward' clout,
  'campaign_skim' (capped C$1,500 a campaign) and 'campaign_repay' cash; badges 'campaign-ran', 'campaign-mayor'; rate bucket
  'campaign'). Start over abandons a running campaign. Seven campaign goals are side goals (`side: true` in lib/goals.ts): listed
  and paid, but `goal_current` only suggests them while a campaign runs. Entry: the Phone's Campaign app (the teaser before Rank 2,
  `APP_UNLOCKS.campaign`), News → City's "Upcoming election" card while none runs, the Rank 2 reveal and Lola's unlock line;
  `/home?open=campaign`. Tuning: tests/campaign.test.ts plays thousands of campaigns (clean ~45-65% wins, dirty ~55-80%).
  Previews show You get and It costs only (owner, Oct 31: no risk labels or "may come back" hints, the Oct 30 rule for every
  card; content/campaign has no risk, why or later fields, tests/campaign.test.ts checks).
  Bought endorsements and votes (owner, Oct 30): nine situation cards (`buy_*`, `votes_*`, `mayor_buys`); the choice effect
  `ally` puts a stakeholder on the campaign's side (a bought Mayor ally leaves Poach Ally one fewer target).
  Part 2 (migration 0128): campaign tasks (content/campaign/tasks.json: two a campaign week, one from the campaign's state, one in
  the candidate's voice; title ≤ 35 and tag ≤ 30 characters filled in, tests check it; `taskDone` reads the week's plan; 15 clout
  each at End Week, ledger 'campaign_task') in Campaign HQ and under the five in the Tasks sheet (not part of the five or the
  streak); "Your poll results are in" (`push_scan_campaign`, kind 'campaign_poll', run by the push sender); Lola's scandal write-ups
  in News → City (`lines.scandal`, `view.scandals`); Campaign HQ on the map (place 'campaign-hq', Steinway in Astoria, tag
  'campaign': its card's "Open Campaign HQ"; Bernie, the volunteer coordinator, is its regular); Astoria regulars mention the race. Candidates' portraits are public/cast/candidate-<id>.webp (owner, Oct 29); every issue has an emoji.
  Reputation option C (migration 0142, owner Oct 31: "Stay with option c"): the candidate's Integrity and the manager's own
  Halo ↔ Hustler meter stay separate but linked (`CAMPAIGN.rep`). Going in, the server reads the manager's band once
  revealed (`managerBand`, StartInput.band): Halo starts the candidate +5, Hustler −5 and hears next week's anonymous offers
  early (`state.startIntegrity`, the view's shadow check uses it). Coming out, each End Week records half the candidate's
  Integrity change (both ways, ±8 a week; `state.rep`) with a recap line (😇/💸); `campaign_rep` (service role, once per
  campaign and week, ±15 a campaign) moves the meter after the save. Heat, traces and Street Rep stay campaign-only until
  the underworld exists.
- Compact map (owner, Oct 29; the only map since the classic street map was retired, Oct 30):
  New York in miniature. lib/compactMap.ts gives every place its own block (`SPOTS`, tests/compactMap.test.ts), the
  neighborhoods, the boroughs as islands (locked ones under fog with their card, bridges and the ferry barred), and
  the jokes (bronze Pizza Rat, LUXURY CONDOS SOON lot, Papa-Dani's billboard). components/map/CompactMap.tsx is a
  the game's and the guest screen's map (props and `MapApi` in components/map/types.ts); components/map/compactScene.ts draws it with the landmark models,
  storefronts (`STOREFRONTS`), filler blocks and street life. Street life moves (owner, Oct 30): lib/streetTraffic.ts
  (pure, tests/streetTraffic.test.ts: right-hand lanes, curved corners, a light at every intersection, queues; people round
  their block) drawn by components/map/streetLife.ts (instanced, open boroughs only); at night lamps at every corner and
  mid-block pool light on the street, filler windows light up, cars show head- and taillights. Only the 3D view redraws
  for it (30 fps, 20 in low graphics); the shadow map redraws only when something static changes. Only the picture changes: travel, prices and lines keep
  real lat/lng (`makeProjector` places any lat/lng among its nearest places). Names only for the most relevant places
  (`labelPriority`, `FEATURED`, `pickLabels`: never overlapping), dots for the rest; a tap on a dot, name or building
  opens the place's card. Story-only places stand there only while their story runs.
- Age screen (owner, Oct 27; COPPA/FTC): sign-up asks a neutral date of birth (components/AgeGate.tsx `BirthdateField`, lib/age.ts,
  tests/age.test.ts), never stored: metadata keeps `age_confirmed` + `age_check: 'birthdate'`. Under 18 closes sign-up on the device
  for a year (`cc_age_no` cookie + local storage; `createPlayer` refuses it too). The creator asks it when sign-up didn't (Google
  after its hour).
- Delete my account (migration 0124, owner Oct 27; GDPR erasure): Settings' last row → `DeleteAccountSheet` (type DELETE) →
  `deleteAccount` (app/home/accountActions.ts): `account_delete_prepare` (service role: clears admin `reviewed_by` marks,
  counts the deletion in `account_deletions` without who, returns the Stripe customer), cancels every live subscription
  (`cancelAllSubscriptions`; stops if Stripe fails), removes Clout TV photos, `auth.admin.deleteUser` (everything cascades;
  creator commissions stay, player set null), optional PostHog person delete (`POSTHOG_PERSONAL_API_KEY`), then `/?bye=1&deleted=1`.
  Terms and Privacy (app/terms, app/privacy, Oct 27) describe what the game does: keep them in step when a feature changes what
  is collected, shown to others, sold or renewed. Operator: Internova Technologies Inc (Washington, DC), hello@cloutcity.app.
- Security review (migration 0130, owner Oct 29; docs/SECURITY-REVIEW.md): one open checkout per player per product
  (`start_purchase` returns the replaced sessions, `startCheckout` expires them in Stripe; held Couture copies count once
  per player; numbered pieces are card-only); a full VIP refund cancels the subscription (`refund_is_subscription`); the
  saved Stripe customer is kept; push devices only at the browsers' push services (`push_endpoint_ok`, `pushEndpointOk`
  in lib/push.ts); the lotto pot shows until its winning card is scratched; `/auth/confirm` POSTs need this site's Origin;
  next.config.ts sends no-framing and HTTPS headers.
- Moral Choices (migration 0131, owner Oct 29: "the central theme of the game"; spec section 29): situation cards in
  `content/choices/*.json` (checked by `validateCards`, lib/choices.ts; server and preview only, via lib/choicesContent.ts) are
  offered by app/home/choiceActions.ts after arriving, riding, a shift, gig, meal, visit or hangout (`askChoice` in GameShell;
  2 a New York day, 90 minutes apart, 30-day cooldown per card, 7 per dilemma) and settled there with a crypto random source;
  the database pays once (`choice_settle`/`choice_land`, ledger 'choice'/'choice_later', caps in `choice_effects_ok`). The meter
  is 😇 Halo ↔ 💸 Hustler for players (owner, Oct 30: "Integrity" steered everyone to the good choice); code and database say
  `integrity` (`reputation`, 100 Halo, 0 Hustler, from 50, the same rate both ways, private: shown only as the nudge on each choice's receipt, the dot sliding from where you were, owner Oct 30; no list
  of choices anywhere; Lola's `LOLA_REP` line when a choice tips you into an end or back to the middle), revealed by the
  first choice. Both ends pay (`repBonus`: Halo-ward clout ×1.25 at 70+, Hustler-ward cash ×1.25 at 30 or below; cards can need
  either end); each end is lucky at its own game (`laterOdds`, owner Oct 30 "option 2": a Hustler's angles come back to
  bite ×0.5 and a Halo's ×1.5, a Halo's good deeds come back as rewards ×1.5 and a Hustler's ×0.5); regulars' `reputation`
  {halo, hustler} lines (npcs.json) react; card text names real costs, never the meter
  (`validateCards`). Cards show no risk labels or "comes back" hints (owner, Oct 30: players learn from consequences;
  `cardView` sends only label, get and cost). Only invented people, grey not criminal, never real money.
  Start over resets it. `?choice=now|back|high|low|log|jail|chain` in the preview (not the demo: its bundle would carry the outcomes).
  Real stakes (migration 0132, owner Oct 30): bigger caps (C$3,000, 300 clout), lasting effects (`choice_marks`: a place ban up to
  7 days, no gigs up to 3, up to 3 hours in holding at the 114½ Precinct, police played for laughs; bail `choice_bail`, C$150 an
  hour left; enforced by triggers: 'banned_here', 'gigs_locked', 'in_holding'), chains (`later.card` opens a `chainOnly` card past
  the daily limit, `choice_chain_open`) and public headlines (`later.headline` → Lola's Blotter in News → City, `choice_blotter()`,
  never for news_opt_out players).
- Careers (migration 0135, owner Oct 31; spec section 30): steady jobs with a ladder, separate from the creator's looks and
  traits (owner: "both are separate"). Three tracks of five levels (lib/careers.ts `TRACKS`: Hospitality at Grind & Gossip,
  Tech at Triborough Works, Media at the Clout TV Tower), the Phone's Careers app (Phone → Jobs stays the players' hiring
  board) and "💼 Go to work" on the employer's card. The rules are TypeScript like Campaign Mode (lib/careers.ts, pure; run by
  app/home/careerActions.ts with a crypto random source and the service role; lib/careerSim.ts in the preview,
  `?career=welcome|new|apply|work|day|review|warning|fired`); the task file content/careers/careers.json holds hidden outcomes, so only
  those two import lib/careersContent.ts. public.careers (state jsonb, RLS on, no grants): `career_hire` (one job; after the
  sack a track waits 7 days, after quitting 2), `career_save` (versioned; the workday's Energy and Mood, the key skills
  practised, pays once: 'career_pay' cash on the weekly review, 'career_promo' and 'career_screen' clout; rate bucket
  'career'). A workday is the day's work: never after a shift, and `career_shift_guard` stops shifts after it. Start over ends
  a job. Part 2, office politics (migration 0136): on a day you clocked in, one collaborate move (help, share the credit, team
  up) and one sabotage move (take credit, report mistakes, feed the gossip a rumor), aimed at the work friend, the rival (or the
  boss for a rumor); `OFFICE` in lib/careers.ts. Sabotage leaves grudges that strike at work, always warned on the People card;
  traced sabotage costs the boss's trust (a traced rumor: a warning and a Lola's Blotter headline); work mood feeds Mood and
  performance; a joint project pays 'career_team' at the review; `career_office` nudges the private meter (±12) and posts the
  headline (`choice_headline`, never for News opt-outs). `?career=office|grudge` in the preview.
  Aspirations (migration 0143, owner Oct 31: "careers be the entry point to choosing archetypes"; lib/aspirations.ts): the
  Careers app opens on a welcome screen ("What's your aspiration?", one Choose button; `?career=welcome`) with seven:
  Corporate Bro / Corporate Girlie (Tech), Budding Influencer, Streamer, Future Celebrity (Media), Hustler (Hospitality),
  Public Servant (City Hall, campaigns +3 points) and Stay-at-home Spouse (hosting clout ×1.25 in `visit_settle`); careers to come show
  "Coming soon". The aspiration's careers start a level higher and a degree (3 campus exams at C+, never caught, since Start
  over: `exams_passed`) adds one, up to level 3, only where the skills are met (`startLevel`); Streamers' screen time ×1.5,
  Future Celebrities' Climb cards ×2 (`ChoiceContext.boost`). `aspirations` table; `aspiration_state()`, `aspiration_set(id)`
  (a new pick once every 30 days, 'too_soon'), `aspiration_of` (service role); Start over clears it; fact 'life.aspiration'.
  Part 3 (no migration; spec section 30): six more office moves (cover a mistake, back the boss, mentor the new hire: three
  sessions and they tip you off before the next payback; quietly undermine, go over the boss's head, push the boss out: once a
  job, the big boss's trust 65+ and performance 70+: the successor takes over and you're promoted, or a warning), a big boss,
  new hire and successor per track (`Track.bigBoss|newHire|successor`, `managerOf`), friends for life (the work friend at 85
  trust: never under 60 again, covers a missed day a week; fact 'career.friend_for_life'; Sal and Jojo remember them), the
  quit card under 30 work mood (stick it out, hand in your notice, quit to run your business: `quit(s, day, {reason})`,
  `stickItOut`), office romance storylets (content/choices/storylets.json: office-crush → office-romance-hr, office-temptation),
  the job as campaign background (`StartInput.career`: Hospitality staff morale +10, Tech fundraising ×1.2, Media +2 points;
  `CAMPAIGN.background`) and Studio → Insights' Careers card (`admin_career_stats`, migration 0143: kept 14 days, promoted,
  aspirations). `?career=boss|quit` in the preview.
  City Hall (migration 0144, owner Oct 31: the first "coming soon" career, the Public Servant's): track 'cityhall' at the City
  Hall Annex (Astoria; place 'city-hall-annex', regular Osvaldo the lobby guard), The Mayor's Office: Ribbon-Cutting Intern
  550 → Deputy Mayor for Vibes 2,700, Aura and Smarts, Marvin Szeto (credit-stealer: "your best ideas become the Mayor's"),
  Dolores and Preston; Mayor Papa-Dani is the big boss (`bigBoss.short`, `bigName`). Perks: +5 Energy a workday, photo ops
  from level 3 (8 × level clout, 'career_screen'), and campaigns start 1 point up (2 from level 3; `CAMPAIGN.background`).
  A gated task (`cityhall-conflict`, `when` snap campaign) has the Mayor ask about "your little campaign". `?career=cityhall`.
  Streaming and Fashion (migration 0146, owner Oct 31): the Streamer's and the Budding Influencer's careers. Streaming: Glow Up
  Collective at The Glow Up House (Astoria content house, `streamHouse` room, regular Marisela the house manager; Chat Moderator
  400 → Streaming Legend 2,600; Aura and Hustle; Brayden Kross, supportive; Lulu, Dante; big boss Tyce Monroe; chat donations
  as tips, raid-night clout from level 3, ×1.5 for Streamers). Fashion: Atelier Vernon (LIC fashion house, `atelier` room;
  Sample Runner 450 → Creative Director 2,900; Photography and Aura; Valentina Moreau, micromanager; Remy, Saskia; big boss
  Madame Odile Vernon; +3 Mood a workday, front-row clout from level 3). Campaign background: Streaming +1 point, Fashion staff
  morale +5. A workday's Mood is clamped to career_save's −20 to +10. `?career=streaming|fashion`. The Glow Up House is a content
  house that serves as an office (owner, Oct 31): a TOWERS entry with stairs (`stairs: true`): Living room (`streamHouse`), Stream
  floor (`streamFloor`: eight streaming booths, ring lights, the producer's desk under the stream schedule, servers) and the Brand
  deals floor (`execFloor`).
  Real Estate, Finance and Law (migration 0147, owner Oct 31: "go ahead"; the last "coming soon" careers): Real Estate (the
  Hustler's) at No-Fee* Realty (31st St storefront, `officeSmall`, regular Fran the receptionist; Showing Agent 500 → Managing
  Broker 3,000; Hustle and Smarts; Gary Pomeroy, credit-stealer; Inez, Chad; big boss Lorraine Kessler; broker fees as tips,
  listing clout from level 3). Finance and Law (the Corporate Bro's / Girlie's): Queensboro Capital Partners in a Court Square
  tower (`TOWERS`: Lobby, Trading floor `tradingFloor`, Executive floor; Analyst 900 → Managing Director 3,600; Smarts and
  Hustle; Whit Carrington, micromanager; Anjali, Bradley; big boss Conrad Vance; +10 Energy, bonus season as tips from level 3)
  and Whitlock & Hale LLP (`lawOffice`, Old English; Paralegal 600 → Name Partner 3,800; Smarts and Aura; Margaret Whitlock,
  supportive; Desmond, Kimberly; big boss Harrison Hale III; +5 Energy, pro bono clout from level 3). Campaign background:
  Finance fundraising ×1.3, Real Estate ×1.15, Law +1 point. Payday pays the wage and the tips as separate 'career_pay' rows
  (`:pay:` and `:tips:`), since career_save caps each at C$5,000. `?career=realestate|finance|law`.
  Office sizes (owner, Oct 31: "depending on the size of the company"): place templates `officeSmall` (two desks and a mini
  fridge: Campaign HQ), `office` (Pedal Pushers Hub) and `officeBig` (12 × 9.5 open plan: two banks of six desks, a meeting
  table by the whiteboard, a kitchen and drinks fridge, reception, a lounge corner, a dozen coworkers: Triborough Works,
  Skybridge Tower); lib/rooms.ts, the template is in the city seed (migration 0145). Tower offices (owner, Oct 31: "multiple floors,
  swanky design, cubicles, display glass, robots… for big technology or media companies"): `TOWERS` (lib/rooms.ts) gives a
  place floors joined by an elevator (`towerElevators`: up to the next floor, from the top back to 1) and floor buttons in
  GameShell; Skybridge Tower (big tech): Lobby (`towerLobby`: robot greeter, display cases, glass lounge), Open floor
  (`techFloor`: 12 cubicles, server racks, robots) and Executive floor (`execFloor`: glass boardroom with a video wall, corner
  office, robot butler); Clout TV Tower (media): the Studio, the Newsroom (`newsroom`) and the Executive floor. New pieces:
  cubicle, glassWall, displayCase, robot, serverRack, elevator (components/room/furniture.ts).
  Interior styles (owner, Oct 31: "old english, minimalist, futuristic, modern"): `INTERIOR_STYLES` and `PLACE_STYLES` (lib/rooms.ts,
  by place id, so no seed change) re-dress a place's room with `styleRoom` (walls, floor, upholstery and rugs; Old English hangs
  two oil paintings, minimalist keeps one plant and no lamps, futuristic is midnight with neon trim); the layout never moves.
  Ground floors and tower floors wear the style; a club's restroom and VIP keep their own. No chat bubbles over people in rooms
  (owner, Oct 31: "Remove the chat bubbles"): tap the person; the talk buttons stay hidden (`sr-only`) for keyboards.
- The underworld (migration 0148, owner Oct 31: "Invite only", "Bite but recover", "Keep it a side hustle"; spec section 31):
  Pablo's back room behind Pablo's Luggage & Notary (place `pablos-luggage`, template `backRoom`, regular Pablo), a side hustle
  next to any career. From Rank 2 Pablo invites a Hustler (meter ≤ 30) or anyone after one Hustler-ward Moral Choices option.
  The rules are TypeScript like Careers (lib/underworld.ts, pure; app/home/underworldActions.ts with a crypto random source and
  the service role; lib/underworldSim.ts in the preview, `?underworld=locked|new|jobs|pro|hot|caught|lawyer&open=backroom`); the
  job file content/underworld/jobs.json holds the odds, so only those two import lib/underworldContent.ts. 3 jobs a New York day
  (You get / It costs), Street Rep (five tiers open bigger jobs), Heat (cools daily, faster on a quiet day; 50 riskier, 80 Pablo
  refuses), traces found later. Caught: a fine (≤ C$1,500, never below zero), up to 3 hours in holding (`choice_marks`), Street
  Rep down and a Blotter headline; never home, career or crew. Whitlock & Hale retainer C$400 a week (a law job is free).
  public.underworld (RLS on, no grants): `underworld_context`, `underworld_save` (versioned; ledger 'underworld_pay',
  'underworld_fine', 'underworld_lawyer'; rate bucket 'underworld'); Start over forgets it. Street Rep adds up to +10% to a
  campaign's dark ops (`campaignOpBonus`, StartInput.streetRep). Never violence, drugs or weapons (`contentProblems`).
  Part 2 (migration 0150): Pablo's crew (Tito, Gigi, Auntie Bee: loyalty from their jobs, +10% pay at 60, take the fall once a
  week at 80), Pablo's Thursday table (Hustlers only, once a week, always pays: ledger 'underworld_table'), the Charity Gala
  (Halo only, Ditmars Heights Rooftop, once a week: `gala_donate`, ledger 'gala_donation'/'gala', game_settings 'gala' mirrored
  by lib/gala.ts) and weekly jobs (content/underworld-weeks/<Monday>.json, `validateUnderworldWeek`; `content_import_underworld`
  stores them live 24 hours later unless vetoed in Studio → Storylets → Pablo's jobs; `underworld_jobs_live()`; follows the
  storylets autopilot). `?underworld=crew|table|weekly`, `?gala=on|off|new|done` in the preview.
- Content Engine (docs/CONTENT-ENGINE.md; owner Oct 31: endless content that reacts to how each player plays; AI later;
  automatic with a veto window: 24 hours for generated content, Friday for stories and hunts, which go live on Saturdays).
  Step 1, player memory (migration 0138): `player_facts` (player, key, subject → value, count, first/last, expiry) written only
  by `fact_note` (never raises; also bumps the city's `world_tally` by key, subject and New York day), by triggers on the
  ledger, careers, campaigns, choice_log, choice_marks, relationships and campus, and by the careers server (office moves, a
  polished interview). Every key is listed in lib/memory.ts `FACTS` (tests/memory.test.ts checks the list against the
  writers: add a key there when you add a writer). `player_snapshot` reads standing from the tables that hold it;
  `player_memory` = snapshot + facts in force. Service role only; Start over forgets the player's facts.
  Step 2, storylets (no migration): Moral Choices cards may carry `when` (conditions over memory: `has` a fact, with subject,
  prefix, recency, count; `snap` paths), `slots` (names filled from memory: a coworker, a place, an employer, a boss; a slot's
  source must be required by `when.all`) and outcome `sets` (facts written by `fact_note` after choice_settle). lib/storylets.ts
  (pure: `whenOk`, `fillSlots`, `systemsOf`, `storyletProblems`, checked with the longest names filled in); `fit` weighs
  two-system storylets ×5 and one-system ×2; app/home/choiceActions.ts reads `player_memory`. content/choices/storylets.json
  (20 cross-system storylets and a chain), content/choices/climb.json (the 36 Climb cards, area 'fame', "The climb");
  storylet facts are `thread.*` in lib/memory.ts. `?choice=story` in the preview (a sample history; storylets first).
  Step 3, weekly storylets (migration 0139): the routine writes `content/storylets/<Monday>.json` (6 to 14 cards, at least
  four families: favor, temptation, betrayal, windfall, loyalty; each with `when`; lib/storyletWeeks.ts `validateStoryletWeek`,
  run by validate:content and the import). `content_import_storylets` stores new cards scheduled, live 24 hours later
  (game_settings 'storylets'; paused while autopilot 'storylets' is off; a stored card is never touched); Studio →
  Storylets (`admin_storylets`, `admin_storylet_set`: veto, pause, restore, now; a live card's veto is final);
  `storylets_live()` (service role) feeds choiceActions' pool every 5 minutes (`offer`; vetoed live cards stay readable).
  Weekly cards are never in `CHOICE_CARDS` (that would skip the veto); the preview plays the first week as live.
  Step 4, the city reacts (migration 0140; lib/cityConditions.ts): `city_conditions` (heatwave, brownout, festival… and
  reactions) add their effects to `world_effects()` (arc `condition:<id>`; only price_multiplier ×0.5-1.5, availability
  (closures ≤ 12 h) and place_state notes; never protected tags). Weekly ones: `content/conditions/<Monday>.json`
  (`validateConditionWeek`, `content_import_conditions`: live 24 h later unless vetoed in Studio → Storylets → City
  conditions, `admin_conditions`/`admin_condition_set`). City storylets: `content/city/reactions.json` (`validateReactions`)
  → `city_react` (run by syncWeeklyContent) fires a condition when world_tally crosses a line (min 3, cooldown) and posts a
  city headline. `city_conditions_now()` (players): News → City's "Around the city" (components/city/Conditions.tsx), and
  the snapshot's `conditions` for storylets (`snap: "conditions", is: kind`). An `hr_crackdown` for a track doubles tracing
  (`office(..., { crackdown })`). choice_headlines gains `kind` (scandal, win, city) and a nullable player: a player's
  first campaign win, business going public or scholarship posts a 🏆 line (trigger on player_facts), never for News
  opt-outs. `?choice=city` (and `story`) in the preview.
  Step 5, one character registry (no migration): lib/characters.ts `CHARACTERS` (regulars, the Mayor, celebrities,
  wannabes, career bosses and coworkers `<track>-manager|friend|rival`, Sir Barksley). content/characters/remembers.json
  (`validateRemembers`, lib/characterMemory.ts): lines with storylet `when`/`slots` that a character says only when the
  player's memory fits; `characterRemembered()` (app/home/characterActions.ts, service role via lib/memoryServer.ts, which
  choiceActions shares) returns filled lines by character; GameShell's `remembered` prop plays one every 3rd tap on a
  regular (`rememberedTap`). Hand-written in PRs, never by the weekly routine (it would skip the veto window).
  Step 6, learning (migration 0141; lib/cardLearning.ts): `card_stats(days)` reads choice_log per card; once a New York day
  (`card_learning_due`) syncWeeklyContent runs `learnWeights` (70% chosen ÷ shown, 30% option split, against the median;
  0.5-1.6; 25 showings to move; retired at 60+ shown and ≤ 20% chosen) into `card_weights` (`card_weights_auto`, never over
  the owner's `set_by = 'admin'`); `card_weights_live()` feeds `ChoiceContext.weights` (fit × weight, 0 = retired). Studio →
  Storylets → What works (`admin_card_learning`, `admin_card_weight(card, weight, retired, auto)`).
  Step 7, one card format (no migration; lib/cardFormat.ts): Moral Choices cards, campaign situations and career tasks share
  `faceProblems` (emoji, title, 2-4 options with label/get/cost, no risk fields, never the meter; the campaign may name its
  candidate's Integrity) and the storylet gate (`gateProblems`): career tasks may carry `when`/`slots`, campaign situations
  `when`; the servers pass the engines only what memory unlocked (`unlockedCards` → CareerCtx.unlocked, endWeek's
  `opts.unlocked`), one gated card first per workday or End Week. validate:content and tests/cardFormat.test.ts run it.
- Office cards (no migration; owner, Oct 31: "go with 1, 2, and 3"; spec section 29): content/choices/office.json, 19 Moral
  Choices cards for players with a career job (10 for any job, one per track) plus two chain follow-ups (office-expenses-audit,
  finance-pickle-suits). `where.work` means a card happens at your job: right after a career workday (GameShell asks with after
  "workday", which still counts as "shift") or at the employer's place (`jobPlace`), scored like a named place (×2/×5 as a
  storylet). `validateCards` requires a job in `when.all` (`needsJob`) and no places or tags. Slot kinds `friend`, `rival`,
  `bigboss`, `newhire` (lib/storylets.ts) read `snap: "job.track"` beside `boss` and `employer`; outcomes write
  `thread.padded_expenses`, `thread.insider_trade`, `thread.buried_evidence`. tests/officeCards.test.ts; `?choice=office`
  (or `office-<track>`) in the preview.
- Players see "Crew" for their invited friends; code, types and database tables still say `clique`
  (renaming stored data isn't worth the risk). Keep player-facing copy on "crew".
- Culture packs (docs/culture/, one at a time, only when the owner says "Build C<number>"): slang, invented stand-ins
  for real names and Astoria's character profiles live in `content/culture/*.json` (C1); tapping a regular plays their
  everyday lines plus their profile's catchphrases (`withCatchphrases`, lib/culture.ts). `validate:content` and
  tests/culture.test.ts fail on any name in `parody-names.json`.
  C2 (migration 0093): places may carry `hours` {open, close} on the city clock (close before open runs past midnight;
  unset = always open). `place_visits_open` (a trigger like `require_here`) refuses anything at a shut place
  ('closed_now'); the card, actions and daily tasks say when it opens. Sal remembers your order after 3 different
  days at the deli (`remembers` in npcs.json, counted from `place_visits` rows).
  C3 (migration 0094): homes may carry `roommate` (the player pays their half; "Room share with a roommate" is the first
  sign-up home and now the cheapest, so evictions land there); the roommate's intro and daily note come from
  npcs.json `roommates` (components/home/Roommate.tsx). On the New York day a player moves in (not students),
  `ensure_daily` starts with `dailyTasks.firstDay`. Goals 'regular' (days at a place) and 'solo' (no roommate) open
  the ladder. An action's `task` gives its daily task its own title.
  C4 (migration 0095): a subway trip rides the destination's line (`travel.subway.lines`, `homeLines` in the city seed);
  News 'transit' items (the Metro Rail Authority) carry {line, from, hours, delay?} and `transit_delay(line)` adds a live
  delay's seconds to `travel()`, which returns {line, delay, showtime} (the client shows the server's seconds). The OMG
  Card (`buy_transit_pass`, players.transit_pass_until; not a possession) makes the subway free; 'rideshare' is a mode;
  showtime dancers (players.showtime_until, `showtime_watch`, ledger clout 'showtime' once a day). Lucky Star Lotto is
  in Flushing (Queens). `gossip_find` refuses a shut place.
  C5 (migration 0096): real-date events live in `content/culture/calendar.json` (copied to game_settings 'calendar',
  checked by tests/calendar.test.ts) and run on real New York time (`game_now()`), not the city clock. `calendar_attend`
  pays once (ledger 'calendar', ref = event id); invites pay dress-code clout for any equipped Shop fashion and take the
  gift penalty without a gift box (`buy_gift` at Sal's or Schlep & Schmear, players.gifts, ledger cash 'gift'). The next
  name day shows on the Phone's home screen from two weeks out (`phoneInvite`); a place card shows a live event instead
  of "Closed". Meteor Park (Flushing) holds the Flushing Meteors' home games (a club event); the rooftop holds NYE.
  Migration 0097: pushes for invites (`push_scan_calendar`, run by `push_scan_tonight`, on game_now()): 'calendar_invite'
  once when it reaches the Phone, 'calendar_tonight' from 3 hours before it starts (names the gift box); never for
  someone who went. The city seed now carries place and event names (`push_place` said "somewhere good" before).
  C6 (migration 0098): content only, plus two mechanisms. `content_import_story` (service role, run by
  `syncWeeklyContent` and when the Studio's story list opens) stores a repo story file the Studio doesn't have yet as
  'draft' (Needs review) and never touches an existing one. Story-only places (The Ditmars Walk-Up, Queens Housing Court,
  Court Square Courthouse) carry `story`, so gossip and hunts never use them; keep a story's effects on its own places.
  Lola's four date spots are `content/culture/date-spots.json` (a line on the place card). The weekly column answers an
  NYC dating complaint (docs/WEEKLY-CONTENT.md).
- The Shop Manager (migration 0099; docs/shop-manager.md, docs/fashion-style-lines.md, spec section 23; v1.0): the Shop's
  catalog is `shop_catalog` (statuses draft → pending_review → scheduled/live → retired; deleted only if never sold),
  with `shop_audit`. Add Shop items in Studio → Shop (import `content/shop/*.json`), not in `lib/city.ts` (`SHOP_ITEMS`
  keeps the pieces from before it: their wear and furniture data). A trigger rebuilds `city() -> 'shop'` from the
  catalog whenever 'city' or the catalog is written, so `shop_item()` and every purchase function work as before; a
  player_items trigger refuses buying what isn't on sale ('not_for_sale') or can't be worn yet ('not_wearable_yet').
  Players read `shop_catalog_public()` (city.catalog; the Shop falls back to the code's list before 0099). Pictures:
  `lib/shopImages.ts` (sharp: color-key the cream background, 256/768 px WebP) to the public `shop` bucket, masters in
  private `shop-masters`. Real-money price edits change `store_products.price_cents` and drop the old Stripe price id.
  Pictures also ship with the game: `npm run build:shop-images` processes every `sourceImage` in `content/shop/` into
  `public/shop-img/` and generates `lib/shopImagesStatic.ts` (by sku); the Shop shows them when the catalog has no stored
  picture (`shippedPictures`), and the Studio's Load uses them instead of processing (tests/shopPictures.test.ts).
  `/preview/studio` → Shop runs on an in-memory catalog and really processes pictures; what's approved there shows in
  `/preview/home`'s Shop (run `npm run dev` with `NODE_USE_ENV_PROXY=1` where downloads need a proxy).
  Clout Couture (migration 0102, step 5): real-money catalog pieces get a `store_products` row once scheduled or live;
  numbered editions (`entitlements.edition_no`, never reissued; `couture_edition(sku)`; drops end at `drop_end`) with a
  real limit in `start_purchase` ('sold_out', 'not_for_sale', 'already_own_car'); `admin_couture_new_drop` continues the
  numbering with Lola's News item; badge 'clout-couture'; real-money purchases over $50 confirm first (`BigBuySheet`).
  `COUTURE_NOW` (lib/shopCatalog.ts) lists the pieces that work in game; `CATALOG_FURNITURE` (lib/city.ts) the sofa and
  the statue (Room3D draws the owner in gold); a real-money car is priced, for insurance, like the priciest C$ car.
  Accessories sold in Luxury are filed as fashion; collector values come from the Shop tab. `?couture=soldout` previews it.
  Migration 0103: the 24k Glow Ritual is worn (slot 'face-effect', "glow" in lib/wearing.ts; Outfit.glow, baseAvatar's skin
  shader); `player_items.options` + `set_item_options` (crown or tiara; the suit's cloth, lining, monogram: lib/couture.ts,
  tests/couture.test.ts keeps the palettes in step); `crowned_players()` puts a 👑 by owners' names (leaderboard, chat).
  Migration 0104: Couture on the map (`couture_map()`: yachts moored off Astoria, jets of owners in the game, the week's
  plaza statue; lib/coutureMap.ts, components/map/coutureModels.ts, `setCouture` in the landmark layer); `plaza_bookings`
  (`plaza_weeks`, `plaza_book`, one a week, the look kept at booking; home after its week); Studio `admin_couture_owners`,
  `admin_couture_name` (hide a name), `admin_plaza_remove`. The Clout Throne is home furniture (`throne`, sittable).
  Shop order (owner, Oct 22): Clout Couture is its own Shop tab (after Luxury), out of every other tab; collector cards
  come after the C$ items. Every tab lists cheapest first (`shopOrder`), under a "New in the Shop" row of what went on sale in
  the last 14 days (`newArrivals`, the catalog's go_live_at; up to 8, not owned), never repeated in the list below). No product is listed twice
  (owner, Oct 22): approval is blocked by another item's name or picture (`readiness` 'duplicate', a furniture line's colors
  aside), and tests/shopCatalog.test.ts fails on a repeated id, name or picture across `content/shop/` and `SHOP_ITEMS` (live-shop-images' borrowed pictures included).
  Migration 0108 retired the three older pieces that showed a newer item's picture (`RETIRED_DUPLICATES`: chunky chain,
  designer watch, wide-leg trousers; owners keep them with their emoji). The Home tab is labelled "Furniture" (id still 'home'). Catalog clothes show and try on by `wearSlot()` (lib/catalogWear.ts,
  lib/accessories.ts), never by the code's `ShopItem.wear`, which they don't have. Migration 0106: Hell Gate Park is
  named Astoria Park (id `hell-gate-park` kept; city seed regenerated).
- New avatar bodies (stage 2 of the upgrade, docs/shop-manager.md): the owner's bald, barefoot bodies and clips are listed
  in `assets/avatar-animations.json`; `npm run avatars:fetch` downloads them into `assets/avatars/sources/` (git-ignored:
  never commit or ship the raw files) and `npm run avatars:build` (`scripts/build-base-avatars.mjs`) makes the game copies
  (full and `-low`) in `public/avatars/body/`, plus `{m,f}-anims.glb` (the walk and every clip, retargeted onto the body's
  skeleton by `scripts/retarget.mjs`; `AvatarParts.play(name)`; `/preview/moves?outfit=anims`). The base layer is never
  recolored (skin tone and brows only); body types never scale the head or neck (`lib/bodyTypes.ts`: per-vertex widening
  added by the shader, height scales the figure); barefoot bodies wear the sneakers template unless the outfit has boots; `buildModelAvatar` hands over to
  `buildBaseAvatar` when `newBodies()` (lib/graphics.ts): on for everyone since the switch-on (migration 0101); a device
  can go back to the old ones (Studio → Shop's switch, or `?bodies=old`). `lowGraphics()` (Settings → Low graphics, `?graphics=low|high`, on by itself only on clearly weak
  phones) picks the low files; renderers take `renderQuality()` (no shadows, no antialiasing, 1x). `/preview/moves` shows
  every move on both bodies. Garment templates (the hoodie, then the stage 4 wardrobe) are cut from the bodies by `scripts/garments.mjs`
  into `public/avatars/garments/`, share the body's skeleton, and hide the skin under them (`_COVER` bits); the outfit's
  top picks one from `GARMENT_TEMPLATES` (lib/avatarCatalog.ts); whole Shop outfits wear `SET_LOOKS` (templates in their
  colors, details and a hat from components/avatar/setHats.ts; `?outfit=sets`).
  Shop accessories: `lib/accessories.ts` (shape and colors by sku) drawn by components/avatar/accessories.ts; locked
  until switch-on (`?outfit=accessories&pick=`).
  Shop catalog clothes: `lib/catalogWear.ts` (pieces, patterns, finishes by sku; Outfit.pieces by slot; `?outfit=catalog`).
  Switch-on (migration 0101): the catalog's clothes and accessories are wearable; wearable accessories are filed as
  fashion; a dress (slot 'one-piece') is a top and a bottom (`wear_slots`, equip_item, save_look 'one_piece_conflict',
  style_counts); lib/wearing.ts mirrors it (wearSlot, slotsClash, outfitFromSkus); Your Look has Dresses and a tab per
  accessory slot once something's owned there. The home bubble's portrait aims at the head (AvatarHead). `/preview/moves?outfit=hoodie` shows all eight body types.
  The eight starting looks (owner, Oct 30): one outfit for everyone whatever the body, each clearly different, every top
  a shade of blue in the look's own fixed colors (`styleColors`; no color picker): Everyday Casual, Gym Regular, Bodega
  Streetwear, Midtown Corporate, New Money, Thrift Store Regular, Arcade Prep, Night Owl Goth (ids kept: lib/styles.ts,
  docs/HUNTS.md maps them). Each look's signature piece shows on the new bodies (`starterAccessory`: gym bag, lanyard,
  phone, tote, choker; headphones and the cap are headwear) unless a Shop piece fills that slot.
  Your Look keeps the starter clothes (migration 0109, owner Oct 22): Tops, Bottoms and Shoes list the starting style's
  pieces and colors (`STYLE_FITS`) free beside owned ones; `save_look(items, covering, fit)` stores players.look.fit.
  Oct 22 follow-ups: free pieces show Higgsfield pictures tinted to the color (`public/look-img/`, `StarterPic`); every style
  offers a tee and pants and no free zip-up; starter pieces come in one color each, no color selector (owner, Oct 22:
  grey tops, black bottoms, white shoes, `STARTER_COLORS`; `storedFit` keeps an old fit's pieces in those colors). One free
  basic hat, the cap, always `FREE_CAP_COLOR`;
  no fedora or bucket hat, and no hijab (owner: a sensitive piece that needs care); a saved one reads as none. The durag,
  turban, headwrap and kippah are Shop pieces (content/shop/headwear.json; migration 0111 puts them live and gives each to
  whoever wore it), drawn as coverings in their own color (`COVERING_ACCESSORIES`, buildAvatar's `hatColor`). Extras are
  Shop pieces only; an empty tab links to the Shop. Charisma is called Aura (id 'charisma' kept; migration 0110's push).
  Hair on the new bodies is grown from each scalp by `scripts/hair.mjs` (`public/avatars/hair/`, one mesh per style plus
  its `-lengths`); full coverings hide it, under a hat only the lengths show; `?outfit=hair` previews every style.
- No real brand names; businesses are invented. One exception (owner, Oct 16): Real Clout FM and Clout TV ask
  for the player's Instagram handle by name (v0.14). Copy is satirical and never
  promises features that aren't built.
- Lucky Star Lotto: the server draws every card's prize at purchase and pays it on scratch
  (`buy_lotto_card`/`scratch_lotto_card`, migrations 0032 and 0041: the prize, the pot win and the card's numbers); the browser only names a game. Never send
  a result, price or limit from the client, and real money never touches the lotto.
- Studio stories (migration 0080): approval alone never puts a story live; a main story needs a Day 1 (schedule,
  or `admin_story_go_live`: approve + today as Day 1, and its side stories waiting for review, migration 0081). `storyStage()` (lib/studio.ts) is the one status the Studio
  shows. A live story can't go back to review or be declined.
- Story blog posts (migration 0115, owner Oct 22): a beat's `news[0].post` is the full post behind the feed card's "Read the
  full post" (`body` is then the teaser; lib/storyValidation.ts checks 300+ words in paragraphs); `story_feed()` sends it
  only for released beats. Diss & Tell (content/stories/diss-and-tell.json) is the first story written this way.
  Reading a post pays `GAME_CONFIG.storyReadClout` (10) clout once (migration 0117, `read_post`, ledger 'story_read'; the
  feed's `read` flag hides the "+10 🔥" afterwards).
- Story content lives in `content/stories/*.json` and is read only on the server or by the
  Studio (answers must never reach a player's bundle); players get `story_feed()`. Hunts are the
  same: `content/hunts/*.json` carries answers; players get `hunt_state()`. Gossip too: `content/gossip/*.json`
  holds every piece and goes live on its own (`lib/gossipImport.ts`); players get only what they've found.
- Modules imported by tests use explicit `.ts` extensions for their own imports.
