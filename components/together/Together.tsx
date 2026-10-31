"use client";

import { useState } from "react";
import { CLUB_EVENTS, PLACES, placeById } from "@/lib/city";
import { ECONOMY, formatCash } from "@/lib/economy";
import {
  JOBS, TOGETHER, clientLine, minutesLeft, ratingLine, togetherVerb,
  type JobTarget, type TaskKind, type JobsBoard, type MyJob, type OpenJob, type TogetherBonus, type TogetherCandidate, type TogetherInbox, type TogetherPlan, type RideRequest, type WorkJob,
} from "@/lib/together";
import { handle } from "@/lib/validation";
import { PLAYER_ECONOMY, afterFee, economyError, lockedLine, type EconomyApi } from "@/lib/playerEconomy";
import { OpenBoardRow } from "../economy/Economy";
import { Avatar } from "../crew/Crew";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";

// v0.13 "Better Together" (owner, Oct 15; docs/08 section 16), built from the approved mockup
// (/preview/together): the app's own sheets, cards, rows, chips and buttons, so spacing and type match.

const placeName = (id: string) => placeById(id)?.name ?? "there";
const placeEmoji = (id: string) => placeById(id)?.emoji ?? "📍";
const actionLabel = (placeId: string, actionId: string) => placeById(placeId)?.actions.find((a) => a.id === actionId)?.label ?? "";

function PersonText({ title, meta }: { title: string; meta: string }) {
  return (
    <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
      <span className="title" style={{ display: "block" }}>{title}</span>
      <span className="meta">{meta}</span>
    </span>
  );
}

const whoTag = (c: TogetherCandidate) => (c.crew && c.here ? "Crew · here now" : c.crew ? "Crew" : "Here now");

