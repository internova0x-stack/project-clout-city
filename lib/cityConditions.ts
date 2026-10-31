// The Content Engine, step 4: the city reacts (docs/CONTENT-ENGINE.md section 4; migration 0140). City conditions change
// the city for everyone for a while (a heatwave, a brownout, a festival), through the World State layer's own effects,
// so prices, doors and place banners react on their own. Two sources:
//   * weekly conditions, drafted by the routine into content/conditions/<Monday>.json, live 24 hours after they arrive
//     unless vetoed in Studio → Storylets;
//   * city storylets (content/city/reactions.json): approved templates that fire when players together cross a line in
//     the city's tallies (world_tally), e.g. lots of office sabotage at Tech → "HR crackdown week" there.
//
// Pure: validate:content, the content import, the Studio and the client read it.

import { FACTS } from "./memory.ts";

/** What a condition can be. Reactions use the same list. */
export const CONDITION_KINDS = {
  heatwave: { emoji: "🥵", label: "Heatwave" },
  cold_snap: { emoji: "🥶", label: "Cold snap" },
  rainstorm: { emoji: "🌧️", label: "Rainstorm" },
  brownout: { emoji: "🔌", label: "Brownout" },
  transit_meltdown: { emoji: "🚇", label: "Transit meltdown" },
  festival: { emoji: "🎪", label: "Festival" },
  sample_sale: { emoji: "🛍️", label: "Sample sale" },
  hr_crackdown: { emoji: "📋", label: "HR crackdown" },
  door_crackdown: { emoji: "🚪", label: "Doors tighten" },
  lotto_fever: { emoji: "🎟️", label: "Lotto fever" },
  ethics_probe: { emoji: "🔍", label: "Ethics probe" },
  full_precinct: { emoji: "🚔", label: "Full precinct" },
  party_surge: { emoji: "🪩", label: "Party surge" },
  showtime_season: { emoji: "🕺", label: "Showtime season" },
} as const;
export type ConditionKind = keyof typeof CONDITION_KINDS;

/** A World State effect a condition may carry (migration 0140 lets only these through). */
export interface ConditionEffect {
  type: "price_multiplier" | "availability" | "place_state";
  tags?: string[];
  applies_to?: "visit_price" | "event_entry" | "shop_price";
  multiplier?: number;
  state?: "closed" | "restricted";
  allow?: string[];
  place?: string;
  note?: string;
  reason?: string;
}

export interface CityCondition {
  id: string; kind: ConditionKind; subject?: string; emoji: string; title: string; blurb: string;
  startsAt: string; endsAt: string; effects: ConditionEffect[];
}
export interface ConditionWeek { week: string; conditions: CityCondition[] }

export interface ReactionRule {
  id: string;
  /** The tally: a key from lib/memory.ts FACTS (fact_note bumps world_tally), optionally one subject or a prefix. */
  key: string; subject?: string; subjectStarts?: string;
  /** Fires when the city's count over the last `days` New York days reaches `min`, at most once per `cooldownDays`. */
  days: number; min: number; cooldownDays: number;
  /** Lola's line in the Blotter when it fires (no player names). */
  headline?: string;
  condition: Omit<CityCondition, "id" | "startsAt" | "endsAt"> & { hours: number };
}

/** What players see (city_conditions_now()). */
export interface ConditionNow {
  id: string; kind: string; subject: string; emoji: string; title: string; blurb: string;
  startsAt: string; endsAt: string; now: boolean; source: "weekly" | "reaction";
}

/** The Studio's row (admin_conditions()). */
export interface StudioCondition {
  id: string; kind: string; subject: string; emoji: string; title: string; blurb: string; effects: ConditionEffect[];
  starts_at: string; ends_at: string; week: string | null; source: "weekly" | "reaction"; rule: string | null;
  status: "scheduled" | "paused" | "vetoed" | "live"; live_at: string; on: boolean; decided_at: string | null;
}

export const CONDITIONS = {
  /** A condition runs 2 hours to 3 days; a closure at most 12 hours (no lockouts, docs/CONTENT-ENGINE.md section 10). */
  hours: { min: 2, max: 72 },
  /** A city storylet can run up to a week (an HR crackdown week). */
  reactionMaxHours: 168,
  closedMaxHours: 12,
  /** Prices move at most ×0.5 to ×1.5 (the World State caps stories at ×2). */
  multiplier: { min: 0.5, max: 1.5 },
  perWeek: { max: 4 },
  /** Never touched: homes, campuses, civic places, the subway (protected systems). */
  protectedTags: ["residential", "campus", "university", "college", "civic", "police", "hospital", "transit", "subway", "home"],
} as const;

