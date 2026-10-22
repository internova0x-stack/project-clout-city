# Running stories

Stories are data, not code. Each one is a JSON file in `content/stories/` (one main story, plus
any side stories that point at it with `parent_arc_id`). The rules that turn a story into changes
in the city live in the database (`supabase/migrations/0007_world_state.sql`); the World State
Layer Brief (`docs/03`) is the spec.

You manage stories in the **Story Studio** at `/studio`: a separate page on the same site, outside
the game. Only accounts listed in `story_admins` can open it.

## Who can use the Studio

An owner adds an admin once, in the Supabase SQL editor (the person signs up in the game first):

```sql
insert into story_admins (user_id) select id from auth.users where email = 'writer@example.com';
```

Remove one with `delete from story_admins where user_id = (select id from auth.users where email = '…');`

## The life of a story

1. **Write it.** Copy `content/stories/sarah-bird.json` as a template. Each beat has a story day,
   the News text, optional evidence, a prediction (question, options, when voting closes, which
   beat reveals it, the right answer) and effects on the city (prices, closures, chatter, story
   tasks, events). Side stories are `"type": "side"`, `"tier": "premium"` with a `sku`.
   **Blog posts (owner, Oct 22; migration 0115):** a beat's news may carry `post`, the full blog post (300+ words,
   paragraphs split by a blank line). The feed card then shows the headline and `body` as a short teaser (400 characters at
   most) with **Read the full post ›**, which opens the post with its hook at the end. Write posts in Lola's gossip-blog
   voice ("Roommates…") with a few terms from `content/culture/slang.json`. Older stories without posts show as before. Opening a post pays 10 clout once per post (migration 0117,
   `read_post`, ledger 'story_read'; the button shows "+10 🔥" until it's read).
   **Characters (owner, Oct 22):** a story may list `characters` (id, name, role, a 20 to 280 character bio, style and an
   avatar look) and each beat's news its `cast` (ids; a side story may use its parent's). The post ends with their avatar
   heads under Share (at most 5, in the order of the story's `characters` list, so write that list most important first; a
   post's `cast` has 5 ids at most); tapping one shows the bio. They're attached on the server from the repo file, so a story already in
   the Studio picks them up without a re-upload. **A bio is the character's public persona only and never hints at a
   twist** (owner): it shows on every day's post, Day 1 included. Write it as a plain, factual bio tied to the story (who they are, how they enter it), not in Lola's slangy voice.
2. **Check it.** `npm run validate:stories` runs every rule: ids and beat days in order, places,
   tags, items and tasks that exist, price caps and expiries, reason text on every change, and
   prediction windows that close before their reveal. The Studio runs the same checks when you upload, and saves nothing if one fails.
   **Or just merge it** (culture pack C6, migration 0098): a story file in `content/stories/` that the Studio doesn't
   have yet loads by itself, waiting in **Needs review** (when the Studio's story list opens, or within 10 minutes of the
   next game visit). It never changes a story the Studio already has; edits still go through the upload below.
3. **Upload it.** In the Studio, **Add or update a story** → choose the file (or paste the JSON) →
   **Check and save**. New stories, and any story whose file changed, go to **Needs review**.
   A story that is live can't be replaced mid-run; pause or retire it instead.
4. **Approve or decline it.** One approval is enough. Approving a main story approves its side stories waiting for
   review too, so they go out together (owner, Oct 22). Declining needs a note for the writers; it
   stays with the story. Approving again later, or sending it back to review, is always possible
   until it goes live; sending it back clears its Day 1. A live story can't go back to review or be
   declined (pause or retire it instead).
5. **Schedule it.** Pick Day 1 (a Sunday unless the file's `start_weekday` says otherwise, never in
   the past). The Studio shows the finale date, and refuses a week whose finale lands on the same
   day as another story's. Side stories run alongside their main story automatically. Beats go out
   at midnight New York time; votes close at the times in the file.
   **Approving alone never puts a story live**: a main story needs a Day 1. Each story shows one status
   (migration 0080): **Needs review**, **Declined**, **Not live** (approved, no Day 1), **Scheduled**,
   **● Live**, **Paused**, **Finished** or **Retired**.
   **Go live now** (main stories) does both steps in one press: it approves the story and makes today
   (New York) Day 1, on any weekday, after a confirm. Players see Day 1 on their next refresh; Day 2 goes
   out at midnight. Its side stories waiting for review go live with it (migration 0081); a declined one stays
   off. If you went live before 0081, approve each side story and it joins at once.
   **The list (owner, Oct 22):** each main story is one card with its side stories inside it, under **Live now**, **Up
   next**, **Paused** and **Finished and retired**. Opening the Studio first loads any new story file from the repo; a file
   that can't load says why at the top.
6. **Run it.** **Pause** / **Resume** and a separate **Retire** (which asks first). While it's live you can:
   - **Pause** the whole story: players stop seeing it and every effect on the city lifts until you
     resume. The calendar keeps counting, so it resumes on the day it would have been.
   - **Retire** it: it ends for good.
   - Pause or retire a **single beat** from the Beats list (for example to pull one headline).
   - Reorder stories with the arrows: main stories move among main stories, side stories within their
     main story (the order is the Studio's list only).
7. **Preview it** at any time with **Preview as a player**: pick a day, noon or 11 PM, free player or
   side-story owner, and see the News app exactly as players will, next to a list of everything the
   story changes in the city that day. Answers stay hidden until their reveal, as in the game.

After the finale a story moves to the News app's Archive the next day, where players who missed it
can read it through and make "shadow guesses" for a badge.

## Testing a story before it's real

On a staging project with time travel switched on (`docs/SETUP.md`, step 10), the "⏩" pill in the
game can start Sarah Bird on any day for everyone on that project and unlock the side stories for
your account. In development, `/preview/home?story=3` opens the game on Day 3 with nothing saved,
and `/preview/studio` opens the Studio on an in-memory copy of `content/stories/`.

The pilot isn't scheduled yet: per `docs/07`, Sarah Bird's start date is set at v1.0.

## Reports and metrics (v0.5)

The Studio has two more tabs for the same admins:

- **Reports:** chat reports, open ones first, newest first. Each shows who reported whom, the
  reason and note, and the conversation with the reported message highlighted. **Dismiss**,
  **Warn**, **Mute from chat** (7 days by default) or **Ban** (the account can't play).
- **Metrics:** the success metrics: day-1 return against the 35 to 40% goal, first task done,
  invites sent, story readers and predictions, purchases by product (test mode) and chat activity.

## The cast's lines (Cast tab)

Regulars at places (Sal at the deli, Jojo at the café and the rest; see `docs/CAST.md`) say their everyday lines from `content/cast-lines.json`. In the Studio's **Cast** tab you add more, with no deploy:

1. Pick the regular, choose **Line** or **Personal update**, and optionally a week (a Monday). Lines with a week show only that week, New York time; lines without one show every week.
2. **Send for review**, then **Approve** to put it live. **Pause** takes it down at once; **Back to review** parks it.
3. Approved updates are said first. While a story runs, every other line comes from the story's chatter instead.

## City News (News tab)

City News is light gossip about the cast, Lola's weekly dating column and the Monday hunt announcement. It sits in the phone's News app under the **City** tab, next to the story, and the day's top headline runs in the HUD ticker. A week is one file, `content/news/<Monday>.json` (see `content/news/2026-10-12.json`).

1. In the Studio's **News** tab, choose the file or paste it, then **Check and save**. It's checked first: the week starts on a Monday, every cast id is known, there's exactly one Lola column, and hunt items fall on Mondays.
2. Items wait in review. **Approve** them one by one or **Approve all**. Each publishes on its day, New York time, and stays in the feed for 60 days.
3. **Pause** takes an item down at once; **Back to review** parks it; **Move to** changes its day.
4. Re-uploading a file keeps unchanged approved items approved; edited items go back to review.

News never changes prices, places or rewards.

## Treasure hunts (Hunts tab)

Weekly hunts are uploaded, skimmed, read in full and approved in the **Hunts** tab. The whole
how-to, including the week file format, is in `docs/HUNTS.md`.

## The Calendar tab

Week by week: the stories running, the hunt and the news for each day (green: approved, yellow:
waiting). Week files merged into `content/` show a **Load** button; loading uploads them, and they
still wait for approval. The weekly loop is in `docs/WEEKLY-CONTENT.md`.
