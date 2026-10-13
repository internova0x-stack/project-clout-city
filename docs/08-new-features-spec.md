# Clout City: New Features Spec (Hunts, News and More)

Oct 13, 2026 · @Internovatechnologies

This spec covers the features that came out of testing v0.1 and the follow-up discussion: treasure hunts, the Story Studio, an expanded News app, a recurring cast and NPCs, a denser starting neighborhood, and travel and rest. It sits alongside `docs/testing-feedback.md`, which holds the bug fixes and smaller decisions.

Sections 1 to 6 are decided. Section 7 lists features for after P1; don't build them yet.

All rules from the other documents still apply: no real brands or people, gold only for marking real money, virtual cash written C$, real money never shortens a wait or buys an edge.

> **Owner answers (Oct 13, 2026).** The spec was written with the old version numbers (v0.3 to v0.5, all live). Remapped:
>
> - **v0.6 "Astoria and the News"** (next, after v0.5.1): the dense Astoria neighborhood (section 5), the recurring cast and NPCs at places (section 4), the News feed (section 3), the Studio's hunt and news review (section 2), and **full** treasure hunts with NPC clues (section 1). The simplified "Ask around" version is skipped.
> - **v0.8 "Getting Around"** (formerly v0.7): travel, rest at home, venue snacks, and the supermarket, fridge and home cooking (section 6).
> - **Nothing is replaced or moved:** the new places are added to the ones that exist, focused in Astoria. Places already in Astoria (Grind & Gossip Café, Pedal Pushers Hub, Low Light Lounge, Thread Count Boutique) count toward its 20. The two universities stay where they are; Astoria also gets a community college.
> - Celebrity names are punny type spoofs (Chase Clout, Dunk Daniels, Chardonnay Shade…): they wink at a type, never at one real person (docs/CAST.md).
> - The sports stars are simply "a basketball star" and "a football star": no league names, real or invented.
> - Claude doesn't run on its own: the weekly drafts come from a scheduled Claude Code session (a Routine) that uploads to the Studio for approval.

## 1. Treasure hunts

**Version:** v0.6, full version (NPCs give clues).

A weekly, opt-in hunt that sends players around the city following clues, with one track for each of the eight starting styles.

### How it works

1. **Tracks.** Each starting style has its own track and its own treasure (an invented legendary sneaker for Bodega Drip, a lost vintage film camera for Thrift Store Icon, and so on). A player plays their starting style's track. All eight tracks share one weekly theme and the same set of places, so the week still feels shared.
2. **Schedule.** A new hunt starts every Monday at New York midnight and ends the following Sunday at midnight; unfinished hunts expire. Stories start on Sundays, so the two never launch the same day.
3. **Opting in.** A Hunt tab in Tasks/Goals ("Daily / Goals / Hunt"). One tap joins; nothing about the hunt appears for players who haven't joined.
4. **Steps.** 4 to 5 steps, each at a different place. The player travels there (normal visit cost and Energy) and talks to the right NPC, whose line reveals the next clue. Some steps ask a multiple-choice question: a correct answer unlocks the next step; a wrong one can be retried after 10 minutes.
5. **Finale.** Find the right person at the right place and answer correctly to unlock the treasure.
6. **Rewards.** A free collectible hunt card (with the treasure's lore), virtual cash about equal to a pro gig, and clout worth about 15 to 20% of an active player's weekly clout. Hunt cards sit in the Collection, marked as earned; they have no net-worth value and can't be sold. Four completed hunts earn a badge.

### Rules

- **Clues are always free.** Real money can never buy hints, skips or shorter waits.
- **Nobody is priced out:** at least one step each week uses a free or cheap place, such as a park.
- **Story safety:** steps avoid places affected by the live story that week.
- **Fair clues:** solvable from the game alone, one correct answer per question, invented treasures and names only.

### Engine and world

| Part | v0.6 |
| --- | --- |
| Clue delivery | NPCs give clues in their lines at places |
| Engine | A `hunt` arc type in the World State layer, with per-player steps |
| World reaction | NPC chatter talks about the treasure, for players who've joined |
| Places | Any released place, including monuments |

### Weekly content pipeline

1. **By Thursday:** a scheduled Claude Code session drafts the theme and all eight tracks (treasure, steps, clues, questions, finale, card lore).
2. **Validation script:** every place exists and is open all week, none is affected by the live story, at least one step is free or cheap, every question has exactly one correct answer.
3. **By Sunday:** the owner approves in the Story Studio (skim all eight, read one in full).
4. **Monday at New York midnight:** publish.
5. **Measure:** joins, completions, and drop-off at each step; make next week easier or harder accordingly.

## 2. Story Studio

**Version:** already built as an admin dashboard at `/studio`; hunt and news review are added in v0.6.

The one place where all story, hunt and news content is reviewed, approved, scheduled, previewed and paused.

| Area | What it does | Status |
| --- | --- | --- |
| Hunt review | Each week's theme and eight tracks shown as players see them, one-tap preview of any track, validation results, Approve or Send back with a note | v0.6 |
| Story gates | Gate 1: approve the blueprint and hidden truth. Gate 2: approve the finale and side arcs, with the editor-pass report beside them | Single approval built; the two gates are v0.6 |
| Scheduling | Set a story's start date (including Sarah Bird's pilot), see the hunt and news calendar | Story scheduling built; the calendar is v0.6 |
| Preview | Step through days with time travel to see exactly what players will see | v0.6 |
| Safety switches | Pause or retire any live arc, beat, hunt or news item, with no code deploy | Stories built; hunts and news in v0.6 |
| News review | Approve city news items and cast updates (section 3) | v0.6 |