const HOUR = 3_600_000;
const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).getUTCDay() === 1;
const isKind = (k: unknown): k is ConditionKind => typeof k === "string" && k in CONDITION_KINDS;

function effectProblems(at: string, effects: unknown, hours: number, known: { tags: string[]; places: string[] }): string[] {
  const out: string[] = [];
  if (!Array.isArray(effects) || effects.length === 0 || effects.length > 4) return [`${at}: needs 1 to 4 effects`];
  for (const e of effects as ConditionEffect[]) {
    const et = `${at} effect ${e?.type}`;
    for (const t of e.tags ?? []) {
      if (!known.tags.includes(t)) out.push(`${et}: unknown tag "${t}"`);
      if ((CONDITIONS.protectedTags as readonly string[]).includes(t)) out.push(`${et}: "${t}" is protected (homes, campuses, civic places, transit)`);
    }
    if (e.type === "price_multiplier") {
      if (!e.tags?.length) out.push(`${et}: needs tags`);
      if (!["visit_price", "event_entry", "shop_price"].includes(e.applies_to ?? "")) out.push(`${et}: applies_to must be visit_price, event_entry or shop_price`);
      if (!(typeof e.multiplier === "number" && e.multiplier >= CONDITIONS.multiplier.min && e.multiplier <= CONDITIONS.multiplier.max && e.multiplier !== 1)) {
        out.push(`${et}: multiplier must be ${CONDITIONS.multiplier.min} to ${CONDITIONS.multiplier.max} (and not 1)`);
      }
      if (!e.reason || e.reason.length > 80) out.push(`${et}: needs a reason (at most 80 characters): players see it`);
    } else if (e.type === "availability") {
      if (!e.tags?.length) out.push(`${et}: needs tags`);
      if (e.state !== "closed" && e.state !== "restricted") out.push(`${et}: state must be closed or restricted`);
      if (e.state === "closed" && hours > CONDITIONS.closedMaxHours) out.push(`${et}: a closure lasts at most ${CONDITIONS.closedMaxHours} hours`);
      if (e.state === "restricted" && !e.allow?.length) out.push(`${et}: a restriction lists what's still allowed`);
      if (!e.reason || e.reason.length > 80) out.push(`${et}: needs a reason (at most 80 characters): players see it`);
    } else if (e.type === "place_state") {
      if (!e.place || !known.places.includes(e.place)) out.push(`${et}: unknown place "${e.place}"`);
      if (!e.note || e.note.length > 120) out.push(`${et}: needs a note (at most 120 characters)`);
    } else out.push(`${at}: effect type must be price_multiplier, availability or place_state`);
  }
  return out;
}

function faceProblems(at: string, c: { kind?: unknown; emoji?: unknown; title?: unknown; blurb?: unknown }): string[] {
  const out: string[] = [];
  if (!isKind(c.kind)) out.push(`${at}: kind must be one of ${Object.keys(CONDITION_KINDS).join(", ")}`);
  if (typeof c.emoji !== "string" || !c.emoji) out.push(`${at}: needs an emoji`);
  if (typeof c.title !== "string" || !c.title || c.title.length > 60) out.push(`${at}: title must be 1 to 60 characters`);
  if (typeof c.blurb !== "string" || !c.blurb || c.blurb.length > 200) out.push(`${at}: blurb must be 1 to 200 characters`);
  if (/integrity|\bhalo\b|\bhustler\b/i.test(`${c.title} ${c.blurb}`)) out.push(`${at}: never name the meter`);
  return out;
}

