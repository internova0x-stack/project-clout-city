import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, isValidLook, lookChoices, normalizeLook, randomLook } from "../lib/look.ts";
import { STYLE_IDS } from "../lib/styles.ts";

test("old v0.1 rows (skin only) fill in the new options with defaults", () => {
  const look = normalizeLook({ skin: "#6B3E1F" }, "arcade_nerd");
  assert.equal(look.style, "arcade_nerd");
  assert.equal(look.skin, "#6B3E1F");
  assert.equal(look.hair, DEFAULT_LOOK.hair);
  assert.equal(look.covering, "none");
});

test("unknown values are dropped, never rendered", () => {
  const look = normalizeLook({ hair: "<script>", skin: "red", glasses: 3 }, "not_a_style");
  assert.deepEqual(look, DEFAULT_LOOK);
});

test("validation requires every field to be a known option", () => {
  assert.equal(isValidLook(lookChoices(DEFAULT_LOOK), "bodega_drip"), true);
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), covering: "crown" }, "bodega_drip"), false);
  assert.equal(isValidLook(lookChoices(DEFAULT_LOOK), "nope"), false);
});

test("shuffle always produces a valid look", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const l = randomLook(rand, STYLE_IDS);
    assert.equal(isValidLook(lookChoices(l), l.style), true);
  }
});

test("shuffled looks follow the city mix: white-presenting tones are the majority", async () => {
  const { SKIN_TONES, SKIN_WEIGHTS, HAIRS, HAIR_COLORS, EYE_COLORS } = await import("../lib/look.ts");
  assert.equal(SKIN_WEIGHTS.length, SKIN_TONES.length);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let light = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const l = randomLook(rand, STYLE_IDS);
    if (l.skin === SKIN_TONES[0] || l.skin === SKIN_TONES[1]) light++;
  }
  assert.ok(light / n > 0.5 && light / n < 0.56, `light share ${light / n}`);
  assert.equal(HAIRS.length, 9);
  assert.equal(HAIR_COLORS.length, 8);
  assert.equal(EYE_COLORS.length, 6);
});