**Security (built):** only accounts on the admin list can open it, and every page, data request and action checks that on the server. Knowing the URL is never enough. This is part of the pre-launch security review.

**Chat reports (built):** the chat report queue lives in the Studio (reported conversations, both players, the reason; dismiss, warn, mute or ban).

## 3. News

**Version:** v0.6, building on the News app that hosts stories.

The News app becomes the city's gossip feed, not just the home of the current story, so there's something new to read every day.

### What's in the feed

| Type | What it is | How often |
| --- | --- | --- |
| Story beats | The current story (Sarah Bird first) | One a day while a story runs |
| City news | Developing stories about the recurring fictional cast (section 4): feuds, breakups, deals, comebacks, flops | One or two a day |
| Lola's dating column | The advice column, run as a recurring mini arc | Weekly |
| Hunt announcement | This week's treasure hunt theme | Mondays |

### How players see it

- **The ticker:** one glass pill under the HUD that alternates the latest headlines with live player activity (the existing live ticker, C22, not a second ticker). Tapping a headline opens that item in the News app.
- **On opening the game:** the home-screen prompt card (C6) shows the newest headline. It's a card, never a full-screen interruption, and appears at most once per session.
- **Later:** some headlines pop up on the map as notifications at the places they mention.

### Fictional celebrities, not real ones

City news uses an invented celebrity world that parodies the real types players follow: a famous streamer, a basketball star, a football star, a reality TV star, a pop star, a movie star, a tech founder and an influencer. Real celebrity news is ruled out because:

- naming real people risks defamation and publicity-rights claims, and breaks the "no real people" rule in the Story Quality Brief;
- copying or summarizing real news raises copyright issues;
- keeping it current would need daily curation or a live AI pipeline, which the game doesn't use;
- "avoid divisive or bad news" would need judging every single day.

City news stays light: no real politics, no tragedies or crime (the main stories carry the darker plots), and nothing that changes prices or places (only stories do that).

### Production

- A scheduled Claude Code session drafts a week of city news at a time, alongside the hunts, following the Story Quality Brief's tone and guardrails.
- The owner skims and approves the week in the Story Studio; items are scheduled for set days.
- Each item is data (headline, two or three sentences, cast members involved, publish day) and goes to the News archive after it runs.

## 4. Recurring cast and NPCs

**Version:** v0.6 (NPCs at places with lines); full conversations come later.

A small, recurring cast makes the city feel inhabited and gives the News app, stories, hunts and places the same faces.

### The cast

