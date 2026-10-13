// Crushes and date nights (Clarifications section 14, Design Guide C40 and C41) as the
// game sees them: the functions in supabase/migrations/0011. Safe to import anywhere.

import { CLUB_EVENTS, PLACES, type Place } from "./city.ts";

/** Mirrors game_settings 'dating' (checked by tests/dating.test.ts). */
export const DATING = { maxCrushes: 3, datesPerDay: 3, dateMood: 10, dateClout: 25 } as const;

/** My side of a crush on one player. Never says whether they crushed on me unless it's mutual. */
export interface CrushStatus { eligible: boolean; crushed: boolean; matched: boolean; count: number; max: number }

export interface DatePerson { id: string; name: string; style: string }

export interface DateNight {
  id: number;
  /** I asked. */
  mine: boolean;
  kind: "place" | "event";
  target: string;
  status: "pending" | "accepted" | "declined";
  with: DatePerson;
  price: number;
  placeId: string;
  iWent: boolean;
  theyWent: boolean;
  paid: boolean;
  matched: boolean;
}

export interface DatingInbox {
  matches: (DatePerson & { seen: boolean })[];
  dates: DateNight[];
  crushes: number;
  max: number;
  bonus: { mood: number; clout: number };
}

export interface DateCandidate extends DatePerson { matched: boolean; crush: boolean }

export type DatingResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DatingApi {
  inbox(): Promise<DatingResult<DatingInbox>>;
  crushStatus(playerId: string): Promise<DatingResult<CrushStatus>>;
  crush(playerId: string, on: boolean): Promise<DatingResult<CrushStatus>>;
  matchSeen(playerId: string): Promise<DatingResult<null>>;
  candidates(): Promise<DatingResult<DateCandidate[]>>;
  invite(withId: string, kind: "place" | "event", target: string): Promise<DatingResult<null>>;
  respond(dateId: number, yes: boolean): Promise<DatingResult<null>>;
  cancel(dateId: number): Promise<DatingResult<null>>;
}

const ERRORS: Record<string, string> = {
  crush_limit: `That's ${DATING.maxCrushes} crushes. Take one back to make room.`,
  not_connected: "You two need to know each other first: a crew member or a real chat.",
  blocked: "That's not happening.",
  not_a_date_spot: "Pick a place with food or a club night.",
  date_exists: "You two already have a date tonight.",
  date_limit: `That's ${DATING.datesPerDay} date invites today. Pace yourself.`,
  date_answered: "That one's already been answered.",
  date_expired: "That invite expired at midnight.",
  unknown_date: "That date isn't around anymore.",
  unknown_player: "That player isn't around anymore.",
  no_player: "Finish moving in first.",
};

export function datingError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "Cupid glitched. Try again.";
}

/** C41: date nights happen at places with a meal, or at club events. Never exclusive events. */
export function canDateAt(place: Place): boolean {
  return place.actions.some((a) => a.kind === "eat");
}
export function dateSpotName(kind: "place" | "event", target: string): string {
  if (kind === "event") return CLUB_EVENTS.find((e) => e.id === target)?.name ?? target;
  return PLACES.find((p) => p.id === target)?.name ?? target;
}

/** The open, never-anonymous crush invite (Clarifications 14.2). */
export const CRUSH_INVITE_TEXT = "I've got a crush on someone in Clout City. Join and find out if it's you.";

/** Unseen reveals and unanswered invites badge the Phone and show on the home screen. */
export function datingAlerts(inbox: DatingInbox | null): number {
  if (!inbox) return 0;
  return inbox.matches.filter((m) => !m.seen).length + inbox.dates.filter((d) => !d.mine && d.status === "pending").length;
}
