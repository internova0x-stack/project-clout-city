// Living places, part 1: what people say (owner, Nov 1: "the dialogue is repetitive and they don't say anything
// interesting… think through the world state"). One picker for everyone in a room. It gathers every line that fits right
// now, ranks them (something happening here > about you > the city this week > this place at this hour > who they are),
// and picks one this device hasn't shown recently. The lines live in content/dialogue/*.json (validateDialogue).

export type DayPart = "morning" | "afternoon" | "evening" | "late";

/** A city-clock minute (0-1439) as a part of the day. */
export function dayPart(minute: number): DayPart {
  const h = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "late";
}

/** Where a player is in their New York story, for who says what to them. */
export type Stage = "new" | "rising" | "known" | "famous";
export function stageOf(p: { clout: number; daysIn: number }): Stage {
  if (p.daysIn < 7 && p.clout < 500) return "new";
  if (p.clout < 2_000) return "rising";
  if (p.clout < 10_000) return "known";
  return "famous";
}

/** A written line and when it fits. Every condition left out fits always. */
export interface DialogueLine {
  text: string;
  /** Place tags (any of them): "cafe", "club", "restroom", "hub"… */
  at?: string[];
  /** Place ids (any of them). */
  places?: string[];
  time?: DayPart[];
  /** ISO weekdays, 1 Monday … 7 Sunday. */
  days?: number[];
  stage?: Stage[];
  /** A city condition kind running today (lib/cityConditions.ts): "heatwave", "brownout", "festival"… */
  condition?: string[];
  /** Facts about the player, worked out on the client (`PlayerTags`): "has_job", "dating", "campaign", "halo", "hustler"… */
  player?: string[];
}

export interface CrowdType {
  id: string;
  /** What shows after their name: "Pia (dog walker)". */
  label: string;
  /** Where they hang out: place tags with a weight (missing = 0, never there). */
  haunts: Record<string, number>;
  /** When they're out (missing = all day). */
  time?: DayPart[];
  lines: DialogueLine[];
}

/** Everything known about this moment, for matching lines. */
export interface Scene {
  placeId: string;
  tags: string[];
  /** Floor 0 restroom, 1 ground… (lib/rooms.ts). */
  floor: number;
  part: DayPart;
  weekday: number;
  stage: Stage;
  conditions: string[];
  player: string[];
}

export function fits(l: DialogueLine, s: Scene): boolean {
  if (l.at && !l.at.some((t) => s.tags.includes(t) || (t === "restroom" && s.floor === 0))) return false;
  if (l.places && !l.places.includes(s.placeId)) return false;
  if (l.time && !l.time.includes(s.part)) return false;
  if (l.days && !l.days.includes(s.weekday)) return false;
  if (l.stage && !l.stage.includes(s.stage)) return false;
  if (l.condition && !l.condition.some((c) => s.conditions.includes(c))) return false;
  if (l.player && !l.player.every((t) => s.player.includes(t))) return false;
  return true;
}

/** How specific a line is: lines written for this exact moment beat lines that fit anywhere. */
export function specificity(l: DialogueLine): number {
  return (l.condition ? 8 : 0) + (l.player ? 6 : 0) + (l.places ? 4 : 0) + (l.at ? 2 : 0) + (l.time ? 1 : 0) + (l.days ? 1 : 0) + (l.stage ? 1 : 0);
}

/** A tier of candidate lines: earlier tiers win when they have anything unheard. */
export type Tier = { name: string; lines: string[] };

/**
 * Picks a line: the first tier with something not heard recently, a random line from it (specific lines are already put
 * first by the caller's tiers). If everything has been heard, the least recently heard line of the first non-empty tier.
 */
export function pickLine(tiers: Tier[], recent: readonly string[], rand: () => number = Math.random): { text: string; tier: string } | null {
  const seen = new Set(recent);
  for (const t of tiers) {
    const fresh = t.lines.filter((l) => !seen.has(l));
    if (fresh.length) return { text: fresh[Math.floor(rand() * fresh.length)], tier: t.name };
  }
  const first = tiers.find((t) => t.lines.length);
  if (!first) return null;
  // Oldest first in `recent`: the one heard longest ago.
  const byAge = [...first.lines].sort((a, b) => recent.indexOf(a) - recent.indexOf(b));
  return { text: byAge[0], tier: first.name };
}

