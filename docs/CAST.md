# Clout City: the Cast and City Bible

Oct 13, 2026 · @Internovatechnologies

One recurring cast for stories, City News, hunts and places, so the same faces show up everywhere (docs/08-new-features-spec.md section 4). **Every name is invented** and checked so it doesn’t match a real person. Celebrity names are **punny type spoofs** (owner, Oct 13): they sound like celebrity names and wink at the type (the streamer, the basketball star), but never point at one real person. The sports stars are a basketball star and a football star: no league is ever named. The code mirror is `lib/cast.ts`; everyday lines live in `content/cast-lines.json`.

## Story regulars

Lola Lowdown (narrator), Loretta Bird, Ray Delgado and Detective Nia Okafor. Their bios are in docs/04-who-killed-sarah-bird-v2.md.

## Voices (owner, Oct 16)

**Lola Lowdown**, everywhere she speaks: the place cards, City News and "Ask Lola", Tea cards, "Spotted at",
postcards, the lotto news card, the borough teasers and The Hub, where she's the host. She's the city's **tea
queen**: she knows everyone worth knowing, can get you anything in the city, and always has the receipts. The
tone is a **spicy urban gossip blogger**: short punchy sentences, "babe", "darling", "sweetie" (one per line at
most, and not every line), "allegedly", receipts and screenshots, a wink at the end. She is on the player's side
and never mean about the player. Examples:
- "Need a table, a plug, a date or an alibi? Say less. I know a guy, and the guy knows better than to say no to me."
- "Don't come at me with \"allegedly.\" I have receipts, screenshots and a cousin at every door in Astoria."
- In the Sarah Bird story she keeps that story's rules: gossipy about the circus around the death, never about
  Sarah herself, and every beat about Sarah ends soft.

**DJ Sharm Almight** (Real Clout FM, The Wake-Up Call): New York, "yo son, you buggin'", with the slang a younger
audience uses: "no cap", "deadass", "lowkey", "bet", "say less", "it's a W", "fam", "facts". Hype, warm, never
mean. Examples:
- "Yo, good morning Astoria! It's ya boy Sharm Almight on The Wake-Up Call. If you ain't up yet, you buggin', son."
- "Keep it about you, fam. No tags, no names, no drama. I read shoutouts, not subpoenas. Don't get me jammed up."

Both voices still follow the house rules: invented names only, no real brands, no promises the game doesn't keep.

Culture pack C1 (owner, Oct 20): Lola also uses **one or two slang terms per message** from
`content/culture/slang.json`, keeping her own style. Every character and generated line follows
[docs/culture/VOICE.md](culture/VOICE.md); each Astoria person has a full profile (background, personality,
catchphrases, likes, dislikes) in `content/culture/npcs.json`.

## The celebrity world

For City News. Each has a personality, a want and a flaw, so their news writes itself. City news stays light: feuds, breakups, deals, comebacks and flops; no politics, tragedies or crime.

| Type | Name | Personality | Wants | Flaw |
| --- | --- | --- | --- | --- |
| Streamer | Chase Clout | Loud, streams for 14 hours, catchphrase "chat, chat, CHAT" | A record million live viewers | Gets banned about every other week |
| Basketball star | Dunk Daniels | Smooth, shoots from the logo, owns 400 pairs of sneakers | A championship ring | Late to everything, games included |
| Football star | Brick Tackleton | Gentle giant, nonstop family man | To be taken seriously as an actor | His acting |
| Reality TV star | Chardonnay Shade | Lives for the confessional booth, a born villain | Her own spin-off | Can't keep a secret, or a friend |
| Pop star | Lunaria | Mysterious, one name, drops albums at 3 AM | The Golden Mic trophy | Feuds with every producer she's worked with |
| Movie star | Brock Squarejaw | Square-jawed, does his own stunts | To be cast as a superhero | Ages one year every two years |
| Tech founder | Skyler Beta | Hoodie, ten apps, three pivots a year | To build the everything app | None of the apps work |
| Influencer | Peyton Pastel | Pastel everything, link in bio | A brand deal with a car company | Every apology video goes viral |

## The wannabes

- **DJ Polaroid**: A struggling DJ who plays Hellgate Hall's 7 PM slot to an empty room.
- **Chad Kensington, CEO**: CEO of "a stealth startup", which is a domain name.
- **Tiff**: "Basically an influencer": 312 followers, mostly bots, posts like she has millions.

## City Hall (for gossip)

Invented and satirical, never a real politician, party or issue (docs/08-new-features-spec.md section 8).

