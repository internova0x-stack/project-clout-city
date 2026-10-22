// Story content types and the pure World State rules (World State Layer Brief v2).
// Production resolves these in SQL (supabase/migrations/0007); this module is the
// same logic in TypeScript for the validation script, unit tests and development
// previews. It never imports story content, so answers can't leak into a bundle.

export type Status = "active" | "paused" | "retired";
export type Phase = "early" | "mid" | "late" | "post";
export type PriceKind = "visit_price" | "event_entry" | "shop_price";

export interface StoryEffect {
  type: "price_multiplier" | "availability" | "chatter_topic" | "task_injection" | "place_state" | "flag" | "reward_modifier";
  tags?: string[];
  sku?: string;
  state?: "closed" | "restricted" | "open";
  allow?: string[];
  reason?: string;
  expires_day?: number;
  applies_to?: PriceKind;
  multiplier?: number;
  topic?: string;
  phase?: Phase;
  priority?: number;
  add?: string[];
  remove?: string[];
  place?: string;
  spawn_event?: string;
  cancel_event?: string;
  add_tags?: string[];
  unlock_action?: string;
  note?: string;
  set?: string;
}

/** `body` is the feed card's teaser; `post` the full blog post behind "Read more" (owner, Oct 22; paragraphs split by a blank line). */
export interface NewsItem { headline: string; body?: string; hook?: string; previously?: string | null; post?: string }

export interface PredictionOption { id: string; label: string }
export interface Prediction {
  id: string;
  question: string;
  options: PredictionOption[];
  closes_at: { day: number; time: string };
  reveal_beat: string;
  correct: string;
  reward: { clout: number; badge?: string };
  changeable?: boolean;
  roasts?: Record<string, string>;
}

export interface Beat {
  id: string;
  day: number;
  status: Status;
  points_at_answer?: boolean;
  card_note?: string;
  news: NewsItem[];
  effects: StoryEffect[];
  prediction?: Prediction;
  evidence?: { title: string; kind: string; lines: string[] };
}

export interface StoryTask {
  id: string;
  label: string;
  do: { place?: string; action?: string; event?: string; share?: string; evidence?: string };
  clout: number;
}

export interface StoryEvent {
  id: string;
  name: string;
  place: string;
  attendable: boolean;
  energy?: number;
  clout?: number;
  mood?: number;
  blurb: string;
}

export interface Arc {
  id: string;
  title: string;
  type: "main" | "side";
  kind?: string;
  parent_arc_id?: string;
  tier: "free" | "premium";
  sku?: string;
  status: Status;
  start_at?: string | null;
  start_weekday?: string;
  borough_scope?: string[];
  prompt?: string;
  emoji?: string;
  teaser?: string;
  answer_key?: Record<string, unknown>;
  badges?: { id: string; name: string; emoji: string; line: string }[];
  bonus_badge?: { badge: string; requires: string[] };
  /** Badge for a correct shadow guess in the archive (no clout). */
  shadow_badge?: string;
  tasks?: StoryTask[];
  events?: StoryEvent[];
  beats: Beat[];
  chatter?: Record<string, Partial<Record<Phase, Record<string, string[]>>>>;
}

export const NY = "America/New_York";

/** Whole days from a to b (YYYY-MM-DD). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function addDaysISO(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The arc's story day (1-based) on a New York date, or null before it starts. */
export function storyDay(arc: Pick<Arc, "start_at">, today: string, startOverride?: string | null): number | null {
  const start = startOverride ?? arc.start_at;
  if (!start) return null;
  const d = dayDiff(start, today) + 1;
  return d >= 1 ? d : null;
}

export const lastDay = (arc: Arc) => Math.max(0, ...arc.beats.map((b) => b.day));

/** A New York wall-clock time on a story day, as epoch ms (handles DST via Intl). */
export function nyTime(startAt: string, day: number, time = "00:00"): number {
  const date = addDaysISO(startAt, day - 1);
  const [h, m] = time.split(":").map(Number);
  // Find the UTC instant whose New York wall time is date h:m.
  const guess = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: NY, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asNy = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return guess + (guess - asNy);
}

