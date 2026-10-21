// The Shop catalog's clothes on the new bodies (stage 4 of the avatar and Shop upgrade; owner, Oct 21: "go"). Every
// top, bottom, dress and pair of shoes in content/shop/*.json is worn as the game's garment templates in its colors,
// with its details, fabric pattern and finish, read from its description. A dress (slot "one-piece") is a top and a
// bottom at once. Clout Couture's suit and heels came with stage 5 (migration 0102).
//
// Some shapes are approximations the shader dresses up: shoes have no heel height (the bodies' feet stay flat), a
// platform is drawn on an ordinary sole, a cropped puffer or windbreaker keeps the template's length.

import { GARMENT_DETAILS, GARMENT_TEMPLATES, type SetPiece } from "./avatarCatalog.ts";

/** Fabric patterns, as bit flags (components/avatar/baseAvatar.ts garmentMaterial draws them). */
export const PATTERN = {
  denim: 1, knit: 2, tartan: 4, pinstripe: 8, herringbone: 16, mesh: 32, holes: 64, cable: 128, rib: 256, waffle: 512,
  patchwork: 1024, panels: 2048, sleeves: 4096, lacing: 8192, sandal: 16384, glowSole: 32768, strap: 65536, gingham: 131072,
  fur: 262144, cargo: 524288, ruffle: 1048576,
} as const;

export type CatalogSlot = "top" | "bottom" | "one-piece" | "shoes";
export interface CatalogWear { slot: CatalogSlot; pieces: SetPiece[] }

const P = PATTERN;
const { plain, quilted, dressShoes } = GARMENT_DETAILS;
/** The cardigan's buttons down a closed front: a shirt. */
const BUTTONED = 6;
const top = (...pieces: SetPiece[]): CatalogWear => ({ slot: "top", pieces });
const bottom = (piece: SetPiece): CatalogWear => ({ slot: "bottom", pieces: [piece] });
const dress = (...pieces: SetPiece[]): CatalogWear => ({ slot: "one-piece", pieces });
const shoes = (piece: SetPiece): CatalogWear => ({ slot: "shoes", pieces: [piece] });

