// Which modeled pieces (public/avatars, Quaternius Ultimate Modular Men and Women, CC0) the avatar
// wears for each Look and Outfit choice. Every character file is four skinned parts on one shared
// skeleton (Head, Body, Legs, Feet), so a look mixes parts from different files. Pure data, so tests
// can check every choice has a piece.

import type { HairId, Look } from "./look.ts";
import type { BottomKind, Outfit, ShoeKind, TopKind } from "./styles.ts";

/** The model set: men's or women's files (Presenting as: "curvy" is Female). */
export type ModelSex = "m" | "f";
export type PartSlot = "head" | "body" | "legs" | "feet";

/** One part from one character file, e.g. the Body of f/Suit.glb. */
export interface PartRef { sex: ModelSex; file: string }

export const MODEL_FILES: Record<ModelSex, readonly string[]> = {
  m: ["Adventurer", "Beach", "Casual_2", "Casual_Hoodie", "Farmer", "King", "Punk", "Spacesuit", "Suit", "Swat", "Worker"],
  f: ["Adventurer", "Casual", "Formal", "Medieval", "Punk", "SciFi", "Soldier", "Suit", "Witch", "Worker"],
};

export const modelSex = (look: Pick<Look, "body">): ModelSex => (look.body === "curvy" ? "f" : "m");

/** The face every avatar wears (its own hair is hidden; the Look's hair goes on top). */
export const FACE: Record<ModelSex, string> = { m: "Casual_2", f: "Casual" };

/**
 * Garment templates on the new base bodies (stages 3 and 4 of the avatar upgrade): the file in public/avatars/garments/
 * (built by scripts/build-base-avatars.mjs: scripts/garments.mjs and scripts/wardrobe.mjs), its cover bit (the skin it
 * hides; the build's COVER and WARDROBE bits) and its shader details (kind). An outfit wears one per slot.
 */
export const GARMENT_TEMPLATES: Record<string, { cover: number; slot: "top" | "bottom" | "shoes"; kind: number; hem?: number }> = {
  // hem: a top's hem, in meters above the top of the legs (scripts/wardrobe.mjs); a bottom under it isn't drawn above.
  hoodie: { cover: 1, slot: "top", kind: 1, hem: 0 }, tee: { cover: 2, slot: "top", kind: 2, hem: 0 }, crop: { cover: 4, slot: "top", kind: 3, hem: 0.2 },
  vest: { cover: 8, slot: "top", kind: 4, hem: 0.02 }, zip: { cover: 16, slot: "top", kind: 5, hem: 0.02 }, cardigan: { cover: 32, slot: "top", kind: 6, hem: 0 },
  blazer: { cover: 64, slot: "top", kind: 7, hem: 0 }, puffer: { cover: 128, slot: "top", kind: 8, hem: 0.01 },
  pants: { cover: 256, slot: "bottom", kind: 9 }, shorts: { cover: 512, slot: "bottom", kind: 10 }, leggings: { cover: 1024, slot: "bottom", kind: 11 },
  skirt: { cover: 2048, slot: "bottom", kind: 12 }, boots: { cover: 4096, slot: "shoes", kind: 13 },
  sneakers: { cover: 8192, slot: "shoes", kind: 14 },
  // Only in whole outfits (SET_LOOKS): a gown or robe's long skirt, and overalls (worn over a top).
  gown: { cover: 16384, slot: "bottom", kind: 15 }, overalls: { cover: 32768, slot: "bottom", kind: 16 },
};

/**
 * The shader's details beyond each template's own (components/avatar/baseAvatar.ts garmentMaterial): a set's piece can
 * wear a template with another look, e.g. a zip jacket as a hi-vis jacket or a plain robe.
 */
export const GARMENT_DETAILS = { plain: 2, quilted: 8, dressShoes: 17, hiVis: 18, ripped: 19 } as const;

/** Hats and helmets the whole outfits wear on the new bodies (components/avatar/setHats.ts). */
export type SetHat = "hardhat" | "cowboy" | "explorer" | "helmet" | "witch" | "hood" | "space" | "crown";

/** One piece of a whole outfit on the new bodies: a garment template, its colors, and optionally other details. */
export interface SetPiece { file: string; color: string; accent: string; kind?: number }
export interface SetLook {
  pieces: SetPiece[];
  hat?: { kind: SetHat; color: string; accent: string };
}

const { plain, quilted, dressShoes, hiVis, ripped } = GARMENT_DETAILS;
const both = (look: SetLook) => ({ m: look, f: look });

/**
 * Whole Shop outfits on the new bodies (stage 4, owner Oct 21: "go"): each is the game's own garment templates in the
 * outfit's colors, with its own details and hat, instead of a character from the old pack. A chosen faith or culture
 * covering always stays (KEEPS_COVERING); the hat steps aside for it.
 */
