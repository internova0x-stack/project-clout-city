import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAREER, CareerError, hire, refresh, startDay, careerView, salaryOf, type CareerContent } from "../lib/careers.ts";

// A school race makes the job part-time (owner, Nov 4: "build it"; docs/SCHOOL-RACE.md): CAREER.partTime.days workdays a
// week, paid for the days worked, and a review judged against them, not the full week.

const content: CareerContent = JSON.parse(readFileSync(new URL("../content/careers/careers.json", import.meta.url), "utf8"));
const ctx = { clout: 500, crew: 1, energy: 200, atPlace: "grind-and-gossip", shiftsToday: 0, skills: { charisma: 4, cooking: 3 }, past: {}, partTime: true };
const days = ["2026-11-03", "2026-11-04", "2026-11-05"];

test("part-time: two workdays a week, then the door is shut until next week", () => {
  const s = hire("p", "hospitality", ctx, "honest", "2026-11-02");
  for (const d of days.slice(0, CAREER.partTime.days)) { startDay(content, s, "steady", ctx, d, () => 0.5); s.today!.done = true; }
  assert.equal(careerView(content, s, days[2], ctx).canWork, false);
  assert.deepEqual(careerView(content, s, days[2], ctx).partTime, { days: CAREER.partTime.days, left: 0 });
  assert.throws(() => startDay(content, s, "steady", ctx, days[2], () => 0.5), (e) => e instanceof CareerError && e.code === "part_time_full");
  // Full-time, the same week would allow a third day.
  assert.equal(careerView(content, s, days[2], { ...ctx, partTime: false }).canWork, true);
});

test("part-time payday: the days worked, no warning for a part-time week", () => {
  const s = hire("q", "hospitality", ctx, "honest", "2026-11-02");
  s.performance = 60;
  for (const d of days.slice(0, CAREER.partTime.days)) { startDay(content, s, "steady", ctx, d, () => 0.5); s.today!.done = true; }
  const salary = salaryOf(s);
  const r = refresh(s, s.nextReview, ctx, () => 0.5);
  const wage = r.payouts.find((p) => p.ref.includes(":pay:"));
  assert.equal(wage?.amount, Math.round((salary * CAREER.partTime.days) / CAREER.expectedDays));
  assert.equal(s.warnings, 0, "two days is a full part-time week");
  assert.match(s.review!.lines.join(" "), /Part-time/);
});
