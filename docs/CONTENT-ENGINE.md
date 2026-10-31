# Clout City: Content Engine

**Status:** spec v1 (Oct 31): both open questions answered by the owner. Steps 1 to 5 are built. It replaces the Frameworks Map's "to write" Content Engine spec and the
reactive part of the World State brief.

**Owner decisions (Oct 31):**
- **The goal.** A content generator plus a world state that update endlessly and react to events in combinations that
  unfold depending on how the player plays.
- **AI later.** v1 runs on hand-written templates the game fills in itself. Live AI writing is a later layer that plugs
  into the same generator (section 8).
- **Automatic with a veto window.** New content goes live by itself after a review window unless the owner vetoes it in
  the Studio, the way autopilot already works for news, hunts and gossip.

---

## 1. What exists, and the gap

**What already reacts to the player:**
- Moral Choices cards (by place, what you just did, rank and the Halo ↔ Hustler meter). They come back days later, chain
  into follow-up cards and make Lola's Blotter.
- Campaign situations.
- Career grudges.
- Regulars' lines that follow the meter.
- Daily tasks that follow the current goal.

**Content today:**
- The weekly Claude Code routine writes news, hunts, gossip, exam weeks and stories as files.
- Validators check them, and autopilot or the Studio puts them live.
- The World State layer applies their effects to the city: `price_multiplier`, `availability`, `place_state` (with spawned
  events), `flag` and `chatter_topic`.

**The gap:**
1. **No shared memory.** Each system keeps what the player did in its own table (`careers.state`, `campaigns.state`,
   `choice_log`, dating, businesses), so nothing can react to a combination.
2. **Content is global and weekly.** Everyone gets the same news and stories, written once a week.
3. **The world only changes on a story's schedule,** never because of what players did.
4. **No templates.** Every card and line is written out in full, so one idea makes one piece of content.

## 2. The four parts

| Part | What it is | Built from |
| --- | --- | --- |
| **Player memory** | Everything a player did that content might care about, in one place, readable by every system | New: `player_facts` plus a derived snapshot |
| **City memory** | What's true in the city now: running stories, conditions, and what players did in total | World State (exists) plus new tallies and conditions |
| **Storylets** | Content units with conditions over both memories, and results that write back into them | Moral Choices cards, generalized |
| **Generators** | Templates with slots that the game fills from both memories; the weekly routine writes new templates | New |

The loop is:

> play → memory → storylets fire → results change memory and the city → new storylets become possible

## 3. Player memory

### 3.1 Facts (stored)

- **Table:** `player_facts` (player, key, subject, value jsonb, count, first_at, last_at, expires_at).
  - Unique per (player, key, subject).
  - Written only by the server through `fact_note(player, key, subject, value, ttl_days)`.
- **Keys are namespaced:** `career.took_credit` (subject `kendall`), `career.fired` (`tech`), `campaign.won`
  (`starr`), `choice.fenced_phones`, `place.banned` (`velvet-static`), `dating.partner` (a player), `campus.cheated`,
  `story.voted` (arc and answer).
- **Expiry:** facts can expire. A grudge fades; a firing doesn't.
- **Who writes facts:**
  - Every system writes facts where it already settles things (career saves, campaign saves, choice settlement, dating,
    businesses, campus).
  - Ledger triggers cover the rest cheaply: the ledger already records most events.
  - Writes are error-swallowing, so a memory write never breaks a purchase or a shift.

### 3.2 Snapshot (derived, never stored twice)

`player_snapshot(player)` reads the player's current standing from the tables that already hold it:
- rank, clout and net worth;
- the meter band (Halo, middle, Hustler);
- home and roommate;
- job, level and work mood;
- businesses owned;
- couple status;
- student status;
- campaign running;
- marks (bans, holding);
- skills;
- crew size.

Storylets read the snapshot and the facts together.

## 4. City memory

- **Running stories, effects and chatter:** the World State layer, unchanged.
- **Tallies:** `world_tally(key, subject, day, count)`, bumped by the same fact writes.
  - Examples: sabotage at Pivotly today; players banned from The Sticky Floor this week; campaigns won by Starr.
  - Only totals are kept, never who did what.
