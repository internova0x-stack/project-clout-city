import { test } from "node:test";
import assert from "node:assert/strict";

test("v0.7: every style's starter choices include its default outfit", async () => {
  const { STARTING_STYLES, STYLE_FITS, defaultFit, isValidFit, styleColors } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) {
    const o = STYLE_FITS[s.id];
    // The basics (owner, Oct 22): a tee and pants for everyone, no free zip-up, and one color per piece.
    assert.ok(o.tops.includes("tee") && o.bottoms.includes("pants") && !(o.tops as string[]).includes("zip"), s.id);
    assert.ok(o.tops.length >= 2 && o.tops.length <= 4 && o.bottoms.length >= 2 && o.bottoms.length <= 4, s.id);
    const c = styleColors(s.id);
    assert.deepEqual([o.topColors, o.bottomColors, o.shoeColors], [[c.topColor], [c.bottomColor], [c.shoeColor]], s.id);
    for (const body of ["straight", "curvy"] as const) assert.ok(isValidFit(s.id, defaultFit(s, body)), `${s.id} ${body} default fits`);
  }
});

test("the eight looks are for everyone and each is clearly different (owner, Oct 30)", async () => {
  const { STARTING_STYLES } = await import("../lib/styles.ts");
  assert.equal(STARTING_STYLES.length, 8);
  const seen = new Set<string>();
  for (const s of STARTING_STYLES) {
    // One outfit whatever the body: no per-presentation pieces or colors.
    assert.equal(s.male, undefined, s.id);
    assert.equal(s.female, undefined, s.id);
    const o = s.outfit;
    const key = `${o.top}/${o.bottom}/${o.shoes ?? "sneakers"}/${o.accessory}`;
    assert.ok(!seen.has(key), `${s.id}: same pieces as another look`);
    seen.add(key);
    // Every look starts in a shade of blue (owner, Oct 30): the top's blue channel leads.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(o.topColor.slice(i, i + 2), 16));
    assert.ok(b > r && b >= g, `${s.id}: ${o.topColor} is blue`);
  }
});

test("starter pieces wear their look's own colors, whatever a saved fit says", async () => {
  const { STARTING_STYLES, defaultFit, starterOutfit, storedFit, styleColors } = await import("../lib/styles.ts");
  for (const s of STARTING_STYLES) for (const body of ["straight", "curvy"] as const) {
    const c = styleColors(s.id);
    const o = starterOutfit(s, body);
    assert.deepEqual([o.topColor, o.bottomColor, o.shoeColor], [c.topColor, c.bottomColor, c.shoeColor], s.id);
    const def = defaultFit(s, body);
    // A fit saved in another color keeps its pieces and wears the look's colors.
    assert.deepEqual(storedFit(s.id, { ...def, topColor: "#E8692E", shoeColor: "#E8692E" }), def, s.id);
    assert.equal(starterOutfit(s, body, { ...def, topColor: "#E8692E" }).topColor, c.topColor);
  }
});

test("the looks' signature pieces show on the new bodies", async () => {
  const { STARTING_STYLES } = await import("../lib/styles.ts");
  const { starterAccessory } = await import("../lib/accessories.ts");
  for (const s of STARTING_STYLES) {
    const a = s.outfit.accessory;
    // Headphones and the cap are headwear; everything else is a body piece.
    if (a === "none" || a === "headphones" || a === "cap") continue;
    assert.ok(starterAccessory(a, s.outfit.accessoryColor), `${s.id}: ${a}`);
  }
});
