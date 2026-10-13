# Clout City: Milestones and Versions

Oct 12, 2026 · @Internovatechnologies

This document splits the Clout City build into versions that each go live on their own, starting with a playable teaser in 24 hours. The other documents define what the full game is; this one decides what ships when. If a feature isn't in the current version's scope here, it waits.

**Rules every version follows**

1. **Every version is live and usable.** It runs at the real web address, works on a low-end Android phone, and nothing on screen is broken; unfinished features show a "Coming soon" card instead.
2. **Player data is built properly from day one.** Accounts, profiles, invite records and anything else a player creates must carry into every later version. Only visuals and placeholder content may be quick and temporary.
3. **Rules come from the documents.** Each version builds a subset of the specs, never a different version of them. If a version needs a rule to change, the document changes first.
4. **Nothing is promised that isn't built.** Copy never implies a feature exists before it does.
5. **One version at a time.** A version is done when its tests pass on your phone and you've merged it; only then does the next one start.

## Version overview

Six versions take the game from a 24-hour teaser to launch in roughly 8 to 12 weeks. Each version corresponds to milestones in the Build Guide.

| Version | Name | What players get | Time | Build Guide milestone |
| --- | --- | --- | --- | --- |
| v0.1 | Tap In | Browse Queens, sign up, make a character, see their home, invite friends | 24 hours | Parts of 1 and 2 |
| v0.2 | First Party | The tutorial, the first party, clout, the leaderboard, invite rewards | About 1 week | Rest of 1 and 2 |
| v0.3 | The City | The first 8 locations, dining and Energy, jobs and gigs, the Shop, Net Worth (then called Possessions), bills | 1.5 to 2 weeks | 3 |
| v0.4 | Stories | The News app and Sarah Bird, built and tested but not yet started | 1 to 2 weeks | 4 |
| v0.5 | Money and Social | Real-money purchases, postcards, chat, crushes and date nights | 1 to 2 weeks | 5 |
| v0.5.1 | Testing fixes | The "fix now" list from testing (docs/testing-feedback.md) | Days | — |
| v0.6 | Astoria and the News | A busy Astoria starting neighborhood, the recurring cast and people at places, the News feed, weekly treasure hunts | 2 to 3 weeks | — |
| v0.7 | Look and Feel | Creator, profile, Your Look dressing room, buttons, locked boroughs, Collection redesign | About 1 week | — |
| v0.8 | Getting Around | Travel and arrival, venue drinks, Nap and Sit, groceries and home cooking, weekly bills, event times | 1 to 2 weeks | — |
| v0.9 | Big Nights | Exclusive event keepsakes, monuments as full locations | About 1 week | — |
| v1.0 | Launch | Real art, security review, soft launch, then the story pilot | 1 to 2 weeks | 6 |

### Location rollout

The 34 locations in Clarifications section 4 remain the P1 target, but they arrive in four waves, so each version only needs art for the places it uses.

| Wave | Ships with | Places | Interior templates needed |
| --- | --- | --- | --- |
| 1 | v0.3 | **Full:** apartment (the three starter homes share it), club, café (medium dining and the barista job), bodega (budget dining). **Scene cards:** rooftop restaurant (luxury dining), Flushing Meadows Corona Park, delivery-rider hub, office tower (gigs board) | 4: apartment, club, diner or café, counter shop |
| 2 | v0.4 | Sarah Bird's story places as scene cards: Skyline Pier Residences, Hunter's Pier, Rockaway Diner, Radiant Harbor Church, Pressed Iron Gym | None |
| 3 | v0.5 | Two monuments (for postcards), a lounge, the fashion boutique, the car dealership, and the two parody universities (St. Johnsons University and Queensborough University, brought forward from wave 4 on Oct 13, 2026) | Fine dining (for the lounge), store, campus |
| 4 | v1.0 or after launch | The other two monuments, civic places, the remaining parks and food spots, the retail store, map-flavor labels | Office |

**Rollout rules**

1. **Unbuilt places don't appear on the map.** New places arrive with a short "New in Queens" announcement. The one exception is v0.1, which shows wave 1 places as pins only, before their cards exist.
2. **Adding a place is content only.** The location system is built from data in v0.3, so each later wave is new data and art, never new code.
3. **Daily tasks draw only from places that exist,** so fewer places means less variety, never a broken task.
4. **Wave 4 can become post-launch content drops** if v1.0 needs to ship sooner.

