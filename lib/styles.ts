// The eight starting styles (Clarifications section 1, build note 3; owner, Oct 30: one for everyone, whatever the body,
// covering casual, athletic, streetwear, corporate, new money, thrift, nerdy/preppy and goth, each clearly different).
// Each sets 3 to 4 cheap starter items and gives no stats or bonuses. Ids are stored (players.look.style, the Shop's
// style lines, hunts), so they stay as they were when a style was renamed.
// Hair, glasses and coverings are free Look options, never part of a style.

import type { AccessoryWear } from "./accessories.ts";
import type { SetPiece } from "./avatarCatalog.ts";

export type StyleId =
  | "bodega_drip"
  | "thrift_store_icon"
  | "midtown_finance"
  | "night_owl_goth"
  | "pilates_princess"
  | "startup_founder"
  | "influencer_soft_glam"
  | "arcade_nerd";

export type TopKind = "puffer" | "cardigan" | "vest" | "hoodie" | "crop" | "zip" | "blazer" | "tee";
export type BottomKind = "pants" | "skirt" | "shorts" | "leggings";
export type AccessoryKind = "cap" | "tote" | "lanyard" | "choker" | "mat" | "gymbag" | "headphones" | "phone" | "none";

export type ShoeKind = "boots";

export interface Outfit {
  top: TopKind;
  topColor: string;
  topAccent: string;
  bottom: BottomKind;
  bottomColor: string;
  shoeColor: string;
  /** Shoes with their own shape (lib/avatarCatalog.ts SHOE_MODEL); otherwise they follow the bottom. */
  shoes?: ShoeKind;
  shoeAccent?: string;
  accessory: AccessoryKind;
  accessoryColor: string;
  /** A whole Shop outfit (lib/avatarCatalog.ts OUTFIT_SETS) worn over the pieces, in its own colors. */
  set?: string;
  /** Shop accessories worn (lib/accessories.ts): hats, glasses, earrings, necklaces, bags, a watch. New bodies only. */
  extras?: AccessoryWear[];
  /** Shop catalog clothes worn (lib/catalogWear.ts), by the slot their pieces fill (a dress fills top and bottom). New
   *  bodies only: they replace that slot's starter or code piece. */
  pieces?: Partial<Record<"top" | "bottom" | "shoes", SetPiece[]>>;
  /** Clout Couture's 24k Glow Ritual (migration 0103): a gold shimmer on the bare skin. New bodies only. */
  glow?: boolean;
}

export interface StartingStyle {
  id: StyleId;
  label: string;
  emoji: string;
  blurb: string;
  starterItems: string[];
  /** The shared cut; male and female change colors (and a few pieces) on top of it. */
  outfit: Outfit;
  male?: Partial<Outfit>;
  female?: Partial<Outfit>;
}