- **Conditions:** city-wide states with a start and an end, published ahead of time as World State effects. Examples:
  heatwave, cold snap, blackout on a block, transit meltdown, festival week, sample-sale weekend. They live in
  `content/conditions/` and are drafted weekly.
- **City storylets:** these fire on tallies and change the city for everyone for a while through World State effects.
  - 50+ sabotage moves at Pivotly in 7 days → "HR crackdown week" (Pivotly's sabotage is traced twice as often, a
    News item, chatter).
  - A player's campaign wins → the Mayor's lines and City News change.
  - 3+ players banned from a club in a day → the club "tightens the door" for the weekend.

## 5. Storylets

A storylet is a Moral Choices card with three additions: **conditions** over memory, **slots**, and **results that write
memory**.

```json
{
  "id": "promoted-fraud-cover",
  "kind": "card",
  "when": {
    "all": [
      { "fact": "career.promoted", "withinDays": 7 },
      { "snapshot": "meter", "is": "hustler" }
    ],
    "none": [{ "fact": "career.reported_fraud" }]
  },
  "slots": { "boss": { "from": "job.manager" }, "amount": { "scale": "week_pay", "times": 2 } },
  "title": "{boss} offers you a bigger role, and {amount}, if you sign off on numbers that aren't real.",
  "options": [
    {
      "label": "Sign it",
      "outcomes": [{
        "weight": 1,
        "effects": { "cash": "{amount}" },
        "sets": [{ "fact": "career.covered_fraud", "subject": "{boss}" }],
        "later": { "afterDays": [5, 12], "chance": 0.5, "card": "fraud-audit" }
      }]
    }
  ]
}
```

- **Kinds:**
  - `card`: a choice, shown at the existing moments (after arriving, a shift, a workday, a meal…).
  - `news`: a personal item in News, or a Blotter headline.
  - `line`: what a regular or coworker says when tapped.
  - `effect`: a world change for that player only, such as a price, a door or an invitation.
  - `push`: a notification, through the existing push rules.
- **Conditions:**
  - a fact (exists, count, within N days, subject);
  - snapshot fields;
  - a city condition or running story;
  - the place's tags, the time of day, the New York weekday, a calendar event.
- **Results:**
  - today's effects (inside today's caps);
  - lasting marks;
  - `sets` and `clears` facts;
  - follow-up chains;
  - Blotter headlines;
  - World State effects for the player.
- **Picking:**
  - Eligible storylets are weighted.
  - **Cross-system storylets** (conditions from two or more systems) that the player hasn't seen come first: they're the
    combinations nobody writes by hand.
  - Cooldowns apply per storylet, per base and per template.
  - The existing daily caps stay (2 cards a New York day, 90 minutes apart).
- **One card format for the whole game.** The 76 Moral Choices cards and the 36 Climb cards become storylets with no
  conditions beyond today's. Campaign situations and career tasks move onto the same format later (section 9).
  - Previews follow the owner's Oct 30 rule, extended to Campaign Mode on Oct 31: You get and It costs, no risk labels or
    "comes back" hints anywhere in the game.

## 6. Generators (templates)

- **Slots:** a template names roles, not people or places, and the game fills them for each player:
  - `{coworker_you_crossed}` from facts;
  - `{a_place_you_are_banned_from}`;
  - `{a_celebrity_mid_scandal}` from the running story or the cast;
  - `{a_club_tonight}` from the calendar;
  - `{amount}` scaled to the player's income or bank.

  One template plays differently for every player.
- **Validation:** templates are checked with their longest possible fills (text lengths, invented names only, effect caps).
- **Variety of structure:** templates are written in families (a favor, a temptation, a betrayal, a windfall, a test of
  loyalty), so the weekly batch varies the kind of situation, not just the names.
- **Supply:** the weekly routine (docs/WEEKLY-CONTENT.md) drafts:
  - about 10 new templates;
  - 1 to 2 city storylets;
  - next week's conditions.

  It reads what played well (section 7) and what the city did that week.
