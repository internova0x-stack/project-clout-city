# Clout City: New Features Spec (Hunts, News and More)

Oct 13, 2026 · @Internovatechnologies

This spec covers the features that came out of testing v0.1 and the follow-up discussion: treasure hunts, the Story Studio, an expanded News app, a recurring cast and NPCs, a denser starting neighborhood, and travel and rest. It sits alongside `docs/testing-feedback.md`, which holds the bug fixes and smaller decisions.

Sections 1 to 8 are decided. Sections 9 to 11 came from the third testing round (spec v3, Oct 14) and are built in v0.11 "Doors Open". Section 12 lists features for after P1; don't build them yet.

All rules from the other documents still apply: no real brands or people, gold only for marking real money, virtual cash written C$, real money never shortens a wait or buys an edge.

> **Owner answers (Oct 13, 2026).** The spec was written with the old version numbers (v0.3 to v0.5, all live). Remapped:
>
> - **v0.6 "Astoria and the News"** (next, after v0.5.1): the dense Astoria neighborhood (section 5), the recurring cast and NPCs at places (section 4), the News feed (section 3), the Studio's hunt and news review (section 2), and **full** treasure hunts with NPC clues (section 1). The simplified "Ask around" version is skipped.
> - **v0.8 "Getting Around"** (formerly v0.7): travel, rest at home, venue snacks, and the supermarket, fridge and home cooking (section 6).
> - **Nothing is replaced or moved:** the new places are added to the ones that exist, focused in Astoria. Places already in Astoria (Grind & Gossip Café, Pedal Pushers Hub, Low Light Lounge, Thread Count Boutique) count toward its 20. The two universities stay where they are; Astoria also gets a community college.
> - Celebrity names are punny type spoofs (Chase Clout, Dunk Daniels, Chardonnay Shade…): they wink at a type, never at one real person (docs/CAST.md).
> - The sports stars are simply "a basketball star" and "a football star": no league names, real or invented.
> - Claude doesn't run on its own: the weekly drafts come from a scheduled Claude Code session (a Routine). Since v0.11 they go live unless the owner edits or vetoes them (section 9).

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
3. **By Sunday:** the tracks wait in the Story Studio for at least 24 hours and go live unless the owner edits or vetoes them (section 9, from v0.11; until then the owner approves).
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
- Items wait in the Story Studio and go live on their scheduled days unless the owner edits or vetoes them (section 9, from v0.11; until then the owner approves).
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
- **Built (v0.8 step 1, owner Oct 13):** the player is at home or at one place (players.at_place). Place actions and events only work there (migration 0025 checks every visit and attendance). Getting there, by distance band (under 0.5 / 0.5 to 2 / 2 to 5 / over 5 mi): walk free for 5/10/20 Energy (not offered past 5 mi), subway C$3 flat, taxi C$8/16/28/45, own car free. Arrival is instant on the server; the client shows a 3 to 10 second trip from helicopter height (never street level), always skippable. Fares are in the Bank as "Taxi · Astoria Park".
- **Built (v0.8 step 2, owner Oct 13):** a drink at the bar of a club or lounge (C$28, +20 Energy, no clout, no daily cap, refused at full Energy), and Nap (+30 Energy, 2 a day, 8 s) and Sit (+10 Energy, +6 Mood, 3 a day) from the bed and seats at home only (migration 0026, `rest()` and `bar_drink()`). Drinks are in the Bank as "Bar · Velvet Static".

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
- **Built (v0.8 step 3, owner Oct 13):** Steinway Fresh Mart sells a Snack run (C$12, 2 meals) and Meal prep for the week (C$35, 7 meals), only when you're there. The fridge holds 10 meals (players.fridge_meals); a bundle that doesn't fit isn't sold. The Kitchen at home shows the fridge and Cook a meal: one meal for +25 Energy, a 6-second countdown with Skip, no clout, refused at full Energy; an empty fridge offers "Go shopping" (migration 0027, `buy_groceries()` and `cook()`). Groceries are in the Bank as "Groceries · Meal prep for the week".

## 7. Lucky Star Lotto (v0.10)

A scratch-card shop in Flushing, outside Astoria on purpose: players travel there at normal travel costs. The owner, **Benny Fortuna**, has never bought a ticket (the deli already has a Sal).

- **Five games** (owner, Oct 13): Corner Store Classic C$5, Bodega Cat Bonanza C$10, Rent's Due C$20, Penthouse Dreams C$50 and Main Character C$100. Each top prize is 1,000 times the card: C$5,000 up to C$100,000.
- **One fixed prize table** for every game, in multiples of the card: the card back 1 in 5, 2× 1 in 10, 5× 1 in 40, 20× 1 in 400, 100× 1 in 5,000, 1,000× 1 in 100,000. Any prize 1 in 3.05; a card pays back 60.5% on average and 10% of every bought card goes to that game's pot, so the lotto is a C$ sink. A big prize (100× or more) is about 1 card in 4,760: a player scratching about two cards a day has about a 1.3% chance a month.
- **Limits:** one free card a day (the C$5 game), a second one through a player's first 7 days ("Beginner's luck", shown openly), and 5 bought cards a day across all games. Everything resets at midnight in New York.
- **The counter:** a card wheel you spin to pick a game, the odds one tap away, then one card to scratch with a finger (or "Scratch it all"). One prize window, never three matching symbols, so there are no fake near-misses.
- **Can't be rigged from the browser.** The browser only names a game. The server checks the place, the limits and the cash, draws the prize from Postgres's cryptographic random source when the card is bought, and keeps it where players can't read it; scratching asks the server to reveal and pay it, once per card (ledger `lotto_card` and `lotto_prize`).
- **Real money never touches it:** cards cost C$, prizes are C$, and C$ can't be bought. Winnings go to the bank and count toward net worth. No gold in the lotto's look.
- **Built (v0.10 step 1, owner Oct 13):** migration 0032 (`buy_lotto_card()`, `scratch_lotto_card()`, `lotto_state()`), the 3D shop, the counter and the scratch card. **Built (v0.10 step 2):** the weekly jackpot, starting at C$5,000 plus 10% of every bought card; every card that week, free or bought, is one entry. With no scheduler, the first visit after Sunday midnight in New York draws the finished week once (`lotto_settle()`, migration 0033): one card picked uniformly with the cryptographic random source, the pot paid to its owner (ledger `lotto_jackpot`) with the 🌟 Jackpot winner badge. The counter shows the pot, when it's drawn and your entries; Lola's card leads the News City tab, naming the winner unless they opted out of the gossip (then "a lucky Astorian"). The winner always sees "It's you".
- **v0.11 pots (owner, Oct 14; migration 0041): they replace the weekly jackpot draw.** Instant number matching: every game has a lucky number (1 to 40) and a pot. A card shows six of the player's numbers, each with a prize; one that matches the lucky number pays its prize at once, and a ⭐ wins the pot. The C$5, C$10 and C$20 games get a new number and a fresh pot every midnight in New York; the C$50 and C$100 games every Monday, and their pots grow all week. Pots start at C$5,000 / 10,000 / 15,000 / 50,000 / 100,000 and are won 1 card in 5,000 / 10,000 / 20,000 / 50,000 / 100,000 (harder for every game; the owner chose to keep the regular prizes the same for every game). 10% of every bought card goes into its game's pot; after a win the pot starts again from its seed, and an unwon pot ends with its day or week. Free cards can win the C$5 pot. The counter says "Free plays: 1 of 2 left today" with dots. The server draws the prize, the pot win and the numbers when the card is bought (`lotto_numbers()`), and pays both on scratch (ledger `lotto_prize`, `lotto_pot`); the pot winner gets the 🌟 badge, and Lola's News card names pot winners (same opt-out). The weekly draw retired: the week in progress at migration time moved its jackpot money into the Main Character pot.

## 8. Neighborhood gossip (v0.10)

Five-piece gossip stories about the invented cast, Astoria's regulars and invented city politics, found at places ("Listen in", free) or from a regular's line, collected in a 🍵 Tea app on the Phone and finished as Lola's write-up in a Tea tab in the Collection. A completion pays a little clout and Mood (ledger, once); five earn a badge. Pieces can be shared with the crew once each, and a shared piece counts as found for them (owner, Oct 13). 3 to 5 stories a week, drafted with the hunt and the news (`content/gossip/`, checked by `validate:content`); unfinished stories archive after two weeks.

