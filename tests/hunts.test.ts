import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { huntAnswer, huntLive, huntTalk, huntView, validateHunt, type HuntFile, type HuntProgress } from "../lib/hunts.ts";
import { CITY_ECONOMY } from "../lib/city.ts";

const dir = new URL("../content/hunts/", import.meta.url);
const files = readdirSync(dir).filter((x) => x.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as HuntFile;

test("every hunt file in content/hunts/ is valid and named after its Monday", () => {
  assert.ok(files.length > 0);
  for (const f of files) {
    const r = validateHunt(load(f));
    assert.ok(r.ok, `${f}: ${r.ok ? "" : r.problems.join("; ")}`);
    assert.equal(f, `${load(f).week}.json`);
  }
});

const hunt = load(files[0]);
const problems = (f: unknown, o = {}) => { const r = validateHunt(f, o); return r.ok ? "" : r.problems.join("\n"); };
const clone = () => structuredClone(hunt);

test("hunt files are checked: places, story safety, a cheap step, complete tracks, one right answer", () => {
  assert.match(problems({ ...clone(), week: "2026-10-20" }), /Monday/);
  assert.match(problems({ ...clone(), places: ["nowhere", ...hunt.places.slice(1)] }), /isn't a place/);
  assert.match(problems({ ...clone(), places: ["two-bros-pizza", ...hunt.places.slice(1)] }), /no regular/);
  assert.match(problems(clone(), { storyPlaces: [hunt.places[2]] }), /part of a story/);
  assert.match(problems({ ...clone(), places: ["velvet-static", "hellgate-hall", "respawn-arena", "unisphere"].slice(0, 3).concat("hellgate-hall") }), /different place/);
  const noTrack = clone(); delete (noTrack.tracks as Partial<HuntFile["tracks"]>).arcade_nerd;
  assert.match(problems(noTrack), /arcade_nerd: missing/);
  const twoRight = clone(); twoRight.tracks.bodega_drip.steps[1].question!.choices[0] = twoRight.tracks.bodega_drip.steps[1].question!.choices[1];
  assert.match(problems(twoRight), /exactly one right answer/);
  const badAnswer = clone(); badAnswer.tracks.bodega_drip.steps[1].question!.answer = 9;
  assert.match(problems(badAnswer), /index of one choice/);
  const noFinale = clone(); delete noFinale.tracks.bodega_drip.steps[4].question; delete noFinale.tracks.bodega_drip.steps[4].then;
  assert.match(problems(noFinale), /finale needs a question/);
});

test("the hunt runs Monday to Sunday", () => {
  assert.ok(huntLive("2026-10-19", "2026-10-19"));
  assert.ok(huntLive("2026-10-19", "2026-10-25"));
  assert.ok(!huntLive("2026-10-19", "2026-10-26"));
  assert.ok(!huntLive("2026-10-19", "2026-10-18"));
});

test("a full run: clues in order, visits required, wrong answers wait, the finale completes", () => {
  const t0 = Date.parse("2026-10-19T15:00:00Z");
  let p: HuntProgress = { style: "bodega_drip", step: 0, talked: false, wrongAt: null, completedAt: null };
  const v0 = huntView(hunt, null, t0);
  assert.equal(v0.joined, false);
  assert.equal(v0.firstPlace, "ditmars-deli");
  assert.equal(JSON.stringify(huntView(hunt, p, t0)).includes('"answer"'), false, "no answers in the view");
  assert.deepEqual(huntTalk(hunt, p, "engine-7", true), { ok: false, code: "not_here" });
  assert.deepEqual(huntTalk(hunt, p, "ditmars-deli", false), { ok: false, code: "visit_first" });
  const t1 = huntTalk(hunt, p, "ditmars-deli", true);
  assert.ok(t1.ok && !t1.question);
  p = t1.prog;
  assert.equal(p.step, 1, "a step with no question is done once heard");
  const t2 = huntTalk(hunt, p, "ditmars-library", true);
  assert.ok(t2.ok && t2.question);
  p = t2.prog;
  assert.ok(huntView(hunt, p, t0).question);
  const wrong = huntAnswer(hunt, p, 0, t0);
  assert.ok(wrong.ok && !wrong.correct);
  p = wrong.prog;
  assert.deepEqual(huntAnswer(hunt, p, 1, t0 + 60_000), { ok: false, code: "wait" });
  assert.ok(huntView(hunt, p, t0 + 60_000).question!.retryAt);
  const right = huntAnswer(hunt, p, 1, t0 + CITY_ECONOMY.hunt.retryMinutes * 60_000);
  assert.ok(right.ok && right.correct && right.then);
  p = right.prog;
  for (const [i, place] of hunt.places.slice(2).entries()) {
    const t = huntTalk(hunt, p, place, true);
    assert.ok(t.ok, place);
    p = t.prog;
    const q = hunt.tracks.bodega_drip.steps[i + 2].question;
    if (q) { const a = huntAnswer(hunt, p, q.answer, t0 + 3_600_000); assert.ok(a.ok && a.correct); p = a.prog; }
  }
  assert.ok(p.completedAt);
  const done = huntView(hunt, p, t0);
  assert.equal(done.heard.length, 5);
  assert.match(done.chatter[0], /The Ditmars Ones/);
  assert.deepEqual(huntTalk(hunt, p, "ditmars-deli", true), { ok: false, code: "not_here" });
});
