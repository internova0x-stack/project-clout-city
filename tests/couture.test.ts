import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CROWN_SKU, SUIT_CLOTHS, SUIT_LININGS, SUIT_SKU, cleanMonogram, optionsLine } from "../lib/couture.ts";
import { ACCESSORIES } from "../lib/accessories.ts";
import { outfitFromSkus, wearSlot } from "../lib/wearing.ts";
import { getStyle } from "../lib/styles.ts";

const sql = readFileSync("supabase/migrations/0103_couture_glow.sql", "utf8");

test("the suit's palettes are the server's (set_item_options)", () => {
  const list = (key: string) => {
    const m = sql.match(new RegExp(`o ->> '${key}', '(#[0-9A-F]{6})'\\) not in \\(([^)]*)\\)`));
    assert.ok(m, `${key} palette in 0103`);
    return { def: m[1], all: [...m[2].matchAll(/'(#[0-9A-F]{6})'/g)].map((x) => x[1]) };
  };
  const cloth = list("cloth"), lining = list("lining");
  assert.deepEqual(cloth.all, SUIT_CLOTHS.map((c) => c.hex));
  assert.deepEqual(lining.all, SUIT_LININGS.map((c) => c.hex));
  assert.equal(cloth.def, SUIT_CLOTHS[0].hex, "same default cloth");
  assert.equal(lining.def, SUIT_LININGS[0].hex, "same default lining");
});

test("monograms: up to three letters, upper case", () => {
  assert.equal(cleanMonogram(" abc "), "ABC");
  assert.equal(cleanMonogram(""), "");
  assert.equal(cleanMonogram("ABCD"), null);
  assert.equal(cleanMonogram("A1"), null);
});

test("choices reach the avatar: a tiara, the suit in its cloth and lining, the glow", () => {
  const base = getStyle("bodega_drip").outfit;
  const crowned = outfitFromSkus(base, [CROWN_SKU], { [CROWN_SKU]: { style: "tiara" } });
  assert.equal(crowned.extras?.[0].kind, "tiara");
  assert.equal(ACCESSORIES[CROWN_SKU].kind, "crown", "the table itself is untouched");
  const suit = outfitFromSkus(base, [SUIT_SKU], { [SUIT_SKU]: { cloth: "#14111A", lining: "#B3122E", monogram: "ABC" } });
  assert.equal(suit.pieces?.top?.[0].color, "#14111A");
  assert.equal(suit.pieces?.top?.[0].accent, "#B3122E");
  assert.equal(suit.pieces?.bottom?.[0].color, "#14111A");
  assert.equal(outfitFromSkus(base, ["24k-glow-ritual"]).glow, true);
  assert.equal(wearSlot("24k-glow-ritual"), "glow");
  assert.equal(optionsLine(SUIT_SKU, { cloth: "#14111A", lining: "#B3122E", monogram: "ABC" }), "Black · Crimson lining · ABC");
  assert.equal(optionsLine(CROWN_SKU, { style: "tiara" }), "Worn as a tiara");
});

test("the marina moves out until its moorings float, and the jets keep their own loops", async () => {
  const { fitMarina, mooring, onWater, jetLoop } = await import("../lib/coutureMap.ts");
  // A river: everything west of the shore line through the first mooring is water.
  const [lat0, lng0] = mooring(0).at;
  const river = [[[[lng0 - 0.02, lat0 - 0.02], [lng0 - 0.0006, lat0 - 0.02], [lng0 - 0.0006, lat0 + 0.03], [lng0 - 0.02, lat0 + 0.03], [lng0 - 0.02, lat0 - 0.02]]]] as [number, number][][][];
  assert.equal(onWater(mooring(0).at, river), false, "the shore line is land");
  const shift = fitMarina(river, 24)!;
  assert.ok(shift > 0 && shift <= 600, `moved out ${shift} m`);
  for (let n = 0; n < 24; n++) assert.ok(onWater(mooring(n, shift).at, river), `mooring ${n} floats`);
  assert.equal(fitMarina([], 24), null, "no water loaded: nothing to fit");
  assert.notDeepEqual(jetLoop(0), jetLoop(1));
});