- **AI later:** a live writer can fill a template's text at runtime. It plugs in behind the same validators and the same
  veto rules, and stays off until the owner switches it on.

## 7. Learning what works

- **Logging:** every storylet shown, chosen, skipped and finished is logged (Moral Choices' `choice_log`, extended).
- **Weekly report:** the routine gets the top and bottom storylets.
  - Weights move (a multiplier per storylet, also editable in the Studio).
  - Templates that keep getting skipped are retired.
- **Players as content:** other players' wins and scandals reach the News and the Blotter, never for News opt-outs.

## 8. Going live: automatic with a veto window

- **The window:** new content files land in the database as **scheduled** and go live after a review window (default 24
  hours, a game setting) unless vetoed.
  - The Studio's new **Storylets** tab lists what's coming: the text with sample fills, its conditions and effects.
  - Veto and Pause buttons.
  - This mirrors autopilot (migration 0107) and its on/off switch in Studio → Calendar.
- **What's approved:** the template is approved; the game's slot fills are not reviewed one by one. That's why templates
  are validated with every slot's worst case.
- **Hand-made content keeps its approval:** main stories, landmark events and seasonal moments still go through Studio
  approval, as today.

## 9. Build order (one PR each)

| Step | What ships | Visible to players |
| --- | --- | --- |
| 1 ✅ | **Player memory** (built, migration 0138; keys in lib/memory.ts): `player_facts`, `fact_note`, `player_snapshot`, writers in careers, campaigns, choices, dating, businesses, campus and bans; tallies | Nothing yet (the foundation) |
| 2 ✅ | **Storylets** (built: lib/storylets.ts, content/choices/storylets.json, `?choice=story`): the engine (choice cards plus conditions, slots, `sets`); the 76 cards and the 36 Climb cards moved over; about 20 cross-system storylets | Cards that remember what you did elsewhere |
| 3 ✅ | **Templates and the weekly generator** (built: migration 0139, lib/storyletWeeks.ts, content/storylets/, Studio → Storylets): slot filling, worst-case validation, the Studio Storylets tab with the veto window, the routine drafting templates | A steady stream of new situations |
| 4 ✅ | **The city reacts** (built: migration 0140, lib/cityConditions.ts, content/conditions/, content/city/reactions.json): conditions (weather, outages, festivals), city storylets on tallies, players in each other's News | A city that changes because of players |
| 5 ✅ | **One character registry** (built: lib/characters.ts, lib/characterMemory.ts, content/characters/remembers.json): the cast, profiles, career people, campaign people and Barksley in one list with roles, places and memory keyed off facts | People who remember you |
| 6 | **Learning:** weights from what's chosen and skipped; retiring what's skipped | Content that gets better |
| 7 | **One card format:** campaign situations and career tasks on storylets | Consistency |

## 10. Rules (every storylet follows them)

- Content is data. Conditions use shared memory only, never another system's internal state.
- Invented people and businesses only (`parody-names.json`). Satire attitudes, never identities. Police stay comic.
- **Protected systems:** onboarding, borough unlocks, purchases, bills and rent are never touched.
- **No lockouts:** bans of 7 days at most, holding of 3 hours at most, no permanent losses; there's always a way back.
- Effects stay inside the Moral Choices caps (C$3,000, 300 clout a result). Real money never buys a way out.
- Every change says why (a receipt, a line, a headline).

**Settled (owner, Oct 31):**
- Campaign Mode's risk labels are removed: no risk labels anywhere.
- The veto window is 24 hours for generated content (storylets, city storylets, conditions).
- **Stories and hunts run on a weekly beat** (owner, Oct 31): their veto window is Friday, and they go live on Saturday.
- **News and gossip keep the 24-hour veto** (owner, Oct 31) and their Monday weeks (migration 0137 moved hunts and the story
  autopilot to Saturdays).

**Step 3 as built (Oct 31):**
- The weekly routine writes `content/storylets/<Monday>.json`: 6 to 14 storylets (about 10) in at least four families
  (favor, temptation, betrayal, windfall, loyalty), each with `when` over memory. `validateStoryletWeek` checks them
  against every card in the game and every earlier week (ids never repeat; slots checked with the longest names).
- The game stores new cards (`content_import_storylets`, run by `syncWeeklyContent`) as scheduled, live 24 hours later
  (game_settings 'storylets' {window_hours}); the 'storylets' autopilot switch holds them as paused instead.
- Studio → Storylets lists every card with sample names, who gets it (`whenLines`), every option, outcome, chance and
  what comes back, with Veto, Pause, Restore and Go live now. A card that went live keeps a final veto but stays readable
  so open cards and players' histories still find it (`storylets_live` → `offer`).
- The server (app/home/choiceActions.ts) adds live weekly cards to the pool every 5 minutes.
- Not yet: amounts scaled to the player's income (`{amount}`), city-wide slots (`{a_club_tonight}`), learning (step 6).

**Step 4 as built (Oct 31):**
- **City conditions** (`city_conditions`): a heatwave, cold snap, rainstorm, brownout, transit meltdown, festival, sample
  sale, or a reaction (HR crackdown, doors tighten, lotto fever, ethics probe, full precinct, party surge, showtime
  season). Their effects join `world_effects()` (arc `condition:<id>`), so prices, closures and place notes work
  everywhere the World State already reaches, with no new code in those systems. Only `price_multiplier` (×0.5 to
  ×1.5), `availability` (a closure at most 12 hours) and `place_state` notes; never chatter, tasks, flags or spawned
  events; never homes, campuses, civic places or transit (`CONDITIONS.protectedTags`).
- **Weekly conditions**: the routine writes `content/conditions/<Monday>.json` (1 to 4, each 2 to 72 hours inside its
  week). They arrive like storylets: live 24 hours later unless vetoed in Studio → Storylets → City conditions.
- **City storylets** (`content/city/reactions.json`, 8 rules): when the city's tally for a fact (world_tally) over the
  last N days reaches a line (at least 3: a crowd, never one player), the condition fires at once from its approved
  template, with a cooldown, and Lola posts a headline in the Blotter. `city_react` runs with the weekly sync.
  An HR crackdown at an employer doubles the chance office sabotage there is traced (`office(..., { crackdown })`).
- **Storylets read conditions**: `snap: "conditions", is: "<kind>"` (the server adds the kinds in force to the snapshot).
  The first week has two (a heatwave price-gouging dilemma for business owners, a brownout date night).
- **Players in each other's News**: a player's first campaign win, business taken public or scholarship posts a 🏆 line
  in Lola's Blotter (`player_facts` trigger), never for News opt-outs. News → City's "Around the city" card lists what's
  on now and in the next 48 hours.
- Not yet: weather on the map itself, regulars' lines per condition, players' scandals beyond the Blotter.

**Step 5 as built (Oct 31):**
- `lib/characters.ts` `CHARACTERS`: every invented person in one list with a kind and a place: the regulars, the Mayor,
  the celebrity cast and the wannabes, each career's boss, work friend and rival, and Sir Barksley.
- `content/characters/remembers.json` (45 lines, 23 characters, checked by `validateRemembers`): what a character says
  only to players whose memory fits, with storylet conditions and slots (Sal heard {place} bounced you; Mags knows you
  just went official; Sgt. Bev started you a punch card; Bernie printed 4,000 stickers with the winning manager's face;
  Captain Rosa warns you about the heatwave). The most specific (two-system) lines first, up to 3 per character.
- `characterRemembered()` (app/home/characterActions.ts) fills them on the server from `player_memory` (shared with
  storylets: lib/memoryServer.ts) and sends only the lines; tapping a regular plays one every 3 taps (`rememberedTap`).
- Remembered lines are hand-written in pull requests (no veto window), not drafted by the weekly routine.
- Not yet: coworkers' lines in the Careers People card, the Mayor's app remembering you, celebrities who react.
