import { test } from "node:test";
import assert from "node:assert/strict";
import { doorsLine, eventTimeLine, localDate, nextNyMonday, nyMidnight, nyMidnightLine, sameAsNewYork } from "../lib/localTime.ts";

// Friday Oct 16, 2026, 9:00 PM in New York (EDT, UTC-4).
const party = "2026-10-17T01:00:00Z";

test("event times: your time first, New York's beside it (#18)", () => {
  assert.equal(eventTimeLine(party, "America/New_York"), "Fri 9:00 PM");
  assert.equal(eventTimeLine(party, "America/Los_Angeles"), "Fri 6:00 PM your time · 9:00 PM in New York");
  assert.equal(eventTimeLine(party, "Europe/London"), "Sat 2:00 AM your time · Fri 9:00 PM in New York");
  assert.equal(sameAsNewYork(party, "America/Toronto"), true, "same clock, no second time");
});

test("doors count down in hours and minutes, then show the day", () => {
  const at = (mins: number) => Date.parse(party) - mins * 60_000;
  assert.equal(doorsLine(party, at(45), "America/Los_Angeles"), "Doors open in 45 min");
  assert.equal(doorsLine(party, at(135), "America/Los_Angeles"), "Doors open in 2 h 15 min (6:00 PM your time)");
  assert.equal(doorsLine(party, at(120), "America/New_York"), "Doors open in 2 h (9:00 PM)");
  assert.equal(doorsLine(party, at(3 * 24 * 60), "America/Los_Angeles"), "Doors open Fri 6:00 PM your time");
  assert.equal(localDate(party, "Asia/Tokyo"), "Oct 17");
});

test("New York midnight, across daylight saving, in the player's time", () => {
  assert.equal(new Date(nyMidnight("2026-10-19")).toISOString(), "2026-10-19T04:00:00.000Z");
  assert.equal(new Date(nyMidnight("2026-11-09")).toISOString(), "2026-11-09T05:00:00.000Z");
  assert.equal(nyMidnightLine("2026-10-19", "America/New_York"), "Monday at midnight");
  assert.equal(nyMidnightLine("2026-10-19", "America/Los_Angeles"), "Sunday 9:00 PM your time");
  assert.equal(nextNyMonday(Date.parse("2026-10-13T15:00:00Z")), "2026-10-19");
  assert.equal(nextNyMonday(Date.parse("2026-10-19T15:00:00Z")), "2026-10-26", "on a Monday, the next one");
});
