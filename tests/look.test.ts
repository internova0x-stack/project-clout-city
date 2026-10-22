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

test("v0.7: body types per presentation; older rows keep their shape and Bodega Drip keeps its cap", () => {
  const male = normalizeLook({ body: "straight", covering: "none" }, "bodega_drip");
  assert.equal(male.build, "athletic");
  assert.equal(male.covering, "cap", "the old outfit cap becomes headwear");
  const female = normalizeLook({ body: "curvy", covering: "none" }, "arcade_nerd");
  assert.equal(female.build, "curvy");
  assert.equal(female.covering, "none");
  // A v0.7 row that chose no headwear stays bare, even for Bodega Drip.
  assert.equal(normalizeLook({ body: "straight", build: "slim", covering: "none" }, "bodega_drip").covering, "none");
  // Builds belong to their presentation.
  assert.equal(normalizeLook({ body: "straight", build: "petite" }, "arcade_nerd").build, "athletic");
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), build: "curvy" }, "bodega_drip"), false);
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), covering: "cap" }, "bodega_drip"), true);
  // One free basic hat, and no hijab (owner, Oct 22): a saved fedora, bucket hat or hijab reads as no headwear.
  for (const gone of ["fedora", "bucket", "hijab"]) {
    assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), covering: gone }, "bodega_drip"), false, gone);
    assert.equal(normalizeLook({ body: "straight", build: "slim", covering: gone }, "bodega_drip").covering, "none", gone);
  }
});

test("v0.7: a starter fit must use its style's garments; its colors are the starter ones (owner, Oct 22)", () => {
  const fit = { top: "hoodie", topColor: "#8E8C94", bottom: "shorts", bottomColor: "#26232D", shoeColor: "#F4F1EA" };
  assert.deepEqual(normalizeLook({ fit }, "bodega_drip").fit, fit);
  assert.equal(normalizeLook({ fit: { ...fit, top: "blazer" } }, "bodega_drip").fit, null, "not a Bodega Drip top");
  assert.deepEqual(normalizeLook({ fit: { ...fit, topColor: "#2F6FDB" } }, "bodega_drip").fit, fit, "an old color reads as the starter one");
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), fit }, "bodega_drip"), true);
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), fit: { ...fit, topColor: "#2F6FDB" } }, "bodega_drip"), false, "no other colors at sign-up");
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), fit: { ...fit, bottom: "gown" } }, "bodega_drip"), false);
});

test("the New Yorker type: optional, kept when known, refused when not", () => {
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), nyer: "transplant" }, "bodega_drip"), true);
  assert.equal(isValidLook({ ...lookChoices(DEFAULT_LOOK), nyer: "tourist" }, "bodega_drip"), false);
  assert.equal(normalizeLook({ ...lookChoices(DEFAULT_LOOK), nyer: "native" }, "bodega_drip").nyer, "native");
  assert.equal(normalizeLook({ ...lookChoices(DEFAULT_LOOK), nyer: "tourist" }, "bodega_drip").nyer, undefined);
});
