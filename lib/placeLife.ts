// Living places, part 1 (owner, Nov 1: "there aren't interesting things to do at locations"; "go ahead"). Each place gets:
//   * signature activities: two or three things only that place has (Opa! at Feta Compli, the arcade at the Hub), each a small
//     choice card (You get / It costs), once a New York day;
//   * happenings: something going on at a place for part of the city day or week, or while a city condition runs (a lunch rush,
//     a brownout story night), with its own activity while it lasts;
//   * crowd moments: tapping someone in the crowd can start a two-choice moment (a tourist asks the way), five a day;
//   * stamp cards: days visited at a place unlock a perk and a one-time reward at 3, 7 and 15.
// The rules are TypeScript like Careers: pure here, rolled on the server with a crypto random source (app/home/placeLifeActions.ts)
// and in the preview's memory (lib/placeLifeSim.ts). Outcomes stay on the server: content/places/life.json is imported only by
// lib/placeLifeContent.ts; players get `lifeView`, never the odds. The database pays once per ref (migration 0157).

import type { DayPart } from "./dialogue";

export interface LifeOutcome {
  /** Relative chance. */
  weight: number;
  /** What happened, in the place's voice. */
  text: string;
  cash?: number;
  clout?: number;
  mood?: number;
  /** Good outcomes get likelier with the option's skill. */
  good?: boolean;
}
export interface LifeOption { id: string; label: string; get: string; cost: string; skill?: string; outcomes: LifeOutcome[] }
export interface LifeActivity {
  id: string;
  place: string;
  emoji: string;
  title: string;
  blurb: string;
  /** Energy it takes (0-20). */
  energy: number;
  /** Only while this happening runs. */
  happening?: string;
  options: LifeOption[];
}
export interface LifeHappening {
  id: string;
  place: string;
  emoji: string;
  title: string;
  blurb: string;
  /** City-clock hours [from, to) (to may wrap past midnight); missing = all day. */
  hours?: [number, number];
  /** ISO weekdays (New York); missing = every day. */
  days?: number[];
  /** Only while a city condition of this kind runs. */
  condition?: string;
}
export interface LifeMoment {
  id: string;
  /** Crowd types (content/dialogue) who start it. */
  crowd: string[];
  emoji: string;
  title: string;
  blurb: string;
  options: LifeOption[];
}
export interface StampPerk { days: number; text: string; cash?: number; clout?: number }
export interface LifeContent {
  activities: LifeActivity[];
  happenings: LifeHappening[];
  moments: LifeMoment[];
  /** Each place's regular card: what 3, 7 and 15 days unlock. */
  stamps: Record<string, StampPerk[]>;
}

export const LIFE = {
  /** Moments a New York day; each moment once a week. */
  momentsPerDay: 5,
  momentCooldownDays: 7,
  /** Chance a crowd tap starts a moment (when one fits). */
  momentChance: 0.35,
  /** Each skill level makes good outcomes this much likelier (×). */
  skillPerLevel: 0.08,
  /** Caps per payout (the database checks them too). */
  cap: { cash: 400, clout: 60, mood: 12 },
  stampDays: [3, 7, 15],
} as const;

export interface LifeScene {
  /** City-clock minute (0-1439). */
  minute: number;
  weekday: number;
  conditions: string[];
}

const hourOf = (minute: number) => Math.floor((((minute % 1440) + 1440) % 1440) / 60);
export function inHours(h: [number, number] | undefined, minute: number): boolean {
  if (!h) return true;
  const x = hourOf(minute);
  return h[0] <= h[1] ? x >= h[0] && x < h[1] : x >= h[0] || x < h[1];
}

export function happeningsNow(c: LifeContent, place: string, s: LifeScene): LifeHappening[] {
  return c.happenings.filter((h) => h.place === place && inHours(h.hours, s.minute) && (!h.days || h.days.includes(s.weekday))
    && (!h.condition || s.conditions.includes(h.condition)));
}

