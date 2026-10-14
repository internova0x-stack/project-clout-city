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
- **Built (v0.8 step 1, owner Oct 13):** the player is at home or at one place (players.at_place). Place actions and events only work there (migration 0025 checks every visit and attendance). Getting there, by distance band (under 0.5 / 0.5 to 2 / 2 to 5 / over 5 mi): walk free for 5/10/20 Energy (not offered past 5 mi), subway C$3 flat, taxi C$8/16/28/45, own car free. Arrival is instant on the server; the client shows a 3 to 10 second trip from helicopter height (never street level), always skippable. Fares are in the Bank as "Taxi · Hell Gate Park".
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
- **One fixed prize table** for every game, in multiples of the card: the card back 1 in 5, 2× 1 in 10, 5× 1 in 40, 20× 1 in 400, 100× 1 in 5,000, 1,000× 1 in 100,000. Any prize 1 in 3.05; a card pays back 60.5% on average and 10% of every bought card goes to the weekly jackpot, so the lotto is a C$ sink. A big prize (100× or more) is about 1 card in 4,760: a player scratching about two cards a day has about a 1.3% chance a month.
- **Limits:** one free card a day (the C$5 game), a second one through a player's first 7 days ("Beginner's luck", shown openly), and 5 bought cards a day across all games. Everything resets at midnight in New York.
- **The counter:** a card wheel you spin to pick a game, the odds one tap away, then one card to scratch with a finger (or "Scratch it all"). One prize window, never three matching symbols, so there are no fake near-misses.
- **Can't be rigged from the browser.** The browser only names a game. The server checks the place, the limits and the cash, draws the prize from Postgres's cryptographic random source when the card is bought, and keeps it where players can't read it; scratching asks the server to reveal and pay it, once per card (ledger `lotto_card` and `lotto_prize`).
- **Real money never touches it:** cards cost C$, prizes are C$, and C$ can't be bought. Winnings go to the bank and count toward net worth. No gold in the lotto's look.
- **Built (v0.10 step 1, owner Oct 13):** migration 0032 (`buy_lotto_card()`, `scratch_lotto_card()`, `lotto_state()`), the 3D shop, the counter and the scratch card. **Built (v0.10 step 2):** the weekly jackpot, starting at C$5,000 plus 10% of every bought card; every card that week, free or bought, is one entry. With no scheduler, the first visit after Sunday midnight in New York draws the finished week once (`lotto_settle()`, migration 0033): one card picked uniformly with the cryptographic random source, the pot paid to its owner (ledger `lotto_jackpot`) with the 🌟 Jackpot winner badge. The counter shows the pot, when it's drawn and your entries; Lola's card leads the News City tab, naming the winner unless they opted out of the gossip (then "a lucky Astorian"). The winner always sees "It's you".

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
- **The event card lists what you get** before you buy: meet and chat with real people, a collectible (numbered ticket and badge), a City News mention, and that the party is on the Penthouse Floor.
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
- **A front door (owner, Oct 14).** Every room has a front door by the spot you come in, with a doormat and a **🚪 Go out** label: tap it and you walk out (to the map from home, back to the map from a place).
- **Arranging by tapping (owner, Oct 14).** No Arrange or Turn buttons and no home "Things to do" list: tap a piece of furniture and it's selected with Rotate, Cancel and Save, drag it to move it. The labels over things (Sit, Nap, Kitchen, Your look) are how you use them.
- **Side buttons (owner, Oct 14).** Tasks, Events, Places, Bills and Look sit just above the bottom bar on the right, TikTok-style: separate round buttons with a label under each. The map's locate button and credits move to the left.
- **Speech bubbles.** Everyone you can talk to in a room has a 💬 over their head; tapping it talks to them.

**Built (v0.11 step 5, Oct 14): every place can be entered.** Three new shared rooms (an **office**, a **civic** hall and an outdoor **plaza**) plus a **gym** join the existing ones, and every place but subway stations has a room (`template` in lib/city.ts; `placeRoom()` in lib/rooms.ts). A shared room takes the place's own actions, names and sign: the gigs board opens the gigs, the library desk says "Study in the quiet room", a dance floor only takes events where there are some. Places that were scene cards are recolored with their palette. Offices: Skybridge Tower, Triborough Works, Pedal Pushers. Civic: the library, precinct, firehouse, chapel, Radiant Harbor and Skyline Pier's lobby. Plazas: the parks and Hunter's Pier. Gyms: Pressed Iron and Rep Count. Diners use the café, pizza and the supermarket the counter shop, rooftops the lounge, the dealership the store, the college and the cinema the lecture hall, the games arena the club. Who you talk to fits the place (the librarian, a trainer, the desk sergeant…).

## 12. Later features

Not part of P1; don't build yet. Each needs more players or more art before it's worth building.

| Feature | What it is | Why later |
| --- | --- | --- |
| Premium penthouse with parties | One multi-floor apartment bought with real cash. Owners can throw a party once a week, announced to players, with RSVPs and a guest limit, attended by players and NPCs | A fifth real-money product, multi-floor interiors, and enough players to fill a party; parties need moderation |
| Buildings with multiple floors | Going upstairs inside a place | The exclusive event venue (section 10) is the first; more buildings later |
| Players at the same place | See which real players are at a location, with preset reactions; real chat only with people you're connected to | Needs live presence and enough players; stranger chat is ruled out |
| Friends at home | Invite your crew to your apartment and chat there | Part of group hangouts on the roadmap |
| NPC conversations | Back-and-forth talks with choices | Needs a dialogue system and more writing each week |
| News on the map | Headlines pop up at the places they mention | After the News feed proves itself |
| Social Scene update | Speed dating, compliment polls, an avatar-only fit-check feed | Needs enough players online at once |
