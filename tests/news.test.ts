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
