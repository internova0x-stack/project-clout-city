// v0.13 "Better Together" (owner, Oct 15; docs/08 section 16) as the game sees it: together bonuses,
// riding together and the Jobs app. The rules live in supabase/migrations/0050_better_together.sql;
// the numbers in CITY_ECONOMY.together and .jobs (lib/city.ts). Safe to import anywhere.

import { CITY_ECONOMY, placeById, type Place } from "./city.ts";
import { economyError } from "./playerEconomy.ts";

export const TOGETHER = CITY_ECONOMY.together;
export const JOBS = CITY_ECONOMY.jobs;

/** Whether an activity can be done together (together_action): a visit at a library, university or club. */
export function canDoTogether(place: Place | undefined, actionId: string): boolean {
  if (!place) return false;
  const a = place.actions.find((x) => x.id === actionId);
  return a?.kind === "visit" && place.tags.some((t) => (TOGETHER.tags as readonly string[]).includes(t));
}

/** The together activities at a place. */
export function togetherActions(place: Place): Place["actions"] {
  return place.actions.filter((a) => canDoTogether(place, a.id));
}

/** "study", "club": the short verb for an invite ("wants to study together at …"). */
export function togetherVerb(placeId: string, actionId: string): string {
  const p = placeById(placeId);
  if (!p) return "hang out";
  if (p.tags.includes("library")) return "study";
  if (p.tags.includes("university")) return actionId === "lecture" ? "catch a lecture" : "study";
  if (p.tags.includes("club") || p.tags.includes("nightlife")) return "go out";
  return "hang out";
}

/** Each rider's half of the fare, rounded up (ride_respond). */
export const rideShare = (fare: number) => Math.ceil(fare / 2);

/** The total with the bonus: 5 × 1.5 = 8 (the server rounds the extra half). */
export const withBonus = (base: number) => base + Math.round(base * (TOGETHER.multiplier - 1));

export interface TogetherPerson { id: string; name: string; style: string }

/** Someone you can invite: crew anywhere, or anyone here now. */
export interface TogetherCandidate extends TogetherPerson { crew: boolean; here: boolean }

export interface TogetherPlan {
  id: number;
  place: string;
  action: string;
  status: "pending" | "accepted";
  /** I sent it. */
  mine: boolean;
  with: string;
  withName: string;
  withStyle: string;
  withHere: boolean;
  createdAt: string;
}

export interface TogetherBonus {
  id: number;
  place: string;
  action: string;
  with: string;
  withName: string;
  clout: number;
  cloutBase: number;
  confidence: number;
  confidenceBase: number;
  /** False when the day's limit was already reached. */
  paid: boolean;
  left: number;
}

export interface RideRequest {
  id: number;
  place: string;
  mode: "subway" | "taxi";
  each: number;
  seconds: number;
  from: string;
  fromName: string;
  fromStyle: string;
  createdAt: string;
}

export interface TogetherInbox {
  left: number;
  canInvite: boolean;
  plans: TogetherPlan[];
  bonuses: TogetherBonus[];
  rides: RideRequest[];
}

export interface RideStatus {
  id: number;
  status: "pending" | "accepted" | "declined" | "gone";
  place: string;
  mode: "subway" | "taxi";
  cash: number;
  seconds: number;
  arrivesAt: string | null;
}

/** How many pending things need an answer (the prompt's count). */
export const togetherAlerts = (inbox: TogetherInbox | null) =>
  (inbox?.plans.filter((p) => !p.mine && p.status === "pending").length ?? 0) + (inbox?.rides.length ?? 0);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export type JobKind = "decorator" | "manager" | "errand" | "event";
/** Migration 0151's game-verified jobs: the game checks the work itself. */
export type TaskKind = "errand" | "event";
export type JobStatus = "open" | "active" | "done" | "kept" | "undone" | "ended" | "cancelled" | "expired";

/** As a worker (rating, rated) and, since migration 0151, as a client (clientRating, clientRated). */
export interface JobRating { hired: number; rating: number | null; rated: number; clientRating?: number | null; clientRated?: number }

/** What an errand or event job asks for (migration 0151). */
export interface JobTarget { places?: string[]; event?: string }