export const CATALOG_WEAR: Record<string, CatalogWear> = {
  // Tops
  "cloud-puffer": top({ file: "puffer", color: "#14111A", accent: "#E8692E" }),
  "midnight-buckle-coat": top({ file: "zip", color: "#14111A", accent: "#D9DDE3", finish: "leather" }, { file: "coattail", color: "#14111A", accent: "#D9DDE3", finish: "leather" }),
  "library-card-cardigan": top({ file: "cardigan", color: "#2E3A55", accent: "#EDE3CF", pattern: P.cable }),
  "lilac-lap-track-jacket": top({ file: "zip", color: "#B9A2D8", accent: "#F4F1EA" }),
  "midtown-camel-blazer": top({ file: "blazer", color: "#B5835A", accent: "#6B4A2B" }),
  "old-money-cashmere-coat": top({ file: "cardigan", color: "#EDE3CF", accent: "#C2AE86", kind: plain }, { file: "coattail", color: "#EDE3CF", accent: "#C2AE86" }),
  "sartorio-sculpt-jacket": top({ file: "blazer", color: "#5E7B3A", accent: "#E8735A", pattern: P.panels }),
  "forest-floor-hoodie": top({ file: "hoodie", color: "#2F5D3A", accent: "#2F5D3A" }),
  "alumni-of-nothing-varsity": top({ file: "zip", color: "#14111A", accent: "#EDE3CF", kind: quilted, pattern: P.sleeves, finish: "leather" }),
  "fishnet-fridays-top": top({ file: "zip", color: "#14111A", accent: "#14111A", kind: plain, pattern: P.mesh, cover: 0 }),
  "chained-heart-corset": top({ file: "vest", color: "#14111A", accent: "#D9DDE3", kind: plain, pattern: P.lacing }),
  "crisp-monday-shirt": top({ file: "zip", color: "#F7F5F0", accent: "#C9CED6", kind: BUTTONED }),
  "baby-pink-rib-crop": top({ file: "crop", color: "#F4B6C8", accent: "#F4B6C8", pattern: P.rib }),
  "unfinished-business-tee": top({ file: "tee", color: "#B5532E", accent: "#8A8F96", pattern: P.panels }),
  "trust-fund-quarter-zip": top({ file: "zip", color: "#D8CBB0", accent: "#B5835A", pattern: P.knit }),
  "faculty-lounge-tweed-blazer": top({ file: "blazer", color: "#6B5E4E", accent: "#4A3A2C", pattern: P.herringbone }),
  "corner-office-pinstripe-jacket": top({ file: "blazer", color: "#1F2A44", accent: "#A9B0BC", pattern: P.pinstripe }),
  "sky-lap-windbreaker": top({ file: "zip", color: "#8FC4E8", accent: "#F4F1EA", finish: "satin" }),
  "survived-something-hoodie": top({ file: "hoodie", color: "#E8E2D6", accent: "#C8BFAE", pattern: P.holes }),
  "dune-cloud-puffer": top({ file: "puffer", color: "#D4C29C", accent: "#B8A47E", finish: "matte" }),
  "moth-approved-knit": top({ file: "zip", color: "#D8CBB0", accent: "#D8CBB0", kind: plain, pattern: P.knit | P.holes }),
  "unfinished-thought-thermal": top({ file: "zip", color: "#4A4F57", accent: "#4A4F57", kind: plain, pattern: P.waffle }),
  "inherited-barn-jacket": top({ file: "zip", color: "#C2A57A", accent: "#6B4A2B", pattern: P.denim }),
  "nowhere-to-be-vest": top({ file: "vest", color: "#8A8F96", accent: "#5A5F66" }),
  "expedition-to-brunch-parka": top({ file: "zip", color: "#5E6B3A", accent: "#3F4A2E", pattern: P.holes }, { file: "coattail", color: "#5E6B3A", accent: "#3F4A2E" }),
  "already-vintage-denim-jacket": top({ file: "zip", color: "#C9B48A", accent: "#8C7A55", pattern: P.denim | P.holes }),
  "lilac-lap-sports-bra": top({ file: "crop", color: "#B9A2D8", accent: "#B9A2D8", kind: plain }),
  "snow-day-faux-fur": top({ file: "puffer", color: "#F2EDE2", accent: "#E0D8C8", kind: plain, pattern: P.fur, finish: "matte" }),
  "rooftop-halter": top({ file: "vest", color: "#E0186F", accent: "#E0186F", kind: plain, finish: "satin" }),
  "seamless-night-bodysuit": top({ file: "zip", color: "#14111A", accent: "#14111A", kind: plain }),
  "commuter-trench": top({ file: "blazer", color: "#C8B08A", accent: "#8C7A55" }, { file: "coattail", color: "#C8B08A", accent: "#8C7A55" }),
  // Bottoms
  "champagne-hour-trousers": bottom({ file: "pants", color: "#E8D9B5", accent: "#E8D9B5", finish: "satin" }),
  "study-hall-tartan-skirt": bottom({ file: "skirt", color: "#2E3A55", accent: "#2F5D3A", pattern: P.tartan }),
  "mint-condition-leggings": bottom({ file: "leggings", color: "#A8E6CF", accent: "#A8E6CF" }),
  "quarterly-review-trousers": bottom({ file: "pants", color: "#3A3F47", accent: "#3A3F47" }),
  "second-life-denim-trousers": bottom({ file: "pants", color: "#6F8FB3", accent: "#A9BFD6", pattern: P.patchwork | P.denim }),
  "every-pocket-cargos": bottom({ file: "pants", color: "#5E6B3A", accent: "#5E6B3A", pattern: P.cargo }),
  "emerald-satin-slip-skirt": bottom({ file: "midi", color: "#1F6B4A", accent: "#1F6B4A", finish: "satin" }),
  "post-apocalypse-lounge-pants": bottom({ file: "pants", color: "#6E7681", accent: "#6E7681", pattern: P.knit }),
  "match-point-skirt": bottom({ file: "skirt", color: "#F7F5F0", accent: "#F7F5F0" }),
  "lilac-lap-biker-shorts": bottom({ file: "shorts", color: "#B9A2D8", accent: "#B9A2D8" }),
  "block-party-mini-skirt": bottom({ file: "skirt", color: "#9DB7D5", accent: "#9DB7D5", kind: plain, pattern: P.denim | P.holes }),
  // Dresses: a top and a bottom in one
  "after-hours-mini": dress({ file: "vest", color: "#14111A", accent: "#14111A", kind: plain }, { file: "skirt", color: "#14111A", accent: "#14111A", kind: plain }),
  // Clout Couture: a midnight-blue three-piece with a gold silk lining (the jacket and trousers as one piece).
  "sartorio-bespoke-suit": dress({ file: "blazer", color: "#1B2440", accent: "#D4AF37" }, { file: "pants", color: "#1B2440", accent: "#1B2440" }),
  "red-carpet-rehearsal-gown": dress({ file: "vest", color: "#E8D9B5", accent: "#E8D9B5", kind: plain, finish: "satin" }, { file: "gown", color: "#E8D9B5", accent: "#E8D9B5", finish: "satin" }),
  "midnight-velvet-dress": dress({ file: "vest", color: "#14111A", accent: "#4A4F57", kind: plain, pattern: P.lacing, finish: "velvet" }, { file: "midi", color: "#14111A", accent: "#14111A", finish: "velvet" }),
  "board-meeting-wrap-dress": dress({ file: "cardigan", color: "#1F6B4A", accent: "#1F6B4A", kind: plain }, { file: "midi", color: "#1F6B4A", accent: "#1F6B4A" }),
  "sartorio-ruffle-dress": dress({ file: "vest", color: "#E8735A", accent: "#E8735A", kind: plain }, { file: "skirt", color: "#E8735A", accent: "#E8735A", kind: plain, pattern: P.ruffle }),
  "moth-approved-maxi": dress({ file: "zip", color: "#D8CBB0", accent: "#D8CBB0", kind: plain, pattern: P.knit | P.holes }, { file: "gown", color: "#D8CBB0", accent: "#D8CBB0", pattern: P.knit | P.holes }),
  "corner-picnic-sundress": dress({ file: "vest", color: "#F2C230", accent: "#F7F5F0", kind: plain, pattern: P.gingham }, { file: "midi", color: "#F2C230", accent: "#F7F5F0", pattern: P.gingham }),
  // Shoes
  "cloud-step-hitops": shoes({ file: "sneakers", color: "#F7F5F0", accent: "#D9DDE3" }),
  "nightshift-platforms": shoes({ file: "boots", color: "#14111A", accent: "#D9DDE3", finish: "leather" }),
  "honor-roll-loafers": shoes({ file: "sneakers", color: "#6B3F1F", accent: "#3A2414", kind: dressShoes, pattern: P.strap }),
  "glow-lap-runners": shoes({ file: "sneakers", color: "#FF7A59", accent: "#FFD3C4", pattern: P.glowSole }),
  // Clout Couture: black patent with mirror-gold soles.
  "gilded-sole-heels": shoes({ file: "sneakers", color: "#0E0C10", accent: "#D4AF37", kind: dressShoes, finish: "patent", cover: 0 }),
  "gala-gold-heels": shoes({ file: "sneakers", color: "#C9A227", accent: "#E9F4FF", kind: dressShoes, pattern: P.sandal, finish: "patent", cover: 0 }),
  "lime-sculpt-clogs": shoes({ file: "sneakers", color: "#B8D84A", accent: "#8FAF2E", kind: dressShoes, finish: "matte" }),
  "never-worked-a-day-boots": shoes({ file: "boots", color: "#7A5A3A", accent: "#4A3422", finish: "suede" }),
  "pre-destroyed-runners": shoes({ file: "sneakers", color: "#A9ADB3", accent: "#6E7681", pattern: P.holes }),
  "stomping-ground-boots": shoes({ file: "kneeboots", color: "#14111A", accent: "#2B2B2B", finish: "leather" }),
  "hall-pass-mary-janes": shoes({ file: "sneakers", color: "#14111A", accent: "#D9DDE3", kind: dressShoes, pattern: P.strap, finish: "patent" }),
  "out-of-office-slingbacks": shoes({ file: "sneakers", color: "#E3C3A8", accent: "#B08A6E", kind: dressShoes }),
  "recital-ballet-flats": shoes({ file: "sneakers", color: "#F4C6CF", accent: "#E8A6B4", kind: dressShoes, pattern: P.strap }),
  "sidewalk-throne-sandals": shoes({ file: "sneakers", color: "#EDE3CF", accent: "#EDE3CF", kind: dressShoes, pattern: P.sandal, cover: 0 }),
};

/** The worn catalog clothes' pieces by the slot each fills (a dress fills top and bottom; a later item wins a slot). */
export function catalogPieces(skus: readonly string[]): Partial<Record<"top" | "bottom" | "shoes", SetPiece[]>> {
  const out: Partial<Record<"top" | "bottom" | "shoes", SetPiece[]>> = {};
  for (const sku of skus) {
    const w = CATALOG_WEAR[sku];
    if (!w) continue;
    const by: Partial<Record<"top" | "bottom" | "shoes", SetPiece[]>> = {};
    for (const p of w.pieces) { const slot = GARMENT_TEMPLATES[p.file]?.slot; if (slot) (by[slot] ??= []).push(p); }
    Object.assign(out, by);
  }
  return out;
}
