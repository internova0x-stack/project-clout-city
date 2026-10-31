// Sublets, phase 1 (migration 0119, owner Oct 26; spec section 25): a player renting a 1BR or bigger lets their spare
// room to another player for a few weeks. What the game sees of it: sublet_state() and the calls around it.
// Safe to import anywhere.

/** Mirrors game_settings 'sublets' (checked by tests/sublets.test.ts against the migration). */
export const SUBLETS = {
  homes: ["jackson_heights_1br", "sunnyside_gardens", "lic_highrise"],
  minShare: 0.25,
  maxShare: 0.5,
  minWeeks: 1,
  maxWeeks: 8,
  crewHours: 24,
  noticeDays: 7,
  minAccountDays: 7,
  hangClout: 10,
  maxApps: 3,
  noteMax: 140,
} as const;

export interface SubletPerson { id: string; name: string; style: string; rating: { avg: number | null; count: number }; days: number }

export interface SubletListing {
  id: number; homeId: string; rent: number; minWeeks: number; maxWeeks: number; note: string | null;
  crewOnly: boolean; crewUntil: string; host: SubletPerson; applied: boolean;
}

export interface SubletLive {
  id: number; role: "host" | "sub"; with: SubletPerson; homeId: string; rent: number; deposit: number;
  weeks: number; week: number; start: string; end: string;
  /** The day the next week's rent is charged (null: no more rent before it ends). */
  nextRent: string | null;
  noticeEnd: string | null;
  renew: { weeks: number; mine: boolean } | null;
  /** My card line is showing. */
  shown: boolean;
  hangToday: boolean;
  hangOther: boolean;
}

export interface SubletApp { id: number; weeks: number; note: string | null; at: string; from: SubletPerson }

export interface SubletMine {
  id: number; homeId: string; rent: number; minWeeks: number; maxWeeks: number; note: string | null; crewUntil: string; apps: SubletApp[];
}

export type SubletEndReason = "done" | "left" | "notice" | "unpaid" | "blocked" | "host_moved" | "restart";
export interface SubletEnded { id: number; role: "host" | "sub"; reason: SubletEndReason; with: SubletPerson; deposit: number; rated: boolean }

export interface SubletState {
  /** Why I can't list my spare room (null: I can). */
  hostBlock: string | null;
  /** My home's weekly rent range for a room: [a quarter, half]. */
  bounds: [number, number] | null;
  live: SubletLive | null;
  mine: SubletMine | null;
  ended: SubletEnded | null;
  listings: SubletListing[];
  rules: { minWeeks: number; maxWeeks: number; noticeDays: number; hangClout: number; crewHours: number; noteMax: number; minAccountDays: number };
}

/** The subtenant's home: the host's place, layout and furniture. */
export interface SubletHome { id: number; host: string; hostName: string; homeId: string; layout: unknown; items: { id: number; sku: string }[] }

export type SubletResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SubletApi {
  state(): Promise<SubletResult<SubletState>>;
  home(): Promise<SubletResult<SubletHome | null>>;
  list(rent: number, minWeeks: number, maxWeeks: number, note: string): Promise<SubletResult<SubletState>>;
  unlist(): Promise<SubletResult<SubletState>>;
  apply(listing: number, weeks: number, note: string): Promise<SubletResult<SubletState>>;
  withdraw(listing: number): Promise<SubletResult<SubletState>>;
  answer(app: number, yes: boolean): Promise<SubletResult<SubletState>>;
  notice(on: boolean): Promise<SubletResult<SubletState>>;
  leave(): Promise<SubletResult<SubletState>>;
  renew(weeks: number): Promise<SubletResult<SubletState>>;
  renewAnswer(yes: boolean): Promise<SubletResult<SubletState>>;
  hang(): Promise<SubletResult<SubletState>>;
  show(on: boolean): Promise<SubletResult<SubletState>>;
  rate(sublet: number, stars: number): Promise<SubletResult<SubletState>>;
  seen(sublet: number): Promise<SubletResult<SubletState>>;
}

