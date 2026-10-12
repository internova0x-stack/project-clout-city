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
export type HairKind = "short" | "long" | "bun" | "braids" | "curly";

export interface Outfit {
  top: TopKind;
  topColor: string;
  topAccent: string;
  bottom: BottomKind;
  bottomColor: string;
  shoeColor: string;
  accessory: AccessoryKind;
  accessoryColor: string;
}

export interface StartingStyle {
  id: StyleId;
  label: string;
  emoji: string;
  blurb: string;
  starterItems: string[];
  outfit: Outfit;
  /** Default hair for the preview; players can change hair freely later. */
  hair: HairKind;
  hairColor: string;
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
    hair: "short", hairColor: "#1B1410",
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
    hair: "curly", hairColor: "#5A3420",
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
    hair: "short", hairColor: "#6B4A2E",
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
    hair: "long", hairColor: "#0E0C12",
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
    hair: "bun", hairColor: "#B88A4A",
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
    hair: "short", hairColor: "#2A1C14",
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
    hair: "long", hairColor: "#8A5A34",
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
    hair: "braids", hairColor: "#1B1410",
  },
];

export const STYLE_IDS = STARTING_STYLES.map((s) => s.id);

export function getStyle(id: string | null | undefined): StartingStyle {
  return STARTING_STYLES.find((s) => s.id === id) ?? STARTING_STYLES[0];
}

export function isStyleId(id: unknown): id is StyleId {
  return typeof id === "string" && (STYLE_IDS as string[]).includes(id);
}

/** Skin tones for the Look step: a free choice for every style. */
export const SKIN_TONES = [
  "#FFDFC4", "#F0C8A0", "#E0AC69", "#C68642", "#A0673C", "#8D5524", "#6B3E1F", "#4A2A16",
] as const;

export interface Look {
  style: StyleId;
  skin: string;
}

export const DEFAULT_LOOK: Look = { style: "bodega_drip", skin: SKIN_TONES[3] };

export function isSkinTone(value: unknown): value is string {
  return typeof value === "string" && (SKIN_TONES as readonly string[]).includes(value);
}
