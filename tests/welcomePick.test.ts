import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWelcome, welcomeLadder, type WelcomeSituation } from "../lib/welcomePick.ts";

const base = (over: Partial<WelcomeSituation> = {}): WelcomeSituation => ({
  rent: null, passReady: 0, streak: { current: 0, doneToday: false }, nyHour: 10,
  tasks: { done: 1, total: 5, next: { title: "Spill the tea with Sal", place: "ditmars-deli" }, undonePlaces: ["ditmars-deli"] },
  pick: null, goal: null, skill: null, unread: 0, story: null, skipped: [], ...over,
});
const happening = { why: "happening" as const, emoji: "🥙", title: "Help with the lunch rush", place: "feta-compli", placeName: "Feta Compli", get: "Cash", energy: 15, note: "Lunch rush · until 2 PM", here: false };

test("rent trouble beats everything, even when put off yesterday", () => {
  const a = pickWelcome(base({ rent: { title: "🧾 C$600 in bills to pay", line: "Pay it", canPay: false }, passReady: 3, pick: happening, skipped: ["rent"] }));
  assert.equal(a?.kind, "rent");
  assert.equal(a?.target, "gigs");
  assert.equal(a?.title, "C$600 in bills to pay");
});

test("a reward to collect comes before the streak and a happening", () => {
  const s = base({ passReady: 2, streak: { current: 6, doneToday: false }, nyHour: 20, pick: happening });
  assert.equal(pickWelcome(s)?.kind, "reward");
  assert.deepEqual(welcomeLadder(s).map((a) => a.kind).slice(0, 3), ["reward", "streak", "happening"]);
});

test("the streak only takes over late in the day, from 3 days, with tasks left", () => {
  assert.equal(pickWelcome(base({ streak: { current: 6, doneToday: false }, nyHour: 20 }))?.kind, "streak");
  assert.equal(pickWelcome(base({ streak: { current: 6, doneToday: false }, nyHour: 11 }))?.kind, "task");
  assert.equal(pickWelcome(base({ streak: { current: 2, doneToday: false }, nyHour: 20 }))?.kind, "task");
  assert.equal(pickWelcome(base({ streak: { current: 6, doneToday: true }, nyHour: 20 }))?.kind, "task");
});

test("a happening says when it ends, and when it also clears a daily task", () => {
  const a = pickWelcome(base({ pick: happening, tasks: { done: 0, total: 5, next: null, undonePlaces: ["feta-compli"] } }));
  assert.equal(a?.kind, "happening");
  assert.equal(a?.detail, "Cash · ⚡ 15 Energy");
  assert.match(a!.why!, /until 2 PM\. It also clears a daily task\.$/);
});

test("one step from done: the one that also clears a task goes first", () => {
  const stamp = { ...happening, why: "stamp" as const, note: "Sal starts your order" , place: "ditmars-deli", placeName: "Sal's" };
  const s = base({ pick: stamp, skill: { emoji: "🍵", name: "Gossip", level: 3, more: 1, how: "Listen in", perk: true } });
  assert.deepEqual(welcomeLadder(s).map((a) => a.kind).slice(0, 2), ["stamp", "skill"]);
  const noTask = base({ pick: stamp, tasks: { done: 1, total: 5, next: null, undonePlaces: [] }, skill: { emoji: "🍵", name: "Gossip", level: 3, more: 1, how: "Listen in", perk: true } });
  assert.deepEqual(welcomeLadder(noTask).map((a) => a.kind).slice(0, 2), ["stamp", "skill"]);
  assert.equal(pickWelcome(base({ skill: { emoji: "🍵", name: "Gossip", level: 3, more: 4, how: "x", perk: false } }))?.kind, "task");
  assert.equal(pickWelcome(base({ goal: { emoji: "🥪", title: "Be a regular", pct: 0.85, left: "1 of 3" } }))?.kind, "goal");
  assert.equal(pickWelcome(base({ goal: { emoji: "🥪", title: "Be a regular", pct: 0.5, left: "1 of 3" } }))?.kind, "task");
});

test("messages, then the story, then the next task, then a new place", () => {
  assert.equal(pickWelcome(base({ unread: 2, story: { title: "Who Killed Sarah Bird?", emoji: "🕊️", fresh: 1 } }))?.kind, "messages");
  assert.equal(pickWelcome(base({ story: { title: "Who Killed Sarah Bird?", emoji: "🕊️", fresh: 1 } }))?.kind, "story");
  assert.equal(pickWelcome(base({ story: { title: "x", emoji: "x", fresh: 0 } }))?.kind, "task");
  assert.equal(pickWelcome(base({ tasks: { done: 5, total: 5, next: null, undonePlaces: [] }, pick: { ...happening, why: "new" } }))?.kind, "new");
  assert.equal(pickWelcome(base({ tasks: { done: 5, total: 5, next: null, undonePlaces: [] } })), null);
});

test("what was put off yesterday is skipped, unless it's all there is", () => {
  const s = base({ passReady: 1, unread: 1 });
  assert.equal(pickWelcome({ ...s, skipped: ["reward"] })?.kind, "messages");
  assert.equal(pickWelcome(base({ tasks: { done: 1, total: 5, next: { title: "x", place: null }, undonePlaces: [] }, skipped: ["task"] }))?.kind, "task");
});

test("already there: Do it now", () => {
  assert.equal(pickWelcome(base({ pick: { ...happening, here: true } }))?.cta, "Do it now");
});

test("lines end in one stop and read naturally", () => {
  const s = base({ streak: { current: 6, doneToday: false }, nyHour: 20 });
  assert.equal(pickWelcome(s)?.detail, "1 of 5 tasks done · 4 to go");
  const stamp = { ...happening, why: "stamp" as const, note: "Meatball tolerates you. This is unprecedented.", place: "x", placeName: "Sal's" };
  assert.equal(pickWelcome(base({ pick: stamp }))?.why, "One more visit: Meatball tolerates you. This is unprecedented.");
});

test("a broken streak to repair comes right after rent", () => {
  const s = base({ repair: { streak: 21 }, passReady: 2, rent: null });
  assert.equal(pickWelcome(s)?.kind, "repair");
  assert.equal(pickWelcome(s)?.title, "Repair your 21-day streak");
  assert.equal(pickWelcome({ ...s, rent: { title: "🧾 C$600", line: "x", canPay: true } })?.kind, "rent");
});
