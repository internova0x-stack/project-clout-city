import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { FACTS, OFFICE_FACT } from "../lib/memory.ts";

// Every key a writer can produce is in lib/memory.ts's list, and every listed key has a writer.
const sql = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f >= "0138")
  .map((f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")).join("\n");
const code = ["../app/home/careerActions.ts", "../lib/memory.ts"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");

const written = new Set<string>();
// fact_note(…, 'a.b' …) and CASE … then 'a.b' in the triggers.
for (const m of sql.matchAll(/'([a-z]+\.[a-z_]+)'/g)) written.add(m[1]);
// 'career.' || new.status (fired, quit).
for (const s of ["fired", "quit"]) written.add(`career.${s}`);
// The careers server: { key: "a.b" } and OFFICE_FACT.
for (const m of code.matchAll(/key: "([a-z]+\.[a-z_]+)"/g)) written.add(m[1]);
for (const k of Object.values(OFFICE_FACT)) written.add(k);

test("every fact a writer can produce is listed (lib/memory.ts FACTS)", () => {
  const listed = new Set(Object.keys(FACTS));
  const unlisted = [...written].filter((k) => !listed.has(k) && !/^(public|new|old|f|t)\./.test(k));
  assert.deepEqual(unlisted, []);
});

test("every listed fact has a writer", () => {
  const orphans = Object.keys(FACTS).filter((k) => !written.has(k));
  assert.deepEqual(orphans, []);
});

test("keys are namespace.name and say what they mean", () => {
  for (const [k, d] of Object.entries(FACTS)) {
    assert.match(k, /^[a-z]+\.[a-z_]+$/);
    assert.ok(d.means.length > 5, k);
  }
});
