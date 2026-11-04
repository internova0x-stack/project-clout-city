// Bad news as results screens (components/ResultCard.tsx; owner, Nov 4: a fail keeps its colour, framed as a near miss:
// how close you came, what you keep, one clear next step). Pure builders; components/game/badNewsReads.ts finds the
// moments in the states GameShell already reads and shows each once per device.
//   eviction        a forgiven rent bill (tick, migration 0005): EVICTED, the back rent wiped, days late against the door
//   breakup         couple_state() with no partner after one (either side, or a block): the couple streak you reached
//   broken streak   a 3+ day streak gone (goals_state current 0, or streak_repair_state's offer): the run against your best
//                   or the next milestone; "Repair it" opens Tasks → Daily while a repair is open
//   sublet ended    sublet_state().ended (host or subtenant): the weeks you stayed, the deposit back

import { CITY_ECONOMY } from "../../lib/city.ts";
import { daysBetween, type CityState } from "../../lib/cityState.ts";
import { COUPLES, coupleBadge } from "../../lib/couples.ts";
import { ECONOMY } from "../../lib/economy.ts";
import { isStreakMilestone } from "../../lib/streakMilestones.ts";
import { endedLine, type SubletEnded } from "../../lib/sublets.ts";
import type { Celebration } from "../Celebrate.tsx";

const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;
const at = (name: string) => `@${name.replace(/^@/, "")}`;
const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---- Eviction ----

export interface Eviction {
  /** The newest forgiven rent bill (what the device remembers). */
  key: number;
  /** The New York day it happened (the new home's first rent bill). */
  day: string;
  lateDays: number;
  backRent: number;
  home: string;
  /** The new home's first rent and whether it's still due. */
  rent: number;
  rentDue: boolean;
  bank: number;
}

/** The last eviction in the bills (tick forgives the late rent and moves the player to the cheapest home), if it was
 *  within the last week; null otherwise. */
export function evictionOf(st: CityState, withinDays = 7): Eviction | null {
  const rent = st.bills.filter((b) => b.kind === "rent");
  const forgiven = rent.filter((b) => b.status === "forgiven");
  if (!forgiven.length) return null;
  const last = forgiven.reduce((a, b) => (b.id > a.id ? b : a));
  // The new home's first rent: issued right after the forgiving (the next id).
  const after = rent.filter((b) => b.id > last.id).sort((a, b) => a.id - b.id)[0];
  const { evictAfterDays } = CITY_ECONOMY.bills;
  const day = after?.due_date ?? last.due_date;
  if (daysBetween(day, st.today) > withinDays || daysBetween(day, st.today) < 0) return null;
  // The bills forgiven together: since the last rent that wasn't.
  const before = rent.filter((b) => b.status !== "forgiven" && b.id < last.id).reduce((m, b) => Math.max(m, b.id), 0);
  const batch = forgiven.filter((b) => b.id > before && b.id <= last.id);
  const first = batch.reduce((m, b) => (b.due_date < m ? b.due_date : m), last.due_date);
  const home = ECONOMY.homes.find((h) => h.id === st.player.home_id);
  return {
    key: last.id, day, lateDays: after ? Math.max(evictAfterDays, daysBetween(first, day)) : evictAfterDays,
    backRent: batch.reduce((n, b) => n + b.amount, 0), home: home?.name ?? "the room share",
    rent: after?.amount ?? home?.rent ?? 0, rentDue: after?.status === "due", bank: st.player.bank_cash,
  };
}

export function evictionResult(e: Eviction, on: { gigs?: () => void; home?: () => void }): Celebration {
  const { graceDays, evictAfterDays } = CITY_ECONOMY.bills;
  const gig = e.rentDue && e.bank < e.rent;
  return {
    rung: 3, emoji: "📦", tag: "Rent", title: "New keys, smaller room",
    cta: gig ? "Find a gig" : "See your new place", onCta: gig ? on.gigs : on.home,
    result: {
      tone: "lose", stamp: { text: "EVICTED", tone: "bad" },
      ...(e.backRent > 0 ? { amount: e.backRent, unit: "back rent, wiped" } : {}),
      story: `New address: ${e.home}. The landlord kept the plant.`,
      meter: { label: "🗓️ Days late", have: e.lateDays, need: evictAfterDays, max: evictAfterDays,
        say: gig ? `${cs(e.rent)} rent due here. ${graceDays} days of grace, then Mood drops.` : `${graceDays} days of grace next time. Pay early, sleep better.` },
      keep: ["Your stuff", "Your savings", "Your crew", "Your clout"],
    },
  };
}

// ---- A breakup ----

