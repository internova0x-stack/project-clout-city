import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAREER, TRACKS, addDays, answerTask, careerView, hire, missing, refresh, rehireOn, salaryOf, startDay, startLevel, trackCards, validateCareerContent,
  type CareerContent, type CareerCtx, type CareerState,
} from "../lib/careers.ts";
import { PLACES } from "../lib/city.ts";

const content: CareerContent = JSON.parse(readFileSync(new URL("../content/careers/careers.json", import.meta.url), "utf8"));
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
const ctx = (o: Partial<CareerCtx> = {}): CareerCtx => ({
  clout: 0, crew: 0, energy: 100, atPlace: "grind-and-gossip", shiftsToday: 0, skills: {}, past: {}, ...o,
});
const DAY = "2026-11-02";

test("the task file follows its rules, and every track has a real place", () => {
  assert.deepEqual(validateCareerContent(content), []);
  for (const t of TRACKS) {
    assert.ok(PLACES.some((p) => p.id === t.place), `${t.id}: ${t.place}`);
    assert.equal(t.levels.length, 5);
    for (let i = 1; i < t.levels.length; i++) assert.ok(t.levels[i].salary > t.levels[i - 1].salary, `${t.id} pay rises`);
  }
});

test("requirements: Hospitality is open to anyone; Tech needs Smarts", () => {
  const hosp = TRACKS[0], tech = TRACKS[1];
  assert.deepEqual(missing(hosp, 1, { skills: {}, clout: 0 }), []);
  assert.deepEqual(missing(tech, 1, { skills: {}, clout: 0 }), ["Smarts 2"]);
  assert.throws(() => hire("j", "tech", ctx(), "honest", DAY), /needs/);
  assert.equal(hire("j", "tech", ctx({ skills: { smarts: 2 } }), "honest", DAY).level, 1);
});

test("the interview sets the start; name-dropping needs a crew or clout; polishing can be caught", () => {
  const honest = hire("a", "hospitality", ctx(), "honest", DAY);
  const polish = hire("b", "hospitality", ctx(), "polish", DAY);
  assert.ok(polish.trust.manager > honest.trust.manager && polish.lie && !honest.lie);
  assert.throws(() => hire("c", "hospitality", ctx(), "connection", DAY), /no_connection/);
  const conn = hire("c", "hospitality", ctx({ crew: 1 }), "connection", DAY);
  assert.ok(conn.trust.manager >= 70 && conn.trust.rival < honest.trust.rival);
});

test("coming back: one level below your best unless you were fired, and a wait before reapplying", () => {
  const hosp = TRACKS[0];
  const skills = { charisma: 6, cooking: 5 };
  assert.equal(startLevel(hosp, { skills, clout: 0, past: { hospitality: { best: 4, fired: 0, lastStatus: "quit", lastEnded: DAY } } }), 3);
  assert.equal(startLevel(hosp, { skills, clout: 0, past: { hospitality: { best: 4, fired: 1, lastStatus: "fired", lastEnded: DAY } } }), 1);
  assert.equal(rehireOn("hospitality", { past: { hospitality: { best: 1, fired: 1, lastStatus: "fired", lastEnded: DAY } } }, addDays(DAY, 3)), addDays(DAY, 7));
  assert.equal(rehireOn("hospitality", { past: { hospitality: { best: 1, fired: 0, lastStatus: "quit", lastEnded: DAY } } }, addDays(DAY, 2)), null);
});

test("a workday: at the place, once a day, never after a shift, costs Energy by pace", () => {
  const s = hire("w", "hospitality", ctx(), "honest", DAY);
  assert.throws(() => startDay(content, structuredClone(s), "steady", ctx({ atPlace: "hell-gate-park" }), DAY, Math.random), /not_here/);
  assert.throws(() => startDay(content, structuredClone(s), "steady", ctx({ shiftsToday: 1 }), DAY, Math.random), /shifted_today/);
  assert.throws(() => startDay(content, structuredClone(s), "hustle", ctx({ energy: 20 }), DAY, Math.random), /no_energy/);
  const r = startDay(content, s, "coast", ctx(), DAY, Math.random);
  assert.equal(r.effects.energy, -CAREER.styles.coast.energy);
  assert.equal(s.today!.tasks.length, 2);
  assert.throws(() => startDay(content, s, "coast", ctx(), DAY, Math.random), /worked_today/);
  const v = careerView(content, s, DAY, { skills: {}, clout: 0 });
  assert.ok(v.today && v.today.tasks.every((t) => t.options.every((o) => !("outcomes" in o))), "no hidden outcomes in the view");
  let last;
  for (const t of v.today!.tasks) last = answerTask(content, s, t.index, t.options[0].id, ctx(), Math.random);
  assert.ok(s.today!.done && s.today!.summary.length >= 2);
  assert.equal(last!.effects.energy, 10, "the staff meal");
  assert.throws(() => answerTask(content, s, 0, "x", ctx(), Math.random), /no_day/);
});

