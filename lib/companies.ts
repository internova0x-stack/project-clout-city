// Company health (owner, Nov 4: "some kind of context into the office work and business… This should inform targets that
// the boss has set, and the health of the business should be part of the world state"). Pure: the server
// (lib/companyServer.ts) and the preview (lib/careerSim.ts) run it.
//
// Every employer has a situation and a weekly target the big boss sets, in the business's own units. A company's health
// (0 to 100) is shared by every player in the city: the rest of the staff (simulated) and the players who work there
// push the week's progress, and the week closes on Sunday night New York time: target hit, health up and next week's
// target a little higher; missed, health down. Thriving (67+) pays a bonus on payday; Struggling (under 34) freezes
// raises, and under 20 promotions too (owner, Nov 4: "Keep the bonuses", "Only freeze", never layoffs).

import type { TrackId } from "./careers.ts";

export const COMPANY = {
  start: 55,
  levels: { low: 34, high: 67, freeze: 20 },
  /** Health after a week: hit the target +8 (+4 more at 120%), missed −8 (−4 more under 70%). */
  hit: 8, bigHit: 4, miss: 8, bigMiss: 4,
  /** Thriving raises next week's target ×1.1; struggling eases it ×0.95. Never below 80% or above 150% of the base. */
  raise: 1.1, ease: 0.95, minTarget: 0.8, maxTarget: 1.5,
  /** The rest of the staff: between these shares of the target a week (seeded by company and week), a little better
   * when the company is healthy (morale). */
  staff: { min: 0.72, max: 1.08, healthLift: 0.12 },
  /** A player's workday: at most this share of the target (a hustle day with tasks gone well). */
  perWorkday: 0.03,
  /** What health does to the people who work there. */
  bonus: 0.1, moodHigh: 2, moodLow: -3,
  history: 8,
} as const;

export interface CompanyDef {
  track: TrackId;
  emoji: string;
  name: string;
  /** Who sets the target (the big boss's short name). */
  boss: string;
  situation: string;
  unit: string;
  /** The base weekly target. */
  target: number;
  /** Decimal places the target is shown with (returns: one). */
  decimals?: number;
  /** A line for each level, said after the situation. */
  good: string;
  bad: string;
  /** Lola's Blotter when the company turns Thriving, or falls to Struggling. */
  up: string;
  down: string;
}

export const COMPANIES: CompanyDef[] = [
  { track: "hospitality", emoji: "🍽️", name: "The Gossip Group", boss: "Despina", unit: "covers", target: 1200,
    situation: "Expanding into new neighborhoods. Despina wants a café in Sunnyside by spring, and the bank wants to see the sales first.",
    good: "The Sunnyside lease is signed.", bad: "The Sunnyside plan is on hold and the espresso machine is on a payment plan.",
    up: "The Gossip Group signs its Sunnyside lease. Despina Kouris celebrates by raising the price of a cortado.",
    down: "The Gossip Group shelves its Sunnyside opening. Despina blames \"the economy and Kendall.\"" },
  { track: "tech", emoji: "💻", name: "Pivotly", boss: "Skyler", unit: "paying customers", target: 40,
    situation: "Struggling to find profitability before the money runs out. Nine weeks of runway, a fourth pivot, and nobody can explain the product.",
    good: "Runway extended to a year. Skyler bought a gong.", bad: "Runway down to five weeks. All-hands meetings now happen standing up.",
    up: "Pivotly turns a profit for the first time. Skyler Beta announces a fifth pivot anyway.",
    down: "Pivotly lays off its office dog's walker. Cold brew rationed." },
  { track: "media", emoji: "🎬", name: "Clout TV", boss: "the network", unit: "viewers", target: 1_500_000,
    situation: "Ratings are slipping to streamers. The network wants one hit show before the upfronts, or heads roll.",
    good: "Advertisers are fighting over the 9 PM slot.", bad: "The network is \"reviewing the lineup\". That's never good.",
    up: "Clout TV has a hit. The network renews everything, including the bad shows.",
    down: "Clout TV cancels three shows in one afternoon. The anchors are nervous." },
  { track: "cityhall", emoji: "🏛️", name: "The Mayor's Office", boss: "Papa-Dani", unit: "ribbons cut", target: 6,
    situation: "It's election year. Papa-Dani needs to look busy, and nothing looks busier than a ribbon.",
    good: "The approval rating is up. He's talking about a second term. And a third.", bad: "The press office is drafting apologies in advance.",
    up: "Papa-Dani cuts a record number of ribbons. Approval up, scissors blunt.",
    down: "City Hall misses its ribbon target. The Mayor calls it \"a strategic pause.\"" },
  { track: "streaming", emoji: "🎮", name: "Glow Up Collective", boss: "Tyce", unit: "new followers", target: 25_000,
    situation: "Brand deals are drying up. Tyce needs one viral moment before the energy drink sponsor walks.",
    good: "Brands are in the DMs. Tyce got a ring light for his ring light.", bad: "The sponsor \"paused\" the deal. The fridge is BYO energy drink now.",
    up: "Glow Up Collective goes viral. The energy drink deal is renewed, in a bigger can.",
    down: "The Glow Up House loses its sponsor. The ring lights are on a timer now." },
  { track: "fashion", emoji: "👗", name: "Atelier Vernon", boss: "Madame Odile", unit: "looks finished", target: 12,
    situation: "Fashion Week is in three weeks and the collection isn't finished. Madame Odile has started speaking only in French.",
    good: "Front row is full. Every editor wants the closing look.", bad: "Half the collection is still pins. Odile has stopped eating lunch.",
    up: "Atelier Vernon's collection is the talk of Fashion Week. Madame Odile almost smiled.",
    down: "Atelier Vernon pulls out of Fashion Week. \"We are not ready to be understood.\"" },
  { track: "realestate", emoji: "🏠", name: "No-Fee* Realty", boss: "Lorraine", unit: "leases signed", target: 15,
    situation: "Rents are up and listings are down. Lorraine needs signed leases, and the asterisk is doing a lot of work.",
    good: "Commission checks are clearing. Gary bought a car shaped like a boat.", bad: "Lorraine is personally calling every lead from 2019.",
    up: "No-Fee* Realty signs a record month. The asterisk gets its own office.",
    down: "No-Fee* Realty quietly adds a second asterisk." },
  { track: "finance", emoji: "📈", name: "Queensboro Capital", boss: "Conrad", unit: "% returns", target: 2.5, decimals: 1,
    situation: "A client fund is down 8% and the partners want it back before the quarter closes. Conrad has stopped taking lunch meetings.",
    good: "Bonus season. The pickle suits are back.", bad: "The fund is still down. Compliance sits in on every meeting.",
    up: "Queensboro Capital beats the market. Conrad Vance rings a bell nobody asked him to ring.",
    down: "Queensboro Capital loses its biggest client. The trading floor is very quiet." },
  { track: "law", emoji: "⚖️", name: "Whitlock & Hale LLP", boss: "Harrison", unit: "billable hours", target: 400,
    situation: "Billable hours are short and the firm's biggest client is shopping for a new firm. Harrison Hale III is billing his naps.",
    good: "The client renewed. Harrison is billing for the celebration.", bad: "Everyone is billing in six-minute increments.",
    up: "Whitlock & Hale keeps its biggest client. The partners celebrate with a 30-minute meeting, billed.",
    down: "Whitlock & Hale loses its biggest client. The portraits in the lobby look disappointed." },
];

