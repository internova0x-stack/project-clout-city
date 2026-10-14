// The eight starting styles (Clarifications section 1, build note 3).
// Each sets 3 to 4 cheap starter items and gives no stats or bonuses.
// Hair, glasses and coverings are free Look options, never part of a style.

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
export type AccessoryKind = "cap" | "tote" | "lanyard" | "choker" | "mat" | "headphones" | "phone" | "none";

export interface Outfit {
  top: TopKind;
  topColor: string;
  topAccent: string;
  bottom: BottomKind;
  bottomColor: string;
  shoeColor: string;
  accessory: AccessoryKind;
  accessoryColor: string;
  /** A whole Shop outfit (lib/avatarCatalog.ts OUTFIT_SETS) worn over the pieces, in its own colors. */
  set?: string;
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
    id: "bodega_drip",
    label: "Bodega Drip",
    emoji: "🥯",
    blurb: "Knows the deli cat by name. The deli cat does not know you.",
    starterItems: ["Oversized puffer", "Cargo sweats", "Box-fresh white sneakers", "Fitted cap"],
    outfit: {
      top: "puffer", topColor: "#E8692E", topAccent: "#1F1B26",
      bottom: "pants", bottomColor: "#5B5A4A", shoeColor: "#F4F1EA",
      accessory: "cap", accessoryColor: "#1F1B26",
    },
    female: { topColor: "#E0457B", topAccent: "#1F1B26", bottomColor: "#26232D", accessoryColor: "#F4F1EA" },
  },
  {
    id: "thrift_store_icon",
    label: "Thrift Store Icon",
    emoji: "🧶",
    blurb: "Paid $4 for this cardigan and will tell you about it.",
    starterItems: ["Grandpa cardigan", "Flared vintage jeans", "Chunky loafers", "Canvas tote"],
    outfit: {
      top: "cardigan", topColor: "#D9A43A", topAccent: "#7A3E2B",
      bottom: "pants", bottomColor: "#4C6A92", shoeColor: "#3A2418",
      accessory: "tote", accessoryColor: "#E9DFC9",
    },
    female: { topColor: "#8DB38A", topAccent: "#F2E4C9", bottomColor: "#B0603F", accessoryColor: "#F6E7B8" },
  },
  {
    id: "midtown_finance",
    label: "Midtown Finance",
    emoji: "📈",
    blurb: "Fleece vest, firm handshake, zero personality. Bullish.",
    starterItems: ["Fleece vest", "Oxford shirt", "Khaki chinos", "Brown loafers"],
    outfit: {
      top: "vest", topColor: "#23314F", topAccent: "#A9C3E8",
      bottom: "pants", bottomColor: "#C2AE86", shoeColor: "#5A3420",
      accessory: "none", accessoryColor: "#000000",
    },
    female: { topColor: "#7A2E3B", topAccent: "#F1D6C8", bottom: "skirt", bottomColor: "#3A3742", shoeColor: "#1F1B26" },
  },
  {
    id: "night_owl_goth",
    label: "Night Owl Goth",
    emoji: "🦇",
    blurb: "Hasn't seen the sun since 2019. Thriving.",
    starterItems: ["Black mesh hoodie", "Pleated black skirt", "Platform boots", "Spiked choker"],
    outfit: {
      top: "hoodie", topColor: "#1A161F", topAccent: "#6E2B5E",
      bottom: "skirt", bottomColor: "#14111A", shoeColor: "#0E0C12",
      accessory: "choker", accessoryColor: "#C9C3CF",
    },
    male: { topAccent: "#3E5C76", bottom: "pants", bottomColor: "#2A2733", accessory: "none" },
  },
  {
    id: "pilates_princess",
    label: "Pilates Princess",
    emoji: "🧘",
    blurb: "Matching set, iced matcha, core of steel. Mostly the matcha.",
    starterItems: ["Matching crop top", "Ribbed leggings", "Cloud sneakers", "Rolled yoga mat"],
    outfit: {
      top: "crop", topColor: "#F2B8C6", topAccent: "#FFFFFF",
      bottom: "leggings", bottomColor: "#E9A3B6", shoeColor: "#FFFFFF",
      accessory: "mat", accessoryColor: "#9FD8C4",
    },
    male: { top: "tee", topColor: "#A7D8C9", topAccent: "#FFFFFF", bottom: "shorts", bottomColor: "#3F5A66", accessoryColor: "#F2B8C6" },
  },
  {
    id: "startup_founder",
    label: "Startup Founder",
    emoji: "🚀",
    blurb: "Disrupting the concept of sleep. Pre-revenue, post-humility.",
    starterItems: ["Grey zip hoodie", "Slim black jeans", "Minimalist sneakers", "Conference lanyard"],
    outfit: {
      top: "zip", topColor: "#8A8794", topAccent: "#2A2530",
      bottom: "pants", bottomColor: "#1F1B26", shoeColor: "#ECE6DC",
      accessory: "lanyard", accessoryColor: "#40B589",
    },
    female: { topColor: "#C9B8E8", topAccent: "#2A2530", bottom: "leggings", bottomColor: "#2E2A38", shoeColor: "#FFFFFF" },
  },
  {
    id: "influencer_soft_glam",
    label: "Influencer Soft Glam",
    emoji: "🤳",
    blurb: "Every outfit is content. So is this sentence.",
    starterItems: ["Cream oversized blazer", "Satin midi skirt", "Pointed ankle boots", "Phone with a sparkly case"],
    outfit: {
      top: "blazer", topColor: "#F1E6D4", topAccent: "#D7B9A0",
      bottom: "skirt", bottomColor: "#C9A98A", shoeColor: "#6E5240",
      accessory: "phone", accessoryColor: "#FFB3D1",
    },
    male: { topColor: "#D8C3A5", topAccent: "#F4EEE6", bottom: "pants", bottomColor: "#F1E6D4", shoeColor: "#8A6A52", accessoryColor: "#C9C3CF" },
  },
  {
    id: "arcade_nerd",
    label: "Arcade Nerd",
    emoji: "🕹️",
    blurb: "High score on every machine in Astoria. Low score in sunlight.",
    starterItems: ["Retro graphic tee", "Cargo shorts", "High-top sneakers", "Over-ear headphones"],
    outfit: {
      top: "tee", topColor: "#6B4FD8", topAccent: "#FFC21A",
      bottom: "shorts", bottomColor: "#4F5A3A", shoeColor: "#D93A2F",
      accessory: "headphones", accessoryColor: "#14111A",
    },
    female: { topColor: "#FF7AA8", topAccent: "#FFC21A", bottomColor: "#2B3A67", shoeColor: "#FFFFFF", accessoryColor: "#6B4FD8" },
  },
];