test("Tech's micromanager hands out three tasks; Media pays screen time in clout", () => {
  const t = hire("t", "tech", ctx({ skills: { smarts: 2 } }), "honest", DAY);
  startDay(content, t, "steady", ctx({ atPlace: "triborough-works" }), DAY, Math.random);
  assert.equal(t.today!.tasks.length, 3);
  const m = hire("m", "media", ctx({ skills: { gossip: 2 } }), "honest", DAY);
  startDay(content, m, "steady", ctx({ atPlace: "clout-tower" }), DAY, Math.random);
  let pay: { kind: string; amount: number }[] = [];
  for (let i = 0; i < m.today!.tasks.length; i++) pay = answerTask(content, m, i, content.tasks.find((x) => x.id === m.today!.tasks[i].id)!.options[0].id, ctx(), Math.random).payouts;
  assert.deepEqual(pay.map((p) => [p.kind, p.amount]), [["career_screen", 5]]);
});

/** Plays `weeks` weeks at a pace, answering every task with its first option. */
function play(s: CareerState, weeks: number, days: number, style: "hustle" | "steady" | "coast", c: CareerCtx, rng = Math.random) {
  let day = s.hiredOn;
  const pays: number[] = [];
  for (let w = 0; w < weeks && s.status === "employed"; w++) {
    for (let d = 0; d < 7; d++) {
      const r = refresh(s, day, c, rng);
      pays.push(...r.payouts.filter((p) => p.kind === "career_pay").map((p) => p.amount));
      if (s.status !== "employed") break;
      if (d < days) {
        startDay(content, s, style, c, day, rng);
        for (let i = 0; i < s.today!.tasks.length; i++) {
          const task = content.tasks.find((x) => x.id === s.today!.tasks[i].id)!;
          answerTask(content, s, i, task.options[0].id, c, rng);
        }
      }
      day = addDays(day, 1);
    }
  }
  pays.push(...refresh(s, day, c, rng).payouts.filter((p) => p.kind === "career_pay").map((p) => p.amount));
  return pays;
}

test("payday pays for the days worked; working hard gets raises and promotions", () => {
  const c = ctx({ skills: { charisma: 6, cooking: 5 }, clout: 2000 });
  const s = hire("p", "hospitality", c, "honest", DAY);
  const pays = play(s, 6, 5, "hustle", c, seq(0.1, 0.5, 0.9, 0.3));
  assert.equal(pays[0], 600, "a full first week at Host");
  assert.ok(s.level >= 3, `level ${s.level}`);
  assert.ok(s.log.some((l) => l.kind === "promotion"));
});

test("skipping work: a warning, then a demotion, then the sack", () => {
  const c = ctx({ skills: { charisma: 6, cooking: 5 } });
  const s = hire("f", "hospitality", c, "honest", DAY);
  s.level = 2;
  play(s, 4, 1, "coast", c, seq(0.6));
  assert.equal(s.status, "fired");
  const kinds = s.log.map((l) => l.kind).reverse();
  assert.deepEqual(kinds.filter((k) => ["warning", "demotion", "fired"].includes(k)), ["warning", "demotion", "fired"]);
});

test("a player away for weeks catches up review by review", () => {
  const s = hire("z", "hospitality", ctx(), "honest", DAY);
  const r = refresh(s, addDays(DAY, 30), { skills: {}, clout: 0 }, Math.random);
  assert.equal(s.status, "fired");
  assert.equal(r.payouts.length, 0, "no workdays, no pay");
});

test("salary rises 10% a raise; the Careers list says where each track starts", () => {
  const s = hire("r", "media", ctx({ skills: { gossip: 2 } }), "honest", DAY);
  s.raises = 2;
  assert.equal(salaryOf(s), 600);
  const cards = trackCards(ctx(), DAY);
  assert.deepEqual(cards.map((c) => c.missing.length > 0), [false, true, true]);
});
