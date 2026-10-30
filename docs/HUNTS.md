# Treasure hunts

A weekly, opt-in hunt (docs/08-new-features-spec.md section 1). One week file holds the theme,
4 or 5 places in order and one track per starting style; every track uses the same places, so the
week feels shared. The engine is `lib/hunts.ts` (rules, checks, preview) and migration 0018 (the
database version players use).

## How a hunt plays

1. **Join.** Tasks → **Hunt** → *Join the hunt*. The player's starting style picks the track.
   Nothing about a hunt shows for players who haven't joined.
2. **Steps.** Each step is the regular at a place (`lib/cast.ts`). The player goes there, does
   anything there at its normal cost (a visit counts once per day), then taps the regular. Their
   line is the clue to the next place; only step 1's place is named outright.
3. **Questions.** Some steps ask a multiple-choice question in the regular's bubble. A wrong answer
   waits 10 minutes. Clues are always free; nothing can be bought to skip or shorten anything.
4. **Finale.** The last step's right answer pays C$1,080 and 250 clout once (`CITY_ECONOMY.hunt`,
   ledger kind `hunt`), keeps a **hunt card** (Collection and the Hunt tab; free, no net-worth
   value, can't be sold), and four hunts earn the 🏅 Treasure Hunter badge.
5. **World.** Regulars mention the player's treasure in their everyday lines while they hunt.
6. **Schedule.** Monday 00:00 to Sunday 23:59, New York time. Unfinished hunts simply end.

## Writing a week

Add `content/hunts/<Monday>.json` (see `2026-10-19.json`):

- `week` (a Monday), `id` (slug), `theme`, `intro` (shown before joining; name the first place).
- `places`: 4 or 5 place ids, each with a regular. At least one costs C$10 or less.
- `chatter`: 1 to 6 lines regulars say to joined players; `{treasure}` becomes the treasure.
- `tracks`: one per starting style, each `{ treasure, emoji, lore, steps }` with one step per place.
  The tracks are keyed by the style ids, which kept their old names when the looks were renamed (owner, Oct 30):
  `startup_founder` Everyday Casual, `pilates_princess` Gym Regular, `bodega_drip` Bodega Streetwear, `midtown_finance`
  Midtown Corporate, `influencer_soft_glam` New Money, `thrift_store_icon` Thrift Store Regular, `arcade_nerd` Arcade Prep,
  `night_owl_goth` Night Owl Goth. Write each track for the look's name, not its id.
  A step is `{ say }`, or `{ say, question: { q, choices, answer }, then }` where `answer` is the
  index of the right choice (0 is the first) and `then` is said after it. The finale must ask.

Questions must be answerable from the game alone (place names, the regulars, Lola's lines, earlier
clues), with one right answer. Use invented names only.

`npm test` checks every file in `content/hunts/`. The Studio checks again on upload and also refuses
places touched by any story running that week.

## Approving (Story Studio → Hunts)

1. **By Sunday:** load it from the **Calendar** (once the file is merged) or choose or paste it here,
   then *Check and save*. It waits in review. The weekly drafting routine writes these files
   (`docs/WEEKLY-CONTENT.md`).
2. Skim the eight tracks (treasure and finale answer), then pick one to read in full, with the
   answers marked.
3. **Approve**, or **Send back** with a note for the writer. It goes live on its Monday. **Pause**
   hides it at once (players keep their progress); **Back to review** parks it. Re-uploading it
   unchanged keeps it approved; any edit sends it back to review.
4. **Replacing a week's hunt:** upload a different hunt for the same week and it replaces the old
   one, as long as nobody has joined it (migration 0019). Once players have joined, a hunt can't be
   changed or replaced; pause it, or put the new one in next week.
5. Each hunt shows joins, finds and how many players are still on each step, so next week can be
   easier or harder.

## Preview

`/preview/home?hunt=new|joined|question|wrong|finale|done` starts the hunt in that state (the
preview player is an Arcade Nerd). `/preview/studio` → Hunts shows the Studio tab. Both run on
the dev server in memory, so answers never reach the browser.
