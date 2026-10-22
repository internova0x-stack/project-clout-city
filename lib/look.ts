// Free Look options for every player (Clarifications section 1; Design System
// Guide section 12): body, skin, hair, hair color, eyes, glasses and coverings.
// None of these are ever sold in the Shop. The starting style only sets the outfit.

import { getStyle, isStyleId, isValidFit, styleOutfit, type Fit, type StyleId } from "./styles.ts";

export interface Option<T extends string> { id: T; label: string }

export type BodyId = "straight" | "curvy";
export type HairId = "short" | "buzz" | "long" | "ponytail" | "bun" | "braids" | "curls" | "locs" | "bald";
export type GlassesId = "none" | "round" | "square" | "shades";
/** Headwear (stored as `covering` for older rows): free basics first, then cultural and religious coverings (v0.7, #46). */
export type CoveringId = "none" | "cap" | "fedora" | "bucket" | "durag" | "hijab" | "turban" | "headwrap" | "kippah";
/** Body types (v0.7, #44): four per presentation. Cosmetic only, like Presenting as. */
export type BuildId = "slim" | "athletic" | "broad" | "plus" | "petite" | "curvy";

// "Presenting as" (Clarifications section 16): cosmetic only. It picks the avatar's build,
// is never shown as a label and is never used by dating, crews or rankings. The stored ids
// predate the rename and stay as they are. Four body types each arrive in v0.7.
/** What kind of New Yorker the player is (owner, Oct 22): picked in the creator, shown on the profile. Identity only. */
export type NyerId = "native" | "transplant" | "new" | "future";
export const NYERS: { id: NyerId; label: string; sub: string; emoji: string }[] = [
  { id: "native", emoji: "🗽", label: "Native New Yorker", sub: "You already know ball. Let's go!" },
  { id: "transplant", emoji: "🧳", label: "Transplant New Yorker", sub: "More New York than those born in New York." },
  { id: "new", emoji: "✨", label: "New New Yorker", sub: "Experience something new every day." },
  { id: "future", emoji: "✈️", label: "Future Immigrant", sub: "Experience NY before you make the big move." },
];
export const nyerLabel = (id: NyerId | undefined) => { const n = NYERS.find((x) => x.id === id); return n ? `${n.emoji} ${n.label}` : null; };

export const BODIES: Option<BodyId>[] = [
  { id: "straight", label: "Male" },
  { id: "curvy", label: "Female" },
];

export const BUILDS: Record<BodyId, Option<BuildId>[]> = {
  straight: [{ id: "slim", label: "Slim" }, { id: "athletic", label: "Athletic" }, { id: "broad", label: "Broad" }, { id: "plus", label: "Plus" }],
  curvy: [{ id: "petite", label: "Petite" }, { id: "athletic", label: "Athletic" }, { id: "curvy", label: "Curvy" }, { id: "plus", label: "Plus" }],
};
/** The build each presentation had before body types existed (so older avatars don't change). */
export const DEFAULT_BUILD: Record<BodyId, BuildId> = { straight: "athletic", curvy: "curvy" };

export const HAIRS: Option<HairId>[] = [
  { id: "short", label: "Short" },
  { id: "buzz", label: "Buzz cut" },
  { id: "long", label: "Long" },
  { id: "ponytail", label: "Ponytail" },
  { id: "bun", label: "Top bun" },
  { id: "braids", label: "Braids" },
  { id: "curls", label: "Curls" },
  { id: "locs", label: "Locs" },
  { id: "bald", label: "Bald" },
];

export const GLASSES: Option<GlassesId>[] = [
  { id: "none", label: "None" },
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "shades", label: "Shades" },
];

/**
 * Free basic headwear, listed first (premium hats are sold in the Shop). One basic hat, in one color (owner, Oct 22): the
 * cap, always FREE_CAP_COLOR. The fedora and the bucket hat are gone; a saved one reads as no hat.
 */
