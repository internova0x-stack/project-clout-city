import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CareerError, addDays, hire, leaveTransition, refresh, startDay, careerView, type CareerContent } from "../lib/careers.ts";

// A campaign is a full-time job (owner, Nov 4: "put the job on leave"): while it runs the career job pauses, and it
// comes back at the same level with the same people when the campaign ends.

const content: CareerContent = JSON.parse(readFileSync(new URL("../content/careers/careers.json", import.meta.url), "utf8"));
const ctx = { clout: 500, crew: 1, energy: 90, atPlace: "grind-and-gossip", shiftsToday: 0, skills: { charisma: 4, cooking: 3 }, past: {} };

test("on leave: no workdays, no reviews or pay however long the campaign runs; back: a fresh week, same level and people", () => {
  const s = hire("j", "hospitality", ctx, "honest", "2026-11-02");
  s.trust.manager = 77;
  assert.equal(leaveTransition(s, { candidate: "Kaylee" }, "2026-11-03"), "left");
  assert.equal(leaveTransition(s, { candidate: "Kaylee" }, "2026-11-04"), null, "already on leave");
  assert.throws(() => startDay(content, s, "steady", { ...ctx, onLeave: { candidate: "Kaylee" } }, "2026-11-04", Math.random), (e) => e instanceof CareerError && e.code === "on_leave");
  // Three weeks later, nothing happened: no warnings, no firing, no payday.
  const r = refresh(s, addDays("2026-11-03", 21), ctx, () => 0.5);
  assert.equal(r.payouts.length, 0);
  assert.equal(s.status, "employed");
  assert.equal(s.warnings, 0);
  const v = careerView(content, s, "2026-11-10", ctx);
  assert.equal(v.leave?.candidate, "Kaylee");
  assert.equal(v.canWork, false);
  // The campaign ends: back at work with a full week before the next review.
  const back = "2026-11-24";
  assert.equal(leaveTransition(s, null, back), "back");
  assert.equal(s.leave, undefined);
  assert.equal(s.nextReview, addDays(back, 7));
  assert.equal(s.level, 1);
  assert.equal(s.trust.manager, 77);
  assert.equal(s.worked.length, 0);
  assert.equal(refresh(s, back, ctx, () => 0.5).payouts.length, 0, "no review on the day you come back");
});

test("City Hall staff get the line about running against their own boss", () => {
  const s = hire("c", "cityhall", { ...ctx, skills: { charisma: 6, smarts: 6 } }, "honest", "2026-11-02");
  leaveTransition(s, { candidate: "Goldcrest" }, "2026-11-03");
  assert.match(s.log[0].text, /against your own boss/);
});
