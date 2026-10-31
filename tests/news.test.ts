import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { newsGossip, splitNews, validateNewsWeek } from "../lib/news.ts";

const dir = new URL("../content/news/", import.meta.url);

test("every week file in content/news/ is valid", () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const r = validateNewsWeek(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
    assert.ok(r.ok, `${f}: ${r.ok ? "" : r.problems.join("; ")}`);
    assert.equal(f, `${(JSON.parse(readFileSync(new URL(f, dir), "utf8")) as { week: string }).week}.json`, "file named after its Monday");
  }
});

test("week files are checked: Monday weeks, known cast, one column, hunts on Mondays", () => {
  const item = { id: "x-item", kind: "city", day: "Tue", headline: "A headline here", body: "A body that is long enough." };
  assert.ok(validateNewsWeek({ week: "2026-10-12", items: [item] }).ok);
  const bad = (f: unknown) => { const r = validateNewsWeek(f); return r.ok ? [] : r.problems; };
  assert.match(bad({ week: "2026-10-13", items: [item] }).join(), /Monday/);
  assert.match(bad({ week: "2026-10-12", items: [{ ...item, cast: ["a-real-person"] }] }).join(), /isn't in the cast/);
  assert.match(bad({ week: "2026-10-12", items: [{ ...item, kind: "column" }, { ...item, id: "y-item", kind: "column" }] }).join(), /once a week/);
  assert.match(bad({ week: "2026-10-12", items: [{ ...item, kind: "hunt" }] }).join(), /Mondays/);
  assert.match(bad({ week: "2026-10-12", items: [item, item] }).join(), /duplicate/);
  // From the switch the hunt is announced on its Saturday (owner, Oct 31).
  assert.match(bad({ week: "2026-11-02", items: [{ ...item, kind: "hunt", day: "Mon" }] }).join(), /Saturdays/);
});

test("items publish on their day; a week later they move to the archive; regulars repeat city news", () => {
  const r = validateNewsWeek({ week: "2026-10-12", items: [
    { id: "mon-item", kind: "city", day: "Mon", headline: "Monday headline", body: "Something happened on Monday." },
    { id: "wed-item", kind: "column", day: "Wed", headline: "Ask Lola: help", body: "Lola says a wise thing here." },
  ] });
  assert.ok(r.ok);
  const items = r.ok ? r.items : [];
  assert.deepEqual(splitNews(items, "2026-10-13").recent.map((i) => i.id), ["mon-item"]);
  assert.deepEqual(splitNews(items, "2026-10-14").recent.map((i) => i.id), ["wed-item", "mon-item"]);
  assert.deepEqual(splitNews(items, "2026-10-20").archive.map((i) => i.id), ["mon-item"]);
  assert.deepEqual(newsGossip(items, "2026-10-14"), ["Did you hear? Monday headline."]);
});

test("the news card on arriving: never one already seen; today's first, then the week's (owner, Oct 22)", async () => {
  const { pickNewsCard, addSeen, NEWS_SEEN_MAX } = await import("../lib/news.ts");
  const mk = (id: string, day: string) => ({ id, kind: "city", day, headline: id, body: id }) as import("../lib/news.ts").NewsItem;
  const items = [mk("old", "2026-10-20"), mk("a", "2026-10-22"), mk("b", "2026-10-22"), mk("later", "2026-10-23")];
  const today = "2026-10-22";
  let seen: string[] = [];
  const first = pickNewsCard(items, today, seen)!;
  assert.equal(first.day, today, "today's news first");
  seen = addSeen(seen, [first.id]);
  const second = pickNewsCard(items, today, seen)!;
  assert.ok(second.day === today && second.id !== first.id, "the next visit brings another of today's");
  seen = addSeen(seen, [second.id]);
  assert.equal(pickNewsCard(items, today, seen)?.id, "old", "then the week's unseen");
  assert.equal(pickNewsCard(items, today, addSeen(seen, ["old"])), null, "all read: no card");
  assert.ok(!items.some((i) => i.id === "later" && pickNewsCard([i], today, []) !== null), "never tomorrow's");
  assert.equal(addSeen(Array.from({ length: 80 }, (_, i) => `x${i}`), ["new"]).length, NEWS_SEEN_MAX);
});

test("reading a story's blog post pays the same clout in the game and the database (migration 0117)", async () => {
  const { GAME_CONFIG } = await import("../lib/config.ts");
  const sql = readFileSync(new URL("../supabase/migrations/0117_story_read_clout.sql", import.meta.url), "utf8");
  assert.match(sql, new RegExp(`reward constant int := ${GAME_CONFIG.storyReadClout};`));
});

test("story characters come from the story files: the cast of each released post, a side story borrows its main's (owner, Oct 22)", async () => {
  const { withCharacters } = await import("../lib/storyCharacters.ts");
  const { loadArcs } = await import("../lib/storyContent.ts");
  const files = loadArcs();
  const beat = (id: string, locked = false) => ({ id, day: 1, headline: "H", locked, seen: false });
  const arc = (id: string, beats: ReturnType<typeof beat>[]) => ({ id, title: id, type: "main" as const, tier: "free" as const, day: 1, lastDay: 9, finished: false, entitled: true, beats, predictions: [] });
  const feed = { arcs: [arc("diss-and-tell", [beat("dt-1")]), arc("diss-and-tell-cosign", [beat("dtc-1", true)])] } as unknown as Parameters<typeof withCharacters>[0];
  const out = withCharacters(feed, files);
  const main = out.arcs[0];
  assert.ok((main.characters ?? []).some((c) => c.id === "toni-treasure"));
  assert.deepEqual(main.beats[0].cast, ["lord-menace", "big-ruckus", "toni-treasure"]);
  assert.equal(out.arcs[1].characters?.length, main.characters?.length, "the side story uses the main story's characters");
  assert.equal(out.arcs[1].beats[0].cast, undefined, "nothing for a locked post");
  // Every cast id is a known character, and every look is one the avatar can draw (the story checks too).
  for (const a of files) for (const b of a.beats) for (const id of b.news[0]?.cast ?? []) {
    const chars = a.characters ?? files.find((p) => p.id === a.parent_arc_id)?.characters ?? [];
    assert.ok(chars.some((c) => c.id === id), `${b.id}: ${id}`);
  }
});

test("a post shows at most 5 characters, the story's most important first", async () => {
  const { postCast } = await import("../lib/storyFeed.ts");
  const c = (id: string) => ({ id, name: id, role: "r", bio: "b", style: "s", look: {} });
  const arc = { characters: ["a", "b", "c", "d", "e", "f", "g"].map(c) };
  assert.deepEqual(postCast(arc, ["g", "c", "a", "f", "e", "d", "b"]).map((x) => x.id), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(postCast(arc, ["f", "zz", "b"]).map((x) => x.id), ["b", "f"]);
  assert.deepEqual(postCast({}, ["a"]), []);
});
