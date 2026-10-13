// Exclusive event keepsakes (v0.9, #19; owner Oct 13): a plus-one from your crew, a badge per
// party, and a "Spotted at" mention in the News. The server rules live in
// supabase/migrations/0029_party_keepsakes.sql. Dependency-free so tests can import it.

import type { StoreProduct } from "./store.ts";

export interface PartyPerson { id: string; name: string; style: string }

/** A plus-one: the one a ticket holder sent, or one sent to me. */
export interface PlusOne {
  eventId: string;
  eventName: string;
  placeId: string;
  startsAt: string;
  endsAt: string;
  /** True when I'm the ticket holder who asked. */
  mine: boolean;
  status: "invited" | "in" | "declined";
  host: PartyPerson;
  guest: PartyPerson;
}

export interface PartyInbox { plusOnes: PlusOne[]; newsOptOut: boolean }

/** "Spotted at": a party I went to, who else was there that I know, and how many in all. */
export interface PartyMention {
  eventId: string;
  eventName: string;
  placeId: string;
  endsAt: string;
  total: number;
  names: string[];
}

export type PartyResult = { ok: true } | { ok: false; error: string };

export interface PartyApi {
  inbox(): Promise<PartyInbox | null>;
  invite(eventId: string, guestId: string): Promise<PartyResult>;
  respond(eventId: string, yes: boolean): Promise<PartyResult>;
  mentions(): Promise<PartyMention[] | null>;
  setNewsOptOut(out: boolean): Promise<PartyResult>;
}

const ERRORS: Record<string, string> = {
  not_in_crew: "Plus-ones come from your crew. Invite them to the game first.",
  plus_one_taken: "You already have a plus-one. One per ticket; the bouncer counts.",
  already_on_list: "They're already on the list. Great minds.",
  not_on_list: "You need a ticket to bring someone.",
  party_over: "That party's over. The cleanup crew says hi.",
  no_invite: "That invite isn't waiting anymore.",
  unknown_event: "That party isn't happening.",
};

export function partyError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The guest list glitched. Try again.";
}

/** On the list for a party: a ticket of my own, or someone's plus-one. */
export const onList = (p: StoreProduct) => p.owned || !!p.event?.plusOneOf;

/** The plus-one I sent for this party (not counting a decline), and the invite waiting for me. */
export function plusOnesFor(eventId: string, inbox: PartyInbox | null): { sent?: PlusOne; received?: PlusOne } {
  const rows = (inbox?.plusOnes ?? []).filter((x) => x.eventId === eventId);
  return {
    sent: rows.find((x) => x.mine),
    received: rows.find((x) => !x.mine && x.status === "invited"),
  };
}

/** "Spotted at Jada Sol's listening party: you, Priya, Marco and 12 others." */
export function mentionLine(m: PartyMention): string {
  const others = Math.max(0, m.total - 1 - m.names.length);
  const people = ["you", ...m.names];
  const tail = others ? `${others} other${others === 1 ? "" : "s"}` : null;
  const list = tail ? [...people, tail] : people;
  const said = list.length === 1 ? "you, holding court" : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `Spotted at ${m.eventName}: ${said}.`;
}

/** Party badges are 'party:<event>'; their name comes from the event. */
export const PARTY_BADGE_PREFIX = "party:";

export function partyBadge(id: string, products: StoreProduct[]): { id: string; emoji: string; name: string } | null {
  if (!id.startsWith(PARTY_BADGE_PREFIX)) return null;
  const ev = products.find((p) => p.event?.id === id.slice(PARTY_BADGE_PREFIX.length))?.event;
  return { id, emoji: "🎟️", name: ev ? `Was at ${ev.name}` : "Was at an exclusive party" };
}