## v0.1 "Tap In" (24 hours)

An early-access teaser: claim your name, see your character at home, and recruit your crew before the city opens. Share it with a small group, framed honestly as early access, not a finished game.

### In scope

| Feature | What it does | Spec it follows |
| --- | --- | --- |
| Guest 2D map | One illustrated night map of Queens with pan and zoom, pins for 6 wave 1 places (club, café, bodega, rooftop restaurant, park, office tower), and the other boroughs as locked silhouettes with "Locked: Coming soon." Tapping a pin or any icon opens sign-up. | Clarifications 1 and 4 (simplified); Design Guide C19 to C21 |
| Sign-up | Email sign-in by magic link (no password), the 18+ confirmation checkbox, and links to the terms and privacy pages | Clarifications 1 and 13 |
| Invite capture | An invite link's code is kept through sign-up, so every friend who joins is credited to the right person | Clarifications 7 |
| Mini creator | Pick a name and one of the eight starting styles; the 3D character updates instantly | Clarifications 1 (Look step only) |
| Home screen | The HUD, side icon column, stats panel and nav bar in place. Home and Map work; every other icon and tab opens a witty "Coming soon" card. Money and clout show "—" until v0.2. | Clarifications 2; Design Guide C1 to C5 |
| 3D character at home | A ready-made 3D character (a free CC0 model or a purchased one) standing in one illustrated apartment backdrop, with an idle animation | Design Guide C38 and section 11 |
| Invite screen | "Invite your Crew" opens a personal link with a share button and a count of friends who've joined ("2 of 5"), with "Rewards unlock when the city opens" | Clarifications 7 |
| Legal pages | Basic terms of service and privacy policy, marked for lawyer review before v1.0 | Build Guide |

### Not in v0.1

The tutorial, the party, clout and the leaderboard, Google sign-in, the birth lottery and traits, moving vehicles, locations with actions, the economy, stories, payments, chat, music and the install prompt.

### The 24-hour plan

| Hours | Who | Work |
| --- | --- | --- |
| 0 to 2 | You | Create the GitHub repository with the docs and CLAUDE.md, plus Vercel and Supabase accounts. Download a free 3D character, and generate the map image and the apartment backdrop with your style prompt. |
| 2 to 5 | Claude Code | App setup, design tokens and fonts, Supabase connection, the player, profile and invite tables, and auto-deploy to Vercel |
| 5 to 9 | Claude Code | The guest map, locked boroughs, sign-up with the 18+ checkbox, and invite capture |
| 9 to 14 | Claude Code | The home screen shell and the mini creator |
| 14 to 18 | Claude Code | The 3D character in the apartment backdrop |
| 18 to 21 | Claude Code | The invite screen and the legal pages |
| 21 to 24 | You, with Claude Code | Test on your phone and a cheap Android phone, fix, merge, and share the live link |

Review each block's pull request on your phone before the next one starts. If a block runs long, cut from the bottom of the in-scope list (the stats panel, then the invite count) rather than skipping tests.

### Test checklist

- [ ] A link opened in a fresh browser lands on the map, with no sign-up wall.
- [ ] Tapping anything opens sign-up; the 18+ box must be ticked to continue.
- [ ] The magic-link email arrives, and signing in works on phone and computer.
- [ ] A friend signing up through your invite link shows up in your crew count.
- [ ] Choosing a style changes the character instantly.
- [ ] Every unbuilt icon and tab shows "Coming soon"; nothing is broken or blank.
- [ ] It runs smoothly on a low-end Android phone.

## v0.2 "First Party" (about 1 week)

The complete first session from Clarifications section 1: a new player goes from link to party to leaderboard, and gets their first clout.

**In scope**

- The rest of the creator: Traits, the Birth lottery ($6,000 to $10,000) and the Home step, with the three starter apartments.
- The welcome screen and the five tutorial tooltips.
- The first-task party, with "Bring the crew" and "Pull up solo," the completion card, cash and clout.
- Real clout, bank balance and net worth in the HUD; the leaderboard (Queens and Crew).
- **Invite rewards:** clout per friend who signs up, and the five-friend bonus, **paid retroactively** for everyone invited during v0.1.
- Google sign-in, the invite prompt after the party, the install (PWA) prompt, background music with mute, and the players-online pill.

**Players from v0.1:** on their next visit they complete the Traits, Birth lottery and Home steps, then get the tutorial. Their name, style and crew carry over.

