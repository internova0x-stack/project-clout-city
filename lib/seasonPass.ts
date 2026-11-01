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

export type PassReward =
  | { kind: "cash"; amount: number }
  | { kind: "clout"; amount: number }
  | { kind: "item"; sku: string }
  | { kind: "badge"; id: string };

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
  tiers: PassTier[];
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
  xpPerTier: 160,
  xp: { daily_task: 10, daily_bonus: 30, goal: 50 },
  badge: { id: "pass-s1", emoji: "💘", name: "Cuffing Season '26" },
  tiers: FREE.map((free, i) => ({
    tier: i + 1,
    free,
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

/** The badges this file gives, for the profile. */
export function passBadge(id: string): { emoji: string; name: string } | null {
  if (id === SEASON.badge.id) return SEASON.badge;
  if (id === STARTER_PACK.badge.id) return STARTER_PACK.badge;
  return null;
}

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
