// Worn Shop fashion over the starting style's outfit (one item per slot).
import type { ShopItem } from "./city.ts";
import type { AccessoryKind, BottomKind, Outfit, ShoeKind, TopKind } from "./styles.ts";

export function outfitWith(base: Outfit, worn: ShopItem[]): Outfit {
  const o = { ...base };
  for (const item of worn) {
    const w = item.wear;
    if (!w) continue;
    if (w.slot === "top") {
      o.top = (w.kind as TopKind) ?? o.top;
      o.topColor = w.color;
      o.topAccent = w.accent ?? o.topAccent;
    } else if (w.slot === "bottom") {
      o.bottom = (w.kind as BottomKind) ?? o.bottom;
      o.bottomColor = w.color;
    } else if (w.slot === "shoes") {
      o.shoeColor = w.color;
      o.shoes = (w.kind as ShoeKind | undefined) ?? o.shoes;
      o.shoeAccent = w.accent ?? o.shoeAccent;
    } else if (w.slot === "outfit") {
      o.set = w.kind;
    } else if (w.slot === "accessory") {
      o.accessory = (w.kind as AccessoryKind) ?? o.accessory;
      o.accessoryColor = w.color;
    }
  }
  return o;
}
