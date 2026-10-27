import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, birthYears, isAdult, validBirthdate } from "../lib/age.ts";

const today = new Date(2026, 9, 27); // 27 Oct 2026, local

test("age counts from the birthday itself", () => {
  assert.equal(ageOn({ year: 2008, month: 10, day: 27 }, today), 18);
  assert.equal(ageOn({ year: 2008, month: 10, day: 28 }, today), 17);
  assert.equal(ageOn({ year: 2008, month: 11, day: 1 }, today), 17);
  assert.equal(isAdult({ year: 2008, month: 10, day: 27 }, today), true);
  assert.equal(isAdult({ year: 2008, month: 10, day: 28 }, today), false);
});

test("29 February birthdays turn over on 1 March", () => {
  assert.equal(ageOn({ year: 2008, month: 2, day: 29 }, new Date(2026, 1, 28)), 17);
  assert.equal(ageOn({ year: 2008, month: 2, day: 29 }, new Date(2026, 2, 1)), 18);
});

test("only real, past dates count", () => {
  assert.equal(validBirthdate({ year: 2001, month: 2, day: 29 }, today), false);
  assert.equal(validBirthdate({ year: 2000, month: 2, day: 29 }, today), true);
  assert.equal(validBirthdate({ year: 2000, month: 4, day: 31 }, today), false);
  assert.equal(validBirthdate({ year: 2026, month: 12, day: 1 }, today), false);
  assert.equal(validBirthdate({ year: 1890, month: 1, day: 1 }, today), false);
  assert.equal(validBirthdate({ year: 2000, month: 1 }, today), false);
  assert.equal(isAdult({ year: 1890, month: 1, day: 1 }, today), false);
});

test("the year list starts this year, so no adult year is suggested", () => {
  const years = birthYears(today);
  assert.equal(years[0], 2026);
  assert.equal(years.length, 101);
});
