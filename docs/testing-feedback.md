# Clout City: Testing Feedback, Decisions and Fixes

Oct 13, 2026 · @Internovatechnologies

Everything decided while testing the live build, in one place: the rule decisions, the bugs with their fixes, and the design changes by version. Numbers (#1 to #47) match the bug list spreadsheet.

> **Owner answers (Oct 13, 2026).** The build tested was v0.5 (pull request #2 merged v0.2 to v0.5), so the version labels below were remapped: the "fix now" list is **v0.5.1**, and the design changes become **v0.7** (formerly v0.2), **v0.8** (formerly v0.3) and **v0.9** (formerly v0.5). A new **v0.6 "Astoria and the News"** comes first (docs/08-new-features-spec.md); it also carries the treasure hunts, now in their full form. The tables below already include these answers:
> - **Map (#9):** keep the current day map and night map, both with 3D buildings on a tilted view. #9 is not a bug.
> - **Exclusive events (#19):** the ticket still pays clout with diminishing returns, plus the new keepsakes.
> - **Headwear (#46):** basic headwear (cap, fedora, bucket hat, durag) is free in the creator and Your Look; premium hats are sold in the Shop for C$.
> - **Chinchilla (#17):** the faux chinchilla coat stays a real-cash collector piece, among the premium fashion options. #17 is not a bug.
> - **Rent and bills (#23):** all bills are weekly (rent, phone, car insurance and car rental).
> - **Presentation (#44):** cosmetic only. It picks the avatar's base model and fits; it is never shown as a label and never used by dating, crews or leaderboards. Copy stays gender-neutral. Players can change it in Your Look.
> - **Guest screen (#47):** no top bar at all; the logo sits in the bottom card with Sign up and Log in.
> - **Pull requests:** grouped by cause (about 7 for v0.5.1), each listing the bug numbers it closes.
> - **#15:** cause not pinned down, so fix all three paths: a Wear button wherever owned clothing appears, a clearly visible change on the avatar, and a check that paid items are delivered.

**How Claude Code should use this file**

1. **Report first, no changes.** Compare this file with every file in `docs/` and with the code, and list: decisions that conflict with the docs; decisions that conflict with the code; bugs already fixed; and anything in the docs or code this file doesn't cover (such as features added along the way). For each conflict, say what each side says and recommend which should win. Then wait for the owner's answers.
2. **Then update the docs.** Once the owner has answered, update the files in `docs/` so they match these decisions. From then on, the files in `docs/` are the master copy.
3. **Then fix, in version order:** the v0.5.1 fixes first, then each version's design changes when that version is built.

**When this file and an older doc disagree, this file wins,** unless the owner says otherwise in step 1.

## Decisions from testing

These are final. The bug numbers show where each decision came from.

| Area | Decision | From |
| --- | --- | --- |
| Currency | Virtual cash is called Clout Dollars and is always written C$. Real money is always written $. C$ can never be bought with real money. | #16 |
| Real-money purchases | Use the same red button as everything else, with a $ price, on a card with a gold border and the ✨ REAL CASH tag. Tapping opens Stripe checkout, which is the second check. | #16 |
| Buttons and colors | Main buttons are red. Yellow is only an accent: the clout flame, the active nav tab, progress bars, avatar rings, stars and highlights. Destructive buttons (sell, block, report) are outlined in red. Gold appears only on the logo, the tagline, real-cash card borders and the REAL CASH tag. | #10 |
| Names | "Clique" is "Crew" everywhere. The owned-items screen is the "Net Worth" screen; the word "inventory" stays out. | #12, #30 |
| Map | The day map and night map with 3D buildings, as built (owner, Oct 13). Locked boroughs: a dashed red outline over a dimmed fill, and tapping one opens a sheet with a small map of that borough and a one-line Lola Lowdown teaser. The hazard stripe is only for closures and "Coming soon" bars. | #7, #9, #11 |
| Arriving at places | No spending before arriving. A location card shows its actions as a preview with a main "Go there" button; actions unlock on arrival. | #4 |
| Travel | Costs time, money and Energy by distance band. Modes: walk, subway, taxi or own car. A trip view from above, always free to skip. Timed actions use a personal timer that never moves the shared city clock. | #4 |
| Food and Energy | Clubs, lounges and later stadiums sell a luxury-priced drink or snack (medium Energy, no clout). At home, Nap restores Energy over a short timer and Sit restores Energy and Mood, both capped per day. **Built (v0.8 step 2, owner Oct 13):** a bar drink at clubs and the lounge is C$28 for +20 Energy, no clout, no cap (refused at full Energy so nobody pays for nothing). Nap is +30 Energy twice a day with an 8-second countdown (Skip ends it; the Energy lands at once); Sit is +10 Energy and +6 Mood three times a day. Both only at home; counts reset at New York midnight (migration 0026). | #3, #26, #27 |
| Event times | Club events start on the city clock. Exclusive events and special one-offs may use real New York time, shown in each player's local time. **Built (v0.8 step 5, owner Oct 13):** exclusive parties read "Fri 6:00 PM your time · 9:00 PM in New York" (one time for players in New York), doors count down in hours and minutes with the local time, Collection tickets carry the local date, and the hunt's weekly start shows in local time (lib/localTime.ts). | #18 |
| Rent and bills | Rent and all bills are weekly. Bills show each upcoming bill's amount and due date, including the phone bill from the start. **Built (v0.8 step 4, owner Oct 13):** rent C$600 / C$900 / C$1,600 a week, phone C$25, car insurance 0.5% of the car a week; 2 days' grace, move after 6; birth lottery C$3,000 to C$6,000; Bills shows the weekly total (migration 0028). | #22, #23 |
| Shop | The faux chinchilla coat stays a real-cash collector piece (owner, Oct 13). Basic headwear is free; premium hats are sold for C$. Clothing without a wearable 3D version is not sold. Every clothing item has "Try it on." Cars and homes ask for confirmation before charging. | #15, #17, #24, #37 |
| Creator | A clear "Pick your username" field: an @handle, 3 to 20 letters, numbers, _ or . with no spaces (owner, Oct 13; names claimed earlier stay). Presenting as Male or Female (the toggle ships in v0.5.1 on the two existing builds; four body types each in v0.7) (cosmetic only: never shown as a label, never used for dating, crews or rankings). Four body types each (male: Slim, Athletic, Broad, Plus; female: Petite, Athletic, Curvy, Plus), built as one base model per presentation with blend shapes; all clothing fits both presentations. Free headwear (cap, fedora, bucket hat, durag) listed before cultural and religious coverings. Starter outfit garment choices with colors. The starting-cash reveal is a quiet Monument Valley card at dusk (pastel peach-to-rose sky, a pale sun, stepped isometric blocks, ink-colored type; no confetti or chip) on a light stage, with the balance in SF Pro Medium (owner, Oct 13; replaces the coral banking-app card). Selected options in the creator are green, to complement the red buttons. | #43 to #46 |
| Home and profile | An avatar-head bubble left of the stats panel opens a full profile. The profile shows the avatar, clout, rank and net worth (public), badges, collections, crew, home and recent activity. The stats panel starts collapsed and shows one suggested action per stat when open. | #14, #25, #39 |
| Locations | Interiors are isometric 3D scenes (as built). Monuments are full locations: a shared landmark plaza scene, NPCs with rotating lines and hunt clues, and 4 to 6 activities. | #32, #33 |
| Exclusive events | Keepsakes and recognition: an event card, a profile badge, a plus-one and a personal news mention. The ticket still pays clout with diminishing returns (owner, Oct 13); attending's stats match a comparable club event. Attendance is uncapped. | #19, #20 |
| Treasure hunts | Weekly, one track per starting style, approved in the Story Studio. Built in full (NPC clues) in v0.6; the spec is docs/08-new-features-spec.md. | Test notes |
| Story Studio | All story and hunt approvals, scheduling and pausing happen there. It must check on the server that the signed-in user is an admin. | Test notes |

## Fix now: v0.5.1

Fix these before any new features, in pull requests grouped by cause (each lists the bug numbers it closes), tested in a mobile browser emulator and then by the owner on an iPhone and a low-end Android phone.

| # | Problem | Fix |
| --- | --- | --- |
| 1 | The keyboard closes every few characters while typing the email at sign-up; the sheet jumps | Keep the field focused when the keyboard changes the screen size; anchor the sheet above the keyboard |
| 5 | "Make it a date" is a dead end when there's nobody to ask | Show "Invite a friend" and "Send a crush invite" |
| 15 | Bought clothing (including real-cash items) can't be worn | Hide any item without a wearable 3D version; add Wear wherever owned clothing appears (Shop, Net Worth, Your Look); make the change clearly visible on the avatar; check paid items are delivered |
| 16 | Virtual and real-money prices look the same | Show every virtual amount as C$; real money stays $ |
| 22 | Bills show a date but no amount, and no phone bill | Show amount and date for each bill, including the phone bill |
| 30 | The owned-items screen is called "Possessions" | Rename it "Net Worth" |
| 36 | Close buttons don't respond on most sheets; hidden behind the image on venue cards | Close button always on top with a 44 pt tap area; every sheet also closes by dragging down or tapping outside. Check every sheet |
| 37 | Buy and Rent buttons touch | 8 pt gap, Rent visibly secondary, confirm cars and homes before charging |
| 38 | The phone slides off-screen sideways in Settings | Lock the page so it can't scroll sideways |
| 41 | The tutorial's highlight ring is off the top of the screen, and the tooltip covers what it explains | Draw the ring on the target's real position, recalculated on resize; place tooltips below top targets. Check all five steps |
| 42 | The game screen can scroll up, pushing the HUD off the top | Lock the screen to Safari's visible area. Same root as #38; recheck #41 after |
| 43 | The name field looks already filled in | "Pick your username" label with an @, empty-looking field with an outline, "Claim my username" disabled until a username is typed; usernames shown as @handles |
| 47 | Sign-up buttons appear twice on the guest map | Remove the top bar entirely; logo, Sign up and Log in live in the bottom card (done on the work branch) |

## Design changes, by version

Build these with the version they belong to; the decisions above give the rules.

| Version | # | Change |
| --- | --- | --- |
| v0.7 | 10 | Red main buttons; yellow as accent only; destructive buttons outlined in red |
| v0.7 | 7, 11 | Locked boroughs: dashed red outline; tapping opens a mini-map sheet with a Lola teaser and borough-specific copy |
| v0.7 | 43 to 46 | Creator: name field, Presenting as (cosmetic only), four body types per presentation, free basic headwear first (premium hats in the Shop), garment choices with colors, a Monument Valley starting-cash card (owner, Oct 13; replaced the Monzo-style card) |
| v0.7 | 25, 39 | Avatar-head bubble left of the stats panel, opening the full profile with public net worth (other players see net worth, clout and rank on the player card; owner, Oct 13) |
| v0.7 | 14 | Stats panel starts collapsed; one suggested action per stat when open (cheapest open place first, never real money); high Confidence points to pro gigs. Pro gigs also need 500 clout and big breaks 2,000 (owner, Oct 13) |
| v0.7 | 24 | Your Look as a dressing room (avatar on stage, items by category, try-on with Save look); "Try it on" in the Shop. Your Look shows only what you own, your starter pieces and the free headwear; Shop pieces stay in the Shop (owner, Oct 13). Depends on #15 |
| v0.7 | 40 | Collection redesign: real art in every state, foil, flip and serial number when owned, set progress bars, tabs for postcards, hunt cards and event cards. "Collect the postcard" shows a dulled preview of the actual card. Serial numbers count copies in the order players collected them ("No. 0042" is the 42nd), and an Events tab keeps exclusive party tickets after the party ends (owner, Oct 13). The Collection also gets its own app on the phone home screen (owner, Oct 13) |
| v0.7 | 6, 20, 21, 28, 29, 31, 34, 35 | Bug fixes: every place card shows its art with the title clear of the close button (#6, live since v0.6); no event copy promises a crowd size (#20); Bills has a real empty state with the next bill (#21); the Bank opens on the virtual dusk card with the balance and this week's in and out (#28); every transaction says where and what (#29); clothes show their own garment shape and color, and the gold chain and electric coupe get the right icons (#31); the phone's status bar uses drawn signal and battery icons (#34). The phone home screen keeps its current layout (#35, owner, Oct 13) |
| v0.8 | 4 | Travel: "Go there," transport modes with distance costs, skippable trip view, personal timers. Owner, Oct 13: the trip is watched from helicopter height, never street level (the camera stays at or above zoom 15.5, and closer than 17 isn't allowed); prices by band (under 0.5 / 0.5 to 2 / 2 to 5 / over 5 mi): walk free with 5/10/20 Energy and not past 5 mi, subway C$3, taxi C$8/16/28/45, own car free; trips last 3 to 10 seconds |
| v0.8 | 3, 26, 27 | Venue drinks and snacks; Nap and Sit at home, capped per day |
| v0.8 | 23 | Weekly rent; re-tune starting cash, rent and income together |
| v0.8 | 18 | Club events on the city clock; exclusive and one-off events may use real New York time, shown in local time |
| v0.9 | 19 | Exclusive events: event card, profile badge, plus-one, personal news mention (you, your crew, then a count; others see three random opted-in attendees and a guest list; opt-out in Settings); attending's stats in line with club events; the ticket keeps its clout with diminishing returns; uncapped |
| v0.9 | 32 | Monuments as full locations: shared landmark plaza scene, NPCs, 4 to 6 activities |
| Docs only | 33 | Docs say interiors are illustrated backdrops; update them to the isometric 3D scenes already built |

## Also in the build (not covered by testing)

These shipped in v0.2 to v0.5 and stay as they are: chat with block, report and the Studio review queue; crushes and date nights; crew outings ("Bring the crew"); the two parody universities; postcards and the Collection; side stories; the Studio's Reports and Metrics tabs; the Monument Valley-style location art. On the work branch, not yet live: the guest map showing every place (icons when zoomed out), full-city zoom, and a phone-sized frame on desktop.

## Not a bug after review

| # | Why |
| --- | --- |
| 9 | Owner keeps the day and night maps with 3D buildings |
| 12 | Already done: "Crew" everywhere in the game and the docs |
| 13 | Won't fix (owner) |
| 17 | Owner keeps the faux chinchilla coat as real cash |
| 18 | The build already uses the city clock for club events and real New York time for exclusive parties; only "show in local time" is new (v0.8) |
