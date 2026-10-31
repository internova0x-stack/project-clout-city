"use server";

import { previewOnly } from "./guard";

import { COUPLES, rentParts, type CohabitHome, type CohabitState, type CoupleBlock, type CoupleResult, type CoupleState, type CouplePerson } from "@/lib/couples";

// Development previews only: relationships in memory, following the rules of supabase/migrations/0118. Refused in
// production builds. The preview player is matched with Tasha (3 date nights: can go official) and Marco (2 of 3).
//   ?couple=progress (default)  single, two matches on the way
//   ?couple=ask                 Tasha asked "Make it official?"
//   ?couple=dating              dating Tasha: a 6-day streak, today not done yet, one gift box in the pocket
//   ?couple=gift                dating, with a gift from Tasha waiting
//   ?couple=ended               Tasha ended it: the gentle card
//   ?couple=movein              dating Tasha for 12 days: Tasha asked you to move into her place (living together, migration 0149)
//   ?couple=together            living at Tasha's Jackson Heights 1BR for 5 days, rent split 50/50; Tasha is home today

const TASHA: CouplePerson = { id: "p-tasha", name: "tasha.b", style: "pilates_princess" };
const MARCO: CouplePerson = { id: "p-marco", name: "Marco", style: "midtown_finance" };

interface S {
  partner: CouplePerson | null;
  days: number;
  streak: number;
  todayDone: boolean;
  shown: boolean;
  boxes: number;
  sentToday: boolean;
  received: { id: number; from: string; day: string }[];
  ended: CoupleState["ended"];
  dates: Record<string, number>;
  asks: CoupleState["asks"];
  paid: Set<string>;
  /** Living together: Tasha's place (she hosts), how long, an ask, "Home together" taps, the moved-out note. */
  together: { days: number } | null;
  homeAsks: CohabitState["asks"];
  homeToday: boolean;
  homeOther: boolean;
  homeEnded: CohabitState["ended"];
}
const fresh = (): S => ({
  partner: null, days: 0, streak: 0, todayDone: false, shown: true, boxes: 1, sentToday: false, received: [], ended: null,
  dates: { "p-tasha": 3, "p-marco": 2 }, asks: [], paid: new Set(),
  together: null, homeAsks: [], homeToday: false, homeOther: false, homeEnded: null,
});
// Tasha's Jackson Heights 1BR, with a sofa, a bed and a plant (lib/city.ts furniture lines).
const TASHA_HOME = "jackson_heights_1br";
const TASHA_RENT = 600;
let s = fresh();

const today = () => new Date().toISOString().slice(0, 10);
const ok = <T,>(data: T): CoupleResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const fail = (error: string): CoupleResult<never> => ({ ok: false, error });
const block = (p: CouplePerson): CoupleBlock =>
  s.partner ? "already_dating" : (s.dates[p.id] ?? 0) < COUPLES.datesToOfficial ? "more_dates" : null;

function home(): CohabitState {
  const t = s.together;
  return {
    live: s.partner && t ? {
      id: 1, role: "mover", since: new Date(Date.now() - t.days * 86400e3).toISOString().slice(0, 10), days: t.days, homeId: TASHA_HOME, houseSku: null,
      myRent: rentParts(TASHA_RENT).mover, fullRent: TASHA_RENT, homeToday: s.homeToday, homeOther: s.homeOther,
    } : null,
    // The preview player is the one invited (Tasha hosts), so their own "Move in together" is open only as an ask back.
    blockedBy: !s.partner ? "not_dating" : t ? "already_together" : s.days < COUPLES.moveInDays ? "too_soon" : null,
    asks: s.homeAsks,
    ended: s.homeEnded,
    rules: { moveInDays: COUPLES.moveInDays, homeMood: COUPLES.homeMood, homeClout: COUPLES.homeClout, rentShare: COUPLES.rentShare },
  };
}

function state(): CoupleState {
  const paid: CoupleState["paid"] = [];
  if (s.partner) {
    for (const r of COUPLES.streakRewards) {
      if (s.streak >= r.day && !s.paid.has(`d${r.day}`)) { s.paid.add(`d${r.day}`); paid.push({ kind: "streak", day: r.day, clout: r.clout }); }
    }
  }
  return {
    partner: s.partner,
    relId: s.partner ? 1 : null,
    since: s.partner ? new Date(Date.now() - s.days * 86400e3).toISOString().slice(0, 10) : null,
    days: s.partner ? s.days : null,
    streak: s.partner ? s.streak : 0,
    todayDone: s.todayDone,
    nextReward: s.partner ? COUPLES.streakRewards.find((r) => r.day > s.streak) ?? null : null,
    shown: s.partner ? s.shown : null,
    gifts: { boxes: s.boxes, sentToday: s.sentToday, received: s.received },
    paid,
    ended: s.ended,
    matches: s.partner ? [] : [TASHA, MARCO].map((p) => ({ ...p, dates: s.dates[p.id] ?? 0, blockedBy: block(p) })),
    asks: s.asks,
    home: home(),
    rules: { datesToOfficial: COUPLES.datesToOfficial, streakMessages: COUPLES.streakMessages, giftMood: COUPLES.giftMood, giftClout: COUPLES.giftClout },
  };
}

