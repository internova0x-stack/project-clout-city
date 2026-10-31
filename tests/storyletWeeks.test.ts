import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { FAMILIES, STORYLET_WEEKS, sampleFill, storyletWhen, validateStoryletWeek, whenLines, type StoryletWeek } from "../lib/storyletWeeks.ts";
import { fit, type ChoiceCard, type ChoiceContext } from "../lib/choices.ts";
import { EMPTY_MEMORY } from "../lib/storylets.ts";
import { PLACES } from "../lib/city.ts";
import { REGULARS } from "../lib/cast.ts";
import type { Fact, FactKey, Memory } from "../lib/memory.ts";

const choiceDir = new URL("../content/choices/", import.meta.url);
const weekDir = new URL("../content/storylets/", import.meta.url);
const CARDS: ChoiceCard[] = readdirSync(choiceDir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, choiceDir), "utf8")));
const WEEKS: { file: string; raw: StoryletWeek }[] = readdirSync(weekDir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, raw: JSON.parse(readFileSync(new URL(f, weekDir), "utf8")) }));
const npcs = JSON.parse(readFileSync(new URL("../content/culture/npcs.json", import.meta.url), "utf8"));
const known = {
  places: PLACES.map((p) => p.id),
  tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))],
  npcs: [...new Set([...REGULARS.map((r) => r.id), ...npcs.profiles.map((p: { id: string }) => p.id), ...npcs.roommates.map((p: { id: string }) => p.id)])],
};
const first = () => structuredClone(WEEKS[0].raw);

test("every week file passes, named for its Monday, and no id repeats across weeks", () => {
  assert.ok(WEEKS.length >= 1);
  let seen = [...CARDS];
  for (const { file, raw } of WEEKS) {
    const r = validateStoryletWeek(raw, { others: seen, known });
    assert.ok(r.ok, `${file}: ${r.ok ? "" : r.problems.join("; ")}`);
    assert.equal(`${raw.week}.json`, file);
    seen = [...seen, ...raw.cards];
  }
});

test("the first week: about ten cards, every family, cross-system storylets", () => {
  const w = WEEKS[0].raw;
  assert.ok(w.cards.length >= STORYLET_WEEKS.perWeek.min && w.cards.length <= STORYLET_WEEKS.perWeek.max);
  assert.deepEqual([...new Set(w.cards.map((c) => c.family))].sort(), [...FAMILIES].sort());
  for (const c of w.cards) assert.ok(c.when, `${c.id} reacts to memory`);
});

test("the week validator catches the routine's mistakes", () => {
  const bad = (mutate: (w: StoryletWeek) => void, want: RegExp) => {
    const w = first(); mutate(w);
    const r = validateStoryletWeek(w, { others: CARDS, known });
    assert.ok(!r.ok && r.problems.some((p) => want.test(p)), `expected ${want}, got ${r.ok ? "ok" : r.problems.join("; ")}`);
  };
  bad((w) => { w.week = "2026-11-03"; }, /Monday/);
  bad((w) => { w.cards = w.cards.slice(0, 3); }, /6 to 14 cards/);
  bad((w) => { for (const c of w.cards) c.family = "favor"; }, /at least 4 families/);
  bad((w) => { delete w.cards[0].family; }, /family must be/);
  bad((w) => { delete w.cards[0].when; }, /give it "when"/);
  bad((w) => { w.cards[0].id = CARDS[0].id; }, /repeated id/);
  bad((w) => { w.cards[0].title = "{nobody} did a thing."; }, /unknown slot/);
});

test("weekly cards only reach players whose memory fits", () => {
  const card = WEEKS[0].raw.cards.find((c) => c.id === "partner-call-sheet")!;
  const ctx = (memory: Memory): ChoiceContext => ({
    place: "astoria-blvd-station", tags: ["subway"], after: "arrive", integrity: 50, rank: 3, student: false, business: false, roommate: false,
    history: [], today: "2026-11-03", memory,
  });
  assert.equal(fit(card, ctx(EMPTY_MEMORY)), 0);
  const m: Memory = { ...EMPTY_MEMORY, snapshot: { ...EMPTY_MEMORY.snapshot, campaign: "starr", partner: "p" } };
  assert.ok(fit(card, ctx(m)) >= 5, "a campaign and a partner: a two-system combination comes first");
  const f = (key: FactKey, subject = ""): Fact => ({ key, subject, value: {}, count: 1, first: "2026-11-01T12:00:00Z", last: "2026-11-01T12:00:00Z", expires: null });
  const rival = WEEKS[0].raw.cards.find((c) => c.id === "rival-in-your-class")!;
  const mm: Memory = { snapshot: { ...EMPTY_MEMORY.snapshot, campus: "st-johnsons" }, facts: [f("career.took_credit", "tech:rival")] };
  assert.ok(fit(rival, ctx(mm)) > 0);
});

test("the Studio's view: sample names, plain conditions, the window", () => {
  assert.equal(sampleFill("{boss} at {place}", { boss: { snap: "job.track", show: "boss" }, place: { fact: "place.banned", show: "place" } }), "Dana at The Sticky Floor");
  const lines = whenLines({ all: [{ has: "career.promoted", withinDays: 10 }, { snap: "job" }], none: [{ has: "thread.reported_fraud" }] });
  assert.match(lines[0], /^Needs: Promoted in the last 10 days; job/);
  assert.match(lines[1], /^Not if: Reported/);
  const now = Date.parse("2026-11-02T12:00:00Z");
  assert.equal(storyletWhen({ status: "scheduled", live_at: "2026-11-03T05:00:00Z" }, now), "Goes live in 17 h");
  assert.equal(storyletWhen({ status: "scheduled", live_at: "2026-11-02T12:20:00Z" }, now), "Goes live in 20 min");
  assert.equal(storyletWhen({ status: "live", live_at: "2026-11-01T00:00:00Z" }, now), "Live");
  assert.equal(STORYLET_WEEKS.windowHours, 24);
});
