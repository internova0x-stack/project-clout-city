import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { ACCESSORIES, ACCESSORY_SLOTS, ACCESSORY_TEMPLATES, accessoriesFor } from "../lib/accessories.ts";

const catalog = readdirSync("content/shop").filter((f) => f.endsWith(".json")).flatMap((f) => {
  const d = JSON.parse(readFileSync(`content/shop/${f}`, "utf8"));
  return (Array.isArray(d) ? d : d.items ?? []) as { id?: string; slot?: string; template?: string; realCash?: boolean }[];
});

test("every Shop accessory waiting on a rigid piece has its shape and colors, in its own slot", () => {
  // Clout Couture's shades, watch and crown (migration 0102) are worn in an accessory slot too.
  const waiting = catalog.filter((i) => (ACCESSORY_TEMPLATES as readonly string[]).includes(i.template ?? "")
    || (i.realCash && (ACCESSORY_SLOTS as readonly string[]).includes(i.slot ?? "")));
  assert.ok(waiting.length >= 20, `${waiting.length} accessories`);
  for (const i of waiting) {
    const a = ACCESSORIES[i.id!];
    assert.ok(a, `${i.id} has a shape`);
    assert.equal(a.slot, i.slot, `${i.id}: worn where the catalog says`);
    assert.match(a.color, /^#[0-9A-F]{6}$/i);
  }
  assert.deepEqual(Object.keys(ACCESSORIES).sort(), waiting.map((i) => i.id!).sort(), "nothing extra");
});

test("one accessory per slot, in slot order", () => {
  const worn = accessoriesFor(["everyday-hoops", "midtown-fedora", "statement-drops", "not-an-accessory"]);
  assert.deepEqual(worn.map((a) => a.kind), ["fedora", "drops"], "the later earrings win the ears");
  assert.ok(worn.every((a) => ACCESSORY_SLOTS.includes(a.slot)));
});
