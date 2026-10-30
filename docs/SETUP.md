# Setting up Clout City

About 20 minutes, all in web dashboards. You need a GitHub, Supabase and Vercel account.

## 1. Supabase project

1. Create a project at supabase.com (pick the US East region, close to New York players).
2. **SQL Editor → New query**: run each file in `supabase/migrations/` in number order
   (`0001_…`, then `0002_…`, and so on), one query per file. Each file runs once; when a new
   version adds a file, run just that one.
3. **Authentication → Sign In / Providers → Email**: keep Email enabled. Magic links
   confirm the address by themselves, so no extra confirmation step is needed.
4. **Authentication → URL Configuration**:
   - **Site URL**: your live address, e.g. `https://cloutcity.app`.
   - **Redirect URLs**: add `https://cloutcity.app/**`, `https://www.cloutcity.app/**`, `https://*-your-team.vercel.app/**`
     (Vercel previews) and `http://localhost:3000/**`.
5. **Authentication → Email Templates**: for both **Magic Link** and **Confirm signup**,
   set the subject to `Your Clout City code: {{ .Token }}` and paste the body from
   `supabase/email-templates/magic-link.html` (into **both** templates: new players get "Confirm
   signup", returning players get "Magic Link"). Supabase's default templates contain only a link
   and **no code**, so the installed app can't sign anyone in until this is pasted. The code comes
   first in the email (v0.11). This template's link works even when the
   email is opened on a different phone or computer, and it includes a 6-digit code
   players can type into the game instead. The link opens a page with a **Continue** button
   and signs in only when it's tapped, so email security scanners that open links first can't
   use up the one-time link (the "link expired" problem).
6. **Project Settings → API**: copy the Project URL and the `anon` public key.
7. **Google sign-in (v0.2, optional)**: **Authentication → Sign In / Providers → Google**.
   Turn it on and paste a Google OAuth client ID and secret (create them in Google Cloud
   Console → APIs & Services → Credentials → OAuth client ID → Web application, with the
   redirect URI Supabase shows on that page). Until this is done, the "Continue with Google"
   button says Google isn't switched on yet and email keeps working.
   **Test it in the installed app too (v0.11):** add the game to the home screen, open it from
   the icon, tap Continue with Google and check you land back in the app signed in. On iPhone the
   Google page opens in a browser sheet; if you end up signed in there but not in the app, sign in
   with the email code instead (the installed app asks for the code first, see below) and tell us.
   **The installed app uses the code (v0.11):** an email link always opens the browser, not the
   app, so inside the installed app the sign-up sheet asks for the 6-digit code from the same
   email. The template in step 5 must include `{{ .Token }}` (it does).
8. **Realtime (v0.2)**: the "people online" pill uses Supabase Realtime presence, which is on by
   default. Nothing to set up.
9. **The city (v0.3)**: run `0004_the_city.sql`, `0005_monthly_bills.sql` and `0006_home_layout.sql`. Until it runs, the game still opens and the
   city screens show "Coming soon". The economy content (places, prices, Shop) lives in
   `game_settings` row `city`; regenerate it from `lib/city.ts` with
   `node --experimental-strip-types scripts/gen-city-seed.ts` in a new migration when it changes.
10. **Time travel (staging only)**: to test a week of play, use a separate staging project and run
    `update game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';`
    A red-pink "⏩" pill then moves the game clock for everyone on that project, and (from v0.4)
    can start the Sarah Bird story on any day and unlock the side stories for your account.
    Since migration 0049 only a Story Studio admin (the `story_admins` table, step 11) can use it, it only
    unlocks story arcs, and the live site (Vercel production) refuses it. Never switch it on in production.
11. **Stories (v0.4)**: run `0007_world_state.sql`. It adds the World State tables, the News app's
    functions and Sarah Bird with her three side stories (approved, not scheduled). Then make
    yourself a story admin so you can use the Story Studio at `/studio`:
    `insert into story_admins (user_id) select id from auth.users where email = 'you@example.com';`
    The Studio's email and Google sign-in come back through `/auth/callback?next=/studio`, which the
    redirect URLs in step 1 already cover. How to add, approve, schedule and pause stories:
    `docs/STORIES.md`.

> Supabase's built-in email sender is rate-limited (a few emails an hour) and meant for
> testing. Before sharing the link widely, add an SMTP provider under
> **Authentication → Emails → SMTP Settings** (Resend, Postmark or similar).

### Which migrations have run?

Paste `scripts/migration-status.sql` into the SQL Editor and press Run. It's read-only (it changes nothing) and lists every
migration as **run**, **NOT RUN** (listed first) or **repair file** (safe to run again). Run only the NOT RUN files, oldest
first. Don't re-run a file that says **run**: most just stop with "already exists", but the ones that refresh the city
(places, shop, prices) would put back an older city over a newer one.

## 2. Vercel

1. Import the GitHub repository at vercel.com/new. Framework: Next.js (auto-detected).
2. **Project → Settings → Environment Variables.** Add each, ticking Production and Preview:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` public key |
   | `NEXT_PUBLIC_SITE_URL` | Your live address, used in invite links. Production only; leave it off Preview so previews use their own address |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (section 2b). Secret: never in a `NEXT_PUBLIC_` variable. Payments and the automatic gossip weeks need it |
   | `STRIPE_SECRET_KEY` | `sk_test_…` (section 2b) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` (section 2b) |

3. Deploy. Every merge to the main branch redeploys automatically; every pull request
   gets a preview link. **After adding or changing a variable, redeploy** (Deployments → ⋯ on
   the latest → Redeploy): variables only reach new deployments.
4. Check Supabase **Authentication → URL Configuration** (section 1, step 4) lists the live
   address and the preview pattern.

## 2b. Payments (v0.5, Stripe test mode)

Real-money purchases go through hosted Stripe Checkout; only Stripe's webhook unlocks what was
bought, and a refund locks it again. Until these are set, the Unlock buttons say purchases
aren't switched on and nothing is charged. Stay in **test mode** until v1.0.

1. Run `supabase/migrations/0008_payments.sql` in the SQL Editor. It adds the catalog
   (`store_products`, with the three side stories at $2.99), purchases and the webhook log.
2. In the Stripe dashboard, switch on **Test mode** (top right), then **Developers → API keys**:
   copy the **Secret key** (`sk_test_…`). You don't create products in Stripe: prices come from
   `store_products` (see the end of this section).
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your site>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.expired`, `charge.refunded`, and (unlimited chat's monthly plan, migration
     0047) `customer.subscription.updated`, `customer.subscription.deleted`, and (VIP renewals in
     the Studio's Insights, migration 0053) `invoice.paid`, and (chargebacks, migration 0125)
     `charge.dispute.created` and `charge.dispute.closed`
   - Chargebacks (migration 0125): an open dispute is only recorded; a lost one removes what the payment bought, like
     a full refund, takes back a creator's commission on it, and for a VIP charge cancels the player's subscription
     (the key needs write access to Subscriptions and read access to Charges); a won one changes nothing.
   - Creator commissions (migration 0088) use these same events: no new ones. For a referred player the webhook
     reads Stripe's fee from the payment's balance transaction (the restricted key, if you use one, needs read
     access to PaymentIntents, Charges, Balance transactions and Invoices); when it can't, it estimates 2.9% + 30¢
     and the Studio marks that row with an asterisk.
   - Copy its **Signing secret** (`whsec_…`).
4. **EU/UK withdrawal tick box** (owner, Oct 27): Settings → Business → **Public details** → set **Terms of service** to
   `https://cloutcity.app/terms` (in live and in Sandbox). Checkout then shows a box buyers must tick: they want the
   purchase right away and lose the 14-day right to withdraw. Until it's set, checkout still works and shows the same
   words beside the pay button (the server logs a reminder).
   - Vercel preview links sit behind Vercel's login by default, which Stripe can't pass. Point
     the webhook at the production address, or add a second endpoint for a preview with
     **Deployment Protection** off for it.
4. In Supabase, **Project Settings → API**: copy the **service_role** key. It lets the webhook
   grant purchases; keep it secret (server only, never in a `NEXT_PUBLIC_` variable).
5. In Vercel, add three environment variables (Production and Preview), then redeploy:
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…`
   - `SUPABASE_SERVICE_ROLE_KEY` = the service_role key
6. Test: open a side story in the News app → **Unlock for $2.99** → pay with card
   `4242 4242 4242 4242`, any future date, any CVC. Back in the game it shows "Unlocking…" until
   the webhook lands, then the chapters open. Refund the payment in Stripe (**Payments → Refund**,
   full amount) and the side story locks again.
   **If it never unlocks:** Stripe → Developers → Webhooks → your endpoint → Event deliveries.
   A 400 there means the signing secret is wrong; a 500 usually means `SUPABASE_SERVICE_ROLE_KEY`
   is missing or wrong in Vercel (or the deployment wasn't redeployed after adding it).

7. Run `supabase/migrations/0009_money_wave3.sql`. It adds location wave 3 (two monuments, the
   lounge, the boutique and the dealership) and the other three products: monument postcards
   ($1.99 since migration 0086, after a visit), two collector fashion pieces ($4.99 and $3.99) and two exclusive
   parties at the lounge, this coming Friday and Saturday, 10 PM to 2 AM New York time.

8. Run `supabase/migrations/0010_social.sql`. It switches on chat in the Phone's Messages app
   (10 messages a day, a word filter, block and report), player cards from the leaderboard, the
   chat review queue and the metrics dashboard (both in the Studio at `/studio`, for the same
   admins as stories), and the analytics they read. The daily limit, the mute length and the
   filtered words live in `game_settings` row `chat`; add words there, one lowercase word each.

9. Run `supabase/migrations/0011_dating.sql`. It switches on crushes and date nights
   (Clarifications section 14): a heart on crew members' profile cards and on two-way chats
   (3 crushes each, revealed only when mutual), "Make it a date" on restaurants and club nights,
   and a **Date nights** row at the top of Messages. When both players have gone, each gets
   +10 Mood and +25 clout, once a day. Blocking someone cancels crushes and dates between you.
   The limits and the bonus live in `game_settings` row `dating`.

10. Run `supabase/migrations/0012_universities.sql`. It adds the two parody universities,
   St. Johnsons University (Jamaica) and Queensborough University (Flushing): a free lecture
   (Energy for Confidence and 15 clout, once a day) and a campus event at each.

11. Run `supabase/migrations/0013_crew_outings.sql`. It switches on crew outings: "Bring the crew"
    on place cards, Crew plans in Messages, +10 clout per friend who goes too and +100 clout and
    +10 Mood when the whole crew (host + 5) goes. Tunable in `game_settings` row `crew`.

12. **Meeting players** (migration 0047). Run `supabase/migrations/0047_meet_players.sql`. Players at
    the same place see each other in the room and on place cards, react for free and send 20
    messages a day. **Unlimited chat** is three products in `store_products` (prices from migration
    0051): `chat-unlimited-monthly` ($4.99 a month) and `chat-unlimited-yearly` ($39.99 a year), both
    Stripe subscriptions, and `chat-unlimited-forever` ($119.99 once). Nothing to create in Stripe:
    Checkout builds each price from `store_products`. (If you'd rather manage Prices in Stripe, make a
    recurring monthly Price, a recurring yearly Price and a one-time Price, and put each one's `price_...`
    id in that product's `stripe_price_id`. 0051 clears the forever product's old $39.99 Price id.)
    Players who already bought Forever at $39.99 keep it. Migration 0052 renames the monthly and yearly
    plans **VIP**: members also get every side story free while subscribed, and a VIP badge; forever stays chat only. **Add the two subscription events to the
    webhook (step 3)**, or a cancelled membership would keep unlimited chat.
    Test: run out of messages (20 in Messages), pick **Monthly**, pay with `4242 4242 4242 4242`.
    Chat says "✨ Unlimited chat". Then Stripe → **Customers** → the test customer → the
    subscription → **Cancel subscription → Immediately**: the webhook revokes it and the 20-a-day
    limit is back. (A failed renewal does the same once Stripe gives up retrying.)

**Adding a party** (an exclusive event) in the SQL Editor; times are New York time:

```sql
insert into store_products (sku, product_type, name, price_cents, place_id)
values ('event-my-party', 'exclusive_event', 'My party', 399, 'low-light-lounge');
insert into exclusive_events (id, sku, place_id, name, host, blurb, starts_at, ends_at, clout, energy, mood, confidence)
values ('my-party', 'event-my-party', 'low-light-lounge', 'My party', 'Host name', 'One funny line about it.',
        '2026-11-06 22:00 America/New_York', '2026-11-07 02:00 America/New_York', 100, 20, 10, 10);
```

The ticket pays the clout (with diminishing returns); going to the party raises Mood and
Confidence. Ended parties leave the Events list on their own.

Prices are config: `store_products.price_cents` (shown and charged). To charge a Price you
created in Stripe instead, set `store_products.stripe_price_id`. Don't change a price on a story
players are following. Before going live: check **Stripe Tax** settings for digital goods.

**Skills** (migration 0056): a **Skills** tab on the profile: Cooking, Aura (stored as charisma), Fitness, Smarts, Music,
Hustle, Dance, Gossip and Photography, 0 to 10. Players practice by doing things (visits by the place's
tags, club and campus events, shifts and gigs, gossip, dates and crew plans, chatting, cooking). A new
level pays 10 × the level in clout once; levels 5 and 10 earn a badge; player cards show the top three.
Skills unused for 7 days slowly rust (a level every 20 days, never more than 2 under the best).

**Players** (migration 0055): the Studio's **Players** tab lists everyone who made a character (search by
@handle or email; filters for new, active, paying, VIP, reported, banned and never moved in). Open one for
their profile, numbers, recent sessions, safety record and activity (every cash and clout change, purchases,
reports, bans). **Ban** asks for a reason; the player sees the suspended screen next time they open the game.
**Unban** undoes it. Both are logged. Chat texts stay private (counts only); reported chats are in Reports.

**Insights** (migration 0053): the Studio's **Insights** tab shows players, sign-ups, active
players, revenue, session length, retention (next day, day 7, day 30), first steps, feature use,
revenue by product and players by rank, for the last 7, 30 or 90 New York days. Studio admins only
(`admin_insights()`). Session length comes from the game pinging `session_ping()` once a minute while
it's open and visible (a gap over 5 minutes starts a new session), so it starts counting the day 0053
runs. Monthly and yearly VIP renewals count once the webhook gets `invoice.paid` (step 3); the first
payment of each membership already counts as a purchase.

**Membership & purchases** (migration 0079, owner Oct 18). Run `supabase/migrations/0079_membership.sql`.
Phone → Settings (top row) and the profile (the 👑 line under the name) open a screen with the player's VIP
plan, its renewal date, chat forever and every real-money purchase. **Manage billing** opens Stripe's billing
portal. Set the portal up once in Stripe (**Settings → Billing → Customer portal**, in test mode and again in
live mode):
- **Cancellations**: on, **At end of billing period** (VIP runs to the end of what the player paid for; the
  webhook ends it when Stripe does). Turn on the cancellation reason survey if you like.
- **Subscriptions → Customers can switch plans**: on. Switching needs real Prices: in **Product catalog**, create
  one product "Clout City VIP" with a $4.99 monthly and a $39.99 yearly recurring price, put each `price_…` id in
  `store_products.stripe_price_id` for `chat-unlimited-monthly` and `chat-unlimited-yearly` (step 12), and add
  that product here. Memberships bought before that (on Checkout's one-off prices) may not offer the switch.
  Proration: your call (Stripe's default prorates).
- **Payment methods**: customers can update them. **Invoice history**: on.
- **Business information**: your terms and privacy links (`/terms`, `/privacy`) and a support email.
- **Default redirect link**: leave empty (the game sends players back to `/home?membership=back`).
The webhook saves each buyer's Stripe customer from now on (nothing new to add to the endpoint's events), and
one-off purchases now create a customer too. Buyers from before 0079 are found once, from their subscription or
checkout. Test: buy VIP monthly with `4242 4242 4242 4242`, open Settings → **Membership & purchases** →
**Manage billing**, cancel: back in the game it says "Cancelled · you're VIP until …" and VIP stays on until
then. **Renew** in the portal turns it back.

## 2c. Clout TV photo storage (v0.14, migration 0058)

Migration 0058 tries to create the private `big-screen` storage bucket and its three policies itself. If the
SQL editor shows a warning starting "Clout TV: could not…" (Supabase doesn't let the SQL editor change
storage on some projects), the rest of the migration still ran; add the storage part in the dashboard:

1. **Storage → New bucket**: name `big-screen`, **Public bucket off**, file size limit **5 MB**, allowed MIME
   types `image/jpeg, image/png, image/webp`.
2. **Storage → Policies → big-screen → New policy → For full customization**, three times (target role
   `authenticated` each time):
   - **Upload to your own folder**, operation INSERT, with check:
     `bucket_id = 'big-screen' and split_part(name, '/', 1) = auth.uid()::text`
   - **Your own, features and admins**, operation SELECT, using:
     `bucket_id = 'big-screen' and (split_part(name, '/', 1) = auth.uid()::text or public.tv_photo_public(name) or public.is_story_admin())`
   - **Delete your own**, operation DELETE, using:
     `bucket_id = 'big-screen' and split_part(name, '/', 1) = auth.uid()::text`

Run 0057 (Real Clout FM) before 0058. Both are safe to run again.

## 2d. Push notifications (migration 0078)

Push needs a key pair (VAPID), a secret for the sender's cron, and a schedule.

1. **Make the keys** on your computer: `npx web-push generate-vapid-keys`. It prints a public and a private key.
2. In **Vercel → Settings → Environment Variables** (Production and Preview), add:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: the public key.
   - `VAPID_PRIVATE_KEY`: the private key. Never commit it or paste it anywhere public.
   - `VAPID_SUBJECT`: `mailto:` plus an address you read, e.g. `mailto:hello@yourdomain.com`.
   - `CRON_SECRET`: any long random string (`openssl rand -hex 32`).
   Redeploy after adding them. Keep the same keys forever: new keys log every device out of notifications.
3. **Schedule the sender** every 5 minutes, calling `https://<your-domain>/api/push/run` with the header
   `Authorization: Bearer <CRON_SECRET>`:
   - **Vercel Pro**: add a cron in `vercel.json` (`{"crons":[{"path":"/api/push/run","schedule":"*/5 * * * *"}]}`); Vercel
     sends the header for you. (Vercel Hobby only allows daily crons, which is too slow.)
   - **Or Supabase (free)**: Integrations → Cron → new job every 5 minutes, type "HTTP request", POST to the URL above
     with that header.
   Game traffic also runs the sender (at most once a minute per server), so chats and invites go out even before the
   cron is set up; the cron covers quiet times (morning roundups, streak reminders, players who are away).
4. **Run `supabase/migrations/0082_push_triggers.sql`** (step 2). Messages, matches, date, crew, ride and together
   invites and friends joining queue a push the moment they happen. Bills, gigs ready, full tills, streaks about to end,
   exams and party tickets are found by `push_scan()`, which the scheduled sender runs first, so those need the
   schedule in step 3. Then run `0083_push_rewards.sql` (step 3: rewards, on air and on screen, the morning
   roundup and win-back; also from the schedule), and `0084_push_tonight.sql` (a date tonight, the crew is there, party
   night, a guest pass tonight). A tap opens the game on the right screen (`/home?open=messages|bills|gigs|tasks|events|businesses`).
5. **Test**: in the game, Phone → Settings → Notifications → On, then **Send a test notification**. On iPhone this only
   works from the Home Screen app (iOS 16.4 or later).

## 2e. Shop pictures (the Shop Manager, migration 0099)

Migration 0099 creates two Storage buckets: **shop** (public: the 256 px and 768 px WebP pictures players see) and
**shop-masters** (private: the original PNGs, never sent to players). If the SQL Editor can't create them (it warns),
create both in Supabase → Storage with those names, `shop` public and `shop-masters` private.

**The pictures ship with the game** (Oct 21): `npm run build:shop-images` downloads every `sourceImage` in
`content/shop/*.json`, processes it the same way and saves the two WebPs in `public/shop-img/`, with
`lib/shopImagesStatic.ts` mapping each item to them. So items already on sale show their pictures as soon as the code is
deployed (even before migration 0099), and the Studio's **Load** uses the shipped pictures instantly instead of
processing again. Run the script again after adding a catalog file (it keeps pictures already made). New items still
need **Approve** in the Studio to go on sale.

A picture that isn't shipped (a new link edited in the Studio) is processed and uploaded by the server with `SUPABASE_SERVICE_ROLE_KEY` (already set for payments). In the
Studio: **Shop** → **Load** a catalog file → the pictures process with a progress bar → review and approve. The free
Supabase plan includes about 1 GB of storage and 5 GB of downloads a month; every Shop picture together is roughly
15 MB.

## 2f. Analytics (PostHog, owner Oct 27)

1. In Vercel → Settings → Environment Variables: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (PostHog → Project settings →
   Project token, starts with `phc_`) and `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com` or
   `https://eu.i.posthog.com`, whichever region the project is in). Redeploy after adding them: `NEXT_PUBLIC_` values
   are baked in at build time.