export const STARTING_STYLES: StartingStyle[] = [
  {
    id: "startup_founder",
    label: "Everyday Casual",
    emoji: "😎",
    blurb: "Tee, jeans, no plans. The plan is no plans.",
    starterItems: ["Sky-blue tee", "Straight jeans", "White sneakers"],
    outfit: {
      top: "tee", topColor: "#6FA8DC", topAccent: "#F4F1EA",
      bottom: "pants", bottomColor: "#4A5F7E", shoeColor: "#F4F1EA",
      accessory: "none", accessoryColor: "#000000",
    },
  },
  {
    id: "pilates_princess",
    label: "Gym Regular",
    emoji: "🏃",
    blurb: "Training for something. Won't say what.",
    starterItems: ["Royal-blue hoodie", "Running shorts", "Trainers", "Gym bag"],
    outfit: {
      top: "hoodie", topColor: "#2F6FDB", topAccent: "#F4F1EA",
      bottom: "shorts", bottomColor: "#26232D", shoeColor: "#FFFFFF",
      accessory: "gymbag", accessoryColor: "#26232D",
    },
  },
  {
    id: "bodega_drip",
    label: "Bodega Streetwear",
    emoji: "🧢",
    blurb: "Knows the deli cat by name. The deli cat does not know you.",
    starterItems: ["Cobalt puffer", "Cargo pants", "Box-fresh white sneakers", "Fitted cap"],
    outfit: {
      top: "puffer", topColor: "#1F4FB5", topAccent: "#1F1B26",
      bottom: "pants", bottomColor: "#5B5A4A", shoeColor: "#F4F1EA",
      // The fitted cap is headwear since v0.7 (look.covering): older rows without a headwear pick get it.
      accessory: "cap", accessoryColor: "#1F1B26",
    },
  },
  {
    id: "midtown_finance",
    label: "Midtown Corporate",
    emoji: "💼",
    blurb: "Firm handshake, two phones, zero personality. Bullish.",
    starterItems: ["Navy blazer", "Charcoal trousers", "Dress shoes", "Office lanyard"],
    outfit: {
      top: "blazer", topColor: "#23314F", topAccent: "#A9C3E8",
      bottom: "pants", bottomColor: "#3A3742", shoeColor: "#1F1B26", shoes: "boots", shoeAccent: "#14111A",
      accessory: "lanyard", accessoryColor: "#2F6FDB",
    },
  },
  {
    id: "influencer_soft_glam",
    label: "New Money",
    emoji: "💸",
    blurb: "Got rich last Tuesday. Has mentioned it since Tuesday.",
    starterItems: ["Electric-blue blazer", "Linen shorts", "Loafers, no socks", "The newest phone"],
    outfit: {
      top: "blazer", topColor: "#3B6FF6", topAccent: "#F4F1EA",
      bottom: "shorts", bottomColor: "#F1E6D4", shoeColor: "#8A6A52", shoes: "boots", shoeAccent: "#5A3420",
      accessory: "phone", accessoryColor: "#C9C3CF",
    },
  },
  {
    id: "thrift_store_icon",
    label: "Thrift Store Regular",
    emoji: "🧶",
    blurb: "Paid C$4 for this cardigan and will tell you about it.",
    starterItems: ["Denim-blue grandpa cardigan", "Corduroy pants", "Scuffed boots", "Canvas tote"],
    outfit: {
      top: "cardigan", topColor: "#4C6A92", topAccent: "#D9A43A",
      bottom: "pants", bottomColor: "#8A5A3C", shoeColor: "#3A2418", shoes: "boots", shoeAccent: "#2A1A10",
      accessory: "tote", accessoryColor: "#E9DFC9",
    },
  },
  {
    id: "arcade_nerd",
    label: "Arcade Prep",
    emoji: "🤓",
    blurb: "Sweater vest, high score on every machine in Astoria. Low score in sunlight.",
    starterItems: ["Powder-blue sweater vest", "Pressed shorts", "Red high-tops", "Over-ear headphones"],
    outfit: {
      top: "vest", topColor: "#8FA6E8", topAccent: "#F4F1EA",
      bottom: "shorts", bottomColor: "#C2AE86", shoeColor: "#D93A2F",
      accessory: "headphones", accessoryColor: "#14111A",
    },
  },
  {
    id: "night_owl_goth",
    label: "Night Owl Goth",
    emoji: "🦇",
    blurb: "Hasn't seen the sun since 2019. Thriving.",
    starterItems: ["Midnight-blue hoodie", "Black jeans", "Platform boots", "Ring choker"],
    outfit: {
      top: "hoodie", topColor: "#26346B", topAccent: "#6E2B5E",
      bottom: "pants", bottomColor: "#14111A", shoeColor: "#0E0C12", shoes: "boots", shoeAccent: "#2A2733",
      accessory: "choker", accessoryColor: "#C9C3CF",
    },
  },
];

export const STYLE_IDS = STARTING_STYLES.map((s) => s.id);

export function getStyle(id: string | null | undefined): StartingStyle {
  // An unknown style reads as Bodega Streetwear, the default look since day one (the list's order is the creator's).
  return STARTING_STYLES.find((s) => s.id === id) ?? STARTING_STYLES.find((s) => s.id === "bodega_drip")!;
}

export function isStyleId(id: unknown): id is StyleId {
  return typeof id === "string" && (STYLE_IDS as string[]).includes(id);
}

/** The starter outfit for a style as worn by a presentation ("curvy" is Female). */
export function styleOutfit(style: StartingStyle, body: "straight" | "curvy"): Outfit {
  return { ...style.outfit, ...(body === "curvy" ? style.female : style.male) };
}

// ---------------------------------------------------------------------------
// Starter outfit choices (v0.7, #45): three tops and three bottoms per style, from the pieces
// the 3D avatar can wear, with six colors each. Both presentations' defaults are in every list.
// ---------------------------------------------------------------------------

/** The player's starter outfit pick (stored in players.look.fit). */
export interface Fit {
  top: TopKind;
  topColor: string;
  bottom: BottomKind;
  bottomColor: string;
  shoeColor: string;
}

export interface StyleFits {
  tops: TopKind[];
  bottoms: BottomKind[];
  topColors: string[];
  bottomColors: string[];
  shoeColors: string[];
}

