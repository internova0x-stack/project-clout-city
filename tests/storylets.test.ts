import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { cardView, fit, pickCard, resolveChoice, type ChoiceCard, type ChoiceContext } from "../lib/choices.ts";
import { EMPTY_MEMORY, condOk, fillSlots, systemsOf, whenOk } from "../lib/storylets.ts";
import type { Fact, FactKey, Memory } from "../lib/memory.ts";

const dir = new URL("../content/choices/", import.meta.url);
const CARDS: ChoiceCard[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
const STORYLETS = CARDS.filter((c) => c.when);
const TODAY = "2026-11-02";
const fact = (key: FactKey, subject = "", daysAgo = 1, count = 1): Fact => {
  const at = new Date(Date.parse(`${TODAY}T12:00:00Z`) - daysAgo * 86_400_000).toISOString();
  return { key, subject, value: {}, count, first: at, last: at, expires: null };
};
const mem = (facts: Fact[], snap: Partial<Memory["snapshot"]> = {}): Memory => ({ snapshot: { ...EMPTY_MEMORY.snapshot, ...snap }, facts });
const ctx = (memory: Memory | null, o: Partial<ChoiceContext> = {}): ChoiceContext => ({
  place: null, tags: [], after: "arrive", integrity: 50, rank: 3, student: false, business: false, roommate: false, history: [], today: TODAY, memory, ...o,
});

test("there are about 20 storylets, most of them combining two or more systems", () => {
  assert.ok(STORYLETS.length >= 20, `${STORYLETS.length}`);
  assert.ok(STORYLETS.filter((c) => systemsOf(c.when).size >= 2).length >= 15);
});

test("conditions: facts (subject, prefix, recency, counts) and the snapshot", () => {
  const m = mem([fact("career.took_credit", "tech:rival", 3), fact("gossip.found", "a", 1, 4), fact("gossip.found", "b", 1, 2)], { job: { track: "media", level: 2, workMood: 60 }, band: "hustler" });
  assert.ok(condOk({ has: "career.took_credit" }, m, TODAY));
  assert.ok(condOk({ has: "career.took_credit", subjectStarts: "tech:" }, m, TODAY));
  assert.ok(!condOk({ has: "career.took_credit", withinDays: 2 }, m, TODAY));
  assert.ok(condOk({ has: "gossip.found", minCount: 6 }, m, TODAY), "counts add up across subjects");
  assert.ok(condOk({ snap: "job.track", is: "media" }, m, TODAY) && !condOk({ snap: "partner" }, m, TODAY));
  assert.ok(condOk({ snap: "band", is: "hustler" }, m, TODAY));
  assert.ok(whenOk({ all: [{ has: "career.took_credit" }], none: [{ snap: "partner" }] }, m, TODAY));
  assert.ok(!whenOk({ all: [{ has: "career.took_credit" }] }, null, TODAY), "no memory, no storylet");
});

test("slots fill from memory: a coworker's name, a place's name, an employer", () => {
  const m = mem([fact("career.took_credit", "media:rival"), fact("place.banned", "the-sticky-floor")], { job: { track: "tech", level: 1, workMood: 60 } });
  const s = fillSlots({ c: { fact: "career.took_credit", show: "coworker" }, p: { fact: "place.banned", show: "place" }, e: { snap: "job.track", show: "employer" }, b: { snap: "job.track", show: "boss" } }, m)!;
  assert.deepEqual(s.text, { c: "Jax Holloway", p: "The Sticky Floor", e: "Pivotly", b: "Dana" });
  assert.equal(s.raw.c, "media:rival");
  assert.equal(fillSlots({ c: { fact: "career.fired", show: "employer" } }, m), null, "an empty slot means the card can't show");
});

test("a storylet shows only to players whose memory matches, filled in, and combinations come first", () => {
  const card = STORYLETS.find((c) => c.id === "ex-coworker-tells-partner")!;
  assert.equal(fit(card, ctx(mem([]))), 0);
  const m = mem([fact("career.took_credit", "tech:rival")], { partner: "someone" });
  assert.ok(fit(card, ctx(m)) >= 5, "a two-system storylet outweighs an ordinary card");
  const v = cardView(card, 1, null, m);
  assert.match(v.title, /^Brent sent your partner/);
  assert.ok(!JSON.stringify(v).includes("{coworker}"));
  // Ordinary cards don't need memory at all.
  const plain = CARDS.find((c) => !c.when && !c.chainOnly && !c.needs && !c.where.places && !c.where.tags && (!c.where.after || c.where.after.includes("arrive")))!;
  assert.ok(fit(plain, ctx(null)) > 0);
});

test("choosing fills the receipt and writes the outcome's facts, with slot subjects", () => {
  const card = STORYLETS.find((c) => c.id === "ex-coworker-tells-partner")!;
  const m = mem([fact("career.took_credit", "hospitality:rival")], { partner: "someone" });
  const r = resolveChoice(card, "confront", TODAY, () => 0.5, 50, m);
  assert.match(r.text, /^Kendall shrugs/);
  assert.deepEqual(r.sets, [{ fact: "thread.feud", subject: "hospitality:rival" }]);
  const sold = STORYLETS.find((c) => c.id === "fired-client-list")!;
  const r2 = resolveChoice(sold, "sell", TODAY, () => 0.1, 50, mem([fact("career.fired", "tech")]));
  assert.deepEqual(r2.sets, [{ fact: "thread.sold_client_list", subject: "tech" }]);
  assert.match(r2.later?.headline ?? "", /Pivotly goes after former employee \{name\}/);
});

test("a story keeps branching: what a storylet writes can unlock or close the next", () => {
  const fraud = STORYLETS.find((c) => c.id === "promoted-fraud")!;
  const m = mem([fact("career.promoted", "tech", 2)], { job: { track: "tech", level: 2, workMood: 60 } });
  assert.ok(fit(fraud, ctx(m)) > 0);
  m.facts.push(fact("thread.covered_fraud", "", 0));
  assert.equal(fit(fraud, ctx(m)), 0, "signed once, it doesn't ask again");
});

test("with the sample history, every arrival can find a storylet", () => {
  const m = mem([fact("career.took_credit", "media:rival"), fact("dating.date")], { partner: "p", job: { track: "media", level: 2, workMood: 60 } });
  const pick = pickCard(STORYLETS, ctx(m), () => 0.3);
  assert.ok(pick && pick.when);
});