/** Migration 0151's extra fields on every job row (absent before it). */
export interface JobExtras {
  target?: JobTarget | null;
  deadline?: string | null;
  /** The city fee: on open jobs what it will be, on paid jobs what it was. */
  fee?: number;
  /** Errands: the places checked in at so far; events: the event once attended. */
  progress?: string[];
}

export interface OpenJob extends JobExtras {
  id: number;
  kind: JobKind;
  pay: number;
  cut: number;
  note: string | null;
  createdAt: string;
  poster: string;
  posterName: string;
  posterStyle: string;
  homeId: string;
  posterRating: JobRating;
  businesses: number;
  /** Manager jobs: the cut of a day's pay at the client's businesses. */
  perDay: number | null;
  /** Crew, partner or a chat (migration 0151); otherwise they're both on the open board. */
  friend?: boolean;
}

export interface MyJob extends JobExtras {
  id: number;
  kind: JobKind;
  pay: number;
  cut: number;
  note: string | null;
  status: JobStatus;
  stars: number | null;
  moved: number;
  earned: number;
  createdAt: string;
  takenAt: string | null;
  finishedAt: string | null;
  endsAt: string | null;
  keepBy: string | null;
  worker: string | null;
  workerName: string | null;
  workerStyle: string | null;
  workerRating: JobRating | null;
}

export interface WorkJob extends JobExtras {
  id: number;
  kind: JobKind;
  pay: number;
  cut: number;
  note: string | null;
  status: JobStatus;
  earned: number;
  takenAt: string;
  moved: number;
  endsAt: string | null;
  poster: string;
  posterName: string;
  posterStyle: string;
  /** The stars the worker gave the client (migration 0151). */
  clientStars?: number | null;
}

export interface JobsBoard {
  canWork: boolean; open: OpenJob[]; mine: MyJob[]; working: WorkJob[]; rating: JobRating;
  /** Migration 0151: why jobs are closed (too_new, economy_locked, economy_frozen, phase_off) and the fee rate. */
  locked?: string | null;
  /** Owner, Nov 1: taking work is open from day one; posting (paying someone) waits for the unlock. */
  canPost?: boolean;
  postLocked?: string | null;
  postUnlocksAt?: string | null;
  feeRate?: number;
}

/** What the decorator sees: the client's home, furniture and layout, and when time is up. */
export interface JobHome {
  id: number;
  pay: number;
  poster: string;
  posterName: string;
  homeId: string;
  houseSku: string | null;
  layout: unknown;
  items: { id: number; sku: string }[];
  endsAt: string;
}

/** "⭐ 4.8 · hired 12 times", or "New on the Jobs board". */
/** "⭐ 4.6 as a client", or null before anyone rated them. */
export const clientLine = (r: JobRating | null | undefined) => (r?.clientRating != null ? `⭐ ${r.clientRating.toFixed(1)} as a client` : null);

export function ratingLine(r: JobRating | null | undefined): string {
  if (!r || !r.hired) return "New on the Jobs board";
  const hired = `hired ${r.hired === 1 ? "once" : `${r.hired} times`}`;
  return r.rating != null ? `⭐ ${r.rating.toFixed(1)} · ${hired}` : hired;
}

/** Whole minutes until a time (at least 0). */
export const minutesLeft = (at: string | null, now = Date.now()) =>
  at ? Math.max(0, Math.ceil((new Date(at).getTime() - now) / 60000)) : 0;

/** The poster's job waiting for "Keep it" or "Undo it all". */
export const jobToApprove = (board: JobsBoard | null) => board?.mine.find((j) => j.kind === "decorator" && j.status === "done") ?? null;