/** A weekly conditions file: a Monday, up to 4 conditions inside that week (Monday to the next Monday). */
export function validateConditionWeek(raw: unknown, known: { tags: string[]; places: string[] }, others: string[] = []):
  { ok: true; week: ConditionWeek } | { ok: false; problems: string[] } {
  const w = raw as Partial<ConditionWeek> | null;
  if (!w || typeof w !== "object") return { ok: false, problems: ["the file must be an object with week and conditions"] };
  const out: string[] = [];
  if (typeof w.week !== "string" || !isMonday(w.week)) out.push("week must be a Monday (YYYY-MM-DD)");
  const list = Array.isArray(w.conditions) ? w.conditions : [];
  if (!list.length || list.length > CONDITIONS.perWeek.max) out.push(`a week has 1 to ${CONDITIONS.perWeek.max} conditions`);
  const ids = new Set(others);
  const weekStart = Date.parse(`${w.week}T04:00:00Z`);
  for (const c of list) {
    const at = `condition ${c?.id ?? "?"}`;
    if (!/^[a-z0-9-]+$/.test(c?.id ?? "")) out.push(`${at}: id must be lowercase-with-dashes`);
    if (ids.has(c.id)) out.push(`${at}: repeated id`);
    ids.add(c.id);
    out.push(...faceProblems(at, c));
    const s = Date.parse(c.startsAt), e = Date.parse(c.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(e)) { out.push(`${at}: startsAt and endsAt must be times (e.g. 2026-11-04T12:00:00-05:00)`); continue; }
    const hours = (e - s) / HOUR;
    if (hours < CONDITIONS.hours.min || hours > CONDITIONS.hours.max) out.push(`${at}: lasts ${CONDITIONS.hours.min} to ${CONDITIONS.hours.max} hours`);
    if (Number.isFinite(weekStart) && (s < weekStart || s >= weekStart + 7 * 24 * HOUR)) out.push(`${at}: starts inside its week`);
    out.push(...effectProblems(at, c.effects, hours, known));
  }
  return out.length ? { ok: false, problems: out } : { ok: true, week: { week: w.week as string, conditions: list } };
}

/** City storylets: every rule reads a real tally, fires a valid condition, and can't fire too often. */
export function validateReactions(rules: readonly ReactionRule[], known: { tags: string[]; places: string[] }): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    const at = `reaction ${r.id}`;
    if (!/^[a-z0-9-]+$/.test(r.id ?? "")) out.push(`${at}: id must be lowercase-with-dashes`);
    if (ids.has(r.id)) out.push(`${at}: repeated id`);
    ids.add(r.id);
    if (!(r.key in FACTS)) out.push(`${at}: unknown tally key "${r.key}" (lib/memory.ts FACTS)`);
    if (!(r.days >= 1 && r.days <= 14)) out.push(`${at}: days must be 1 to 14`);
    if (!(r.min >= 3)) out.push(`${at}: min must be at least 3 (a crowd, not one player)`);
    if (!(r.cooldownDays >= r.days && r.cooldownDays <= 60)) out.push(`${at}: cooldownDays must be at least days, at most 60`);
    if (r.headline !== undefined && (r.headline.length > 200 || /\{name\}|@/.test(r.headline))) out.push(`${at}: headline is at most 200 characters and names no player`);
    const c = r.condition;
    if (!c) { out.push(`${at}: needs a condition`); continue; }
    out.push(...faceProblems(at, c));
    if (!(c.hours >= CONDITIONS.hours.min && c.hours <= CONDITIONS.reactionMaxHours)) out.push(`${at}: condition lasts ${CONDITIONS.hours.min} to ${CONDITIONS.reactionMaxHours} hours`);
    out.push(...effectProblems(at, c.effects, c.hours, known));
  }
  return out;
}

// ---- What players see ----

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", timeZone: "America/New_York" });

/** "Until Thu 6 PM" / "From Sat 10 AM to Sun 8 PM". */
export function conditionWhen(c: Pick<ConditionNow, "now" | "startsAt" | "endsAt">): string {
  return c.now ? `Until ${fmt(c.endsAt)}` : `From ${fmt(c.startsAt)} to ${fmt(c.endsAt)}`;
}

/** The kinds in force now (storylets read them: `snap: "conditions"`). */
export const conditionsInForce = (list: readonly Pick<ConditionNow, "kind" | "now">[]) => [...new Set(list.filter((c) => c.now).map((c) => c.kind))];

/** Whether a kind is in force for a subject (e.g. an HR crackdown at Tech). */
export const conditionOn = (list: readonly Pick<ConditionNow, "kind" | "now" | "subject">[], kind: ConditionKind, subject?: string) =>
  list.some((c) => c.now && c.kind === kind && (!subject || !c.subject || c.subject === subject));
