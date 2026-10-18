import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { validateExamWeek } from "../lib/exams.ts";

const dir = new URL("../content/exams/", import.meta.url);

test("every exam week file passes the Studio's rules", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "at least one exam week");
  for (const f of files) {
    const r = validateExamWeek(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
    assert.ok(r.ok, `${f}: ${r.ok ? "" : r.problems.join("; ")}`);
  }
});

test("exam weeks: broken files are refused", () => {
  assert.equal(validateExamWeek({ week: "2026-10-20", courses: {} }).ok, false, "not a Monday");
  const raw = JSON.parse(readFileSync(new URL("2026-10-19.json", dir), "utf8"));
  raw.courses["napping-301"][0].answer = 9;
  assert.equal(validateExamWeek(raw).ok, false, "answer out of range");
});

test("exam answers never reach a player's bundle: only the server and scripts import lib/exams", () => {
  const offenders: string[] = [];
  const walk = (d: URL) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(new URL(`${e.name}/`, d));
      else if (/\.tsx?$/.test(e.name) && /from "(@\/lib|\.\.?\/[^"]*)\/exams"/.test(readFileSync(new URL(e.name, d), "utf8"))) offenders.push(e.name);
    }
  };
  walk(new URL("../components/", import.meta.url));
  walk(new URL("../app/", import.meta.url));
  assert.deepEqual(offenders, []);
});
