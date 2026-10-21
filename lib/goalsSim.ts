// The preview's in-memory goals (daily tasks 2.0), standing in for goals_state and use_guest_pass (migrations 0073,
// 0074). Presets (?goals=): "" day one (first purchase, no streak), "streak" a 6-day streak (finish today's five for
// the day-7 collectible), "pass" a guest-list pass in hand, "tonight" a pass used at Ultraviolet Society tonight,
// "chapter" every unlocked goal done (reach the next chapter's clout).

import { GOALS, NEXT_CHAPTER, addDay, nextStreakReward, nextUnlock, streakMilestones, streakRewardOn, type GoalsApi, type GoalsResult, type GoalsState } from "./goals.ts";

const ok = <T,>(data: T): Promise<GoalsResult<T>> => Promise.resolve({ ok: true, data });
const fail = <T,>(error: string): Promise<GoalsResult<T>> => Promise.resolve({ ok: false, error });

export interface GoalsSimCity {
  clout(): number;
  cash(): number;
  confidence(): number;
  /** All five of today's tasks are done. */
  allDone(): boolean;
  /** Can this player already get in (door clout) and up (VIP)? */
  canEnter(place: string): { club: boolean; needed: boolean };
}

export function createGoalsSim(preset = "", city: GoalsSimCity): GoalsApi & { passTonight(place: string): boolean } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const ids = GOALS.ladder.map((g) => g.id);
  const done = new Set<string>(preset === "chapter" ? ids.filter((_, i) => GOALS.ladder[i].unlock <= city.clout()) : preset ? ["first_purchase", "first_shift", "full_day"] : []);
  let current = preset === "streak" ? 6 : preset === "pass" || preset === "tonight" ? 15 : preset ? 2 : 0;
  let best = Math.max(current, preset ? 15 : 0);
  let lastDay: string | null = current ? "yesterday" : null;
  let held = preset === "pass" ? 1 : 0;
  let tonight: string | null = preset === "tonight" ? "ultraviolet-society" : null;

  const goal = (): GoalsState["goal"] => {
    const clout = city.clout();
    const g = GOALS.ladder.find((x) => !done.has(x.id) && x.unlock <= clout);
    if (!g) {
      const next = nextUnlock(clout);
      return next ? { id: NEXT_CHAPTER, parts: [{ have: clout, need: next, unit: "clout" }], target: null } : null;
    }
    const c = g.check;
    const cash = (need: number) => [{ have: city.cash(), need, unit: "cash" as const }];
    const parts = c.type === "gig_tier"
      ? [{ have: clout, need: c.tier === "pro" ? 500 : 2000, unit: "clout" as const }, { have: city.confidence(), need: c.tier === "pro" ? 50 : 80, unit: "confidence" as const }]
      : c.type === "save" ? cash(c.cash)
      : c.type === "home" ? [...(c.home === "sunnyside_gardens" ? [{ have: clout, need: 1000, unit: "clout" as const }] : []), ...cash(c.home === "jackson_heights_1br" ? 5200 : 6400)]
      : c.type === "business" ? cash(c.id === "hot-dog-cart" ? 5000 : 50000)
      : c.type === "car" ? cash(21000)
      : c.type === "house" ? cash(270000)
      : c.type === "skill" ? [{ have: 2, need: c.level, unit: "count" as const }]
      : c.type === "regular" ? [{ have: 1, need: c.days, unit: "count" as const }]
      : c.type === "solo" ? cash(3500)
      : [{ have: 0, need: 1, unit: "count" as const }];
    return { id: g.id, parts, target: null };
  };
  const tick = () => {
    // The day's five, done: the streak grows (the server does this from the daily bonus).
    if (city.allDone() && lastDay !== today) {
      current += 1;
      best = Math.max(best, current);
      lastDay = today;
      if (streakRewardOn(current) === "pass") held += 1;
      done.add("full_day");
    }
  };
  const state = (): GoalsState => {
    tick();
    return {
      goal: goal(),
      done: ids.filter((id) => done.has(id)),
      streak: (() => {
        // The run's days, ending yesterday (or today once it's done), with one frozen day in a long run.
        const end = lastDay === today ? today : addDay(today, -1);
        const frozen = current >= 5 ? addDay(end, -3) : null;
        const days: string[] = [];
        for (let i = 0, n = 0; n < Math.min(current, 34); i++) { const d = addDay(end, -i); if (d !== frozen) { days.unshift(d); n++; } }
        const startedOn = days[0] ?? null;
        return {
          current, best, lastDay: lastDay === today ? today : current ? end : null, today: lastDay === today,
          frozenThisWeek: !!frozen, next: nextStreakReward(current), startedOn, days,
          rewards: streakMilestones(current).map((m, i) => ({ ...m, sku: m.reward === "collectible" ? GOALS.streak.collectibles[Math.floor(i / 2)] ?? null : null })),
        };
      })(),
      passes: { held, tonight: tonight ? { place: tonight } : null },
    };
  };

  return {
    state: () => ok(state()),
    usePass(place) {
      const c = city.canEnter(place);
      if (!c.club) return fail("Guest-list passes work at clubs. Nobody keeps a list at the deli.");
      if (tonight === place) return ok(state());
      if (tonight) return fail("You're already on a guest list tonight. One velvet rope at a time.");
      if (!held) return fail("No guest-list pass on you. Keep the streak going: day 14 brings one.");
      if (!c.needed) return fail("You can already get in there. Save the pass for a door that says no.");
      held -= 1;
      tonight = place;
      return ok(state());
    },
    passTonight: (place) => tonight === place,
  };
}