/** The activities open at a place right now: its signature ones, plus a running happening's. */
export function activitiesAt(c: LifeContent, place: string, s: LifeScene): LifeActivity[] {
  const live = new Set(happeningsNow(c, place, s).map((h) => h.id));
  return c.activities.filter((a) => a.place === place && (!a.happening || live.has(a.happening)));
}

/** What players see of an option: never the outcomes. */
export type OptionView = Pick<LifeOption, "id" | "label" | "get" | "cost">;
export interface ActivityView { id: string; emoji: string; title: string; blurb: string; energy: number; happening: string | null; done: boolean; options: OptionView[] }
export interface MomentView { id: string; emoji: string; title: string; blurb: string; options: OptionView[] }
export interface HappeningView { id: string; emoji: string; title: string; blurb: string; until: number | null }
export interface StampView { days: number; next: StampPerk | null; unlocked: StampPerk[]; claimable: StampPerk[] }
export interface LifeView { place: string; happenings: HappeningView[]; activities: ActivityView[]; stamps: StampView | null; momentsLeft: number }

const optionView = (o: LifeOption): OptionView => ({ id: o.id, label: o.label, get: o.get, cost: o.cost });

/** Today's done refs: "a:<activity>" for activities, "m:<moment>" for moments this week, "s:<place>:<days>" for stamps. */
export interface LifeDone { refs: Set<string>; momentsToday: number }

export function lifeView(c: LifeContent, place: string, s: LifeScene, done: LifeDone, regularDays: number): LifeView {
  const happenings = happeningsNow(c, place, s);
  const stamps = c.stamps[place];
  return {
    place,
    happenings: happenings.map((h) => ({ id: h.id, emoji: h.emoji, title: h.title, blurb: h.blurb, until: h.hours ? h.hours[1] : null })),
    activities: activitiesAt(c, place, s).map((a) => ({
      id: a.id, emoji: a.emoji, title: a.title, blurb: a.blurb, energy: a.energy, happening: a.happening ?? null,
      done: done.refs.has(`a:${a.id}`), options: a.options.map(optionView),
    })),
    stamps: stamps ? {
      days: regularDays,
      unlocked: stamps.filter((p) => regularDays >= p.days),
      next: stamps.find((p) => regularDays < p.days) ?? null,
      claimable: stamps.filter((p) => regularDays >= p.days && (p.cash || p.clout) && !done.refs.has(`s:${place}:${p.days}`)),
    } : null,
    momentsLeft: Math.max(0, LIFE.momentsPerDay - done.momentsToday),
  };
}

/** A moment one of these crowd types could start now (not done this week), or null. */
export function momentFor(c: LifeContent, crowdType: string, done: LifeDone, rand: () => number): LifeMoment | null {
  if (done.momentsToday >= LIFE.momentsPerDay || rand() >= LIFE.momentChance) return null;
  const open = c.moments.filter((m) => m.crowd.includes(crowdType) && !done.refs.has(`m:${m.id}`));
  return open.length ? open[Math.floor(rand() * open.length)] : null;
}
export const momentView = (m: LifeMoment): MomentView => ({ id: m.id, emoji: m.emoji, title: m.title, blurb: m.blurb, options: m.options.map(optionView) });

export class LifeError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export interface LifeResult { text: string; cash: number; clout: number; mood: number; energy: number; ref: string }

const clamp = (v: number | undefined, cap: number) => Math.max(-cap, Math.min(cap, Math.round(v ?? 0)));

/** Rolls an option's outcome; skilled players land the good ones more often. */
export function rollOption(o: LifeOption, skill: number, rand: () => number): LifeOutcome {
  const boost = 1 + LIFE.skillPerLevel * Math.max(0, Math.min(10, skill));
  const w = o.outcomes.map((x) => x.weight * (x.good && o.skill ? boost : 1));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return o.outcomes[i]; }
  return o.outcomes[o.outcomes.length - 1];
}

