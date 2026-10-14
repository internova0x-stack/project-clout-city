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
  /**
   * "overheard": Listen in at the place. "regular": talk to the regular there. "restroom" (#19 clubs):
   * Listen in downstairs in a club's restroom, the juicier kind; finding one pays gossip.restroom.
   */
  source: "overheard" | "regular" | "restroom";
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
      if (p.source !== "overheard" && p.source !== "regular" && p.source !== "restroom") problems.push(`${pat}: source is "overheard", "regular" or "restroom"`);
      if (p.source === "regular" && !regularAt(place.id)) problems.push(`${pat}: ${place.name} has no regular (lib/cast.ts); make it "overheard"`);
      if (p.source === "restroom" && !place.club) problems.push(`${pat}: ${place.name} has no restroom floor; restroom pieces go at a club or the lounge`);
      // A piece behind a door rule could be out of a player's reach for weeks; keep gossip where anyone can go.
      if (place.club?.doorClout) problems.push(`${pat}: ${place.name} turns people away at the door; pick a place anyone can get into`);
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

// ---------------------------------------------------------------------------
// In the game (migration 0035): what a player sees and can do.
// ---------------------------------------------------------------------------

/** A piece as a player sees it: in full once found, otherwise a hint. */
export type GossipPieceView =
  | { n: number; found: true; text: string; place: string; source: GossipPiece["source"]; via: GossipVia | "crew"; shared: boolean }
  | { n: number; found: false; source: GossipPiece["source"]; hours: [number, number] | null; place: string | null; kind: string | null; area: string | null };

export interface GossipStoryView {
  id: string;
  week: string;
  /** The last day it can be found (New York). */
  endsOn: string;
  title: string;
  topic: GossipTopic;
  emoji: string;
  teaser: string;
  done: boolean;
  pieces: GossipPieceView[];
}

export interface TeaCard { storyId: string; week: string; title: string; emoji: string; topic: GossipTopic; headline: string; body: string; earnedAt: string }

export interface GossipState { stories: GossipStoryView[]; cards: TeaCard[] }

/** How a piece is found in person: Listen in (on the card or, #19, in a club's restroom) or the regular. */
export type GossipVia = GossipPiece["source"];

/** What Listen in (or a regular) turned up. `later`: more is said here at these city-clock hours. */
export interface GossipFind {
  found: { story: string; title: string; piece: number; text: string; count: number }[];
  later: [number, number] | null;
  finished: string[];
  /** v0.11 (migration 0036): cash from a gossip daily task completed here, bonus included. */
  taskCash?: number;
  /** #19 clubs (migration 0046): clout and Mood paid on the spot for restroom pieces. */
  bonus?: { clout: number; mood: number };
}

export type GossipResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface GossipApi {
  state(): Promise<GossipState | null>;
  find(placeId: string, via: GossipVia): Promise<GossipResult<GossipFind>>;
  share(storyId: string, piece: number): Promise<GossipResult<number>>;
}

export const TEA_BADGE = "tea-spiller";

/** The kind of place for a hint, from its first tag: "a café", "a bodega", "a club". */
const KIND: Record<string, string> = {
  club: "a club", cafe: "a café", bodega: "a bodega", rooftop: "a rooftop", park: "a park", delivery_hub: "a delivery hub",
  office: "an office", lounge: "a lounge", boutique: "a boutique", dealership: "a car dealer", university: "a campus",
  college: "a college", pizza: "a pizza place", diner: "a diner", supermarket: "a supermarket", library: "a library",
  police: "a police station", firehouse: "a firehouse", chapel: "a chapel", gym: "a gym", subway: "a subway station",
  cinema: "a cinema", games: "a gaming arena", monument: "a landmark", lotto: "a lotto shop",
};
export const kindLine = (kind: string | null) => (kind && KIND[kind]) || "somewhere";

/**
 * "Overheard at a club in Long Island City · 9 PM to 3 AM (city time)". Once the trail names the
 * place: "Talk to Rosa at Grind & Gossip Café" or "Overheard at Velvet Static · …".
 */
