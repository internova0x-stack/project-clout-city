// Streak repair (migration 0158, owner Nov 3: "a mechanism for redeeming broken streaks, the day after a streak is broken";
// "go with your recommendation"). Mirrors game_settings 'streak_repair' (tests/streakRepair.test.ts keeps them equal).

export const STREAK_REPAIR = {
  /** Only streaks this long can be repaired. */
  minStreak: 3,
  /** Repairable until this many days after the last full day. */
  windowDays: 3,
  /** One repair every this many days. */
  everyDays: 30,
  cashPerDay: 20,
  cashMax: 1500,
  /** The 9 PM last-call push goes to streaks this long. */
  lastCallMin: 7,
} as const;

export type RepairMethod = "earn" | "cash" | "pass" | "vip";

/** What a repair costs in C$ for a streak of this many days. */
export function repairCash(streak: number): number {
  return Math.min(Math.max(0, streak) * STREAK_REPAIR.cashPerDay, STREAK_REPAIR.cashMax);
}

/** streak_repair_state()'s offer: null when there's nothing to repair. */
export interface RepairOffer {
  streak: number;
  lastDay: string;
  /** An earn-back was asked for today: finishing today's five repairs it. */
  earnPending: boolean;
  cash: number;
  passes: number;
  vip: boolean;
  bank: number;
}

export type RepairResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RepairApi {
  state(): Promise<RepairResult<{ offer: RepairOffer | null }>>;
  repair(method: RepairMethod): Promise<RepairResult<{ offer: RepairOffer | null; repaired?: boolean; streak?: number }>>;
}

export const REPAIR_ERRORS: Record<string, string> = {
  no_repair: "There's nothing to repair right now.",
  not_enough_cash: "Not enough in the bank for that.",
  no_pass: "You don't have a guest-list pass.",
  not_vip: "That one's for VIPs.",
  rate_limited: "Slow down a little.",
};
