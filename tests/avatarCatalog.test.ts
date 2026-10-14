import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  BOTTOM_MODEL, FACE, FEET_MODEL, MODEL_FILES, MODEL_HAIR, OUTFIT_SETS, TOP_MODEL, modelParts, outfitSet,
  type ModelSex, type PartRef,
} from "../lib/avatarCatalog.ts";
import { SHOP_ITEMS } from "../lib/city.ts";
import { DEFAULT_LOOK } from "../lib/look.ts";

const glb = (r: PartRef) => new URL(`../public/avatars/${r.sex}/${r.file}.glb`, import.meta.url);
const SEXES: ModelSex[] = ["m", "f"];

test("every piece the avatar can wear has a model file", () => {
  const refs: PartRef[] = [
    ...SEXES.map((sex) => ({ sex, file: FACE[sex] })),
    ...Object.values(TOP_MODEL).flatMap((x) => SEXES.map((s) => x[s])),
    ...Object.values(BOTTOM_MODEL).flatMap((x) => SEXES.map((s) => x[s])),
    ...Object.values(FEET_MODEL).flatMap((x) => SEXES.map((s) => x[s])),
    ...SEXES.flatMap((s) => Object.values(MODEL_HAIR[s]).filter((r): r is PartRef => !!r)),
    ...OUTFIT_SETS.flatMap((o) => SEXES.map((s) => o[s].ref)),
  ];
  for (const r of refs) {
    assert.ok(MODEL_FILES[r.sex].includes(r.file), `${r.sex}/${r.file} is a known file`);
    assert.ok(existsSync(glb(r)), `${r.sex}/${r.file}.glb exists`);
  }
  for (const s of SEXES) assert.ok(existsSync(new URL(`../public/avatars/${s}/_anims.glb`, import.meta.url)), `${s} animations`);
});

test("Shop outfits name a known set; fantasy ones need the owner's clout tiers", () => {
  const outfits = SHOP_ITEMS.filter((i) => i.wear?.slot === "outfit");
  assert.equal(outfits.length, OUTFIT_SETS.length);
  for (const i of outfits) assert.ok(outfitSet(i.wear!.kind), i.sku);
  const req = Object.fromEntries(outfits.map((i) => [i.wear!.kind, i.cloutReq ?? 0]));
  assert.deepEqual(
    { adventurer: req.adventurer, tactical: req.tactical, witch: req.witch, ranger: req.ranger, spacefarer: req.spacefarer, royalty: req.royalty },
    { adventurer: 1000, tactical: 2500, witch: 5000, ranger: 5000, spacefarer: 10000, royalty: 25000 },
  );
  for (const k of ["site-crew", "st-marks-punk", "gala-night", "ranch-hand", "rockaway-beach"]) assert.equal(req[k], 0, `${k} is sold for cash alone`);
  // Only outfits are gated by clout.
  for (const i of SHOP_ITEMS) if (i.wear?.slot !== "outfit") assert.ok(!i.cloutReq, i.sku);
});

test("an outfit replaces the body, legs and feet but keeps the player's face", () => {
  const p = modelParts({ body: "curvy" }, "tee", "pants", "royalty");
  assert.deepEqual(p.head, { sex: "f", file: FACE.f });
  assert.deepEqual(p.body, { sex: "m", file: "King" });
  assert.deepEqual(p.legs, p.body);
  const plain = modelParts({ body: DEFAULT_LOOK.body }, "blazer", "skirt");
  assert.deepEqual(plain.body, TOP_MODEL.blazer.m);
  assert.deepEqual(plain.legs, BOTTOM_MODEL.skirt.m);
});
