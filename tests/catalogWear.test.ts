import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { GARMENT_TEMPLATES } from "../lib/avatarCatalog.ts";
import { CATALOG_WEAR, catalogPieces } from "../lib/catalogWear.ts";

const catalog = readdirSync("content/shop").filter((f) => f.endsWith(".json")).flatMap((f) => {
  const d = JSON.parse(readFileSync(`content/shop/${f}`, "utf8"));
  return (Array.isArray(d) ? d : d.items ?? []) as { id?: string; slot?: string; template?: string; realCash?: boolean }[];
});

test("every Shop catalog top, bottom, dress and pair of shoes has its pieces on the new bodies", () => {
  // With Clout Couture's suit and heels (migration 0102).
  const clothes = catalog.filter((i) => ["top", "bottom", "one-piece", "shoes"].includes(i.slot ?? "") && (i.template || i.realCash));
  assert.ok(clothes.length >= 60, `${clothes.length} pieces of clothing`);
  assert.deepEqual(Object.keys(CATALOG_WEAR).sort(), clothes.map((i) => i.id!).sort(), "one entry per catalog piece, nothing extra");
  for (const i of clothes) {
    const w = CATALOG_WEAR[i.id!];
    assert.equal(w.slot, i.slot, `${i.id}: worn where the catalog says`);
    const slots = w.pieces.map((p) => GARMENT_TEMPLATES[p.file]?.slot);
    assert.ok(slots.every(Boolean), `${i.id}: every piece is a template`);
    const want = w.slot === "one-piece" ? ["bottom", "top"] : [w.slot];
    assert.deepEqual([...new Set(slots)].sort(), want, `${i.id}: fills ${want.join(" and ")}`);
    for (const p of w.pieces) assert.match(p.color, /^#[0-9A-F]{6}$/i, `${i.id}: ${p.file} color`);
  }
});

test("worn catalog clothes fill their slots; a dress fills top and bottom, and a later piece wins", () => {
  const dress = catalogPieces(["crisp-monday-shirt", "red-carpet-rehearsal-gown", "gala-gold-heels"]);
  assert.deepEqual(dress.top?.map((p) => p.file), ["vest"], "the gown's bodice replaces the shirt");
  assert.deepEqual(dress.bottom?.map((p) => p.file), ["gown"]);
  assert.deepEqual(dress.shoes?.map((p) => p.file), ["sneakers"]);
  assert.deepEqual(catalogPieces(["commuter-trench"]).top?.map((p) => p.file), ["blazer", "coattail"], "a long coat is a jacket and its tails");
});
