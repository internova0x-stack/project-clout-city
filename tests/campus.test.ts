import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CAMPUSES, COURSES, CAMPUS, coursePercent, examOpen, gpa, gradeFor, menuFor, roommateNote } from "../lib/campus.ts";

test("grades: attendance and the quiz count half each", () => {
  assert.equal(coursePercent(4, 5), 100);
  assert.equal(coursePercent(7, 5), 100, "attendance is capped");
  assert.equal(coursePercent(0, 5), 50);
  assert.equal(coursePercent(2, 3), 55);
  assert.equal(gradeFor(100).letter, "A");
  assert.equal(gradeFor(85).letter, "B");
  assert.equal(gradeFor(55).letter, "F");
});

test("GPA averages grade points", () => {
  assert.equal(gpa(["A", "A", "B"]), 3.67);
  assert.equal(gpa([]), null);
  assert.ok(gpa(["A", "B", "A"])! >= CAMPUS.scholarship.gpa);
});

test("exams open Friday to Sunday", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(examOpen), [false, false, false, false, true, true, true]);
});

test("catalog: unique courses, enough to pick from, two campuses with dorms", () => {
  assert.equal(new Set(COURSES.map((c) => c.id)).size, COURSES.length);
  assert.ok(COURSES.length >= CAMPUS.coursesPerWeek * 2);
  assert.deepEqual(CAMPUSES.map((c) => c.id), ["st-johnsons", "queensborough-u"]);
});

test("the menu follows the weekday and the roommate leaves a note every day", () => {
  assert.match(menuFor("2026-10-19"), /^Mystery Meat Monday/);
  assert.match(menuFor("2026-10-25"), /^Leftover Sunday/);
  assert.notEqual(roommateNote("2026-10-19"), roommateNote("2026-10-20"));
});

test("the database's campus settings match lib/campus.ts", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  let seed: Record<string, unknown> | null = null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().reverse()) {
    const m = readFileSync(new URL(f, dir), "utf8").match(/values \('campus', '(\{[^']*)'::jsonb\)/);
    if (m) { seed = JSON.parse(m[1]); break; }
  }
  assert.ok(seed, "no campus seed");
  const { campuses, courses, ...rest } = seed as { campuses: string[]; courses: string[] };
  assert.deepEqual(rest, CAMPUS);
  assert.deepEqual(campuses, CAMPUSES.map((c) => c.id));
  assert.deepEqual(courses, COURSES.map((c) => c.id));
});
