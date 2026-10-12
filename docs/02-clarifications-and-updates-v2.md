# Clout City: Clarifications & Updates (v2)

Oct 11, 2026 · @Internovatechnologies

This is the source of truth for Clout City's P1 game rules and scope. Where another document disagrees, this one wins, except for the World State layer, which follows the World State Layer Brief (v2).

**Related documents:** Game Concept Note, World State Layer Brief (v2), Who Killed Sarah Bird? (v2), Story Production and Payments Brief, Story Quality Brief, Design System Guide.

## 1. First-time experience and onboarding

New players land on the map as guests and are only asked to sign up once they interact. Order: guest map → sign-up → character creation (Look, Traits, Birth lottery, Home) → welcome screen → 5 tooltip tutorial steps → first task.

### Step by step

| # | Step | Type | What the player sees | How it works |
| --- | --- | --- | --- | --- |
| 1 | Guest map | Screen | The 2D street map of Queens, opening at street level on the Long Island City waterfront, with places and "Locked: Coming soon" boroughs. Guests see a slim brand bar (logo, Sign up, Log in), live city pills with real numbers, map filter chips, the live ticker and a sign-up card; the full game HUD appears after sign-up (updated Oct 12, 2026, following the SF Life reference) | Players can pan, zoom and filter freely. The first tap on a place or a locked borough opens sign-up and starts the music |
| 2 | Sign-up / log-in | Screen (modal) | Sign-up and log-in options over the map (email or Google); players confirm they're 18 or older | Completing it goes straight to character creation |
| 3a | Look | Screen | The avatar on stage, with name, body, hair, face, glasses and covering options, plus a row of eight starting styles | Every selection renders on the avatar instantly. The chosen style sets the starter outfit |
| 3b | Traits | Screen | Two-column trait cards | The player picks 2. "Continue" stays disabled until 2 are chosen, and the header copy flips to a success line. In P1, traits are flavor only, with no gameplay effect |
| 3c | Birth lottery | Screen | A dice tile and a "Roll the dice" button, then a reveal card | Rolled once per account. Rolls starting cash between $6,000 and $10,000 |
| 3d | Home | Screen | Queens apartments, each with its rent | Single choice. Homes whose first rent would leave less than the phone bill plus the party's entry price are disabled. "Move in" pays the first rent and drops the player onto the home map |
| 4 | Welcome | Screen (modal) | The welcome message | "Let's go" starts the tooltips. "Skip tour" goes straight to the home map, with the first task waiting in Tasks |
| 5 | Tutorial 1: Clout Score | Tooltip | A tooltip on the flame | The rest of the screen dims. "Next" advances |
| 6 | Tutorial 2: Money | Tooltip | A tooltip spanning Bank Balance and Net Worth | "Next" advances |
| 7 | Tutorial 3: Map | Tooltip | A tooltip on the Map tab | "Next" advances |
| 8 | Tutorial 4: Phone | Tooltip | A tooltip on the Phone tab | "Next" advances |
| 9 | Tutorial 5: Events | Tooltip | A tooltip on the champagne icon | No "Next" button. Tapping the Events icon ends the tutorial and starts the first task |
| 10 | First task: the party | Task | The event screen with the virtual-cash entry price and two buttons: "Bring the clique" and "Pull up solo" | Inviting is optional. Attending completes the task: cash and clout are awarded, Confidence rises and Energy drops. A completion card follows |
| 11 | Leaderboard | Screen | The clout leaderboard with the player's rank | Opens automatically after the completion card. "Climb the ladder" continues |
| 12 | Invite prompt | Screen (modal) | The invite pitch and the five-friend bonus | "Recruit the clique" opens the invite screen. If the player already invited during the party, show "Invite more friends" with the progress bar instead |
| 13 | PWA prompt | Screen (modal) | The add-to-home-screen pitch | Android uses the browser's install prompt. iOS shows the manual Share → Add to Home Screen instruction |
| 14 | Hand-off | Screen | The home map, with Daily Tasks showing 0/5 | The first-play pins on Net Worth and Invite your Clique appear now. A home-screen prompt then introduces the current story ("Queens has a whodunit. Think you can crack it?") and links straight to its latest beat in the News app |

**Tooltip rules:** one tooltip at a time, the rest of the screen dimmed, and the tutorial step shown (e.g. "2 of 5"). Tooltips 1 to 4 advance with "Next"; tooltip 5 advances only by tapping its target.

**The flow stays as is.** The number of screens after the party (completion card, leaderboard, invite, PWA, story prompt) is a deliberate choice.

