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
2. **Check it.** `npm run validate:stories` runs every rule: ids and beat days in order, places,
   tags, items and tasks that exist, price caps and expiries, reason text on every change, and
   prediction windows that close before their reveal. The Studio runs the same checks when you upload, and saves nothing if one fails.
3. **Upload it.** In the Studio, **Add or update a story** → choose the file (or paste the JSON) →
   **Check and save**. New stories, and any story whose file changed, go to **Needs review**.
   A story that is live can't be replaced mid-run; pause or retire it instead.
4. **Approve or decline it.** One approval is enough. Declining needs a note for the writers; it
   stays with the story. Approving again later, or sending it back to review, is always possible
   until it goes live.
5. **Schedule it.** Pick Day 1 (a Sunday unless the file's `start_weekday` says otherwise, never in
   the past). The Studio shows the finale date, and refuses a week whose finale lands on the same
   day as another story's. Side stories run alongside their main story automatically. Beats go out
   at midnight New York time; votes close at the times in the file.
6. **Run it.** While it's live you can:
   - **Pause** the whole story: players stop seeing it and every effect on the city lifts until you
     resume. The calendar keeps counting, so it resumes on the day it would have been.
   - **Retire** it: it ends for good.
   - Pause or retire a **single beat** from the Beats list (for example to pull one headline).
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
