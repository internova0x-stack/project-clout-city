import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, nameError } from "../lib/validation.ts";

test("collapses whitespace", () => {
  assert.equal(cleanName("  Big   Sal "), "Big Sal");
});

test("accepts ordinary names", () => {
  for (const n of ["Big Sal", "j.lo_2", "O'Neil", "Ana-Maria"]) assert.equal(nameError(n), null, n);
});

test("rejects empty, short, long and odd names", () => {
  assert.ok(nameError(""));
  assert.ok(nameError("a"));
  assert.ok(nameError("x".repeat(21)));
  assert.ok(nameError("<script>"));
  assert.ok(nameError("emoji🔥"));
});
