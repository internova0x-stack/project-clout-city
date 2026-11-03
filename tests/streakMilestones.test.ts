import { test } from "node:test";
import assert from "node:assert/strict";
import { isStreakMilestone, milestoneName, milestoneSize } from "../lib/streakMilestones.ts";

test("milestones: 3, the weekly rewards, then round numbers", () => {
  const hits = Array.from({ length: 800 }, (_, i) => i).filter(isStreakMilestone);
  assert.deepEqual(hits.slice(0, 13), [3, 7, 14, 21, 28, 30, 35, 50, 75, 100, 150, 200, 250]);
  assert.ok(hits.includes(365) && hits.includes(400) && hits.includes(700));
  assert.ok(!isStreakMilestone(42) && !isStreakMilestone(2) && !isStreakMilestone(366));
});

test("names and sizes", () => {
  assert.equal(milestoneName(7), "1 week");
  assert.equal(milestoneName(21), "3 weeks");
  assert.equal(milestoneName(30), "1 month");
  assert.equal(milestoneName(100), "100 days");
  assert.equal(milestoneName(365), "1 year");
  assert.equal(milestoneSize(7), "small");
  assert.equal(milestoneSize(100), "big");
});
