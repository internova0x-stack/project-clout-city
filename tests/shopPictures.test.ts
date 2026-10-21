import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { SHOP_ITEMS } from "../lib/city.ts";
import { parseCatalogFile, shippedPictures } from "../lib/shopCatalog.ts";

test("every picture in the catalog files ships with the game (npm run build:shop-images)", () => {
  for (const file of readdirSync("content/shop").filter((f) => f.endsWith(".json"))) {
    const parsed = parseCatalogFile(JSON.parse(readFileSync(`content/shop/${file}`, "utf8")), file);
    const want = [
      ...parsed.drafts.filter((d) => d.sourceImage).map((d) => ({ sku: d.sku, source: d.sourceImage })),
      ...parsed.images.flatMap((m) => SHOP_ITEMS.filter((i) => i.name === m.liveName).map((i) => ({ sku: i.sku, source: m.sourceImage }))),
    ];
    for (const w of want) {
      const p = shippedPictures(w.sku, w.source);
      assert.ok(p, `${file}: ${w.sku} has no shipped picture`);
      for (const f of [p.card, p.detail]) {
        assert.ok(existsSync(`public${f}`), `${f} is missing`);
        assert.ok(statSync(`public${f}`).size < 200_000, `${f} is too big`);
      }
      assert.deepEqual(shippedPictures(w.sku), p, `${w.sku}: found by its sku too`);
    }
  }
});

test("every item on sale before the catalog files has its picture", () => {
  const live = JSON.parse(readFileSync("content/shop/live-shop-images.json", "utf8")).items as { liveName: string }[];
  for (const { liveName } of live) {
    const items = SHOP_ITEMS.filter((i) => i.name === liveName);
    assert.ok(items.length, `"${liveName}" isn't in the Shop`);
    for (const i of items) assert.ok(shippedPictures(i.sku), `${liveName} (${i.sku})`);
  }
});