const settle = (x: LifeOutcome, energy: number, ref: string): LifeResult => ({
  text: x.text, cash: clamp(x.cash, LIFE.cap.cash), clout: Math.max(0, clamp(x.clout, LIFE.cap.clout)), mood: clamp(x.mood, LIFE.cap.mood), energy, ref,
});

/** Does an activity at a place. Throws LifeError: not_here, not_now, done_today, no_energy, unknown. */
export function doActivity(c: LifeContent, activityId: string, optionId: string, ctx: { at: string | null; scene: LifeScene; done: LifeDone; energy: number; skill: (id: string) => number }, rand: () => number): LifeResult {
  const a = c.activities.find((x) => x.id === activityId);
  const o = a?.options.find((x) => x.id === optionId);
  if (!a || !o) throw new LifeError("unknown");
  if (ctx.at !== a.place) throw new LifeError("not_here");
  if (!activitiesAt(c, a.place, ctx.scene).some((x) => x.id === a.id)) throw new LifeError("not_now");
  if (ctx.done.refs.has(`a:${a.id}`)) throw new LifeError("done_today");
  if (ctx.energy < a.energy) throw new LifeError("no_energy");
  return settle(rollOption(o, o.skill ? ctx.skill(o.skill) : 0, rand), a.energy, `a:${a.id}`);
}

/** Plays a crowd moment. Throws LifeError: unknown, done_week, moments_out. */
export function doMoment(c: LifeContent, momentId: string, optionId: string, done: LifeDone, skill: (id: string) => number, rand: () => number): LifeResult {
  const m = c.moments.find((x) => x.id === momentId);
  const o = m?.options.find((x) => x.id === optionId);
  if (!m || !o) throw new LifeError("unknown");
  if (done.refs.has(`m:${m.id}`)) throw new LifeError("done_week");
  if (done.momentsToday >= LIFE.momentsPerDay) throw new LifeError("moments_out");
  return settle(rollOption(o, o.skill ? skill(o.skill) : 0, rand), 0, `m:${m.id}`);
}

/** A stamp card's one-time reward. Throws LifeError: unknown, not_yet, claimed. */
export function claimStamp(c: LifeContent, place: string, days: number, regularDays: number, done: LifeDone): LifeResult {
  const p = c.stamps[place]?.find((x) => x.days === days);
  if (!p || !(p.cash || p.clout)) throw new LifeError("unknown");
  if (regularDays < p.days) throw new LifeError("not_yet");
  const ref = `s:${place}:${days}`;
  if (done.refs.has(ref)) throw new LifeError("claimed");
  return { text: p.text, cash: clamp(p.cash, LIFE.cap.cash), clout: Math.max(0, clamp(p.clout, LIFE.cap.clout)), mood: 0, energy: 0, ref };
}

const ERRORS: Record<string, string> = {
  unknown: "That's not on offer here.",
  not_here: "You have to be there.",
  not_now: "That's over for now. Check back later.",
  done_today: "Done that today. Come back tomorrow.",
  done_week: "You've had that conversation this week.",
  moments_out: "That's enough small talk for one day.",
  no_energy: "Not enough Energy. Rest first.",
  not_yet: "Not yet: keep coming back.",
  claimed: "Already claimed.",
};
export const lifeError = (code: string) => ERRORS[code] ?? "Something went wrong. Try again.";

export type LifeApi = {
  view(place: string): Promise<{ ok: true; data: LifeView } | { ok: false; error: string }>;
  activity(id: string, option: string): Promise<{ ok: true; data: { result: LifeResult; view: LifeView } } | { ok: false; error: string }>;
  /** A crowd tap: a moment this person could start, or null. */
  moment(crowdType: string): Promise<{ ok: true; data: MomentView | null } | { ok: false; error: string }>;
  playMoment(id: string, option: string): Promise<{ ok: true; data: LifeResult } | { ok: false; error: string }>;
  stamp(place: string, days: number): Promise<{ ok: true; data: { result: LifeResult; view: LifeView } } | { ok: false; error: string }>;
};

