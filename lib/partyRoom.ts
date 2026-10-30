// v0.11 exclusive events update (docs/08-new-features-spec.md section 10; owner Oct 14). At a party you
// have a ticket (or a plus-one) for, the venue's rooftop floor is the party: 8 to 10 other people
// (the real players there, crew first; NPCs fill the gap, unmarked; people you can talk to get a green dot) and a group chat with no
// daily limit during the party. party_room / party_say / party_report (migration 0038) decide who's
// in and filter every message. Dependency-free so tests can import it.

import type { Look } from "./look.ts";

export interface PartyPerson { id: string; name: string; style: string; look: unknown; crew: boolean }
export interface PartyMessage { id: number; from: string; name: string; body: string; at: string; mine: boolean }
export interface PartyRoomState { count: number; people: PartyPerson[]; messages: PartyMessage[] }

export type PartyRoomResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PartyRoomApi {
  /** Check in at the party and read who's here and the chat after a message id. */
  room(eventId: string, after: number): Promise<PartyRoomResult<PartyRoomState>>;
  say(eventId: string, body: string): Promise<PartyRoomResult<PartyMessage>>;
  report(messageId: number, reason: "harassment" | "spam" | "inappropriate" | "other"): Promise<PartyRoomResult<null>>;
}

/** How many other people each player sees at a party (spec: 8 to 10). */
export const ROOM_SIZE = 9;
/** How often the room checks in (ms): a backup now; new messages ring the room's doorbell (lib/live.ts) at once. */
export const PARTY_POLL_MS = 15_000;

/** One figure in the room: a real player, or an NPC filling the gap (no mark: only real players get the green dot). */
export type CrowdMember =
  | { key: string; npc: false; id: string; name: string; style: string; look: Look | null; crew: boolean }
  | { key: string; npc: true; name: string };

const NPC_NAMES = ["Velvet Rope Regular", "Plus-One of a Plus-One", "Guy Who Knows the DJ", "Influencer's Assistant", "Mysterious Sunglasses", "Someone's Cousin", "Brand Ambassador", "Professional Lurker", "Rooftop Philosopher", "The Coat Check Girl's Ex"];

/** Real players first (up to ROOM_SIZE), then NPCs to fill the room. */
export function crowdFor(people: PartyPerson[], toLook: (p: PartyPerson) => Look | null, size = ROOM_SIZE): CrowdMember[] {
  const real: CrowdMember[] = people.slice(0, size).map((p) => ({ key: `p:${p.id}`, npc: false, id: p.id, name: p.name, style: p.style, look: toLook(p), crew: p.crew }));
  const fill: CrowdMember[] = Array.from({ length: Math.max(0, size - real.length) }, (_, i) => ({ key: `npc:${i}`, npc: true, name: NPC_NAMES[i % NPC_NAMES.length] }));
  return [...real, ...fill];
}

/** Tappable, positive-only openers (spec section 10): easy to start, friendly by default. */
export const PARTY_SUGGESTIONS = [
  "Love the fit 🔥",
  "First time here?",
  "Who's on the decks tonight?",
  "This view though 🌃",
  "Your look is everything",
  "Okay this playlist 🙌",
  "Best party in Queens, no contest",
  "Who did your hair?! 😍",
];

/** What the event modal promises (spec section 10), shown before buying. */
export const PARTY_BENEFITS = [
  { emoji: "🗣️", text: "Meet and chat with real people at the party" },
  { emoji: "🎟️", text: "Earn a collectible: a numbered ticket and a badge" },
  { emoji: "📰", text: "Get mentioned in City News" },
];
/** Owner, Oct 14: shown under the Benefits box, always visible. Not a perk; never call it a donation. */
export const PARTY_SUPPORT_LINE = { text: "Helps keep our servers up and running", emoji: "😭" };

const ERRORS: Record<string, string> = {
  party_closed: "The doors aren't open. The bouncer is very clear about this.",
  party_not_on_list: "You're not on the list. Nobody's on the list until they're on the list.",
  party_not_here: "You have to be at the party to chat at the party.",
  party_too_fast: "Breathe. One message at a time.",
  too_long: "Shorter. It's a party, not a podcast.",
  empty: "Say something first.",
  muted: "You're muted for now. Moderators will look at it.",
  banned: "This account can't chat.",
  unknown_message: "That message is gone.",
};
export function partyRoomError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The music's too loud. Try again.";
}
