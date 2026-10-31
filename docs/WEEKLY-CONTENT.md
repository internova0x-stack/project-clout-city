# Weekly content: the drafting routine

Every week needs a treasure hunt, a week of City News, a week of neighborhood gossip and, since v0.15, the
campus exam questions (docs/08-new-features-spec.md sections 1, 3, 8 and 18). Claude doesn't run on its own inside the game: a
**scheduled Claude Code session** (a Routine) drafts the next week and opens a pull request. You
approve the hunt and news in the Studio. **Gossip is automatic** (owner, Oct 13): once its file is
merged it goes live on its Monday by itself; the Studio's **Gossip** tab shows it in full, and you
can Pause it or Hold it with a note.

> **Saturdays (owner, Oct 31; migration 0137):** hunts and new stories start on **Saturdays**, and **Friday** is your
> window to veto them in Studio → Calendar (pause the hunt; decline or move the story). Hunts run Saturday to Friday, in
> `content/hunts/<Saturday>.json`. News and gossip keep their Monday weeks and a 24-hour window. A hunt is announced in
> that Monday week's news on its Saturday.

> **Storylets (owner, Oct 31; migration 0139, docs/CONTENT-ENGINE.md step 3):** the routine also drafts about ten
> situation cards a week that react to what each player has done (`content/storylets/<Monday>.json`). Each card goes
> live **24 hours after it arrives** unless you **Veto** or **Pause** it in Studio → **Storylets**, which shows every
> card with sample names, who gets it, and every choice and outcome.

