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
};

/** The templates an outfit wears on the new bodies, with their colors (whole Shop outfits wait for stage 4's sets). */
export function garmentsFor(o: Pick<Outfit, "top" | "topColor" | "topAccent" | "bottom" | "bottomColor" | "shoes" | "shoeColor" | "shoeAccent" | "set">) {
  if (o.set) return [];
  const pick = (file: string, color: string, accent: string) => (GARMENT_TEMPLATES[file] ? [{ file, ...GARMENT_TEMPLATES[file], color, accent }] : []);
  return [
    ...pick(o.top, o.topColor, o.topAccent),
    ...pick(o.bottom, o.bottomColor, o.topAccent),
    ...(o.shoes ? pick(o.shoes, o.shoeColor, o.shoeAccent ?? "#2B2B2B") : []),
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
