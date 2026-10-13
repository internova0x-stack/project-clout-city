// Neighborhood gossip (v0.10, docs/08-new-features-spec.md section 8; how-to in docs/WEEKLY-CONTENT.md).
// Each week brings 3 to 5 gossip stories about the invented cast, Astoria's regulars and invented city
// politics. A story is five pieces, each found at a place: overheard with "Listen in", or from the
// regular there. Five pieces make Lola's full write-up, a Tea card for the Collection.
//
// The week file lives in content/gossip/<Monday>.json. Pieces a player hasn't found never reach their
// bundle: the Studio uploads the file (migration 0034) and players get only what they've found.
// Dependency-free so tests can import it.

import { CITY_ECONOMY, PLACES } from "./city.ts";
import { regularAt } from "./cast.ts";

export const GOSSIP_TOPICS = ["celebrity", "regulars", "city-hall"] as const;
export type GossipTopic = (typeof GOSSIP_TOPICS)[number];
export const TOPIC_LABEL: Record<GossipTopic, string> = { celebrity: "Celebrity", regulars: "Around Astoria", "city-hall": "City Hall" };

/** One piece: where it's found, how, and (optionally) when on the city clock. */
export interface GossipPiece {
  text: string;
  place: string;
  /** "overheard": Listen in at the place. "regular": talk to the regular there. */
  source: "overheard" | "regular";
  /** City-clock hours [from, to), 0 to 23; wraps past midnight when from > to. Omitted: any time. */
  hours?: [number, number];
}

export interface GossipStory {
  id: string;
  title: string;
  topic: GossipTopic;
  emoji: string;
  /** What the Tea app shows before any piece is found. */
  teaser: string;
  pieces: GossipPiece[];
  /** Lola's full write-up, the Tea card. */
  tea: { headline: string; body: string };
}

export interface GossipWeek { week: string; stories: GossipStory[] }

const len = (s: unknown, min: number, max: number) => typeof s === "string" && s.trim().length >= min && s.length <= max;

/**
 * Checks a week file with every rule the Studio enforces (spec section 8): 3 to 5 stories, exactly
 * five pieces each at five different real places (none a story place, nor one touched by a story that
 * week), a regular wherever a piece comes from one, valid city-clock windows, and nothing that names a
 * live story's answer (`forbidden`, from the Studio).
 */
export function validateGossipWeek(raw: unknown, opts: { storyPlaces?: string[]; forbidden?: string[] } = {}): { ok: true; week: GossipWeek } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const f = raw as Partial<GossipWeek> | null;
  if (!f || typeof f !== "object") return { ok: false, problems: ["That isn't a gossip file."] };
  const week = typeof f.week === "string" ? f.week : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1) problems.push(`week: "${week}" must be a Monday (YYYY-MM-DD)`);
  const stories = Array.isArray(f.stories) ? f.stories : [];
  const { min, max } = CITY_ECONOMY.gossip.storiesPerWeek;
  if (stories.length < min || stories.length > max) problems.push(`stories: ${min} to ${max} a week`);
  const ids = new Set<string>();
  const story = new Set(opts.storyPlaces ?? []);
  const forbidden = (opts.forbidden ?? []).map((w) => w.toLowerCase()).filter((w) => w.length >= 3);
  stories.forEach((s, i) => {
    const at = `stories[${i}]${s?.id ? ` (${s.id})` : ""}`;
    if (!/^[a-z0-9-]{3,40}$/.test(s?.id ?? "")) problems.push(`${at}: id, 3 to 40 lowercase letters, numbers and dashes`);
    else if (ids.has(s.id)) problems.push(`${at}: id used twice`);
    else ids.add(s.id);
    if (!len(s?.title, 4, 60)) problems.push(`${at}: title, 4 to 60 characters`);
    if (!(GOSSIP_TOPICS as readonly string[]).includes(s?.topic)) problems.push(`${at}: topic is one of ${GOSSIP_TOPICS.join(", ")}`);
    if (!len(s?.emoji, 1, 8)) problems.push(`${at}: emoji`);
    if (!len(s?.teaser, 20, 160)) problems.push(`${at}: teaser, 20 to 160 characters`);
    if (!len(s?.tea?.headline, 10, 90)) problems.push(`${at}: tea.headline, 10 to 90 characters`);
    if (!len(s?.tea?.body, 150, 700)) problems.push(`${at}: tea.body (Lola's write-up), 150 to 700 characters`);
    const pieces = Array.isArray(s?.pieces) ? s.pieces : [];
    if (pieces.length !== CITY_ECONOMY.gossip.pieces) problems.push(`${at}: exactly ${CITY_ECONOMY.gossip.pieces} pieces`);
    if (new Set(pieces.map((p) => p?.place)).size !== pieces.length) problems.push(`${at}: each piece at a different place`);
    pieces.forEach((p, j) => {
      const pat = `${at} piece ${j + 1}`;
      if (!len(p?.text, 20, 220)) problems.push(`${pat}: text, 20 to 220 characters`);
      const place = PLACES.find((x) => x.id === p?.place);
      if (!place) { problems.push(`${pat}: "${p?.place}" isn't a place in lib/city.ts`); return; }
      if (place.story || story.has(place.id)) problems.push(`${pat}: ${place.name} is part of a story; pick another place`);
      if (p.source !== "overheard" && p.source !== "regular") problems.push(`${pat}: source is "overheard" or "regular"`);
      if (p.source === "regular" && !regularAt(place.id)) problems.push(`${pat}: ${place.name} has no regular (lib/cast.ts); make it "overheard"`);
      if (p.hours !== undefined) {
        const h = p.hours;
        if (!Array.isArray(h) || h.length !== 2 || !h.every((x) => Number.isInteger(x) && x >= 0 && x <= 23) || h[0] === h[1]) {
          problems.push(`${pat}: hours is [from, to], whole city-clock hours 0 to 23, not equal`);
        }
      }
    });
    const words = [s?.title, s?.teaser, s?.tea?.headline, s?.tea?.body, ...pieces.map((p) => p?.text)].join(" ").toLowerCase();
    for (const w of forbidden) if (words.includes(w)) problems.push(`${at}: mentions "${w}", part of a live story's answer`);
  });
  return problems.length ? { ok: false, problems } : { ok: true, week: f as GossipWeek };
}

/** True when a piece can be found now: its city-clock window holds `hour` (or it has none). */
export function inWindow(hours: [number, number] | undefined, hour: number): boolean {
  if (!hours) return true;
  const [from, to] = hours;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** "after 6 PM", "6 AM to noon", "late, 10 PM to 2 AM": the hint for a window on the city clock. */
export function windowLine(hours: [number, number] | undefined): string | null {
  if (!hours) return null;
  const h = (x: number) => (x === 0 ? "midnight" : x === 12 ? "noon" : `${x % 12} ${x < 12 ? "AM" : "PM"}`);
  return `${h(hours[0])} to ${h(hours[1])} (city time)`;
}

/** The words a story's answer key would give away: "pastor-vale" → "pastor vale". */
export function answerWords(answerKey: Record<string, unknown> | undefined): string[] {
  return Object.entries(answerKey ?? {})
    .filter(([k, v]) => k !== "server_only" && typeof v === "string")
    .map(([, v]) => (v as string).replace(/[-_]+/g, " ").trim())
    .filter((w) => w.length >= 3);
}
