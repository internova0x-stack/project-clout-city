import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_REASONS, chatError, chatTime } from "../lib/chat.ts";

test("chat errors read as plain sentences", () => {
  assert.match(chatError("daily_limit"), /10 for today/);
  assert.match(chatError("ERROR: blocked"), /can't message/);
  assert.equal(chatError("nope"), "Messages glitched. Try again.");
});

test("report reasons match the database check", () => {
  assert.deepEqual(REPORT_REASONS.map((r) => r.id), ["harassment", "spam", "inappropriate", "other"]);
});

test("message times: clock today, weekday this week, date before", () => {
  const now = Date.parse("2026-10-14T18:00:00");
  assert.match(chatTime("2026-10-14T09:05:00", now), /9:05/);
  assert.equal(chatTime("2026-10-12T09:05:00", now), "Mon");
  assert.equal(chatTime("2026-09-30T09:05:00", now), "Sep 30");
});