export const SET_LOOKS: Record<string, { m: SetLook; f: SetLook }> = {
  "site-crew": both({
    pieces: [{ file: "zip", color: "#F2A541", accent: "#D9DDE3", kind: hiVis }, { file: "pants", color: "#2E3A55", accent: "#2E3A55" }, { file: "boots", color: "#6B4A2B", accent: "#2B2B2B" }],
    hat: { kind: "hardhat", color: "#F2C230", accent: "#C99A12" },
  }),
  "st-marks-punk": {
    m: { pieces: [{ file: "zip", color: "#14111A", accent: "#C9CED6" }, { file: "pants", color: "#23262E", accent: "#23262E", kind: ripped }, { file: "boots", color: "#14111A", accent: "#3A3F47" }] },
    f: { pieces: [{ file: "zip", color: "#14111A", accent: "#C9CED6" }, { file: "skirt", color: "#8E1F2F", accent: "#14111A" }, { file: "boots", color: "#14111A", accent: "#3A3F47" }] },
  },
  "gala-night": {
    m: { pieces: [{ file: "blazer", color: "#4E7A3A", accent: "#C9A227" }, { file: "pants", color: "#14111A", accent: "#14111A" }, { file: "sneakers", color: "#14111A", accent: "#0E0C10", kind: dressShoes }] },
    f: { pieces: [{ file: "vest", color: "#4E7A3A", accent: "#C9A227", kind: plain }, { file: "gown", color: "#4E7A3A", accent: "#C9A227" }, { file: "sneakers", color: "#C9A227", accent: "#8C6D12", kind: dressShoes }] },
  },
  "ranch-hand": both({
    pieces: [{ file: "tee", color: "#B33A3A", accent: "#F4F1EA" }, { file: "overalls", color: "#5B7FA6", accent: "#C9A227" }, { file: "boots", color: "#6B4A2B", accent: "#3A2A1C" }],
    hat: { kind: "cowboy", color: "#C2AE86", accent: "#5A3A22" },
  }),
  "rockaway-beach": {
    m: { pieces: [{ file: "vest", color: "#F4F1EA", accent: "#B33A3A", kind: plain }, { file: "shorts", color: "#B33A3A", accent: "#F4F1EA" }, { file: "sneakers", color: "#F4F1EA", accent: "#B33A3A" }] },
    f: { pieces: [{ file: "crop", color: "#B33A3A", accent: "#F4F1EA" }, { file: "shorts", color: "#2E7FB3", accent: "#F4F1EA" }, { file: "sneakers", color: "#F4F1EA", accent: "#B33A3A" }] },
  },
  adventurer: both({
    pieces: [{ file: "zip", color: "#5E7B3A", accent: "#C2AE86" }, { file: "pants", color: "#C2AE86", accent: "#C2AE86" }, { file: "boots", color: "#5A3A22", accent: "#2B2B2B" }],
    hat: { kind: "explorer", color: "#8C6A4F", accent: "#3A2A1C" },
  }),
  tactical: {
    m: { pieces: [{ file: "zip", color: "#3A3F47", accent: "#14111A" }, { file: "pants", color: "#4A4F57", accent: "#4A4F57" }, { file: "boots", color: "#14111A", accent: "#2B2B2B" }], hat: { kind: "helmet", color: "#4A5A3A", accent: "#2B2B2B" } },
    f: { pieces: [{ file: "vest", color: "#4A5A3A", accent: "#14111A" }, { file: "leggings", color: "#3A3F47", accent: "#3A3F47" }, { file: "boots", color: "#14111A", accent: "#2B2B2B" }] },
  },
  witch: both({
    pieces: [{ file: "zip", color: "#5B2C8F", accent: "#C9A227", kind: plain }, { file: "gown", color: "#5B2C8F", accent: "#C9A227" }, { file: "boots", color: "#14111A", accent: "#2B2B2B" }],
    hat: { kind: "witch", color: "#3A1C5C", accent: "#C9A227" },
  }),
  ranger: both({
    pieces: [{ file: "zip", color: "#5A3A22", accent: "#3A2A1C", kind: plain }, { file: "leggings", color: "#3A3F2A", accent: "#3A3F2A" }, { file: "boots", color: "#5A3A22", accent: "#2B2B2B" }],
    hat: { kind: "hood", color: "#3F4A2E", accent: "#2B2F20" },
  }),
  spacefarer: {
    m: { pieces: [{ file: "puffer", color: "#E8692E", accent: "#D9DDE3" }, { file: "pants", color: "#E8692E", accent: "#D9DDE3", kind: quilted }, { file: "boots", color: "#D9DDE3", accent: "#3A3F47" }], hat: { kind: "space", color: "#D9DDE3", accent: "#E8692E" } },
    f: { pieces: [{ file: "zip", color: "#D9DDE3", accent: "#E8692E" }, { file: "leggings", color: "#E8692E", accent: "#E8692E" }, { file: "boots", color: "#D9DDE3", accent: "#3A3F47" }] },
  },
  royalty: {
    m: { pieces: [{ file: "blazer", color: "#7A1F2B", accent: "#C9A227" }, { file: "pants", color: "#F4F1EA", accent: "#F4F1EA" }, { file: "boots", color: "#14111A", accent: "#C9A227" }], hat: { kind: "crown", color: "#C9A227", accent: "#B33A3A" } },
    f: { pieces: [{ file: "blazer", color: "#7A1F2B", accent: "#C9A227" }, { file: "gown", color: "#7A1F2B", accent: "#C9A227" }, { file: "sneakers", color: "#C9A227", accent: "#8C6D12", kind: dressShoes }], hat: { kind: "crown", color: "#C9A227", accent: "#B33A3A" } },
  },
};

