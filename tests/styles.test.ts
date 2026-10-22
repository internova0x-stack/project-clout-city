import { test } from "node:test";
import assert from "node:assert/strict";

test("v0.7: every style's starter choices include both presentations' default outfits", async () => {
  const { STARTING_STYLES, STYLE_FITS, defaultFit, isValidFit } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) {
    const o = STYLE_FITS[s.id];
    // The basics (owner, Oct 22): a tee and pants for everyone, no free zip-up, and one color per piece.
    assert.ok(o.tops.includes("tee") && o.bottoms.includes("pants") && !(o.tops as string[]).includes("zip"), s.id);
    assert.ok(o.tops.length >= 2 && o.tops.length <= 4 && o.bottoms.length >= 3 && o.bottoms.length <= 4, s.id);
    assert.deepEqual([o.topColors, o.bottomColors, o.shoeColors], [["#8E8C94"], ["#26232D"], ["#F4F1EA"]], `${s.id}: grey, black, white`);
    for (const body of ["straight", "curvy"] as const) assert.ok(isValidFit(s.id, defaultFit(s, body)), `${s.id} ${body} default fits`);
  }
});

test("starter pieces come in one color each: grey tops, black bottoms, white shoes (owner, Oct 22)", async () => {
  const { STARTING_STYLES, STARTER_COLORS, defaultFit, starterOutfit, storedFit } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) for (const body of ["straight", "curvy"] as const) {
    const o = starterOutfit(s, body);
    assert.deepEqual([o.topColor, o.bottomColor, o.shoeColor], [STARTER_COLORS.topColor, STARTER_COLORS.bottomColor, STARTER_COLORS.shoeColor], s.id);
    const def = defaultFit(s, body);
    // A fit saved in another color keeps its pieces and wears the starter colors.
    assert.deepEqual(storedFit(s.id, { ...def, topColor: "#2F6FDB", shoeColor: "#E8692E" }), def, s.id);
    assert.equal(starterOutfit(s, body, { ...def, topColor: "#2F6FDB" }).topColor, STARTER_COLORS.topColor);
  }
});
