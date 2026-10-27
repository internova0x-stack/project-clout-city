"use client";

import { useState } from "react";
import { ECONOMY, formatCash } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { handle } from "@/lib/validation";
import {
  dayLine, daysUntil, endedLine, hostBlockLine, ratingLine,
  type SubletListing, type SubletLive, type SubletMine, type SubletState,
} from "@/lib/sublets";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { Toggle } from "../Toggle";

// Sublets, phase 1 (migration 0119, owner Oct 26; spec section 25): Apartments → Sublets. Rooms on offer, a listing and
// applying, listing my spare room and answering applications, the live sublet (either side: rent, deposit, roommate hang,
// renewing, notice, leaving) and the rating card once it's over. The server checks every rule.

export interface SubletHandlers {
  busy: boolean;
  error: string | null;
  list: (rent: number, minWeeks: number, maxWeeks: number, note: string) => void;
  unlist: () => void;
  apply: (listing: number, weeks: number, note: string) => void;
  withdraw: (listing: number) => void;
  answer: (app: number, yes: boolean) => void;
  notice: (on: boolean) => void;
  leave: () => void;
  renew: (weeks: number) => void;
  renewAnswer: (yes: boolean) => void;
  hang: () => void;
  show: (on: boolean) => void;
  rate: (sublet: number, stars: number) => void;
  seen: (sublet: number) => void;
  /** The subtenant goes to their room (the Home tab shows the host's place). */
  onSeeHome: () => void;
}

const home = (id: string) => ECONOMY.homes.find((h) => h.id === id);
const nyToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

function Face({ style, size = 36 }: { style: string; size?: number }) {
  return <span className="date-avatar" style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{getStyle(style as StyleId).emoji}</span>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <span className={strong ? "body-strong" : "body"} style={{ flex: 1 }}>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Stars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div className="row together-stars" style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={n === value} className={n <= value ? "on" : ""} onClick={() => onPick(n)}>★</button>)}
    </div>
  );
}