/** The templates an outfit wears on the new bodies, with their colors. The bodies are barefoot in a plain base layer,
 *  so shoes without a template of their own are sneakers; a whole Shop outfit wears its own pieces (SET_LOOKS). */
export function garmentsFor(o: Pick<Outfit, "top" | "topColor" | "topAccent" | "bottom" | "bottomColor" | "shoes" | "shoeColor" | "shoeAccent" | "set">, sex: ModelSex = "m") {
  const set = o.set ? SET_LOOKS[o.set]?.[sex] : undefined;
  if (set) return set.pieces.filter((p) => GARMENT_TEMPLATES[p.file]).map((p) => ({ ...GARMENT_TEMPLATES[p.file], ...p, kind: p.kind ?? GARMENT_TEMPLATES[p.file].kind }));
  const pick = (file: string, color: string, accent: string) => (GARMENT_TEMPLATES[file] ? [{ file, ...GARMENT_TEMPLATES[file], color, accent }] : []);
  return [
    ...pick(o.top, o.topColor, o.topAccent),
    ...pick(o.bottom, o.bottomColor, o.topAccent),
    ...pick(o.shoes && GARMENT_TEMPLATES[o.shoes] ? o.shoes : "sneakers", o.shoeColor, o.shoeAccent ?? "#2B2B2B"),
  ];
}

/** Tops: the character whose Body part is closest to each top. */
export const TOP_MODEL: Record<TopKind, Record<ModelSex, PartRef>> = {
  puffer: { m: { sex: "m", file: "Casual_Hoodie" }, f: { sex: "m", file: "Casual_Hoodie" } },
  cardigan: { m: { sex: "m", file: "Adventurer" }, f: { sex: "f", file: "Suit" } },
  vest: { m: { sex: "m", file: "Punk" }, f: { sex: "f", file: "Soldier" } },
  hoodie: { m: { sex: "m", file: "Casual_Hoodie" }, f: { sex: "m", file: "Casual_Hoodie" } },
  crop: { m: { sex: "m", file: "Beach" }, f: { sex: "f", file: "Punk" } },
  zip: { m: { sex: "m", file: "Casual_Hoodie" }, f: { sex: "f", file: "Soldier" } },
  blazer: { m: { sex: "m", file: "Suit" }, f: { sex: "f", file: "Suit" } },
  tee: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Casual" } },
};

/** Bottoms: the character whose Legs part is closest. */
export const BOTTOM_MODEL: Record<BottomKind, Record<ModelSex, PartRef>> = {
  pants: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Suit" } },
  skirt: { m: { sex: "f", file: "Formal" }, f: { sex: "f", file: "Formal" } },
  shorts: { m: { sex: "m", file: "Beach" }, f: { sex: "f", file: "Adventurer" } },
  leggings: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Casual" } },
};

/** Shoes follow the bottom (sneakers with pants, flats with a skirt...). */
export const FEET_MODEL: Record<BottomKind, Record<ModelSex, PartRef>> = {
  pants: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Casual" } },
  skirt: { m: { sex: "m", file: "Suit" }, f: { sex: "f", file: "Suit" } },
  shorts: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Punk" } },
  leggings: { m: { sex: "m", file: "Casual_2" }, f: { sex: "f", file: "Casual" } },
};

/** Shop shoes with their own shape: platform boots are the women's sci-fi boots; men wear the spacesuit's. */
export const SHOE_MODEL: Record<ShoeKind, Record<ModelSex, PartRef>> = {
  boots: { m: { sex: "m", file: "Spacesuit" }, f: { sex: "f", file: "SciFi" } },
};

/**
 * Hair the pack draws better than the game's own shapes, by file whose head carries it. Every other
 * style (and any hair under a hat or covering) uses the game's procedural hair on the Head bone.
 */
