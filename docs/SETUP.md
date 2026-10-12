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
   - **Site URL**: your live address, e.g. `https://cloutcity.vercel.app`.
   - **Redirect URLs**: add `https://cloutcity.vercel.app/**`, `https://*-your-team.vercel.app/**`
     (Vercel previews) and `http://localhost:3000/**`.
5. **Authentication → Email Templates**: for both **Magic Link** and **Confirm signup**,
   set the subject to `Your Clout City sign-in link` and paste the body from
   `supabase/email-templates/magic-link.html`. This template's link works even when the
   email is opened on a different phone or computer, and it includes a 6-digit code
   players can type into the game instead.
6. **Project Settings → API**: copy the Project URL and the `anon` public key.
7. **Google sign-in (v0.2, optional)**: **Authentication → Sign In / Providers → Google**.
   Turn it on and paste a Google OAuth client ID and secret (create them in Google Cloud
   Console → APIs & Services → Credentials → OAuth client ID → Web application, with the
   redirect URI Supabase shows on that page). Until this is done, the "Continue with Google"
   button says Google isn't switched on yet and email keeps working.
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
    Never switch it on in production.
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

## 2. Vercel

1. Import the GitHub repository at vercel.com/new. Framework: Next.js (auto-detected).
2. **Environment variables** (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon key.
   - `NEXT_PUBLIC_SITE_URL`: your live address (used in invite links). Leave unset on
     Preview so previews use their own address.
3. Deploy. Every merge to the main branch redeploys automatically; every pull request
   gets a preview link.

## 2b. Payments (v0.5, Stripe test mode)

Real-money purchases go through hosted Stripe Checkout; only Stripe's webhook unlocks what was
bought, and a refund locks it again. Until these are set, the Unlock buttons say purchases
aren't switched on and nothing is charged. Stay in **test mode** until v1.0.

1. Run `supabase/migrations/0008_payments.sql` in the SQL Editor. It adds the catalog
   (`store_products`, with the three side stories at $2.99), purchases and the webhook log.
2. In the Stripe dashboard, switch on **Test mode**, then **Developers → API keys**: copy the
   **Secret key** (`sk_test_…`).
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your site>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.expired`, `charge.refunded`
   - Copy its **Signing secret** (`whsec_…`).
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

7. Run `supabase/migrations/0009_money_wave3.sql`. It adds location wave 3 (two monuments, the
   lounge, the boutique and the dealership) and the other three products: monument postcards
   ($0.99, after a visit), two collector fashion pieces ($4.99 and $3.99) and two exclusive
   parties at the lounge, this coming Friday and Saturday, 10 PM to 2 AM New York time.

**Adding a party** (an exclusive event) in the SQL Editor; times are New York time:

```sql
insert into store_products (sku, product_type, name, price_cents, place_id)
values ('event-my-party', 'exclusive_event', 'My party', 499, 'low-light-lounge');
insert into exclusive_events (id, sku, place_id, name, host, blurb, starts_at, ends_at, clout, energy, mood, confidence)
values ('my-party', 'event-my-party', 'low-light-lounge', 'My party', 'Host name', 'One funny line about it.',
        '2026-11-06 22:00 America/New_York', '2026-11-07 02:00 America/New_York', 100, 20, 10, 10);
```

The ticket pays the clout (with diminishing returns); going to the party raises Mood and
Confidence. Ended parties leave the Events list on their own.

Prices are config: `store_products.price_cents` (shown and charged). To charge a Price you
created in Stripe instead, set `store_products.stripe_price_id`. Don't change a price on a story
players are following. Before going live: check **Stripe Tax** settings for digital goods.

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
- [ ] A friend signing up through your invite link shows up in your clique count.
- [ ] Choosing a style changes the character instantly.
- [ ] Every unbuilt icon and tab shows "Coming soon"; nothing is broken or blank.
- [ ] It runs smoothly on a low-end Android phone.
