import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  CONDITIONS, CONDITION_KINDS, conditionOn, conditionsInForce, conditionWhen, validateConditionWeek, validateReactions,
  type ConditionWeek, type ReactionRule,
} from "../lib/cityConditions.ts";
import { whenOk, EMPTY_MEMORY } from "../lib/storylets.ts";
import { PLACES } from "../lib/city.ts";

const known = { tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))], places: PLACES.map((p) => p.id) };
const dir = new URL("../content/conditions/", import.meta.url);
const WEEKS = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, raw: JSON.parse(readFileSync(new URL(f, dir), "utf8")) as ConditionWeek }));
const RULES: ReactionRule[] = JSON.parse(readFileSync(new URL("../content/city/reactions.json", import.meta.url), "utf8"));

test("every conditions week and the city storylets pass", () => {
  let ids: string[] = [];
  for (const { file, raw } of WEEKS) {
    const r = validateConditionWeek(raw, known, ids);
    assert.ok(r.ok, `${file}: ${r.ok ? "" : r.problems.join("; ")}`);
    assert.equal(`${raw.week}.json`, file);
    ids = [...ids, ...raw.conditions.map((c) => c.id)];
  }
  assert.deepEqual(validateReactions(RULES, known), []);
  assert.ok(RULES.length >= 6);
});

test("the validator keeps conditions safe: protected places, closures, caps", () => {
  const bad = (mutate: (w: ConditionWeek) => void, want: RegExp) => {
    const w = structuredClone(WEEKS[0].raw); mutate(w);
    const r = validateConditionWeek(w, known);
    assert.ok(!r.ok && r.problems.some((p) => want.test(p)), `expected ${want}, got ${r.ok ? "ok" : r.problems.join("; ")}`);
  };
  bad((w) => { w.week = "2026-11-03"; }, /Monday/);
  bad((w) => { w.conditions[0].effects = [{ type: "availability", tags: ["residential"], state: "closed", reason: "No." }]; }, /protected/);
  bad((w) => { w.conditions[0].effects = [{ type: "availability", tags: ["lounge"], state: "closed", reason: "Dark." }]; }, /at most 12 hours/);
  bad((w) => { w.conditions[0].effects[0].multiplier = 3; }, /multiplier/);
  bad((w) => { w.conditions[0].endsAt = "2026-11-12T00:00:00-05:00"; }, /lasts/);
  bad((w) => { w.conditions[0].startsAt = "2026-10-30T12:00:00-05:00"; }, /inside its week|lasts/);
  bad((w) => { (w.conditions[0] as { kind: string }).kind = "alien_invasion"; }, /kind/);
  bad((w) => { w.conditions[0].effects = [{ type: "place_state", place: "nowhere", note: "x" }]; }, /unknown place/);
  bad((w) => { w.conditions[1].id = w.conditions[0].id; }, /repeated id/);
  const rule = structuredClone(RULES[0]);
  rule.min = 1; rule.key = "career.nonsense"; rule.headline = "{name} did it";
  const p = validateReactions([rule], known).join("; ");
  assert.match(p, /at least 3/); assert.match(p, /unknown tally key/); assert.match(p, /names no player/);
});

test("conditions in force: storylets read the kinds, crackdowns by employer", () => {
  const list = [
    { kind: "heatwave", now: true, subject: "" }, { kind: "festival", now: false, subject: "" }, { kind: "hr_crackdown", now: true, subject: "tech" },
  ];
  assert.deepEqual(conditionsInForce(list), ["heatwave", "hr_crackdown"]);
  assert.ok(conditionOn(list, "hr_crackdown", "tech"));
  assert.ok(!conditionOn(list, "hr_crackdown", "media"));
  assert.ok(!conditionOn(list, "festival"));
  const m = { ...EMPTY_MEMORY, snapshot: { ...EMPTY_MEMORY.snapshot, conditions: ["heatwave"], businesses: ["hot-dog-cart"] } };
  assert.ok(whenOk({ all: [{ snap: "conditions", is: "heatwave" }, { snap: "businesses", min: 1 }] }, m, "2026-11-04"));
  assert.ok(!whenOk({ all: [{ snap: "conditions", is: "brownout" }] }, m, "2026-11-04"));
});

test("players see when it ends, or when it starts", () => {
  assert.match(conditionWhen({ now: true, startsAt: "2026-11-04T16:00:00Z", endsAt: "2026-11-06T02:00:00Z" }), /^Until Thu/);
  assert.match(conditionWhen({ now: false, startsAt: "2026-11-07T15:00:00Z", endsAt: "2026-11-09T01:00:00Z" }), /^From Sat.* to Sun/);
  assert.ok(Object.keys(CONDITION_KINDS).length >= 10);
  assert.equal(CONDITIONS.closedMaxHours, 12);
});
