import { test } from "node:test";
import assert from "node:assert/strict";

test("v0.7: every style's starter choices include both presentations' default outfits", async () => {
  const { STARTING_STYLES, STYLE_FITS, defaultFit, isValidFit } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) {
    const o = STYLE_FITS[s.id];
    // The basics (owner, Oct 22): a tee and pants for everyone, blue, black and white tees, black and navy pants; no free zip-up.
    assert.ok(o.tops.includes("tee") && o.bottoms.includes("pants") && !(o.tops as string[]).includes("zip"), s.id);
    assert.ok(o.tops.length >= 2 && o.tops.length <= 4 && o.bottoms.length >= 3 && o.bottoms.length <= 4, s.id);
    for (const c of ["#2F6FDB", "#26232D", "#F4F1EA"]) assert.ok(o.topColors.includes(c), `${s.id} top ${c}`);
    for (const c of ["#26232D", "#23314F"]) assert.ok(o.bottomColors.includes(c), `${s.id} bottom ${c}`);
    for (const list of [o.topColors, o.bottomColors, o.shoeColors]) assert.equal(new Set(list).size, list.length, `${s.id}: different colors`);
    assert.equal(new Set(o.shoeColors).size, 6, `${s.id}: six shoe colors`);
    for (const body of ["straight", "curvy"] as const) assert.ok(isValidFit(s.id, defaultFit(s, body)), `${s.id} ${body} default fits`);
  }
});

test("starter colors: the default is free, the basics open first, everything by 1,000 clout (owner, Oct 22)", async () => {
  const { STARTING_STYLES, STYLE_FITS, COLOR_UNLOCKS, colorUnlocks, defaultFit, fitColorsOpen } = await import("../lib/styles.ts");
  assert.ok(Math.max(...COLOR_UNLOCKS) <= 1000, "a week or two of play");
  for (const s of STARTING_STYLES) for (const body of ["straight", "curvy"] as const) {
    const def = defaultFit(s, body);
    for (const part of ["top", "bottom", "shoe"] as const) {
      const locks = colorUnlocks(s, body, part);
      const list = part === "top" ? STYLE_FITS[s.id].topColors : part === "bottom" ? STYLE_FITS[s.id].bottomColors : STYLE_FITS[s.id].shoeColors;
      assert.equal(locks.size, list.length, `${s.id} ${part}: every color has a price`);
      assert.equal([...locks.values()].filter((v) => v === 0).length, 1, `${s.id} ${part}: one free color`);
    }
    assert.equal(colorUnlocks(s, body, "top").get(def.topColor), 0);
    assert.ok(fitColorsOpen(s, body, def, 0), `${s.id}: the default fit is open to a new player`);
    if (def.topColor !== "#2F6FDB") assert.equal(colorUnlocks(s, body, "top").get("#2F6FDB"), COLOR_UNLOCKS[0], `${s.id}: blue tee first`);
    const blue = { ...def, topColor: "#2F6FDB" };
    if (def.topColor !== blue.topColor) {
      assert.equal(fitColorsOpen(s, body, blue, 0), false, "locked at 0 clout");
      assert.equal(fitColorsOpen(s, body, blue, 0, blue), true, "a color already worn stays yours");
      assert.equal(fitColorsOpen(s, body, blue, 1000), true);
    }
  }
});
