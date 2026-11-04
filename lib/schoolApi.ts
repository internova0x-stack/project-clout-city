// The Homecoming race's client API (docs/SCHOOL-RACE.md): what Crown HQ (components/school/) calls and gets back. The server
// (app/home/schoolActions.ts, migration 0162) and the preview's in-memory race (lib/schoolSim.ts) both implement `SchoolApi`.
// Types and copy only: safe for a player's bundle (no content, no odds).

import type { Activity, Crown, RaceState, RaceView, Slot } from "./schoolRace.ts";

export type SchoolResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Why the player can't declare for the crown right now (null when they can). */
export type DeclareBlock = "not_enrolled" | "too_new" | "campaign_running" | "running" | null;

export interface SchoolRival {
  id: string;
  name: string;
  role: string;
  vibe?: string;
  /** The rival's first-time line on the Quad. */
  entrance: string;
  /** public/cast/<portrait>.webp */
  portrait: string;
}

export interface SchoolScreen {
  /** The campus the player is enrolled at (lib/campus.ts id), or null. */
  campus: string | null;
  /** Follows the character creator's body (modelSex: female → queen, male → king); a running race keeps its own. */
  crown: Crown;
  /** The reigning royal the player runs (or would run) against. */
  rival: SchoolRival | null;
  canDeclare: boolean;
  /** The block's code, and its sentence for the screen. */
  block: DeclareBlock;
  blockText: string | null;
  /** The Monday a race declared today would start (New York). */
  startsOn: string;
  /** Crown funds are the bank. */
  bank: number;
  /** What the planner may pick: Club, Date (a crush or partner) and Work shift (a career job). */
  can: { club: boolean; date: boolean; work: boolean };
  /** The running (or last finished) race, or null before the first. */
  view: RaceView | null;
  /** The answer to the last choice or reply, when there was one. */
  receipt?: string;
}

export type SchoolBudget = Partial<RaceState["budget"]>;

export interface SchoolApi {
  screen: () => Promise<SchoolResult<SchoolScreen>>;
  declare: () => Promise<SchoolResult<SchoolScreen>>;
  slot: (day: number, slot: Slot, act: Activity) => Promise<SchoolResult<SchoolScreen>>;
  budget: (b: SchoolBudget) => Promise<SchoolResult<SchoolScreen>>;
  choose: (card: string, option: string) => Promise<SchoolResult<SchoolScreen>>;
  reply: (msg: string, option: string) => Promise<SchoolResult<SchoolScreen>>;
}

/** The portrait file for a cast id (public/cast/school-<id>.webp). */
export const schoolPortrait = (id: string) => `school-${id}`;

export function schoolError(code: string): string {
  const map: Record<string, string> = {
    not_enrolled: "Enrol at a campus first. The crown is for students.",
    too_new: "You just got to the city. Declare for the crown once your account is a week old.",
    campaign_running: "You're running a city campaign. One full-time race at a time.",
    running: "You're already running for the crown.",
    no_race: "You're not running for the crown.",
    over: "The semester's over.",
    past: "That day's already been played.",
    homecoming: "Homecoming weekend is set. No changes now.",
    needs_club: "Join a club first.",
    needs_date: "You need a crush or a partner for a date.",
    needs_work: "You need a job for a work shift.",
    bad_budget: "Budget lines go in C$50 steps, up to C$1,000.",
    no_cash: "Your bank can't cover that budget.",
    not_pending: "That's already been decided.",
    not_open: "That message has already been answered.",
    no_energy: "You're out of Energy.",
    rate_limited: "Slow down. The campus needs a breather.",
    conflict: "Something changed. Try that again.",
    unknown: "That didn't work. Try again.",
  };
  return map[code] ?? map.unknown;
}