/** The Studio's rules for content/places/life.json. */
export function validateLife(c: LifeContent, places: Set<string>, crowd: Set<string>, conditions: Set<string>, skills: Set<string>): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const opt = (o: LifeOption, where: string) => {
    if (!o.label || o.label.length > 40) out.push(`${where}: label 1-40 characters`);
    if (!o.get || o.get.length > 60 || !o.cost || o.cost.length > 60) out.push(`${where}: get and cost 1-60 characters`);
    if (o.skill && !skills.has(o.skill)) out.push(`${where}: unknown skill ${o.skill}`);
    if (!o.outcomes.length) out.push(`${where}: no outcomes`);
    for (const x of o.outcomes) {
      if (!(x.weight > 0)) out.push(`${where}: outcome weight must be > 0`);
      if (!x.text || x.text.length > 220) out.push(`${where}: outcome text 1-220 characters`);
      if (Math.abs(x.cash ?? 0) > LIFE.cap.cash || (x.clout ?? 0) > LIFE.cap.clout || (x.clout ?? 0) < 0 || Math.abs(x.mood ?? 0) > LIFE.cap.mood) out.push(`${where}: over the caps`);
    }
  };
  const face = (x: { id: string; emoji: string; title: string; blurb: string }, where: string) => {
    if (ids.has(x.id)) out.push(`${where}: duplicate id ${x.id}`);
    ids.add(x.id);
    if (!x.emoji || !x.title || x.title.length > 40) out.push(`${where}: emoji and a title of 1-40 characters`);
    if (!x.blurb || x.blurb.length > 160) out.push(`${where}: blurb 1-160 characters`);
  };
  const happenings = new Set(c.happenings.map((h) => h.id));
  for (const h of c.happenings) {
    face(h, `happening ${h.id}`);
    if (!places.has(h.place)) out.push(`happening ${h.id}: unknown place ${h.place}`);
    if (h.condition && !conditions.has(h.condition)) out.push(`happening ${h.id}: unknown condition ${h.condition}`);
    if (!c.activities.some((a) => a.happening === h.id)) out.push(`happening ${h.id}: no activity`);
  }
  for (const a of c.activities) {
    face(a, `activity ${a.id}`);
    if (!places.has(a.place)) out.push(`activity ${a.id}: unknown place ${a.place}`);
    if (a.happening && !happenings.has(a.happening)) out.push(`activity ${a.id}: unknown happening ${a.happening}`);
    if (a.energy < 0 || a.energy > 20) out.push(`activity ${a.id}: energy 0-20`);
    if (a.options.length < 2 || a.options.length > 3) out.push(`activity ${a.id}: 2-3 options`);
    a.options.forEach((o, i) => opt(o, `activity ${a.id}[${i}]`));
  }
  for (const m of c.moments) {
    face(m, `moment ${m.id}`);
    for (const t of m.crowd) if (!crowd.has(t)) out.push(`moment ${m.id}: unknown crowd type ${t}`);
    if (m.options.length !== 2) out.push(`moment ${m.id}: 2 options`);
    m.options.forEach((o, i) => opt(o, `moment ${m.id}[${i}]`));
  }
  for (const [place, perks] of Object.entries(c.stamps)) {
    if (!places.has(place)) out.push(`stamps: unknown place ${place}`);
    if (perks.map((p) => p.days).join() !== LIFE.stampDays.join()) out.push(`stamps ${place}: perks at ${LIFE.stampDays.join(", ")} days`);
    for (const p of perks) if (!p.text || p.text.length > 120) out.push(`stamps ${place}: text 1-120 characters`);
  }
  return out;
}

export type { DayPart };
