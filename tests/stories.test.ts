import { test } from "node:test";
import assert from "node:assert/strict";
import { loadArcs } from "../lib/storyContent.ts";
import { validateArcs } from "../lib/storyValidation.ts";
import {
  activeChatter, activeEffects, addDaysISO, predictionWindow, resolveAvailability, resolvePrice, storyDay, type Arc,
} from "../lib/stories.ts";

const arcs = loadArcs();
const main = arcs.find((a) => a.id === "sarah-bird")!;
const START = "2026-11-01"; // a Sunday
const on = (day: number, set: Arc[] = arcs) => activeEffects(set, addDaysISO(START, day - 1), { "sarah-bird": START });
const clone = () => JSON.parse(JSON.stringify(arcs)) as Arc[];

test("all story content passes validation", () => {
  assert.deepEqual(validateArcs(arcs), []);
});

test("the pilot isn't scheduled, so nothing is in force", () => {
  assert.equal(main.start_at, null);
  assert.equal(activeEffects(arcs, "2026-11-05").length, 0);
});

test("beats release by story day and effects expire", () => {
  assert.equal(storyDay(main, START, START), 1);
  assert.equal(storyDay(main, "2026-10-31", START), null);
  const skyline = (d: number) => resolveAvailability(on(d), { tags: ["skyline_pier"] });
  assert.equal(skyline(1).state, "restricted");
  assert.deepEqual(skyline(1).allow, ["lobby"]);
  assert.equal(skyline(8).state, "restricted");
  assert.equal(skyline(9).state, "default"); // lifts on Day 9
  const church = (d: number) => resolveAvailability(on(d), { tags: ["radiant_harbor"] });
  assert.equal(church(8).state, "default");
  assert.equal(church(9).state, "closed");
  assert.equal(church(9).reason, "Closed: police activity");
  assert.equal(church(10).state, "default");
});

test("diner prices rise 50% on Days 3 to 6 only", () => {
  const price = (d: number) => resolvePrice(on(d), ["rockaway_diner", "diner"], "visit_price").multiplier;
  assert.deepEqual([2, 3, 6, 7].map(price), [1, 1.5, 1.5, 1]);
  assert.equal(resolvePrice(on(4), ["rockaway_diner"], "shop_price").multiplier, 1);
});

test("price stacking takes the highest multiplier, capped at 2x; closures win", () => {
  const set = clone();
  const b = set.find((a) => a.id === "sarah-bird")!.beats[2];
  b.effects.push({ type: "price_multiplier", tags: ["rockaway_diner"], applies_to: "visit_price", multiplier: 3, reason: "x", expires_day: 7 });
  b.effects.push({ type: "availability", tags: ["rockaway_diner"], state: "closed", reason: "Closed: test", expires_day: 7 });
  assert.equal(resolvePrice(on(3, set), ["rockaway_diner"], "visit_price").multiplier, 2);
  assert.equal(resolveAvailability(on(3, set), { tags: ["rockaway_diner"] }).state, "closed");
});

test("the hoodie is in the Shop on Days 6 to 9", () => {
  const hoodie = (d: number) => resolveAvailability(on(d), { sku: "forever-our-bird-hoodie" }).state;
  assert.deepEqual([5, 6, 9, 10].map(hoodie), ["default", "open", "open", "default"]);
});

test("chatter phases switch on Days 1, 4, 8 and 10", () => {
  const phase = (d: number) => activeChatter(on(d))[0]?.phase;
  assert.deepEqual([1, 3, 4, 7, 8, 9, 10].map(phase), ["early", "early", "mid", "mid", "late", "late", "post"]);
});

test("story tasks are offered on their own day only", () => {
  const tasks = (d: number) => on(d).flatMap((x) => (x.effect.type === "task_injection" ? x.effect.add ?? [] : []));
  assert.deepEqual(tasks(1), ["story:sarah-bird:leave-flowers"]);
  assert.deepEqual(tasks(2), ["story:sarah-bird:light-candle"]);
  assert.deepEqual(tasks(6), []);
});

test("pause and retire hide an arc or a beat immediately", () => {
  const paused = clone();
  paused.find((a) => a.id === "sarah-bird")!.status = "paused";
  assert.equal(on(3, paused).length, 0);
  const beatOff = clone();
  beatOff.find((a) => a.id === "sarah-bird")!.beats[2].status = "retired";
  assert.equal(resolvePrice(on(3, beatOff), ["rockaway_diner"], "visit_price").multiplier, 1);
});

test("every prediction closes before its reveal and before Beat 8", () => {
  const sb8 = main.beats.find((b) => b.id === "sb-8")!;
  const beat8Opens = predictionWindow(main, sb8, { closes_at: { day: 8, time: "00:00" } } as never, START).closes - 59_999;
  for (const b of main.beats.filter((x) => x.prediction)) {
    const w = predictionWindow(main, b, b.prediction!, START);
    assert.ok(w.opens < w.closes && w.closes < w.reveals, b.prediction!.id);
    assert.ok(w.closes < beat8Opens, `${b.prediction!.id} closes before Beat 8`);
  }
});

test("validation catches broken content", () => {
  const bad = clone();
  const sb = bad.find((a) => a.id === "sarah-bird")!;
  sb.start_at = "2026-11-02"; // a Monday
  sb.beats[5].prediction!.closes_at = { day: 8, time: "12:00" }; // P2 after Beat 8
  sb.beats[2].effects.push({ type: "price_multiplier", tags: ["nowhere"], applies_to: "visit_price", multiplier: 2.5, reason: "x", expires_day: 4 });
  bad.find((a) => a.id === "sarah-bird-momager-files")!.beats[1].points_at_answer = true;
  const errors = validateArcs(bad).join("\n");
  assert.match(errors, /is a monday, not a sunday/);
  assert.match(errors, /P2: closes after sb-8/);
  assert.match(errors, /unknown tag nowhere/);
  assert.match(errors, /above the 2x cap/);
  assert.match(errors, /premium beat points at the answer before voting closes/);
});
