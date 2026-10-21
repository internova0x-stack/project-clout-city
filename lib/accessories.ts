// Rigid accessories on the new bodies (stage 4 of the avatar and Shop upgrade, docs/shop-manager.md; owner, Oct 21: "go"):
// hats, glasses, earrings, necklaces, the choker and scarf, bags and the watch from the Shop's catalog
// (content/shop/*.json: their `template` is "rigid:<kind>", "mini_bag" or "watch"). Each is a shape the game draws
// (components/avatar/accessories.ts) in the colors here, read from the catalog's descriptions. Head pieces are made in
// the head's space like the game's caps; neck, hand and wrist pieces are measured from each body and ride its bones.
//
// They stay locked in the Shop (wearable false) until the new bodies switch on for everyone, so nobody buys a piece the
// old avatars can't show; the switch-on migration unlocks them and lets Your Look save them.

/** Where an accessory is worn: one of each at a time (the catalog's slots; save_look keeps one per slot). */
export type AccessorySlot = "head" | "face" | "ears" | "neck" | "hand" | "wrist";
export const ACCESSORY_SLOTS: readonly AccessorySlot[] = ["head", "face", "ears", "neck", "hand", "wrist"];

export type AccessoryKind =
  | "bucket" | "beanie" | "fedora" | "wide-brim" | "balaclava"
  | "oversized-shades" | "visor" | "square-frames"
  | "hoops" | "drops"
  | "rope-chains" | "flame-chain" | "pearls" | "ring-choker" | "scarf"
  | "tote" | "sling" | "doctor-bag" | "mini-bag" | "shoulder-bag" | "clutch"
  | "iced-watch" | "crown" | "tiara";

/** One accessory as worn: its shape and colors. */
export interface AccessoryWear { slot: AccessorySlot; kind: AccessoryKind; color: string; accent: string }

/** The catalog's accessories by sku, with Clout Couture's crown, shades and watch (stage 5, migration 0102). */
export const ACCESSORIES: Record<string, AccessoryWear> = {
  "patchwork-bucket-hat": { slot: "head", kind: "bucket", color: "#5B7FA6", accent: "#2E4A6E" },
  "corner-beanie": { slot: "head", kind: "beanie", color: "#1F1B26", accent: "#14111A" },
  "midtown-fedora": { slot: "head", kind: "fedora", color: "#3A3F47", accent: "#14111A" },
  "gallery-opening-hat": { slot: "head", kind: "wide-brim", color: "#EDE3CF", accent: "#C9A227" },
  "incognito-knit": { slot: "head", kind: "balaclava", color: "#C2AE86", accent: "#A8936B" },
  "brunch-shades": { slot: "face", kind: "oversized-shades", color: "#6B3F1F", accent: "#2A1A10" },
  "future-is-bright-visor": { slot: "face", kind: "visor", color: "#D9DDE3", accent: "#9FB4C8" },
  "old-money-frames": { slot: "face", kind: "square-frames", color: "#C9A227", accent: "#5A4A3A" },
  "everyday-hoops": { slot: "ears", kind: "hoops", color: "#D9DDE3", accent: "#D9DDE3" },
  "statement-drops": { slot: "ears", kind: "drops", color: "#C9A227", accent: "#C9A227" },
  "double-rope-chains": { slot: "neck", kind: "rope-chains", color: "#C9A227", accent: "#C9A227" },
  "the-clout-flame": { slot: "neck", kind: "flame-chain", color: "#C9A227", accent: "#E9F4FF" },
  "inheritance-pearls": { slot: "neck", kind: "pearls", color: "#F4EFE6", accent: "#C9A227" },
  "velvet-ring-choker": { slot: "neck", kind: "ring-choker", color: "#14111A", accent: "#D9DDE3" },
  "gilded-silk-scarf": { slot: "neck", kind: "scarf", color: "#EDE3CF", accent: "#C9A227" },
  "farmers-market-tote": { slot: "hand", kind: "tote", color: "#EDE3CF", accent: "#C2AE86" },
  "commute-sling": { slot: "hand", kind: "sling", color: "#1F1B26", accent: "#3A3F47" },
  "emerald-hour-bag": { slot: "hand", kind: "doctor-bag", color: "#1F6B4A", accent: "#C9A227" },
  "blush-mini-top-handle": { slot: "hand", kind: "mini-bag", color: "#E8A6B4", accent: "#C9A227" },
  "lilac-errand-bag": { slot: "hand", kind: "shoulder-bag", color: "#B9A2D8", accent: "#D9DDE3" },
  "afterparty-clutch": { slot: "hand", kind: "clutch", color: "#D9DDE3", accent: "#F4F7FF" },
  "ice-rink-watch": { slot: "wrist", kind: "iced-watch", color: "#C9A227", accent: "#E9F4FF" },
  // Clout Couture: solid gold, gold-mirror lenses; the tourbillon's diamonds; the crown's rubies.
  "midas-shades": { slot: "face", kind: "oversized-shades", color: "#D4AF37", accent: "#E8C55A" },
  "ledger-tourbillon": { slot: "wrist", kind: "iced-watch", color: "#D4AF37", accent: "#F4F7FF" },
  "clout-crown": { slot: "head", kind: "crown", color: "#D4AF37", accent: "#B3122E" },
};

/** The catalog templates the accessories above stand for ("rigid:hat", "mini_bag", "watch"). */
export const ACCESSORY_TEMPLATES = ["rigid:hat", "rigid:balaclava", "rigid:eyewear", "rigid:earrings", "rigid:necklace", "rigid:choker", "rigid:scarf", "rigid:bag", "mini_bag", "watch"] as const;

/** Head pieces that sit over the hair (only its lengths show) and the one that hides it. */
export const ACCESSORY_HATS: ReadonlySet<AccessoryKind> = new Set(["bucket", "beanie", "fedora", "wide-brim", "balaclava", "crown"]);
// The tiara sits on the hair, which stays whole.
export const ACCESSORY_HIDES_HAIR: ReadonlySet<AccessoryKind> = new Set(["balaclava"]);

/** The worn accessories by slot (the last one wins a slot), for the avatar. */
export function accessoriesFor(skus: readonly string[]): AccessoryWear[] {
  const by = new Map<AccessorySlot, AccessoryWear>();
  for (const s of skus) { const a = ACCESSORIES[s]; if (a) by.set(a.slot, a); }
  return ACCESSORY_SLOTS.flatMap((s) => (by.get(s) ? [by.get(s)!] : []));
}