/** Player-facing words for the server's refusals. */
export function togetherError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("too_new")) return `Accounts need to be ${TOGETHER.minAccountDays} days old for that. Explore a little first.`;
  if (m.includes("not_here")) return "They have to be here with you right now, or in your crew.";
  if (m.includes("crew_only")) return "They only take invites from their crew.";
  if (m.includes("already_invited")) return "You already invited them to this today.";
  if (m.includes("not_together")) return "That one's a solo activity.";
  if (m.includes("not_yet")) return "Waiting for both of you to do it.";
  if (m.includes("too_far_apart")) return `Too far apart: do it within ${TOGETHER.windowMinutes} minutes of each other.`;
  if (m.includes("not_accepted")) return "They haven't said yes yet.";
  if (m.includes("bad_mode")) return "Ride together by subway or taxi.";
  if (m.includes("door_clout")) return "The bouncer turned one of you away. More clout first.";
  if (m.includes("they_cant_afford")) return "They can't cover their half right now.";
  if (m.includes("cant_afford")) return "Not enough cash for that.";
  if (m.includes("bad_pay")) return `Pay between C$${JOBS.decorator.payMin.toLocaleString("en-US")} and C$${JOBS.decorator.payMax.toLocaleString("en-US")}.`;
  if (m.includes("bad_cut")) return `A cut between ${JOBS.manager.cutMin}% and ${JOBS.manager.cutMax}%.`;
  if (m.includes("no_business")) return "Buy a business first. Then you'll have tills to manage.";
  if (m.includes("already_posted")) return "You already have one of those posted.";
  if (m.includes("job_taken")) return "Someone got there first.";
  if (m.includes("own_job")) return "You can't hire yourself. Tempting, though.";
  if (m.includes("pair_limit")) return "One job a day between the same two players.";
  if (m.includes("already_working")) return "Finish the job you have first.";
  if (m.includes("blocked")) return "That job isn't available.";
  if (m.includes("job_over")) return "Time's up on that job.";
  if (m.includes("not_done")) return "They're still working on it.";
  if (m.includes("bad_layout")) return "That layout didn't save. Try moving it again.";
  if (m.includes("bad_target")) return "Pick real places on the map (2 to 4), or an event.";
  if (m.includes("bad_hours")) return "Pick one of the deadlines.";
  if (m.includes("bad_stars")) return "One to five stars.";
  if (m.includes("unknown")) return "That's not around anymore.";
  // Migration 0151: the Player Economy's unlock, caps and phase switch.
  return economyError(message);
}

export type TogetherResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** What the game calls: app/home/togetherActions.ts on the server, lib/togetherSim.ts in the preview. */
export interface TogetherApi {
  inbox(): Promise<TogetherResult<TogetherInbox>>;
  invite(to: string, place: string, action: string): Promise<TogetherResult<{ id: number }>>;
  respond(id: number, yes: boolean): Promise<TogetherResult<{ status: string }>>;
  claim(id: number): Promise<TogetherResult<TogetherBonus>>;
  seen(id: number): Promise<TogetherResult<null>>;
  rideOffer(to: string, place: string, mode: "subway" | "taxi"): Promise<TogetherResult<{ id: number; fare: number; each: number }>>;
  rideRespond(id: number, yes: boolean): Promise<TogetherResult<RideStatus>>;
  rideStatus(id: number): Promise<TogetherResult<RideStatus | null>>;
  jobs: {
    board(): Promise<TogetherResult<JobsBoard>>;
    post(kind: JobKind, pay: number, cut: number, note: string): Promise<TogetherResult<{ id: number; cash: number }>>;
    cancel(id: number): Promise<TogetherResult<{ cash: number }>>;
    take(id: number): Promise<TogetherResult<{ id: number; kind: string }>>;
    home(id: number): Promise<TogetherResult<JobHome>>;
    save(id: number, layout: unknown): Promise<TogetherResult<{ moved: number }>>;
    finish(id: number): Promise<TogetherResult<{ status: string }>>;
    settle(id: number, keep: boolean, stars: number | null): Promise<TogetherResult<{ status: string; cash: number }>>;
    rate(id: number, stars: number): Promise<TogetherResult<null>>;
    collect(id: number): Promise<TogetherResult<{ collected: number; cash: number }>>;
    end(id: number): Promise<TogetherResult<{ status: string }>>;
    /** Migration 0151: post an errand or event job (pay held until the game sees it done). */
    postTask?(kind: TaskKind, pay: number, target: JobTarget, hours: number, note: string): Promise<TogetherResult<{ id: number; cash: number; fee: number }>>;
    /** The worker asks the game to check their errand or event now. */
    check?(id: number): Promise<TogetherResult<{ status: string; progress: string[]; earned: number }>>;
    /** The worker rates the client. */
    rateClient?(id: number, stars: number): Promise<TogetherResult<null>>;
  };
}
