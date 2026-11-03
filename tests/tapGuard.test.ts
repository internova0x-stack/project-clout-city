import { test } from "node:test";
import assert from "node:assert/strict";
import { guardTaps, tapsGuarded } from "../lib/tapGuard.ts";

test("after a layer closes, taps are held back for a moment, then go through again", () => {
  const t0 = performance.now();
  assert.equal(tapsGuarded(t0), false);
  guardTaps(450);
  assert.equal(tapsGuarded(performance.now() + 100), true, "the second tap of a double tap is swallowed");
  assert.equal(tapsGuarded(performance.now() + 600), false, "a deliberate tap after it works");
});

test("a tap handled late (a busy main thread) is judged by when it happened", () => {
  guardTaps(450);
  const touched = performance.now() + 200;
  assert.equal(tapsGuarded(touched), true, "touched inside the window, even if handled a second later");
  assert.equal(tapsGuarded(performance.now() - 5000), false, "a tap from before the layer closed isn't the guard's business");
});
