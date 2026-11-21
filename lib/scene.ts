// Your Scene (owner, Nov 21; docs/SCENE.md): the daily clout loop, FarmVille's farm as fame. A player has slots (more
// with rank); a move is started at a place (it costs C$ and Energy), builds buzz in real time, longer moves want hyping
// (a check-in at that place), and once ready it's collected for clout and points on one of six scores. Left too long, it
// goes stale and pays a quarter. "For you today" suggests four moves that fit the player's life right now (their job,
// partner, campus, businesses, campaign, money, the city), read from the Content Engine's memory with storylet `when`s.
//
// Pure and dependency-light so tests, the server (app/home/sceneActions.ts) and the preview (lib/sceneSim.ts) share it.
// The database (migration 0171) checks and pays from game_settings 'scene', which `sceneSettings()` generates.
//
// Fake it till you make it (owner, Nov 21): below a move's rank a player isn't simply locked out. They can try to get in
// (SNEAK: walk in like they own the place, name-drop, or pay off the door), a gamble with real costs: bounced means the
// Energy is spent, no move, and sometimes a day's ban; name-dropping and bribes nudge the Halo/Hustler meter. Once a
// player has the rank they're invited, but the bill rises with fame (`costFor`: everyone expects you to pick up the tab).

import { whenOk, type When } from "./storylets.ts";
import type { Memory } from "./memory.ts";
import type { SkillId } from "./skills.ts";

export type ScoreId = "nightlife" | "style" | "stage" | "status" | "social" | "street";
/** The part of life a move belongs to: "For you today" takes one per area. */
export type Area = "everyday" | "cast" | "status" | "business" | "dating" | "school" | "work" | "campaign" | "money" | "city" | "halo" | "hustler";

export interface SceneMove {
  id: string;
  title: string;
  emoji: string;
  area: Area;
  /** Where it can be started; Queens first (Brooklyn waits for its borough to open). */
  places: string[];
  /** Real hours from start to ready. */
  hours: 2 | 8 | 24 | 72;
  cost: number;
  energy: number;
  clout: number;
  score: ScoreId;
  /** The skill it practises when collected. */
  skill?: SkillId;
  /** A cast member hosting it (lib/characters.ts id). */
  host?: string;
  /** Rank or net worth to start it (either one is enough when both are given). */
  needs?: { rank?: number; netWorth?: number };
  /** Who it's for (the Content Engine's memory). */
  when?: When;
  /** The "Because…" line in For you today. */
  why: string;
  /** One line of flavour on the card. */
  line: string;
  /** Step 3: Lola's Blotter line when it's collected ({name} is the player). Big moves only. */
  headline?: string;
}

export const SCORES: { id: ScoreId; label: string; emoji: string; titles: string[] }[] = [
  { id: "nightlife", label: "Nightlife", emoji: "🎉", titles: ["Wallflower", "Regular", "Life of the Party", "Club Royalty", "Nightlife Legend"] },
  { id: "style", label: "Style", emoji: "👗", titles: ["Thrift Hopeful", "Fit Checker", "Trendsetter", "Style Icon", "Fashion Royalty"] },
  { id: "stage", label: "Stage", emoji: "🎤", titles: ["Newbie", "Open-Mic Brave", "Crowd Favourite", "Headliner", "Icon"] },
  { id: "status", label: "Status", emoji: "💼", titles: ["Intern", "Plus-one", "Power Player", "Mogul", "Untouchable"] },
  { id: "social", label: "Social", emoji: "🤝", titles: ["New in Town", "Connector", "Social Butterfly", "Host with the Most", "Everyone's Friend"] },
  { id: "street", label: "Street cred", emoji: "🏙️", titles: ["Tourist", "Local", "Neighbourhood Name", "Queens Famous", "Borough Legend"] },
];

export const SCENE = {
  /** Slots by rank: [from rank, slots]. */
  slots: [[1, 2], [3, 3], [5, 4], [7, 5]] as [number, number][],
  /** Hypes a move wants, by its hours. */
  hypes: { 2: 0, 8: 2, 24: 2, 72: 3 } as Record<number, number>,
  /** Minutes between two hypes of one move. */
  hypeGapMin: 60,
  /** Hours a ready move waits before it goes stale, by its hours. */
  staleAfter: { 2: 4, 8: 8, 24: 12, 72: 24 } as Record<number, number>,
  /** A stale move pays this much. */
  stalePay: 0.25,
  /** Each hype missed takes this much off. */
  missedHype: 0.25,
  /** Score points per clout paid. */
  pointsPer: 0.2,
  /** Points to reach each title (index = title). */
  titleAt: [0, 25, 100, 300, 800],
  /** Suggestions in For you today. */
  forYou: 4,
  /** Days a collected move rests before it's suggested again. */
  restDays: 3,
} as const;

