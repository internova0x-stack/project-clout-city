import assert from "node:assert/strict";
import { test } from "node:test";
import { nextWeekday, parseArcs, studioError, weekdayOf } from "../lib/studio.ts";

test("next Sunday on or after a date", () => {
  assert.equal(nextWeekday("2026-10-12"), "2026-10-18"); // Monday → Sunday
  assert.equal(nextWeekday("2026-10-18"), "2026-10-18"); // already Sunday
  assert.equal(nextWeekday("2026-10-12", "friday"), "2026-10-16");
  assert.equal(weekdayOf("2026-10-18"), "sunday");
});

test("story files: one arc or a list, never anything else", () => {
  assert.ok("arcs" in parseArcs('{"id":"a","beats":[]}'));
  const two = parseArcs('[{"id":"a","beats":[]},{"id":"b","beats":[]}]');
  assert.ok("arcs" in two && two.arcs.length === 2);
  assert.deepEqual(parseArcs("{nope"), { error: "That isn't valid JSON." });
  assert.ok("error" in parseArcs('{"title":"no id"}'));
  assert.ok("error" in parseArcs("[]"));
});

test("SQL error codes read as plain sentences", () => {
  assert.match(studioError('wrong_weekday'), /weekday/);
  assert.match(studioError("ERROR: finale_collision"), /finale/);
  assert.equal(studioError("something else"), "The Studio glitched. Try again.");
});
