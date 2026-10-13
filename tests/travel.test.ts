import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_LOCATIONS, placeById } from "../lib/city.ts";
import { distanceBand, milesBetween, travelQuote } from "../lib/travel.ts";

test("bands follow the owner's table (Oct 13)", () => {
  assert.deepEqual([0.2, 1.4, 3, 8].map(distanceBand), [0, 1, 2, 3]);
  assert.deepEqual([0.2, 1.4, 3, 8].map((m) => travelQuote("taxi", m, false).fare), [8, 16, 28, 45]);
  assert.deepEqual([0.2, 1.4, 3].map((m) => travelQuote("walk", m, false).energy), [5, 10, 20]);
  assert.equal(travelQuote("walk", 8, false).unavailable, "Too far to walk");
  assert.equal(travelQuote("subway", 8, false).fare, 3);
  assert.equal(travelQuote("car", 3, false).unavailable !== undefined, true);
  assert.equal(travelQuote("car", 3, true).fare, 0);
});

test("trips are short: 3 to 10 seconds", () => {
  for (const m of [0.2, 1.4, 3, 8]) for (const mode of ["walk", "subway", "taxi", "car"] as const) {
    const q = travelQuote(mode, m, true);
    if (!q.unavailable) assert.ok(q.seconds >= 3 && q.seconds <= 10, `${mode} at ${m} mi`);
  }
});

test("miles are real distances", () => {
  const home = HOME_LOCATIONS.astoria_studio;
  const d = milesBetween(home, placeById("hell-gate-park")!.at);
  assert.ok(d > 0.1 && d < 3, `Astoria studio to Hell Gate Park: ${d}`);
  assert.equal(milesBetween(home, home), 0);
});