- **Story regulars (already exist):** Lola Lowdown (narrator), Loretta Bird, Ray Delgado, Detective Nia Okafor.
- **The celebrity world (new, for city news):** eight invented celebrities, one per type: a streamer, a basketball star, a football star, a reality TV star, a pop star, a movie star, a tech founder and an influencer. Each has a one-line personality, a want and a flaw, so their news writes itself. Names are invented and checked so they don't match real people. The sports stars are just a basketball star and a football star, with no league named.
- **The wannabes:** a few fake-famous and almost-famous characters (a struggling DJ, a self-declared CEO, a girl who's "basically an influencer"), who are cheap to write and great for satire.
- Everyone goes into the cast and city bible from the Story Production brief, so they stay consistent across stories, news and hunts.

### NPCs at places

| Part | How it works |
| --- | --- |
| Who | Regulars tied to a place: the bartender at Velvet Static, the bodega owner, a tour guide at the Unisphere, a barista |
| Where | Standing at a marked spot in the place's scene, with a small speech-bubble label |
| Lines | Tapping one shows a rotating line. Lines change with the live story's phase (the existing chatter system) and with cast news ("Did you hear the streamer got banned again?") |
| Personal updates | Each regular has a small life of their own (a promotion, a breakup, a side hustle), updated weekly in their lines |
| Hunts | During a hunt, the right NPC's line becomes that step's clue for players who've joined |
| Data | All NPCs and lines are data, written with the week's content and approved in the Story Studio |

**Later:** real back-and-forth conversations with choices.

## 5. A dense starting neighborhood

**Version:** v0.6, added to the places that exist (nothing is moved or removed).

Every player starts in one neighborhood with about 20 places close together (22 with the cinema and games arena the owner added on Oct 13), so the city feels busy from the first minute and short trips are cheap. Astoria is the starting neighborhood.

### The 20 places

| Kind | Places | Depth |
| --- | --- | --- |
| Home | The starter apartments | Full |
| Food | Bodega, café (also the barista job), pizza counter, diner, rooftop restaurant, supermarket | Bodega and café full; the rest scene cards |
| Nightlife | A club, a lounge | Club full; lounge scene card |
| Work | Delivery-rider hub, retail store, office tower (gigs board) | Scene cards |
| City | Library, police precinct, firehouse, community college, a generic place of worship | Scene cards |
| Outdoors | A park, a gym | Scene cards |
| Entertainment | A cinema (also a date spot), a games arena | Scene cards |
| Getting around | A subway station | Map label and lore |

**Notes:**

- **Mostly scene cards.** Only 4 places need full interiors (apartment, café, bodega, club), the same templates as the current wave 1. The rest need one illustration each, about 20 in total.
- **Added, not moved.** Every existing place stays where it is. Places already in Astoria fill their slots (Grind & Gossip Café is the café, Pedal Pushers Hub the rider hub, Low Light Lounge the lounge, Thread Count Boutique the retail store); the rest of the 20 are new places in Astoria.
- **A community college:** the game is 18+. St. Johnsons University and Queensborough University stay where they are, a short trip away.
- **The place of worship is generic and kept apart from the story:** the first story's killer runs Radiant Harbor Church, so this one has a different name and no link to it.
- **The gym is new too:** Pressed Iron Gym belongs to the Sarah Bird story, so the neighborhood gym has its own name.
- **The supermarket is new:** groceries bought there are cooked at home, a cheaper way to restore Energy than eating out (section 6, v0.8). Until then it's a scene card.
- **Later waves are unchanged:** story places, monuments and other neighborhoods arrive as planned, a short trip away.

## 6. Travel, rest at home and food at venues

**Version:** v0.8 "Getting Around". Full rules are in `docs/testing-feedback.md` and Clarifications.

### Travel

- **No spending before arriving.** A place's actions show as a preview until the player is there; the main button is "Go there."
- **Choose how to get there:** walk (free, slow, more Energy), subway (cheap), taxi (fast, pricier) or the player's own car (fast, no fares). Costs come from simple distance bands, not routes.
- **Watch the trip** from above as the taxi, bus or train moves across the map. Skipping is always free.
- **Time is personal.** The trip, napping and other timed actions use a short personal timer and never move the shared city clock.
- **Built (v0.8 step 1, owner Oct 13):** the player is at home or at one place (players.at_place). Place actions and events only work there (migration 0025 checks every visit and attendance). Getting there, by distance band (under 0.5 / 0.5 to 2 / 2 to 5 / over 5 mi): walk free for 5/10/20 Energy (not offered past 5 mi), subway C$3 flat, taxi C$8/16/28/45, own car free. Arrival is instant on the server; the client shows a 3 to 10 second trip from helicopter height (never street level), always skippable. Fares are in the Bank as "Taxi · Hell Gate Park".

### Rest and food

| Where | Action | Effect | Limit |
| --- | --- | --- | --- |
| Home | Nap | Restores Energy over a short timer | Capped per day |
| Home | Sit | Restores some Energy and Mood | Capped per day |
| Clubs, lounges, later stadiums | Grab a drink or snack | Medium Energy, luxury price, no clout | None |
| Dining places | Eat | Energy by tier; clout once a day | None |
| Everyone | Midnight top-up | A small amount of Energy each New York midnight (built) | Daily |

The caps keep meals as the main source of Energy, so dining stays worth visiting.

### Groceries and the fridge

- **The supermarket** sells groceries in a few cheap bundles (e.g. "Snack run," "Meal prep for the week"). Buying them is a normal action at the supermarket, so players have to go there first.
- **The fridge at home** stores what they buy, up to a set number of meals (in config). The fridge is part of every apartment and shows its contents when tapped.
- **Cook a meal** at home: takes a short personal timer, uses one meal from the fridge, and restores Energy. Per meal it's cheaper than eating out, but it pays no clout and isn't capped beyond what's in the fridge.
- **Groceries are consumables:** they don't appear on the Net Worth screen and can't be sold. No spoilage in P1.
- **Balance:** cooking is the budget option, dining is the social and clout option, and venue snacks are the convenience option. Prices are tuned so all three stay worth using.

## 7. Later features

Not part of P1; don't build yet. Each needs more players or more art before it's worth building.

| Feature | What it is | Why later |
| --- | --- | --- |
| Premium penthouse with parties | One multi-floor apartment bought with real cash. Owners can throw a party once a week, announced to players, with RSVPs and a guest limit, attended by players and NPCs | A fifth real-money product, multi-floor interiors, and enough players to fill a party; parties need moderation |
| Buildings with multiple floors | Going upstairs inside a place | Multiplies interior art; start with the penthouse |
| Players at the same place | See which real players are at a location, with preset reactions; real chat only with people you're connected to | Needs live presence and enough players; stranger chat is ruled out |
| Friends at home | Invite your crew to your apartment and chat there | Part of group hangouts on the roadmap |
| NPC conversations | Back-and-forth talks with choices | Needs a dialogue system and more writing each week |
| News on the map | Headlines pop up at the places they mention | After the News feed proves itself |
| Social Scene update | Speed dating, compliment polls, an avatar-only fit-check feed | Needs enough players online at once |
