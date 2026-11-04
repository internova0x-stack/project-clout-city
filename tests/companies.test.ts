import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPANIES, COMPANY, companyHeadline, companyLevel, companyRules, companyView, newCompany, progressOf, rollCompany, staffShare, weekOf, workdayShare,
} from "../lib/companies.ts";
import { TRACKS } from "../lib/careers.ts";

// Company health (migration 0161; owner, Nov 4): every employer has a situation and a weekly target; one shared health.

const WED = Date.parse("2026-11-04T15:00:00Z"); // a Wednesday in New York

test("every career track has exactly one company, with its words in place", () => {
  assert.deepEqual(COMPANIES.map((c) => c.track).sort(), TRACKS.map((t) => t.id).sort());
  for (const c of COMPANIES) {
    for (const k of ["situation", "good", "bad", "up", "down", "unit", "boss"] as const) assert.ok(c[k].length > 2, `${c.track}.${k}`);
    assert.ok(c.target > 0);
  }
});

test("weeks start on Monday, New York time", () => {
  assert.equal(weekOf(WED), "2026-11-02");
  assert.equal(weekOf(Date.parse("2026-11-09T03:00:00Z")), "2026-11-02", "Sunday 10 PM in New York is still last week");
  assert.equal(weekOf(Date.parse("2026-11-09T06:00:00Z")), "2026-11-09");
});

test("the staff's share is the same everywhere for a company and week, and healthier companies do a little better", () => {
  assert.equal(staffShare("tech", "2026-11-02", 50), staffShare("tech", "2026-11-02", 50));
  assert.ok(staffShare("tech", "2026-11-02", 90) > staffShare("tech", "2026-11-02", 20));
  for (const c of COMPANIES) for (let w = 0; w < 30; w++) {
    const s = staffShare(c.track, `2026-${String(1 + (w % 12)).padStart(2, "0")}-0${1 + (w % 7)}`, 50);
    assert.ok(s >= COMPANY.staff.min && s <= COMPANY.staff.max + 1e-9);
  }
});

test("a week that ends rolls over: target hit raises health, a miss lowers it, and nothing is counted twice", () => {
  const def = COMPANIES.find((c) => c.track === "tech")!;
  const s = newCompany(def, Date.parse("2026-10-27T15:00:00Z")); // last week
  s.contrib = s.target * 2; // players carried it
  const hit = rollCompany(def, s, WED);
  assert.equal(hit.state.week, "2026-11-02");
  assert.equal(hit.state.health, COMPANY.start + COMPANY.hit + COMPANY.bigHit);
  assert.equal(hit.state.contrib, 0);
  assert.equal(hit.state.history.at(-1)!.hit, true);
  assert.deepEqual(rollCompany(def, hit.state, WED).state, hit.state, "rolling again this week changes nothing");
  // Three weeks nobody looked: three misses (the staff alone can fall short).
  let m = newCompany(def, Date.parse("2026-10-13T15:00:00Z"));
  m.health = 40;
  m = rollCompany(def, m, WED).state;
  assert.equal(m.history.length, 3);
  assert.ok(m.health >= 5 && m.health <= 95);
});

test("health crossing a level makes the news; staying put does not", () => {
  const def = COMPANIES[0];
  assert.match(companyHeadline(def, { from: "medium", to: "high" })!, /📈/);
  assert.match(companyHeadline(def, { from: "medium", to: "low" })!, /📉/);
  assert.match(companyHeadline(def, { from: "low", to: "medium" })!, /back on its feet/);
  assert.equal(companyHeadline(def, { from: "high", to: "medium" }), null);
});

test("thriving pays a bonus; struggling freezes raises; under 20 freezes promotions; never anything else", () => {
  assert.deepEqual(companyRules(80), { bonus: 0.1, raisesFrozen: false, promotionsFrozen: false, workMood: COMPANY.moodHigh });
  assert.deepEqual(companyRules(50), { bonus: 0, raisesFrozen: false, promotionsFrozen: false, workMood: 0 });
  assert.deepEqual(companyRules(30), { bonus: 0, raisesFrozen: true, promotionsFrozen: false, workMood: COMPANY.moodLow });
  assert.equal(companyRules(15).promotionsFrozen, true);
  assert.equal(companyLevel(COMPANY.levels.high), "high");
  assert.equal(companyLevel(COMPANY.levels.low - 1), "low");
});

test("a workday's part: hustle with good tasks is the most, and never more than perWorkday", () => {
  assert.equal(workdayShare("hustle", 3), COMPANY.perWorkday);
  assert.ok(workdayShare("steady", 3) < workdayShare("hustle", 3));
  assert.ok(workdayShare("coast", -2) < workdayShare("coast", 2));
  const def = COMPANIES.find((c) => c.track === "hospitality")!;
  const s = newCompany(def, WED);
  const before = progressOf(s, WED);
  s.contrib += workdayShare("hustle", 3) * s.target;
  assert.ok(progressOf(s, WED) > before);
  const v = companyView(def, s, WED);
  assert.equal(v.level, "medium");
  assert.ok(v.daysLeft >= 0 && v.daysLeft <= 6);
});

test("the review reads the company: a bonus when thriving, raises and promotions held when struggling", async () => {
  const { hire, refresh } = await import("../lib/careers.ts");
  const base = { clout: 5000, crew: 1, energy: 80, atPlace: null, shiftsToday: 0, skills: { charisma: 9, cooking: 9 }, past: {} };
  const run = (health: number) => {
    const s = hire("t", "hospitality", base, "honest", "2026-11-02");
    s.performance = 90; s.trust.manager = 90; s.reviewsAtLevel = 5; s.worked = ["a", "b", "c", "d", "e"];
    refresh(s, s.nextReview, { ...base, company: { health, target: 1200, unit: "covers", boss: "Despina" } }, () => 0.5);
    return s;
  };
  const rich = run(80);
  assert.ok(rich.review!.lines.some((l) => /thriving: a C\$\d/.test(l)), "bonus line");
  assert.equal(rich.review!.outcome, "promotion");
  const frozen = run(15);
  assert.ok(frozen.review!.lines.some((l) => /hiring freeze/.test(l)));
  assert.equal(frozen.level, 1, "no promotion during a hiring freeze");
});