/** Lines that fit, most specific first, as two tiers (specific, general). */
export function matching(lines: readonly DialogueLine[], s: Scene, name: string): Tier[] {
  const ok = lines.filter((l) => fits(l, s));
  const sharp = ok.filter((l) => specificity(l) >= 4).map((l) => l.text);
  const broad = ok.filter((l) => specificity(l) < 4).map((l) => l.text);
  return [{ name: `${name}:specific`, lines: sharp }, { name: `${name}:general`, lines: broad }];
}

/** Who someone in the crowd is: a type that haunts this kind of place at this hour, the same for the same seat today. */
export function crowdTypeFor(types: readonly CrowdType[], s: Pick<Scene, "tags" | "part" | "floor">, seed: number): CrowdType | null {
  const tags = s.floor === 0 ? [...s.tags, "restroom"] : s.tags;
  const weighted = types
    .filter((t) => !t.time || t.time.includes(s.part))
    .map((t) => ({ t, w: Math.max(0, ...tags.map((g) => t.haunts[g] ?? 0), t.haunts["*"] ?? 0) }))
    .filter((x) => x.w > 0);
  const total = weighted.reduce((a, x) => a + x.w, 0);
  if (!total) return null;
  let r = (((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1) % 1 * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.t; }
  return weighted[weighted.length - 1].t;
}

/** A small recent-lines memory kept on this device (never sent anywhere). */
const KEY = "cc-said";
const KEEP = 60;
export function recentLines(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function rememberLine(text: string): void {
  try {
    const list = recentLines().filter((l) => l !== text);
    list.push(text);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-KEEP)));
  } catch { /* private mode: lines may repeat a little sooner */ }
}

export interface DialogueFile { crowd: CrowdType[]; places: DialogueLine[]; city: DialogueLine[]; lola: DialogueLine[] }

const VOICE_BANNED = /\b(lol|omg)\b|!!|\bslay\b/i;
/** The Studio's rules for a dialogue file: short lines, real tags, no shouting. */
export function validateDialogue(d: DialogueFile, known: { tags: Set<string>; places: Set<string>; conditions: Set<string>; player: Set<string> }): string[] {
  const out: string[] = [];
  const check = (l: DialogueLine, where: string) => {
    if (!l.text || l.text.length > 140) out.push(`${where}: a line must be 1-140 characters ("${l.text?.slice(0, 40)}")`);
    if (VOICE_BANNED.test(l.text)) out.push(`${where}: off-voice ("${l.text.slice(0, 40)}")`);
    for (const t of l.at ?? []) if (!known.tags.has(t) && t !== "restroom") out.push(`${where}: unknown tag ${t}`);
    for (const p of l.places ?? []) if (!known.places.has(p)) out.push(`${where}: unknown place ${p}`);
    for (const c of l.condition ?? []) if (!known.conditions.has(c)) out.push(`${where}: unknown condition ${c}`);
    for (const p of l.player ?? []) if (!known.player.has(p)) out.push(`${where}: unknown player tag ${p}`);
  };
  const seen = new Set<string>();
  const all = [...d.places, ...d.city, ...d.lola, ...d.crowd.flatMap((c) => c.lines)];
  for (const l of all) { if (seen.has(l.text)) out.push(`duplicate line: "${l.text.slice(0, 50)}"`); seen.add(l.text); }
  d.places.forEach((l, i) => check(l, `places[${i}]`));
  d.city.forEach((l, i) => check(l, `city[${i}]`));
  d.lola.forEach((l, i) => check(l, `lola[${i}]`));
  for (const c of d.crowd) {
    if (!c.label || c.label.length > 24) out.push(`crowd ${c.id}: label 1-24 characters`);
    if (c.lines.length < 8) out.push(`crowd ${c.id}: at least 8 lines`);
    for (const t of Object.keys(c.haunts)) if (t !== "*" && t !== "restroom" && !known.tags.has(t)) out.push(`crowd ${c.id}: unknown haunt ${t}`);
    c.lines.forEach((l, i) => check(l, `crowd ${c.id}[${i}]`));
  }
  return out;
}

/** Player tags the client can tell (lib/dialogue.ts `player` conditions). */
export const PLAYER_TAGS = ["has_job", "no_job", "dating", "single", "campaign", "student", "halo", "hustler", "rich", "broke", "has_crew", "business"] as const;
