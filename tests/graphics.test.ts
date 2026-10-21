import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { lowGraphics, newBodies, renderQuality, weakDevice } from "../lib/graphics.ts";

test("only clearly weak phones get low graphics by themselves", () => {
  assert.equal(weakDevice({ deviceMemory: 2, hardwareConcurrency: 8 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 2 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 4 }), false, "Safari reports 4 cores on fast iPhones");
  assert.equal(weakDevice({ deviceMemory: 4, hardwareConcurrency: 8 }), false);
  assert.equal(weakDevice({}), false);
  assert.equal(weakDevice(undefined), false);
});

test("on the server (no browser) the defaults are full graphics and the current bodies", () => {
  assert.equal(lowGraphics(), false);
  assert.equal(newBodies(), false);
  assert.deepEqual(renderQuality(), { pixelRatio: 1, shadows: true, antialias: true });
});

test("every base body ships in full and low detail, and stays small", () => {
  for (const sex of ["m", "f"]) {
    for (const low of ["", "-low"]) {
      const p = `public/avatars/body/${sex}${low}.glb`;
      assert.ok(existsSync(p), p);
      assert.ok(statSync(p).size < (low ? 450_000 : 700_000), `${p} is ${statSync(p).size} bytes`);
    }
  }
});
