# Setting up Clout City (v0.1)

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
    A purple "⏩" pill then moves the game clock for everyone on that project. Never switch it on
    in production.

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
