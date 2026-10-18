import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE_LABEL, applyBeatText, beatText, nextWeekday, parseArcs, storyStage, studioError, weekdayOf } from "../lib/studio.ts";
import type { Beat } from "../lib/stories.ts";

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

test("beat edits change the words only (owner, Oct 17)", () => {
  const beat: Beat = {
    id: "b-2", day: 3, status: "active", effects: [{ type: "flag", set: "x" }],
    news: [{ headline: "Old", body: "Old body", previously: null }],
    evidence: { title: "Receipt", kind: "document", lines: ["one", "two"] },
    prediction: { id: "P1", question: "Who?", options: [{ id: "a", label: "Ann" }, { id: "b", label: "Bo" }], closes_at: { day: 3, time: "21:00" },
      reveal_beat: "b-5", correct: "b", reward: { clout: 50 }, roasts: { a: "Nope." } },
  };
  const t = beatText(beat);
  t.news[0].headline = "  New  ";
  t.news[0].body = "";
  t.evidence!.lines = ["one", "", "three"];
  t.prediction!.options[1].label = "Bobby";
  t.prediction!.roasts!.a = "Not even close.";
  const r = applyBeatText(beat, t);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.beat.news[0].headline, "New");
  assert.equal(r.beat.news[0].body, undefined, "empty text is dropped");
  assert.deepEqual(r.beat.evidence, { title: "Receipt", kind: "document", lines: ["one", "three"] });
  assert.equal(r.beat.prediction!.options[1].label, "Bobby");
  assert.equal(r.beat.prediction!.correct, "b", "the answer stays");
  assert.equal(r.beat.prediction!.roasts!.a, "Not even close.");
  assert.deepEqual([r.beat.id, r.beat.day, r.beat.effects], [beat.id, beat.day, beat.effects], "id, day and effects stay");
  assert.deepEqual(beat.news[0].headline, "Old", "the original isn't touched");
  // The shape can't change.
  assert.equal(applyBeatText(beat, { ...t, news: [] }).ok, false);
  assert.equal(applyBeatText(beat, { ...t, news: [{ headline: " " }] }).ok, false);
  assert.equal(applyBeatText(beat, { ...t, prediction: { ...t.prediction!, options: [{ id: "a", label: "Ann" }] } }).ok, false, "every option keeps a label");
});

test("story stage: one word for where a story stands, approval alone isn't live", () => {
  const base = { type: "main" as const, status: "active" as const, review: "approved" as const, startAt: null as string | null, day: null as number | null, lastDay: 10 };
  assert.equal(storyStage({ ...base, review: "draft" }), "review");
  assert.equal(storyStage({ ...base, review: "declined" }), "declined");
  assert.equal(storyStage(base), "ready", "approved without a Day 1 is not live");
  assert.equal(storyStage({ ...base, startAt: "2026-10-25" }), "scheduled");
  assert.equal(storyStage({ ...base, startAt: "2026-10-18", day: 1 }), "live");
  assert.equal(storyStage({ ...base, startAt: "2026-10-01", day: 11 }), "finished");
  assert.equal(storyStage({ ...base, status: "paused", day: null, startAt: "2026-10-18" }), "paused");
  assert.equal(storyStage({ ...base, status: "retired" }), "retired");
  const main = { ...base, startAt: "2026-10-25" };
  assert.equal(storyStage({ ...base, type: "side" }, main), "scheduled", "a side story waits on its main's date");
  assert.equal(storyStage({ ...base, type: "side" }, { ...main, startAt: null }), "ready");
  assert.equal(storyStage({ ...base, type: "side", review: "draft" }, main), "review");
  assert.equal(STAGE_LABEL.ready, "Not live");
});
