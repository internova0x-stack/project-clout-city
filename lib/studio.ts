// Story Studio (/studio): what the admin page reads and asks for. The rules live in
// the admin_* SQL functions (supabase/migrations/0007); one approval puts a story
// on the schedule (product owner, Oct 12, 2026).

import type { Arc, Status } from "./stories.ts";

export type Review = "draft" | "approved" | "declined";

/** One row of admin_story_list(). */
export interface StudioArc {
  id: string;
  title: string;
  type: "main" | "side";
  tier: "free" | "premium";
  sku: string | null;
  parent: string | null;
  status: Status;
  review: Review;
  reviewNote: string | null;
  reviewedAt: string | null;
  startAt: string | null;
  /** Today's story day while live, else null. */
  day: number | null;
  lastDay: number;
  updatedAt: string;
  startWeekday: string | null;
  beats: { id: string; day: number; headline: string; status: Status; prediction: string | null }[] | null;
  votes: Record<string, number>;
}

/** One report in the chat review queue (admin_reports, migration 0010). */
export interface StudioReport {
  id: number;
  reason: "harassment" | "spam" | "inappropriate" | "other";
  note: string | null;
  status: "open" | "dismissed" | "warned" | "muted" | "banned";
  at: string;
  reviewedAt: string | null;
  messageId: number | null;
  reporter: { id: string; name: string };
  reported: { id: string; name: string; warned: boolean; mutedUntil: string | null; banned: boolean; reports: number };
  messages: { id: number; from: string; body: string; at: string; reported: boolean }[];
}

/** The success metrics (admin_metrics, migration 0010; Clarifications section 8). */
export interface StudioMetrics {
  players: number;
  newThisWeek: number;
  firstTask: number;
  invited: number;
  invitesJoined: number;
  day1Cohort: number;
  day1Returned: number;
  activeToday: number;
  beatOpens: number;
  readers: number;
  votes: number;
  voters: number;
  purchases: Record<string, { count: number; cents: number }>;
  refunds: number;
  messagesToday: number;
  openReports: number;
}

export type Admin<T> = { ok: true; data: T } | { ok: false; error: string };

export type StudioResult = { ok: true; arcs: StudioArc[]; message?: string } | { ok: false; error: string; problems?: string[] };

export interface StudioApi {
  /** Adds or replaces arcs from a JSON file (one arc or a list). Validated first; changed arcs go back to draft. */
  upload(json: string): Promise<StudioResult>;
  review(arc: string, decision: Review, note: string): Promise<StudioResult>;
  /** Day 1 as YYYY-MM-DD (New York), or null to unschedule. */
  schedule(arc: string, start: string | null): Promise<StudioResult>;
  status(arc: string, status: Status): Promise<StudioResult>;
  beatStatus(arc: string, beat: string, status: Status): Promise<StudioResult>;
  /** Full content of an arc and its side arcs, for the player preview. */
  content(arc: string): Promise<{ ok: true; arcs: Arc[] } | { ok: false; error: string }>;
  /** Chat review queue: open first, newest first. */
  reports?(status: "open" | "all"): Promise<Admin<StudioReport[]>>;
  reportAction?(id: number, action: "dismiss" | "warn" | "mute" | "ban"): Promise<Admin<null>>;
  metrics?(): Promise<Admin<StudioMetrics>>;
}

const ERRORS: Record<string, string> = {
  not_admin: "This account isn't a story admin.",
  arc_is_live: "That story is live. Pause or retire it instead of changing it mid-run.",
  not_approved: "Approve the story before scheduling it.",
  start_in_past: "Day 1 can't be in the past.",
  wrong_weekday: "That's the wrong weekday for this story's start.",
  finale_collision: "Another story has its finale on the same day. Pick a different week.",
  side_arcs_follow_parent: "Side stories run with their main story; schedule the main story.",
  unknown_arc: "That story doesn't exist.",
  unknown_beat: "That beat doesn't exist.",
  bad_arc: "That file isn't a story.",
  bad_status: "Unknown status.",
  bad_decision: "Unknown decision.",
  unknown_report: "That report is gone.",
};

export function studioError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The Studio glitched. Try again.";
}

/** Accepts one arc or a list of arcs. */
export function parseArcs(json: string): { arcs: Arc[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: "That isn't valid JSON." };
  }
  const list = Array.isArray(data) ? data : [data];
  if (!list.length || !list.every((a) => a && typeof a === "object" && typeof (a as Arc).id === "string" && Array.isArray((a as Arc).beats))) {
    return { error: "Each story needs an id and a beats list." };
  }
  return { arcs: list as Arc[] };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The next date on or after `from` that falls on `weekday` (default Sunday, the brief's start day). */
export function nextWeekday(from: string, weekday = "sunday"): string {
  const d = new Date(`${from}T12:00:00Z`);
  const want = Math.max(0, WEEKDAYS.indexOf(weekday));
  d.setUTCDate(d.getUTCDate() + ((want - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (day: string) => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
