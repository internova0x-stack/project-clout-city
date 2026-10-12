# Clout City: Game Concept Note

Oct 11, 2026 · @Internovatechnologies

This note explains what Clout City is, who it's for and how it plays. Read it first; it gives the picture the detailed specs assume. It replaces the original "NYC Life" build brief, keeping that brief's ideas where they still fit and moving the rest to the roadmap.

This note is orientation, not specification. Where it and a spec differ in detail, the spec wins (see section 13).

## 1. The game

**Clout City: NYC is a mobile-first, browser-based life game where you arrive in New York as a nobody and chase clout: the city's only ranking that counts.** It's Sims-style living crossed with a serialized city tabloid. You rent an apartment, dress the part, go to the right places and parties, and climb the leaderboard, while a satirical daily story unfolds that the whole city follows together.

**The fantasy:** become the main character. The welcome screen sets it up: "Welcome to New York. Population: 8 million. People who matter: not you. Yet."

**The goal:** make it in New York. In P1 that means climbing the clout leaderboard: being seen in the right places, owning the right things, and calling the twists in the city's stories before everyone else.

**Tagline:** "TAP IN. BLOW UP."

## 2. Who it's for

**Core player:** university students and early-career young adults who live online, follow internet drama, and care about money, rent, style, status, nightlife and their friends. They already play casual life sims and binge serialized stories on their phones, in short sessions.

**Where they are:** the setting is New York, but the game is built for players anywhere. The city clock cycles day and night every couple of hours so nightlife works in every time zone, while the story calendar keeps everyone on the same beat on the same day.

