// The Clout Pass and the starter pack (owner, Nov 1: "go with your recommendation"; migration 0156).
//
// The Clout Pass is a season (8 weeks) of tiers filled by XP from what players already do: each daily task, the all-five
// day bonus and each goal. Every tier has a free reward (C$, clout or a piece) and a paid one. The paid row is looks only
// (exclusive outfits and furniture, the season badge), never C$, clout or anything that changes play. It opens with the
// pass ($7.99, store_products 'season-pass-s1') or VIP (owner: VIP includes the pass). XP earned before buying counts.
//
// The starter pack ($2.99, 'starter-pack') is sold once, in a player's first 14 days: an exclusive outfit, a furniture set
// and the Day One badge.
//
// Every piece is `reward: true` in lib/city.ts: never on sale, never sold back, traded or gifted, kept by Start over
// (player_items acquired 'collector', value 0, so Net Worth and the Crib Rating don't move). This file is mirrored by
// game_settings 'season_pass' and 'starter_pack' (tests/seasonPass.test.ts checks the migration's copy).
//
// Stakes (owner, Nov 16: "Clout pass seems to have no stakes… one just continues to play as usual"; migration 0167): most XP
// now comes from three weekly challenges that expire on Sunday (`WEEKS`, from the `CHALLENGES` pool, counted by the server
// from what the player did that New York week), daily play earns less (a task 5, all five 20, a level 200), the pass shows
// whether you're on pace to finish (`pace`), and Level 18's free reward is a season title other players see by your name
// (`TITLE`, the leaderboard, chat and the player card). Levels reached before the change were kept (the migration's carry).

export type PassReward =
  | { kind: "cash"; amount: number }
  | { kind: "clout"; amount: number }
  | { kind: "item"; sku: string }
  | { kind: "badge"; id: string }
  /** A season title shown by the player's name (Level 18's free reward). */
  | { kind: "title"; id: string };

export interface PassTier { tier: number; free: PassReward[]; paid: PassReward[] }

export interface Season {
  id: string;
  /** The store product that opens the paid row. */
  sku: string;
  name: string;
  tagline: string;
  /** New York dates, both inclusive. */
  starts: string;
  ends: string;
  /** Rewards can still be claimed this many days after the season ends. */
  claimDays: number;
  xpPerTier: number;
  /** XP per ledger row of each kind (one per task, day or goal). */
  xp: Record<string, number>;
  badge: { id: string; emoji: string; name: string };
  /** The title Level 18 gives, never given again after the season. */
  title: { id: string; emoji: string; name: string };
  tiers: PassTier[];
}

/** Where a challenge's count comes from: ledger rows of these kinds that New York week, or Moral Choices made. */
export type ChallengeSource = { ledger: string[] } | { choices: true };
export interface Challenge { id: string; emoji: string; title: string; need: number; xp: number; source: ChallengeSource }

/**
 * The weekly challenges (owner, Nov 16), in three groups: one of each a week. Each counts something the player does in that
 * New York week (Monday to Sunday) and pays its XP once when the count is reached.
 */
export const CHALLENGES: { social: Challenge[]; city: Challenge[]; routine: Challenge[] } = {
  social: [
    { id: "dates2", emoji: "💘", title: "Go on 2 date nights", need: 2, xp: 120, source: { ledger: ["date_night"] } },
    { id: "host1", emoji: "🏠", title: "Have people over once", need: 1, xp: 90, source: { ledger: ["visit_host"] } },
    { id: "guest1", emoji: "🛋️", title: "Go over to a friend's place", need: 1, xp: 90, source: { ledger: ["visit_guest"] } },
    { id: "events2", emoji: "🎉", title: "Go to 2 events", need: 2, xp: 100, source: { ledger: ["event"] } },
  ],
  city: [
    { id: "choices3", emoji: "🎭", title: "Make the call on 3 choices", need: 3, xp: 90, source: { choices: true } },
    { id: "life3", emoji: "🗽", title: "Do 3 things around the city", need: 3, xp: 90, source: { ledger: ["place_life"] } },
    { id: "shifts3", emoji: "🧾", title: "Work 3 shifts", need: 3, xp: 90, source: { ledger: ["shift"] } },
  ],
  routine: [
    { id: "five4", emoji: "🔥", title: "All five daily tasks, 4 days this week", need: 4, xp: 100, source: { ledger: ["daily_bonus"] } },
    { id: "goal1", emoji: "🎯", title: "Finish a goal", need: 1, xp: 90, source: { ledger: ["goal"] } },
  ],
};
export const ALL_CHALLENGES: Challenge[] = [...CHALLENGES.social, ...CHALLENGES.city, ...CHALLENGES.routine];
export const challengeById = (id: string) => ALL_CHALLENGES.find((c) => c.id === id) ?? null;

const dayMs = 86_400_000;
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** The Monday of a New York date's week. */
export function weekOf(day: string): string {
  const t = utc(day);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday 0
  return iso(t - dow * dayMs);
}