**You test:** a friend with no help goes from the link through the creator, tutorial and party to the leaderboard; v0.1 players are upgraded without losing anything; invite clout appears correctly.

## v0.3 "The City" (1.5 to 2 weeks)

Queens becomes a place to live: the full daily loop of earning, eating, spending and climbing.

**In scope**

- The location system (cards, lore and actions, built from data), with location wave 1: 8 places and 4 illustrated interior templates (see Location rollout). Placeholder images are fine; real art arrives by v1.0.
- Moving vehicles on the map when zoomed in.
- Energy, Mood and Confidence rules, including the daily top-up and Confidence drift (Clarifications section 13).
- Dining in three tiers; job shifts; gigs in three tiers through the Gigs app.
- Daily tasks paying cash, place cooldowns, and club events.
- The Shop (five categories), Net Worth (then called Possessions) with 60% selling, bills, and the missed-rent rules.
- The two clocks: the city clock for day and night, and the New York calendar for resets and bills.

**You test:** a week of play using the time-travel tool. Rent is affordable from shifts and tasks but not everything is; a big break feels like a real step up; no daily task is ever impossible. Tune the economy with the gigs spreadsheet before moving on.

## v0.4 "Stories" (1 to 2 weeks)

The story system is built and Sarah Bird is fully loaded, but the pilot doesn't start yet; its start date is set in v1.0.

**In scope**

- The full World State layer: effects, reason banners, chatter, story tasks, story gigs and free story events such as the vigil (World State Layer Brief).
- The News app: beat cards, "Previously" lines, late-joiner catch-up, the archive and shadow guesses.
- Predictions with live poll results, close and reveal, rewards and badges.
- Sarah Bird's main arc as data, with the pause and retire switches, and location wave 2: her five story places as scene cards.
- The validation script, plus the time-travel and debug tools used for the dry run.

**You test:** step through all 10 days with the time-travel tool. Every beat, effect, chatter phase and prediction fires on the right day, voting closes before Beat 8, and the validation script passes.

## v0.5 "Money and Social" (1 to 2 weeks)

Real-money purchases and player-to-player chat, all in Stripe test mode until v1.0.

**In scope**

- One Stripe Checkout flow for all four products: exclusive events, collector fashion items, Sarah Bird's three side arcs, and monument postcards (Story Production and Payments Brief).
- Entitlements by SKU, refunds with clout clawback, and the Collection screen for postcards.
- Exclusive events in the Events list, and location wave 3: two monuments, a lounge, the fashion boutique and the car dealership.
- Chat in the Messages app: 10 messages a day, the word filter, block, report, and the admin review queue. Then crushes (mutual only), crush invites and date nights on top of it (Clarifications section 14), and crew outings: "Bring the crew" on any place, with bonuses when friends go too (Clarifications section 15).
- Analytics for the success metrics: first task, invites, day-1 return, beat opens, predictions and purchases.

**You test:** every product's test purchase unlocks it, a replayed payment doesn't duplicate it, and a refund removes it (and its clout). A report sent from chat appears in the admin queue. A mutual crush shows the "It's mutual" card to both players, a one-sided crush shows nothing, and a date night pays its bonus only after both players have gone.

## v0.5.1 "Testing fixes" (days)

From the Oct 13 testing round. **docs/testing-feedback.md is the source** for the bug numbers, fixes and decisions; it wins over older text in these docs.

**In scope:** bugs #1, #5, #12, #15, #16, #22, #30, #36, #37, #38, #41, #42, #43 and #47, shipped in pull requests grouped by cause. **Done** (pull requests #3 to #7, Oct 13), plus usernames, the Presenting as toggle, per-presentation starter outfits and bill progress bars added by the owner along the way.

**You test:** on an iPhone and a low-end Android phone, every listed bug is gone; prices read C$ everywhere except real-money products ($); no sheet gets stuck open; the page never scrolls sideways or up.

## v0.6 "Astoria and the News" (2 to 3 weeks)

From the Oct 13 features spec. **docs/08-new-features-spec.md is the source** for these rules.

**In scope:** the dense Astoria starting neighborhood of about 20 places, new ones added in Astoria alongside the places already there, nothing moved (section 5); the recurring cast (eight invented celebrities, the wannabes, the story regulars) and NPCs at places with rotating lines tied to story phase and cast news (section 4); the News feed with city news, Lola's weekly dating column and the hunt announcement, headlines in the live ticker and the home-screen card (section 3); weekly treasure hunts in their full form, with a track per starting style, NPC clues, questions, hunt cards, rewards and a badge after four (section 1); and in the Story Studio, hunt and news review, the content calendar, and pause for hunts and news (section 2).