export const HEADWEAR_BASIC: Option<CoveringId>[] = [
  { id: "none", label: "None" },
  { id: "cap", label: "Cap" },
];
export const FREE_CAP_COLOR = "#1F1B26";
/**
 * Cultural and religious coverings, after the basics. The hijab was taken out (owner, Oct 22: a sensitive cultural piece
 * that needs a lot of care); a saved one reads as no covering.
 */
export const HEADWEAR_CULTURAL: Option<CoveringId>[] = [
  { id: "durag", label: "Durag" },
  { id: "turban", label: "Turban" },
  { id: "headwrap", label: "Headwrap" },
  { id: "kippah", label: "Kippah" },
];
export const COVERINGS: Option<CoveringId>[] = [...HEADWEAR_BASIC, ...HEADWEAR_CULTURAL];

export const SKIN_TONES = [
  "#FFDFC4", "#F0C8A0", "#E0AC69", "#C68642", "#A0673C", "#8D5524", "#6B3E1F", "#4A2A16",
] as const;

export const HAIR_COLORS = [
  "#14100E", "#3B2417", "#6B4423", "#A0522D", "#D4A15A", "#E8D7B0", "#9A9A9A", "#E0457B",
] as const;

export const EYE_COLORS = ["#3B2314", "#6B4423", "#8E7340", "#4F7A4A", "#4A79A8", "#7D8A96"] as const;

export interface Look {
  style: StyleId;
  body: BodyId;
  build: BuildId;
  skin: string;
  hair: HairId;
  hairColor: string;
  eyes: string;
  glasses: GlassesId;
  covering: CoveringId;
  /** The starter outfit pick; null wears the style's own outfit. */
  fit: Fit | null;
  /** What kind of New Yorker (owner, Oct 22); players from before it have none. */
  nyer?: NyerId;
}

/** The free choices stored in players.look (the style has its own column). */
export type LookChoices = Omit<Look, "style">;

export const DEFAULT_LOOK: Look = {
  style: "bodega_drip",
  body: "straight",
  build: "athletic",
  skin: SKIN_TONES[1],
  hair: "short",
  hairColor: HAIR_COLORS[1],
  eyes: EYE_COLORS[1],
  glasses: "none",
  covering: "cap",
  fit: null,
};

const has = <T extends string>(list: readonly (Option<T> | T)[], v: unknown): v is T =>
  typeof v === "string" && list.some((o) => (typeof o === "string" ? o === v : o.id === v));

/** Fills gaps and drops anything unknown, so old or tampered rows still render. */
export function normalizeLook(raw: unknown, style: unknown): Look {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const st = isStyleId(style) ? style : DEFAULT_LOOK.style;
  const body = has(BODIES, r.body) ? r.body : DEFAULT_LOOK.body;
  // Rows from before v0.7 have no build: keep their shape. Bodega Drip's cap used to be part of
  // the outfit; it's headwear now, so those players keep wearing it.
  const legacy = r.build === undefined;
  let covering: CoveringId = has(COVERINGS, r.covering) ? r.covering : "none";
  if (legacy && covering === "none" && styleOutfit(getStyle(st), body).accessory === "cap") covering = "cap";
  return {
    style: st,
    body,
    build: has(BUILDS[body], r.build) ? r.build : DEFAULT_BUILD[body],
    skin: has(SKIN_TONES, r.skin) ? r.skin : DEFAULT_LOOK.skin,
    hair: has(HAIRS, r.hair) ? r.hair : DEFAULT_LOOK.hair,
    hairColor: has(HAIR_COLORS, r.hairColor) ? r.hairColor : DEFAULT_LOOK.hairColor,
    eyes: has(EYE_COLORS, r.eyes) ? r.eyes : DEFAULT_LOOK.eyes,
    glasses: has(GLASSES, r.glasses) ? r.glasses : DEFAULT_LOOK.glasses,
    covering,
    fit: isValidFit(st, r.fit) ? r.fit : null,
    ...(NYERS.some((n) => n.id === r.nyer) ? { nyer: r.nyer as NyerId } : {}),
  };
}

