import { test } from "node:test";
import assert from "node:assert/strict";

test("v0.7: every style's starter choices include both presentations' default outfits", async () => {
  const { STARTING_STYLES, STYLE_FITS, defaultFit, isValidFit } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) {
    const o = STYLE_FITS[s.id];
    assert.equal(o.tops.length, 3, s.id);
    assert.equal(o.bottoms.length, 3, s.id);
    for (const list of [o.topColors, o.bottomColors, o.shoeColors]) assert.equal(new Set(list).size, 6, `${s.id}: six different colors`);
    for (const body of ["straight", "curvy"] as const) assert.ok(isValidFit(s.id, defaultFit(s, body)), `${s.id} ${body} default fits`);
  }
});
