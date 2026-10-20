# Culture packs (C1 to C6)

Oct 20, 2026 · @Internovatechnologies

Six small packs that make Clout City feel like New York to people who live here: food, slang, transit,
neighborhoods, events and characters who sound like the city. The full spec is
[cultural-authenticity-guide.md](cultural-authenticity-guide.md); the voice rules are [VOICE.md](VOICE.md).
Packs ship one at a time, in order, each only when the owner says "Build C<number>".

| Pack | Focus | Status |
| --- | --- | --- |
| C1 | Voice and content foundations | **Built** (Oct 20) |
| C2 | Astoria food and Energy | **Built** (Oct 20) |
| C3 | Astoria Park, jobs, roommates, first-time touches | Waiting |
| C4 | Transit and transit news | Waiting |
| C5 | Calendar events, sports, cultural invites (before Dec 31 for the NYE countdown) | Waiting |
| C6 | Stories, tea, hunts and dating spots | Waiting |

The guide's "Later: borough packs" wait until those boroughs open.

## C2: Astoria food (built Oct 20)

| Place | Tier | Hours (city clock) | On the menu | Person |
| --- | --- | --- | --- | --- |
| Ditmars Deli & Dreams (Sal's) | Budget | Always open | Bacon, egg and cheese C$8 (+12 Energy, the cheapest breakfast), chopped cheese C$14, **Pet Also Sal** (+4 Mood) | Sal, who remembers your order after 3 different days |
| Still-a-Dollar Slice | Budget | 10 AM to 1 AM | A slice C$6 (+10), **two slices and a soda** C$13 (+20) | Arben Krasniqi |
| The White Sauce Cart | Budget | 6 PM to 5 AM | Chicken over rice C$14 (+20) | Tariq Hossain |
| Boiled & Beloved Hot Dogs | Budget | 10 AM to 8 PM | Two dirty water dogs C$9 (+12) | Lou Ferraro |
| Feta Compli Taverna | Medium | 12 PM to 11 PM | Souvlaki and grilled octopus C$40 (+30) | Andreas Charalambous |
| Schlep & Schmear Deli | Medium | 7 AM to 9 PM | Pastrami on rye C$38 (+28) | Hersh Weiss |

How hours work: one city hour is five real minutes, so a closed place opens within two real hours at most. The
place card shows "Open 6 PM to 5 AM" or "Closed · opens 6 PM (in 25 min)", buttons stay off while it's shut,
and a daily task at a shut place says when it opens. The server refuses anything at a shut place (migration 0093).
Prices sit above home cooking per Energy, so cooking stays the cheapest way to eat (an existing rule).

## Where the content lives (edit these, no code needed)

| File | What's in it |
| --- | --- |
| `content/culture/slang.json` | The 30-term slang dictionary: term, meaning, origin, an example line |
| `content/culture/parody-names.json` | Real brands, teams and trademarked names, each with its invented stand-in. Also the short list of real names that are allowed |
| `content/culture/npcs.json` | One profile per Astoria place: name, age, background, personality, years in the neighborhood, catchphrases, likes, dislikes, place, slang they use |
| `content/cast-lines.json` | Everyday lines for the people on place cards (unchanged format) |

When a player taps someone on a place card, they hear that person's everyday lines **and** their profile's
catchphrases. `npm run validate:content` and `npm test` fail if any file in `content/`, or any of the game's
copy, uses a real name from the list, and they check each profile's shape.

## Decisions from the conflict report (owner, Oct 20)

The rows of the Oct 20 conflict report, as answered. "A" means the recommended fix.

| # | Topic | Decision |
| --- | --- | --- |
| 1 | The guide in the repo | Added here (C1) |
| 2 | Hunts and dating already live (v0.5, v0.6) | C6's hunt and dating content goes live in C6, no waiting |
| 3 | Borough order | Keep the Oct 17 order (Brooklyn, Bronx, Staten Island, Manhattan last; opened by players online) |
| 4 | Lucky Star Lotto | **Moves back to Flushing** and is part of v1.0 |
| 5 | The bodega | Grow Ditmars Deli & Dreams (Sal's) instead of a second bodega |
| 6 | Dollar slice | New Astoria slice shop; the combo is "two slices and a soda" |
| 7 | New food places | Add all five (slice shop, halal cart, hot dog cart, Greek taverna, Jewish deli); the cart you eat at isn't named "Dirty Water Dogs" (that's the business) |
| 8 | Opening hours | **Hours for the new food places only**; Sal's stays open all night |
| 9 | Daily tasks and hours | Tasks may use places with hours and say when they open |
| 10 | Rent day | Lola names the player's own due day, not Sunday |
| 11 | Roommate | **The roommate apartment is the main pick at sign-up**; the studio stays. Owner: "two beds or a bunk" (two single beds suggested; dorms already have bunks) |
| 12 | Starting cash | Stays C$5,000 to 10,000 |
| 13 | Sitting in the park | The park's hangout becomes "Sit on a bench"; add "Take a lap" and "Picnic" |
| 14 | Park name | Keep Hell Gate Park |
| 15 | Shifts | Dog walker, bodega cashier and deli counter as normal shifts |
| 16 | Goals | Add "Get your own place" and "Become a regular" at 0 clout |
| 17 | "Remembers your order" | After 3 different days at Sal's |
| 18 | First session | **Keep the current tour and party as they are**; add one or two slang terms to Lola's tour lines (done in C1). The roommate, first tasks, goals and the sublet tea arrive in normal play |
| 19 | Lola's pet names | Keep "babe", "darling", "sweetie" |
| 20 | "I ♥ NY" shirt | Invented "I ♡ The City" shirt |
| 21 | Transit passes | Sold on the Travel screen, not in the Shop |
| 22 | Trip time | **Stays on the player's own timer** (seconds); lines and delays add seconds |
| 23 | Train lines | Astoria and Long Island City N/W; Flushing, Jackson Heights and Sunnyside 7; Jamaica E |
| 24 | Cabs | "Taxi" becomes "green cab", plus a rideshare |
| 25 | Transit news | A new News kind with start and end times; an invented agency name |
| 26 | Real-date events | A short calendar list of real dates; NYE first |
| 27 | Rooftop | A new Astoria rooftop bar (NYE and a date spot) |
| 28 | Sports | Invented team names, no league named |
| 29 | Cultural invites | Built like skill invites; a gift from the bodega; dress code checks the outfit |
| 30 | First tea | The 31st Street sublet tea moves into C3 |
| 31 | "Generated" content | The weekly content routine reads the culture files; the content check blocks real names |
| 32 | Picnic date | A paid picnic, so the park counts as a date spot |
| 33 | Real names already in the game | Leave them (landmarks, Steinway Fresh Mart, Instagram) |

Answers to the open questions:
- Lola's arrival line in the guide keeps its four sentences (not trimmed).
- "Brick" lines and the puffer jacket run only in the cold months on the real calendar (about December to February).
- Showtime dancers: a small card during a subway trip, about 1 trip in 10, +3 clout, once a day (to confirm in C4).
- Delays: 10 to 30 extra seconds on that line, for a few hours.
- Character lines ship without a separate community review.
- Not every character uses slang. Lola keeps her own voice with one or two slang terms.
