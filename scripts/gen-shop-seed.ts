// Prints the Shop Manager's first catalog (JSON): every item on sale when it arrived (lib/city.ts SHOP_ITEMS), in the
// order the Shop showed them, with the game's own shop entry (city) for each. Used once, by migration 0099.
// Usage: node --experimental-strip-types scripts/gen-shop-seed.ts
import { citySeed, SHOP_ITEMS } from "../lib/city.ts";
import { fromShopItem } from "../lib/shopCatalog.ts";

export function shopSeed() {
  const entries = citySeed().shop;
  return SHOP_ITEMS.map((i, position) => {
    const d = fromShopItem(i);
    return {
      sku: d.sku, position, tab: d.tab, slot: d.slot, presentation: d.presentation, name: d.name, description: d.description, emoji: d.emoji,
      price: d.price, clout: d.clout, stars: d.stars, real_cash: d.realCash, extra: d.extra, city: entries.find((e) => e.sku === i.sku),
    };
  });
}

if (process.argv[1]?.endsWith("gen-shop-seed.ts")) process.stdout.write(JSON.stringify(shopSeed()));