2. In PostHog → Project settings → Session replay: switch **Record user sessions** on. The game masks every input and
   anything marked `ph-sensitive` (chats, Mayor letters, shoutouts, notes) on the device before it's sent.
3. Without the token (local development, previews) nothing starts. The Story Studio never sends anything.
4. Delete my account (migration 0124) also deletes the player's PostHog person and events when the server has
   `POSTHOG_PERSONAL_API_KEY` (PostHog → Settings → Personal API keys, with "person: write") and `POSTHOG_PROJECT_ID`
   (the number in the project's URL). Without them, delete the person by hand in PostHog → People (search the
   player's id) when someone deletes their account.

Checking it works: open the live game in a normal browser (PostHog ignores bots and automated browsers), then PostHog →
Activity (or Web analytics): a `$pageview` appears within a minute. Sign in and play: the person shows under People with
the Supabase user id; the custom events are listed in `lib/analyticsEvents.ts`. Replays appear under Session replay a few
minutes after a session ends.

## 2g. Rate limits (migration 0126)

Running 0126 switches the limits on by itself (it sets `pgrst.db_pre_request` on the `authenticator` role and reloads the
API). The numbers are in `game_settings` 'rate_limits' (edit the row to change them; no deploy needed). To switch them off
in an emergency, run in the SQL Editor:

```sql
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
```

Running 0126 again (or the `alter role ... set` line in it) switches them back on.

## 2h. Steam (docs/STEAM.md, migration 0133)

Only needed for the Steam app. Without these, the Steam app still opens the game but Steam sign-in says it isn't on.

| Vercel variable | Where it comes from |
|---|---|
| `STEAM_APP_ID` | Steamworks → your app's number (the App ID). |
| `STEAM_WEB_API_KEY` | Steamworks → Users & Permissions → Manage Groups → your group → **Create WebAPI Key** (a *publisher* key, not a personal one). Server only: never put it in `NEXT_PUBLIC_*`. |

Run migration 0133 before turning Steam sign-in on.

## 3. Local development (optional)

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev                  # http://localhost:3000
```

## v0.1 test checklist (from the milestones doc)

- [ ] A link opened in a fresh browser lands on the map, with no sign-up wall.
- [ ] Tapping anything opens sign-up; the 18+ box must be ticked to continue.
- [ ] The magic-link email arrives, and signing in works on phone and computer.
- [ ] A friend signing up through your invite link shows up in your crew count.
- [ ] Choosing a style changes the character instantly.
- [ ] Every unbuilt icon and tab shows "Coming soon"; nothing is broken or blank.
- [ ] It runs smoothly on a low-end Android phone.