export const scoreOf = (id: ScoreId) => SCORES.find((s) => s.id === id)!;

export function slotsFor(rank: number): number {
  let n = SCENE.slots[0][1];
  for (const [r, s] of SCENE.slots) if (rank >= r) n = s;
  return n;
}
/** The rank that opens the next slot, or null at the top. */
export function nextSlotRank(rank: number): number | null {
  return SCENE.slots.find(([r]) => r > rank)?.[0] ?? null;
}
export const hypesFor = (hours: number) => SCENE.hypes[hours] ?? 0;
export const staleAfterH = (hours: number) => SCENE.staleAfter[hours] ?? hours;

/** What a move pays: clout and score points. A hater left standing takes its cut on top (step 2). */
export function payout(clout: number, need: number, done: number, stale: boolean, haterCut = 0): { clout: number; points: number } {
  const missing = Math.max(0, need - done);
  let f = Math.max(SCENE.stalePay, 1 - SCENE.missedHype * missing);
  if (stale) f = Math.min(f, SCENE.stalePay);
  f *= 1 - haterCut;
  const c = Math.round(clout * f);
  return { clout: c, points: Math.round(c * SCENE.pointsPer) };
}

export function titleFor(points: number): { tier: number; title: (sid: ScoreId) => string; next: number | null } {
  let tier = 0;
  SCENE.titleAt.forEach((at, i) => { if (points >= at) tier = i; });
  return { tier, title: (sid) => scoreOf(sid).titles[tier], next: SCENE.titleAt[tier + 1] ?? null };
}

/** Ways to get into a move above your rank. Cards show only what you get and what it costs (owner, Oct 30: no odds). */
export interface SneakWay {
  id: "confidence" | "namedrop" | "bribe";
  emoji: string;
  label: string;
  get: string;
  cost: string;
  /** The chance it works, plus `perLevel` for each level of `skill`. */
  odds: number;
  skill?: SkillId;
  perLevel?: number;
  /** A bribe: this share of the move's cost on top (at least C$50). */
  extra?: number;
  /** Halo/Hustler meter nudge either way (negative = Hustler-ward). */
  integrity: number;
  /** Hours banned from the place when caught. */
  banHours: number;
}
export const SNEAK: SneakWay[] = [
  { id: "confidence", emoji: "😎", label: "Walk in like you own the place", get: "Through the door, if nobody asks", cost: "The night, if they do", odds: 0.4, skill: "charisma", perLevel: 0.05, integrity: 0, banHours: 0 },
  { id: "namedrop", emoji: "🗣️", label: "Say you're on {host}'s list", get: "Waved straight in", cost: "A day's ban if they check the list", odds: 0.6, skill: "gossip", perLevel: 0.03, integrity: -3, banHours: 24 },
  { id: "bribe", emoji: "💵", label: "Slip the door C${extra}", get: "In, no questions", cost: "C${extra} on top of the price", odds: 0.8, extra: 0.5, integrity: -2, banHours: 0 },
];
export const bribeOf = (cost: number) => Math.max(50, Math.round(cost * 0.5 / 10) * 10);
/** The odds a way works for this player (never above 95%). */
export function sneakOdds(w: SneakWay, skills: Partial<Record<SkillId, number>>): number {
  return Math.min(0.95, w.odds + (w.skill && w.perLevel ? (skills[w.skill] ?? 0) * w.perLevel : 0));
}
export function sneakLabel(w: SneakWay, hostName: string | null, cost: number): { label: string; cost: string } {
  const extra = bribeOf(cost).toLocaleString("en-US");
  return {
    label: w.label.replace("{host}", hostName ?? "the DJ").replace("{extra}", extra),
    cost: w.cost.replace("{extra}", extra),
  };
}
/** Can this player try to sneak into it: their life fits, they're short of its rank or money. */
export const canSneak = (m: SceneMove, c: Pick<SceneCtx, "rank" | "netWorth">) => !!m.needs && !needsOk(m, c);

