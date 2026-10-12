import { test } from "node:test";
import assert from "node:assert/strict";
import { cityMinutes, formatCityTime, isCityDaytime, msUntilNextCityMinute } from "../lib/cityClock.ts";

const cfg = { realHoursPerCityDay: 2, dayStartsAt: 6, nightStartsAt: 19 };
const HOUR = 60 * 60 * 1000;

test("one city day passes every two real hours", () => {
  assert.equal(cityMinutes(0, cfg), 0);
  assert.equal(cityMinutes(HOUR, cfg), 720); // noon
  assert.equal(cityMinutes(2 * HOUR, cfg), 0); // wraps to midnight
});

test("formats time only, 12-hour clock", () => {
  assert.equal(formatCityTime(0), "12:00 AM");
  assert.equal(formatCityTime(720), "12:00 PM");
  assert.equal(formatCityTime(21 * 60 + 41), "9:41 PM");
});

test("day and night boundaries", () => {
  assert.equal(isCityDaytime(5 * 60 + 59, cfg), false);
  assert.equal(isCityDaytime(6 * 60, cfg), true);
  assert.equal(isCityDaytime(18 * 60 + 59, cfg), true);
  assert.equal(isCityDaytime(19 * 60, cfg), false);
});

test("next tick lands on the next city minute (5 real seconds each)", () => {
  assert.equal(msUntilNextCityMinute(0, cfg), 5000);
  assert.equal(msUntilNextCityMinute(4000, cfg), 1000);
});