export const TOP_LABEL: Record<TopKind, string> = {
  puffer: "Puffer", cardigan: "Cardigan", vest: "Sweater vest", hoodie: "Hoodie", crop: "Crop top", zip: "Zip-up", blazer: "Blazer", tee: "Tee",
};
export const BOTTOM_LABEL: Record<BottomKind, string> = { pants: "Pants", skirt: "Skirt", shorts: "Shorts", leggings: "Leggings" };

/**
 * Every style offers a tee and pants on top of its own pieces (owner, Oct 22), and the zip-up isn't a free top (it's
 * something to buy). No color picker (owner, Oct 22): each look comes in its own colors, every top a shade of blue
 * (owner, Oct 30: "the starting color should be blue"); a fit saved in another color wears these (storedFit, starterOutfit).
 */
const BASIC_TOPS: TopKind[] = ["tee"];
const BASIC_BOTTOMS: BottomKind[] = ["pants"];
const withBasics = <T,>(own: T[], basics: T[]) => [...own, ...basics.filter((c) => !own.includes(c))];

/** A look's colors: its top, bottom and shoes. */
export function styleColors(id: StyleId | string): { topColor: string; bottomColor: string; shoeColor: string } {
  const o = getStyle(id).outfit;
  return { topColor: o.topColor, bottomColor: o.bottomColor, shoeColor: o.shoeColor };
}

/** The other pieces each look offers in its creator (the look's own top and bottom come first). */
const OWN_FITS: Record<StyleId, { tops: TopKind[]; bottoms: BottomKind[] }> = {
  startup_founder: { tops: ["tee", "hoodie"], bottoms: ["pants", "shorts"] },
  pilates_princess: { tops: ["hoodie", "tee"], bottoms: ["shorts", "leggings", "pants"] },
  bodega_drip: { tops: ["puffer", "hoodie", "tee"], bottoms: ["pants", "shorts"] },
  midtown_finance: { tops: ["blazer", "vest"], bottoms: ["pants", "skirt"] },
  influencer_soft_glam: { tops: ["blazer", "cardigan"], bottoms: ["shorts", "pants", "skirt"] },
  thrift_store_icon: { tops: ["cardigan", "vest", "tee"], bottoms: ["pants", "skirt", "shorts"] },
  arcade_nerd: { tops: ["vest", "tee", "cardigan"], bottoms: ["shorts", "pants"] },
  night_owl_goth: { tops: ["hoodie", "blazer", "crop"], bottoms: ["pants", "skirt", "leggings"] },
};

export const STYLE_FITS: Record<StyleId, StyleFits> = Object.fromEntries(Object.entries(OWN_FITS).map(([id, f]) => {
  const c = styleColors(id);
  return [id, { tops: withBasics(f.tops, BASIC_TOPS), bottoms: withBasics(f.bottoms, BASIC_BOTTOMS), topColors: [c.topColor], bottomColors: [c.bottomColor], shoeColors: [c.shoeColor] }];
})) as Record<StyleId, StyleFits>;

/** A stored fit is valid only if every piece and color is on its style's lists. */
/** A stored fit's pieces, in the starter colors (a fit saved in another color keeps its pieces); null if they aren't the style's. */
export function storedFit(style: StyleId, fit: unknown): Fit | null {
  const f = fit as Partial<Fit> | null;
  const o = STYLE_FITS[style];
  return f && typeof f === "object" && o.tops.includes(f.top as TopKind) && o.bottoms.includes(f.bottom as BottomKind)
    ? { top: f.top as TopKind, bottom: f.bottom as BottomKind, ...styleColors(style) } : null;
}

export function isValidFit(style: StyleId, fit: unknown): fit is Fit {
  const f = fit as Partial<Fit> | null;
  const o = STYLE_FITS[style];
  return !!f && typeof f === "object" && o.tops.includes(f.top as TopKind) && o.bottoms.includes(f.bottom as BottomKind)
    && o.topColors.includes(f.topColor ?? "") && o.bottomColors.includes(f.bottomColor ?? "") && o.shoeColors.includes(f.shoeColor ?? "");
}

/** The fit a style starts with for a presentation. */
export function defaultFit(style: StartingStyle, body: "straight" | "curvy"): Fit {
  const o = styleOutfit(style, body);
  return { top: o.top, bottom: o.bottom, ...styleColors(style.id) };
}

/** The outfit to draw: the style's (accent and accessory) with the player's fit on top. */
export function starterOutfit(style: StartingStyle, body: "straight" | "curvy", fit?: Fit | null): Outfit {
  const o = styleOutfit(style, body);
  return { ...o, ...(fit ? { top: fit.top, bottom: fit.bottom } : {}), ...styleColors(style.id) };
}