/** The price for this player: invited players pay more as fame rises (10% a rank above the move's own). */
export function costFor(m: SceneMove, rank: number): number {
  const base = m.needs?.rank ?? 1;
  return Math.round(m.cost * (1 + 0.1 * Math.max(0, rank - base)) / 5) * 5;
}

// ---- Step 2 (owner, Nov 21): haters, rivals and pitfalls that grow with fame; dealing with them; the crew's hype ----

/** Someone coming for a move (content/scene/haters.json). Nobodies get petty rumours, the rising get celebrities' shade,
 *  the famous get real pitfalls; the cut (what it takes off the pay if left standing) grows with them. */
export interface Hater {
  id: string;
  emoji: string;
  /** What they're saying. */
  quote: string;
  line: string;
  minRank: number;
  maxRank?: number;
  /** A cast member behind it (lib/characters.ts id). */
  who?: string;
  cut: number;
}

/** The chance a move draws a hater: 15% for a nobody, 5 points more a rank, at most 60%; sneaking in adds 15. */
export function haterChance(rank: number, entry: "invited" | "sneak" = "invited"): number {
  return Math.min(0.6, 0.15 + 0.05 * Math.max(0, rank - 1)) + (entry === "sneak" ? 0.15 : 0);
}
export const hatersFor = (haters: Hater[], rank: number) => haters.filter((h) => rank >= h.minRank && (h.maxRank === undefined || rank <= h.maxRank));
/** When it lands: somewhere between a quarter and three quarters of the way through. */
export const haterAt = (startedAt: number, readyAt: number, r: number) => Math.round(startedAt + (readyAt - startedAt) * (0.25 + 0.5 * r));

export type DealWay = "vouch" | "publicist" | "spill" | "rise";
/** Ways to deal with a hater (Moral Choices format: what you get, what it costs; never the meter). */
export const DEAL: { id: DealWay; emoji: string; label: string; get: string; cost: string; integrity: number }[] = [
  { id: "vouch", emoji: "🤝", label: "Get {regular} to vouch for you", get: "It's gone, and nobody argues with {regular}", cost: "{regular}'s favour (one a week)", integrity: 1 },
  { id: "publicist", emoji: "📞", label: "Hire a publicist", get: "Gone by morning", cost: "C${publicist}", integrity: 0 },
  { id: "spill", emoji: "🫖", label: "Spill tea about them first", get: "Gone, and C${tea} from the gossip site", cost: "You'll have to live with it", integrity: -4 },
  { id: "rise", emoji: "😌", label: "Rise above it", get: "Your dignity", cost: "The move pays less", integrity: 3 },
];
export const publicistCost = (rank: number) => 100 + 75 * rank;
export const teaCash = (rank: number) => 60 + 20 * rank;
/** Helping a crew member's move pays the helper this, once per move. */
export const CREW_HYPE_CLOUT = 5;

// ---- Step 3 (owner, Nov 21): plaques, residencies, trending moves, the cast remembering you ----

/** Plaques for doing the same move again and again (FarmVille's mastery): a badge and a clout bonus, once each. */
export const PLAQUES = [
  { at: 10, name: "Regular", clout: 50 },
  { at: 25, name: "Fixture", clout: 150 },
  { at: 50, name: "Legend", clout: 400 },
] as const;
export function plaqueOf(count: number): { have: (typeof PLAQUES)[number] | null; next: (typeof PLAQUES)[number] | null } {
  let have: (typeof PLAQUES)[number] | null = null;
  for (const p of PLAQUES) if (count >= p.at) have = p;
  return { have, next: PLAQUES.find((p) => count < p.at) ?? null };
}
export const plaqueBadge = (move: string, at: number) => `scene-${move}-${at}`;

/** A residency (FarmVille's animals: pays every day without replanting): a move's first plaque opens it at that move's
 *  places, for a week; checking in there once a New York day pays half the move's clout. One at a time. */
export const RESIDENCY = { needs: 10, days: 7, pay: 0.5 } as const;
export const residencyPay = (m: SceneMove) => Math.round(m.clout * RESIDENCY.pay);

