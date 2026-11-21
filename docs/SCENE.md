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

## Next

- Step 3: plaques for doing a move 10/25/50 times, residencies, trending moves from the weekly content, the cast remembering
  you, Lola's Blotter for the big moves, pushes ("ready", "going stale"), Lola's morning pick and Clout Pass XP.

## Preview

`/preview/home?scene=new|busy|student|rich` (an hour passes in 30 seconds). Go inside a place (`&at=velvet-static`) for the
"Start a move here" row; Saffron's birthday there shows the door at Rank 3.