export const MODEL_HAIR: Record<ModelSex, Partial<Record<HairId, PartRef>>> = {
  m: { short: { sex: "m", file: "Suit" }, curls: { sex: "m", file: "Casual_Hoodie" }, ponytail: { sex: "m", file: "Casual_2" } },
  f: { short: { sex: "f", file: "Adventurer" }, long: { sex: "f", file: "Casual" } },
};

/** A material that is hair (not brows) on a head part: brows are tiny (<= 100 vertices). */
export const isHairMaterial = (name: string, vertices: number) =>
  (/^Hair/.test(name) && vertices > 100) || name === "Moustache";
export const isBrowMaterial = (name: string, vertices: number) =>
  name === "Eyebrows" || (name === "Hair_Brown" && vertices <= 100);
/** The eyes: "Eye" on men; a tiny "Brown" on women. */
export const isEyeMaterial = (name: string, vertices: number) => name === "Eye" || (name === "Brown" && vertices <= 64);
export const isSkinMaterial = (name: string) => /^Skin/.test(name);

/**
 * Whole outfits (Shop slot "outfit"): one character's Body, Legs and Feet in the pack's own colors,
 * plus what it wears on its head. City sets are sold for cash; fantasy sets also need clout
 * (owner, Oct 14: "something to work towards"), checked by buy_item. A presentation without its own
 * version wears the other one's, fitted to its skeleton.
 */
export interface OutfitSetPart {
  ref: PartRef;
  /** Head pieces to wear from the same file, by material ("helmet" hides the face, hair and headwear). */
  headgear?: string[] | "helmet";
  /** The headgear covers the hair (a hood). */
  hidesHair?: boolean;
}
export interface OutfitSet { id: string; m: OutfitSetPart; f: OutfitSetPart }

export const OUTFIT_SETS: OutfitSet[] = [
  { id: "site-crew", m: { ref: { sex: "m", file: "Worker" }, headgear: ["Worker_Yellow"] }, f: { ref: { sex: "f", file: "Worker" }, headgear: ["Worker_Yellow"] } },
  { id: "st-marks-punk", m: { ref: { sex: "m", file: "Punk" } }, f: { ref: { sex: "f", file: "Punk" } } },
  { id: "gala-night", m: { ref: { sex: "m", file: "Suit" } }, f: { ref: { sex: "f", file: "Formal" } } },
  { id: "ranch-hand", m: { ref: { sex: "m", file: "Farmer" }, headgear: ["Beige", "Red"] }, f: { ref: { sex: "m", file: "Farmer" }, headgear: ["Beige", "Red"] } },
  { id: "rockaway-beach", m: { ref: { sex: "m", file: "Beach" } }, f: { ref: { sex: "m", file: "Beach" } } },
  { id: "adventurer", m: { ref: { sex: "m", file: "Adventurer" } }, f: { ref: { sex: "f", file: "Adventurer" } } },
  { id: "tactical", m: { ref: { sex: "m", file: "Swat" }, headgear: "helmet" }, f: { ref: { sex: "f", file: "Soldier" } } },
  { id: "witch", m: { ref: { sex: "f", file: "Witch" }, headgear: ["Purple", "Gold"] }, f: { ref: { sex: "f", file: "Witch" }, headgear: ["Purple", "Gold"] } },
  { id: "ranger", m: { ref: { sex: "f", file: "Medieval" }, headgear: ["DarkBrown"], hidesHair: true }, f: { ref: { sex: "f", file: "Medieval" }, headgear: ["DarkBrown"], hidesHair: true } },
  { id: "spacefarer", m: { ref: { sex: "m", file: "Spacesuit" }, headgear: "helmet" }, f: { ref: { sex: "f", file: "SciFi" } } },
  { id: "royalty", m: { ref: { sex: "m", file: "King" }, headgear: ["Gold"] }, f: { ref: { sex: "m", file: "King" }, headgear: ["Gold"] } },
];
export const outfitSet = (id: string | null | undefined) => OUTFIT_SETS.find((o) => o.id === id);

/** Coverings a player chose for faith or culture: an outfit's hat or helmet never replaces them. */
export const KEEPS_COVERING = new Set(["hijab", "turban", "headwrap", "durag", "kippah"]);

/** The parts a look wears, before recoloring. */
export function modelParts(look: Pick<Look, "body">, top: TopKind, bottom: BottomKind, set?: string | null, shoes?: ShoeKind): Record<PartSlot, PartRef> {
  const sex = modelSex(look);
  const full = outfitSet(set)?.[sex];
  return {
    head: { sex, file: FACE[sex] },
    body: full?.ref ?? TOP_MODEL[top][sex],
    legs: full?.ref ?? BOTTOM_MODEL[bottom][sex],
    feet: full?.ref ?? (shoes ? SHOE_MODEL[shoes][sex] : FEET_MODEL[bottom][sex]),
  };
}