export function SubletsApp({ state, myHomeId, bank, h }: {
  state: SubletState | null; myHomeId: string | null; bank: number; h: SubletHandlers;
}) {
  const [view, setView] = useState<{ kind: "list" } | { kind: "listing"; id: number } | { kind: "form" }>({ kind: "list" });
  if (!state) return <p className="meta">Loading…</p>;
  const err = h.error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{h.error}</p>;

  if (view.kind === "listing") {
    const l = state.listings.find((x) => x.id === view.id);
    if (l) return <ListingView l={l} myHomeId={myHomeId} bank={bank} h={h} err={err} onBack={() => setView({ kind: "list" })} />;
  }
  if (view.kind === "form" && state.bounds && !state.live) {
    return <ListForm state={state} mine={state.mine} h={h} err={err} onBack={() => setView({ kind: "list" })} onDone={() => setView({ kind: "list" })} />;
  }

  const block = hostBlockLine(state.hostBlock);
  return (
    <div className="stack-12">
      {err}
      {state.ended && <EndedCard e={state.ended} h={h} />}
      {state.live ? (
        state.live.role === "sub" ? <LiveSub s={state.live} h={h} /> : <LiveHost s={state.live} h={h} noticeDays={state.rules.noticeDays} />
      ) : (
        <>
          <p className="subtext" style={{ margin: 0 }}>
            A spare room in someone&apos;s place. Half the rent at most, no broker fee, no clout rule. Your own lease waits for you.
          </p>
          {state.mine ? <MyListing m={state.mine} h={h} onEdit={() => setView({ kind: "form" })} /> : (
            <button className="list-row" disabled={!!block} onClick={() => setView({ kind: "form" })}>
              <span style={{ fontSize: 24 }} aria-hidden="true">🔑</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>List your spare room</span>
                <span className="meta">{block ?? `Let a room in your place for ${formatCash(state.bounds?.[0] ?? 0)} to ${formatCash(state.bounds?.[1] ?? 0)} a week.`}</span>
              </span>
              {!block && <ChevronRightIcon size={16} />}
            </button>
          )}
          {!state.mine && (state.listings.length ? state.listings.map((l) => (
            <ListingCard key={l.id} l={l} onView={() => setView({ kind: "listing", id: l.id })} />
          )) : (
            <div className="card stack-4">
              <p className="overline" style={{ margin: 0 }}>No rooms right now</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Nobody&apos;s letting a room today. Check back, or ask your crew. Someone always has a cousin.</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ListingCard({ l, onView }: { l: SubletListing; onView: () => void }) {
  const hm = home(l.homeId);
  const skip = hm?.moveClout ? `No ${hm.moveClout.toLocaleString("en-US")} clout rule` : null;
  return (
    <div className="card apt-card stack-8">
      <div className="row" style={{ gap: 12 }}>
        <span className="apt-emoji" aria-hidden="true">{hm?.emoji ?? "🏠"}</span>
        <span style={{ minWidth: 0 }}>
          <span className="title" style={{ display: "block" }}>Room in {hm?.name ?? "a home"}</span>
          <span className="meta">{hm?.neighborhood} · {formatCash(l.rent)} a week · {weeksRange(l.minWeeks, l.maxWeeks)}</span>
        </span>
      </div>
      {(l.crewOnly || skip || l.applied) && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {l.applied && <span className="tag tag-neutral">Applied</span>}
          {l.crewOnly && <span className="tag tag-event">Crew first</span>}
          {skip && <span className="tag tag-positive">{skip}</span>}
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <Face style={l.host.style} size={28} />
        <span className="meta" style={{ flex: 1, minWidth: 0 }}>{handle(l.host.name)} · {ratingLine(l.host.rating)}</span>
        <button className="btn btn-taxi btn-sm" onClick={onView}>View</button>
      </div>
    </div>
  );
}

const weeksRange = (a: number, b: number) => (a === b ? `${a} week${a === 1 ? "" : "s"}` : `${a} to ${b} weeks`);

function ListingView({ l, myHomeId, bank, h, err, onBack }: {
  l: SubletListing; myHomeId: string | null; bank: number; h: SubletHandlers; err: React.ReactNode; onBack: () => void;
}) {
  const [weeks, setWeeks] = useState(Math.min(Math.max(l.minWeeks, 4), l.maxWeeks));
  const [note, setNote] = useState("");
  const hm = home(l.homeId);
  const mine = home(myHomeId ?? "");
  const due = l.rent * 2;
  return (
    <div className="stack-16">
      <button className="link-btn row" style={{ gap: 4, textDecoration: "none" }} onClick={onBack}><ChevronLeftIcon size={16} /> Sublets</button>
      <div className="row" style={{ gap: 12 }}>
        <span className="apt-emoji" aria-hidden="true">{hm?.emoji ?? "🏠"}</span>
        <span style={{ minWidth: 0 }}>
          <span className="title" style={{ display: "block", fontSize: 20 }}>Room in {hm?.name ?? "a home"}</span>
          <span className="meta">{hm?.neighborhood}{hm?.moveClout ? ` · skips the ${hm.moveClout.toLocaleString("en-US")} clout rule` : ""}</span>
        </span>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <Face style={l.host.style} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="title" style={{ display: "block" }}>Hosted by {handle(l.host.name)}</span>
          <span className="meta ph-sensitive">{ratingLine(l.host.rating)}{l.note ? ` · “${l.note}”` : ""}</span>
        </span>
      </div>
      {!l.applied && (
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>How long</p>
          <div className="chip-row">
            {Array.from({ length: l.maxWeeks - l.minWeeks + 1 }, (_, i) => l.minWeeks + i).map((w) => (
              <button key={w} className="chip" aria-pressed={w === weeks} onClick={() => setWeeks(w)}>{w} week{w === 1 ? "" : "s"}</button>
            ))}
          </div>
        </div>
      )}
      <div className="card stack-4">
        <Line label="First week's rent" value={formatCash(l.rent)} />
        <Line label="Deposit (always comes back)" value={formatCash(l.rent)} />
        <Line label="Due if they say yes" value={formatCash(due)} strong />
        <span className="meta" style={{ display: "block" }}>
          Then {formatCash(l.rent)} every 7 days, ahead. {mine ? `Your ${mine.name.toLowerCase().startsWith("room") ? "room share" : mine.name} is held while you're away, no rent there.` : "Your own place is held, no rent there."}
        </span>
      </div>
      <div className="crew-bonus">🛏️ You get the second bed. 🤝 Hang out at home on the same day for +10 clout each.</div>
      {err}
      {l.applied ? (
        <>
          <div className="card stack-4"><span className="body-strong" style={{ display: "block" }}>Applied</span><span className="meta">Waiting on {handle(l.host.name)}. Nothing is charged until they say yes.</span></div>
          <button className="btn btn-secondary" disabled={h.busy} onClick={() => h.withdraw(l.id)}>Withdraw</button>
        </>
      ) : (
        <>
          <label className="field">
            <input value={note} maxLength={140} placeholder="A note to the host (optional)" onChange={(e) => setNote(e.target.value)} aria-label="Note to the host" />
          </label>
          <button className="btn btn-taxi" disabled={h.busy || bank < due} onClick={() => h.apply(l.id, weeks, note)}>
            {bank < due ? `${formatCash(due - bank)} short` : `Apply to ${handle(l.host.name)}`}
          </button>
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>Nothing is charged until they accept.</p>
        </>
      )}
    </div>
  );
}

function ListForm({ state, mine, h, err, onBack, onDone }: {
  state: SubletState; mine: SubletMine | null; h: SubletHandlers; err: React.ReactNode; onBack: () => void; onDone: () => void;
}) {
  const [lo, hi] = state.bounds!;
  const [rent, setRent] = useState(mine?.rent ?? Math.round((lo + hi) / 2 / 5) * 5);
  const [minW, setMinW] = useState(mine?.minWeeks ?? 2);
  const [maxW, setMaxW] = useState(mine?.maxWeeks ?? 6);
  const [note, setNote] = useState(mine?.note ?? "");
  const weeks = Array.from({ length: state.rules.maxWeeks - state.rules.minWeeks + 1 }, (_, i) => state.rules.minWeeks + i);
  const pick = (w: number) => {
    // Tapping outside the range stretches it; tapping inside makes that the shortest.
    if (w < minW) setMinW(w);
    else if (w > maxW) setMaxW(w);
    else if (w === minW && w === maxW) return;
    else { setMinW(w); if (maxW < w) setMaxW(w); }
  };
  const hm = home(mine?.homeId ?? "");
  const myRent = hi * 2;
  return (
    <div className="stack-16">
      <button className="link-btn row" style={{ gap: 4, textDecoration: "none" }} onClick={onBack}><ChevronLeftIcon size={16} /> Sublets</button>
      <div className="stack-4">
        <span className="title" style={{ display: "block", fontSize: 20 }}>{mine ? "Your listing" : "List your spare room"}</span>
        <span className="subtext">{hm ? `${hm.emoji} ${hm.name} · ` : ""}your rent about {formatCash(myRent)} a week</span>
      </div>
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Weekly rent</p>
        <div className="row" style={{ gap: 12 }}>
          <input type="range" min={lo} max={hi} step={1} value={rent} style={{ flex: 1 }} aria-label="Weekly rent" onChange={(e) => setRent(Number(e.target.value))} />
          <b style={{ minWidth: 64, textAlign: "right" }}>{formatCash(rent)}</b>
        </div>
        <span className="meta">{formatCash(lo)} to {formatCash(hi)}: a quarter to half your rent. That&apos;s the law. Well, ours.</span>
      </div>
      <div className="stack-4">
        <p className="overline" style={{ margin: 0 }}>Stays of</p>
        <div className="chip-row">
          {weeks.map((w) => <button key={w} className="chip" aria-pressed={w >= minW && w <= maxW} onClick={() => pick(w)}>{w}w</button>)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="meta" style={{ flex: 1 }}>{weeksRange(minW, maxW)}. Renewable if you both want.</span>
          {minW !== maxW && <button className="link-btn" onClick={() => setMaxW(minW)}>Just {minW}</button>}
        </div>
      </div>
      <label className="field">
        <input value={note} maxLength={state.rules.noteMax} placeholder="House rules, vibes, the cat (optional)" onChange={(e) => setNote(e.target.value)} aria-label="A note on the listing" />
      </label>
      {!mine && <div className="crew-bonus">👯 Your crew sees it first for {state.rules.crewHours} hours, then everyone in the city.</div>}
      <div className="card stack-4">
        <span className="body-strong" style={{ display: "block" }}>What you get</span>
        <span className="meta" style={{ display: "block" }}>{formatCash(rent)} every 7 days, paid ahead. A one-week deposit is held by the game and goes back to them in full.</span>
        <span className="meta" style={{ display: "block" }}>They sleep in the second bed and can&apos;t move your furniture.</span>
      </div>
      {err}
      <button className="btn btn-taxi" disabled={h.busy} onClick={() => { h.list(rent, minW, maxW, note); onDone(); }}>{mine ? "Save" : "List it"}</button>
    </div>
  );
}

function MyListing({ m, h, onEdit }: { m: SubletMine; h: SubletHandlers; onEdit: () => void }) {
  const crewLeft = Math.ceil((Date.parse(m.crewUntil) - Date.now()) / 3600e3);
  return (
    <div className="stack-12">
      <div className="card stack-8">
        <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>🔑 Your spare room</span>
        <span className="title" style={{ display: "block" }}>{formatCash(m.rent)} a week · {weeksRange(m.minWeeks, m.maxWeeks)}</span>
        <span className="meta">{crewLeft > 0 ? `Your crew only, for ${crewLeft} more hour${crewLeft === 1 ? "" : "s"}` : "Listed for everyone in the city"}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onEdit}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={h.unlist}>Take it down</button>
        </div>
      </div>
      <p className="overline" style={{ margin: 0 }}>{m.apps.length ? `${m.apps.length} application${m.apps.length === 1 ? "" : "s"}` : "No applications yet"}</p>
      {m.apps.map((a) => (
        <div key={a.id} className="card stack-8">
          <div className="row" style={{ gap: 10 }}>
            <Face style={a.from.style} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>{handle(a.from.name)}</span>
              <span className="meta">{ratingLine(a.from.rating)} · {a.from.days} days in the city · {a.weeks} week{a.weeks === 1 ? "" : "s"}</span>
            </span>
          </div>
          {a.note && <span className="body ph-sensitive" style={{ color: "var(--text-2)" }}>&ldquo;{a.note}&rdquo;</span>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.answer(a.id, false)}>Decline</button>
            <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.answer(a.id, true)}>Accept</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renewing: answer the other side's ask, wait on mine, or ask (pick how many more weeks). */
function Renew({ s, h }: { s: SubletLive; h: SubletHandlers }) {
  const [asking, setAsking] = useState(false);
  if (s.noticeEnd) return null;
  if (s.renew && !s.renew.mine) {
    return (
      <div className="stack-8">
        <span className="body-strong" style={{ display: "block" }}>{handle(s.with.name)} wants {s.renew.weeks} more week{s.renew.weeks === 1 ? "" : "s"}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.renewAnswer(false)}>No thanks</button>
          <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.renewAnswer(true)}>Renew</button>
        </div>
      </div>
    );
  }
  if (s.renew?.mine) return <span className="meta">Asked to renew for {s.renew.weeks} more week{s.renew.weeks === 1 ? "" : "s"}. Waiting on {handle(s.with.name)}.</span>;
  if (!asking) return <button className="btn btn-secondary btn-sm" onClick={() => setAsking(true)}>Ask to renew</button>;
  return (
    <div className="stack-4">
      <p className="overline" style={{ margin: 0 }}>Renew for</p>
      <div className="chip-row">
        {[1, 2, 3, 4].map((w) => <button key={w} className="chip" disabled={h.busy} onClick={() => { setAsking(false); h.renew(w); }}>{w} more week{w === 1 ? "" : "s"}</button>)}
      </div>
    </div>
  );
}

function HangRow({ s, h }: { s: SubletLive; h: SubletHandlers }) {
  return (
    <button className="list-row" disabled={h.busy || s.hangToday} onClick={h.hang}>
      <span style={{ fontSize: 24 }} aria-hidden="true">🤝</span>
      <span style={{ flex: 1, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>{s.hangToday ? (s.hangOther ? "Hung out today" : "Waiting on your roommate") : "Roommate hang"}</span>
        <span className="meta">
          {s.hangToday && s.hangOther ? "Same again tomorrow."
            : s.hangOther ? `${handle(s.with.name)} is up for it. Tap for +10 clout each.` : "Both tap it today: +10 clout each, once a day."}
        </span>
      </span>
    </button>
  );
}

function ShowToggle({ s, h }: { s: SubletLive; h: SubletHandlers }) {
  return (
    <div className="couple-toggle">
      <span style={{ flex: 1 }}>
        <span className="body-strong" style={{ display: "block" }}>Show it on my card</span>
        <span className="meta">{s.role === "sub" ? `“🏠 Subletting from ${handle(s.with.name)}”` : `“🔑 Hosting ${handle(s.with.name)}”`}</span>
      </span>
      <Toggle on={s.shown} label="Show the sublet on my card" disabled={h.busy} onChange={() => h.show(!s.shown)} />
    </div>
  );
}

function LiveSub({ s, h }: { s: SubletLive; h: SubletHandlers }) {
  const [confirm, setConfirm] = useState(false);
  const hm = home(s.homeId);
  const left = s.noticeEnd ? daysUntil(s.noticeEnd, nyToday()) : null;
  return (
    <div className="card stack-12">
      <span className="tag tag-positive" style={{ alignSelf: "flex-start" }}>🏠 Subletting</span>
      <div className="row" style={{ gap: 12 }}>
        <span className="apt-emoji" aria-hidden="true">{hm?.emoji ?? "🏠"}</span>
        <span style={{ minWidth: 0 }}>
          <span className="title" style={{ display: "block" }}>Room in {handle(s.with.name)}&apos;s {hm?.name ?? "place"}</span>
          <span className="meta">Week {s.week} of {s.weeks} · ends {dayLine(s.noticeEnd && s.noticeEnd < s.end ? s.noticeEnd : s.end)}</span>
        </span>
      </div>
      {left !== null && <span className="meta locked">{handle(s.with.name)} gave notice: {left} day{left === 1 ? "" : "s"} left. Your deposit comes back in full.</span>}
      <div className="stack-4">
        {s.nextRent && <Line label={`Next rent · ${dayLine(s.nextRent).split(",")[0]}`} value={formatCash(s.rent)} />}
        <Line label="Deposit held" value={formatCash(s.deposit)} />
        <Line label="Your own place" value="Held, no rent" />
      </div>
      <button className="btn btn-secondary btn-sm" onClick={h.onSeeHome}>Go to your room</button>
      <HangRow s={s} h={h} />
      <Renew s={s} h={h} />
      <ShowToggle s={s} h={h} />
      {confirm ? (
        <div className="stack-8">
          <span className="body-strong" style={{ display: "block" }}>Move out now?</span>
          <span className="meta">Your {formatCash(s.deposit)} deposit comes back and you go home to your own place.</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setConfirm(false)}>Stay</button>
            <button className="btn btn-destructive btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => { setConfirm(false); h.leave(); }}>Move out</button>
          </div>
        </div>
      ) : (
        <button className="link-btn" onClick={() => setConfirm(true)}>Leave early</button>
      )}
    </div>
  );
}

function LiveHost({ s, h, noticeDays }: { s: SubletLive; h: SubletHandlers; noticeDays: number }) {
  const [confirm, setConfirm] = useState(false);
  const left = s.noticeEnd ? daysUntil(s.noticeEnd, nyToday()) : null;
  return (
    <div className="stack-12">
      <div className="card stack-12">
        <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>🔑 Hosting</span>
        <div className="row" style={{ gap: 12 }}>
          <Face style={s.with.style} size={44} />
          <span style={{ minWidth: 0 }}>
            <span className="title" style={{ display: "block" }}>{handle(s.with.name)} is in your spare room</span>
            <span className="meta">Week {s.week} of {s.weeks} · {formatCash(s.rent)} a week to you</span>
          </span>
        </div>
        {s.nextRent && <Line label={`Next rent in · ${dayLine(s.nextRent).split(",")[0]}`} value={formatCash(s.rent)} />}
        <HangRow s={s} h={h} />
        <Renew s={s} h={h} />
        <ShowToggle s={s} h={h} />
        <span className="meta">Moving out of your place ends the sublet; their deposit goes back to them.</span>
      </div>
      {left !== null ? (
        <div className="card stack-8">
          <span className="title" style={{ display: "block" }}>Notice given</span>
          <div className="row" style={{ gap: 6 }} aria-hidden="true">
            {Array.from({ length: noticeDays }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i < noticeDays - left ? "var(--night-900)" : "var(--chip-off)" }} />
            ))}
          </div>
          <span className="meta">{left} day{left === 1 ? "" : "s"} left. They move out {dayLine(s.noticeEnd!)} and get their deposit back.</span>
          <button className="btn btn-secondary btn-sm" disabled={h.busy} onClick={() => h.notice(false)}>Take back the notice</button>
        </div>
      ) : confirm ? (
        <div className="card stack-8">
          <span className="body-strong" style={{ display: "block" }}>Give {handle(s.with.name)} {noticeDays} days&apos; notice?</span>
          <span className="meta">They keep the room for {noticeDays} more days (rent paid ahead still counts), then the deposit goes back to them.</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setConfirm(false)}>Never mind</button>
            <button className="btn btn-destructive btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => { setConfirm(false); h.notice(true); }}>Give notice</button>
          </div>
        </div>
      ) : (
        <button className="link-btn" onClick={() => setConfirm(true)}>Give notice</button>
      )}
    </div>
  );
}

function EndedCard({ e, h }: { e: NonNullable<SubletState["ended"]>; h: SubletHandlers }) {
  const [stars, setStars] = useState(0);
  return (
    <div className="card stack-8">
      <span className="title" style={{ display: "block" }}>{endedLine(e)}</span>
      {e.role === "sub" && <span className="meta">Your {formatCash(e.deposit)} deposit is back in the bank. You&apos;re home.</span>}
      <span className="body-strong" style={{ display: "block" }}>Rate {handle(e.with.name)}</span>
      <Stars value={stars} onPick={setStars} />
      <span className="meta">Ratings show on listings and applications.</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.seen(e.id)}>Skip</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={h.busy || !stars} onClick={() => h.rate(e.id, stars)}>Rate</button>
      </div>
    </div>
  );
}

/** The bar over the host's home while the subtenant is in their room. */
export function SubletHomeBar({ hostName, mine, onToggle }: { hostName: string; mine: boolean; onToggle: () => void }) {
  return (
    <div className="viewing-bar glass-hud" role="group" aria-label="Sublet">
      <span style={{ minWidth: 0 }}>
        <b>{mine ? "🏡 Your own place" : `🏠 ${handle(hostName)}'s place`}</b>
        <small>{mine ? "Held while you sublet. No rent here." : "Your room, their furniture. Hands off the throw pillows."}</small>
      </span>
      <button className="chip" onClick={onToggle}>{mine ? "Back to the sublet" : "Your place"}</button>
    </div>
  );
}