**Built (v0.10 step 3, owner Oct 13): automatic.** A merged week file goes live on its Monday with no approval: the game server checks every file in `content/gossip/` with the Studio's rules and stores it (`gossip_import()`, migration 0034, service role only). The Studio's **Gossip** tab is the back office: every week in full (each piece with its place, source and time window, and Lola's write-up), how many players started and finished each story, files that fail their checks (they never go live), and **Pause** (hidden at once) or **Hold** with a note (off until the file changes). A week players have started can't be edited. Story safety is strict: no piece at any story's places and no word of any story's answer.

**Built (v0.10 step 4, migration 0035):** every place card has a free **👂 Listen in** (on arrival) that finds the overheard pieces there; tapping the regular (on the card, or inside the room) tells theirs, after any hunt clue. Pieces with a time window only turn up in it (city clock); outside it Listen in says when to come back. A toast says "🍵 Piece 2 of 5 · …". The **Tea app** on the Phone lists the live stories with five-step progress; a story shows its found pieces in full (who and where; **Share with crew** once each, which counts as found for the crew) and blurred hints for the rest (overheard or a regular, the kind of place and its neighborhood, the window); only the first piece names its place. The fifth piece opens Lola's **Tea card**: +25 clout and +6 Mood once (ledger `gossip`), kept in the Collection's **🍵 Tea** tab; five finished earn the ☕ **Spills the Tea** badge. Players only ever receive the text of pieces they've found. Never about real players or real people, and never a live story's answer (the Studio's story-safety check, as for hunts).

**Built (v0.11 step 3, migration 0036; owner Oct 14): the trail.** "The city is big, so point players in the right direction. Everyone they talk to should point them to the next person." A story is a trail: its first piece names its place, and each piece found names the place (and the regular) of the next one. The Tea app shows a **Next:** chip on each story ("Talk to Benny Fortuna at Lucky Star Lotto"), the toast after a find says where to go next, and everyone the player talks to passes on a lead: a regular with nothing new, or any NPC in a room, says where one of the player's stories goes next ("Want more on …? Ask Rosa at Grind & Gossip Café."). **Daily tasks:** 2 of the 5 (`gossip.tasksPerDay`) send the player to their next pieces ("Talk to Sal at Ditmars Deli & Dreams", "Listen in at Two Bros Who Fight Pizza"), regulars first, never two at one place. Talking or listening there completes the task even if a crewmate already shared the piece, so a task never becomes impossible; with no live stories the list is five ordinary tasks.

## 9. Content automation: live unless vetoed

**Version:** v0.11. News, gossip and treasure hunts go live on schedule unless the owner edits or vetoes them.

> **Owner answer (Oct 14, 2026): no Claude API for now.** Spec v3 had a scheduled job call the Claude API to generate content. Instead the drafts keep coming from the weekly Claude Code session (docs/WEEKLY-CONTENT.md), which commits the week files; the game loads them on its own. No API key, no generation costs to log.

1. **Drafting:** the weekly Claude Code session drafts a week of city news, the week's gossip stories and the week's eight hunt tracks, following the Story Quality Brief and the cast and city bible.
2. **Automated checks:** `npm run validate:content` (the Studio's rules): invented names only, no real brands or politics, every place exists and is open, structure (5 gossip pieces, one correct answer per hunt question), nothing that gives away a live story. A file that fails is held, never published.
3. **Veto window:** passed content waits in the Story Studio for at least 24 hours before its publish time. The owner can edit, veto or approve early. If nothing is done, it goes live on schedule. A file that arrives less than 24 hours ahead waits until it has had its 24 hours.
4. **Main stories keep one human approval:** a main story's blueprint (who did it, the hidden truth) is approved by the owner before the story is scheduled; its daily beats then follow the veto-window rule.
5. **Pause anytime:** anything live can still be paused or retired from the Studio.
6. **News now:** News is live immediately, starting with a drafted week.

## 10. Exclusive events update

**Version:** v0.11 (owner, Oct 14). Replaces the earlier exclusive event details where they differ.

- **Price:** $3.99 (set in `store_products`, never in code).
- **The event modal lists the benefits:** meet and chat with real people, earn a collectible, get mentioned in City News.
- **The venue:** a special location with multiple floors, the first multi-floor building in the game.
- **Who you see:** each player sees 8 to 10 other people at once, for performance and a cozy feel. When there aren't enough players, NPCs fill the gap. Owner, Oct 14: NPCs carry no label (too noisy); real players you can talk to get a green "online" dot, and tapping it opens their card.
- **Event chat:** a group chat for the people in the room, with no daily message limit inside event rooms during the event. Private messages keep the normal daily cap. The word filter, block and report all apply. (This is the one place strangers can chat; section 12's "stranger chat is ruled out" still holds everywhere else.)
- **Positive chat suggestions:** the chat offers tappable, positive-only suggestions ("Love the fit 🔥", "First time here?", "Who's on the decks tonight?"), so starting a conversation is easy and the tone stays friendly.
- **Dropped (owner, Oct 14):** the "Show me more" setting (men, women or everyone). Who you see is never filtered by gender; "Presenting as" stays cosmetic only.

**Built (v0.11 step 6, migration 0038; owner Oct 14):**
- **$3.99** for every party (`store_products`).
- **The event card lists what you get** before you buy: meet and chat with real people, a collectible (numbered ticket and badge), a City News mention, and that the party is on the Penthouse Floor. Under the list, always visible, one aside in smaller text: "Helps keep our servers up and running 😭" (italic words, upright emoji) (owner, Oct 14). It is not a perk and is never called a donation.
- **Two floors.** Low Light Lounge, the exclusive venue, has stairs up to **the Penthouse Floor** (the game's first multi-floor building). On party nights it's guest list only; the party is up there.
- **Who you see.** Up there, each player sees 9 others: the real players at the party (crew first, then whoever arrived last), with NPCs filling the gap, each tagged **NPC**. Real players have a name tag; tap it for their profile. Players check in every few seconds (`party_room`); blocks hide people both ways.
- **Event chat.** **💬 Party chat** opens the group chat for everyone at the party: no daily limit while it's on (a 2-second gap stops floods), the word filter, mutes and bans apply, tap a name to see their profile, report the message (it reaches the Studio's queue, quoted) or block them. Private messages keep their daily cap.
- **Positive openers.** Tappable suggestions ("Love the fit 🔥", "First time here?", "Who's on the decks tonight?"…) send in one tap.

## 11. Interface and sign-in updates

**Version:** v0.11.

| Area | Change |
| --- | --- |
| Payments | Connect Stripe in test mode for all real-money products |
| Google sign-in | "Continue with Google" works in the browser; test it in the installed app (PWA) too |
| Sign-in in the installed app | Email links open in Safari, not the installed app. The 6-digit email code is the main sign-in in the installed app, so players sign in without leaving it |
| Actions at places | Collapsed by default and expandable, in the apartment and at every location |
| Tasks at places | Tasks done at a location show a checkbox that ticks when completed |
| Daily tasks and gossip | At least 2 of each day's 5 tasks involve gossip, e.g. "Talk to John at the deli" to pick up a piece of his story |
| Task notification | The task icon in the side column shows a notification dot at the player's first open of each New York day, cleared when tapped |
| Rotating the apartment | Players can rotate the apartment view in 90° steps, with a button or a swipe |
| NPC chat bubbles | Any NPC you can talk to has a small speech-bubble icon over their head |
| Entering every location | Every location can be entered. Each uses one of the shared interior templates, recolored, with its own sign and props; new templates (office, civic building, outdoor plaza) cover all places. **Exception (owner, Oct 14): subway stations** stay a map label and lore (section 5) |

**Built (v0.11 step 2, Oct 14):**
- **Folded actions.** A place card shows "Things to do here · N" with what's there in one line and today's tasks as checkboxes; one tap opens the full list. Inside a room the panel stays folded as before. (The home list that was here is gone: owner, Oct 14.)
- **Task checkboxes.** Every daily task at a place is a checkbox on its card and in the room panel, and on the matching action row; it ticks (and strikes through) when done.
- **Task dot.** The task icon in the side column shows a dot at the first open of each New York day, cleared when tapped.
- **Turning and zooming (owner, Oct 14: every room, no buttons).** Slide sideways and the room turns with your finger, settling on the nearest quarter turn; pinch (or the trackpad / mouse wheel) zooms in up to 2.6×, centered on you. The two walls nearest the camera are always cut away, and a place's sign hangs on both its back and front walls so one is always in view.
- **A front door (owner, Oct 14).** Every room has a front door by the spot you come in, with a doormat. Owner, Oct 14 (later): no "Go out" label, since the Map button already does that. On the party floor the labels are trimmed too: the stairs show only an arrow (↑ / ↓), and the dance floor says **Check in 🎟️** until you check in (which claims the ticket, badge and News mention), then **Dance**.
- **Arranging by tapping (owner, Oct 14).** No Arrange or Turn buttons and no home "Things to do" list: tap a piece of furniture and it's selected; the arranging bar is one row: Rotate and plain up, right, left and down arrows on the left, Cancel and Save on the right (each moves the piece along the floor direction closest to it on screen, one grid step a tap, hold to keep going) with Rotate, Cancel and Save. No drag and drop (owner, Oct 14). Sliding still turns the room while arranging. The labels over things (Sit, Nap, Kitchen, Your look) are how you use them.
- **Side buttons (owner, Oct 14).** Tasks, Events, Places, Bills and Look sit just above the bottom bar on the right, TikTok-style: separate round buttons with a label under each. The map's locate button and credits move to the left.
- **Speech bubbles.** Everyone you can talk to in a room has a 💬 over their head; tapping it talks to them.

**Built (v0.11 step 5, Oct 14): every place can be entered.** Three new shared rooms (an **office**, a **civic** hall and an outdoor **plaza**) plus a **gym** join the existing ones, and every place but subway stations has a room (`template` in lib/city.ts; `placeRoom()` in lib/rooms.ts). A shared room takes the place's own actions, names and sign: the gigs board opens the gigs, the library desk says "Study in the quiet room", a dance floor only takes events where there are some. Places that were scene cards are recolored with their palette. Offices: Skybridge Tower, Triborough Works, Pedal Pushers. Civic: the library, precinct, firehouse, chapel, Radiant Harbor and Skyline Pier's lobby. Plazas: the parks and Hunter's Pier. Gyms: Pressed Iron and Rep Count. Diners use the café, pizza and the supermarket the counter shop, rooftops the lounge, the dealership the store, the college and the cinema the lecture hall, the games arena the club. Who you talk to fits the place (the librarian, a trainer, the desk sergeant…).

## 12. Avatars and outfits (#9)

Owner, Oct 14: "Keep the city life ones as accessible through sale, and the fantasy ones as clothes that can be accessed at higher clout levels. To give players something to work towards."

- **Models.** The avatar is Quaternius's Ultimate Modular Men and Women (CC0), in `public/avatars/` (`scripts/build-avatar-assets.mjs` builds them; `public/avatars/README.md`). Each character is four parts (head, body, legs, feet) on one skeleton, so a look mixes parts from different characters (`lib/avatarCatalog.ts`). Places, rooms and the map don't change.
- **Every Look option stays.** Skin, eyes, hair color and clothing colors recolor the model. Short hair, curls and the ponytail (Male) and short and long hair (Female) use the pack's own hair; every other style, every hat and covering, and glasses are the game's own shapes on the head. Body types scale the model.
- **Tops and bottoms** map to the closest pack piece (a hoodie is the pack's hoodie, a skirt is the formal skirt), in the player's colors.
- **Whole outfits** are a new Shop slot ("Outfits" in Your look). They cover the top, bottoms and shoes in the pack's own colors and can bring a hat or helmet. City outfits are sold for cash: Site crew hi-vis, St. Marks punk, Gala night, Ranch hand overalls, Rockaway beach set. Fantasy outfits also need clout: Adventurer 1,000, Tactical gear 2,500, Witch of Ditmars and Hooded ranger 5,000, Spacefarer 10,000, Royalty 25,000. Clout opens the door and is never spent; `buy_item` checks it (migration 0043). Anyone can try them on.
- An outfit's hat or helmet replaces a basic hat, never a hijab, turban, headwrap, durag or kippah.
- When only one presentation has a piece, the other wears it fitted to their skeleton.
- Rooms: the avatar idles, walks with the pack's walk cycle, sits and lies down as before.

## 13. Bigger homes and venues (#19)

Owner, Oct 14: walled rooms with many items; walls between rooms at waist height; clubs and lounges stay open space, with the restroom (where gossip is juicier) and a VIP lounge on other floors.

- **Rooms follow the price** (owner, Oct 14: "cheap rooms should have single floor plans, with medium and expensive apartment/homes having more rooms accordingly"): the Astoria studio (C$1,750; C$425 since migration 0113) is one room; the Jackson Heights 1BR (C$2,600; now C$600) has a bedroom and a living room with a kitchen nook; the LIC high-rise (C$4,500; now C$1,050) has living room, kitchen, bedroom and bathroom; the two houses for sale have five rooms (the townhouse adds an office, the penthouse a dressing room). Each room has its own floor (wood, or tile in kitchens and bathrooms). Walls between rooms stop at the waist so every room reads at once; doorways are gaps with posts.
- **A bought house is your home.** Buying the Astoria townhouse or the LIC penthouse moves you in (rent already stops).
- **New pieces:** bathtub, toilet, sink with mirror, kitchen island, nightstand.
- Walking goes through doorways, never through walls; arranged furniture can't be pushed into a wall. Each home's pieces have their own ids, so a layout arranged in one home doesn't carry into another.
- **Fif's Furniture** (owner, Oct 14; migration 0044): a showroom in Long Island City on the map, and a **Home** tab in the Phone's Shop. Pieces are shelved by room (living, bedroom, dining, decor), most in a few colors (one sku per color), and pay a little clout like clothes. **Try it at home** drops the piece into your home to arrange before buying; buying keeps it where it stands. Bought pieces you haven't placed wait in **📦 Storage** at home: tap one to place it, and **Put away** sends it back. Placed pieces are saved in the home layout under `item:<id>`; a spot that doesn't fit (another home, a wall) sends the piece back to storage. Bought seats and beds work like the home's own (Sit, Nap).
- **The Jackson Heights 1BR** comes a little bigger (7.7 × 6.6 m) and nearly empty (bed, kitchen, wardrobe, one chair) so players furnish it themselves. The studio, the high-rise and the houses stay furnished.
- **No labels over things** (owner, Oct 14: "let people discover what they can do by tapping around"): rooms show no tap labels. Tapping a piece uses it (the bed naps, the sofa sits, the wardrobe opens Your look, Fif's displays open the Shop); press and hold a piece at home to arrange it, or tap the small 🛋️ button (it shows 📦 and a count when bought pieces wait in storage). The labels stay as hidden buttons for keyboards and screen readers. People keep their 💬.
- **Moving up** (owner, Oct 14: "a medium apartment that players can work towards moving into when they start the game. Moving into a better apartment should be one of the early goals"; migration 0045):
  - **Sunnyside Gardens 1BR**: C$3,200 a week, three rooms, nearly empty to furnish. Never offered at sign-up; moving in needs 1,000 clout. Moving into the LIC high-rise later needs 3,000 clout.
  - **The Apartments app** (Phone) lists every rental with its rent, rooms and what it takes. **Look inside** shows the floor plan with a Back / Move in bar. Moving costs the first week's rent plus a one-week broker fee; you can't move with rent unpaid or while you own a house. Your furniture moves with you (pieces that don't fit go to storage).
  - **The goal** "Move into a better apartment" sits second in Goals, naming the next home up and what it takes; it's done once you've moved somewhere dearer (`players.moved_up`) or bought a house.
  - **The Hunters Point duplex penthouse** (Shop, C$2,400,000) has two floors joined by stairs: a living room with a piano, dining and a kitchen with an island downstairs; bedroom, bathroom, dressing room and a terrace with a hot tub upstairs. Bought pieces remember which floor they're on.
- **Clubs and lounges** (owner, Oct 14; migration 0046): "Clubs and lounges should be open space. If a club has a rest room, it should be on another floor. And the restroom could be a place where gossip is shared." "VIP lounge should also be another floor and accessible to only people with a certain amount of clout or very expensive."
  - **One open floor**, with stairs down to a **restroom floor** (sinks and mirrors, stalls, a bench) at every club and Low Light Lounge, and stairs up to a **VIP floor** (gold booths, a private bar, a piano) at medium and exclusive clubs. Low Light Lounge keeps its Penthouse Floor for exclusive parties and has no VIP.
  - **Tiers.** Cheap: **The Sticky Floor** (Jackson Heights, C$40) and **Discount Disco** (Flushing, C$60), restroom only. Medium: Hellgate Hall and Velvet Static. Exclusive: **Ultraviolet Society** (LIC waterfront, C$350), where the bouncer wants **2,000 clout** at the door: below that the card says so and the trip is refused. Each new club has its own night (Two-Dollar Night, Clearance Rack Disco, Afterglow).
  - **VIP entry**: free from 5,000 clout (medium) or 15,000 (exclusive); otherwise a cover of C$1,500 or C$5,000 for the New York day, asked before it's paid. **Get seen in VIP** (the VIP bar) pays twice the clout of getting seen downstairs, with the visit's Mood and Confidence, once a day per club.
  - **Restroom gossip** ("juicier gossip in the restroom"): Listen in at the mirrors hears everything overheard at that club plus pieces with `"source": "restroom"`, which only turn up there and pay a story's clout and Mood again on the spot (+25 clout, +6 Mood; ledger `gossip_restroom`). Listen in on the place card works as before. Week files may use restroom pieces only at places with a restroom floor, and no gossip goes behind a door rule; the Studio shows them as 🚻.
  - Daily tasks never send a player to a club whose door they can't get through.

## 14. Meeting players (owner, Oct 15; migration 0047)

"Players who are at the same location at the same time are supposed to be able to see each other and chat with each other." "Players should be able to meet other real players in all locations." Brought forward from Later features; strangers may now message each other, with the safety tools below.

- **In the room**, at every place and on every floor: the real players there walk around with the NPCs in their own avatar and look. **Nothing over their heads** (owner: "there are going to be many people, so the screen will get crowded"): tap a figure to open their card. NPCs keep their 💬, so they can be told apart and talked to for gossip.
- **Crowded places** (owner, Oct 15: "50 players might be at a location but the floor plan only allows 4-7 characters"): each room shows a few players beside its regulars (3 in a restroom, 4 in VIP, 5 or 6 in most rooms, up to 7 in the big ones; `lib/rooms.ts` playerSlots). The regulars never make way: they carry the stories and the gossip. Who stands in the room is picked for each player: the people you just opened, then your crew, then everyone else taking turns (every 45 seconds one walks out of the door and another walks in). On party floors real players come first and extras fill the rest.
- **Who's here** sits right-aligned under the top HUD (owner, Oct 15; not on the activity card): three faces, "50 here" and **View People**, which opens everyone at the place by where they are (In the room, Around this floor, Downstairs, Upstairs). Tapping someone opens their card and walks them into the room.
- **On the map**: a place's card says "● 3 here now · Tasha, Dev and Kai".
- **Their card** opens with "Here with you at …", five **free reactions** (👋 🔥 😂 💅 🥂; one per person every few minutes; only between players at the same place, or crewmates), three **Break the ice** openers (about the place, the time of day and their look; tap one to put it in the box), a message box and the day's count. Reactions show in the chat thread as a big emoji.
- **20 messages a day** (owner), every message you send counts, replies included. Reactions never count.
- **VIP** (owner, Oct 15; migrations 0051 and 0052; was "Unlimited chat"): the 21st message opens the offer: **VIP monthly $4.99** (renews until cancelled) or **VIP yearly $39.99** (renews each year; "Save 33%", picked first), both with unlimited chat, **every side story free while the membership lasts** and a 👑 VIP badge on the player card; or **Chat forever $119.99** (one payment, unlimited chat only, side stories not included). Locked side stories offer "👑 Free with VIP" under "Unlock for $2.99". A story bought for $2.99 stays when a membership ends. Real money through Stripe; it never buys cash or clout. When a monthly or yearly plan ends (cancelled, or a renewal fails for good) the **limit comes back**. Also from Settings → Chat.
- **Who can message me** (Settings): Anyone (default) or My crew; it covers messages and reactions.
- Safety as before: word filter, block, report, the Studio's review queue, mutes and bans. Blocks hide people both ways, including from Here now.

## 15. Ranks and businesses (v0.12 "Ownership"; owner, Oct 15)

### Ranks

"We need categories for Clout City players based on net worth/clout", satirical and USA-wide, with billionaire status at the top (owner). One list; a player holds the higher of the two ladders: **clout** (fame gets you there) or **net worth** (money does). Net worth is everything you own, not cash: cash, your things at their value and your businesses at their valuation (owner: "the C$1B shouldn't be cash but net worth").

| Rank | Title | Clout | or net worth |
| --- | --- | --- | --- |
| 1 | 🍜 Ramen Noodle Era | 0 | C$0 |
| 2 | 🎓 Student Loan Survivor | 100 | C$25,000 |
| 3 | 💼 Side Hustler | 500 (pro gigs) | C$50,000 |
| 4 | 💬 Group Chat Famous | 1,000 | C$100,000 |
| 5 | 📋 On the List | 2,000 (big gigs, the Ultraviolet Society door) | C$250,000 |
| 6 | 📸 Local Celebrity | 5,000 (free VIP at medium clubs) | C$500,000 |
| 7 | 🍼 Nepo Baby Energy | 15,000 (free VIP everywhere) | C$1M |
| 8 | 💸 New Money Rich | 50,000 | C$10M |
| 9 | 🛥️ Self-Made Billionaire* | 150,000 | C$1B |
| 10 | ✨ God Status | 500,000 | C$10B |

- The clout steps are the game's own gates (checked by tests). The money steps are real milestones (owner: "so billionaire means billionaire").
- Shown on the profile (the rank, a bar and "150 clout or C$94,495 to Group Chat Famous"; tap for every rank), player cards and the Everyone here list. Crossing into a rank opens the **rank-up reveal** (Share; the top three on a Monument Valley dusk-sky card).
- Ranks can go down with net worth (a business falls out of fashion); the profile keeps "Best: …".

### Businesses

Buy businesses that make money; their value counts toward net worth. The only way to the top money ranks: wages and gigs make thousands, businesses make billions.

| # | Business | Price | Pays a day | Upgrades (each costs 60% of the price: +50% pay, +50% value) |
| --- | --- | --- | --- | --- |
| 1 | 🌭 Dirty Water Dogs (hot dog cart) | C$5,000 | C$750 | Second umbrella · Secret menu · Influencer collab |
| 2 | 🐈 Bodega, Cat Included | C$50,000 | C$6,000 | Hot food counter · Lotto machine · The cat gets an agent |
| 3 | 🧺 Spin Cycle Laundromat | C$250,000 | C$22,500 | Free Wi-Fi · Wash and fold · Laundromat by night (DJ) |
| 4 | ☕ Oat Milk Surcharge Café | C$1.2M | C$81,600 | Latte art · Laptop ban (for vibes) · Second location |
| 5 | 🌮 Taco Truck Fleet | C$6M | C$300,000 | Late-night route · Festival permits · A truck in every borough |
| 6 | 🪩 Your Own Nightclub | C$30M | C$1.08M | VIP floor · Celebrity DJ residency · A velvet rope, gold-plated |
| 7 | 🏢 Luxury* Apartment Building (*exposed brick) | C$150M | C$3.9M | Rooftop amenity · Doorman with opinions · Condo conversion |
| 8 | 📱 Disruptive App Startup | C$700M | C$12.6M | Pivot to AI · Celebrity board member · Go public |

- **One of each**, bought in order (the next unlocks when you own the one before). Bought from the **Businesses** app on the Phone, in Monument Valley dusk colors (owner, Oct 15: not purple).
- **Collect the till**: pay piles up each game day and you collect it in the app (or at the business's spot, later). It stops piling up after **2 days**, so coming back daily pays without punishing a missed day.
- **Valuation** = the price, +50% per upgrade, times **hype**: from ×1.0 to ×2.0 as your clout goes from 0 to 150,000 (fame brings customers). Fame and money feed each other.
- **Go public** (the startup's last step): needs 50,000 clout ("investors want a famous founder") and C$50M in fees; triples the startup's valuation.
- **Business news** (later in v0.12 or after): the News app runs events on businesses: a viral review (+value for a week), a health inspection (closed a day), a celebrity sighting.
- **Pace** (simulated, a steady player collecting daily): C$1M at about 2 months, C$10M at 3.5 months, **C$1B at about 9 months**, C$10B at about a year. A casual player is a week or two behind.
- **Server-decided**, like everything with money: prices, pay and valuations in `game_settings`; buying, upgrading, collecting and going public through security-definer functions; every buy, upgrade and till collection a `ledger` row (migration 0048). The browser never sends an amount. Real money never buys a business.
- **Later: stakes in places on the map** ("Buy into Velvet Static", the top shareholder named on the place card). Whole map places can't belong to one player; everyone visits them.

## 16. Better together (v0.13; owner, Oct 15)

"We also need things for players to do together … so players can make themselves useful to each other and interact with each other." Two mechanics: doing things together pays more than doing them alone, and players can hire each other for real jobs.

### Together bonuses

Invite someone (crew or anyone at the same place); when both are in, the action pays more for both.

| Together | How | For both |
| --- | --- | --- |
| **Travel together** | "Ride together" on Go there: one trip, the fare split | Half the fare each; you arrive together and the place card says "arrived with tasha.b" |
| **Study together** | A night class (campus, library) with a study buddy at the same place | 1.5× the confidence and clout |
| **Club together** | Dance on the same floor within 10 minutes of each other | 1.5× the clout, and a shared moment in both players' Recently |

- The same rule can spread to brunch, workouts and more, one action at a time (a `together` multiplier per action in the city catalog).
- **Server-decided**: the bonus pays only when the server sees both players at the same place (and floor) inside the window; a `ledger` row per player per pair per day.
- **Limits** against two accounts farming each other: one together bonus per pair per action a day, at most 5 a day, and accounts younger than 2 days don't earn it.

### Hire a player

A **Jobs** board on the Phone: post a job or take one. Paid in game cash only (never real money), held until the job is done.

| Job | What the player does | Pay |
| --- | --- | --- |
| 🛋️ **Interior decorator** | Arranges your home: edit access to your layout for one session (up to 30 minutes). You approve it, or undo it all with one tap | The decorator's price, C$200 to C$20,000, plus 25 clout |
| 💼 **Business manager** | Collects your tills while you're away (from the Businesses app; they never get your cash) | A cut they set, 5% to 20% of what they collect; you choose who and can fire them any time |

- **Ratings**: both sides rate each other (1 to 5 stars); player cards show "Hired 12 times · ⭐ 4.8". Jobs done also pay clout, so being useful is a way up the ranks.
- **Safety**: payment held by the server and released on approval (or after 24 hours with no answer); a decorator can't sell, delete or buy anything, only move what's there; report and block on every job; daily limits on jobs between the same two players; account-age minimums against alt accounts.
- **Later jobs**: stylist (picks your outfit), tour guide (takes a newcomer to three places), hype person (boosts your entrance at a club).

### As built (migration 0050, from the approved mockup at `/preview/together`)

- **Do it together**: a 👯 button next to every visit at a library, university or club (`CITY_ECONOMY.together.tags`). Invite **one person**: crew anywhere, or anyone at the place now. They answer in **Plans** (a home-screen prompt, like crew plans). When both have done that activity within 10 minutes (`action_uses.used_at`), `together_claim` pays each player the extra half of their own visit clout and of the activity's confidence (so 1.5× both, at clubs too), once, with a `ledger` row `together`/`invite:<id>`. At most 5 a day per player; accounts under 2 days old can't invite. Both see the bonus card.
- **Ride together**: on Go there, inside a place, people here with you appear as "Ride with @name". Subway or taxi only. They get a ride request (3 minutes to accept); on yes both pay half (rounded up) and arrive at the same moment. The exclusive club's door checks both.
- **Jobs app** (Phone): Find work / Hire someone. Decorator pay is held (`job_hold`) when posted; the decorator gets 30 minutes in the client's home (ground floor, their own furniture) and can only move what's there. The client keeps it (pay plus 25 clout to the decorator) or undoes it all (layout restored, pay refunded); kept on its own after 24 hours. Managers collect the client's tills and keep their cut; either side can end it ("Fire").
- **Ratings**: the client rates the job (1 to 5 stars); player cards say "⭐ 4.8 · hired 12 times on the Jobs board". Rating the client back is for later.
- **Safety**: one job a day between the same two players, one live job of each kind per worker, account age 2 days, blocked players never see each other's jobs; report and block are on every player card.
- Not yet: the "arrived with" line on the place card and a shared moment in Recently.

## 17. On Air: Real Clout FM and Clout TV (v0.14; owner, Oct 16)

Two ways for players to feel famous: a shoutout on the city's radio station, and their photo on the big
screen. Every submission is approved by the owner in the Story Studio; nothing goes public on its own.
Players give their **Instagram handle**, not their Clout City name (owner, Oct 16: the one exception to
"no real brand names", for this field only). Real Clout FM and Clout TV both use "Big Screen" capitalized.

### Real Clout FM: shoutouts on "The Wake-Up Call" (migration 0057)

The station's morning show is hosted by DJ Sharm Almight, a composite character: his personality,
catchphrases and backstory are invented, not modeled on any one real host.

- **Where**: a Radio app on the Phone (show artwork, today's on-air shoutout, the shoutout wall, "Request a
  shoutout"), and the station itself on the map in Astoria (a studio with a lit ON AIR sign and a lattice
  broadcast mast with red beacons; a name label, not a place).
- **Requesting**: Instagram handle plus a message of up to 140 characters, with a live count and the chat word list
  masking words as they type (the server masks again). Messages with an "@" are refused: shoutouts can't
  name or tag anyone else. The player confirms the handle is theirs. One request per player per New York day.
- **Daily cap**: the first 50 requests each New York day (`game_settings` radio.dailyCap). After that the
  button reads "Today's list is full. Try again tomorrow."
- **Approval**: the Studio's Shoutouts tab lists the day's requests in order (handle, message, player). Pick
  one to air (picking another replaces it), add up to 5 to the wall, reject, or undo.
- **On air**: 9 a.m. New York, shown in each player's local time; picked later, it airs at once. Every player
  sees it once as a banner for about 8 seconds ("📻 Real Clout FM: @handle says…"; tap to open the Radio
  app); it stays in the Radio app as today's shoutout.
- **Not picked**: a request still waiting when its day ends reads "Not today. Try again tomorrow." A rejected
  one reads the same (no separate rejection notice).
- **Safety**: the banner and every shoutout in the app have a report button; reports land in the Studio's
  Reports queue with the shoutout quoted. Banned or chat-muted players can't request.
- **Data**: `radio_shoutouts` (player, handle, message, New York date, status pending/on_air/wall/rejected,
  the owner-confirmation flag, aired time), one per player per date. `radio_state()`, `radio_request()`,
  `radio_report()`; the Studio's `admin_shoutouts()` and `admin_shoutout_action()`. No reward is paid for
  being on air.

### Clout TV: "Make it to the Big Screen" (migration 0058)

Clout TV is the city's TV station. Players submit a photo of themselves; approved photos take turns on the
Clout Tower's big screen in Astoria.

- **Where**: a Clout TV app on the Phone (who's on the Big Screen now, past features, your own photos,
  "Make it to the Big Screen"), a home card ("Now on Clout TV") once per photo, and the **Clout Tower** in
  Astoria: a Times Square-style tower whose screen shows the live photo with "CLOUT TV" and the @handle,
  glowing at night.
- **Submitting**: an "Upload a photo" button, then a crop widget fixed to the billboard's frame (4:5; drag,
  pinch or slide to zoom; the photo always covers the frame). The photo is cropped on the phone and uploaded
  at exactly 1080 × 1350 (no location data) to a private storage bucket, in the player's own folder. Then the
  Instagram handle and three confirmations (a photo of them or one they took; 18 or over; OK to show
  publicly in the game), each stored with its time. One photo per player per New York day, **20 a day across
  the city** (owner, Oct 16).
- **Approval and the rotation** (owner, Oct 16): nothing goes up on its own. The Studio's Big Screen tab:
  To review (Approve, Show now, Reject), Rotation (in order), On screen & past (Take down), All. **One player
  every 3 hours**: at 12, 3, 6 and 9 o'clock New York the next approved photo goes up, oldest approval first.
  **Show now** puts any photo up at once; **Take down** removes it and the next approved one goes up. A photo's
  turn ends with its slot; with nobody waiting the tower says **"Make it BIG in NY"**.
- **The Big Screen viewer**: tapping the tower (or the home card, or a photo in the app) opens the photo in
  the billboard's red-pink frame: "LIVE ON CLOUT TV", "@handle made it to the **Big Screen**", "Now the whole
  city knows their name", with pendulum-swinging confetti falling across the screen (off with Reduce Motion).
  Anyone can tap it, so the copy is about the player on it.
- **Staying live**: games check every minute and right when a new slot starts, and tapping the tower checks
  first, so the tower and the viewer show the live photo.
- **Removal**: the owner takes a photo down any time; a player can withdraw their own (waiting, in the
  rotation, or on screen) from the Clout TV app, which deletes the file.
- **Data**: `tv_submissions` (player, photo path, Instagram handle, the three confirmation times, New York
  date, status pending/approved/featured/rejected/withdrawn/taken_down, approved and featured times);
  `tv_state()`, `tv_submit()`, `tv_withdraw()`; the Studio's `admin_big_screen()` and
  `admin_big_screen_action()`. Storage policies: upload to your own folder; read your own, what has been on
  screen, and everything for Studio admins. The screens inside clubs come later.

### Texts from the stations (migration 0058)

A player whose photo goes up gets a text from **Clout TV**; one whose shoutout airs (or makes the wall) gets
one from **Real Clout FM** (owner, Oct 16). They're read-only threads at the top of Messages, counted on the
Messages badge; replies don't reach the station. `station_inbox()`, `station_read()`; sent once each when it
happens, the next time any game checks in.

## 18. Campus life (proposed v0.15 "Campus"; owner, Oct 18)

Clout City launches at New York universities. The campuses are the two parody universities already in Queens
(no real school is named): **St. Johnsons University** (Jamaica) and **Queensborough University** (Flushing).
Queens is open from day one, so both are reachable for every player. The aim: delightful, funny and relatable
things to do on campus, and a reason to come back every day (classes) and every week (exams, parties, house
rankings). Numbers below are starting values for `game_settings`, tuned later.

**Owner decisions (Oct 18):** use the two Queens campuses; fraternities and sororities ("houses") are
**separate from Crew** (Crew stays the invited-friends group with its invite rewards); **no player-vs-player
arguments** of any kind (no roast battles, no feuds between players; conflict stays in stories with the cast).

### Enrolment and identity
- A player **enrols** at one campus (free, from the campus card). One campus at a time; switching costs a week
  ("transfer paperwork"). Enrolled players get the campus on their profile and count for its leaderboard.
- Players never give their real school, dorm or class times; the campus is the game's parody campus.

### Classes (the daily loop)
- Enrolled players pick **3 courses** a week from a rotating catalog of satirical courses (e.g. "Intro to
  Main Character Energy", "8 AM Regret 101", "Advanced Napping 301", "Group Project Survival").
- **Attend** each course once a New York day at the campus (the existing lecture action, per course): Energy for
  Confidence, a little clout and Smarts practice (skills, migration 0056). Each course keeps an
  **attendance streak**; missing a day resets it. A class line from the professor (cast regular) each time.
- Enrolled students get a **"Go to class"** daily task in place of the random one (migration 0076); attending any of
  the week's classes completes it.

### Exams (the weekly payoff)
- Every Friday (New York) each course has a **5-question quiz** with funny multiple-choice questions, written
  weekly like hunts and news (`content/exams/<Monday>.json`, checked by `lib/exams.ts`, stored by the game with
  `content_import_exams`, migration 0077). Answers live on the server only; a course's set locks once someone has
  sat it, and weeks without a file use the standing bank.
- **Grade** = attendance that week plus quiz score: A to F. Grades make a **GPA**; a GPA of 3.5+ at week's end
  pays a scholarship (cash, once a week). One attempt; a "peek at your neighbor's paper" option adds a point
  with a chance of getting caught (an F and a funny note home). Satire, never shaming.

### Dining hall
- Each campus gets a **dining hall**: a cheap meal (student price for enrolled players) with a menu that
  changes every day ("Mystery Meat Monday", "Taco Tuesday: the tacos are a rumor") and one overheard line of
  campus gossip. Reuses the eat action.

### Dorm room
- A **dorm room** at each campus is a home (the homes system): the cheapest rent in the game, small room, a
  computer-controlled **roommate** with quirks (always microwaving fish, alarm at 5 AM, borrows your hoodie)
  who leaves notes. Real-player roommates (both opt in) are a later phase.

### Walking around campus (owner, Oct 18; migration 0075)
- Each campus is a set of rooms you walk between with the area pills above the place card (`CAMPUS_AREAS` in
  `lib/rooms.ts`): **the Quad** (where you arrive: lawns, benches, the events board, "Hang out on the Quad"),
  the **Lecture Hall** ("Go to class" opens Campus life on your courses; "Sit in on a lecture" for visitors), the
  **Library** ("Study" trains Smarts; the exam table opens your exams), the **Dining Hall** ("Grab a tray") and
  **Greek Row** (the party room). The walls wear the school's color.

### Campus parties and events
- **Greek Row party night** on **Tuesday, Thursday, Friday and Saturday** (owner, Oct 18), 9 PM to 2 AM city time,
  on Greek Row's dance floor. Events can carry `days` (New York weekdays); the server refuses other days and the
  daily task list skips them. The existing **Homecoming Tailgate** and **Open Mic on the Quad** stay on the Quad's
  board, plus finals-week "Library All-Nighter" later (Energy cost, Smarts and Confidence).

### Meeting people
- The **Quad** and the **Library** are hangout spots on each campus card; the players-at-this-place list
  (section 14) shows who's there, with campus icebreakers ("Is this seat taken?", "Did you do the reading?",
  "Want to form a study group?"). It should feel like a campus, not a dating app.
- **Study dates** join the crush and date-night system (v0.5): a date night on campus, free (migration 0076). Going
  to the campus (any action there) counts, as at any other date spot. Campus icebreakers on player cards: "Is this
  seat taken?", "Did you do the reading?", "Want to form a study group?"

### Relationship status (later phase)
- "Make it official": both players confirm; it shows on both profiles; either can end it at once (no notice
  to anyone else beyond the profile change); block ends it too. Never shows a real school or location.

### Houses: fraternities and sororities (later phase)
- Parody Greek-letter **houses** on Greek Row, open to everyone (not split by gender). A player joins one house
  (separate from Crew). Rush week: harmless pledge tasks (no hazing jokes). Houses earn points from members'
  classes, exams and party attendance; a **weekly house ranking** with a winner's banner and a cosmetic.

### School play (later phase)
- A weekly play. Players **audition** (Dance or Charisma skill), the game casts the parts; friends watch for
  Mood and clout. Watching alone is a free visit.

### School vs school
- A **campus leaderboard**: St. Johnsons vs Queensborough, by enrolled players' clout, classes attended and
  grades each week. The winning campus gets a banner on its card and a cosmetic for its students.

### Phasing
1. **v0.15 "Campus"** (before v1.0): enrolment, classes with streaks, weekly exams and GPA, dining halls, dorm
   rooms with the roommate, Greek Row party night, Quad and Library hangouts with study dates, weekly exam files.
   The campus leaderboard screen waits (owner, Oct 18: "leave out the leaderboard for now"); the Pride tab's
   standings stay as they are.
2. **Next:** houses (fraternities and sororities) with the weekly ranking, the school play, relationship status.
3. **Later:** real-player roommates, a campus story arc in the Studio ("Who kidnapped the mascot?"), school merch
   cosmetics, majors and graduating to alumni.

### Safety
- Players may be real classmates. No player-vs-player arguments; chat keeps its daily cap, word list, report and
  block. Anything public about two players (relationship status) needs both to confirm. Profiles never show a
  real school, dorm, class time or location. The game stays 18+.

### Open questions
- Satirical tuition bill and student-loan joke (game cash only): in v0.15 or later?
- How many weeks to "graduate", and what alumni get.
- ~~Who writes the weekly exam questions~~: the weekly drafting routine (docs/WEEKLY-CONTENT.md) writes
  `content/exams/<Monday>.json`; the game stores it by itself (migration 0077). The first week is Oct 19.

## 19. Daily tasks 2.0: goals, streaks and guest-list passes (owner, Oct 18; migrations 0073, 0074)

**Why:** daily tasks should push players to explore different activities and give them a reason to make progress
every day. Today the five tasks are random and pay flat cash (C$25 to C$50 each plus C$100 for all five), the Goals
tab has no rewards and no link to tasks, and missing a day costs nothing.

**Owner decisions (Oct 18):** goal progress is **framing only** (no savings jar: cash stays cash); the **game
suggests** the next goal; **add streaks**; guest-list passes cover clout-locked venues **and VIP floors**.

### The goal ladder (owner, Oct 18: "a much longer list, a progression, most of it locked behind clout")
- 25 goals in ten chapters, one per rank (lib/ranks.ts). A chapter's goals unlock at that rank's clout; the game
  suggests the first unfinished goal you've unlocked, and when those are all done, reaching the next chapter's clout.
  A goal finished early still counts and pays, once. The ladder lives in `lib/goals.ts` (`GOALS.ladder`) and in
  game_settings 'goals'.
- Pro gigs come before a better apartment; owning a home is a long-run goal (15,000 clout, 1,500 clout reward; any
  house counts, the progress bar tracks the townhouse).

| Unlocks at | Goals (reward in clout) |
| --- | --- |
| 0 (Ramen Noodle Era) | first purchase 25 · first shift 25 · all five daily tasks 50 · first gig payout 50 |
| 100 | a friend in your crew 75 · save C$15,000 75 · any skill to level 3 75 |
| 500 | pro gigs 150 · the hot dog cart 150 · move to Jackson Heights 150 |
| 1,000 | first car 200 · move to Sunnyside Gardens 200 · any skill to level 5 200 |
| 2,000 | big gigs 300 · past the Ultraviolet Society door 300 · a bodega 300 |
| 5,000 | a VIP floor at a medium club 500 · move to the LIC high-rise 500 |
| 15,000 | own a home 1,500 · a laundromat 750 |
| 50,000 | the LIC penthouse 2,500 · a café 2,500 |
| 150,000 | the Hunters Point duplex 5,000 · taco trucks 5,000 |
| 500,000 | take the startup public 10,000 |

- The Goals tab shows every chapter: done ticked, the current goal with a progress bar in its own terms
  ("C$1,240 of C$14,000", "380 of 500 clout"), locked chapters with "Unlocks at N clout". (No goal card on the Daily
  tab, owner, Oct 18: the Goals tab is the place for it.) Finishing a goal pays its clout with a reveal.
- **Goal-linked tasks:** two of the day's tasks are picked to move the goal forward (each goal has a lean: cash goals
  get a shift and somewhere to spend, the others places that give Confidence and clout). They carry a
  "🎯 Toward …" tag. The money is ordinary cash.
- **Task copy (owner, Oct 18):** titles say what to do and where in Clout City's voice ("Grab a bite at…",
  "Clock in at…", "Spill the tea with…"), with a rotating joke line under each.

### Streaks
- A streak counts New York days with **all five tasks done**. One missed day a week is forgiven automatically (a
  freeze); a second missed day resets it.
- Streak rewards are clout, items and passes, never extra cash (rent must stay a decision):
  - Day 3: +50 clout.
  - Day 7: a **task-only collectible**, a piece the Shop never sells (a neon "5/5" sign, a trophy shelf, a framed
    "Employee of the Month"). It lands in the Collection and can be placed at home.
  - Day 14: a **guest-list pass**.
  - Then every 7 days, alternating a collectible and a pass.
- The streak shows as a flame pin (white stroke, the other pins' red-pink) on the HUD task counter, and on the Daily
  tab as a minimal row of this week's date circles, filled with a flame on each full day; tapping it opens the **Streaks section** (owner, Oct 18): the run and best, this week, the last five weeks
  (full days and frozen days), the reward track (got, next, upcoming), the stash (passes and collectibles) and the
  rules.

### Guest-list passes
- One night (until midnight New York) inside one place you can't get into yet: a club above your door clout or a VIP
  floor above your free-entry clout. The player picks the place when they use the pass.
- One pass held at a time; unused passes don't expire until used. They never open a locked borough (Brooklyn's lock
  is about player numbers, not clout) and never pay out cash.
- The server's door and VIP checks accept a pass that is active tonight for that place.

### The daily mix (owner, Oct 18)
- Five tasks: 1 gossip, 2 goal-linked, 1 skill, 1 random.

## 20. Push notifications (owner, Oct 18; migration 0078)

Push only (lock-screen notifications when the game is closed); no in-app inbox. Owner decisions: **4 a day plus chat**,
quiet hours **10 PM to 9 AM** (the player's local time), **win-back pushes in**.

- **Tiers.** P0 someone is waiting (messages, matches, date and crew invites, ride requests, a friend joining); P1
  something expires or costs you (bills, gigs ready, a full till, a streak about to end, exams, party night, a guest
  pass tonight); P2 you won something (rank up, goals, streak rewards, skills, grades, lotto, on air or on screen); P3
  come back and play (new tasks, hunts, gossip, story beats, boroughs, win-back), only ever as one morning roundup.
  The full list with copy is `PUSH_KINDS` in `lib/push.ts`.
- **When many are queued.** Score = tier (100/70/50/20) + up to 30 as a deadline nears + 15 from a crush, match or
  crew − 10 per push sent today. One push per player per run: the top score, with the same group (or kind) merged in
  ("💬 Tasha (3)"). Expired pushes are dropped, never sent late; a push for a player who's in the game is dropped too.
- **Caps.** 4 a day outside Messages, 15 minutes apart; chat at most every 10 minutes; P3 between 9 AM and 9 PM.
  Quiet hours hold everything except a date that's happening now. Six switches in Settings → Notifications (Messages,
  Dates & crew, Money & bills, Reminders, Rewards, News & hunts) and a test button.
- **Asking.** Lola asks once, a little into a session after the first party; "Not now" waits three days. On iPhone
  push needs the Home Screen app (iOS 16.4+), so the ask points there first.
- **Steps.** 1: the plumbing (devices, switches, queue, rules, sender, the ask, Settings). 2: P0 and P1 triggers.
  3: P2, the P3 roundup and win-back. Money and safety notices (VIP renewals, payments, bans) stay email.
- **Step 2 (migration 0082).** P0 comes from row triggers on messages (text only, not reactions), crush matches,
  date nights, crew outing invites, rides, together invites and invites (a friend joining). P1 comes from
  `push_scan()`, run by the sender each time: bills due today or tomorrow and late ones (one a day; rent 3+ days late
  is the eviction warning), gigs ready, tills full, a 2+ day streak with today's five not done (6 to 9 PM New York),
  exams open (Friday) and their last day (Sunday, with an exam left), and party tickets starting within the hour. A
  trigger can never break the action it watches. The last four came in migration 0084 (below).
- **Step 3 (migration 0083).** P2 from the ledger (goal, streak, skill, jackpot and pot wins, scholarship) and a new
  best rank; on air and on the Big Screen when they actually air (`push_scan_rewards`). Rewards earned while playing
  are dropped by the sender (the player saw them); the ones that land while away go out. P3 (`push_roundup`, 8 AM to
  8 PM New York) only for players who haven't opened the game today: five new tasks, a new hunt and fresh gossip on
  Mondays, today's story beat, a borough opening, and win-back at 3, 7 and 14 days away. The sender folds every P3
  into one "☀️ Your Clout City morning" push.
- **Tonight (migration 0084).** The city clock runs a day every two real hours, so these use the real New York
  evening: **date_now** at 7 PM on the day of an accepted date, to whichever of the two hasn't gone (allowed in quiet
  hours); **crew_there** the moment a crew member arrives, to the others who said they're in; **party_soon** at 8 PM
  on a party night (events with `days`, e.g. Greek Row), to that campus's students; **pass_tonight** at 8 PM, once per
  unused guest-list pass.

## 21. Creators: affiliate links and the UGC engine (owner, Oct 18)

Creators we work with make short videos about Clout City (the UGC engine) and earn a share of what the players they
bring in spend (affiliate links). Every rule below is decided (owner, Oct 18). **Built:** step 1, attribution and links
(migration 0087), step 2, commissions and performance (migration 0088), step 3, the creator page (migration 0089), and
step 4's manual payouts (migration 0090) and step 5, video tracking (migration 0091). Stripe Connect payouts and the
briefs library are still to build. How to run it day to day: `docs/CREATORS.md`.

### Decisions (owner, Oct 18)
- **Rate:** set per creator in the Studio. New creators default to **20%**; **30%** is the preset for high
  performers; an admin can set any rate from 0 to 50%. A change applies to payments from then on.
- **Length:** set per creator in the Studio: **12 months, 24 months or for life** (default 24 months), counted from
  each player's sign-up. It covers every payment that player makes in that window, renewals included. A player keeps
  the length that was set when they signed up.
- **Links:** only admins create, edit and retire links, in the Studio. Creators can't make their own.
- **Prices stay** ($4.99 a month, $39.99 a year, $119.99 chat forever, $2.99 side stories, $3.99 tickets and
  collector pieces). Postcards moved to $1.99 (migration 0086) because the $0.99 price couldn't carry a commission.

### Rules
| Rule | Decision | Why |
| --- | --- | --- |
| What the % applies to | **Net revenue**: the price minus Stripe's fee, tax and refunds | Recovers 3 to 9 points of margin versus paying on the price |
| How long | 12 months, 24 months or for life, per creator (default 24) | Big creators can be offered for life; the rest stay bounded |
| Hold | Commission becomes payable **45 days** after the payment | Refunds and chargebacks land inside the hold and are taken back |
| Payout | Monthly, once a creator has **$50** payable | Keeps transfer fees down |
| Who counts | A player who signs up through a creator's link or code; the first creator wins, forever | Simple, fair, no fights over the same player |
| Not commissionable | Purchases by the creator's own account; the lotto (no real money anyway) | Self-referral and the 18+ simulated-gambling rule |

### How players are attributed
- **Link:** `https://<site>/c/<slug>` (for example `/c/tasha` or `/c/tasha-tiktok`). It counts the click, sends the
  player where the link points, and the game remembers the link on the device for 30 days and attaches it to the
  account when the player signs up.
- **Code:** sign-up has an optional "Creator code" field, for people who saw a video rather than tapped a link.
- **Invites still pay:** if a crew invite and a creator code both apply, the inviter still gets the in-game invite
  reward and the creator gets the commission. They don't compete.
- **Once only:** attribution is fixed at sign-up. Changing it later is a Studio action, logged in `admin_actions`.
- **Welcome gift (owner, Oct 18):** a player who signs up through a creator gets an in-game welcome gift: C$500 and
  a free Shop outfit item, set per creator in the Studio (ledger 'creator_welcome', paid once). Never real-money
  products, VIP or anything sold for real money; real money never buys virtual cash, and neither does a referral.

### What we store (migrations, all server-only, no browser access)
- `creators`: id, name, handle, contact email, code (unique), rate (percent, default 20, 0 to 50), length (12, 24 or
  null for life), welcome gift (C$ amount and an optional Shop item), status (active or paused), payout details
  reference (Stripe Connect account id, never bank details), agreed-terms date.
- `creator_links` (owner, Oct 18: custom links from the dashboard): id, creator_id, slug (unique, e.g. `tasha-tiktok`),
  label (e.g. "TikTok bio", "Halloween video"), where it lands (the home page, sign-up, or a screen such as a story,
  the Shop or VIP), optional campaign and video, active or retired, created_by, created_at. Every creator starts
  with one default link; links are retired, never deleted, so old videos keep counting.
- `creator_referrals`: player_id (one row per player), creator_id, link_id (null when they typed the code), how (link
  or code), attributed_at, commission_until (sign-up + the creator's length; null for life).
- `creator_commissions`: one row per payment, unique per Stripe event (like the ledger): creator, player, purchase or
  renewal reference, gross, Stripe fee, tax, net, rate, commission, status (held, payable, paid, reversed),
  payable_on (+45 days), payout id. A refund or chargeback writes a reversing row.
- `creator_payouts`: creator, period, total, method, Stripe transfer id, paid_at.
- Clicks: a daily count per link (no per-person tracking).

### How it runs
- The Stripe webhook already records purchases and renewals (`payment_grant`, `payment_renewal`). For a referred
  player it also writes a commission row, using the actual Stripe fee from the payment's balance transaction.
  `payment_refund` writes the reversal. Everything stays idempotent per Stripe event.
- A daily job moves held rows past their date to payable.
- **Payouts, phase 1 (soft launch):** the Studio's Creators tab shows what each creator is owed; we pay by hand and
  mark the payout paid. **Phase 2:** Stripe Connect Express: creators onboard themselves (identity, tax forms, bank),
  and the payout is a Stripe transfer. Connect also handles 1099s in the US.

### Screens
- **Studio → Affiliates** (admins; owner, Oct 18: "an affiliate section on the dashboard"). Four views:
  - **Overview:** totals for the period (7, 30, 90 days, all time): clicks, sign-ups, paying players, revenue,
    commission owed and paid, and net after commission; a chart of sign-ups and revenue by day; top creators and
    top links.
  - **Creators:** every affiliate in a table (rate, status, clicks, sign-ups, click-to-sign-up %, payers,
    sign-up-to-payer %, revenue, commission held, payable and paid, net). Add a creator; set the rate (20% default,
    30% high-performer preset, or any rate to 50%), the length (12 months, 24 months, for life) and the welcome gift;
    pause; approve and mark payouts. Rate and length changes are logged in `admin_actions`. Flags for suspicious patterns (many sign-ups from one device, refunds above
    20%, the creator's own purchases).
  - **Links** (owner, Oct 18: "create custom links on the dashboard"): create a link for any creator: pick the
    creator, type a slug (checked for uniqueness and allowed characters), a label, where it lands, and an optional
    campaign or video; copy it, show its QR code, retire it. Each link shows the same numbers as a creator, so one
    video's link can be compared with another's.
  - **One affiliate** (owner, Oct 18: "see the performance of each user with an affiliate link"): tap a creator to
    see their links, numbers over time (by day and week), a funnel (clicks → sign-ups → first purchase → VIP), what
    their players bought (by product), retention of their players (next day, day 7, day 30, like Insights),
    commission history and payouts, and the list of players they brought in (handle, sign-up date, link, spend,
    commission, still playing). That list is admin-only; creators never see who their players are.
- **Creator page** (`/creator`, signed in with the creator's email): their links and code, clicks, sign-ups, paying
  players and earnings per link, earnings by status, payout history and the next payout date. Counts only: never
  player names, chats or anything personal. Only admins make links (owner, Oct 18); creators see theirs here, read-only.
- **Insights:** a creators table (sign-ups, payers, revenue, commission, net after commission, and what we spent on
  their videos) so each creator's cost per paying player is visible.

### The UGC engine
- **Briefs:** a short library of video ideas in the game's voice (a story beat reveal, a lotto scratch, a date night
  gone wrong, a rank up, Lola's tea), each with the creator's code to show on screen.
- **Tracking:** in the Creators tab, each video's link, fee paid and post date, so spend sits next to the results.
- **Rules for creators** (part of the creator terms they accept): #ad or the platform's paid-partnership label on
  every post; no promoting the lotto; 18+ audience; no real brands, no promises about features that aren't built;
  no buying followers or incentivised installs.

### Economics (per sale, after Stripe 2.9% + 30¢, commission on net)
| Product | Price | Kept at 20% | Kept at 30% |
| --- | --- | --- | --- |
| Postcard | $1.99 | $1.31 | $1.14 |
| Side story | $2.99 | $2.08 | $1.82 |
| VIP monthly | $4.99 | $3.64 | $3.18 |
| VIP yearly | $39.99 | $30.82 | $26.97 |
| Chat forever | $119.99 | $92.97 | $81.35 |
Before tax, Stripe Billing (0.7% on subscriptions) and refunds. A web game pays no 15 to 30% app-store cut, so even at
30% we keep about what a store game keeps.

### Build steps (one pull request each)
1. **Built (migration 0087).** Attribution and links: `creators`, `creator_links`, the `/c/<slug>` redirect with click
   counts, the sign-up code, `creator_referrals`; the Studio's Affiliates section with Creators and Links (create,
   copy, QR, retire) and sign-up counts. As built:
   - Links land on the city (home), sign-up (opened), News, the Shop or the VIP plans. Guests land on the front door
     with "<creator> sent you" and the gift named; players who already have an account go straight to that screen.
   - A retired link, or any link of a paused creator, still lands visitors but stops counting clicks and sign-ups.
   - Attribution happens when the account is created (`creator_attach`), only for accounts less than a day old,
     never for the creator's own email; a link beats a typed code. The welcome gift's item is a Shop fashion piece
     sold for C$ (not a collector or reward piece).
2. **Built (migration 0088).** Commissions and performance: webhook rows on purchases and renewals, reversals on
   refunds, the 45-day hold; the Affiliates Overview, the money columns and each affiliate's page (funnel, products,
   retention, players). As built:
   - One commission per payment, at the creator's rate on the day of the payment. Stripe's real fee comes from the
     charge's balance transaction; if Stripe can't be read, 2.9% + 30¢ is used and the row is marked as estimated.
   - Refunds, full or partial, take back the same share of the commission. Unpaid commission comes back inside its
     hold; commission already paid is taken off the next payout.
   - A paused creator keeps earning on players they already brought in (the agreement still runs); pausing stops new
     clicks and sign-ups from counting.
   - Flags: refunds above 20% of a creator's players' payments. Device-level checks are not built (the game doesn't
     track devices).
3. **Built (migration 0089).** Creator page at `/creator`: the creator signs in with the email the Studio has for them
   (an email code or Google; they don't need to play), and sees their code, their links (read-only, with copy), clicks,
   sign-ups, paying players and earnings per link and for the typed code, earnings by state and by month, the next
   payout date and their payouts (empty until step 4). Counts only: never player names. An email that isn't a
   creator's sees a short "not on the list" note.
4. Payouts: manual first (owed, mark paid, CSV), then Stripe Connect. **Manual payouts built (migration 0090):**
   Studio → Affiliates → Payouts lists what each creator is owed today (payable after the hold), flags anyone under
   the $50 minimum (it rolls over), downloads a CSV of everyone ready to pay, and marks a payout sent (method, our
   reference, a note; never bank details). One payout takes everything payable for that creator. Paying under the
   minimum needs a tick ("closing the deal"). A payout marked by mistake is undone with a reason: it stays in the
   history as undone and the money is payable again. Creators see their payouts on `/creator`. Stripe Connect is a
   "coming soon" card.
5. UGC tracking: videos, fees and cost per paying player. **Built (migration 0091):** Studio → Affiliates → Videos logs
   each paid video (creator, its own link, title, platform, URL, post date, fee, note). Each video shows clicks,
   sign-ups, paying players and revenue through its link and the fee per paying player; a video without a link counts
   toward its creator only. "Cost per creator" sets their total fees against sign-ups, payers, revenue and commission
   and shows what we keep (net revenue − commission − fees). Removed videos keep their spend. The briefs library is
   still to build.

### Answered (owner, Oct 18)
1. Commission on **net** revenue.
2. Length per creator: 12 months, 24 months or for life.
3. 45-day hold and a $50 minimum.
4. Rate per creator: 20% by default, 30% for high performers, editable.
5. Payouts by hand during the soft launch, then Stripe Connect.
6. Players who join through a creator get an in-game welcome gift.
7. Only admins make links.

## 22. Later features

Not part of P1; don't build yet. Each needs more players or more art before it's worth building.

| Feature | What it is | Why later |
| --- | --- | --- |
| Premium penthouse with parties | One multi-floor apartment bought with real cash. Owners can throw a party once a week, announced to players, with RSVPs and a guest limit, attended by players and NPCs | A fifth real-money product, multi-floor interiors, and enough players to fill a party; parties need moderation |
| Buildings with multiple floors | Going upstairs inside a place | The exclusive event venue (section 10) is the first; more buildings later |
| Friends at home | Invite your crew to your apartment and chat there | Part of group hangouts on the roadmap |
| NPC conversations | Back-and-forth talks with choices | Needs a dialogue system and more writing each week |
| News on the map | Headlines pop up at the places they mention | After the News feed proves itself |
| Social Scene update | Speed dating, compliment polls, an avatar-only fit-check feed | Needs enough players online at once |

### The stations as places (migration 0059; owner, Oct 16 testing)
- Real Clout FM and the Clout Tower are places with the full place treatment: a card with their own
  illustration and lore, a room inside, a pin on their landmark, and they're listed first in Places.
- **Real Clout FM** (template `radio`): a studio with the broadcast desk, the ON AIR sign and a couch.
  DJ Sharm Almight is the regular (at the desk, with evergreen lines). Actions: "Sit in on The Wake-Up
  Call" and **Send Radio Shoutout** (the desk, or the button), which opens the Radio app's request form.
- **Clout Tower** (template `broadcast`): the control room with a wall screen, cameras and a ring light.
  Actions: "Watch the Big Screen with the crew", **Get on Billboard** (the ring light), which opens Clout
  TV's upload, and "On the Big Screen now" (the wall screen, also on the card from anywhere).
- The station buttons work once you're there, like every place; the Radio and Clout TV apps still work
  from the Phone anywhere. The Radio app shows even when today's show can't load, and says why.

### The Hub and where people are (migration 0061; owner, Oct 16)
- **The Hub** is the city's meeting point and comes first in Places. It replaced The Neon Spoon (a second diner
  with no regular) and keeps its id, `neon-spoon`, so visits and payments there stay with players; the Neon
  Spoon lives on as the diner on its ground floor, so gossip, news and hunts that name it still make sense.
- Four floors joined by stairs, all open to everyone: 0 the restroom (restroom gossip, as at a club), 1 the
  Neon Spoon diner ("Pancakes at the Neon Spoon counter"), 2 the game room (arcade cabinets, a pool table:
  "A round in the game room"), 3 the lounge (couches, a piano: "Hang out in the lounge"). Each floor holds
  more players than a usual room. `place_presence` counts floors 2 and 3 at the Hub (elsewhere upstairs is VIP).
- The building: four glass rings, one per floor, stacked off-center around a lit core and each tilted its own
  way, neon on every rim, a halo and a spire on top.
- Lola Lowdown is the host, greeting everyone in the diner (lib/cast.ts, with her own lines).
- **Places list:** the Hub first, Clout Tower and Real Clout FM 4th and 5th, the rest nearest first. Every
  place with real players there now shows "N players here" (`place_counts`: players seen there in the last
  few minutes, never NPCs, not you, not banned or blocked players).

## 22. Skill perks: skills open doors (owner, Oct 19; migration 0092)

The owner: "If you are very skilled at cooking, you can get a gig to come cook somewhere that pays a lot. If you have a
lot of charisma, you can be invited for an award show. If you can really dance, you get invited to the VIP of the
club", and it is told on the Skills screen.

- **What opens:** every skill has three perks, at levels 3, 6 and 9 (`SKILL_PERKS` in lib/skills.ts; the rules are
  copied into game_settings 'skill_perks' and a test keeps them equal). A perk is one of:
  - **Gig:** paid work for that skill. Once a week each (week = Monday, New York), takes Energy (25, 50, 75) and time
    (1, 2, 4 hours) like a board gig, and only one gig runs at a time, board or skill. Pays C$ on collect; level-9 gigs
    add 100 clout. Examples: private chef on an Astoria rooftop (Cooking 6, C$600), a celebrity's dinner party
    (Cooking 9, C$2,000), headline the park festival stage (Music 9, C$2,000).
  - **Invite:** accepted once (RSVP), pays clout (50, 150, 500); level-9 invites add a badge. Charisma 9 is the
    Cloutie Awards, presenting ("Cloutie Presenter"); Smarts 9 speaks at Big Ideas Night; Hustle 9 the investor
    dinner; Gossip 9 an off-the-record brunch.
  - **Access:** Dance 3 gets you past every club door, whatever your clout (the bouncer saw you dance). Dance 9 opens
    every club's VIP floor for free (`vip_access` answers 'skill'). Both last while you hold the level.
- **Level now, not best:** every check uses the skill's level with rust (`skill_now`), so a rusty skill closes its
  higher perks until it is trained back. Gigs and invites already done stay done.
- **Where players see it:** the profile's Skills tab folds each skill card (the first starts open; a folded card says "N of 3 perks open" and when one is waiting) and lists its three perks under its bar (Lv chip, then ✓
  when open) with the button: Take it, a countdown, Collect, Done this week, RSVP, You went or On. The Gigs app adds
  "From your skills" under the day's offers, with the next perk to unlock. A club's card says when your dancing gets
  you in or upstairs. Skill gig pay shows in the Bank as "Skill gig".
- **Server:** `skill_perks_state()`, `skill_gig_take(perk)`, `skill_gig_collect(perk)`, `skill_invite_accept(perk)`
  (ledger cash/clout 'skill_gig' ref perk:week, clout 'skill_invite' ref perk); `accept_gig` also waits for a running
  skill gig. Collecting a skill gig counts as practice for its skill.
- **Not built:** push notifications for newly opened perks, and perks for other players to see on your card.

## 23. The avatar and Shop upgrade (owner, Oct 21; part of v1.0)

The plan, its rules and its five stages are `docs/shop-manager.md` (it wins on detail); the style lines, templates and
art style are `docs/fashion-style-lines.md`. The owner's decisions of Oct 21:

- **Order:** (1) the Shop Manager, the import, pictures instead of emoji, approving home, cars, houses and makeup;
  (2) the new base bodies (bald versions with hair, headwear and coverings on top), body types, optimization and a
  low-graphics mode for low-end phones; (3) the hoodie template as proof; (4) the remaining garment templates, then
  accessories, plus the style mechanics; (5) Clout Couture, non-wearables first.
- **The catalog lives in the database** (migration 0099), every item on sale then brought in as live. The game still
  reads `city() -> 'shop'`, which the catalog keeps in step. New items are added in the Studio's Shop tab, not in
  `lib/city.ts`.
- **Clothes are gender based:** each item is Female only or Male and Female (defaults in shop-manager.md section 2).
- **Clothing that can't be worn yet shows, locked** ("Coming soon to your wardrobe"), and can't be bought.
- **Clout follows the live curve** (about 0.6 × price^0.62). Fantasy outfits keep their clout locks.
- **Tabs:** jewelry and watches in Luxury; hats, shades, scarves and bags in a new Accessories tab; Clout Couture as a
  row at the top of Luxury (and of a piece's own tab), with no Map tab.
- **The faux chinchilla coat** stays real cash, at $16.99.
- **Clout Couture editions:** numbering continues across drops, and an edition can be brought back. A mansion owner can
  have other homes; Billionaire's Row comes later.
- **Pictures** are stored in Supabase Storage (public `shop` bucket; masters in the private `shop-masters` bucket).


## 24. Relationships (owner, Oct 26; migration 0118)

The step after "It's mutual" (Clarifications section 14). Phase 1, as recommended and approved on Oct 26:

| Stage | How | What changes |
| --- | --- | --- |
| Crush | As before: secret, up to 3 | Nothing visible |
| Matched | Both crush on each other | "Matched" on the chat; date nights pay their bonus |
| Dating | 3 completed date nights, then one asks "Make it official?" and the other says yes | 💞 on both player cards (each can hide theirs), the couple streak starts |

- **Rules.** One partner at a time. Both accounts at least 7 days old. Going official ends every other crush of both (quietly) and no new crushes can be made while dating. An ask stays open 7 days.
- **Couple streak.** A New York day counts when the pair completes a date night, earns a together bonus, or trades 5 messages each way. One missed day in any 7 is forgiven. Day 3: +30 clout; day 7: +75 and a badge; day 14: +150 and a badge; day 30: +300 and a badge.
- **Date nights together** pay +15 Mood and +35 clout (instead of +10 and +25).
- **Gifts.** A gift box from Sal's or Schlep & Schmear goes to the partner: their Mood +10, the sender's clout +10, once a day.
- **Anniversaries.** Every week together +15 clout, every month +50.
- **Breaking up.** Either partner, any time, no penalty and nothing public: the other sees a gentle note once. The same two can't go official again for 14 days. Blocking ends it at once.
- **Pushes.** "wants to make it official" and "sent you a gift" (P0 social); taps open "Us".
- **Later.** Living together (shared home, split rent), Lola's column mentions (opt-out), couple Shop items, the Clout TV couple photo, matching-fit clout.

## 25. Sublets, phase 1 (owner, Oct 26: "Go with your recommendations"; migration 0119)

Subletting is New York rent culture: someone with a bigger place lets a spare room for a few weeks. Phase 1 is room
sublets only. The first mockup is `/preview/sublets?s=1..7`; the built screens are `/preview/home?sublet=browse|listed|
living|hosting|notice|ended` (Phone → Apartments → Sublets).

**Who can host.** A player renting the Jackson Heights 1BR, Sunnyside Gardens or the LIC high-rise (not the room
share, the studio, dorms or an owned house). Both accounts 7+ days old. One sublet per player at a time, as host or
subtenant; a host with an open listing can't apply elsewhere, and the other way round. C$ only; real money never
touches it.

**Listing.** Apartments gets a Rent / Sublets switch. The host sets a weekly rent between a quarter and half of the
home's rent (the floor stops friends using it to dodge rent) and a range of 1 to 8 weeks, plus an optional note
(140 characters). The host's crew sees a new listing for 24 hours, then everyone. Listings show the host's rating and
the clout rule the sublet skips. Editing keeps the crew-first clock; taking it down closes its applications.

**Applying.** The subtenant picks a length and writes an optional note; up to 3 applications at a time, none while
rent is due at home. Nothing is charged until the host accepts; then the first week's rent plus a one-week deposit
leave the subtenant's bank (ledger 'sublet_rent', 'sublet_deposit'), the rent goes to the host ('sublet_income') and the
game holds the deposit. Accepting closes the listing, its other applications and the subtenant's other applications.

**Living there.** The subtenant skips the home's clout requirement and the Home tab shows the host's place with a second
bed in the first free spot (read-only: they can't move furniture; sleeping, sitting and cooking work). A bar switches to
their own place, which is held: no rent bills there while they sublet (`bills_sublet_hold`), furniture kept. Rent is
charged every 7 days from the start, ahead (`sublet_settle`, run whenever either side opens the game and by the push
sender's `sublet_settle_all`); if the subtenant can't pay, the sublet ends and the deposit comes back. Roommate hang:
when both tap it on the same New York day, both get +10 clout (ledger 'sublet_hang', once a day).

**Ending.** The subtenant can leave any time; the host gives 7 days' notice (and can take it back). The end date, a
block by either side, the host moving, buying a house or being evicted, or Start over also end it. The deposit always
comes back in full. Both rate the other (1 to 5 stars) on an "it's over" card; ratings show on listings and
applications. Either side can ask to renew (1 to 4 more weeks); the other says yes or no.

**Cards and pushes.** Player cards show "🏠 Subletting from @host" / "🔑 Hosting @sub"; each side can hide their own
line. Pushes: a new application, accepted, a renewal ask, a roommate hang waiting, notice given, the sublet ended.

**Phase 2 (not built).** Whole-apartment sublets while away, Lola's "Sublet Horror Stories" column and the scam
listing satire.

## 26. The Crib Rating and wall art (owner, Oct 26: "Yes to both", "Go with Crib Rating"; migration 0120)

A home's **Crib Rating** (code and database: the home score) is 0 to 100 for how well it's furnished, relative to the
home, so a beautifully done room share can reach 100 like a penthouse. It gives players a reason to invest in their
place beyond looks.

**How it's worked out.** Only bought pieces placed in the home count (not what the place came with, not storage).
- Rooms (40): 10 each for living, bedroom, dining and decor with at least one piece placed.
- Quality (40): the stars of every distinct piece (one per furniture line, 1 to 4) against the home's target: room
  share and dorms 8, studio 10, Jackson Heights 14, Sunnyside 16, LIC 18, an owned house 24.
- Wall art (20): 5 for each distinct painting.
Real-money pieces count by their stars like any other (at most 4), never more. Levels: Bare walls (0), Moved in (20),
Cozy (40), Stylish (60), Magazine-ready (80), Iconic (100).

**What it pays and where it shows.** Reaching 40, 70 and 100 pays 50, 100 and 250 clout once each (ledger
'home_score'). At home, a "🏠 61" pill beside "Invite your Crew" opens the breakdown: the three parts, "Next up" tips
that open the right Shop section, and the milestones. Player cards show "🏠 Crib Rating 82 · Magazine-ready".

**Wall art.** Twelve paintings by invented artists (content/shop/wall-art.json, made with Higgsfield) in Furniture →
Art, C$95 to C$9,500. Each hangs on a wall (kind 'painting', walkable so it never blocks furniture; place it with its
back to a wall) and shows its picture from public/art/.

**Later.** Better sleep in a high-rated home, goals on the ladder, Lola's "Crib of the Week" in News, and having people
over (the next build).

## 27. Having people over (owner, Oct 26; migration 0121)

The crew home visits, brought forward from the Waterfront Mansion: a player invites people to their home.

**Where it starts.** The stats panel's Mood row (owner: "Invite people over should be part of the actions in the mood
HUD"): at home, "Have people over" (+Mood and clout a guest) opens the visit sheet; while hosting, the row shows the
visit. Each stat now lists several actions (owner: "allow more than one action under a category"): at home its home
options (nap, cook, sit), then the best place to go; out, something here, then the best place elsewhere, up to three.
Invites also arrive as a home card and a push (`/home?open=plans`).

**Two kinds.** A hangout: now, for an hour, 3 a day. A house party: now or up to 12 hours ahead, two hours, one a day,
snacks paid up front (C$40 + C$20 a guest the home holds).

**Who and how many.** Crew, a partner, and anyone the host chats with, if they take the host's messages. Room share and
dorms hold 2 guests, the studio 3, Jackson Heights 4, Sunnyside 5, LIC 6, an owned house 8. One visit at a time; not
while subletting someone else's room.

**The visit.** A guest taps "Go now" and is in the host's home (their furniture and paintings, read-only) with everyone
there, the host's room shows its guests, and a bar on top has the time left, the chat and Leave (the host's: Guests).
The room checks in every 4 seconds; someone counts as there for 3 minutes after their last check-in.

**Rewards.** A guest there for 2 minutes gets clout and Mood once (hangout 10 and 8, party 25 and 15); the host gets
clout for each, times (1 + Crib Rating / 100) at the start (hangout 8, party 20), plus Mood (4 or 6 a guest, up to 30 a
visit). A partner's visit counts toward the couple streak.

**Safety.** Guests touch nothing. The host sends anyone home, wraps it up or calls an upcoming party off (the snacks
are spent); blocking removes a guest at once; the chat is the host's (muted players can't post).

**Later.** Dinner parties with the cooking skill, open-door parties for the crew's crew, Lola's "Crib of the Week".

## 28. Starter Week and the first-week fixes (owner, Oct 26: new players "don't know what to do"; migration 0122)

**Starter Week.** Ten small missions for a new player's first seven days, each teaching one part of the game by doing
it: breakfast at Sal's Deli (+C$25), walk to Astoria Park (+10 🔥), take a gig (+15 🔥), collect its pay (+C$50), change
your look (+10 🔥), buy furniture and place it (+C$75), message a player (+15 🔥), find a piece of gossip (+20 🔥), pay
rent (+20 🔥), go to an event (+25 🔥). All ten: the "Fresh Off the 7 Train" badge, C$500 and a violet area rug.
- A pill under "Invite your Crew" shows the count and the first mission not done; it opens a sheet with all ten and a
  Go button for that one (a place, an app, the Shop's Furniture tab or a sheet). Missions count in any order.
- Marks come from what the game already writes (triggers on place visits, the player's place, look and layout, gigs,
  messages, gossip, bills and events; they swallow their own errors). `starter_state()` pays what's due once (ledger
  'starter', ref the mission; 'starter_finish') and the game shows a toast for each.
- Only players who joined after migration 0122; it ends after 7 days, when finished, or when hidden.
- The current mission's place glows on the map (neon, never gold).

**Apps by rank.** Businesses and Jobs open at Rank 2 (a 🔒 and "Rank 2" on their tiles until then); every other app is
open from day one. A device that saw them locked gets Lola's "New for you" once they open.

**Tasks after onboarding.** The daily tasks open once, as they are, when onboarding ends (in place of Lola's 30-second
nudge). The tour, the tasks' design and the leaderboard are unchanged.

**Lola (owner, Oct 26).** A light-skinned, mixed woman with long brunette hair, drawn as a portrait like the Mayor's
(`public/cast/lola-lowdown.webp`); her voice is mostly TMZ, a little Shade Room, with at most one slang term a line.

**Satire pass (owner, Oct 27).** Starter Week's missions, the first-day tasks and the first rank's goals are written as New
York satire ("Console a billionaire's depressed dog in Astoria Park", "Ask the bodega cat for permission to exist", "Escape
your roommate's sourdough starter"); what completes each is unchanged. The first party is celebrity influencer Peyton
Pastel's launch party, on two tickets the player's roommate's cousin "found" at Velvet Static's coat check. Sir Barksley, a
billionaire's depressed Pomeranian, sits on a bench in Astoria Park with Dmitri, his walker: the first visit during Starter
Week opens his scene (three ways to console him, each with its own reply); after that the park card shows Dmitri's update
of the day. Luxury rides (a limo, a helicopter) were previewed and taken out for now.

## 29. Moral Choices (owner, Oct 29: "Go ahead with moral choices. This is going to become the central theme of the game"; migration 0131)

From the owner's draft "Moral Choices System" v0.1, cut to a first build. Every player regularly decides what kind of person
they are, with real rewards, consequences and tradeoffs; the game never calls them good or bad, it shows what happened.

**Situation cards.** A one-line situation, an emoji and 2 to 4 choices. Each choice previews **You get**, **It costs** and
**Risk** (Low, Medium, High, with a short reason), and "⏳ may come back later" when it can. The same format as Campaign Mode's
situations (radio choices, then Decide). After the choice: a one- or two-line receipt and what it paid.
- **When:** after arriving somewhere, a subway ride, a shift, a gig, a meal, a visit or a hangout, the server may offer a card
  that fits the place, the moment and the player (40% when one is allowed). At most **2 a New York day**, at least 90 minutes
  apart, one waiting at a time; "Not now" puts it away for the day. A variant never repeats within 30 days, its dilemma not
  within 7. Never during the first session.
- **Where they come from:** `content/choices/*.json` (one file per area: life, transit, gigs, work, school, business, home,
  nightlife, dating, money): about 25 dilemmas in 2 or 3 variants at launch, checked by `validateCards` (lib/choices.ts,
  `npm run validate:content`, tests/choices.test.ts). The files hold every outcome's odds and what comes back, so only the server
  and the preview read them (lib/choicesContent.ts); players get the preview only (`cardView`).
- **Guardrails:** only invented people are involved (never a real player); grey, everyday temptations, not crime (police stay
  ambient, docs/culture/VOICE.md); every option is a real tradeoff and dishonest ones genuinely pay better today; a delayed
  consequence only does what its preview warned about and names the earlier choice. Real money never touches it.

**Integrity.** 0 to 100, starting at 70. **Private** (owner's decision in the draft): only the player sees the number (Profile →
Choices, and a meter under the rank); regulars feel it (Sal, Jojo and Gus have lines for high and low Integrity,
`reputation` in npcs.json). Losses apply in full, gains at half: a reputation takes far longer to rebuild than to lose. It
appears with the first choice ("New: your Integrity"). Bands: high from 70, low below 40 (cards can require either, for
honest-only chances and shadier offers). Start over is a new life: the meter and the record start again. Each player's
Integrity is their own. Campaign Mode's Integrity stays the candidate's.

**Consequences.** Immediate (cash, clout, mood, energy, Integrity: capped per card, paid once through the ledger 'choice', cash
and clout never below zero) and delayed (`choice_later`: 1 to 14 days later, paid once, ledger 'choice_later'; shown once in
"It came back", naming the choice, then kept in the record).

**As built.** lib/choices.ts (rules, pure), app/home/choiceActions.ts (crypto random, service role), migration 0131
(`reputation`, `choice_log`, `choice_later`; `choice_context`, `choice_open`, `choice_settle`, `choice_skip`, `choice_land`,
`choice_seen`, `choice_history`; service role only, rate bucket 'choice'), components/game/Choices.tsx (the card, receipt,
reveal, "It came back", the record), the Profile's Choices tab, the preview and the demo (lib/choicesSim.ts:
`?choice=now|back|high|low|log`).

**Later** (from the draft): Street Rep and the fixer world; crime-level offers and Heat; Integrity-gated places and events (a
charity gala, a back room); stories and Campaign Mode writing to the player's meter; NPC memory beyond lines; more delayed
consequences and recurring characters; about 4 new cards a week through the weekly content routine and the Studio; work cards
for Careers.