- **Councilmember Barb Tillwater**: Astoria's councilmember. Means well, types fast, proofreads never. Loves a ribbon cutting and a slice.

## Regulars at places

Tap a regular on a place card to hear a line; each tap says the next one. While a story runs, every other line comes from the story’s chatter for the regular’s role, so the city talks about it. Lines approved in the Story Studio’s **Cast** tab (personal updates and cast news, for a week or for every week) join the everyday ones below, updates first.

| Place | Regular | Story role | A line |
| --- | --- | --- | --- |
| Ditmars Deli & Dreams | Sal, the owner | clerk | “You want the usual? You've been here once. That's the usual.” |
| Grind & Gossip Café | Jojo, the barista | barista | “I heard something about Chase Clout, but I'll only tell you if you tip.” |
| Hellgate Hall | Rocco, the bouncer | bartender | “Your name's not on the list. Kidding. There is no list.” |
| Velvet Static | Mags, the bartender | bartender | “Chardonnay Shade was in here last night. Threw a drink. Then ordered another.” |
| Engine 7 Firehouse | Captain Rosa Díaz-Moore, Engine 7 | driver | “Hydrant ate a helmet again. Don't tell the chief.” |
| Ditmars Free Library | Mr. Penwright, the librarian | professor | “Shh. Unless it's gossip. Then whisper.” |
| The 114½ Precinct | Sgt. Bev Kowalski, the desk sergeant | doorman | “Another parking report? Get in line, hon.” |
| Respawn Arena | Pixel, the arena manager | driver | “Tournament Friday. Chase Clout might show up. Might also get banned.” |
| The Unisphere | Walt, the tour guide | driver | “Fun fact: this globe has outlived three of my marriages.” |
| Hell Gate Park | Gus, same bench, every day | driver | “Seen a lot from this bench. Want to hear about 1987?” |
| Lucky Star Lotto | Benny Fortuna, the owner, never bought a ticket | clerk | “Never bought one myself. Somebody's gotta stay rich.” |
| Gantry Plaza | Inez, the wedding photographer | driver | “Third proposal today. She said yes. They always say yes here. It's the lighting.” |
| St. Copay's General Hospital | Dr. Eleni Markou, the ER doctor (C1) | patron | “The wait is two hours. I said what I said.” |
| Low Light Lounge | Marcos Albuquerque, the owner (C1) | bartender | “Booth two is taken. By whom? Nobody. Officially.” |
| Steinway Fresh Mart | Camila Restrepo, the store manager (C1) | clerk | “Forty kinds of feta. Mira, I've tasted all of them.” |
| Triborough Works | Valentina Ospina, runs the gigs board (C1) | regular | “Ignore the kombucha. Take the gig.” |
| Harmony Community Chapel | Rev. Mercy Adeyemi, the reverend (C1) | patron | “Everyone's welcome. The chairs are a test of faith.” |
| Astoria Blvd station | Yesenia Ortiz, the station agent (C1) | driver | “¿Qué lo que? The train is two stops away. It's always two stops away.” |
| Clout TV Tower | Nour El-Sayed, the Big Screen producer (C1) | dj | “Three hours on the Big Screen. Make the photo count.” |
| Still-a-Dollar Slice | Arben Krasniqi, the owner (C2) | cook | “Two slices and a soda? Say less. Already in the oven.” |
| The White Sauce Cart | Tariq Hossain, the cart owner (C2) | cook | “Three a.m. is my rush hour. Everybody's honest at three a.m.” |
| Boiled & Beloved Hot Dogs | Lou Ferraro, the cart owner (C2) | cook | “Onions? Mustard? Don't ask about the water.” |
| Feta Compli Taverna | Andreas Charalambous, the owner (C2) | bartender | “Today is somebody's name day. It's always somebody's name day.” |
| Schlep & Schmear Deli | Hersh Weiss, the owner, at the counter (C2) | clerk | “On line, not in line. You're in New York now.” |

Tapping a regular plays their everyday lines (`content/cast-lines.json`) and their profile's catchphrases
(`content/culture/npcs.json`). Rockaway Diner (Effie, the waitress) and Radiant Harbor Church (Pastor Vale) have
profiles but nobody on the card: they're the Sarah Bird story's places.

## Writing for the cast

- Keep each character consistent: the personality, want and flaw above are canon. Change them here first.
- Regulars may gossip about celebrities and wannabes, never about real people or brands.
- A weekly personal update is one line (240 characters or fewer) in the Studio’s Cast tab, as a “Personal update” for that Monday’s week.
- Lines are satire with affection: the joke is on fame, not on the people who chase it.