/** Trending this week: three moves anyone can do pay 1.5× (seeded by the week, so everyone sees the same three). */
export const TREND = { count: 3, boost: 1.5 } as const;
export function trendingFor(moves: SceneMove[], monday: string): string[] {
  const pool = moves.filter((m) => !m.when && (m.area === "everyday" || m.area === "cast" || m.area === "status"));
  return [...pool].sort((a, b) => hash(`trend:${monday}:${a.id}`) - hash(`trend:${monday}:${b.id}`)).slice(0, TREND.count).map((m) => m.id);
}
/** The Monday of a New York date's week. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}
/** Collected moves a host needs before they remember you. */
export const HOST_KNOWS = 3;
/** Clout Pass XP per collected move (migration 0173 adds it to the season's xp table). */
export const SCENE_SEASON_XP = 10;

/** A started move, as the database keeps it. */
export interface SceneRow {
  id: string;
  move: string;
  place: string;
  slot: number;
  startedAt: string;
  readyAt: string;
  staleAt: string;
  hypes: string[];
  need: number;
  entry?: "invited" | "sneak";
  /** Step 2: a hater on it (from haterAt), its cut, and how it was dealt with. */
  hater?: string | null;
  haterAt?: string | null;
  cut?: number | null;
  dealt?: DealWay | null;
  /** Step 3: trending pays more (1 to 1.5). */
  boost?: number | null;
}
/** The hater's cut in force: landed and not dealt with (rising above it keeps the cut). */
export function cutOf(r: SceneRow, now: number): number {
  if (!r.hater || !r.haterAt || now < Date.parse(r.haterAt)) return 0;
  return r.dealt && r.dealt !== "rise" ? 0 : r.cut ?? 0;
}

export type MoveStatus = "building" | "hype" | "ready" | "stale";
export function statusOf(r: SceneRow, now: number): MoveStatus {
  if (now >= Date.parse(r.staleAt)) return "stale";
  if (now >= Date.parse(r.readyAt)) return "ready";
  if (r.hypes.length < r.need && hypeOpen(r, now)) return "hype";
  return "building";
}
/** A hype can be done now: one still wanted, the move still building, an hour since the last (and since the start). */
export function hypeOpen(r: SceneRow, now: number): boolean {
  if (r.hypes.length >= r.need || now >= Date.parse(r.readyAt)) return false;
  const last = r.hypes.length ? Date.parse(r.hypes[r.hypes.length - 1]) : Date.parse(r.startedAt);
  return now - last >= SCENE.hypeGapMin * 60_000;
}

export interface SceneCtx {
  rank: number;
  netWorth: number;
  memory: Memory | null;
  today: string;
  /** Places the player can go now (open boroughs, not story-only). */
  open: (place: string) => boolean;
}

/** Rank or net worth to start it. */
export function needsOk(m: SceneMove, c: Pick<SceneCtx, "rank" | "netWorth">): boolean {
  const n = m.needs;
  if (!n) return true;
  const r = n.rank !== undefined ? c.rank >= n.rank : null;
  const w = n.netWorth !== undefined ? c.netWorth >= n.netWorth : null;
  if (r !== null && w !== null) return r || w;
  return (r ?? true) && (w ?? true);
}
export function needsText(m: SceneMove): string | null {
  const n = m.needs;
  if (!n) return null;
  const parts = [n.rank !== undefined ? `Rank ${n.rank}` : null, n.netWorth !== undefined ? `C$${n.netWorth.toLocaleString("en-US")} net worth` : null].filter(Boolean);
  return parts.join(" or ");
}
/** For this player at all (their life fits): `when` only. */
export const fits = (m: SceneMove, c: SceneCtx) => whenOk(m.when, c.memory, c.today);

/** A small, stable hash for picking (FNV-1a). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const dayBefore = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * For you today: four moves from four different parts of life, at least one everyday move, never one running now or one
 * collected in the last few days, and yesterday's suggestions only when nothing else in their part of life fits. Situational moves (the player's life) come first, then the
 * cast and status moves, then everyday ones; the order within each is shuffled by player and day, so it changes daily.
 */
