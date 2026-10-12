// Free Look options for every player (Clarifications section 1; Design System
// Guide section 12): body, skin, hair, hair color, eyes, glasses and coverings.
// None of these are ever sold in the Shop. The starting style only sets the outfit.

import { isStyleId, type StyleId } from "./styles.ts";

export interface Option<T extends string> { id: T; label: string }

export type BodyId = "straight" | "curvy";
export type HairId = "short" | "buzz" | "long" | "ponytail" | "bun" | "braids" | "curls" | "locs" | "bald";
export type GlassesId = "none" | "round" | "square" | "shades";
export type CoveringId = "none" | "hijab" | "turban" | "headwrap" | "durag" | "kippah";

export const BODIES: Option<BodyId>[] = [
  { id: "straight", label: "Straight" },
  { id: "curvy", label: "Curvy" },
];

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

export const COVERINGS: Option<CoveringId>[] = [
  { id: "none", label: "None" },
  { id: "hijab", label: "Hijab" },
  { id: "turban", label: "Turban" },
  { id: "headwrap", label: "Headwrap" },
  { id: "durag", label: "Durag" },
  { id: "kippah", label: "Kippah" },
];

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
  skin: string;
  hair: HairId;
  hairColor: string;
  eyes: string;
  glasses: GlassesId;
  covering: CoveringId;
}

/** The free choices stored in players.look (the style has its own column). */
export type LookChoices = Omit<Look, "style">;

export const DEFAULT_LOOK: Look = {
  style: "bodega_drip",
  body: "straight",
  skin: SKIN_TONES[3],
  hair: "short",
  hairColor: HAIR_COLORS[0],
  eyes: EYE_COLORS[0],
  glasses: "none",
  covering: "none",
};

const has = <T extends string>(list: readonly (Option<T> | T)[], v: unknown): v is T =>
  typeof v === "string" && list.some((o) => (typeof o === "string" ? o === v : o.id === v));

/** Fills gaps and drops anything unknown, so old or tampered rows still render. */
export function normalizeLook(raw: unknown, style: unknown): Look {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    style: isStyleId(style) ? style : DEFAULT_LOOK.style,
    body: has(BODIES, r.body) ? r.body : DEFAULT_LOOK.body,
    skin: has(SKIN_TONES, r.skin) ? r.skin : DEFAULT_LOOK.skin,
    hair: has(HAIRS, r.hair) ? r.hair : DEFAULT_LOOK.hair,
    hairColor: has(HAIR_COLORS, r.hairColor) ? r.hairColor : DEFAULT_LOOK.hairColor,
    eyes: has(EYE_COLORS, r.eyes) ? r.eyes : DEFAULT_LOOK.eyes,
    glasses: has(GLASSES, r.glasses) ? r.glasses : DEFAULT_LOOK.glasses,
    covering: has(COVERINGS, r.covering) ? r.covering : DEFAULT_LOOK.covering,
  };
}

/** True only when every field is a known option (used to validate sign-up input). */
export function isValidLook(raw: unknown, style: unknown): boolean {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r || !isStyleId(style)) return false;
  return (
    has(BODIES, r.body) && has(SKIN_TONES, r.skin) && has(HAIRS, r.hair) && has(HAIR_COLORS, r.hairColor) &&
    has(EYE_COLORS, r.eyes) && has(GLASSES, r.glasses) && has(COVERINGS, r.covering)
  );
}

export function lookChoices(look: Look): LookChoices {
  const { style: _style, ...choices } = look;
  return choices;
}

export function randomLook(rand: () => number = Math.random, styles: readonly StyleId[]): Look {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  return {
    style: pick(styles),
    body: pick(BODIES).id,
    skin: pick(SKIN_TONES),
    hair: pick(HAIRS).id,
    hairColor: pick(HAIR_COLORS),
    eyes: pick(EYE_COLORS),
    glasses: rand() < 0.6 ? "none" : pick(GLASSES).id,
    covering: rand() < 0.75 ? "none" : pick(COVERINGS).id,
  };
}
