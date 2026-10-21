// What a worn Shop piece is, wherever it comes from (switch-on, migration 0101): the code's own pieces (lib/city.ts
// SHOP_ITEMS' wear), the catalog's clothes (lib/catalogWear.ts) and accessories (lib/accessories.ts). The server
// keeps one piece per slot, a dress counting as the top and the bottom (wear_slots); this mirrors it for the client.

import { ACCESSORIES, accessoriesFor } from "./accessories.ts";
import { catalogPieces, CATALOG_WEAR } from "./catalogWear.ts";
import { itemBySku, type ShopItem } from "./city.ts";
import type { Outfit } from "./styles.ts";
import { outfitWith } from "./wardrobe.ts";
import { CROWN_SKU, SUIT_SKU, type ItemOptions } from "./couture.ts";

/** Pieces worn as a skin effect in their own slot "glow" (Clout Couture's 24k Glow Ritual, migration 0103). */
export const GLOW_SKUS: ReadonlySet<string> = new Set(["24k-glow-ritual"]);

/** A worn piece's slot: top, bottom, one-piece, shoes, outfit, accessory, an accessory slot (head, face...) or glow. */
export function wearSlot(sku: string): string | undefined {
  return CATALOG_WEAR[sku]?.slot ?? ACCESSORIES[sku]?.slot ?? itemBySku(sku)?.wear?.slot ?? (GLOW_SKUS.has(sku) ? "glow" : undefined);
}

/** Can't be worn together: the same slot, or a dress with a top or a bottom. */
export function slotsClash(a: string, b: string): boolean {
  if (a === b) return true;
  const part = (s: string) => s === "top" || s === "bottom";
  return (a === "one-piece" && part(b)) || (b === "one-piece" && part(a));
}

/** The outfit for the worn pieces' skus, on top of the starting style's, with any piece's choices (migration 0103). */
export function outfitFromSkus(base: Outfit, skus: readonly string[], options: Record<string, ItemOptions | undefined> = {}): Outfit {
  const o = outfitWith(base, skus.map((s) => itemBySku(s)).filter((i): i is ShopItem => !!i?.wear));
  const pieces = catalogPieces(skus);
  const extras = accessoriesFor(skus).map((a) => (a === ACCESSORIES[CROWN_SKU] && options[CROWN_SKU]?.style === "tiara" ? { ...a, kind: "tiara" as const } : a));
  // The suit in its cloth, with its lining showing at the lapels.
  const suit = options[SUIT_SKU];
  if (suit && skus.includes(SUIT_SKU)) {
    for (const slot of ["top", "bottom"] as const) {
      pieces[slot] = pieces[slot]?.map((p) => ({ ...p, color: suit.cloth ?? p.color, accent: slot === "top" ? suit.lining ?? p.accent : suit.cloth ?? p.accent }));
    }
  }
  return { ...o, ...(Object.keys(pieces).length ? { pieces } : {}), ...(extras.length ? { extras } : {}), ...(skus.some((s) => GLOW_SKUS.has(s)) ? { glow: true } : {}) };
}

/** The owned pieces' choices by sku (migration 0103), for outfitFromSkus. */
export function itemOptionsBySku(items: readonly { sku: string; options?: ItemOptions }[]): Record<string, ItemOptions> {
  return Object.fromEntries(items.filter((i) => i.options).map((i) => [i.sku, i.options!]));
}
