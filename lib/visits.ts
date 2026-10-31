// Having people over (migration 0121, owner Oct 26; spec section 27): hangouts and house parties at a player's home.
// What the game sees of it: visit_state(), visit_room() and the calls around them. Safe to import anywhere.

/** Mirrors game_settings 'visits' (checked by tests/visits.test.ts against the migration). */
export const VISITS = {
  capacity: { astoria_share: 2, sj_dorm: 2, qu_dorm: 2, astoria_studio: 3, jackson_heights_1br: 4, sunnyside_gardens: 5, lic_highrise: 6 },
  houseCapacity: 8,
  kinds: {
    hang: { minutes: 60, perDay: 3, guestClout: 10, guestMood: 8, hostClout: 8, hostMood: 4 },
    party: { minutes: 120, perDay: 1, guestClout: 25, guestMood: 15, hostClout: 20, hostMood: 6, snacksBase: 40, snacksPerGuest: 20, leadHours: 12 },
  },
  stayMinutes: 2,
  presenceMinutes: 3,
  hostMoodMax: 30,
  chatMax: 200,
} as const;

export type VisitKind = keyof typeof VISITS.kinds;

export interface VisitPerson { id: string; name: string; style: string; look: unknown }
export type VisitGuestStatus = "invited" | "accepted" | "declined" | "left" | "sent_home";

export interface VisitState {
  hosting: {
    id: number; kind: VisitKind; starts: string; ends: string; capacity: number; crib: number;
    guests: (VisitPerson & { status: VisitGuestStatus; here: boolean; paid: boolean })[];
  } | null;
  invites: { id: number; kind: VisitKind; starts: string; ends: string; host: VisitPerson; status: "invited" | "accepted"; capacity: number; going: number }[];
  invitable: (VisitPerson & { crew: boolean; partner: boolean })[];
  capacity: number;
  snacks: number;
  left: Record<VisitKind, number>;
  /** Why I can't host right now ("subletting"), or null. */
  blocked: string | null;
  crib: number;
}

export interface VisitMessage { id: number; from: string; name: string; body: string; at: string; mine: boolean }

export interface VisitRoom {
  id: number; kind: VisitKind; starts: string; ends: string; over: boolean; host: VisitPerson; mine: boolean; crib: number;
  me: { status: VisitGuestStatus; paid: boolean } | null;
  people: (VisitPerson & { host: boolean })[];
  messages: VisitMessage[];
}

export interface VisitHome { id: number; host: string; hostName: string; homeId: string; houseSku: string | null; layout: unknown; items: { id: number; sku: string }[] }

export type VisitResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface VisitApi {
  state(): Promise<VisitResult<VisitState>>;
  host(kind: VisitKind, guests: string[], startsAt: string | null): Promise<VisitResult<VisitState>>;
  end(): Promise<VisitResult<VisitState>>;
  sendHome(playerId: string): Promise<VisitResult<VisitState>>;
  answer(visitId: number, yes: boolean): Promise<VisitResult<VisitState>>;
  arrive(visitId: number): Promise<VisitResult<VisitRoom>>;
  leave(visitId: number): Promise<VisitResult<VisitState>>;
  room(visitId: number, after: number): Promise<VisitResult<VisitRoom>>;
  home(visitId: number): Promise<VisitResult<VisitHome>>;
  say(visitId: number, body: string): Promise<VisitResult<VisitMessage>>;
}

/** How often the room checks in (ms): a backup now; messages, arrivals and departures ring the doorbell (lib/live.ts). */
export const VISIT_POLL_MS = 15_000;

/** What the host gets for each guest who stays, by the Crib Rating at the start. */
export function hostCloutPerGuest(kind: VisitKind, crib: number): number {
  return Math.round(VISITS.kinds[kind].hostClout * (1 + crib / 100));
}

export function snacksFor(capacity: number): number {
  return VISITS.kinds.party.snacksBase + VISITS.kinds.party.snacksPerGuest * capacity;
}

export const KIND_LABEL: Record<VisitKind, { name: string; emoji: string }> = {
  hang: { name: "Hangout", emoji: "🏠" },
  party: { name: "House party", emoji: "🎉" },
};

const ERRORS: Record<string, string> = {
  cant_invite: "They can't be invited: crew, your partner or people you chat with only.",
  // Living together (migration 0149): the place is the host partner's, so they host.
  partner_hosts: "It's your partner's lease, so they do the hosting. Ask them to have people over.",
  already_hosting: "You're already hosting. One thing at a time.",
  daily_limit: "That's enough hosting for today. Your neighbors need sleep.",
  bad_time: "Pick a time in the next 12 hours.",
  no_guests: "Pick someone to invite.",
  too_many: "Your place doesn't fit that many.",
  cant_afford: "Not enough in the bank for the snacks.",
  subletting: "You're subletting. Ask your host before you throw a party in their place.",
  not_hosting: "You're not hosting anything right now.",
  visit_over: "That's over. You missed it.",
  not_started: "Not yet. Show up on time, not early.",
  not_invited: "You're not on that guest list.",
  full: "It's full in there. Try again in a bit.",
  not_here: "Go in first, then talk.",
  empty: "Say something first.",
  too_long: "Shorter. It's a living room, not a podcast.",
  too_fast: "Breathe. One message at a time.",
  muted: "You're muted for now.",
  bad_kind: "Hangout or house party?",
  no_player: "Finish moving in first.",
};

export function visitError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The buzzer's broken. Try again.";
}

/** "42 min left" / "Starts in 1 h 20 min" / "Over". */
export function visitClock(starts: string, ends: string, now = Date.now()): string {
  const s = Date.parse(starts), e = Date.parse(ends);
  const fmt = (ms: number) => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`; };
  if (now < s) return `Starts in ${fmt(s - now)}`;
  if (now < e) return `${fmt(e - now)} left`;
  return "Over";
}

/** Invites waiting on me (for the home card and the Phone badge): live or upcoming, not answered yet. */
export function visitAlerts(s: VisitState | null): number {
  return s ? s.invites.filter((i) => i.status === "invited").length : 0;
}
