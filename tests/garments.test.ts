import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { GARMENT_TEMPLATES, garmentsFor } from "../lib/avatarCatalog.ts";
// @ts-expect-error plain JavaScript build helper
import { COVER, buildHoodie, coverBits, hoodieFit, readBody } from "../scripts/garments.mjs";

const io = new NodeIO();
const master = async (sex: "m" | "f") => {
  const doc = await io.read(`assets/avatars/base-${sex === "m" ? "male" : "female"}.glb`);
  return readBody(doc.getRoot().listMeshes()[0].listPrimitives()[0], doc.getRoot().listSkins()[0]);
};

test("every garment template has its files, small, and the game's cover bits and slots match the build's", async () => {
  // @ts-expect-error plain JavaScript build helper
  const { WARDROBE } = await import("../scripts/wardrobe.mjs");
  const build: Record<string, { bit: number; kind: string }> = { hoodie: { bit: COVER.hoodie, kind: "top" }, ...WARDROBE };
  assert.deepEqual(Object.keys(GARMENT_TEMPLATES).sort(), Object.keys(build).sort(), "the same templates in the game and the build");
  for (const [file, g] of Object.entries(GARMENT_TEMPLATES)) {
    assert.equal(g.cover, build[file].bit, `${file}: cover bit`);
    assert.equal(g.slot, build[file].kind === "skirt" ? "bottom" : build[file].kind === "boots" ? "shoes" : build[file].kind, `${file}: slot`);
    for (const f of ["m", "f", "m-low", "f-low"]) {
      const p = `public/avatars/garments/${file}-${f}.glb`;
      assert.ok(statSync(p).size < 200_000, `${p} is ${statSync(p).size} bytes`);
    }
  }
  const bits = Object.values(GARMENT_TEMPLATES).map((g) => g.cover);
  assert.equal(new Set(bits).size, bits.length, "every template has its own bit");
  assert.ok(bits.every((b) => b > 0 && b < 2 ** 24 && (b & (b - 1)) === 0), "single bits a float holds exactly");
});

test("every top and bottom players can own has a template on the new bodies", async () => {
  const tops: string[] = ["puffer", "cardigan", "vest", "hoodie", "crop", "zip", "blazer", "tee"];
  const bottoms: string[] = ["pants", "skirt", "shorts", "leggings"];
  for (const k of [...tops, ...bottoms, "boots"]) assert.ok(GARMENT_TEMPLATES[k], k);
  const o = { top: "tee", topColor: "#fff", topAccent: "#000", bottom: "skirt", bottomColor: "#111", shoes: "boots", shoeColor: "#222", shoeAccent: "#333" } as const;
  assert.deepEqual(garmentsFor(o).map((g) => [g.file, g.color]), [["tee", "#fff"], ["skirt", "#111"], ["boots", "#222"]]);
  assert.deepEqual(garmentsFor({ ...o, set: "royalty" }), [], "whole outfits wait for their own templates");
});

test("the hoodie fits both bodies: neck, hem and wrists where a hoodie's are", async () => {
  for (const sex of ["m", "f"] as const) {
    const body = await master(sex);
    const fit = hoodieFit(body);
    assert.ok(fit.neckY > body.bone.neck[1] && fit.neckY < body.bone.Head[1], `${sex}: neckline between the neck and head bones`);
    assert.ok(fit.rNeck > 0.03 && fit.rNeck < 0.1, `${sex}: neck radius ${fit.rNeck}`);
    assert.ok(fit.ceiling > fit.neckY, `${sex}: collar under the chin`);
    assert.ok(fit.hemY < body.bone.Hips[1] && fit.hemY > body.bone.Hips[1] - 0.15, `${sex}: hem at the hips`);
    const shape = buildHoodie(body);
    assert.ok(shape.pos.length > 1000, `${sex}: ${shape.pos.length} vertices`);
    assert.ok(shape.pos.every((p: number[]) => p.every(Number.isFinite)), `${sex}: every vertex is a number`);
    const ys = shape.pos.map((p: number[]) => p[1]);
    assert.ok(Math.min(...ys) > fit.hemY - 0.03 && Math.max(...ys) < fit.ceiling + 0.08, `${sex}: hoodie between the hem and the hood`);
    assert.ok(shape.weights.every((w: number[]) => Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-3), `${sex}: skin weights add up`);
    // The skin it hides is the torso and arms, never the hands or legs below the hem.
    const bits: Uint16Array = coverBits(body);
    const hidden = body.pos.filter((_: number[], i: number) => bits[i] & COVER.hoodie);
    assert.ok(hidden.length > body.count * 0.2, `${sex}: hides ${hidden.length} vertices`);
    assert.ok(hidden.every((p: number[]) => p[1] > fit.hemY), `${sex}: nothing below the hem hidden`);
  }
});

test("every hairstyle grows from the scalp of both bodies, above the chin, with its lengths off the body", async () => {
  // @ts-expect-error plain JavaScript build helper
  const { HAIR_STYLES, buildHair, headFit } = await import("../scripts/hair.mjs");
  const { HAIRS } = await import("../lib/look.ts");
  assert.deepEqual([...HAIR_STYLES, "bald"].sort(), HAIRS.map((h: { id: string }) => h.id).sort(), "a hair file part for every hairstyle but bald");
  for (const sex of ["m", "f"] as const) {
    const body = await master(sex);
    const f = headFit(body);
    const parts = buildHair(body);
    for (const style of HAIR_STYLES) {
      const scalp = parts[style];
      assert.ok(scalp && scalp.pos.length > 200, `${sex} ${style}: scalp`);
      assert.ok(scalp.pos.every((p: number[]) => p.every(Number.isFinite) && p[1] > f.chin), `${sex} ${style}: above the chin`);
    }
    for (const style of ["long", "ponytail", "bun", "braids", "locs"]) assert.ok(parts[`${style}-lengths`]?.pos.length, `${sex} ${style}: has lengths`);
    for (const [name, part] of Object.entries(parts) as [string, { pos: number[][] }][]) {
      assert.ok(part.pos.every((p) => p.every(Number.isFinite)), `${sex} ${name}: every vertex is a number`);
    }
  }
});
