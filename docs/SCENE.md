# Your Scene

The daily clout loop (owner, Nov 21: "daily grooming of clout", modelled on FarmVille's farm). Step 1 is built: migration 0171,
`lib/scene.ts`, `content/scene/moves.json`, `app/home/sceneActions.ts`, `components/scene/Scene.tsx`.

## The loop

| FarmVille | Clout City |
|---|---|
| Plots of land | **Slots**: 2, then 3 at Rank 3, 4 at Rank 5, 5 at Rank 7 |
| Planting a seed | **Starting a move** at a place that offers it (C$ and Energy) |
| Growing | The move builds in real time: 2 h, 8 h, 1 day or 3 days |
| Watering | **Hyping**: going back to that place and checking in (8 h and 1 day want 2, 3 days want 3; an hour apart) |
| Withering | **Going stale**: a ready move waits 4 to 24 hours, then pays a quarter |
| Harvest | **Collect**: clout (ledger 'scene'), points on one of six scores, the move's skill practised |
| Levels and mastery | Rank opens slots and moves; each score has five titles (Wallflower → Nightlife Legend…) |

Each missed hype takes a quarter off. A collected move rests 3 days before it's suggested again.

## Where players find it

- **The Scene tab**, in the middle of the bottom bar (Home · Map · Scene · Phone · Shop). A red dot when a move is ready or a
  hype is due. It opens a full screen: For you today (when a slot is free it comes first), the numbered slots (SLOT 1…, free
  slots dashed, the next locked one with its rank), and Known for (the six scores and titles).
- **Inside a place**, above its activities: "🎬 Start a move here", the moves that place offers.
- `/home?open=scene`.
- The task counter moved to the top of the right-hand column (the ring with 1/5 and the 🔥 streak); the top bar's freed space
  shows clout with the way to the next rank under it ("Rank 4 at 1,000").

## For you today

Four moves from four different parts of life, at least one everyday. A move is for a player when its `when` (storylet
conditions over the Content Engine's memory, lib/storylets.ts) fits: dating or single, enrolled, running for Homecoming, a
business owner or one gone public, a job's track, just promoted, running a campaign, broke, a city condition (heatwave,
brownout, festival, sample sale), Halo or Hustler. Situational moves come first, then the cast's and status moves, then
everyday ones; the order is shuffled by player and day, and yesterday's picks go to the back. Each card says why ("Because
you're seeing someone") and where; Go opens the place.

## Fake it till you make it (owner, Nov 21)

Below a move's rank or money a player isn't locked out: the move shows "Not on the list yet (Rank 4)" and the door gives three
ways in (Moral Choices format, You get / It costs, no odds): walk in like you own the place (Aura helps), say you're on the
host's list (a day's ban if they check; nudges toward Hustler), or slip the door half the price (Hustler-ward). Bounced spends
the Energy (and the bribe), no move, no second try that day. Once players have the rank they're invited, but the price rises
10% a rank above the move's own: fame means picking up the tab.

## The moves

58 in `content/scene/moves.json`: everyday (brunch, open mic, nights out, photo walks, the wannabes' "launches"), status
(panels, guest lectures, the fundraiser, the talk show), hosted by the cast (Prince Nassim's golden crab breakfast, Saffron
Lux's birthday, Heir Ruckus's listening party, Lunaria's 3 AM drop, Duke Ledger's watch viewing…) and situational ones.
Every move is at places that exist; all but the car auction can happen in Queens (Brooklyn's venues wait for its borough).
`npm test` checks places, hosts, ranges and that `when` is set where it should be.

## Step 2: haters, rivals and pitfalls (migration 0172)

Fame draws attention. When a move starts, the server rolls whether someone comes for it (`haterChance`: 15% for a nobody,
5 points more a rank, at most 60%, 15 more when you snuck in), who (content/scene/haters.json by rank: petty rumours and the
wannabes at first, celebrities' shade from Rank 3 (Chardonnay Shade, Heir Ruckus, Chase Clout), real pitfalls from Rank 6
(Prince Nassim buys the venue, Peyton Pastel's apology video, a leaked guest list, paparazzi at the kitchen door)), and when it
lands (a quarter to three quarters of the way through). It shows on the move's card in red; left standing it takes its cut off
the pay (25% for nobodies, 30% rising, 40% famous). Dealing with it (the hater card, You get / It costs):

- **Get a regular to vouch for you**: a regular at Friendly or better (Moral Choices favours), once a week; Halo-ward.
- **Hire a publicist**: C$100 + 75 a rank: fame makes it pricier.
- **Spill tea about them first**: the gossip site pays C$60 + 20 a rank; Hustler-ward.
- **Rise above it**: Halo-ward, but the cut stays.

**Your crew's moves**: the Scene screen lists your crew's (and partner's) building moves that want a hype. A hype from you
counts as one of theirs, from anywhere, once per move, and pays you 5 clout.

## Step 3: mastery, residencies, trending, the cast remembering you (migration 0173)

- **Plaques**: collecting the same move 10, 25 and 50 times earns the Regular, Fixture and Legend plaques: 50, 150 and 400
  clout and a badge (`scene-<move>-<n>`); the 10th is a takeover. Each running move shows "🏅 9/10 to the Regular plaque";
  Known for lists plaques earned and in reach.
- **Residencies** (FarmVille's animals): a move's first plaque opens a week's residency at its places, one at a time.
  Checking in there once a New York day pays half the move's clout.
- **Trending**: three moves anyone can do pay 1.5× each week (`trendingFor`, the same three for everyone, new every Monday).
- **The cast remembers you**: after three of a host's moves, their offers carry a line of theirs (content/scene/hosts.json:
  Prince Nassim's "Your shoes are… very you.", Saffron's "Remind me how we know each other?").
- **Lola's Blotter**: big moves (a `headline` in moves.json: the talk show, the car auction, Saffron's birthday…) post a 'win'
  line when collected on time, never for News opt-outs.
- **Pushes**: "🎬 A move is ready to collect" and "⏳ Going stale in under an hour" (`push_scan_scene`, kinds scene_ready and
  scene_stale).
- **Lola's morning pick**: a ready move is the pick after rewards to collect ("Night out is ready"; why: one goes stale soon).
- **The Clout Pass**: a collected move earns 10 season XP.

## Fresh every week (migration 0174; owner, Nov 21: "Do the scenes update daily?")

- **The cast's week**: every celebrity-hosted move runs on two days a week, never back to back, different each week
  (`daysFor`, seeded by the week, so everyone sees the same schedule). The Scene screen opens with "This week on the scene":
  the seven days, who hosts what, today outlined. Offers say "🗓️ Thu & Sat"; starting one on another day says when it's on.
- **Weekly moves**: the weekly routine writes content/scene-weeks/<Monday>.json (step 6e in docs/WEEKLY-CONTENT.md): 6 to 10
  new moves tied to the week's news and cast, some on set days (the first week: Prince Nassim's "small" Thanksgiving, the
  Turkey Trot, Lunaria's surprise pop-up, Heir Ruckus's mixtape party). They arrive scheduled, go live 24 hours later unless
  vetoed in Studio → Storylets → Scene moves, run only in their week ("🆕 This week only"), and come first in For you today.
  A move vetoed after someone started it can still be collected.

## Preview

`/preview/home?scene=new|busy|student|rich` (an hour passes in 30 seconds; the latest weekly file plays as this week). Go inside a place (`&at=velvet-static`) for the
"Start a move here" row; Saffron's birthday there shows the door at Rank 3.
