// Crew outings (product owner, Oct 13, 2026) as the game sees them: the crew_* functions
// in supabase/migrations/0013. One tap on a place card invites the crew (your invited
// friends) to the same activity tonight. Safe to import anywhere.

import { CLUB_EVENTS, type Place } from "./city.ts";

/** Mirrors game_settings 'crew' (checked by tests/crew.test.ts). */
export const CREW = { maxInvites: 5, outingsPerDay: 3, perFriendClout: 10, fullClout: 100, fullMood: 10, fullSize: 6 } as const;

export interface CrewPerson { id: string; name: string; style: string }
export interface CrewMember extends CrewPerson { status: "host" | "invited" | "in" | "declined"; went: boolean }

export interface CrewOuting {
  id: number;
  kind: "place" | "event";
  placeId: string;
  activity: string;
  price: number;
  /** I sent it. */
  mine: boolean;
  /** Everyone went: the full-crew bonus paid. */
  full: boolean;
  myStatus: CrewMember["status"];
  iWent: boolean;
  host: CrewPerson;
  members: CrewMember[];
}

export interface CrewInbox { outings: CrewOuting[]; /** Crew bonus clout earned today. */ clout: number }

export type CrewResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CrewApi {
  inbox(): Promise<CrewResult<CrewInbox>>;
  members(): Promise<CrewResult<CrewPerson[]>>;
  create(kind: "place" | "event", placeId: string, activity: string, members: string[]): Promise<CrewResult<null>>;
  respond(outingId: number, yes: boolean): Promise<CrewResult<null>>;
}

export interface CrewActivity { kind: "place" | "event"; id: string; label: string; price: number }

/**
 * What a crew can do at a place: visits, meals, hangouts and lectures (virtual cash or free),
 * and its club or campus events. Never shifts, the gigs board, story-only actions or
 * exclusive (real-money) events.
 */
export function crewActivities(place: Place): CrewActivity[] {
  return [
    ...place.actions
      .filter((a) => (a.kind === "visit" || a.kind === "eat" || a.kind === "hangout") && !a.storyUnlock)
      .map((a) => ({ kind: "place" as const, id: a.id, label: a.label, price: a.price ?? 0 })),
    ...CLUB_EVENTS.filter((e) => e.placeId === place.id).map((e) => ({ kind: "event" as const, id: e.id, label: e.name, price: e.entry })),
  ];
}

export function activityLabel(place: Place | undefined, kind: "place" | "event", id: string): string {
  if (kind === "event") return CLUB_EVENTS.find((e) => e.id === id)?.name ?? id;
  return place?.actions.find((a) => a.id === id)?.label ?? id;
}

/** Invites waiting for an answer badge the Phone and show on the home screen. */
export function crewAlerts(inbox: CrewInbox | null): number {
  return inbox ? inbox.outings.filter((o) => !o.mine && o.myStatus === "invited").length : 0;
}

/** How many have gone, out of everyone still in. */
export function crewProgress(o: CrewOuting): { went: number; total: number } {
  const live = o.members.filter((m) => m.status !== "declined");
  return { went: live.filter((m) => m.went).length, total: live.length };
}

const ERRORS: Record<string, string> = {
  not_a_crew_activity: "The crew can't come along for that one.",
  no_crew: "Pick at least one friend.",
  too_many: `Up to ${CREW.maxInvites} friends at a time.`,
  not_in_crew: "That's not your crew. Yet.",
  outing_limit: `That's ${CREW.outingsPerDay} crew outings today. Even legends rest.`,
  outing_exists: "Your crew is already invited to this tonight.",
  outing_expired: "That invite expired at midnight.",
  unknown_outing: "That plan isn't around anymore.",
  no_player: "Finish moving in first.",
};

export function crewError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The group chat glitched. Try again.";
}