/** Each week's three, from the first Monday of challenges to the season's end: rotating through each group. */
export function seasonWeeks(from: string, ends: string): { from: string; ids: string[] }[] {
  const out: { from: string; ids: string[] }[] = [];
  for (let t = utc(from), i = 0; t <= utc(ends); t += 7 * dayMs, i++) {
    const pick = <T,>(list: T[], k: number) => list[(i * k) % list.length];
    out.push({ from: iso(t), ids: [pick(CHALLENGES.social, 1), pick(CHALLENGES.city, 2), pick(CHALLENGES.routine, 1)].map((c) => c.id) });
  }
  return out;
}

const cash = (amount: number): PassReward => ({ kind: "cash", amount });
const clout = (amount: number): PassReward => ({ kind: "clout", amount });
const item = (sku: string): PassReward => ({ kind: "item", sku });

const FREE: PassReward[][] = [
  [cash(100)], [clout(10)], [cash(150)], [clout(15)], [cash(200)], [item("home-pass-s1-free-rug")],
  [clout(20)], [cash(250)], [clout(25)], [cash(300)], [clout(30)], [item("home-pass-s1-free-plant")],
  [cash(350)], [clout(35)], [cash(400)], [clout(40)], [cash(450)], [cash(500), clout(50)],
];
const PAID: string[] = [
  "pass-s1-cuffing-hoodie", "home-pass-s1-situationship-neon", "pass-s1-winter-tee", "home-pass-s1-velvet-loveseat",
  "pass-s1-plaid-pants", "home-pass-s1-fireplace-rug", "pass-s1-rink-zip", "home-pass-s1-candle-lamp",
  "pass-s1-skate-skirt", "home-pass-s1-cocoa-bar", "home-pass-s1-cuffing-bed", "pass-s1-date-blazer",
  "home-pass-s1-snow-plant", "home-pass-s1-record-shelf", "pass-s1-cocoa-boots", "home-pass-s1-heart-armchair",
  "home-pass-s1-mug-stand", "pass-s1-cuffed-cap",
];

export const SEASON: Season = {
  id: "s1",
  sku: "season-pass-s1",
  name: "Cuffing Season",
  tagline: "Eight weeks to find someone to be seen with. Or just a really good sweater.",
  starts: "2026-11-07",
  ends: "2027-01-01",
  claimDays: 14,
  // Owner, Nov 16: challenges carry most of the XP now (migration 0167; it was 160 a level, 10 a task, 30 for all five).
  xpPerTier: 200,
  // Migration 0173 (Your Scene, step 3): a collected move earns 10 XP.
  xp: { daily_task: 5, daily_bonus: 20, goal: 50, scene: 10 },
  badge: { id: "pass-s1", emoji: "💘", name: "Cuffing Season '26" },
  title: { id: "cuffed-26", emoji: "💘", name: "Cuffed '26" },
  tiers: FREE.map((free, i) => ({
    tier: i + 1,
    free: i === FREE.length - 1 ? [...free, { kind: "title", id: "cuffed-26" } as PassReward] : free,
    paid: [item(PAID[i]), ...(i === FREE.length - 1 ? [{ kind: "badge", id: "pass-s1" } as PassReward] : [])],
  })),
};

export const STARTER_PACK = {
  sku: "starter-pack",
  name: "Day One Starter Pack",
  /** Sold in a player's first `days` days (from the account's creation). */
  days: 14,
  items: ["pp-first-week-hoodie", "pp-subway-cargos", "pp-puddle-boots", "home-pp-starter-sofa", "home-pp-welcome-rug", "home-pp-ring-lamp"],
  badge: { id: "day-one", emoji: "🗽", name: "Day One New Yorker" },
} as const;

/** The challenges, a week at a time, from the week migration 0167 went in (Monday Nov 16) to the season's end. */
export const WEEKS = seasonWeeks("2026-11-16", SEASON.ends);

/** The badges this file gives, for the profile. */
export function passBadge(id: string): { emoji: string; name: string } | null {
  if (id === SEASON.badge.id) return SEASON.badge;
  if (id === STARTER_PACK.badge.id) return STARTER_PACK.badge;
  if (id === `title-${SEASON.title.id}`) return { emoji: SEASON.title.emoji, name: `"${SEASON.title.name}" title` };
  return null;
}

/** The chip by a title holder's name. */
export const titleChipText = () => `${SEASON.title.emoji} ${SEASON.title.name}`;

/** The Clout Pass's own icon (owner, Nov 16: a ticket, not the season badge's heart). */
export const PASS_EMOJI = "🎟️";

/** The tier an amount of XP has reached (0 before the first), and progress into the next. */
export function tierFor(xp: number, season: Pick<Season, "xpPerTier" | "tiers"> = SEASON) {
  const tier = Math.min(season.tiers.length, Math.floor(Math.max(0, xp) / season.xpPerTier));
  const max = tier >= season.tiers.length;
  return { tier, into: max ? season.xpPerTier : xp - tier * season.xpPerTier, need: season.xpPerTier, max };
}

