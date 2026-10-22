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
