import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { LEARNING, learnWeights, scoreOf, splitOf, studioRows, type CardStats } from "../lib/cardLearning.ts";
import { fit, pickCard, type ChoiceCard, type ChoiceContext } from "../lib/choices.ts";

const dir = new URL("../content/choices/", import.meta.url);
const CARDS: ChoiceCard[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
const stat = (card: string, shown: number, chosen: number, options: Record<string, number>): CardStats =>
  ({ card, base: card, shown, chosen, skipped: shown - chosen, expired: 0, options });

test("split: even across options is 1, everyone picking one is 0", () => {
  assert.equal(splitOf({ a: 10, b: 10 }), 1);
  assert.equal(splitOf({ a: 20 }, 2), 0);
  assert.ok(Math.abs(splitOf({ a: 10, b: 10, c: 10 }) - 1) < 1e-9);
  assert.equal(splitOf({}), 0);
  assert.ok(splitOf({ a: 15, b: 5 }) > 0 && splitOf({ a: 15, b: 5 }) < 1);
});

test("weights: loved and contested cards come up more, closed cards less, the rarely-closed are retired", () => {
  const stats = [
    stat("loved", 100, 85, { a: 45, b: 40 }),
    stat("ok", 100, 55, { a: 30, b: 25 }),
    stat("ok2", 100, 50, { a: 35, b: 15 }),
    stat("lopsided", 100, 60, { a: 60 }),
    stat("closed", 100, 10, { a: 6, b: 4 }),
    stat("new", 10, 2, { a: 2 }),
  ];
  const w = Object.fromEntries(learnWeights(stats, { lopsided: 2 }).map((x) => [x.card, x]));
  assert.equal(w.new, undefined, "too few showings: no weight yet");
  assert.ok(w.loved.weight > 1);
  assert.ok(w.closed.weight < 1);
  assert.ok(w.closed.retired, "most players close it");
  assert.ok(!w.loved.retired && !w.ok.retired);
  assert.ok(w.lopsided.weight < w.ok.weight, "a dilemma nobody's torn on is weaker");
  for (const x of Object.values(w)) assert.ok(x.weight >= LEARNING.weight.min && x.weight <= LEARNING.weight.max);
  assert.equal(scoreOf(stat("z", 0, 0, {})).score, 0);
});

test("the card picker multiplies by the weights; a retired card never shows", () => {
  const card = CARDS.find((c) => !c.when && !c.needs && !c.where.places && !c.where.tags && !c.chainOnly && c.where.after?.includes("arrive"))!;
  const ctx: ChoiceContext = { place: null, tags: [], after: "arrive", integrity: 50, rank: 3, student: false, business: false, roommate: false, history: [], today: "2026-11-02" };
  const base = fit(card, ctx);
  assert.ok(base > 0);
  assert.equal(fit(card, { ...ctx, weights: { [card.id]: 1.5 } }), base * 1.5);
  assert.equal(fit(card, { ...ctx, weights: { [card.id]: 0 } }), 0);
  assert.equal(pickCard([card], { ...ctx, weights: { [card.id]: 0 } }, () => 0.5), null);
});

test("the Studio's rows: titles, the owner's settings, retired last", () => {
  const rows = studioRows(
    [stat("a", 50, 40, { x: 20, y: 20 }), stat("b", 50, 5, { x: 5 })],
    [{ card: "a", weight: 1.4, retired: false, set_by: "auto" }, { card: "b", weight: 0.5, retired: true, set_by: "admin" }],
    { a: { title: "A card", emoji: "🅰️", options: 2 } },
  );
  assert.equal(rows[0].card, "a");
  assert.equal(rows[0].title, "A card");
  assert.equal(rows[1].retired, true);
  assert.equal(rows[1].setBy, "admin");
  assert.equal(rows[1].title, "b");
});