export const STYLE_IDS = STARTING_STYLES.map((s) => s.id);

export function getStyle(id: string | null | undefined): StartingStyle {
  return STARTING_STYLES.find((s) => s.id === id) ?? STARTING_STYLES[0];
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

export const STYLE_FITS: Record<StyleId, StyleFits> = {
  bodega_drip: {
    tops: ["puffer", "hoodie", "zip"], bottoms: ["pants", "shorts", "leggings"],
    topColors: ["#E8692E", "#E0457B", "#2F6FDB", "#26232D", "#F4F1EA", "#5B8C3A"],
    bottomColors: ["#5B5A4A", "#26232D", "#3D5A80", "#8A7A62", "#C9C3B8", "#7A2E3B"],
    shoeColors: ["#F4F1EA", "#26232D", "#E8692E", "#2F6FDB", "#C9A227", "#9A9A9A"],
  },
  thrift_store_icon: {
    tops: ["cardigan", "tee", "vest"], bottoms: ["pants", "skirt", "shorts"],
    topColors: ["#D9A43A", "#8DB38A", "#B0603F", "#7A3E2B", "#E9DFC9", "#4C6A92"],
    bottomColors: ["#4C6A92", "#B0603F", "#5B5A4A", "#3A2418", "#C9B8A0", "#7A2E3B"],
    shoeColors: ["#3A2418", "#F4F1EA", "#7A2E3B", "#26232D", "#D9A43A", "#8A7A62"],
  },
  midtown_finance: {
    tops: ["vest", "blazer", "zip"], bottoms: ["pants", "skirt", "shorts"],
    topColors: ["#23314F", "#7A2E3B", "#3A3742", "#8A8794", "#F1E6D4", "#2F5D50"],
    bottomColors: ["#C2AE86", "#3A3742", "#23314F", "#1F1B26", "#8A8794", "#5B5A4A"],
    shoeColors: ["#5A3420", "#1F1B26", "#8A6A52", "#ECE6DC", "#7A2E3B", "#3A3742"],
  },
  night_owl_goth: {
    tops: ["hoodie", "crop", "blazer"], bottoms: ["skirt", "pants", "leggings"],
    topColors: ["#1A161F", "#6E2B5E", "#3E5C76", "#2A2733", "#7A2E3B", "#C9C3CF"],
    bottomColors: ["#14111A", "#2A2733", "#6E2B5E", "#3E5C76", "#4A4452", "#7A2E3B"],
    shoeColors: ["#0E0C12", "#2A2733", "#6E2B5E", "#C9C3CF", "#7A2E3B", "#3E5C76"],
  },
  pilates_princess: {
    tops: ["crop", "tee", "zip"], bottoms: ["leggings", "shorts", "skirt"],
    topColors: ["#F2B8C6", "#A7D8C9", "#FFFFFF", "#C9B8E8", "#F6E7B8", "#9FD8C4"],
    bottomColors: ["#E9A3B6", "#3F5A66", "#F2E4C9", "#C9B8E8", "#26232D", "#9FD8C4"],
    shoeColors: ["#FFFFFF", "#F2B8C6", "#26232D", "#9FD8C4", "#C9B8E8", "#F6E7B8"],
  },
  startup_founder: {
    tops: ["zip", "hoodie", "tee"], bottoms: ["pants", "leggings", "shorts"],
    topColors: ["#8A8794", "#C9B8E8", "#26232D", "#2F6FDB", "#40B589", "#ECE6DC"],
    bottomColors: ["#1F1B26", "#2E2A38", "#8A8794", "#3D5A80", "#C2AE86", "#5B5A4A"],
    shoeColors: ["#ECE6DC", "#FFFFFF", "#1F1B26", "#40B589", "#2F6FDB", "#8A8794"],
  },
  influencer_soft_glam: {
    tops: ["blazer", "crop", "cardigan"], bottoms: ["skirt", "pants", "leggings"],
    topColors: ["#F1E6D4", "#D8C3A5", "#FFB3D1", "#C9B8E8", "#F2B8C6", "#FFFFFF"],
    bottomColors: ["#C9A98A", "#F1E6D4", "#FFB3D1", "#26232D", "#D7B9A0", "#C9B8E8"],
    shoeColors: ["#6E5240", "#8A6A52", "#FFFFFF", "#FFB3D1", "#26232D", "#D7B9A0"],
  },
  arcade_nerd: {
    tops: ["tee", "hoodie", "zip"], bottoms: ["shorts", "pants", "leggings"],
    topColors: ["#6B4FD8", "#FF7AA8", "#40B589", "#26232D", "#FFC21A", "#2F6FDB"],
    bottomColors: ["#4F5A3A", "#2B3A67", "#26232D", "#8A7A62", "#6B4FD8", "#C9C3B8"],
    shoeColors: ["#D93A2F", "#FFFFFF", "#26232D", "#6B4FD8", "#FFC21A", "#40B589"],
  },
};

/** A stored fit is valid only if every piece and color is on its style's lists. */
export function isValidFit(style: StyleId, fit: unknown): fit is Fit {
  const f = fit as Partial<Fit> | null;
  const o = STYLE_FITS[style];
  return !!f && typeof f === "object" && o.tops.includes(f.top as TopKind) && o.bottoms.includes(f.bottom as BottomKind)
    && o.topColors.includes(f.topColor ?? "") && o.bottomColors.includes(f.bottomColor ?? "") && o.shoeColors.includes(f.shoeColor ?? "");
}

/** The fit a style starts with for a presentation. */
export function defaultFit(style: StartingStyle, body: "straight" | "curvy"): Fit {
  const o = styleOutfit(style, body);
  return { top: o.top, topColor: o.topColor, bottom: o.bottom, bottomColor: o.bottomColor, shoeColor: o.shoeColor };
}

/** The outfit to draw: the style's (accent and accessory) with the player's fit on top. */
export function starterOutfit(style: StartingStyle, body: "straight" | "curvy", fit?: Fit | null): Outfit {
  const o = styleOutfit(style, body);
  return fit ? { ...o, ...fit } : o;
}