> **Autopilot (owner, Oct 22; migration 0107, lib/autopilot.ts):** the routine merges its own pull request once its
> checks pass, and everything goes live by itself: news, hunts and Tea from their files, and stories one after another
> (when a story ends, the next one in the Studio's Stories order is approved and starts that day). Studio → **Calendar**
> has a switch for each; a paused kind waits for you (news and hunts: Load and Approve below; Tea: approve the week in
> Gossip; stories: approve and pick a Day 1).

> **Test phase (owner, Oct 14): news and hunts are automatic too.** No approval this round: once a
> news or hunt week file is merged, the game stores it approved by itself (within 10 minutes of the
> next visit, or at once when you open the Studio's News or Hunts tab; migration 0037,
> `lib/contentImport.ts`). Everything still shows in the Studio, where you can Pause an item or a
> hunt (a pause holds even when the file is stored again). The Load and Approve steps below are
> only needed after the test phase.

## The weekly loop

| When (New York) | Who | What |
| --- | --- | --- |
| Thursday morning | The Routine | Drafts `content/hunts/<Saturday>.json` for the hunt starting in two days (and adds its Saturday announcement to this week's news), and `content/news/<Monday>.json` and `content/gossip/<Monday>.json` for the coming Monday's week, runs the checks, opens a pull request "Content: week of …" |
| Thursday | The Routine | Merges its own pull request once its checks pass (autopilot) |
| Any time | You (optional) | Read the merged pull request; pause a kind in Studio → Calendar to approve it yourself next time |
| After the deploy | You | Studio → **Calendar**: press **Load** on the week's hunt and news. Then **Hunts**: skim the eight tracks, read one in full, Approve (or Send back with a note). **News**: Approve all |
| After the deploy | The game | Stores the gossip week by itself (within 10 minutes of the next visit). Nothing to approve: read it in the Studio's **Gossip** tab if you like, and Pause or Hold it if something's off |
| After the deploy | The game | Stores the week's storylets by itself (migration 0139): each card goes live 24 hours later |
| Within 24 hours | You (optional) | Studio → **Storylets**: read the new cards; Veto one and it never shows, Pause it to decide later |
| After the deploy | The game | Stores the exam week by itself (migration 0077, `lib/contentImport.ts`). A course's questions can be changed until the first student sits that exam; after that the week's set is locked. Without a week file, exams use the standing question bank |
| Friday | You (optional) | The veto window: Studio → Calendar shows the hunt and the story that start on Saturday. Pause the hunt, or decline or move the story, to stop them |
| Saturday 00:00 | The game | The hunt starts (it runs to Friday), and a new main story starts if none is running (Day 1 is the Saturday) |
| Monday 00:00 | The game | The news publishes day by day, and the week's gossip stories become findable for 14 days |

If a week is missing on Friday, the Calendar shows "⚠️ No hunt yet" for this week and next.
Nothing breaks without a hunt: the Hunt tab says a new one starts Saturday.

## Running it by hand

Ask Claude Code: "Draft next week's content per docs/WEEKLY-CONTENT.md." It follows the same steps
as the Routine below. `npm run validate:content` checks every week file with the Studio's rules.

## The Routine's instructions

This is the prompt the Routine runs each Thursday (kept here so it can be read and changed):

```
Draft next week's Clout City content (repository internova0x-stack/project-clout-city; clone it if
it isn't in your working directory). Work from the main branch.

1. Find the week: the Monday after today, New York time (YYYY-MM-DD), and the hunt's Saturday: the
   Saturday after today (owner, Oct 31: hunts run Saturday to Friday). If content/hunts/<Saturday>.json,
   content/news/<Monday>.json, content/gossip/<Monday>.json, content/exams/<Monday>.json and
   content/storylets/<Monday>.json and content/conditions/<Monday>.json all exist on main already, stop and say so (write only the missing ones otherwise).
2. Read first: CLAUDE.md, docs/HUNTS.md, docs/CAST.md, docs/08-new-features-spec.md (sections 1, 3,
   4 and 8), lib/city.ts (places and what each costs), lib/cast.ts (the regulars and where they
   stand), lib/gossip.ts (the gossip rules), and the last three weeks in content/hunts/,
   content/news/ and content/gossip/ so nothing repeats. Also read docs/culture/VOICE.md (the voice rules)
   and content/culture/ (slang.json, parody-names.json, npcs.json): write each regular from their profile
   (personality, likes, dislikes, the slang they use), give Lola at most one slang term per message (mostly TMZ, a little Shade Room: docs/culture/VOICE.md), and use
   the invented names from parody-names.json for any team, transit card, museum, landmark or brand.
3. Write content/hunts/<Saturday>.json ("week" is that Saturday): a hunt players will talk about.
   - Make it an event, not an errand: real stakes (a rival crew racing you, a celebrity's stolen
     prize, a mystery with a deadline), a cast member or two caught up in it, and a finale that
     pays off the whole trail.
   - 4 or 5 places, each with a regular, at least one free or C$10 or less, and a different route
     from last week's. No place from a story running that week (content/stories/).
   - One track per starting style (8), each with its own invented treasure, lore and lines in that
     regular's voice. Questions must be answerable from the game alone, with exactly one right
     answer; move the right answer around; the finale should test something from the trail.
   Lola's lines (news, "Ask Lola", Tea cards) and DJ Sharm Almight's are written in their voices from
   docs/CAST.md "Voices": Lola the spicy tea queen, Sharm New York hype with younger slang.
4. Write content/news/<Monday>.json: 9 to 12 news items across Monday to Sunday (plus the transit updates below), including
   - no "hunt" item: the hunt is announced in the week it starts. Add a Saturday "hunt" item for the hunt from step 3
     (it starts this Saturday) to this week's news file, content/news/<the Monday before today>.json (it must name the
     first place's regular),
   - exactly one Lola column ("column"), answering an NYC dating complaint (culture pack C6, owner Oct 21): the
     New York kind ("he lives in Staten Island and won't take the ferry", "she stands on the subway stairs to text",
     "he calls every cab a Hailr"), never about anyone's background; Lola rules on it in her voice,
   - city news about the invented cast only (lib/cast.ts ids in "cast"): light, satirical, no real
     people, brands, politics, tragedies or crime, nothing that changes prices or places.
   - at least one city item starring Mayor Papa-Dani ("mayor-papa-dani" in "cast"; owner Oct 22, the validator
     requires it): a ribbon cutting, a fix, a civic event, in his voice from docs/CAST.md. When the team has marked
     Mayor's Inbox letters done that week, he can announce what really got fixed ("You wrote, we fixed it");
     never politics, and never a fix that didn't ship.
   - one election item a week once migration 0127 has run (Campaign Mode, owner Oct 29): Lola's gossip about the race or
     Papa-Dani on his record, with the four invented challengers from docs/CAST.md. Satire of campaigning, never real
     politics or parties, and never about a player's own campaign.
   - 3 to 5 Metro Rail Authority updates ("transit", culture pack C4): delays, reroutes, weekend service changes
     and fare news for the lines players ride (N/W in Astoria and Long Island City, the 7 to Flushing, Jackson
     Heights and Sunnyside, the E to Jamaica). Each has "line", "from" (New York time, "HH:MM") and "hours" (1 to 6,
     ending by midnight); two or three are delays with "delay" (10 to 30 seconds), which really slow that line's
     subway trips while they run. Spread them over the week and the day (a morning rush, an evening, a weekend).
     Fare news is satire only: fares never change. Name the agency "the Metro Rail Authority" (never a real one).
5. Write content/gossip/<Monday>.json: 3 to 5 gossip stories (one about the celebrity cast, one about
   Astoria's regulars, one about invented City Hall business is a good mix), each exactly five
   pieces at five different places that build to a reveal, plus Lola's write-up ("tea"). Use
   "regular" only where lib/cast.ts has one; give a few pieces a city-clock window ("hours") so
   timing matters. Only invented people; never real players, people, brands or politics; no story
   places and nothing about a running story. New story ids every week. Pieces are a trail in order
   (v0.11): finding piece 1 names piece 2's place, and so on, so order them as a walk around the
   neighborhood, start each story somewhere easy to find (ideally a regular), and let a piece's
   text nod at the next person ("Ask Benny, he'll deny it").
   Restroom pieces (#19 clubs): give one or two stories a "source": "restroom" piece at a club or
   Low Light Lounge (any place with a restroom floor), the juiciest line in the story; it's only
   heard downstairs and pays extra clout. Never put a piece at Ultraviolet Society (its door needs
   2,000 clout).
6. Write content/exams/<Monday>.json (v0.15 campus life, lib/exams.ts): five multiple-choice questions for
   every course in lib/campus.ts COURSES, each a satirical joke about that course's subject (campus life,
   napping, the subway, group projects, money, clout), answerable by common sense, with exactly one right
   answer, 2 to 5 short choices, and the right answer moved around (not always the second choice). No real
   people, schools, brands or politics; nothing mean about any group. Don't reuse last week's prompts.
6b. Write content/storylets/<Monday>.json (Content Engine step 3, lib/storyletWeeks.ts, docs/CONTENT-ENGINE.md):
   {"week": "<Monday>", "cards": [...]}, 8 to 12 Moral Choices cards in the format of content/choices/storylets.json,
   each with a "family" (favor, temptation, betrayal, windfall, loyalty; use at least four, ideally all five) and a
   "when" over player memory (lib/memory.ts FACTS for "has", lib/storylets.ts SNAP_PATHS for "snap"). Favor
   combinations of two systems (a job and a relationship, a ban and the crew, a campaign and an exam): those are the
   cards nobody writes by hand, and the game shows them first. Use "slots" for names from memory (a coworker, a place,
   a boss, an employer; a slot's fact or snapshot must be in "when.all"). Every card is a real dilemma: memorable,
   real stakes in both directions, costs said plainly (never "Integrity", "Halo" or "Hustler"), no risk labels in the
   text, satire of New York ambition, only invented people and businesses. Never reuse an id from content/choices/ or
   an earlier week. Read the last three weeks of content/storylets/ so situations don't repeat.
6c. Write content/conditions/<Monday>.json (Content Engine step 4, lib/cityConditions.ts): {"week": "<Monday>",
   "conditions": [...]}, 1 to 4 city conditions inside that week, each 2 to 72 hours (startsAt and endsAt with the New York
   offset): weather that fits the real season (a heatwave, cold snap, rainstorm), an outage (a brownout, a transit
   meltdown), a festival or a sample sale. Each has an id, kind, emoji, title (≤ 60), blurb (≤ 200, satire) and 1 to 4
   effects: price_multiplier (×0.5 to ×1.5 on place tags, with the reason players see), availability (closed at most 12
   hours, or restricted with an allow list) or place_state notes at real places. Never homes, campuses, civic places or
   transit. Optionally add a storylet that reacts to one ("snap": "conditions", "is": "<kind>").
7. Run npm ci (if needed), npm run validate:content and npm test. Fix anything they report (validate:content
   also fails on any real brand, team or trademarked name).
8. Commit only those files on a new branch content/week-<Monday>, push it, and open a pull
   request titled "Content: week of <Monday>". In its description list: the hunt's theme and pitch
   in two sentences, the route (place and regular per step), the eight treasures, every news
   headline by day, each gossip story's title and Tea headline, one sample exam question per course, and each
   storylet's family and title, and each city condition with its days. End with: "Autopilot:
   merged by the routine; it goes live by itself unless it's paused in Studio → Calendar (storylets: 24 hours
   after they arrive, unless vetoed in Studio → Storylets)."
9. Autopilot (owner, Oct 22): once validate:content and npm test pass, merge the pull request yourself (a merge commit).
   If a check fails and you can't fix it, leave the pull request open and say why in its description.
   Don't change any code.
```

## Boroughs (migration 0066)
Boroughs open in order (Brooklyn, The Bronx, Staten Island, Manhattan last) the moment 100, 250, 500 and 1,000 players are out at once (or a Studio admin opens one).
Until it opens, write every hunt step, gossip piece and news lead at a **Queens** place: the server skips
leads in a locked borough and nobody can travel there, so a Brooklyn piece would be a dead end.
