import { test } from "node:test";
import assert from "node:assert/strict";
import { placeById } from "../lib/city.ts";
import { JOBS, TOGETHER, canDoTogether, minutesLeft, rideShare, ratingLine, togetherError, togetherVerb, withBonus } from "../lib/together.ts";

test("together activities: visits at libraries, universities and clubs only (together_action)", () => {
  assert.ok(canDoTogether(placeById("ditmars-library"), "study"));
  assert.ok(canDoTogether(placeById("discount-disco"), "visit"));
  assert.ok(!canDoTogether(placeById("triborough-works"), "gigs"));
  assert.equal(togetherVerb("ditmars-library", "study"), "study");
  assert.equal(togetherVerb("discount-disco", "visit"), "go out");
});

test("bonus and fare maths match the server", () => {
  assert.equal(TOGETHER.multiplier, 1.5);
  assert.equal(withBonus(5), 8);
  assert.equal(withBonus(10), 15);
  assert.equal(rideShare(35), 18);
  assert.equal(rideShare(6), 3);
});

test("jobs: pay choices sit inside the limits, ratings read well", () => {
  for (const p of JOBS.decorator.payChoices) assert.ok(p >= JOBS.decorator.payMin && p <= JOBS.decorator.payMax);
  for (const c of JOBS.manager.cutChoices) assert.ok(c >= JOBS.manager.cutMin && c <= JOBS.manager.cutMax);
  assert.equal(ratingLine({ hired: 12, rating: 4.8, rated: 10 }), "⭐ 4.8 · hired 12 times");
  assert.equal(ratingLine({ hired: 1, rating: null, rated: 0 }), "hired once");
  assert.equal(ratingLine(null), "New on the Jobs board");
  assert.equal(minutesLeft(new Date(Date.now() + 90_000).toISOString()), 2);
  assert.equal(minutesLeft(null), 0);
  assert.match(togetherError("ERROR: pair_limit"), /One job a day/);
});