/** True only when every field is a known option (used to validate sign-up input). */
export function isValidLook(raw: unknown, style: unknown): boolean {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r || !isStyleId(style)) return false;
  return (
    has(BODIES, r.body) && has(SKIN_TONES, r.skin) && has(HAIRS, r.hair) && has(HAIR_COLORS, r.hairColor) &&
    has(EYE_COLORS, r.eyes) && has(GLASSES, r.glasses) && has(COVERINGS, r.covering) &&
    (r.build === undefined || has(BUILDS[r.body as BodyId], r.build)) &&
    (r.fit === undefined || r.fit === null || isValidFit(style, r.fit)) &&
    (r.nyer === undefined || NYERS.some((n) => n.id === r.nyer))
  );
}

export function lookChoices(look: Look): LookChoices {
  const { style: _style, ...choices } = look;
  return choices;
}

// ---------------------------------------------------------------------------
// Shuffle weights. Random looks (the shuffle button and, later, city NPCs) follow
// New York's mix with white-presenting avatars as the majority, as the product
// owner asked; hair and eye colors follow the skin tone. Players can still pick
// any combination themselves.
// ---------------------------------------------------------------------------

/** Weight per SKIN_TONES entry, lightest first. The two lightest tones sum to 52%. */
export const SKIN_WEIGHTS = [0.28, 0.24, 0.13, 0.11, 0.07, 0.07, 0.06, 0.04] as const;

type Group = "light" | "tan" | "deep";
const groupOf = (skinIndex: number): Group => (skinIndex <= 1 ? "light" : skinIndex <= 3 ? "tan" : "deep");

/** Weights per HAIR_COLORS entry: black, dark brown, brown, auburn, blonde, platinum, gray, pink. */
const HAIR_COLOR_WEIGHTS: Record<Group, number[]> = {
  light: [0.08, 0.3, 0.27, 0.08, 0.2, 0.03, 0.02, 0.02],
  tan: [0.5, 0.33, 0.1, 0.02, 0.0, 0.02, 0.01, 0.02],
  deep: [0.74, 0.17, 0.02, 0.02, 0.0, 0.02, 0.0, 0.03],
};

/** Weights per EYE_COLORS entry: dark brown, brown, hazel, green, blue, gray. */
const EYE_WEIGHTS: Record<Group, number[]> = {
  light: [0.18, 0.25, 0.15, 0.12, 0.24, 0.06],
  tan: [0.6, 0.3, 0.08, 0.02, 0, 0],
  deep: [0.75, 0.23, 0.02, 0, 0, 0],
};

/** Weights per HAIRS entry: short, buzz, long, ponytail, bun, braids, curls, locs, bald. */
const HAIR_WEIGHTS: Record<Group, number[]> = {
  light: [0.24, 0.1, 0.24, 0.13, 0.12, 0.03, 0.06, 0.02, 0.06],
  tan: [0.22, 0.12, 0.24, 0.12, 0.1, 0.06, 0.08, 0.02, 0.04],
  deep: [0.12, 0.14, 0.1, 0.06, 0.08, 0.2, 0.12, 0.14, 0.04],
};

export function weightedIndex(weights: readonly number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function randomLook(rand: () => number = Math.random, styles: readonly StyleId[]): Look {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const skinIndex = weightedIndex(SKIN_WEIGHTS, rand());
  const g = groupOf(skinIndex);
  const body = pick(BODIES).id;
  return {
    style: pick(styles),
    body,
    build: pick(BUILDS[body]).id,
    skin: SKIN_TONES[skinIndex],
    hair: HAIRS[weightedIndex(HAIR_WEIGHTS[g], rand())].id,
    hairColor: HAIR_COLORS[weightedIndex(HAIR_COLOR_WEIGHTS[g], rand())],
    eyes: EYE_COLORS[weightedIndex(EYE_WEIGHTS[g], rand())],
    glasses: rand() < 0.6 ? "none" : pick(GLASSES).id,
    covering: rand() < 0.6 ? "none" : pick(COVERINGS).id,
    fit: null,
  };
}