export function hintLine(p: Extract<GossipPieceView, { found: false }>, placeName?: string): string {
  const where = placeName ?? `${kindLine(p.kind)}${p.area ? ` in ${p.area}` : ""}`;
  const who = p.place ? regularAt(p.place)?.name : undefined;
  const how = p.source === "regular" ? (who && placeName ? `Talk to ${who} at ${where}` : `The regular at ${where}`)
    : p.source === "restroom" ? `Overheard in the restroom at ${where}` : `Overheard at ${where}`;
  const when = windowLine(p.hours ?? undefined);
  return when ? `${how} · ${when}` : how;
}

export const foundCount = (s: GossipStoryView) => s.pieces.filter((p) => p.found).length;

// ---------------------------------------------------------------------------
// The trail (v0.11, owner Oct 14): "the city is big, so point players in the right direction;
// everyone they talk to points them to the next person." Each piece found names where the next one
// is (gossip_state, migration 0036), and the people a player talks to pass on their next lead.
// ---------------------------------------------------------------------------

/** Where to go next in a story: its first piece not found whose place the player knows. */
export interface GossipLead { story: string; title: string; n: number; place: string; source: GossipPiece["source"]; hours: [number, number] | null }

/** The player's next piece in every live story they haven't finished, in the Tea app's order. */
export function gossipLeads(state: GossipState | null): GossipLead[] {
  const out: GossipLead[] = [];
  for (const s of state?.stories ?? []) {
    if (s.done) continue;
    const p = s.pieces.find((x): x is Extract<GossipPieceView, { found: false }> => !x.found && !!x.place);
    if (p) out.push({ story: s.id, title: s.title, n: p.n, place: p.place!, source: p.source, hours: p.hours });
  }
  return out;
}

/** The lead someone at `here` passes on: the first one somewhere else, turning with `seed` so it varies. */
export function leadFrom(state: GossipState | null, here: string | null, seed = 0): GossipLead | null {
  const leads = gossipLeads(state).filter((l) => l.place !== here);
  return leads.length ? leads[Math.abs(seed) % leads.length] : null;
}

/** "Talk to Rosa at Grind & Gossip Café" or "Listen in at Velvet Static, 9 PM to 3 AM": a task or a pointer. */
export function leadAction(l: Pick<GossipLead, "place" | "source" | "hours">): string {
  const place = PLACES.find((x) => x.id === l.place)?.name ?? "somewhere";
  const who = l.source === "regular" ? regularAt(l.place)?.name : undefined;
  const when = windowLine(l.hours ?? undefined)?.replace(" (city time)", "");
  return `${who ? `Talk to ${who} at` : l.source === "restroom" ? "Listen in downstairs at" : "Listen in at"} ${place}${when ? `, ${when}` : ""}`;
}

/** What a person says when they point the player on: "Ask Rosa at Grind & Gossip Café about “…”." */
export function leadLine(l: GossipLead): string {
  const place = PLACES.find((x) => x.id === l.place)?.name ?? "somewhere";
  const who = l.source === "regular" ? regularAt(l.place)?.name : undefined;
  const when = windowLine(l.hours ?? undefined)?.replace(" (city time)", "");
  return who
    ? `Want more on “${l.title}”? Ask ${who} at ${place}.`
    : l.source === "restroom"
      ? `The restroom at ${place} is where the real talk about “${l.title}” happens${when ? `, ${when}` : ""}. Go wash your hands.`
      : `People at ${place} won't shut up about “${l.title}”${when ? `, ${when}` : ""}. Go listen.`;
}

const ERRORS: Record<string, string> = {
  gossip_not_here: "You have to be there to hear it.",
  gossip_over: "That story's gone quiet. Old news.",
  gossip_not_found: "You can only share what you've heard.",
  gossip_shared: "Already shared with your crew. They know.",
  no_restroom: "There's no restroom to lurk in here.",
};
export function gossipError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The grapevine glitched. Try again.";
}

/** A Listen-in line when nothing new turns up. */
export function quietLine(later: [number, number] | null, n: number): string {
  if (later) return `People here talk more ${windowLine(later)?.replace(" (city time)", "")}. Come back then.`;
  const lines = ["Nothing juicy. Someone's describing a sandwich in great detail.", "Just a man on speakerphone. About his fantasy league.", "All quiet. Suspiciously quiet."];
  return lines[Math.abs(n) % lines.length];
}
