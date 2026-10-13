import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, handle, nameError } from "../lib/validation.ts";

test("trims and drops a leading @", () => {
  assert.equal(cleanName("  @big_sal "), "big_sal");
});

test("accepts usernames", () => {
  for (const n of ["bigsal", "j.lo_2", "@Big_Sal", "x.y.z"]) assert.equal(nameError(n), null, n);
});

test("rejects empty, short, long, spaced and odd usernames", () => {
  assert.ok(nameError(""));
  assert.ok(nameError("ab"));
  assert.ok(nameError("x".repeat(21)));
  assert.match(nameError("Big Sal")!, /No spaces/);
  assert.ok(nameError("O'Neil"));
  assert.ok(nameError("<script>"));
  assert.ok(nameError("emoji🔥"));
});

test("usernames show as @handles; older names with spaces show as they are", () => {
  assert.equal(handle("bigsal"), "@bigsal");
  assert.equal(handle("Big Sal"), "Big Sal");
  assert.equal(handle(""), "");
});
