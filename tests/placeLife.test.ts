import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "../lib/city.ts";
import { CONDITION_KINDS } from "../lib/cityConditions.ts";
import { SKILLS } from "../lib/skills.ts";
import { LIFE, LifeError, activitiesAt, claimStamp, doActivity, doMoment, happeningsNow, lifeView, momentFor, rollOption, validateLife, type LifeDone } from "../lib/placeLife.ts";
import { PLAYER_TAGS, crowdTypeFor, dayPart, fits, pickLine, stageOf, validateDialogue, type Scene } from "../lib/dialogue.ts";
import { readFileSync } from "node:fs";
import type { LifeContent } from "../lib/placeLife.ts";
import type { DialogueFile } from "../lib/dialogue.ts";

const LIFE_CONTENT = JSON.parse(readFileSync("content/places/life.json", "utf8")) as LifeContent;
const DIALOGUE = JSON.parse(readFileSync("content/dialogue/dialogue.json", "utf8")) as DialogueFile;

const places = new Set(PLACES.map((p) => p.id));
const tags = new Set(PLACES.flatMap((p) => p.tags));
const conditions = new Set(Object.keys(CONDITION_KINDS));
const crowd = new Set(DIALOGUE.crowd.map((c) => c.id));
const skills = new Set(SKILLS.map((s) => s.id));
const fresh = (): LifeDone => ({ refs: new Set(), momentsToday: 0 });

test("the place content follows the Studio's rules", () => {
  assert.deepEqual(validateLife(LIFE_CONTENT, places, crowd, conditions, skills), []);
});

test("the dialogue follows the Studio's rules", () => {
  assert.deepEqual(validateDialogue(DIALOGUE, { tags, places, conditions, player: new Set(PLAYER_TAGS) }), []);
});

test("happenings run only in their hours, days and conditions", () => {
  const lunch = { minute: 12 * 60, weekday: 2, conditions: [] };
  const night = { minute: 23 * 60, weekday: 2, conditions: [] };
  assert.ok(happeningsNow(LIFE_CONTENT, "feta-compli", lunch).some((h) => h.id === "feta-lunch"));
  assert.ok(!happeningsNow(LIFE_CONTENT, "feta-compli", night).some((h) => h.id === "feta-lunch"));
  assert.ok(activitiesAt(LIFE_CONTENT, "feta-compli", lunch).some((a) => a.id === "feta-lunch-rush"));
  assert.ok(!activitiesAt(LIFE_CONTENT, "feta-compli", night).some((a) => a.id === "feta-lunch-rush"));
  assert.ok(!activitiesAt(LIFE_CONTENT, "neon-spoon", lunch).some((a) => a.id === "hub-candlelight"));
  assert.ok(activitiesAt(LIFE_CONTENT, "neon-spoon", { ...lunch, conditions: ["brownout"] }).some((a) => a.id === "hub-candlelight"));
});

test("activities: there, now, once a day, with the Energy; results stay within the caps", () => {
  const scene = { minute: 12 * 60, weekday: 2, conditions: [] };
  const ctx = { at: "feta-compli", scene, done: fresh(), energy: 100, skill: () => 0 };
  const r = doActivity(LIFE_CONTENT, "feta-opa", "smash", ctx, () => 0);
  assert.equal(r.ref, "a:feta-opa");
  assert.ok(r.clout <= LIFE.cap.clout && Math.abs(r.cash) <= LIFE.cap.cash);
  ctx.done.refs.add(r.ref);
  assert.throws(() => doActivity(LIFE_CONTENT, "feta-opa", "smash", ctx, () => 0), (e: LifeError) => e.code === "done_today");
  assert.throws(() => doActivity(LIFE_CONTENT, "feta-offmenu", "yiayia", { ...ctx, at: "neon-spoon" }, () => 0), (e: LifeError) => e.code === "not_here");
  assert.throws(() => doActivity(LIFE_CONTENT, "feta-lunch-rush", "tables", { ...ctx, scene: { ...scene, minute: 22 * 60 } }, () => 0), (e: LifeError) => e.code === "not_now");
  assert.throws(() => doActivity(LIFE_CONTENT, "feta-lunch-rush", "tables", { ...ctx, energy: 3 }, () => 0), (e: LifeError) => e.code === "no_energy");
});

