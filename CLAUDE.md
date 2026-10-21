# Clout City

Mobile-first browser life game: arrive in New York as a nobody and chase clout.

**Current version: v0.15 "Campus"** (v0.1 to v0.15 are done, with daily tasks 2.0, push notifications and Membership & purchases; v1.0 "Launch" is next) (see `docs/07-milestones-and-versions.md`).

## Read first
- `docs/testing-feedback.md`: decisions and fixes from the Oct 13 testing round. **Wins over the older docs.**
- `docs/08-new-features-spec.md`: hunts, News, the cast and NPCs, the Astoria neighborhood, travel and groceries, Lucky Star Lotto, neighborhood gossip, and v0.11's content automation, exclusive events update and interface changes (sections 9 to 11), the modeled avatars and Shop outfits (section 12), bigger homes and venues, including the clubs' restroom and VIP floors (section 13), meeting players at every place, with 20 messages a day and unlimited chat (section 14), v0.12's player ranks and businesses (section 15), v0.13's together bonuses and Jobs board (section 16), v0.14's Real Clout FM and Clout TV (section 17), v0.15's campus life (section 18), daily tasks 2.0: goals, streaks and guest-list passes (section 19), push notifications (section 20), the creator affiliates and UGC engine (section 21) and skill perks (section 22). **Wins over the older docs** for those features.
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
  `?story=3` starts the Sarah Bird story on Day 3; `?dating=match|invite|tonight|alone` starts crushes and
  date nights in that state; `?crew=invite|tonight|full|empty` does the same for crew outings;
  `?hunt=new|joined|question|wrong|finale|done` for the treasure hunt; `?lotto=win|big|back|lose` sets the next scratch cards' results and `?lotto=jackpot` makes the next card win its pot; `?gossip=new|some|almost|done` starts the Tea app in that state; `?chat=out` starts with today's 20 messages used (the unlimited chat offer); `?crowd=50` puts 50 sample players at any place you enter; `?biz=some|rich|public` starts with businesses (rich: the whole ladder, ready to go public); `?rankup=1-10` opens that rank's rank-up reveal; `?together=invite|ride|plan|bonus|decorate|approve` starts v0.13's together plans, ride requests, the bonus card, decorating someone's home or approving a decorator; `?radio=new|sent|full|notpicked|mine` starts Real Clout FM in that state (shared with the Studio preview's Shoutouts tab); `?tv=new|sent|mine|empty` does the same for Clout TV (shared with the Big Screen tab). `?goals=new|streak|pass|tonight|chapter` starts goals and streaks (`day3|day7|day14|goaldone` open a reveal); `?campus=new|pick|week|friday|done` starts campus life (v0.15) standing at St. Johnsons (open its card's Campus life); `?hint=daily` shows Lola's daily-tasks nudge after 2 seconds; `?push=ask` shows Lola's notifications ask (`?push=on` starts with a device on); `?member=vip|monthly|cancelling|pastdue|forever|free|none` sets Membership & purchases (Settings' top row, the profile's VIP line); `?transit=showtime` puts showtime dancers on every subway ride and `?transit=pass` starts with an OMG Card (the preview's News always has a live 7-train delay, C4); `?calendar=today` moves every calendar event to now and `?calendar=gift` does that with a gift box in hand (C5); `?skills=pro` starts with high skill levels (skill gigs, invites and Dance's club access open; preview skill gigs finish in 8 seconds). Sample players stand at every place in the preview. `/preview/studio` shows the Story Studio (its Affiliates tab runs on sample creators); `/preview/guest?via=tasha` shows a guest who followed a creator's link (`?via=tasha-signup` lands on sign-up); `/preview/affiliate` shows the creator page (`?state=new|paused`).
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
  the `MapApi` interface in `components/map/CityMap.tsx`.
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
  Migration 0105: the Waterfront Mansion is a home (`waterfront_mansion`, `couture` in ECONOMY.homes; owners only,
  `move_home` 'owners_only'; the move costs one week, no broker fee; its weekly upkeep is the rent, matched to the top
  Astoria rent). Buying it takes the lowest free of ten plots on Billionaire's Row (`mansion_plots`, a Lola news item);
  sold out only while all ten are taken; a refund frees the plot and moves the owner to `cheapest_home` (which skips
  couture homes). The row is a landmark (`billionaires-row`), the mansions sit on their plots (`plotLocal`/`plotAt`,
  lib/coutureMap.ts) with the owner's name at the gate; the interior is a two-floor home (lib/rooms.ts `mansionDown/Up`).
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
- Story content lives in `content/stories/*.json` and is read only on the server or by the
  Studio (answers must never reach a player's bundle); players get `story_feed()`. Hunts are the
  same: `content/hunts/*.json` carries answers; players get `hunt_state()`. Gossip too: `content/gossip/*.json`
  holds every piece and goes live on its own (`lib/gossipImport.ts`); players get only what they've found.
- Modules imported by tests use explicit `.ts` extensions for their own imports.