/** A room's weekly rent range in a home that rents for `rent`: a quarter to half (sublet_bounds). */
export function subletBounds(rent: number): [number, number] {
  return [Math.ceil(rent * SUBLETS.minShare), Math.floor(rent * SUBLETS.maxShare)];
}

export const canHostHome = (homeId: string | null | undefined) => !!homeId && (SUBLETS.homes as readonly string[]).includes(homeId);

const ERRORS: Record<string, string> = {
  rent_out_of_range: "Rent has to be between a quarter and half of yours.",
  bad_weeks: "That length isn't on offer.",
  note_too_long: `Keep the note under ${SUBLETS.noteMax} characters.`,
  home_too_small: "Spare rooms need a 1BR or bigger.",
  // Living together (migration 0149).
  living_together: "You live with your partner. The spare room is spoken for, emotionally.",
  own_house: "You own your place. Sublets are a renter's hustle.",
  too_new: `Sublets open once you've been in the city ${SUBLETS.minAccountDays} days.`,
  one_sublet: "One sublet at a time.",
  applied_elsewhere: "You've applied for a room. Withdraw that before listing yours.",
  you_are_listing: "You're letting out your room. Take the listing down first.",
  listing_gone: "That room's gone. Someone was faster.",
  rent_due: "Pay this week's rent first.",
  cant_afford: "You need the first week and the deposit in the bank.",
  too_many_apps: `${SUBLETS.maxApps} applications at a time. Landlords talk.`,
  already_applied: "You already applied there.",
  unknown_app: "That application isn't around anymore.",
  app_answered: "That one's already been answered.",
  not_available: "They're not available anymore.",
  home_changed: "Your place changed. List it again.",
  they_have_sublet: "They found somewhere else.",
  they_cant_afford: "They can't cover the first week and deposit right now.",
  not_hosting: "You're not hosting anyone.",
  not_subletting: "You're not in a sublet.",
  notice_given: "Notice has been given. No renewing now.",
  no_renewal: "Nothing to answer.",
  not_ended: "That sublet isn't over yet.",
  bad_stars: "One to five stars.",
  no_player: "Finish moving in first.",
};

export function subletError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The broker lost the paperwork. Try again.";
}

/** Why I can't list my room, for the Sublets tab (null: I can). */
export function hostBlockLine(code: string | null): string | null {
  if (!code) return null;
  return ERRORS[code] ?? "Not right now.";
}

/** "⭐ 4.9 · 7 stays" or "New". */
export function ratingLine(r: SubletPerson["rating"] | null | undefined): string {
  if (!r || !r.count || r.avg == null) return "New";
  return `⭐ ${Number(r.avg).toFixed(1)} · ${r.count} stay${r.count === 1 ? "" : "s"}`;
}

/** "Sat, Oct 31" for a yyyy-mm-dd day. */
export function dayLine(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Whole days from today (yyyy-mm-dd) to a day. */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400e3);
}

/** The "it's over" card's line. */
export function endedLine(e: SubletEnded): string {
  const name = `@${e.with.name}`;
  if (e.role === "host") {
    return e.reason === "left" ? `${name} moved out early.` : e.reason === "unpaid" ? `${name}'s rent didn't clear, so the sublet ended.`
      : e.reason === "restart" ? `${name} started over, so the sublet ended.` : `${name}'s sublet is over. The spare room is yours again.`;
  }
  return e.reason === "unpaid" ? "Rent didn't clear, so the sublet ended."
    : e.reason === "host_moved" ? `${name} moved out of the place, so the sublet ended.`
      : e.reason === "notice" ? `${name}'s notice ran out. Time to go home.`
        : e.reason === "blocked" ? "The sublet ended." : `Your sublet at ${name}'s is over.`;
}

/** Something waiting: applications to answer, a renewal to answer, an ended sublet to rate (the Phone badge). */
export function subletAlerts(s: SubletState | null): number {
  if (!s) return 0;
  return (s.mine?.apps.length ?? 0) + (s.live?.renew && !s.live.renew.mine ? 1 : 0) + (s.ended && !s.ended.rated ? 1 : 0);
}