test("skill makes good outcomes likelier, never certain", () => {
  const o = LIFE_CONTENT.activities.find((a) => a.id === "feta-opa")!.options[0];
  const goodRate = (skill: number) => {
    let good = 0;
    for (let i = 0; i < 2000; i++) if (rollOption(o, skill, () => (i + 0.5) / 2000).good) good++;
    return good / 2000;
  };
  assert.ok(goodRate(10) > goodRate(0) + 0.1);
  assert.ok(goodRate(10) < 1);
});

test("moments: five a day, each once a week; stamps pay once from their day", () => {
  const done = fresh();
  assert.equal(momentFor(LIFE_CONTENT, "tourist", done, () => 0.99), null, "not every tap starts one");
  const m = momentFor(LIFE_CONTENT, "tourist", done, () => 0)!;
  assert.equal(m.id, "tourist-directions");
  const r = doMoment(LIFE_CONTENT, m.id, "help", done, () => 0, () => 0);
  done.refs.add(r.ref); done.momentsToday++;
  assert.throws(() => doMoment(LIFE_CONTENT, m.id, "help", done, () => 0, () => 0), (e: LifeError) => e.code === "done_week");
  assert.throws(() => doMoment(LIFE_CONTENT, "influencer-ringlight", "hold", { refs: new Set(), momentsToday: LIFE.momentsPerDay }, () => 0, () => 0), (e: LifeError) => e.code === "moments_out");
  assert.throws(() => claimStamp(LIFE_CONTENT, "feta-compli", 7, 5, fresh()), (e: LifeError) => e.code === "not_yet");
  const s = claimStamp(LIFE_CONTENT, "feta-compli", 3, 5, fresh());
  assert.equal(s.ref, "s:feta-compli:3");
  const v = lifeView(LIFE_CONTENT, "feta-compli", { minute: 600, weekday: 1, conditions: [] }, { refs: new Set([s.ref]), momentsToday: 0 }, 5);
  assert.equal(v.stamps!.claimable.length, 0);
  assert.equal(v.stamps!.next!.days, 7);
});

test("players never see outcomes", () => {
  const v = lifeView(LIFE_CONTENT, "feta-compli", { minute: 12 * 60, weekday: 2, conditions: [] }, fresh(), 0);
  assert.ok(!JSON.stringify(v).includes("outcomes"));
  assert.ok(!JSON.stringify(v).includes("weight"));
});

test("dialogue: lines match the moment, the most relevant unheard line wins, and repeats wait", () => {
  const s: Scene = { placeId: "neon-spoon", tags: ["hub", "diner"], floor: 1, part: dayPart(8 * 60), weekday: 3, stage: stageOf({ clout: 20, daysIn: 1 }), conditions: ["brownout"], player: [] };
  assert.equal(s.part, "morning");
  assert.equal(s.stage, "new");
  assert.ok(fits({ text: "x", condition: ["brownout"] }, s));
  assert.ok(!fits({ text: "x", stage: ["famous"] }, s));
  const tiers = [{ name: "a", lines: ["one", "two"] }, { name: "b", lines: ["three"] }];
  assert.equal(pickLine(tiers, ["one", "two"], () => 0)?.text, "three", "the first tier's lines were heard: the next tier");
  assert.equal(pickLine(tiers, [], () => 0)?.tier, "a");
  assert.equal(pickLine([{ name: "a", lines: ["one", "two"] }], ["two", "one"], () => 0)?.text, "two", "all heard: the one heard longest ago");
  assert.equal(stageOf({ clout: 12_000, daysIn: 40 }), "famous");
});

test("every crowd type turns up somewhere, and the same seat is the same person", () => {
  for (const c of DIALOGUE.crowd) assert.ok(Object.keys(c.haunts).length > 0, c.id);
  const s = { tags: ["taverna", "dining_medium"], part: "afternoon" as const, floor: 1 };
  assert.equal(crowdTypeFor(DIALOGUE.crowd, s, 42)?.id, crowdTypeFor(DIALOGUE.crowd, s, 42)?.id);
  assert.ok(crowdTypeFor(DIALOGUE.crowd, s, 7));
});
