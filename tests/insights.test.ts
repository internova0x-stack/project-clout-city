import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, share } from "../lib/insights.ts";

test("duration reads seconds as the Studio shows them", () => {
  assert.equal(duration(38), "38s");
  assert.equal(duration(252), "4m 12s");
  assert.equal(duration(3900), "1h 5m");
  assert.equal(duration(-5), "0s");
});

test("share rounds, shows <1% for a few and a dash for nobody", () => {
  assert.equal(share(38, 100), "38%");
  assert.equal(share(2, 2140), "<1%");
  assert.equal(share(0, 2140), "0%");
  assert.equal(share(3, 0), "–");
});
