import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACES, SHOP_ITEMS } from "../lib/city.ts";
import { STYLE_LINES } from "../lib/shopCatalog.ts";
import { STYLE, fullLooks, lookBadge, styleCounts, venueLine } from "../lib/style.ts";
import { STARTING_STYLES } from "../lib/styles.ts";

test("the database's style settings are lib/style.ts's (migration 0100)", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0100_style_looks.sql", import.meta.url), "utf8");
  const seed = JSON.parse(sql.match(/\('style', '(.+?)'::jsonb\)/)![1]);
  const { venueMin, fullMin, venueConfidence, taskChance, venues, startingLines, liveLines } = STYLE;
  assert.deepEqual(seed, JSON.parse(JSON.stringify({ venueMin, fullMin, venueConfidence, taskChance, venues, startingLines, liveLines })));
});

test("every line has places to shine, every starting style a line, every old fashion piece its lines", () => {
  const tags = new Set(PLACES.filter((p) => !p.story).flatMap((p) => p.tags));
  for (const line of STYLE_LINES) {
    const venues = (STYLE.venues as Record<string, readonly string[]>)[line];
    assert.ok(venues?.some((t) => tags.has(t)), `${line} fits a real place`);
  }
  for (const s of STARTING_STYLES) assert.ok((STYLE.startingLines as Record<string, string>)[s.id], s.id);
  // Reward pieces (streaks, the Clout Pass, the starter pack) carry no style line: real money never buys a venue boost.
  for (const i of SHOP_ITEMS.filter((x) => x.category === "fashion" && !x.reward)) {
    const lines = (STYLE.liveLines as Record<string, readonly string[]>)[i.sku];
    assert.ok(lines?.length, `${i.sku} has lines`);
    assert.ok(lines.every((l) => (STYLE_LINES as readonly string[]).includes(l)), `${i.sku}: real lines`);
  }
});

test("counting a look: each piece once, whatever it cost; outfits and starting clothes", () => {
  // A new Bodega Drip player arrives in a full Streetwear look.
  assert.deepEqual(styleCounts([], "bodega_drip"), { streetwear: 3 });
  // A top replaces the starting top; each of its lines counts once.
  assert.deepEqual(styleCounts([{ slot: "top", lines: ["gothic", "business-casual"] }], "bodega_drip"), { gothic: 1, "business-casual": 1, streetwear: 2 });
  // A whole outfit is a full look on its own and covers the starting clothes.
  assert.deepEqual(styleCounts([{ slot: "outfit", lines: ["gothic"] }], "bodega_drip"), { gothic: 3 });
  // Accessories add without replacing anything.
  assert.deepEqual(styleCounts([{ slot: "accessory", lines: ["streetwear"] }], "bodega_drip"), { streetwear: 4 });
  assert.deepEqual(fullLooks({ gothic: 3, sporty: 2, streetwear: 4 }), ["streetwear", "gothic"]);
});

test("venue match: two pieces of a line at a place that suits it", () => {
  assert.equal(venueLine({ gothic: 2 }, ["club", "nightlife"]), "gothic");
  assert.equal(venueLine({ gothic: 1 }, ["club"]), null, "one piece isn't enough");
  assert.equal(venueLine({ gothic: 3 }, ["gym"]), null, "the gym doesn't suit goth");
  assert.equal(venueLine({ sporty: 2, streetwear: 3 }, ["park"]), "streetwear", "the most pieces wins");
  assert.deepEqual(lookBadge("look-gothic"), { emoji: "🖤", name: "Full Goth look" });
  assert.equal(lookBadge("skill-cooking-5"), null);
});

test("a dress covers the top and the bottom; only the shoes stay the starting style's", () => {
  assert.deepEqual(styleCounts([{ slot: "one-piece", lines: ["fashionista"] }], "bodega_drip"), { fashionista: 1, streetwear: 1 });
});
