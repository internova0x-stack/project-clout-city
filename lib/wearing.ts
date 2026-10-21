// What a worn Shop piece is, wherever it comes from (switch-on, migration 0101): the code's own pieces (lib/city.ts
// SHOP_ITEMS' wear), the catalog's clothes (lib/catalogWear.ts) and accessories (lib/accessories.ts). The server
// keeps one piece per slot, a dress counting as the top and the bottom (wear_slots); this mirrors it for the client.

import { ACCESSORIES, accessoriesFor } from "./accessories.ts";
import { catalogPieces, CATALOG_WEAR } from "./catalogWear.ts";
import { itemBySku, type ShopItem } from "./city.ts";
import type { Outfit } from "./styles.ts";
import { outfitWith } from "./wardrobe.ts";

/** A worn piece's slot: top, bottom, one-piece, shoes, outfit, accessory, or an accessory slot (head, face...). */
export function wearSlot(sku: string): string | undefined {
  return CATALOG_WEAR[sku]?.slot ?? ACCESSORIES[sku]?.slot ?? itemBySku(sku)?.wear?.slot;
}

/** Can't be worn together: the same slot, or a dress with a top or a bottom. */
export function slotsClash(a: string, b: string): boolean {
  if (a === b) return true;
  const part = (s: string) => s === "top" || s === "bottom";
  return (a === "one-piece" && part(b)) || (b === "one-piece" && part(a));
}

/** The outfit for the worn pieces' skus, on top of the starting style's. */
export function outfitFromSkus(base: Outfit, skus: readonly string[]): Outfit {
  const o = outfitWith(base, skus.map((s) => itemBySku(s)).filter((i): i is ShopItem => !!i?.wear));
  const pieces = catalogPieces(skus), extras = accessoriesFor(skus);
  return { ...o, ...(Object.keys(pieces).length ? { pieces } : {}), ...(extras.length ? { extras } : {}) };
}