### Tutorial script

The tone leans satirical and playful so first play feels delightful.

**Welcome screen:** Welcome to New York. Population: 8 million. People who matter: not you. Yet. You're here to become the main character. Here's a quick tour before the city eats you alive. \[Let's go\] · Skip tour (bold of you)

**Tooltip 1: Clout Score:** This is your clout: a scientific measure of how much strangers care that you exist. Grow it by completing tasks, being seen in the right places and owning things you definitely don't need. \[Next\]

**Tooltip 2: Money:** Your bank balance. It pays for rent, outfits and the occasional bribe to a bouncer. The diamond is your net worth, aka everything you own that you can casually mention. \[Next\]

**Tooltip 3: Map:** This is the map. You're starting in Queens. The rest of the city is locked until you're interesting enough. \[Next\]

**Tooltip 4: Phone:** Your phone. Updates, gossip, and the fam asking if you've "made it yet." \[Next\]

**Tooltip 5: Events:** Breaking news: somebody invited you to a party. We're as surprised as you are. Tap to RSVP.

**First task: the party:** Buttons: \[Bring the clique\] · \[Pull up solo\]. Completion card: "You were seen. Nobody knows who you are, but they saw you. That's a start. +$X · +X clout."

**Leaderboard:** In this city, clout is the only ranking that counts. Here's where you stand. Don't look too long. \[Climb the ladder\]

**Invite prompt:** Main characters need a supporting cast. Every friend who joins boosts your clout, and a full clique of five earns a big bonus. \[Recruit the clique\] · Later (lonely, but okay)

**PWA prompt:** Put Clout City on your home screen so you never miss a party, a deal, or a chance to be seen. \[Add to home screen\] · Not now. iOS version: "Tap Share, then Add to Home Screen. Yes, it's two taps. Fame takes effort."

Test the teasing button labels ("bold of you," "lonely, but okay") first; they are the lines most likely to read as either charming or snarky.

### Build notes

1. **Mobile-first.** Optimize every step above for mobile screens first.
2. **Fix customization rendering.** Selecting a hairstyle or feature currently doesn't update the character.
3. **Starting styles.** Eight styles, shown as a row of chips in the Look step: Bodega Drip, Thrift Store Icon, Midtown Finance, Night Owl Goth, Pilates Princess, Startup Founder, Influencer Soft Glam and Arcade Nerd. Each sets 3 to 4 cheap starter items and gives no stats or bonuses. Hair, braids, wigs, glasses and cultural or religious coverings (such as the hijab) are free Look options for every style and are never sold in the Shop.
4. **Starter wardrobe.** Only the chosen style's starter items. Luxury pieces such as chinchilla coats are bought in the Shop with virtual cash; a few rare collector items cost real cash (section 6).
5. **Home layout.** Only the stats panel (Energy, Mood, Confidence) collapses. The top HUD is persistent and the side icons are fixed (section 2).

### Decisions

- **Skipping.** Players can skip the tutorial. The first task then waits for them in Tasks.
- **Cancelled share sheet.** Cancelling the share sheet at step 10 doesn't stop the player from attending the party, and attending still completes the task.
- **No rivals in P1.** The rival intro is removed from character creation.
- **Starting cash rule.** The minimum lottery roll ($6,000) always covers the cheapest home's first rent, the phone bill and the party's entry price.

## 2. Home screen and HUD

The top bar is always visible, the side icons are fixed like TikTok's, and only the stats panel collapses. The top bar groups time, tasks and sound on the left, and clout, net worth and bank balance on the right.

### Top bar (persistent)

| Side | Element | Icon | Shows | On tap |
| --- | --- | --- | --- | --- |
| Left | Time | Text | City-clock time of day (section 12), which sets event times and whether it's day or night | None |
| Left | Daily Tasks | Checkmark + "0/5" | Today's tasks completed out of the total | Opens Tasks on the Daily tab |
| Left | Sound | Speaker / speaker with slash | Background music on or off | Toggles mute; the choice is remembered per player |
| Right | Clout Score | Flame + number | The player's social standing | Opens the clout leaderboard |
| Right | Net Worth | Diamond icon only, no figure | — | Opens Possessions (section 5) |
| Right | Bank Balance | Text, e.g. "$6,000" | Cash available to spend | Opens transaction history |

**Color rule:** the flame and the diamond are not gold. Gold is reserved for real-cash items (see the Design System Guide).

### Upper left, below the top bar

| Element | Icon | Shows | On tap |
| --- | --- | --- | --- |
| Invite your Clique | Text pill | Prompt to invite friends | Opens the invite screen (section 7) |
| Players Online | Green dot + "N people online" | Live count of active players; hidden below a configurable threshold, which starts at 1 | None |

### Right-side column (fixed, no collapse)

| Element | Icon | Shows | On tap |
| --- | --- | --- | --- |
| Tasks/Goals | Checklist | Daily tasks and long-term goals | Opens Tasks/Goals |
| Events | Champagne glass | Club events, free story events and exclusive events; badge when one starts soon | Opens upcoming events |
| Places | Building | Places in the city to visit | Opens the Places list (section 4) |
| Bills | Receipt | Rent, phone bill, car rental, car insurance; badge when due | Opens bills and due dates |
| Your Look | Person | The avatar, dressed in clothes the player owns | Opens the wardrobe |

**Bottom left (collapsible):** Energy, Mood and Confidence. Mood appears only here, not in the HUD. Energy is restored by eating at dining places (section 4).

**Bottom navigation:** Home (house), Map (location pin), Phone (phone outline), Shop (storefront).

**Notification pins:** Net Worth and Invite your Clique each show a pin on first play. Net Worth also shows one whenever it changes, since the HUD shows no figure for it.

**Icon choices:** Places uses a building (the pin belongs to Map), Events a champagne glass, Bills a receipt (to stay apart from the money figures), and Tasks/Goals a checklist (a trophy would imply the leaderboard).

## 3. First task, daily tasks and goals

The first task is attending a virtual-cash party; inviting friends is an optional extra.

1. **First task.** "You've been invited to a party." The player attends a club event paid in virtual cash and earns clout.
   - It starts after sign-up and character creation, so guests never reach an invite step.
   - Attending completes the task, whether or not the player invites anyone.
   - The minimum starting balance covers the party's entry price after first rent and the phone bill (section 1).
   - The party is protected: story effects never change or cancel it.
2. **Daily Tasks.** A set of activities or places to visit each day. Each task pays cash, and completing all of them pays a cash bonus. They reset at midnight New York time (shown to the player in their local time) and show as "0/5" in the top bar.
   - The picker only chooses places that are open and off cooldown that day, so every daily task can be completed.
   - Story tasks can count toward the day's tasks.
3. **Goals.** Long-term objectives, kept separate from Daily Tasks. Both live under the Tasks/Goals button.
4. **Activities at locations.** Visiting a place can include actions such as taking a picture and posting it on social media.

## 4. Map, boroughs and places

P1 has one 2D night map, every player starts in Queens, and other boroughs show as locked.

1. **One map.** A 2D night map of Queens. The Real Map view and its toggle are removed. The map reads game data through one coordinate system and a small interface (show pins, move the camera, locate the player, set a borough's lock state), so a 3D map can replace it later without touching game logic.
2. **Location button.** A button on the map routes back to the player's current location.
3. **Queens first.** All players start in Queens. It needs activities, places to visit, things to buy, and deals that make significant money.
4. **Locked boroughs.** Other boroughs appear on the map labelled "Locked: Coming soon."
5. **Places.** A list of places in the city to visit. Each entry shows its distance and the cost of visiting.
   - The cost of a visit sets its clout reward, so pricier places give more clout.
   - Place visits are exempt from the diminishing-returns rule (section 5).
   - Each place gives clout once per real New York day (configurable).
6. **Dining places.** Food spots are places on the map, in three tiers, and eating is how players restore Energy. They follow the normal place rules: the visit price is the meal, and the first visit each day pays clout by price. Every visit restores Energy, with no cooldown, so players can eat as often as they can pay. Food gives nothing to Possessions or net worth.
   - **Budget:** bodegas, food carts, pizza-slice counters. Cheap, a small Energy boost, little clout.
   - **Medium:** diners and cafés. Mid-priced, a medium Energy boost.
   - **Luxury:** rooftop restaurants and chef's-counter dining. Expensive, a large Energy boost and the most clout, because being seen there is the point.
   - Prices and Energy amounts per tier live in config.
7. **Story effects on places.** Stories can raise a visit price or restrict or close a place, always with a reason banner ("Closed: police activity"). Price changes affect cost only; clout is always based on the base price.
8. **Names.** Businesses, brands and organizations are invented. Real landmarks are allowed only when the name isn't trademarked; otherwise use an invented name.
9. **No purchases at places in P1.** Places are visited, not shopped; a meal at a dining place is a visit, not a purchase. Buying items happens in the Shop. The one exception is the monument postcard, a real-money purchase offered on the monument's card (section 6).

### The living map

When zoomed in, generic 2D cars, buses and an elevated train loop along the roads and rail lines, with headlights at night, so the city feels alive. They are decorative only: they never affect travel, cost or time. Cap them at about 30 on screen, pause them when the tab is hidden, turn them off under reduced motion, and use no transit-agency logos.

### Locations

Tapping any location on the map opens its location card: an illustration, a few lines of lore in Lola Lowdown's voice, and its actions, each showing its effects (price, Energy, clout, Mood, Confidence). Locations come in three depths.

| Depth | What it has | Used for |
| --- | --- | --- |
| Full | The card, plus an interior scene with the avatar and 2 to 4 actions | Places players use often |
| Scene card | The card with an illustration, lore and 1 to 2 actions; no interior | Civic places, parks, monuments, story places |
| Map flavor | A label and lore; no actions | Subway stations, the airport |

**Interiors** use 8 shared templates (apartment, counter shop, diner or café, fine dining, club, store, office, campus), reused with different colors, signs and props. In P1 they are illustrated 2.5D backdrops with the 3D avatar placed in them; fully 3D rooms can replace them later through the same template slots.

**P1 locations: 34 visitable, plus map flavor**

| Category | Count | Examples (Queens) | Depth | Main actions |
| --- | --- | --- | --- | --- |
| Homes | 3 | Astoria studio walk-up, Jackson Heights 1BR, Long Island City high-rise | Full (apartment template) | Move in, view home |
| Dining | 6 | Bodega, food cart, pizza counter, Rockaway Diner, a café, a rooftop restaurant | Full (the food cart is a scene card) | Eat (Energy); clout once a day |
| Nightlife | 3 | Two clubs (one hosts the first-task party), a lounge | Full | Visit, attend events |
| Work | 3 | Delivery-rider hub, retail store, office tower (the café doubles as the barista job) | Full (the hub is a scene card) | Work a shift; gigs board at the office |
| Shopping | 2 | Fashion boutique, car dealership | Full / scene card | Opens the matching Shop category |
| Universities | 2 | Parody campuses inspired by Queens universities | Full (campus template) | Attend a lecture, campus event |
| Civic | 4 | Police precinct, firehouse, Borough Hall, public library | Scene card | One light action each (e.g. a satirical community board meeting) |
| Parks and outdoors | 3 | Flushing Meadows Corona Park, Astoria Park, Rockaway Beach | Scene card | Hang out (Mood) |
| Story places | 4 | Skyline Pier Residences, Hunter's Pier, Radiant Harbor Church, Pressed Iron Gym | Scene card | Story tasks and visits |
| Monuments | 4 | The Unisphere, the New York State Pavilion, Gantry Plaza, Fort Totten | Scene card | Visit; postcard (section 6) |
| Map flavor | About 5 | Subway stations, LaGuardia ("flights coming soon") | Label and lore | None |

**Action rules**

1. Actions use only the existing effects: cash, Energy, clout, Mood and Confidence. All numbers live in config.
2. Visits pay clout once a day per place; dining restores Energy on every visit; shifts and gigs follow section 13.
3. Actions that raise Mood or Confidence (a lecture, studying at the library, a park hangout) can be done once a day per location, so they can't be farmed to qualify for gigs.
4. Shopping locations open the matching Shop category; they don't sell anything themselves.
5. Story places have story actions only while a story gives them one.

**Universities.** P1 uses parody names: two campuses inspired by real Queens universities, recognizable but invented. Real names are used only with a university's permission, pursued separately as partnerships. High schools aren't included, since the game is 18+.

**Monuments.** Four Queens monuments in P1. Each monument's name and design is checked before launch, and every illustration is original, never a photo. Monuments in locked boroughs (such as the Statue of Liberty) come later. Visiting a monument pays clout like any place; its postcard is described in section 6.

## 5. Shop, possessions, selling, bills and economy

The Shop sells items through categorized item listings, everything a player owns appears in Possessions, and Possessions always adds up to net worth.

1. **Shop structure.** The Shop opens on categories that lead into item listings. Use "item listings" for the Shop, and keep the word "inventory" out of the build.
2. **Categories.** Fashion/Clothing, Cars, Houses, Luxury (jewelry etc.) and Makeup.
3. **No gifts for now.** No gifting between players.
4. **Possessions.** Net Worth opens Possessions: the bank cash plus every item the player owns, each with its value. The total equals net worth. Monument postcards live in a separate Collection, not in Possessions, and don't count toward net worth.

   | Item kind | Value in Possessions |
   | --- | --- |
   | Bought with virtual cash | Purchase price |
   | Real-cash collector item | 1.5× the most expensive virtual-cash item in the same Shop category |
   | Earned (rewards, story items) | The price of the closest comparable Shop item, or a small fixed amount (set in config) when nothing compares, so selling rewards never becomes a money-maker |
   | Starter items from character creation | $0 |
5. **Selling.** Items can be sold from Possessions for 60% of the item's value (configurable).
   - The sale adds the sell price to the bank and removes the item, so net worth drops by the difference.
   - Real-cash collector items can't be sold, because selling them would turn real money into virtual cash. Starter items can't be sold.
   - Clout already earned from a purchase stays. Buying back an item the player sold earns no clout.
   - Selling a house restarts rent. Selling a car ends its insurance.
   - Sell buttons use the destructive button style with a confirmation.
6. **Your Look.** The avatar can only wear clothes the player owns: the starter items plus anything bought.
7. **Diminishing returns on purchased clout.** Each additional purchase gives less clout than the last, so net worth and clout stay separate. This applies to virtual-cash and real-money purchases alike. Exceptions: place visits give full clout (with a cooldown, section 4), and story side arcs give no clout at all.
8. **Bills.** Rent, phone bill, car rental and car insurance.
   - New players start with rent and the phone bill only.
   - Car rental and car insurance begin when the player rents or buys a car.
   - Buying a house ends rent. Buying a car ends car rental, but car insurance continues.
9. **No buying virtual cash.** Virtual cash can never be bought with real money.

## 6. Events and real-money purchases

P1 has three event types and four real-money products, all bought through one Stripe Checkout flow.

**Purpose of events.** Club events and celebrity parties give players something to spend on, boost Confidence, add clout, and give a reason to invite friends.

### Event types

| Type | Paid with | Example |
| --- | --- | --- |
| Club events | Virtual cash | The first-task party |
| Free story events | Free | The Sarah Bird candlelight vigil, spawned by a story beat |
| Exclusive events | Real money only, never virtual cash | Celebrity parties |

### Real-money products

| Product | Promotion | Clout |
| --- | --- | --- |
| Exclusive events | Promoted first: the game's first real-money purchase | Diminishing returns (section 5) |
| Story side arcs ($2.99 each) | Promoted second, inside the story | None |
| Collector fashion items (a few rare pieces) | Not promoted; discovered while browsing the Shop | Diminishing returns (section 5) |
| Monument postcards ($0.99 each) | Offered only on the monument's card, once right after a visit; then shown in the Collection as a locked silhouette with its price | None |

**Postcard rules:** a postcard can be bought only after visiting its monument. Players earn clout from the visit, not the postcard. Postcards live in a separate Collection (not Possessions, so they don't affect net worth), each has a share button, and completing the set earns a badge. A refund removes the postcard.

**Payment rules (all four products)**

- Hosted Stripe Checkout, one-time payments, purchases attached to the player's account.
- Only the Stripe webhook grants access. It is idempotent, and `hasEntitlement(player, sku)` is the single gate.
- A refund (`charge.refunded`) revokes the entitlement automatically. It also takes back the exact clout that purchase awarded at the time (stopping at zero, with no recalculation of other purchases), removes a refunded collector item from Possessions and the wardrobe, and removes a refunded event's guest-list access
- Prices live in Stripe and config, not in code.
- Only these products use gold in the UI.

## 7. Invite clique flow

Inviting earns clout per invite plus a major bonus when the clique reaches five.

1. **Button.** "Invite your Clique" sits upper left with a notification pin on first play.
2. **Invite screen.** The invite interface at the top, clique members' profiles below it, and a progress bar toward the five-member bonus.
3. **Rewards.** A set clout amount per invite, paid when the invited friend signs up, and a major bonus when the fifth member signs up.
4. **Payout timing.** Per-invite clout pays out when the invited friend signs up, which stops players spamming invites for clout. Inviting is optional in the first task.

## 8. Tone, metrics and scope

**Tone.** Satirical, funny and delightful, on top of real mechanics. Activities and Shop copy lean into the clout theme, for example "Fake it till you make it: pay the bar man to enter the exclusive club" or "Rent this luxury sedan. Might be fake life, but it's oh so worth it when you pull up to the club." No real brand names.

### Success metrics

- First task completed.
- Clique invite sent.
- Day-1 return: 35 to 40% (stretch goal: 50%). For reference, the median mobile game sits around 22% and the top 10% around 40%.

### P1 scope (current build)

- Guest entry, sign-up and the four-step character creation (Look, Traits, Birth lottery, Home) with eight starting styles.
- The welcome screen and 5-step tooltip tutorial into the first task.
- The 2D night map of Queens, with apartments, places to visit, place cooldowns, locked boroughs, moving vehicles, and 34 visitable locations with cards and 8 illustrated interior templates (section 4).
- The clout leaderboard (opened from Clout Score).
- The categorized Shop, Possessions and selling.
- Bills (rent and phone to start), with the missed-rent rules, job shifts at a few Queens job places, and gigs (section 13).
- The invite flow and the PWA prompt.
- Club events, free story events and exclusive events.
- Real-money purchases: exclusive events, collector fashion items, story side arcs and monument postcards, through one Stripe Checkout flow.
- Player-to-player chat with block, report and an admin review queue (section 10).
- Background music with mute (section 11).
- The News app in the Phone, hosting Story mode: "Who Killed Sarah Bird?" with three paid side arcs (section 9).
- The minimal World State layer, time-travel tool and debug panel (section 12).

### Later

- A 3D map.
- City headlines in the News app beyond stories: celebrity news (hookups, breakups, movie deals, tour announcements, endorsements, business deals, rehab, getting kicked out of the club), political scandals, tech founders dating pop stars and mayoral announcements, in a tone that is part satirical, part straight. Some pop up on the map as notifications.
- The insider pass, bundles and subscriptions.
- Rivals.
- Purchases at places.
- Fully 3D interiors replacing the illustrated templates.
- Real university names, with each university's permission.
- Monuments and postcards in other boroughs.

## 9. Story mode

Serialized, satirical stories are the main reason to come back every day. P1 ships one main story, "Who Killed Sarah Bird?", with three paid side arcs; the weekly cadence starts after the pilot, with each new main story starting on a Sunday. Full detail lives in the Sarah Bird v2 brief, the Story Quality Brief and the Story Production and Payments Brief.

### What players get

1. **Main story.** 6 to 10 beats, one per day over one to two weeks. Each beat is a headline plus 2 to 3 sentences (about a 10-second read), ends on a cliffhanger, and opens with a one-line "Previously" recap for latecomers.
2. **A mystery to solve.** A hidden truth, 2 to 3 suspects and a red herring, with clues planted across the beats. It must be solvable from free content alone.
3. **Prediction moments.** 2 to 3 points where players guess, then see live results of how everyone else guessed. Correct guesses earn clout and a "Called It" badge. Every prediction closes before any beat that points at its answer.
4. **World hooks.** NPC chatter, places or events the story affects, price or availability changes, and story tasks (e.g. "Ask Ray what he saw").
5. **Side arcs.** Three paid side arcs, one of each type (a character's perspective, evidence or documents, insider/behind the scenes), 4 to 6 beats each, $2.99 each. Free players see a teaser: title, one hook line and a locked card per released beat, with no spoilers.

### The pilot: "Who Killed Sarah Bird?"

- A 10-beat whodunit anchored in Long Island City and Astoria, Queens, written in the satirical narrator voice of Lola Lowdown.
- Three predictions and three side arcs that each pass the worth-paying test and give paid players no edge before voting closes.
- Fictional characters, places and brands only.
- The darkest arc type the Story Quality Brief allows: the death stays off-screen and nothing is graphic. The home-screen prompt frames it as a mystery: "Queens has a whodunit. Think you can crack it?"
- Produced through the pipeline: both human approval gates, the editor pass, the validation script and a staging dry run. Every arc and beat has a pause/retire switch.
- Measured by beat opens, guess participation, side-arc purchases and return rate.
- **Pilot start:** The pilot's `start_at` is set manually when the player base is ready, not tied to launch day. The core loop (tasks, Shop, events, invites) carries the first days without a story.
- **Late joiners:** a player who joins mid-arc lands on the current beat with its "Previously" line and can read every released beat in order. They can vote in any prediction still open; story tasks from past days are gone.
- **Archive:** finished arcs move to the News app archive. They read in order, each prediction shows its final poll results, and the reveal stays behind its own beat so the list never spoils it. Before opening the reveal, a reader can make a "shadow guess" that earns a badge but no clout. Side arcs stay purchasable there.

### Payments

1. Each side arc is a one-time $2.99 real-cash payment through Stripe Checkout, the same flow as exclusive events and collector fashion (section 6).
2. Purchases attach to the player's account, which every player has after sign-up.
3. Buying a side arc unlocks every released beat, and it stays purchasable from the News app archive after the story ends.
4. A refund revokes the entitlement automatically.
5. Side-arc purchases never add clout.

### How it fits the rest of the game

- **Where it lives:** the News app in the Phone. A notification-style prompt on the home screen links straight to the current beat, and new beats can also pop up on the map.
- **Daily Tasks:** story tasks can count toward the day's tasks.
- **Clout:** correct guesses and story tasks earn clout. Paid side arcs add none and give no edge in guessing; they only add richer story.
- **Places and events:** a story can change a place or event, e.g. a gala gets cancelled or a building is closed for police activity, always with a reason banner.
- **Shop:** a story can add a time-limited item (e.g. the "Forever Our Bird" hoodie). Buyers keep it in Possessions after it is removed.

### Decisions

1. **Currency.** Side arcs are bought with real cash, never virtual cash. Bank Balance and virtual-cash club events stay.
2. **Purchase order.** Exclusive events are promoted first, side arcs second; collector fashion isn't promoted; monument postcards are offered only on the monument's card after a visit.
3. **No clout from side arcs.**
4. **Entry point.** Stories live in the News app. A home-screen prompt sends players straight to the current story.
5. **Refunds.** A refund (`charge.refunded`) revokes the entitlement automatically and takes back the exact clout that purchase awarded (section 6)
6. **First beat timing.** New players see the current story immediately after the tutorial hand-off.

## 10. Chat

Players can message each other in a Messages app in the Phone, with block, report and an admin review queue from day one.

1. **Who can chat.** Player-to-player messages between signed-up players, all of whom are 18 or older.
2. **Daily limit.** 10 messages per player per day. A counter shows what's left ("7 of 10 left today"), and the send button uses the disabled style at 0.
3. **Filter.** A basic word filter runs on every message before it is delivered.
4. **Block.** Available from each conversation's menu. Blocking hides the blocked player's messages immediately and stops them messaging the blocker.
5. **Report.** Available on each message and conversation. A report sends the conversation to the admin review queue.
6. **Admin review queue.** A simple internal tool listing reported conversations, newest first, with the reported messages, both players and the reason. Reviewers can dismiss a report, warn a player, mute them from chat, or ban them.

## 11. Sound and music

Sound in P1 is background music that plays in the game, controlled by the speaker icon in the HUD.

1. **Icon.** A speaker icon when music is on; a speaker with a slash when muted. Tapping toggles it.
2. **Start.** Browsers block audio until the player taps something, so music starts on the first tap. On the guest map that tap also opens sign-up.
3. **Memory.** Each player's mute choice is remembered across sessions and devices.
4. **Settings.** Mute is also available in settings.
5. **Tracks.** Royalty-free or original music only. No real songs.

## 12. World State and story timing

A minimal World State layer ships in P1 and follows the World State Layer Brief (v2); this section lists only the game rules it depends on.

1. **One source of truth.** Story beats declare effects; the Shop, places, events, tasks, chatter and the News app read them from the World State layer. A new story is a data file, never a code change.
2. **Story days.** One story day equals one real calendar day on a server-authoritative New York clock, so every player sees the same beat on the same day.
3. **Protected systems.** Story effects never touch onboarding, the tutorial, the first-task party, the borough unlock flow, sign-up, purchases, bills or rent.
4. **Prices and clout.** Story price changes affect cost only. Clout is always based on base prices.
5. **Dev tools.** A time-travel control and a debug panel in staging, used for the dry run of every story.

### Two clocks

The game runs two clocks with separate jobs: a fast city clock for moment-to-moment feel, and the real New York calendar for everything shared or anything that pays out.

| Clock | What it is | What it controls |
| --- | --- | --- |
| City clock (shown in the HUD) | A sped-up time of day: one in-game day every 2 real hours (configurable). Shows the time only, never a date or weekday | Day or night on the map, event start times, venue opening hours, Energy recovery, in-world flavor |
| Story calendar (real New York days, never shown as a clock) | One real calendar day on the server-authoritative New York clock | Story beats, prediction close times, the daily task reset, place-visit cooldowns, the 10-message chat limit, bills and rent due dates, the leaderboard |

**Rules**

1. **The first-task party ignores the city clock.** It's always "happening now," so a new player never waits for doors to open.
2. **Events show a countdown in real minutes** ("Doors open in 25 min"), so players know how long they'll wait.
3. **Story copy refers to real days only** ("tonight," "Sunday") and never mentions city-clock times.
4. **Resets are visible.** Daily Tasks shows when it resets (midnight New York), converted to the player's local time.
5. **Anything that pays out follows the story calendar,** so a fast city clock can never multiply clout, cash or daily bonuses.

Tune the cycle length in testing: if sessions run under 5 minutes, a 1-hour cycle makes night come around faster.

## 13. Age, Energy, income, rent and clout

These rules close the economy loop: work and tasks earn cash, meals restore Energy, and visits and events turn both into clout.

### Age

Clout City is 18+. Sign-up (email or Google) asks players to confirm they're 18 or older, and no one under 18 can create an account.

### Energy, Mood and Confidence

1. **Spending Energy.** Place visits, events and job shifts cost Energy (amounts in config). Dining visits restore it instead.
2. **Restoring Energy.** Meals at dining places (section 4), plus a small top-up at each New York midnight, so a broke player is never stuck.
3. **At zero.** Players can still read stories, vote, chat, shop and pay bills, but can't visit places, attend events or work until they eat or the daily top-up arrives.
4. **Mood and Confidence** scale clout gains: higher levels multiply the clout from visits, events and tasks (multipliers in config). Events move them; the first party, for example, raises Confidence. Confidence also drifts down a little each New York day unless events and visits keep it up, so staying highly confident takes upkeep.

### Income

1. **Daily tasks** pay cash, and completing all five pays a cash bonus (section 3).
2. **Jobs.** A few Queens job places (a café hiring baristas, a delivery-rider hub, a retail store) offer shifts. A shift costs Energy and pays cash, but no clout. Shifts are limited only by Energy. Pay rates live in config.
3. **Events and story tasks** pay as specified in their own sections (the first-task party pays cash and clout).

### Gigs

Gigs are rarer, bigger-paying jobs, and the main way to afford upgrades like a car or a better apartment. They pay more than shifts, cost more Energy, and the best ones are hard to qualify for.

| Tier | Example | Confidence needed | Offered | Pay (vs. one shift) | Energy (vs. one shift) | Wait before payout |
| --- | --- | --- | --- | --- | --- | --- |
| Side gig | "Be a professional crowd at a gallery opening" | None | Most days | 2 to 3× | 1.5× | 1 hour |
| Pro gig | "Run a social media campaign for a $14 artisanal ice cube startup" | 50+ | About every other day | 4 to 6× | 2× | 2 hours |
| Big break | "Write a speech for a councilmember candidate" | 80+ | Once or twice a week | 10 to 15× | 3× | 4 hours |

**Rules**

1. **Offers.** Each player gets their own offers in the Gigs app on the phone. They refresh at New York midnight and expire at the next one. Players also see offers they don't qualify for yet, with the Confidence needed, so there's something to aim for.
2. **One at a time.** A player can hold one active gig. Accepting it spends the Energy up front and starts the wait; the cash lands in the bank when the wait ends. A player without enough Energy can't accept.
3. **Cash only.** Gigs pay no clout. Real money can never buy gigs, extra offers or a shorter wait.
4. **Story gigs.** Stories can add gigs (through `task_injection`), under the same rules.
5. **Clients are invented.** Political gigs follow the Story Quality Brief guardrails: no real politicians or parties.

**Balance**

- Gig pay is set as multiples of the shift rate in config, never as fixed amounts, so tuning one number rescales every tier.
- **Targets:** shifts plus daily tasks cover the cheapest home's rent, the phone bill and budget meals, with a small surplus. Side and pro gigs fund a mid-range lifestyle. Big breaks make a car or a better apartment reachable within weeks, not days.
- Confidence drift keeps the top tier from being permanently unlocked; players have to stay active to keep qualifying.
- Gigs compete with visits and events for Energy, so every day is a choice between cash and clout.
- **Watch in analytics:** median bank balance by days played, and days until a player's first car. If either moves well ahead of the targets, lower gig multipliers or offer rates first.

### Missed rent

When rent is due and the bank balance can't cover it, the player gets a grace period (default 3 days) with a pin on Bills. After that, Mood drops. If rent is still unpaid after 7 days, the player moves to the cheapest Queens home: the new rent starts, and no possessions are lost. Both periods are configurable.

### Clout in P1

Clout is a ranking only: it drives the leaderboard and doesn't gate places, events or purchases in P1. After P1, boroughs unlock at clout thresholds tied to clout levels (see the roadmap in the Game Concept Note).

## Open questions

None. Every design question is resolved; the remaining work is setting Shop catalog prices, which the item-value rules in section 5 then follow.