export interface ActiveEffect { arc: string; beat: string; day: number; effect: StoryEffect }

/** Effects in force on a New York date: active arcs and beats, released, not expired. */
export function activeEffects(arcs: Arc[], today: string, starts: Record<string, string | null> = {}): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const arc of arcs) {
    if (arc.status !== "active" || arc.type === "side") continue; // side arcs are personal-layer only
    const day = storyDay(arc, today, starts[arc.id]);
    if (day === null) continue;
    for (const b of arc.beats) {
      if (b.status !== "active" || b.day > day) continue;
      for (const e of b.effects) {
        const expires = e.expires_day ?? (e.type === "task_injection" ? b.day + 1 : undefined);
        if (expires !== undefined && day >= expires) continue;
        out.push({ arc: arc.id, beat: b.id, day: b.day, effect: e });
      }
    }
  }
  return out;
}

export const PRICE_CAP = 2;

/** Highest matching multiplier, capped at 2x; clout always comes from the base price. */
export function resolvePrice(effects: ActiveEffect[], tags: string[], kind: PriceKind): { multiplier: number; reason: string | null } {
  let best: { multiplier: number; reason: string | null } = { multiplier: 1, reason: null };
  for (const { effect: e } of effects) {
    if (e.type !== "price_multiplier" || e.applies_to !== kind || !e.tags?.some((t) => tags.includes(t))) continue;
    const m = Math.min(PRICE_CAP, e.multiplier ?? 1);
    if (m > best.multiplier) best = { multiplier: m, reason: e.reason ?? null };
  }
  return best;
}

/** Closures override everything; then restrictions; story-only items need an "open" effect. */
export function resolveAvailability(
  effects: ActiveEffect[],
  target: { tags?: string[]; sku?: string },
): { state: "open" | "closed" | "restricted" | "default"; reason: string | null; allow: string[] | null } {
  const match = (e: StoryEffect) =>
    e.type === "availability" && ((target.sku && e.sku === target.sku) || (target.tags && e.tags?.some((t) => target.tags!.includes(t))));
  const hits = effects.map((x) => x.effect).filter(match);
  const closed = hits.find((e) => e.state === "closed");
  if (closed) return { state: "closed", reason: closed.reason ?? "Closed", allow: null };
  const restricted = hits.find((e) => e.state === "restricted");
  if (restricted) return { state: "restricted", reason: restricted.reason ?? "Restricted", allow: restricted.allow ?? [] };
  const open = hits.find((e) => e.state === "open");
  if (open) return { state: "open", reason: open.reason ?? null, allow: null };
  return { state: "default", reason: null, allow: null };
}

/** Up to two chatter topics, highest priority first (later beats win ties). */
export function activeChatter(effects: ActiveEffect[]): { topic: string; phase: Phase; arc: string }[] {
  const byTopic = new Map<string, { topic: string; phase: Phase; arc: string; priority: number; day: number }>();
  for (const x of effects) {
    const e = x.effect;
    if (e.type !== "chatter_topic" || !e.topic || !e.phase) continue;
    const cur = byTopic.get(e.topic);
    if (!cur || x.day >= cur.day) byTopic.set(e.topic, { topic: e.topic, phase: e.phase, arc: x.arc, priority: e.priority ?? 1, day: x.day });
  }
  return [...byTopic.values()].sort((a, b) => b.priority - a.priority || b.day - a.day).slice(0, 2);
}

/** When a prediction opens, closes and is revealed (epoch ms). */
export function predictionWindow(arc: Arc, beat: Beat, p: Prediction, startAt: string) {
  const reveal = arc.beats.find((b) => b.id === p.reveal_beat);
  return {
    opens: nyTime(startAt, beat.day),
    closes: nyTime(startAt, p.closes_at.day, p.closes_at.time) + 59_999,
    reveals: reveal ? nyTime(startAt, reveal.day) : Infinity,
  };
}