**You test:** a new player lands in Astoria with about 20 places close by; tapping a regular at a place shows a line; News has something new each day and the ticker and home card show the newest headline; joining a hunt, following the NPC clues and answering the questions unlocks the hunt card; nothing about a hunt shows for players who haven't joined; a week of hunts and news can be approved, scheduled and paused in the Studio.

## v0.7 "Look and Feel" (about 1 week)

**In scope** (docs/testing-feedback.md, formerly listed as v0.2): red main buttons with yellow as an accent and outlined-red destructive buttons (#10); locked boroughs with a dashed red outline and a mini-map sheet with a Lola teaser (#7, #8, #11); the creator's name field, Presenting as (cosmetic only), four body types each, free basic headwear first and starter garment choices, and a Monument Valley starting-cash card (#43 to #46); the avatar-head bubble and full profile with public net worth (#25, #39); the stats panel starting collapsed with a suggested action per stat (#14); Your Look as a dressing room with try-on (#24); the Collection redesign (#40); and the cosmetic and UX items marked for v0.2 in the bug list (#2, #6, #20, #21, #28, #29, #31, #34, #35).

## v0.8 "Getting Around" (1 to 2 weeks)

**In scope** (formerly v0.3): no spending before arriving, "Go there" with walk, subway, taxi or own car priced by distance, a skippable trip view and personal timers that never move the shared city clock (#4); a luxury-priced drink or snack at clubs and lounges (#3); Nap and Sit at home, capped per day (#26, #27); weekly rent and bills, re-tuned with starting cash and income (#23); exclusive and one-off event times shown in the player's local time (#18); the supermarket, fridge and home cooking (docs/08-new-features-spec.md section 6).

## v0.9 "Big Nights" (about 1 week)

**In scope** (formerly v0.5): exclusive event keepsakes (event card, profile badge, plus-one, personal news mention, opt-out) with the ticket's clout kept and attending's stats in line with club events (#19); monuments as full locations with a shared 3D landmark plaza, NPCs and 4 to 6 activities (#32).

## v1.0 "Launch" (1 to 2 weeks, then the soft launch)

The finished P1: real art in place, outside reviews done, then a soft launch followed by the Sarah Bird pilot.

**In scope**

- Real art swapped in for everything released so far: the 3D avatar and outfits, location illustrations, interiors, postcards, the logo and icon. Location wave 4 ships here or as post-launch content drops.
- Performance work for low-end Android.
- The security review and its fixes; lawyer-reviewed terms, privacy policy and 18+ wording; monument name checks; Stripe Tax settings.
- Stripe live mode, confirmed with one real $0.99 purchase and refund.
- Every acceptance test in the Story Production and Payments Brief, and the full Sarah Bird dry run.

**Then, in order**

1. **Soft launch** to 20 to 50 people for 1 to 2 weeks; fix the top problems and tune the economy from real play.
2. **Approve the next, lighter story: the dating comedy.**
3. **Start the pilot:** set Sarah Bird's start date to a Sunday and plan the launch push around Day 1.

**You test:** every item in the Build Guide's launch checklist passes.

## Starting and shipping a version in Claude Code

Save this document in the repository's `docs` folder as `07-milestones-and-versions.md`, and add a "Current version" line to CLAUDE.md that you update each time.

**To start a version**, open a new session at claude.ai/code on the `clout-city` repository and send:

```text
Read CLAUDE.md and docs/07-milestones-and-versions.md. We're building [version and name].
Build only what's in that version's "In scope" list; anything else gets a "Coming soon" card.
First, list the steps you'll take, in plain language, and wait for my OK.
After each step, open a pull request with its Vercel preview link and what to test on my phone.
```

**To ship it:**

1. Test every item in the version's checklist on your phone and a low-end Android phone.
2. Merge the pull requests on GitHub; Vercel updates the live game automatically.
3. Ask Claude Code to write short release notes (what's new, in plain words) for your players.
4. Update "Current version" in CLAUDE.md, then start the next version.

**If a version runs long,** cut scope from the bottom of its list and move it to the next version. Never skip testing to hit a date.