export interface Breakup {
  id: number;
  name: string;
  /** "mine": I ended it; "breakup"/"blocked": the other one did. */
  reason: "mine" | "breakup" | "blocked";
  /** The longest couple streak this device saw (null: it never saw them together). */
  streak: number | null;
  /** I was the one who moved in (living together ends with the breakup). */
  mover?: boolean;
}

export function breakupResult(b: Breakup, onCta?: () => void): Celebration {
  const rewards = COUPLES.streakRewards;
  const badges = rewards.flatMap((r) => ("badge" in r && b.streak != null && b.streak >= r.day ? [coupleBadge(r.badge)?.name] : []))
    .filter((n): n is string => !!n);
  const next = b.streak == null ? undefined : rewards.find((r) => r.day > b.streak!);
  const streak = b.streak ?? 0;
  return {
    rung: 3, emoji: "🌧️", tag: "Us", title: `You and ${at(b.name)} went separate ways`, cta: "Back to the city", onCta,
    result: {
      tone: "warn",
      story: b.mover ? "Back to a room share. Nothing was posted anywhere. Go get a bagel." : "It happens, even in Queens. Nothing was posted anywhere. Go get a bagel.",
      ...(b.streak != null && b.streak > 0 ? {
        meter: { label: "💞 Couple streak", have: streak, need: next?.day ?? streak, max: next?.day ?? streak,
          say: `${s(streak, "day")} in a row. That counted.` },
      } : {}),
      keep: [...badges.slice(-1).map((n) => `💞 ${n}`), "Everything you own", "Your crew", "Your dignity"],
    },
  };
}

// ---- A broken streak ----

/** The next streak milestone after this many days (lib/streakMilestones.ts). */
export function nextMilestone(day: number): number {
  let d = day + 1;
  while (!isStreakMilestone(d) && d < day + 400) d++;
  return d;
}

export interface BrokenStreak {
  /** The run's last full day (what the device remembers). */
  lastDay: string;
  run: number;
  best: number;
  /** Rewards the run paid (clout, collectibles, passes). */
  paid: number;
  passes: number;
  /** A repair is open (streak_repair_state's offer, not already earning it back). */
  repair: boolean;
}

export function streakBrokenResult(b: BrokenStreak, onCta?: () => void): Celebration {
  const best = Math.max(b.best, b.run);
  const meter = best > b.run
    ? { label: "🔥 Your best", have: b.run, need: best, max: best, say: `${best - b.run} short of your best. It's still on the board.` }
    : (() => { const n = nextMilestone(b.run); return { label: "🔥 Next milestone", have: b.run, need: n, max: n, say: `${n - b.run} from day ${n}. Your best run yet.` }; })();
  return {
    rung: 3, emoji: "🕯️", tag: "Daily streak", title: b.repair ? "Your streak blew out" : "Your streak went out",
    cta: b.repair ? "Repair it" : "Start a new run", onCta,
    result: {
      tone: "warn", stamp: b.repair ? { text: "REPAIRABLE", tone: "warn" } : undefined,
      amount: b.run, plain: true, unit: b.run === 1 ? "day in a row" : "days in a row",
      story: b.repair ? "Lola can relight it. Today only." : "Day 1 is five tasks away.",
      meter,
      keep: [
        ...(b.paid > 0 ? [`${s(b.paid, "reward")} paid`] : []),
        ...(b.passes > 0 ? [`🎟️ ${s(b.passes, "guest pass", "guest passes")}`] : []),
        `🏆 Best: ${s(best, "day")}`,
      ],
    },
  };
}

// ---- A sublet ending ----

export function subletEndedResult(e: SubletEnded, stay: { week: number; weeks: number } | null, onCta?: () => void): Celebration {
  const host = e.role === "host";
  return {
    rung: 3, emoji: "🔑", tag: "Sublet", title: host ? "The spare room is yours again" : "Sublet's over",
    cta: e.rated ? "Back to the city" : `Rate ${at(e.with.name)}`, onCta: e.rated ? undefined : onCta,
    result: {
      tone: "warn", stamp: e.reason === "unpaid" ? { text: "RENT BOUNCED", tone: "warn" } : undefined,
      ...(!host && e.deposit > 0 ? { amount: e.deposit, unit: "deposit back" } : {}),
      story: endedLine(e),
      ...(stay && stay.weeks > 0 ? { meter: { label: "🗓️ Weeks", have: Math.min(stay.week, stay.weeks), need: stay.weeks, max: stay.weeks,
        say: stay.week >= stay.weeks ? "The whole stay. Nobody stole a yogurt." : `${s(Math.min(stay.week, stay.weeks), "week")} of ${stay.weeks}.` } } : {}),
      keep: host ? ["The rent you made", "Your spare room", "Your reviews"] : [...(e.deposit > 0 ? [`${cs(e.deposit)} deposit`] : []), "Your own place", "Your reviews"],
    },
  };
}