export const companyOf = (track: string): CompanyDef | undefined => COMPANIES.find((c) => c.track === track);

export type CompanyLevel = "low" | "medium" | "high";
export const companyLevel = (health: number): CompanyLevel =>
  health < COMPANY.levels.low ? "low" : health >= COMPANY.levels.high ? "high" : "medium";
export const LEVEL_WORD: Record<CompanyLevel, string> = { high: "Thriving", medium: "Steady", low: "Struggling" };

/** What's stored per company (public.companies.state, migration 0161). `contrib` is the players' part this week. */
export interface CompanyState {
  v: 1;
  track: TrackId;
  health: number;
  /** The Monday (New York) this week started. */
  week: string;
  target: number;
  contrib: number;
  history: { week: string; hit: boolean; progress: number; target: number; health: number }[];
}

const DAY = 86_400_000;
const nyDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / DAY);
const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** The Monday (New York) of the week a moment falls in. */
export function weekOf(ms: number): string {
  const d = nyDate(ms);
  const n = dayNum(d);
  const dow = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday 0
  return isoOf(n - dow);
}
export const nextWeek = (week: string) => isoOf(dayNum(week) + 7);

/** How far through its week a moment is (0 Monday morning, 1 Sunday night), by New York days and hours. */
export function weekElapsed(week: string, ms: number): number {
  const d = nyDate(ms);
  const days = dayNum(d) - dayNum(week);
  if (days < 0) return 0;
  if (days >= 7) return 1;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(ms)));
  return Math.min(1, (days + hour / 24) / 7);
}