/** The state the server sends (season_state()). */
export interface PassState {
  season: Season;
  xp: number;
  /** Paid row open: bought the pass, or a VIP member. */
  paid: boolean;
  vip: boolean;
  /** "soon" before it starts, "on" while it runs, "claim" in the grace days after, "over" after that. */
  phase: "soon" | "on" | "claim" | "over";
  /** Claimed tiers by row. */
  claimed: { free: number[]; paid: number[] };
  /** Today's XP so far (New York day). */
  today: number;
  /** Paid at Stripe, waiting for the webhook. */
  pending?: boolean;
  /** This week's challenges and how far along each is (season_state, migration 0167); absent before it. */
  week?: { from: string; challenges: { id: string; have: number; done: boolean }[] } | null;
}

/**
 * Will you finish? Your average XP a day so far (from the season's start, or the first day you earned, at least 3 days in)
 * carried to the season's end. On track at 18; otherwise the level you're heading for. `spare`: days left over at that rate.
 */
export function pace(s: Pick<PassState, "xp" | "season">, today: string): { onTrack: boolean; heading: number; spare: number } {
  const total = s.season.tiers.length * s.season.xpPerTier;
  if (s.xp >= total) return { onTrack: true, heading: s.season.tiers.length, spare: daysLeft(today, s.season) };
  const elapsed = Math.max(3, Math.round((utc(today) - utc(s.season.starts)) / dayMs) + 1);
  const rate = s.xp / elapsed;
  const left = daysLeft(today, s.season);
  const end = s.xp + rate * left;
  const heading = Math.min(s.season.tiers.length, Math.floor(end / s.season.xpPerTier));
  const need = rate > 0 ? Math.ceil((total - s.xp) / rate) : Infinity;
  return { onTrack: heading >= s.season.tiers.length, heading, spare: Number.isFinite(need) ? Math.max(0, left - need) : 0 };
}

export interface StarterPackState {
  /** Can buy it now (in the window, not owned). */
  offer: boolean;
  owned: boolean;
  endsAt: string | null;
  pending?: boolean;
}

/** Tiers reached whose reward in this row hasn't been claimed (the paid row only when it's open). */
export function claimable(s: PassState): { free: number[]; paid: number[] } {
  if (s.phase === "soon" || s.phase === "over") return { free: [], paid: [] };
  const { tier } = tierFor(s.xp, s.season);
  const reached = s.season.tiers.filter((t) => t.tier <= tier).map((t) => t.tier);
  return {
    free: reached.filter((t) => !s.claimed.free.includes(t) && s.season.tiers[t - 1].free.length > 0),
    paid: s.paid ? reached.filter((t) => !s.claimed.paid.includes(t)) : [],
  };
}

export function rewardLabel(r: PassReward, name: (sku: string) => string | undefined): string {
  if (r.kind === "cash") return `C$${r.amount.toLocaleString("en-US")}`;
  if (r.kind === "clout") return `${r.amount} clout`;
  if (r.kind === "badge") return `${passBadge(r.id)?.name ?? "Badge"} badge`;
  if (r.kind === "title") return `The "${SEASON.title.name}" title`;
  return name(r.sku) ?? r.sku;
}

/** Days left in the season (inclusive of today), from a New York date. */
export function daysLeft(today: string, season: Pick<Season, "ends"> = SEASON): number {
  const d = (a: string) => Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.max(0, Math.round((d(season.ends) - d(today)) / 86_400_000) + 1);
}

/** What the settings row holds (the migration's JSON). */
export function seasonSettings(s: Season = SEASON) {
  return { id: s.id, sku: s.sku, name: s.name, starts: s.starts, ends: s.ends, claimDays: s.claimDays, xpPerTier: s.xpPerTier, xp: s.xp, badge: s.badge.id, tiers: s.tiers };
}
/** Migration 0167's additions to the settings row: the title and the weekly challenges (definitions and the schedule). */
export function seasonStakesSettings(s: Season = SEASON) {
  return {
    ...seasonSettings(s), title: s.title.id,
    challenges: Object.fromEntries(ALL_CHALLENGES.map((c) => [c.id, { need: c.need, xp: c.xp, source: c.source }])),
    weeks: WEEKS,
  };
}
export function starterPackSettings() {
  return { sku: STARTER_PACK.sku, days: STARTER_PACK.days, items: STARTER_PACK.items, badge: STARTER_PACK.badge.id };
}

export type PassResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface PassApi {
  state(): Promise<PassResult<PassState>>;
  /** Claims every reward reached (both rows); returns what was claimed. */
  claimAll(): Promise<PassResult<PassState & { got: PassReward[] }>>;
  starter(): Promise<PassResult<StarterPackState>>;
}

const ERRORS: Record<string, string> = {
  season_soon: "The season hasn't started yet.",
  season_over: "This season is over. A new one starts soon.",
  offer_over: "The starter pack was for your first two weeks. It's gone now.",
  vip_has_pass: "VIP already includes the Clout Pass.",
};
export const passError = (code: string) => ERRORS[code] ?? null;

/** Every piece the pass and the pack give (lib/city.ts, reward-only; migration 0156 adds their catalog rows). */
export const PASS_SKUS: readonly string[] = [
  ...SEASON.tiers.flatMap((t) => [...t.free, ...t.paid]).flatMap((r) => (r.kind === "item" ? [r.sku] : [])),
  ...STARTER_PACK.items,
];