/** 1 · On a place card: do it together. One person: crew anywhere, or anyone here now. */
export function TogetherSheet({ target, people, inbox, busy, onInvite, onClose }: {
  target: { place: string; action: string } | null;
  people: TogetherCandidate[];
  inbox: TogetherInbox | null;
  busy: boolean;
  onInvite: (to: string) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [last, setLast] = useState(target);
  if (target !== last) { setLast(target); setPick(people[0]?.id ?? null); }
  const chosen = people.find((p) => p.id === pick);
  const invited = new Set(inbox?.plans.filter((p) => p.mine && target && p.place === target.place && p.action === target.action).map((p) => p.with));
  return (
    <Sheet open={!!target} onClose={onClose} label="Do it together">
      {target && (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingRight: 44 }}>
            <h2 className="display-md" style={{ margin: 0 }}>Do it together</h2>
            <p className="subtext" style={{ margin: 0 }}>{placeEmoji(target.place)} {placeName(target.place)} · {togetherVerb(target.place, target.action)}</p>
          </div>
          {inbox && !inbox.canInvite ? (
            <div className="card stack-4">
              <p className="overline" style={{ margin: 0 }}>Almost</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Together bonuses start once your account is {TOGETHER.minAccountDays} days old. Explore a little first.</p>
            </div>
          ) : people.length === 0 ? (
            <div className="card stack-4">
              <p className="overline" style={{ margin: 0 }}>Nobody to ask yet</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Invite your crew, or ask someone who&apos;s here with you. Players here show in View People.</p>
            </div>
          ) : (
            <div className="stack-4">
              <p className="overline" style={{ margin: 0 }}>Who · one person</p>
              {people.map((p) => {
                const sent = invited.has(p.id);
                return (
                  <button key={p.id} className="list-row crew-pick" aria-pressed={pick === p.id} disabled={sent} onClick={() => setPick(p.id)}>
                    <Avatar style={p.style} />
                    <PersonText title={handle(p.name)} meta={sent ? "Invited" : whoTag(p)} />
                    <span className={`crew-check${pick === p.id ? " on" : ""}`} aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="crew-bonus">
            👯 <b>{TOGETHER.multiplier}× confidence and clout</b> for both of you when you&apos;re both here within {TOGETHER.windowMinutes} minutes.<br />
            {inbox ? `${inbox.left} of ${TOGETHER.perDay} together bonuses left today.` : `Up to ${TOGETHER.perDay} together bonuses a day.`}
          </div>
          <button className="btn btn-taxi" disabled={busy || !chosen || invited.has(chosen.id) || (inbox ? !inbox.canInvite : false)} onClick={() => chosen && onInvite(chosen.id)}>
            {busy ? "…" : chosen ? `Invite ${handle(chosen.name)}` : "Invite"}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** The home-screen nudge when someone invited you or wants to ride with you. */
export function TogetherPrompt({ inbox, onOpen, onDismiss }: { inbox: TogetherInbox; onOpen: () => void; onDismiss: () => void }) {
  const ride = inbox.rides[0];
  const plan = inbox.plans.find((p) => !p.mine && p.status === "pending");
  if (!ride && !plan) return null;
  return (
    <div className="story-prompt crew-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">{ride ? "🚕" : "👯"}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>{ride ? "Ride together" : "Together"}</span>
          <span className="title one-line" style={{ display: "block", color: "var(--night-900)" }}>
            {ride ? `${handle(ride.fromName)}: ${placeName(ride.place)}` : `${handle(plan!.withName)}: ${placeName(plan!.place)}`}
          </span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

function InviteCard({ plan, busy, onAnswer }: { plan: TogetherPlan; busy: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div className="card date-invite stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={plan.withStyle} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>Together</span>
          <span className="title" style={{ display: "block" }}>{handle(plan.withName)} wants to {togetherVerb(plan.place, plan.action)} together at {placeName(plan.place)}</span>
          <span className="meta" style={{ display: "block" }}>{TOGETHER.multiplier}× confidence and clout for both · free</span>
          <span className="meta" style={{ display: "block" }}>{plan.withHere ? "They're there now · " : ""}expires at midnight</span>
        </span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>Not now</button>
        <button className="btn btn-green" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>I&apos;m in</button>
      </div>
    </div>
  );
}

function RideCard({ ride, busy, onAnswer }: { ride: RideRequest; busy: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div className="card date-invite stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={ride.fromStyle} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>Ride together</span>
          <span className="title" style={{ display: "block" }}>{handle(ride.fromName)} wants to ride to {placeName(ride.place)}</span>
          <span className="meta" style={{ display: "block" }}>{ride.mode === "taxi" ? "🚕 Taxi" : "🚇 Subway"} · your half {formatCash(ride.each)} · {ride.seconds} s</span>
          <span className="meta" style={{ display: "block" }}>You arrive together · the offer lasts {TOGETHER.ride.expireMinutes} minutes</span>
        </span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>Not now</button>
        <button className="btn btn-taxi" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>Ride · {formatCash(ride.each)}</button>
      </div>
    </div>
  );
}

/** 2 · Plans: invites and rides to answer, and today's together plans. */
export function TogetherPlansSheet({ open, inbox, busy, onClose, onAnswer, onRide, onOpenPlace }: {
  open: boolean;
  inbox: TogetherInbox | null;
  busy: boolean;
  onClose: () => void;
  onAnswer: (id: number, yes: boolean) => void;
  onRide: (ride: RideRequest, yes: boolean) => void;
  onOpenPlace: (placeId: string) => void;
}) {
  const invites = inbox?.plans.filter((p) => !p.mine && p.status === "pending") ?? [];
  const going = inbox?.plans.filter((p) => p.mine || p.status === "accepted") ?? [];
  return (
    <Sheet open={open} onClose={onClose} label="Plans" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Plans</h2>
          <span className="meta">{inbox ? `${inbox.left} of ${TOGETHER.perDay} together bonuses left today` : "Today, until midnight"}</span>
        </div>
        {inbox?.rides.map((r) => <RideCard key={`r${r.id}`} ride={r} busy={busy} onAnswer={(yes) => onRide(r, yes)} />)}
        {invites.map((p) => <InviteCard key={p.id} plan={p} busy={busy} onAnswer={(yes) => onAnswer(p.id, yes)} />)}
        {invites.length > 0 && (
          <p className="meta" style={{ margin: 0 }}>&ldquo;I&apos;m in&rdquo; opens the place. Doing it within {TOGETHER.windowMinutes} minutes of each other counts.</p>
        )}
        {going.length > 0 && (
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Today</p>
            {going.map((p) => (
              <button key={p.id} className="list-row crew-pick" onClick={() => onOpenPlace(p.place)}>
                <Avatar style={p.withStyle} />
                <PersonText
                  title={`${placeEmoji(p.place)} ${actionLabel(p.place, p.action) || placeName(p.place)}`}
                  meta={`With ${handle(p.withName)} · ${p.status === "pending" ? "waiting for a yes" : p.withHere ? "they're there now" : "both in"}`}
                />
                <ChevronRightIcon size={18} />
              </button>
            ))}
          </div>
        )}
        {invites.length === 0 && going.length === 0 && !inbox?.rides.length && (
          <div className="card stack-4">
            <p className="overline" style={{ margin: 0 }}>No plans yet</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
              Tap 👯 next to studying or a night out to invite someone. {TOGETHER.multiplier}× confidence and clout for both of you.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** 4 · Both did it: the together bonus. */
export function TogetherBonusCard({ bonus, onClose }: { bonus: TogetherBonus; onClose: () => void }) {
  const verb = togetherVerb(bonus.place, bonus.action);
  const past = verb === "study" ? "studied" : verb === "go out" ? "went out" : verb === "catch a lecture" ? "caught a lecture" : "hung out";
  return (
    <div className="modal-wrap" role="dialog" aria-label="Together bonus">
      <div className="scrim" onClick={onClose} />
      <div className="modal-card modal-light stack-12">
        <span className="tag tag-event">👯 Together bonus</span>
        <p className="display-md" style={{ marginBottom: 0 }}>You {past} with {handle(bonus.withName)}</p>
        {bonus.paid ? (
          <div>
            <div className="list-row static"><span style={{ flex: 1 }}>Confidence</span><b>+{bonus.confidenceBase + bonus.confidence} <span className="meta">({bonus.confidenceBase} × {TOGETHER.multiplier})</span></b></div>
            <div className="list-row static"><span style={{ flex: 1 }}>Clout</span><b>+{bonus.cloutBase + bonus.clout} <span className="meta">({bonus.cloutBase} × {TOGETHER.multiplier})</span></b></div>
          </div>
        ) : (
          <p className="body" style={{ margin: 0 }}>You&apos;ve had all {TOGETHER.perDay} together bonuses today. They still got theirs.</p>
        )}
        <p className="meta" style={{ margin: 0 }}>{bonus.paid ? "They got the same. " : ""}{bonus.left} of {TOGETHER.perDay} together bonuses left today.</p>
        <button className="btn btn-taxi" onClick={onClose}>Nice</button>
      </div>
    </div>
  );
}

/** 3 · In Go there: ride with someone here with you. */
export function RideWithRow({ person, on, onToggle }: { person: TogetherCandidate; on: boolean; onToggle: () => void }) {
  return (
    <button className="list-row crew-pick together-ride" aria-pressed={on} onClick={onToggle}>
      <Avatar style={person.style} />
      <PersonText title={`Ride with ${handle(person.name)}`} meta={`${person.crew ? "Crew · " : ""}here · split the fare`} />
      <span className={`crew-check${on ? " on" : ""}`} aria-hidden="true">✓</span>
    </button>
  );
}

/** Waiting for the other rider to accept. */
export function RideWaitCard({ name, mode, each, onCancel }: { name: string; mode: string; each: number; onCancel: () => void }) {
  return (
    <div className="modal-wrap" role="dialog" aria-label="Waiting for your ride">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12">
        <span className="tag tag-event">{mode === "taxi" ? "🚕" : "🚇"} Ride together</span>
        <p className="display-md" style={{ marginBottom: 0 }}>Waiting for {handle(name)}</p>
        <p className="meta" style={{ margin: 0 }}>You each pay {formatCash(each)} when they accept. The offer lasts {TOGETHER.ride.expireMinutes} minutes.</p>
        <button className="btn btn-secondary" onClick={onCancel}>Go without them</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Jobs app
// ---------------------------------------------------------------------------
export interface JobsHandlers {
  busy: string | null;
  take: (id: number) => void;
  post: (kind: "decorator" | "manager", pay: number, cut: number, note: string) => void;
  cancel: (id: number) => void;
  decorate: (id: number) => void;
  collect: (id: number) => void;
  end: (id: number) => void;
  approve: (job: MyJob) => void;
  rate: (id: number, stars: number) => void;
  onPlayer?: (id: string) => void;
  /** Migration 0151: errands and event support, checking the work, rating the client. */
  postTask?: (kind: TaskKind, pay: number, target: JobTarget, hours: number, note: string) => void;
  check?: (id: number) => void;
  rateClient?: (id: number, stars: number) => void;
}

// ---- Migration 0151: game-verified jobs ----
const isTask = (k: string): k is TaskKind => k === "errand" || k === "event";
const eventName = (id?: string) => CLUB_EVENTS.find((e) => e.id === id)?.name ?? "a night out";
const eventPlace = (id?: string) => placeName(CLUB_EVENTS.find((e) => e.id === id)?.placeId ?? "");
const hoursLeft = (at: string | null | undefined) => (at ? Math.max(0, Math.ceil((Date.parse(at) - Date.now()) / 3_600_000)) : 0);
/** "Velvet Static, Grind & Gossip" */
const placeList = (t: JobTarget | null | undefined) => (t?.places ?? []).map(placeName).join(", ");
function jobTitle(kind: string): string {
  return kind === "decorator" ? "Decorate my place" : kind === "manager" ? "Run my tills" : kind === "errand" ? "Run my errands" : "Hype my night out";
}
function jobTag(kind: string): string {
  return kind === "decorator" ? "🛋️ Interior decorator" : kind === "manager" ? "💼 Business manager" : kind === "errand" ? "🧾 Errands" : "🪩 Event support";
}
/** What the task asks, in a line. */
function taskLine(kind: string, t: JobTarget | null | undefined): string {
  if (kind === "errand") return `Check in at ${placeList(t)}`;
  return `Be at ${eventName(t?.event)} (${eventPlace(t?.event)}) while it's on`;
}
/** "You get C$950 after the 5% city fee" (migration 0151), or the plain pay before it. */
const youGet = (pay: number, fee: number | undefined) => (fee != null ? `You get ${formatCash(pay - fee)} after the ${Math.round(PLAYER_ECONOMY.fees.job * 100)}% city fee` : `${formatCash(pay)}`);

function OpenJobCard({ job, h, canWork }: { job: OpenJob; h: JobsHandlers; canWork: boolean }) {
  if (isTask(job.kind)) return <OpenTaskCard job={job} h={h} canWork={canWork} />;
  const decor = job.kind === "decorator";
  const home = ECONOMY.homes.find((x) => x.id === job.homeId)?.neighborhood;
  return (
    <div className="card stack-8">
      <button className="row job-who" style={{ gap: 12 }} onClick={() => h.onPlayer?.(job.poster)} disabled={!h.onPlayer}>
        <Avatar style={job.posterStyle} size={44} />
        <span style={{ minWidth: 0, textAlign: "left" }}>
          <span className="title" style={{ display: "block" }}>{decor ? "Decorate my place" : "Run my tills"}</span>
          <span className="meta">{handle(job.posterName)} · {decor ? home ?? "Queens" : `${job.businesses} ${job.businesses === 1 ? "business" : "businesses"}`}{job.posterRating.rating != null ? ` · ⭐ ${job.posterRating.rating.toFixed(1)}` : ""}</span>
        </span>
      </button>
      <div><span className={`tag ${decor ? "tag-event" : "tag-neutral"}`}>{decor ? "🛋️ Interior decorator" : "💼 Business manager"}</span></div>
      {job.note && <span className="subtext ph-sensitive">&ldquo;{job.note}&rdquo;</span>}
      {decor
        ? <span className="biz-price"><b>{formatCash(job.pay)}</b> + {JOBS.decorator.clout} clout · held until they approve{job.fee != null ? ` · ${youGet(job.pay, job.fee)}` : ""}</span>
        : <span className="biz-price"><b>{job.cut}%</b> of what you collect{job.perDay ? ` · about ${formatCash(job.perDay)} a day` : ""}{job.fee != null ? ` · less the ${Math.round(PLAYER_ECONOMY.fees.job * 100)}% city fee` : ""}</span>}
      <button className={`btn ${decor ? "btn-taxi" : "btn-secondary"}`} disabled={!canWork || h.busy !== null} onClick={() => h.take(job.id)}>
        {h.busy === `take:${job.id}` ? "…" : decor ? `Take the job · ${JOBS.decorator.minutes} min` : "Take the job"}
      </button>
    </div>
  );
}

function OpenTaskCard({ job, h, canWork }: { job: OpenJob; h: JobsHandlers; canWork: boolean }) {
  return (
    <div className="card stack-8">
      <button className="row job-who" style={{ gap: 12 }} onClick={() => h.onPlayer?.(job.poster)} disabled={!h.onPlayer}>
        <Avatar style={job.posterStyle} size={44} />
        <span style={{ minWidth: 0, textAlign: "left" }}>
          <span className="title" style={{ display: "block" }}>{jobTitle(job.kind)}</span>
          <span className="meta">{handle(job.posterName)}{job.friend === false ? " · open board" : ""}{clientLine(job.posterRating) ? ` · ${clientLine(job.posterRating)}` : ""}</span>
        </span>
      </button>
      <div><span className="tag tag-event">{jobTag(job.kind)}</span></div>
      <span className="body">{taskLine(job.kind, job.target)}</span>
      {job.note && <span className="subtext ph-sensitive">&ldquo;{job.note}&rdquo;</span>}
      <span className="biz-price"><b>{formatCash(job.pay)}</b> + {PLAYER_ECONOMY.jobs.clout} clout · {hoursLeft(job.deadline)} h left · the game checks it, then pays</span>
      <span className="meta">{youGet(job.pay, job.fee ?? 0)}.</span>
      <button className="btn btn-taxi" disabled={!canWork || h.busy !== null} onClick={() => h.take(job.id)}>
        {h.busy === `take:${job.id}` ? "…" : "Take the job"}
      </button>
    </div>
  );
}

function WorkingTaskRow({ job, h }: { job: WorkJob; h: JobsHandlers }) {
  const [stars, setStars] = useState(0);
  const live = job.status === "active";
  const done = job.kind === "errand" ? (job.progress?.length ?? 0) : 0;
  const total = job.target?.places?.length ?? 0;
  const line = live
    ? job.kind === "errand" ? `${done} of ${total} check-ins · ${hoursLeft(job.deadline)} h left` : `${eventName(job.target?.event)} · ${hoursLeft(job.deadline)} h left`
    : job.status === "kept" ? `Paid · +${formatCash(job.earned)} after the fee` : "Time ran out";
  return (
    <div className="stack-8">
      <div className="list-row static job-row">
        <Avatar style={job.posterStyle} size={36} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="title one-line">{handle(job.posterName)} · {jobTag(job.kind)}</span>
          <span className="meta one-line">{line}</span>
        </span>
        {live && h.check && <button className="chip" aria-pressed="true" disabled={h.busy !== null} onClick={() => h.check!(job.id)}>{h.busy === `check:${job.id}` ? "…" : "Check"}</button>}
      </div>
      {live && <span className="meta">{taskLine(job.kind, job.target)}. Any activity at a place counts as a check-in.</span>}
      {job.status === "kept" && !job.clientStars && h.rateClient && (
        <div className="row" style={{ gap: 8 }}>
          <span className="meta" style={{ flex: 1 }}>Rate {handle(job.posterName)} as a client</span>
          <Stars value={stars} onPick={(n) => { setStars(n); h.rateClient!(job.id, n); }} small />
        </div>
      )}
    </div>
  );
}

function WorkingRow({ job, h }: { job: WorkJob; h: JobsHandlers }) {
  if (isTask(job.kind)) return <WorkingTaskRow job={job} h={h} />;
  const decor = job.kind === "decorator";
  const live = job.status === "active";
  return (
    <div className="list-row static job-row">
      <Avatar style={job.posterStyle} size={36} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="title one-line">{handle(job.posterName)}</span>
        <span className="meta one-line">{decor ? "🛋️ " : "💼 "}
          {decor
            ? live ? `${minutesLeft(job.endsAt)} minutes left · ${formatCash(job.pay)}` : job.status === "done" ? "Waiting for their approval" : job.status === "kept" ? `Kept · +${formatCash(job.pay)}` : "They undid it"
            : live ? `${job.cut}% · earned ${formatCash(job.earned)}` : `Ended · earned ${formatCash(job.earned)}`}
        </span>
      </span>
      {live && (decor
        ? <button className="chip" aria-pressed="true" disabled={h.busy !== null} onClick={() => h.decorate(job.id)}>Decorate</button>
        : <button className="chip" aria-pressed="true" disabled={h.busy !== null} onClick={() => h.collect(job.id)}>{h.busy === `collect:${job.id}` ? "…" : "Collect"}</button>)}
    </div>
  );
}

function MyTaskRow({ job, h }: { job: MyJob; h: JobsHandlers }) {
  const who = job.workerName ? handle(job.workerName) : null;
  const [stars, setStars] = useState(0);
  const total = job.target?.places?.length ?? 0;
  const line = job.status === "open" ? `${formatCash(job.pay)} held · ${hoursLeft(job.deadline)} h left`
    : job.status === "active" ? (job.kind === "errand" ? `${job.progress?.length ?? 0} of ${total} check-ins` : `${eventName(job.target?.event)} · waiting for them to show`)
    : job.status === "kept" ? `Done · paid ${formatCash(job.pay)}` : job.status === "expired" ? "Time ran out · refunded" : "Cancelled · refunded";
  const rateable = !job.stars && job.worker && job.status === "kept";
  return (
    <div className="stack-8">
      <div className="list-row static job-row">
        {job.workerStyle ? <Avatar style={job.workerStyle} size={36} /> : <span className="biz-em sm" aria-hidden="true">{job.kind === "errand" ? "🧾" : "🪩"}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="title one-line">{who ? `${who} · ${jobTag(job.kind)}` : jobTitle(job.kind)}</span>
          <span className="meta one-line">{line}</span>
        </span>
        {job.status === "open" && <button className="chip" disabled={h.busy !== null} onClick={() => h.cancel(job.id)}>Cancel</button>}
      </div>
      {rateable && (
        <div className="row" style={{ gap: 8 }}>
          <span className="meta" style={{ flex: 1 }}>Rate {who}</span>
          <Stars value={stars} onPick={(n) => { setStars(n); h.rate(job.id, n); }} small />
        </div>
      )}
    </div>
  );
}

function MyJobRow({ job, h }: { job: MyJob; h: JobsHandlers }) {
  if (isTask(job.kind)) return <MyTaskRow job={job} h={h} />;
  const decor = job.kind === "decorator";
  const who = job.workerName ? handle(job.workerName) : null;
  const [stars, setStars] = useState(0);
  const line = job.status === "open" ? (decor ? `${formatCash(job.pay)} held` : `${job.cut}% of the tills`)
    : job.status === "active" ? (decor ? `${minutesLeft(job.endsAt)} minutes left` : `${job.cut}% · they've earned ${formatCash(job.earned)}`)
    : job.status === "done" ? "Done · keep it or undo it"
    : job.status === "kept" ? `Kept · paid ${formatCash(job.pay)}` : job.status === "undone" ? "Undone · refunded" : `Ended · they earned ${formatCash(job.earned)}`;
  const title = job.status === "open" ? (decor ? "Decorator wanted" : "Manager wanted")
    : decor ? `${who} ${job.status === "active" ? "is decorating" : "decorated"}` : `${who} ${job.status === "active" ? "runs your tills" : "ran your tills"}`;
  const rateable = !job.stars && job.worker && (job.status === "kept" || job.status === "undone" || job.status === "ended");
  return (
    <div className="stack-8">
      <div className="list-row static job-row">
        {job.workerStyle ? <Avatar style={job.workerStyle} size={36} /> : <span className="biz-em sm" aria-hidden="true">{decor ? "🛋️" : "💼"}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="title one-line">{title}</span>
          <span className="meta one-line">{line}</span>
        </span>
        {job.status === "open" && <button className="chip" disabled={h.busy !== null} onClick={() => h.cancel(job.id)}>Cancel</button>}
        {job.status === "active" && decor && <span className="tag tag-event">Live</span>}
        {job.status === "active" && !decor && <button className="chip" disabled={h.busy !== null} onClick={() => h.end(job.id)}>Fire</button>}
        {job.status === "done" && <button className="chip" aria-pressed="true" onClick={() => h.approve(job)}>Review</button>}
      </div>
      {rateable && (
        <div className="row" style={{ gap: 8 }}>
          <span className="meta" style={{ flex: 1 }}>Rate {who}</span>
          <Stars value={stars} onPick={(n) => { setStars(n); h.rate(job.id, n); }} small />
        </div>
      )}
    </div>
  );
}

/** Migration 0151: post an errand (2 to 4 places) or event support (a club night), with the pay held and a deadline. */
const ERRAND_PLACES = PLACES.filter((p) => !p.story && (p.borough ?? "queens") === "queens");
function TaskForm({ kind, cash, busy, posted, onPost }: {
  kind: TaskKind; cash: number; busy: string | null; posted: boolean;
  onPost: (kind: TaskKind, pay: number, target: JobTarget, hours: number, note: string) => void;
}) {
  const J = PLAYER_ECONOMY.jobs;
  const [pay, setPay] = useState<number>(J.payChoices[1]);
  const [hours, setHours] = useState<number>(J.hours[1]);
  const [places, setPlaces] = useState<string[]>([]);
  const [event, setEvent] = useState<string>(CLUB_EVENTS[0]?.id ?? "");
  const [note, setNote] = useState("");
  const ready = kind === "errand" ? places.length >= J.errandPlaces.min && places.length <= J.errandPlaces.max : !!event;
  const toggle = (id: string) => setPlaces((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= J.errandPlaces.max ? cur : [...cur, id]));
  return (
    <div className="stack-12">
      {kind === "errand" ? (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Where · {places.length} of {J.errandPlaces.min} to {J.errandPlaces.max}</p>
          <div className="option-chips">
            {ERRAND_PLACES.map((p) => <button key={p.id} className="chip chip-sm" aria-pressed={places.includes(p.id)} onClick={() => toggle(p.id)}>{p.emoji} {p.name}</button>)}
          </div>
        </div>
      ) : (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Which night</p>
          <div className="option-chips">
            {CLUB_EVENTS.map((e) => <button key={e.id} className="chip chip-sm" aria-pressed={event === e.id} onClick={() => setEvent(e.id)}>{e.name} · {placeName(e.placeId)}</button>)}
          </div>
        </div>
      )}
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Pay</p>
        <div className="option-chips together-pay">
          {J.payChoices.map((x) => <button key={x} className="chip" aria-pressed={pay === x} onClick={() => setPay(x)}>{formatCash(x)}</button>)}
        </div>
        <p className="overline" style={{ margin: "4px 0 0" }}>Deadline</p>
        <div className="option-chips">
          {J.hours.map((x) => <button key={x} className="chip chip-sm" aria-pressed={hours === x} onClick={() => setHours(x)}>{x} hours</button>)}
        </div>
        <p className="meta" style={{ margin: "4px 0 0" }}>
          Held by the city until the game sees it done; back to you at the deadline if nobody does. They get {formatCash(afterFee("job", pay))} after
          the {Math.round(PLAYER_ECONOMY.fees.job * 100)}% city fee, plus {J.clout} clout. Your Crew, partner and chats see it (and the open board, if you&apos;re on it).
        </p>
      </div>
      <input className="chat-input job-note ph-sensitive" value={note} maxLength={140} placeholder="A note for them (optional)" onChange={(e) => setNote(e.target.value)} aria-label="A note for them" />
      <button className="btn btn-taxi" disabled={busy !== null || posted || !ready || cash < pay}
        onClick={() => onPost(kind, pay, kind === "errand" ? { places } : { event }, hours, note)}>
        {busy === "post" ? "…" : posted ? "Already posted" : cash < pay ? `${formatCash(pay - cash)} short` : `Post the job · ${formatCash(pay)}`}
      </button>
    </div>
  );
}

export function Stars({ value, onPick, small }: { value: number; onPick: (n: number) => void; small?: boolean }) {
  return (
    <div className={`row together-stars${small ? " sm" : ""}`} style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={n === value} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} className={n <= value ? "on" : ""} onClick={() => onPick(n)}>★</button>
      ))}
    </div>
  );
}

/** 5 and 6 · The Jobs app on the Phone: find work, or hire someone. */
export function JobsApp({ board, cash, hasBusiness, h, onHome, economy }: {
  board: JobsBoard | null;
  cash: number;
  hasBusiness: boolean;
  h: JobsHandlers;
  onHome: () => void;
  /** Migration 0151: the open-board switch. */
  economy?: EconomyApi;
}) {
  const [tab, setTab] = useState<"work" | "hire">("work");
  const [kind, setKind] = useState<"decorator" | "manager" | TaskKind>("decorator");
  const [pay, setPay] = useState<number>(JOBS.decorator.payChoices[2]);
  const [cut, setCut] = useState<number>(JOBS.manager.cutChoices[1]);
  const [note, setNote] = useState("");
  const posted = board?.mine.some((j) => j.kind === kind && (j.status === "open" || j.status === "active" || j.status === "done"));
  const cantPost = kind === "decorator" ? cash < pay : kind === "manager" ? !hasBusiness : false;
  const locked = board?.locked ? (board.locked === "phase_off" ? economyError("phase_off") : lockedLine({ reason: board.locked as "too_new", unlocksAt: "" })) : null;
  return (
    <div className="stack-12">
      <div>
        <button className="phone-back" onClick={onHome}><ChevronLeftIcon size={20} /> Home</button>
        <h2 className="display-lg" style={{ margin: "4px 0 4px" }}>Jobs</h2>
        <p className="subtext" style={{ margin: 0 }}>{tab === "work" ? "Make yourself useful. Get paid, get rated, get clout." : "Post a job; real players take it."}</p>
      </div>
      <div className="row" style={{ gap: 8 }} role="tablist">
        <button className="chip" role="tab" aria-pressed={tab === "work"} onClick={() => setTab("work")}>Find work</button>
        <button className="chip" role="tab" aria-pressed={tab === "hire"} onClick={() => setTab("hire")}>Hire someone</button>
      </div>
      {!board ? <p className="meta">Checking the board…</p> : tab === "work" ? (
        <>
          {board.working.length > 0 && (
            <div className="card stack-4">
              <span className="overline">Your work · {ratingLine(board.rating)}</span>
              {board.working.map((j) => <WorkingRow key={j.id} job={j} h={h} />)}
            </div>
          )}
          {!board.canWork && (
            <p className="meta" style={{ margin: 0 }}>{locked ?? `Jobs open up once your account is ${TOGETHER.minAccountDays} days old.`}</p>
          )}
          {board.open.map((j) => <OpenJobCard key={j.id} job={j} h={h} canWork={board.canWork} />)}
          {board.open.length === 0 && (
            <div className="card stack-4">
              <p className="overline" style={{ margin: 0 }}>No jobs right now</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{board.feeRate != null ? "You see jobs from your Crew, your partner and people you've chatted with. Switch on the open board to see strangers' too." : "Check back later, or post one yourself. Someone always needs a couch moved."}</p>
            </div>
          )}
          {economy && <OpenBoardRow api={economy} />}
        </>
      ) : (
        <>
          <div className="stack-8" role="radiogroup" aria-label="Job">
            <button role="radio" aria-checked={kind === "decorator"} className={`travel-mode${kind === "decorator" ? " on" : ""}`} onClick={() => setKind("decorator")}>
              <span className="travel-mode-emoji" aria-hidden="true">🛋️</span>
              <span className="travel-mode-text"><b>Interior decorator</b><small>Arranges your home · you approve or undo</small></span>
            </button>
            <button role="radio" aria-checked={kind === "manager"} className={`travel-mode${kind === "manager" ? " on" : ""}`} onClick={() => setKind("manager")}>
              <span className="travel-mode-emoji" aria-hidden="true">💼</span>
              <span className="travel-mode-text"><b>Business manager</b><small>{hasBusiness ? "Collects your tills · never touches your cash" : "Buy a business first"}</small></span>
            </button>
            {h.postTask && (
              <>
                <button role="radio" aria-checked={kind === "errand"} className={`travel-mode${kind === "errand" ? " on" : ""}`} onClick={() => setKind("errand")}>
                  <span className="travel-mode-emoji" aria-hidden="true">🧾</span>
                  <span className="travel-mode-text"><b>Errands</b><small>They check in at 2 to 4 places · the game checks</small></span>
                </button>
                <button role="radio" aria-checked={kind === "event"} className={`travel-mode${kind === "event" ? " on" : ""}`} onClick={() => setKind("event")}>
                  <span className="travel-mode-emoji" aria-hidden="true">🪩</span>
                  <span className="travel-mode-text"><b>Event support</b><small>They show up to a club night while it&apos;s on</small></span>
                </button>
              </>
            )}
          </div>
          {isTask(kind) && h.postTask ? (
            <TaskForm kind={kind} cash={cash} busy={h.busy} posted={!!posted} onPost={h.postTask} />
          ) : kind === "decorator" ? (
            <div className="stack-8">
              <p className="overline" style={{ margin: 0 }}>Pay</p>
              <div className="option-chips together-pay">
                {JOBS.decorator.payChoices.map((x) => <button key={x} className="chip" aria-pressed={pay === x} onClick={() => setPay(x)}>{formatCash(x)}</button>)}
              </div>
              <p className="meta" style={{ margin: "4px 0 0" }}>Held by the city and paid when you approve (or after {JOBS.decorator.autoKeepHours} hours). Plus {JOBS.decorator.clout} clout for them.{h.postTask ? ` They get ${formatCash(afterFee("job", pay))} after the ${Math.round(PLAYER_ECONOMY.fees.job * 100)}% city fee.` : ""}</p>
            </div>
          ) : (
            <div className="stack-8">
              <p className="overline" style={{ margin: 0 }}>Their cut</p>
              <div className="option-chips together-pay">
                {JOBS.manager.cutChoices.map((x) => <button key={x} className="chip" aria-pressed={cut === x} onClick={() => setCut(x)}>{x}%</button>)}
              </div>
              <p className="meta" style={{ margin: "4px 0 0" }}>Of every till they collect. The rest goes straight to you. Fire them any time.</p>
            </div>
          )}
          {!isTask(kind) && (
            <>
              <input className="chat-input job-note" value={note} maxLength={140} placeholder="A note for them (optional)" onChange={(e) => setNote(e.target.value)} aria-label="A note for them" />
              <button className="btn btn-taxi" disabled={h.busy !== null || !!posted || cantPost} onClick={() => h.post(kind, kind === "decorator" ? pay : 0, kind === "manager" ? cut : 0, note)}>
                {h.busy === "post" ? "…" : posted ? "Already posted" : kind === "decorator" ? (cash < pay ? `${formatCash(pay - cash)} short` : `Post the job · ${formatCash(pay)}`) : "Post the job"}
              </button>
            </>
          )}
          {board.mine.length > 0 && (
            <div className="card stack-4">
              <span className="overline">Your jobs</span>
              {board.mine.map((j) => <MyJobRow key={j.id} job={j} h={h} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The decorator at work in someone else's home: who, the clock, and done. */
export function DecoratingBar({ name, endsAt, pay, busy, onDone, onLeave }: { name: string; endsAt: string; pay: number; busy: boolean; onDone: () => void; onLeave: () => void }) {
  const left = minutesLeft(endsAt);
  return (
    <div className="viewing-bar decor-bar" role="group" aria-label={`Decorating ${name}'s place`}>
      <span style={{ minWidth: 0 }}>
        <b>🛋️ {handle(name)}&apos;s place</b>
        <small>{left > 0 ? `${left} min left · ${formatCash(pay)}` : "Time's up"}</small>
      </span>
      <button className="chip" onClick={onLeave}>Leave</button>
      <button className="chip" aria-pressed="true" disabled={busy} onClick={onDone}>I&apos;m done</button>
    </div>
  );
}

/** 7 · The decorator finished: keep it or undo it all, and rate. */
export function DecorApproveCard({ job, busy, onSettle, onLater }: { job: MyJob; busy: boolean; onSettle: (keep: boolean, stars: number | null) => void; onLater: () => void }) {
  const [stars, setStars] = useState(0);
  const mins = job.takenAt && job.finishedAt ? Math.max(1, Math.round((new Date(job.finishedAt).getTime() - new Date(job.takenAt).getTime()) / 60000)) : null;
  return (
    <div className="modal-wrap" role="dialog" aria-label="Decorating done">
      <div className="scrim" onClick={onLater} />
      <div className="modal-card modal-light stack-12">
        <span className="tag tag-event">🛋️ Decorating done</span>
        <div className="row" style={{ gap: 12 }}>
          {job.workerStyle && <Avatar style={job.workerStyle} size={44} />}
          <span style={{ minWidth: 0 }}>
            <span className="title" style={{ display: "block" }}>{handle(job.workerName)} rearranged your place</span>
            <span className="meta">{job.moved} {job.moved === 1 ? "piece" : "pieces"} moved{mins ? ` · ${mins} minutes` : ""}</span>
            <span className="meta" style={{ display: "block" }}>{ratingLine(job.workerRating)}</span>
          </span>
        </div>
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>Rate the job</p>
          <Stars value={stars} onPick={setStars} />
        </div>
        <p className="meta" style={{ margin: 0 }}>Keep it and they get {formatCash(job.pay)} and {JOBS.decorator.clout} clout. Undo puts every piece back, free.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy} onClick={() => onSettle(false, stars || null)}>Undo it all</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} disabled={busy} onClick={() => onSettle(true, stars || null)}>{busy ? "…" : "Keep it"}</button>
        </div>
        <button className="linkish" onClick={onLater} style={{ alignSelf: "center" }}>Look at it first</button>
      </div>
    </div>
  );
}

