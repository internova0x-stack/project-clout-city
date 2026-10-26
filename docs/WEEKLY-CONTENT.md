# Weekly content: the drafting routine

Every week needs a treasure hunt, a week of City News, a week of neighborhood gossip and, since v0.15, the
campus exam questions (docs/08-new-features-spec.md sections 1, 3, 8 and 18). Claude doesn't run on its own inside the game: a
**scheduled Claude Code session** (a Routine) drafts the next week and opens a pull request. You
approve the hunt and news in the Studio. **Gossip is automatic** (owner, Oct 13): once its file is
merged it goes live on its Monday by itself; the Studio's **Gossip** tab shows it in full, and you
can Pause it or Hold it with a note.

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
| Thursday morning | The Routine | Drafts `content/hunts/<Monday>.json`, `content/news/<Monday>.json` and `content/gossip/<Monday>.json` for the coming Monday's week, runs the checks, opens a pull request "Content: week of …" |
| Thursday | The Routine | Merges its own pull request once its checks pass (autopilot) |
| Any time | You (optional) | Read the merged pull request; pause a kind in Studio → Calendar to approve it yourself next time |
| After the deploy | You | Studio → **Calendar**: press **Load** on the week's hunt and news. Then **Hunts**: skim the eight tracks, read one in full, Approve (or Send back with a note). **News**: Approve all |
| After the deploy | The game | Stores the gossip week by itself (within 10 minutes of the next visit). Nothing to approve: read it in the Studio's **Gossip** tab if you like, and Pause or Hold it if something's off |
| After the deploy | The game | Stores the exam week by itself (migration 0077, `lib/contentImport.ts`). A course's questions can be changed until the first student sits that exam; after that the week's set is locked. Without a week file, exams use the standing question bank |
| Monday 00:00 | The game | The hunt starts, the news publishes day by day, and the week's gossip stories become findable for 14 days |

If a week is missing on Friday, the Calendar shows "⚠️ No hunt yet" for this week and next.
Nothing breaks without a hunt: the Hunt tab says a new one starts Monday.

## Running it by hand

Ask Claude Code: "Draft next week's content per docs/WEEKLY-CONTENT.md." It follows the same steps
as the Routine below. `npm run validate:content` checks every week file with the Studio's rules.

## The Routine's instructions

This is the prompt the Routine runs each Thursday (kept here so it can be read and changed):

```
Draft next week's Clout City content (repository internova0x-stack/project-clout-city; clone it if
it isn't in your working directory). Work from the main branch.

1. Find the week: the Monday after today, New York time (YYYY-MM-DD). If content/hunts/<Monday>.json,
   content/news/<Monday>.json, content/gossip/<Monday>.json and content/exams/<Monday>.json all exist on
   main already, stop and say so (write only the missing ones otherwise).
2. Read first: CLAUDE.md, docs/HUNTS.md, docs/CAST.md, docs/08-new-features-spec.md (sections 1, 3,
   4 and 8), lib/city.ts (places and what each costs), lib/cast.ts (the regulars and where they
   stand), lib/gossip.ts (the gossip rules), and the last three weeks in content/hunts/,
   content/news/ and content/gossip/ so nothing repeats. Also read docs/culture/VOICE.md (the voice rules)
   and content/culture/ (slang.json, parody-names.json, npcs.json): write each regular from their profile
   (personality, likes, dislikes, the slang they use), give Lola at most one slang term per message (mostly TMZ, a little Shade Room: docs/culture/VOICE.md), and use
   the invented names from parody-names.json for any team, transit card, museum, landmark or brand.
3. Write content/hunts/<Monday>.json: a hunt players will talk about.
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
   - a Monday "hunt" item announcing the hunt (it must name the first place's regular),
   - exactly one Lola column ("column"), answering an NYC dating complaint (culture pack C6, owner Oct 21): the
     New York kind ("he lives in Staten Island and won't take the ferry", "she stands on the subway stairs to text",
     "he calls every cab a Hailr"), never about anyone's background; Lola rules on it in her voice,
   - city news about the invented cast only (lib/cast.ts ids in "cast"): light, satirical, no real
     people, brands, politics, tragedies or crime, nothing that changes prices or places.
   - at least one city item starring Mayor Papa-Dani ("mayor-papa-dani" in "cast"; owner Oct 22, the validator
     requires it): a ribbon cutting, a fix, a civic event, in his voice from docs/CAST.md. When the team has marked
     Mayor's Inbox letters done that week, he can announce what really got fixed ("You wrote, we fixed it");
     never politics, and never a fix that didn't ship.
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
7. Run npm ci (if needed), npm run validate:content and npm test. Fix anything they report (validate:content
   also fails on any real brand, team or trademarked name).
8. Commit only those four files on a new branch content/week-<Monday>, push it, and open a pull
   request titled "Content: week of <Monday>". In its description list: the hunt's theme and pitch
   in two sentences, the route (place and regular per step), the eight treasures, every news
   headline by day, each gossip story's title and Tea headline, and one sample exam question per course. End with: "Autopilot:
   merged by the routine; it goes live by itself unless it's paused in Studio → Calendar."
9. Autopilot (owner, Oct 22): once validate:content and npm test pass, merge the pull request yourself (a merge commit).
   If a check fails and you can't fix it, leave the pull request open and say why in its description.
   Don't change any code.
```

## Boroughs (migration 0066)
Boroughs open in order (Brooklyn, The Bronx, Staten Island, Manhattan last) the moment 100, 250, 500 and 1,000 players are out at once (or a Studio admin opens one).
Until it opens, write every hunt step, gossip piece and news lead at a **Queens** place: the server skips
leads in a locked borough and nobody can travel there, so a Brooklyn piece would be a dead end.
