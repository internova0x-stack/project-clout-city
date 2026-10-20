// Culture pack C1 (docs/culture/): the slang dictionary, the invented-name list and Astoria's character
// profiles live in content/culture/*.json; this file holds their shapes and the checks that read them.
// Dependency-free (the data is passed in) so tests and scripts can import it.

export interface SlangTerm {
  id: string;
  term: string;
  meaning: string;
  origin: string;
  example: string;
  /** An ordinary word too ("son", "the city"), so counts skip it. */
  ambiguous?: boolean;
  /** Only said in that season ("brick": the cold months, owner Oct 20). */
  season?: "cold";
}

export interface ParodyName {
  category: string;
  /** Real names that never appear in the game's copy or content. */
  real: string[];
  caseSensitive?: boolean;
  parody: string;
  note?: string;
}

export interface NpcProfile {
  id: string;
  name: string;
  age: number;
  background: string;
  personality: string;
  yearsInNeighborhood: number;
  catchphrases: string[];
  likes: string[];
  dislikes: string[];
  placeId: string;
  role: string;
  /** The lib/cast.ts regular who stands on the place card, or null. */
  regular: string | null;
  slang: string[];
  story?: string;
  /** C2: after `days` different days at their place, they say `line` (Sal remembers your order). */
  remembers?: { days: number; line: string };
}

export interface CultureData {
  slang: { terms: SlangTerm[] };
  parody: { names: ParodyName[] };
  npcs: { profiles: NpcProfile[] };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word match that also works for terms with apostrophes or accents ("Wildin'", "¿Qué lo que?"). */
const wordRe = (s: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, `u${flags}`);

/** The real names in `text` (empty when it's clean). */
export function brandHits(text: string, names: ParodyName[]): string[] {
  return names.flatMap((n) => n.real.filter((r) => wordRe(r, n.caseSensitive ? "" : "i").test(text)));
}

/** How many slang terms a line uses (ambiguous everyday words don't count). */
export function slangCount(text: string, terms: SlangTerm[]): number {
  return terms.filter((t) => !t.ambiguous && wordRe(t.term.replace(/^¿|\?$/g, ""), "i").test(text)).length;
}

/** Everyday lines with each regular's profile catchphrases added, so taps draw on the profiles. */
export function withCatchphrases(lines: Record<string, string[]>, profiles: NpcProfile[]): Record<string, string[]> {
  const out: Record<string, string[]> = { ...lines };
  for (const p of profiles) {
    if (!p.regular || p.story) continue;
    out[p.regular] = [...new Set([...(out[p.regular] ?? []), ...p.catchphrases])];
  }
  return out;
}

/** C2: the line a regular says once they know you (`days` = different days at their place), or null. */
export function rememberedLine(profiles: NpcProfile[], regularId: string, days: number): string | null {
  const r = profiles.find((p) => p.regular === regularId)?.remembers;
  return r && days >= r.days ? r.line : null;
}

/** Accent spellings the voice rules rule out (docs/culture/VOICE.md). Dropped g's in slang ("buggin'") are fine. */
export const PHONETIC_SPELLINGS = ["dese", "dem guys", "dose guys", "youse", "fuggedaboutit", "tawk", "cawfee", "da boss"];

/**
 * The culture files' rules: 30 unique slang terms, one profile per Astoria place (`astoria` place ids), regulars that
 * exist and stand at their profile's place, known slang ids, short lines, and no real names or accent spellings.
 */
export function validateCulture(d: CultureData, ctx: { placeIds: string[]; astoria: string[]; regulars: { id: string; placeId: string }[] }): string[] {
  const problems: string[] = [];
  const ids = d.slang.terms.map((t) => t.id);
  if (ids.length !== 30) problems.push(`slang: ${ids.length} terms, the guide's table has 30`);
  if (new Set(ids).size !== ids.length) problems.push("slang: ids repeat");
  for (const t of d.slang.terms) if (!t.term || !t.meaning || !t.example) problems.push(`slang ${t.id}: needs a term, meaning and example`);

  const seen = new Map<string, string>();
  for (const p of d.npcs.profiles) {
    const at = `profile ${p.id}`;
    if (!p.name || !p.background || !p.personality || !p.role) problems.push(`${at}: needs a name, background, personality and role`);
    if (!(p.age >= 18 && p.age < 100) || !(p.yearsInNeighborhood >= 0 && p.yearsInNeighborhood <= p.age)) problems.push(`${at}: age or years in the neighborhood look wrong`);
    if (!ctx.placeIds.includes(p.placeId)) problems.push(`${at}: no place "${p.placeId}"`);
    if (seen.has(p.placeId)) problems.push(`${at}: ${p.placeId} already has ${seen.get(p.placeId)}`);
    seen.set(p.placeId, p.id);
    if (p.regular) {
      const r = ctx.regulars.find((x) => x.id === p.regular);
      if (!r) problems.push(`${at}: no regular "${p.regular}" in lib/cast.ts`);
      else if (r.placeId !== p.placeId) problems.push(`${at}: the regular stands at ${r.placeId}`);
    }
    for (const s of p.slang) if (!ids.includes(s)) problems.push(`${at}: unknown slang "${s}"`);
    if (p.catchphrases.length < 2) problems.push(`${at}: at least two catchphrases`);
    for (const l of p.catchphrases) {
      if (l.length > 240) problems.push(`${at}: "${l.slice(0, 30)}…" is over 240 characters`);
      for (const ph of PHONETIC_SPELLINGS) if (wordRe(ph, "i").test(l)) problems.push(`${at}: "${ph}" is accent spelling`);
    }
    if (p.remembers && !(p.remembers.days >= 1 && p.remembers.line && p.remembers.line.length <= 240)) problems.push(`${at}: "remembers" needs days (1 or more) and a line of 240 characters or fewer`);
    const hits = brandHits(JSON.stringify(p), d.parody.names);
    if (hits.length) problems.push(`${at}: real names ${hits.join(", ")}`);
  }
  for (const id of ctx.astoria) if (!seen.has(id)) problems.push(`no profile for Astoria place ${id}`);
  return problems;
}
