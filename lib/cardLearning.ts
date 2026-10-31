// The Content Engine, step 6: learning what works (docs/CONTENT-ENGINE.md section 7; migration 0141). Every situation
// card's last 28 days in choice_log (shown, chosen, skipped, left to expire, and which option) become a weight the card
// picker multiplies by: cards players engage with, and split on, come up more; cards nearly everyone skips are retired.
// The owner can override any card in the Studio.
//
// Pure: the server (lib/contentImport.ts), the Studio and the tests run it.

export interface CardStats {
  card: string; base: string;
  /** Resolved showings (chosen + skipped + expired). */
  shown: number; chosen: number; skipped: number; expired: number;
  /** How often each option was picked. */
  options: Record<string, number>;
}

export interface CardWeight { card: string; weight: number; retired: boolean; stats: CardScore }
export interface CardScore { shown: number; engage: number; split: number; score: number }

export const LEARNING = {
  windowDays: 28,
  /** A card needs this many showings before its weight moves. */
  minShown: 25,
  /** Weights stay in this range (the database allows 0.25 to 3 for the owner's own settings). */
  weight: { min: 0.5, max: 1.6 },
  /** How far a card's score from the median moves its weight. */
  slope: 2,
  /** Retired: shown this often and chosen this rarely (most players close it). */
  retire: { minShown: 60, maxEngage: 0.2 },
  /** The score: mostly engagement (chosen ÷ shown), partly how evenly players split on it (a real dilemma). */
  mix: { engage: 0.7, split: 0.3 },
} as const;

/** 1 when players split evenly across the options, 0 when everyone picks the same one. */
export function splitOf(options: Record<string, number>, optionCount?: number): number {
  const counts = Object.values(options);
  const total = counts.reduce((a, b) => a + b, 0);
  const k = Math.max(optionCount ?? counts.length, 2);
  if (!total) return 0;
  const top = Math.max(...counts) / total;
  return Math.max(0, Math.min(1, (1 - top) / (1 - 1 / k)));
}

export function scoreOf(s: CardStats, optionCount?: number): CardScore {
  const engage = s.shown ? s.chosen / s.shown : 0;
  const split = splitOf(s.options, optionCount);
  return { shown: s.shown, engage, split, score: LEARNING.mix.engage * engage + LEARNING.mix.split * split };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Weights for every card with enough showings, measured against the median card. */
export function learnWeights(stats: readonly CardStats[], optionCounts: Record<string, number> = {}): CardWeight[] {
  const scored = stats.map((s) => ({ s, sc: scoreOf(s, optionCounts[s.card]) }));
  const ready = scored.filter((x) => x.s.shown >= LEARNING.minShown);
  const mid = median(ready.map((x) => x.sc.score));
  return ready.map(({ s, sc }) => {
    const retired = s.shown >= LEARNING.retire.minShown && sc.engage <= LEARNING.retire.maxEngage;
    const raw = 1 + (sc.score - mid) * LEARNING.slope;
    const weight = Math.round(Math.min(LEARNING.weight.max, Math.max(LEARNING.weight.min, raw)) * 100) / 100;
    return { card: s.card, weight, retired, stats: sc };
  });
}

/** The Studio's row: a card's numbers and where its weight comes from. */
export interface StudioCardRow {
  card: string; title: string; emoji: string; shown: number; engage: number; skipRate: number; split: number;
  weight: number; retired: boolean; setBy: "auto" | "admin" | null;
  /** A storylet's name slots, for the Studio's sample fill. */
  slots?: Record<string, import("./storylets.ts").SlotDef>;
}
export interface StudioLearning { rows: StudioCardRow[]; lastRun: string | null }

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The Studio's table: every card with numbers, its weight and who set it, the strongest first. */
export function studioRows(
  stats: readonly CardStats[],
  weights: readonly { card: string; weight: number; retired: boolean; set_by: "auto" | "admin" }[],
  cards: Record<string, { title: string; emoji: string; options: number; slots?: Record<string, import("./storylets.ts").SlotDef> }>,
): StudioCardRow[] {
  const byCard = new Map(weights.map((w) => [w.card, w]));
  const ids = [...new Set([...stats.map((s) => s.card), ...weights.map((w) => w.card)])];
  return ids.map((id) => {
    const s = stats.find((x) => x.card === id) ?? { card: id, base: id, shown: 0, chosen: 0, skipped: 0, expired: 0, options: {} };
    const sc = scoreOf(s, cards[id]?.options);
    const w = byCard.get(id);
    return {
      card: id, title: cards[id]?.title ?? id, emoji: cards[id]?.emoji ?? "🤔", shown: s.shown, engage: sc.engage,
      skipRate: s.shown ? s.skipped / s.shown : 0, split: sc.split,
      weight: w ? Number(w.weight) : 1, retired: w?.retired ?? false, setBy: w?.set_by ?? null, slots: cards[id]?.slots,
    };
  }).sort((a, b) => Number(a.retired) - Number(b.retired) || b.weight - a.weight || b.shown - a.shown);
}