export function forYou(moves: SceneMove[], c: SceneCtx, player: string, skip: { active: Set<string>; rested: Set<string> }, depth = 0): SceneMove[] {
  const yesterday = depth === 0 ? new Set(forYou(moves, { ...c, today: dayBefore(c.today) }, player, skip, 1).map((m) => m.id)) : new Set<string>();
  const ok = moves.filter((m) => needsOk(m, c) && fits(m, c) && m.places.some(c.open) && !skip.active.has(m.id) && !skip.rested.has(m.id));
  const tier = (m: SceneMove) => (m.area === "everyday" ? 2 : m.area === "cast" || m.area === "status" ? 1 : 0);
  // Yesterday's suggestions go to the back of their tier: a different move in the same part of life comes first, but a
  // player's only dating or school move still shows when nothing else fits.
  const order = [...ok].sort((a, b) => tier(a) - tier(b) || Number(yesterday.has(a.id)) - Number(yesterday.has(b.id))
    || hash(`${player}:${c.today}:${a.id}`) - hash(`${player}:${c.today}:${b.id}`));
  const out: SceneMove[] = [];
  const areas = new Set<Area>();
  for (const m of order) {
    if (out.length >= SCENE.forYou - 1) break;
    if (m.area === "everyday" || areas.has(m.area)) continue;
    out.push(m);
    areas.add(m.area);
  }
  const everyday = order.filter((m) => m.area === "everyday");
  for (const m of everyday) { if (out.length >= SCENE.forYou) break; out.push(m); }
  return out;
}

/** The "Because…" line, with {rank} filled in. */
export const whyText = (m: SceneMove, c: Pick<SceneCtx, "rank">) => m.why.replace("{rank}", String(c.rank));

/** game_settings 'scene' (migration 0171): what the database needs to check and pay. */
export function sceneSettings(moves: SceneMove[]) {
  return {
    slots: SCENE.slots, hypes: SCENE.hypes, hypeGapMin: SCENE.hypeGapMin, staleAfter: SCENE.staleAfter,
    stalePay: SCENE.stalePay, missedHype: SCENE.missedHype, pointsPer: SCENE.pointsPer, costPerRank: 0.1, crewHypeClout: CREW_HYPE_CLOUT,
    plaques: PLAQUES.map((p) => ({ at: p.at, clout: p.clout })), residency: { needs: RESIDENCY.needs, days: RESIDENCY.days, pay: RESIDENCY.pay },
    sneak: Object.fromEntries(SNEAK.map((w) => [w.id, { integrity: w.integrity, banHours: w.banHours, extra: w.extra ?? 0 }])),
    moves: Object.fromEntries(moves.map((m) => [m.id, {
      places: m.places, hours: m.hours, cost: m.cost, energy: m.energy, clout: m.clout, score: m.score,
      ...(m.skill ? { skill: m.skill } : {}), ...(m.needs ? { needs: m.needs } : {}), gated: !!m.when, ...(m.headline ? { headline: m.headline } : {}),
    }])),
  };
}

/** Content checks (validate:content and tests). */
export function moveProblems(moves: SceneMove[], placeIds: Set<string>, characterIds: Set<string>): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const m of moves) {
    const at = `scene move ${m.id}`;
    if (!/^[a-z0-9-]{2,40}$/.test(m.id)) out.push(`${at}: bad id`);
    if (ids.has(m.id)) out.push(`${at}: repeated id`);
    ids.add(m.id);
    if (!m.title || m.title.length > 60) out.push(`${at}: title missing or over 60 characters`);
    if (!m.places.length) out.push(`${at}: no places`);
    for (const p of m.places) if (!placeIds.has(p)) out.push(`${at}: unknown place ${p}`);
    if (![2, 8, 24, 72].includes(m.hours)) out.push(`${at}: hours must be 2, 8, 24 or 72`);
    if (!SCORES.some((s) => s.id === m.score)) out.push(`${at}: unknown score ${m.score}`);
    if (m.host && !characterIds.has(m.host)) out.push(`${at}: unknown host ${m.host}`);
    if (m.cost < 0 || m.cost > 5000 || m.energy < 0 || m.energy > 40 || m.clout < 10 || m.clout > 1000) out.push(`${at}: cost, energy or clout out of range`);
    if (!m.why || m.why.length > 70) out.push(`${at}: why missing or over 70 characters`);
    if (!m.line || m.line.length > 120) out.push(`${at}: line missing or over 120 characters`);
    if (m.area === "everyday" && (m.when || m.needs)) out.push(`${at}: everyday moves are for everyone`);
    if (m.headline !== undefined && (!m.headline.includes("{name}") || m.headline.length > 200 || m.headline.includes("'"))) out.push(`${at}: a headline names {name}, under 200 characters, no straight apostrophes`);
    if (["dating", "school", "work", "business", "campaign", "money", "city", "halo", "hustler"].includes(m.area) && !m.when) out.push(`${at}: a ${m.area} move needs a when`);
  }
  return out;
}