**What they want from it:** a playful status fantasy, a reason to come back every day (tomorrow's beat), something to argue about with friends (who did it?), and a world that's funny about the clout chase rather than earnest about it.

**Age:** Clout City is 18+. Players confirm their age at sign-up, which fits the core audience and the game's chat, real-money purchases and darker whodunits.

## 3. Design pillars

Six pillars decide every trade-off.

1. **The city follows the story together.** Everyone sees the same beat on the same day, votes in the same predictions and finds out together. Shared moments beat solo pacing.
2. **Satire with real mechanics.** Funny on the surface (a gossip narrator, petty stakes treated as world-ending), with real choices about money, rent and status underneath.
3. **Clout is the scoreboard.** Every system feeds it: tasks, places, events, possessions, invites and correct guesses.
4. **Short sessions, daily return.** A beat is a 10-second read; daily tasks fit a coffee break; something new waits every day.
5. **Friends are an advantage.** Inviting a clique earns clout and a big bonus at five, but solo play still progresses fully.
6. **Real money is always marked, never a shortcut.** Gold means real money. It can't buy virtual cash, and story purchases never help you guess.

### What it is not

- **Not a full simulation.** No 3D map (the city is a 2D map, now and later), no transit sim, no separate Hunger stat (eating refills Energy instead), no real-time multiplayer.
- **Not pay-to-skip.** Virtual cash can't be bought, and side arcs give no clout or guessing edge. Exclusive events and collector items add clout only with diminishing returns.
- **Not a stranger-chat app.** Chat is capped at 10 messages a day, filtered, with block, report and an admin review queue.
- **Not real people or brands.** Every character, business and brand is invented; real landmarks appear only when their names aren't trademarked.
- **Not grim.** Even the dark stories keep tragedy off-screen and point the satire at the circus around it.

## 4. The world

P1 is set in Queens at night, a borough with a strong personality, drawn as a stylized 2D night map.

- **Queens first.** Every player starts in Queens: apartments, places to visit, events and deals. Long Island City and Astoria are the first story hot spots.
- **The rest of the city is locked.** The other boroughs show on the map as "Locked: Coming soon," a visible promise of what's next.
- **Look and feel:** New York at night: dark glass over a night map, taxi-yellow action, neon for nightlife, and gold only for real money.
- **Places** are visited, not shopped: each has a cost and a clout reward, a once-a-day clout cooldown, and can be changed by stories (closed for police activity, crowded with fans). Dining spots come in three tiers (budget, medium and luxury): every meal restores Energy, and the fancy ones pay the most clout, because being seen there is the point. Tapping any location opens a card with an illustration, lore and actions, and the busiest places can be entered as illustrated interiors. P1 has 34 visitable locations, from bodegas and clubs to two parody university campuses, a firehouse and four monuments, and traffic and trains move across the map when you zoom in.
- **People:** a recurring cast of invented characters (Loretta the momager, Ray the doorman, Detective Okafor) and NPCs who gossip about the current story. The narrator, Lola Lowdown, is "Queens' most reliable unreliable source."
- **Two clocks:** a fast city clock (a day every 2 hours) for day, night and event times; and the real New York calendar for stories, resets, bills and anything that pays out.

## 5. How it plays

The game works at three timescales: a first session that delivers a win fast, a short daily session, and a long climb.

### First session (about 10 minutes)

1. Open a link and land on the Queens map as a guest; pan around freely.
2. Tap anything and sign up.
3. Create a character in four steps: **Look** (pick one of eight starting styles, from Bodega Drip to Startup Founder), **Traits** (pick two, flavor only), **Birth lottery** (roll starting cash between $6,000 and $10,000), **Home** (choose a Queens apartment and move in).
4. A satirical welcome and a five-tooltip tour of clout, money, the map, the phone and events.
5. **First task:** you've been invited to a party. Go solo or bring the clique; either way you're seen, earn cash and clout, and land on the leaderboard.
6. Invite friends, add the game to your home screen, and meet the city's current story.

### Daily session (5 to 15 minutes)

- Read today's story beat in the News app and vote in any open prediction.
- Work through the five daily tasks: visits, events, story tasks.
- Visit places for clout (each pays once a day), work a shift or take a gig for cash, eat to refill Energy, attend an event, shop, or sell something.
- Pay bills, check the leaderboard, message friends (10 messages a day).

### Long term

- Build clout and net worth: better apartment, a car, luxury and collector pieces.
- Follow each weekly story to its finale, call the twists and collect badges.
- Grow a clique of five for the big bonus, and collect the monument postcards.
- Later: unlock new boroughs, and the career and progression systems in the roadmap (section 11).

## 6. Systems at a glance

Every P1 system, what it does and which spec owns it.

| System | What it does | Owning spec |
| --- | --- | --- |
| Clout | The player's social standing (flame in the HUD); feeds the leaderboard (a ranking only in P1) | Clarifications |
| Bank balance | Virtual cash for rent, the Shop, club events and visits; earned from daily tasks, job shifts, gigs and events; never bought with real money | Clarifications |
| Net worth and Possessions | Bank cash plus every item at its value (diamond in the HUD); items sell for 60% | Clarifications |
| Stats | Energy, Mood and Confidence; events move them; visits, events and job shifts spend Energy, and meals at dining places restore it | Clarifications |
| Daily tasks and goals | Five tasks a day with a completion bonus; long-term goals | Clarifications |
| Places | Visits cost cash and pay clout by price, once a day per place; budget, medium and luxury dining places also restore Energy on every visit; 34 locations, each with a card, lore and actions | Clarifications |
| Events | Club (virtual cash), free story events, exclusive (real money) | Clarifications |
| Shop | Fashion, Cars, Houses, Luxury, Makeup; rare collector items | Clarifications |
| Bills | Rent and phone to start; car bills once you rent or buy a car | Clarifications |
| Stories | Shared daily beats, predictions, world effects, paid side arcs | World State, Quality, Production briefs |
| Clique and invites | Clout per friend who signs up; big bonus at five | Clarifications |
| Chat | 10 messages a day, filter, block, report, admin queue | Clarifications |
| UI and look | Every screen and component | Design Guide |

## 7. Stories

Stories are the main reason to come back every day: serialized, satirical and shared by the whole city.

- **Format:** 6 to 10 beats, one per real day, each a headline plus two or three sentences ending on a cliffhanger, read in the News app on the in-game phone.
- **Play, not just read:** 2 to 3 predictions per story with live poll results, story tasks that send players to places and events, and NPCs who gossip about each development.
- **The city reacts:** a gala gets cancelled, a building is closed for police activity, a diner gets crowded with fans, a grief hoodie appears in the Shop.
- **Fair to free players:** every mystery is solvable for free; paid side arcs ($2.99 each) add perspective, evidence and behind-the-scenes color, but never help anyone guess.
- **Late joiners** catch up on the live story and can still vote in open predictions; finished stories live in the archive.
- **First story:** "Who Killed Sarah Bird?", a 10-day Queens whodunit. It launches when the player base is ready, not on launch day, and a lighter story, a dating comedy, follows it. Lola Lowdown also writes a recurring dating advice column. After the pilot, a new story starts every Sunday.

## 8. Social and growth

Growth comes from friends and from shared story moments.

- **The clique:** inviting is optional but rewarded. Each friend who signs up pays clout to the inviter, and a full clique of five earns a big bonus. Players can bring the clique to the first party, and the main invite prompt follows that first win.
- **Shared talk:** live poll results and the reveal card ("You picked Jett. So did 61% of Queens.") give players something to screenshot and argue about. Every beat has a Share button.
- **The leaderboard:** clout ranking for Queens and the player's clique.
- **Chat:** player-to-player messages, 10 a day, with a word filter, block, report and an admin review queue.
- **Crushes and date nights:** a light romance layer between players who already know each other. Crushes are revealed only when mutual, and a crush invite turns a crush into an invite. Date nights send two players to the same dining place or club event for a shared bonus. No real photos, no stranger matching.
- **Install:** an add-to-home-screen prompt in the first session, so the game lives on the phone like an app.
- **Return triggers:** the daily beat, the daily task reset at midnight New York time, prediction close times ("closes tonight") and bills coming due.

## 9. Money

The game earns through four real-money products, all one-time Stripe Checkout payments. There is no premium currency.

| Product | What it is | Clout |
| --- | --- | --- |
| Exclusive events | Celebrity parties and VIP nights; the first real-money purchase players see | Yes, with diminishing returns |
| Story side arcs | $2.99 each: a perspective, evidence or insider take on the current story | None |
| Collector fashion | A few rare pieces, found while browsing the Shop, never promoted | Yes, with diminishing returns |
| Monument postcards | $0.99 each: a collectible postcard, buyable only after visiting its monument (the visit itself pays the clout) | None |

**Rules that don't bend:**

- Virtual cash can never be bought with real money.
- Gold in the UI means real money; apart from the logo and tagline, nothing else is gold.
- Paid content never gives an edge in predictions; the main story is always free.
- A refund revokes what was bought and takes back the clout it gave.

## 10. Success metrics

Three headline metrics decide whether P1 works; the rest explain why.

**Headline**

- First task completed.
- Clique invite sent.
- Day-1 return of 35 to 40% (stretch goal: 50%).

**Story health:** beat opens, prediction participation, side-arc purchases and return rate during an arc.

**Supporting:** exclusive-event and collector purchases, chat use against the daily cap, install rate, and how many players reach a full clique of five.

## 11. Roadmap

P1 is defined in Clarifications section 8. Everything below is **after P1** and must not be built now; it keeps the strongest ideas from the original brief in view.

| Area | Later ideas |
| --- | --- |
| Progression | Clout levels and titles (Nobody → Local → Scene Regular → Known → Famous → Icon), an Icon milestone moment and a prestige option so the top isn't a dead end |
| Careers | Fame paths with their own verbs: influencer, streamer, artist or DJ, founder or hustler |
| City | Brooklyn, Manhattan, the Bronx and Staten Island, each with its own rent level and vibe, unlocked at clout thresholds (on the same 2D map; there is no 3D map); fully 3D interiors; monuments and postcards in other boroughs; real university names with each university's permission |
| City life | Random city events, rush hour, mild crime, weather and seasons, transit costs |
| Home | Decorating apartments with decor slots and a home score |
| Social | Crews, home visits, group hangouts, speed dating, compliment polls, an avatar-only fit-check feed, roommates splitting rent, daily friend boosts, outfit and home voting, rivals, gifting |
| Growth | Shareable story and milestone cards, deep-link landing pages, tiered referral rewards, streaks, notifications |
| Stories | City headlines in the News app beyond stories, an insider pass, bundles |
| Money | A seasonal pass, purchases at places, a marketplace |
| Content ops | A central copy file with a refreshable slang layer |

## 12. Decisions made

Every open decision from the specs is now made. Each is written into the document shown, which is the one to follow.

| Decision | Decided | Specified in |
| --- | --- | --- |
| Minimum age | 18+, confirmed at sign-up | Clarifications sections 1 and 13 |
| How players earn cash | Daily tasks pay cash plus a completion bonus; job shifts at a few Queens job places (barista, delivery rider, retail) trade Energy for cash; gigs in three tiers (side gig, pro gig, big break) pay 2 to 15 times a shift, with the bigger ones offered rarely and gated by Confidence; events pay as specified | Clarifications sections 3 and 13 |
| What the stats do | Visits, events and shifts spend Energy; meals restore it, plus a small top-up each New York midnight; at zero, players can read, vote, chat, shop and pay bills, but not visit, attend or work; Mood and Confidence scale clout gains | Clarifications section 13 |
| Missed rent | A 3-day grace period, then a Mood drop; after 7 days, a move to the cheapest Queens home, keeping all possessions | Clarifications section 13 |
| What clout unlocks in P1 | Nothing beyond rank: it's a ranking only | Clarifications section 13 |
| Borough unlocks (after P1) | Clout thresholds tied to clout levels | Roadmap (section 11) |
| Stack and sign-up | Next.js, Supabase, Stripe and Vercel; email and Google sign-up | World State Brief section 1; Clarifications section 1 |

## 13. Document map and precedence

Read this note first, then the spec that owns the area you're working on. When two documents disagree, the owner below wins; if you find a disagreement, flag it rather than choosing silently.

| Document | Owns | Read it for |
| --- | --- | --- |
| [Game Concept Note](https://claude.ai/code/artifact/8c3f886d-1e7f-4617-b737-4517b1794123) (this) | The why and the big picture | Orientation, roadmap, decisions made |
| [Clarifications & Updates (v2)](https://claude.ai/code/artifact/01d1c3ba-3726-4890-9b1e-e52e23ab2707) | Game rules and P1 scope | Onboarding, HUD, economy, events, chat, music, clocks |
| [World State Layer Brief (v2)](https://claude.ai/code/artifact/1c0a64d7-4da9-49e5-9b24-6668ab6f3076) | Engine behavior | Arcs, beats, effects, predictions, entitlements |
| [Story Production and Payments Brief (v2)](https://claude.ai/code/artifact/c3583c39-b77e-4504-8866-a9999b537859) | Pipeline and payments | Approval gates, validation, Stripe, refunds |
| [Design System Guide (v2)](https://claude.ai/code/artifact/d6032dc7-22dd-47b8-94e8-564e80ea5caf) | UI | Tokens, components C1 to C41, motion |
| [Story Quality Brief (v2)](https://claude.ai/code/artifact/7b647d81-7ca8-41ce-b6d3-5e96397f95fd) | Content rules | Writing and checking every story |
| [Who Killed Sarah Bird? (v2)](https://claude.ai/code/artifact/1d82266e-f479-43f8-9346-e19ba309724a) | The first story's content | Loading the pilot as data |
