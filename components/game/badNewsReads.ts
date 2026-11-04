// Where bad news reaches the device (components/game/badNews.ts builds the cards). GameShell hands each state it already
// reads to one of these; they compare it with what this device last saw and show each card once (`cc-bad-news`).
// No server calls of their own.

import type { CityState } from "@/lib/cityState";
import type { CoupleState } from "@/lib/couples";
import { GOALS, type GoalsState } from "@/lib/goals";
import type { RepairOffer } from "@/lib/streakRepair";
import { STREAK_REPAIR } from "@/lib/streakRepair";
import type { SubletState } from "@/lib/sublets";
import { celebrate } from "../Celebrate";
import { breakupResult, evictionOf, evictionResult, streakBrokenResult, subletEndedResult } from "./badNews";

/** What the cards' buttons open (GameShell's panels). */
export interface BadNewsCtx {
  who: string;
  onGigs?: () => void;
  onHome?: () => void;
  onDaily?: () => void;
  onSublets?: () => void;
}

interface Store {
  who: string;
  shown: string[];
  /** The relationship this device last saw: its longest streak, and whether I'd moved in. */
  rel: { id: number; name: string; streak: number; mover: boolean } | null;
  /** The daily streak last seen. */
  streak: { current: number; lastDay: string | null } | null;
  /** The sublet last seen: how far in. */
  sub: { id: number; week: number; weeks: number } | null;
}
const KEY = "cc-bad-news";
function load(who: string): Store {
  const blank: Store = { who, shown: [], rel: null, streak: null, sub: null };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Store | null;
    return s && s.who === who && Array.isArray(s.shown) ? { ...blank, ...s } : blank;
  } catch { return blank; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, shown: s.shown.slice(-40) })); } catch { /* private mode */ }
}
const once = (s: Store, key: string) => { if (s.shown.includes(key)) return false; s.shown.push(key); return true; };
const nyDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const ago = (day: string) => Math.round((Date.parse(`${nyDay()}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86400e3);

/** Every city read: an eviction in the last week's bills. */
export function evictionRead(city: CityState | null, ctx: BadNewsCtx) {
  if (!city) return;
  const e = evictionOf(city);
  if (!e) return;
  const s = load(ctx.who);
  if (!once(s, `evict:${e.key}`)) return;
  save(s);
  celebrate(evictionResult(e, { gigs: ctx.onGigs, home: ctx.onHome }));
}

/** Every couple_state read: the relationship gone (I ended it, they did, or a block). */
export function coupleRead(st: CoupleState, ctx: BadNewsCtx) {
  const s = load(ctx.who);
  const was = s.rel;
  let changed = false;
  // The other one ended it: the server says so once (until "seen").
  if (st.ended && once(s, `rel:${st.ended.id}`)) {
    const mine = was?.id === st.ended.id ? was : null;
    celebrate(breakupResult({ id: st.ended.id, name: st.ended.name, reason: st.ended.reason, streak: mine?.streak ?? null, mover: mine?.mover }));
    changed = true;
  } else if (was && st.relId !== was.id && once(s, `rel:${was.id}`)) {
    // Single now (or with someone new) and the server has no note for it: I ended it.
    celebrate(breakupResult({ id: was.id, name: was.name, reason: "mine", streak: was.streak, mover: was.mover }));
    changed = true;
  }
  const rel = st.partner && st.relId ? {
    id: st.relId, name: st.partner.name,
    streak: Math.max(st.streak, was?.id === st.relId ? was.streak : 0),
    mover: st.home?.live?.role === "mover",
  } : null;
  if (changed || JSON.stringify(rel) !== JSON.stringify(was)) { s.rel = rel; save(s); }
}

/** Every goals read, once its repair offer is known (undefined: no repairs in this build). */
export function streakRead(g: GoalsState, offer: RepairOffer | null | undefined, ctx: BadNewsCtx) {
  const s = load(ctx.who);
  const prev = s.streak;
  const now = { current: g.streak.current, lastDay: g.streak.lastDay };
  const passes = g.passes.held;
  const best = g.streak.best;
  if (offer && offer.streak >= STREAK_REPAIR.minStreak) {
    if (once(s, `streak:${offer.lastDay}`)) {
      celebrate(streakBrokenResult({ lastDay: offer.lastDay, run: offer.streak, best, paid: paidFor(offer.streak), passes, repair: !offer.earnPending }, ctx.onDaily));
    }
  } else if (prev && prev.lastDay && prev.current >= STREAK_REPAIR.minStreak && now.current === 0 && ago(prev.lastDay) <= 7
    && once(s, `streak:${prev.lastDay}`)) {
    celebrate(streakBrokenResult({ lastDay: prev.lastDay, run: prev.current, best, paid: paidFor(prev.current), passes, repair: false }, ctx.onDaily));
  }
  // Keep the last live run while the streak sits at 0 (an earn-back or repair can still bring it back).
  if (now.current > 0 || !prev) s.streak = now;
  save(s);
}

/** Rewards a run this long paid: day 3, then one every GOALS.streak.every days. */
function paidFor(run: number): number {
  return run >= 3 ? 1 + Math.floor(run / GOALS.streak.every) : 0;
}

/** Every sublet_state read: a sublet that ended (either side). */
export function subletRead(st: SubletState | null, ctx: BadNewsCtx) {
  if (!st) return;
  const s = load(ctx.who);
  let changed = false;
  if (st.ended && once(s, `sub:${st.ended.id}`)) {
    const stay = s.sub?.id === st.ended.id ? s.sub : null;
    celebrate(subletEndedResult(st.ended, stay, ctx.onSublets));
    changed = true;
  }
  const sub = st.live ? { id: st.live.id, week: st.live.week, weeks: st.live.weeks } : s.sub;
  if (changed || JSON.stringify(sub) !== JSON.stringify(s.sub)) { s.sub = sub; save(s); }
}
