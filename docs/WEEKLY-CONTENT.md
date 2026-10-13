# Weekly content: the drafting routine

Every week needs a treasure hunt and a week of City News (docs/08-new-features-spec.md sections 1
and 3). Claude doesn't run on its own inside the game: a **scheduled Claude Code session** (a
Routine) drafts the next week and opens a pull request. You approve everything in the Studio.

## The weekly loop

| When (New York) | Who | What |
| --- | --- | --- |
| Thursday morning | The Routine | Drafts `content/hunts/<Monday>.json` and `content/news/<Monday>.json` for the coming Monday's week, runs the checks, opens a pull request "Content: week of …" |
| Thursday to Saturday | You | Read the pull request (its description lists the theme, the eight treasures and every headline). Ask for changes in a comment or edit the files, then merge |
| After the deploy | You | Studio → **Calendar**: press **Load** on the week's hunt and news. Then **Hunts**: skim the eight tracks, read one in full, Approve (or Send back with a note). **News**: Approve all |
| Monday 00:00 | The game | The hunt starts and the news publishes day by day |

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

1. Find the week: the Monday after today, New York time (YYYY-MM-DD). If content/hunts/<Monday>.json
   and content/news/<Monday>.json both exist on main already, stop and say so.
2. Read first: CLAUDE.md, docs/HUNTS.md, docs/CAST.md, docs/08-new-features-spec.md (sections 1, 3
   and 4), lib/city.ts (places and what each costs), lib/cast.ts (the regulars and where they stand),
   and the last three weeks in content/hunts/ and content/news/ so nothing repeats.
3. Write content/hunts/<Monday>.json: a hunt players will talk about.
   - Make it an event, not an errand: real stakes (a rival crew racing you, a celebrity's stolen
     prize, a mystery with a deadline), a cast member or two caught up in it, and a finale that
     pays off the whole trail.
   - 4 or 5 places, each with a regular, at least one free or C$10 or less, and a different route
     from last week's. No place from a story running that week (content/stories/).
   - One track per starting style (8), each with its own invented treasure, lore and lines in that
     regular's voice. Questions must be answerable from the game alone, with exactly one right
     answer; move the right answer around; the finale should test something from the trail.
4. Write content/news/<Monday>.json: 9 to 12 items across Monday to Sunday, including
   - a Monday "hunt" item announcing the hunt (it must name the first place's regular),
   - exactly one Lola column ("column"),
   - city news about the invented cast only (lib/cast.ts ids in "cast"): light, satirical, no real
     people, brands, politics, tragedies or crime, nothing that changes prices or places.
5. Run npm ci (if needed), npm run validate:content and npm test. Fix anything they report.
6. Commit only those two files on a new branch content/week-<Monday>, push it, and open a pull
   request titled "Content: week of <Monday>". In its description list: the hunt's theme and pitch
   in two sentences, the route (place and regular per step), the eight treasures, and every news
   headline by day. End with: "Merge, then load both files in the Studio Calendar and approve them
   by Sunday." Don't change any code, and don't merge.
```
