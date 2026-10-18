// Daily tasks 2.0 (docs/08-new-features-spec.md section 19; owner, Oct 18): the goal ladder the game suggests,
// streaks of full task days, and guest-list passes. Pure data and helpers, safe to import anywhere.
// The server (migration 0073: goal_current, goal_settle, ensure_daily, streak_tick, use_guest_pass, goals_state)
// is authoritative; game_settings 'goals' holds these numbers and tests/goals.test.ts keeps them equal.

export type GoalId = "first_purchase" | "first_gig" | "move_up" | "pro_gigs" | "first_car" | "big_gigs" | "own_home";

/** One part of a goal's progress, in the goal's own terms ("C$1,240 of C$14,000", "380 of 500 clout"). */
export interface GoalPart { have: number; need: number; unit: "cash" | "clout" | "confidence" | "count" }

/** What goals_state() returns. */
export interface GoalsState {
  goal: { id: GoalId; parts: GoalPart[]; target?: string | null } | null;
  done: GoalId[];
  streak: {
    current: number;
    best: number;
    lastDay: string | null;
    /** All five tasks done today. */
    today: boolean;
    frozenThisWeek: boolean;
    next: { day: number; reward: StreakReward };
  };
  passes: { held: number; tonight: { place: string } | null };
}

export type StreakReward = "clout" | "collectible" | "pass";

/** The numbers (the database's game_settings 'goals' row is the truth). */
export const GOALS = {
  /** The order the game suggests goals in: the active goal is the first unfinished one. */
  ladder: ["first_purchase", "first_gig", "move_up", "pro_gigs", "first_car", "big_gigs", "own_home"] as GoalId[],
  /** One-time clout for finishing each goal (ledger clout 'goal', ref the goal id). */
  rewards: { first_purchase: 50, first_gig: 75, move_up: 150, pro_gigs: 150, first_car: 200, big_gigs: 300, own_home: 500 } as Record<GoalId, number>,
  /** Daily tasks picked to move the active goal forward (of the five). */
  goalTasksPerDay: 2,
  /**
   * Places whose tags fit each goal, tried after a shift (cash goals) or before any other place that gives
   * Confidence or clout (clout goals). Free places come last for cash goals: fun that leaves the savings alone.
   */
  tags: {
    first_purchase: ["boutique", "shopping"],
    first_gig: ["gym", "campus", "club", "monument"],
    move_up: ["gym", "campus", "club", "monument"],
    pro_gigs: ["gym", "campus", "club", "monument"],
    first_car: ["dealership", "cars"],
    big_gigs: ["gym", "campus", "club", "monument"],
    own_home: ["furniture", "home"],
  } as Record<GoalId, string[]>,
  streak: {
    /** Missed days forgiven per New York week (a freeze). */
    freezesPerWeek: 1,
    /** Day 3 of a streak pays this much clout. */
    day3Clout: 50,
    /** Every this many days: a collectible (odd multiples) or a guest-list pass (even multiples). */
    every: 7,
    /** The task-only collectibles, in the order they're given. The Shop never sells them. */
    collectibles: ["home-neon-five-sign", "home-trophy-shelf", "home-employee-frame", "home-streak-lava-lamp"],
    /** Clout instead, when every collectible is already owned or a pass is already held. */
    fallbackClout: 100,
  },
};

/** Cash goals send the player to shifts and to the place they'll spend it; the rest to Confidence and clout. */
export const CASH_GOALS: readonly GoalId[] = ["first_purchase", "first_car", "own_home"];

/** Player-facing words for each goal. Satirical, they/them, no real brands. */
export const GOAL_COPY: Record<GoalId, { emoji: string; title: string; line: string; toward: string }> = {
  first_purchase: { emoji: "🛍️", title: "Make your first purchase", line: "Anything from the Shop. Retail therapy counts as self-care.", toward: "toward your first haul" },
  first_gig: { emoji: "💼", title: "Collect your first gig payout", line: "Gigs live in your Phone. Bigger pay than a shift.", toward: "toward your first gig" },
  move_up: { emoji: "🔑", title: "Move into a better apartment", line: "The next home up. More square feet, same neighbors' opinions.", toward: "toward the new place" },
  pro_gigs: { emoji: "📈", title: "Unlock pro gigs", line: "500 clout and 50 Confidence. Clients start returning your texts.", toward: "toward pro gigs" },
  first_car: { emoji: "🚗", title: "Get your first car", line: "The cheapest one counts. Parking is a separate journey.", toward: "toward your car" },
  big_gigs: { emoji: "🔥", title: "Unlock big gigs", line: "2,000 clout and 80 Confidence. Strangers are starting to care.", toward: "toward big gigs" },
  own_home: { emoji: "🏡", title: "Own a home", line: "No more rent. Your landlord will miss you. Financially.", toward: "toward a home of your own" },
};

/** The day of the next streak reward after `current`, and what it is (mirrors the server's streak_tick). */
export function nextStreakReward(current: number, s = GOALS.streak): { day: number; reward: StreakReward } {
  if (current < 3) return { day: 3, reward: "clout" };
  const day = (Math.floor(current / s.every) + 1) * s.every;
  return { day, reward: streakRewardOn(day, s) ?? "clout" };
}

/** What reaching day `n` of a streak pays, if anything. */
export function streakRewardOn(n: number, s = GOALS.streak): StreakReward | null {
  if (n === 3) return "clout";
  if (n > 0 && n % s.every === 0) return (n / s.every) % 2 === 1 ? "collectible" : "pass";
  return null;
}

/** How far along a goal is, 0 to 1: the average of its parts, each capped at full. */
export function goalProgress(parts: readonly GoalPart[]): number {
  if (!parts.length) return 0;
  return parts.reduce((sum, p) => sum + (p.need <= 0 ? 1 : Math.min(1, Math.max(0, p.have) / p.need)), 0) / parts.length;
}

/** One part in words: "C$1,240 of C$14,000", "380 of 500 clout", "0 of 1". */
export function partLine(p: GoalPart): string {
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  switch (p.unit) {
    case "cash": return `C$${n(p.have)} of C$${n(p.need)}`;
    case "clout": return `${n(p.have)} of ${n(p.need)} clout`;
    case "confidence": return `${n(p.have)} of ${n(p.need)} Confidence`;
    default: return `${n(p.have)} of ${n(p.need)}`;
  }
}
