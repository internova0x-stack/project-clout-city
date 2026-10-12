# Clout City

Mobile-first browser life game: arrive in New York as a nobody and chase clout.

**Current version: v0.1 "Tap In"** (see `docs/07-milestones-and-versions.md`).

## Read first
- `docs/01-game-concept-note.md`: the big picture.
- `docs/02-clarifications-and-updates-v2.md`: game rules and P1 scope. **Wins on rules.**
- `docs/03-world-state-layer-brief-v2.md`: story engine. **Wins on the World State layer.**
- `docs/05-design-system-guide-v2.md`: UI tokens and components C1 to C39.
- `docs/07-milestones-and-versions.md`: what ships in which version. Build only the
  current version's "In scope" list; anything else gets a "Coming soon" card.
- `docs/SETUP.md`: Supabase, email template and Vercel setup.

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

## Rules for this codebase
- Player data is permanent from day one: change the schema only with a new file in
  `supabase/migrations/`, never by editing an applied one.
- Writes to `players`/`invites` go through security-definer SQL functions; RLS
  blocks direct writes.
- Tunable numbers live in `lib/config.ts`, not in components.
- Game data stores real lat/lng (`lib/map/geo.ts`); the map is swappable behind
  the `MapApi` interface in `components/map/CityMap.tsx`.
- Gold (`--gold-*`, `--g-gold`) is only for real-money products, the logo and the tagline.
- No real brand names; businesses are invented. Copy is satirical and never
  promises features that aren't built.
- Modules imported by tests use explicit `.ts` extensions for their own imports.