export async function previewCoupleReset(preset: string | undefined) {
  previewOnly();
  s = fresh();
  if (preset === "ask") s.asks = [{ id: 7, mine: false, with: TASHA }];
  if (preset === "dating" || preset === "gift") {
    Object.assign(s, { partner: TASHA, days: 12, streak: 6, todayDone: false });
    // Day 3's reward was paid long ago.
    s.paid.add("d3");
  }
  if (preset === "gift") s.received = [{ id: 3, from: TASHA.name, day: today() }];
  if (preset === "ended") s.ended = { id: 1, reason: "breakup", name: TASHA.name };
  if (preset === "movein" || preset === "together") {
    Object.assign(s, { partner: TASHA, days: 12, streak: 6, todayDone: false });
    s.paid.add("d3");
  }
  if (preset === "movein") s.homeAsks = [{ id: 21, mine: false, homeId: TASHA_HOME }];
  if (preset === "together") Object.assign(s, { together: { days: 5 }, homeOther: true });
}
export async function previewCoupleState() { previewOnly(); return ok(state()); }
export async function previewCoupleAsk(id: string) {
  previewOnly();
  const p = [TASHA, MARCO].find((x) => x.id === id);
  if (!p) return fail("Official is for matches: you both have to crush on each other.");
  if (block(p) === "more_dates") return fail(`Three date nights first. Then you can make it official.`);
  if (s.asks.length) return fail("There's already an ask waiting between you two.");
  s.asks = [{ id: 8, mine: true, with: p }];
  return ok(state());
}
export async function previewCoupleAnswer(askId: number, yes: boolean) {
  previewOnly();
  const k = s.asks.find((a) => a.id === askId && !a.mine);
  if (!k) return fail("That ask isn't around anymore.");
  s.asks = [];
  if (yes) Object.assign(s, { partner: k.with, days: 0, streak: 0, todayDone: false });
  return ok(state());
}
export async function previewCoupleEnd() {
  previewOnly();
  if (!s.partner) return fail("You're not dating anyone right now.");
  s.partner = null;
  // A breakup ends living together too.
  Object.assign(s, { together: null, homeAsks: [], homeToday: false, homeOther: false });
  return ok(state());
}
export async function previewCoupleShow(on: boolean) { previewOnly(); s.shown = on; return ok(state()); }
export async function previewCoupleGift() {
  previewOnly();
  if (!s.partner) return fail("You're not dating anyone right now.");
  if (s.boxes < 1) return fail("No gift box on you. Grab one at Sal's or Schlep & Schmear.");
  if (s.sentToday) return fail("One gift a day. Keep a little mystery.");
  s.boxes -= 1;
  s.sentToday = true;
  return ok(state());
}
export async function previewCoupleSeen() { previewOnly(); s.received = []; s.ended = null; return ok(null); }
/** The preview stands in for the day's "together" (a date or 5 messages each way): the streak moves on. */
export async function previewCoupleTogether() {
  previewOnly();
  if (s.partner && !s.todayDone) { s.todayDone = true; s.streak += 1; }
  return ok(state());
}

// ---- Living together (migration 0149) ----
export async function previewCohabitAsk() {
  previewOnly();
  if (!s.partner) return fail("You're not dating anyone right now.");
  if (s.together) return fail("You two already live together. One lease of love at a time.");
  if (s.homeAsks.length) return fail("There's already an ask waiting between you two.");
  s.homeAsks = [{ id: 22, mine: true, homeId: "astoria_studio" }];
  return ok(state());
}
export async function previewCohabitCancel() {
  previewOnly();
  s.homeAsks = s.homeAsks.filter((a) => !a.mine);
  return ok(state());
}
export async function previewCohabitAnswer(askId: number, yes: boolean) {
  previewOnly();
  const k = s.homeAsks.find((a) => a.id === askId && !a.mine);
  if (!k) return fail("That ask isn't around anymore.");
  s.homeAsks = [];
  if (yes) Object.assign(s, { together: { days: 0 }, homeToday: false, homeOther: false });
  return ok(state());
}
export async function previewCohabitLeave() {
  previewOnly();
  if (!s.together) return fail("You don't live together right now.");
  Object.assign(s, { together: null, homeToday: false, homeOther: false });
  return ok(state());
}
/** "Home together": Tasha tapped it already in the together preset, so the second tap pays both. */
export async function previewCohabitHang() {
  previewOnly();
  if (!s.together) return fail("You don't live together right now.");
  s.homeToday = true;
  return ok(state());
}
export async function previewCohabitHome(): Promise<CoupleResult<CohabitHome | null>> {
  previewOnly();
  if (!s.together) return ok(null);
  return ok({
    id: 1, host: TASHA.id, hostName: TASHA.name, homeId: TASHA_HOME, houseSku: null, layout: null,
    items: [{ id: 9001, sku: "home-sofa-blue" }, { id: 9002, sku: "home-bed-pink" }, { id: 9003, sku: "home-plant" }],
  });
}