/** A steady pseudo-random number in [0, 1) for a company and week (the rest of the staff's week, the same everywhere). */
function seeded(track: string, week: string): number {
  let h = 2166136261;
  for (const ch of `${track}:${week}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** The rest of the staff's whole week, as a share of the target. */
export function staffShare(track: string, week: string, health: number): number {
  const S = COMPANY.staff;
  return S.min + (S.max - S.min) * seeded(track, week) + S.healthLift * ((health - 50) / 50);
}

export function newCompany(def: CompanyDef, ms: number): CompanyState {
  return { v: 1, track: def.track, health: COMPANY.start, week: weekOf(ms), target: def.target, contrib: 0, history: [] };
}

/** The week so far: the staff's share pro rata, plus everything players added. */
export function progressOf(s: CompanyState, ms: number): number {
  return staffShare(s.track, s.week, s.health) * s.target * weekElapsed(s.week, ms) + s.contrib;
}

/**
 * Closes every week that has ended (several if nobody looked in a while) and opens the current one. Returns the new
 * state and the level changes on the way (for Lola's Blotter), oldest first.
 */
export function rollCompany(def: CompanyDef, s: CompanyState, ms: number): { state: CompanyState; changes: { from: CompanyLevel; to: CompanyLevel }[] } {
  const now = weekOf(ms);
  const out: CompanyState = structuredClone(s);
  const changes: { from: CompanyLevel; to: CompanyLevel }[] = [];
  let guard = 0;
  while (out.week < now && guard++ < 60) {
    const progress = staffShare(out.track, out.week, out.health) * out.target + out.contrib;
    const ratio = progress / Math.max(1e-9, out.target);
    const before = companyLevel(out.health);
    const hit = ratio >= 1;
    const delta = hit ? COMPANY.hit + (ratio >= 1.2 ? COMPANY.bigHit : 0) : -(COMPANY.miss + (ratio < 0.7 ? COMPANY.bigMiss : 0));
    out.health = Math.max(5, Math.min(95, Math.round(out.health + delta)));
    out.history = [...out.history, { week: out.week, hit, progress: round(progress, def), target: out.target, health: out.health }].slice(-COMPANY.history);
    const after = companyLevel(out.health);
    if (after !== before) changes.push({ from: before, to: after });
    const mult = after === "high" ? COMPANY.raise : after === "low" ? COMPANY.ease : 1;
    out.target = round(Math.max(def.target * COMPANY.minTarget, Math.min(def.target * COMPANY.maxTarget, out.target * mult)), def);
    out.week = nextWeek(out.week);
    out.contrib = 0;
  }
  if (out.week > now) out.week = now;
  return { state: out, changes };
}

const round = (n: number, def: Pick<CompanyDef, "decimals">) => {
  const f = 10 ** (def.decimals ?? 0);
  return Math.round(n * f) / f;
};

/** "1,200 covers", "2.5 % returns" (as shown). */
export function units(def: Pick<CompanyDef, "decimals" | "target">, n: number): string {
  if (def.decimals) return n.toFixed(def.decimals);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return Math.round(n).toLocaleString("en-US");
}

/**
 * A workday's part of the target: hustle 1, steady 0.65, coast 0.3 of COMPANY.perWorkday, scaled by how the tasks went
 * (all well 1, mixed 0.6, badly 0.25).
 */
export function workdayShare(style: "hustle" | "steady" | "coast", avgTaskPerf: number): number {
  const pace = style === "hustle" ? 1 : style === "steady" ? 0.65 : 0.3;
  const quality = avgTaskPerf > 0 ? 1 : avgTaskPerf === 0 ? 0.6 : 0.25;
  return COMPANY.perWorkday * pace * quality;
}

/** What the player sees (Careers and News → City's Business pages). */
export interface CompanyView {
  track: TrackId;
  emoji: string;
  name: string;
  boss: string;
  situation: string;
  line: string;
  unit: string;
  health: number;
  level: CompanyLevel;
  target: number;
  progress: number;
  /** Shown strings, in the company's units. */
  targetText: string;
  progressText: string;
  daysLeft: number;
  lastWeek: { hit: boolean } | null;
}

export function companyView(def: CompanyDef, s: CompanyState, ms: number): CompanyView {
  const level = companyLevel(s.health);
  const progress = progressOf(s, ms);
  const last = s.history[s.history.length - 1];
  return {
    track: def.track, emoji: def.emoji, name: def.name, boss: def.boss, situation: def.situation,
    line: level === "high" ? def.good : level === "low" ? def.bad : "", unit: def.unit,
    health: s.health, level, target: s.target, progress: round(progress, def),
    targetText: units(def, s.target), progressText: units(def, progress),
    daysLeft: Math.max(0, 6 - (dayNum(nyDate(ms)) - dayNum(s.week))),
    lastWeek: last ? { hit: last.hit } : null,
  };
}

/** What the company's health does to a review (lib/careers.ts reads it through CareerCtx.company). */
export const companyRules = (health: number) => ({
  bonus: health >= COMPANY.levels.high ? COMPANY.bonus : 0,
  raisesFrozen: health < COMPANY.levels.low,
  promotionsFrozen: health < COMPANY.levels.freeze,
  workMood: health >= COMPANY.levels.high ? COMPANY.moodHigh : health < COMPANY.levels.low ? COMPANY.moodLow : 0,
});

/** Lola's Blotter line for a level change, or null when it isn't news (turning Thriving or Struggling is). */
export function companyHeadline(def: CompanyDef, change: { from: CompanyLevel; to: CompanyLevel }): string | null {
  if (change.to === "high") return `📈 ${def.up}`;
  if (change.to === "low") return `📉 ${def.down}`;
  if (change.from === "low") return `📰 ${def.name} is back on its feet. Barely. ${def.boss} is cautiously optimistic.`;
  return null;
}
