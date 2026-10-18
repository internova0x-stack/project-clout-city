"use client";

import { useEffect, useState } from "react";
import { placeById } from "@/lib/city";
import { formatCash } from "@/lib/economy";
import { dateSpotName, type CrushStatus, type DateCandidate, type DateNight, type DatePerson, type DatingApi, type DatingInbox } from "@/lib/dating";
import { getStyle, type StyleId } from "@/lib/styles";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { handle } from "@/lib/validation";

// Crushes and date nights (Clarifications section 14, Design Guide C40 and C41).
// Copy stays gender-neutral everywhere; nothing one-sided is ever shown.

const emoji = (style: string) => getStyle(style as StyleId).emoji;

function Avatar({ style, lit = true, size = 40 }: { style: string; lit?: boolean; size?: number }) {
  return (
    <span className={`date-avatar${lit ? "" : " dim"}`} style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">
      {emoji(style)}
    </span>
  );
}

/** C40: the outline heart. Fills neon when saved; never says if they crushed back unless it's mutual. */
export function CrushButton({ status, busy, onToggle, showCount = true }: {
  status: CrushStatus; busy: boolean; onToggle: (on: boolean) => void; showCount?: boolean;
}) {
  if (!status.eligible && !status.crushed) return null;
  const label = status.matched ? "It's mutual" : status.crushed ? "Crush saved" : "Crush";
  return (
    <span className="crush-wrap">
      <button
        className={`icon-round crush-btn${status.crushed ? " on" : ""}`}
        aria-pressed={status.crushed}
        aria-label={status.crushed ? "Take back crush" : "Mark as a crush"}
        disabled={busy}
        onClick={() => onToggle(!status.crushed)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
            fill={status.crushed ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
      {showCount && <span className="meta">{label} · {status.count} of {status.max} crushes</span>}
    </span>
  );
}

/** C40: the "It's mutual 👀" reveal. Both players get it. */
export function MutualCard({ me, them, onPlan, onSayHi }: { me: string; them: DatePerson; onPlan: () => void; onSayHi: () => void }) {
  return (
    <div className="reveal-card mutual-card stack-16">
      <div className="mutual-pair">
        <Avatar style={me} size={64} />
        <span className="mutual-heart" aria-hidden="true">💗</span>
        <Avatar style={them.style} size={64} />
      </div>
      <div className="stack-4">
        <h2 className="display-md" style={{ margin: 0, color: "#fff" }}>It&apos;s mutual 👀</h2>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.82)" }}>
          You and {them.name} both picked each other. Nobody else knows. Yet.
        </p>
      </div>
      <button className="btn btn-taxi" onClick={onPlan}>Plan a date night</button>
      <button className="btn btn-secondary" onClick={onSayHi}>Say hi</button>
    </div>
  );
}

/** C41 receiving: who, where, the price, and "Expires at midnight". */
export function DateInviteCard({ date, busy, onAnswer }: { date: DateNight; busy: boolean; onAnswer: (yes: boolean) => void }) {
  const where = dateSpotName(date.kind, date.target);
  const place = placeById(date.placeId);
  return (
    <div className="date-invite card stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={date.with.style} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>{date.matched ? "Date night · Matched" : "Date night"}</span>
          <span className="title" style={{ display: "block" }}>{date.with.name} wants to meet at {where}</span>
          <span className="meta" style={{ display: "block" }}>
            {place && date.kind === "event" ? `${place.name} · ` : ""}{date.price > 0 ? <>You each pay your own way · <span className="tabular">{formatCash(date.price)}</span></> : "A study date. Free, unless you count the vending machine."}
          </span>
          <span className="meta" style={{ display: "block" }}>Expires at midnight</span>
        </span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>Not tonight</button>
        <button className="btn btn-green" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>I&apos;m in</button>
      </div>
    </div>
  );
}

/** C41 status: grey until each one goes, both lit once both have; then the bonus shows. */
export function DateStatusRow({ me, date, bonus, onCancel }: {
  me: string; date: DateNight; bonus: DatingInbox["bonus"]; onCancel?: () => void;
}) {
  const where = dateSpotName(date.kind, date.target);
  const line = date.status === "declined"
    ? `${date.with.name} can't make it tonight.`
    : date.paid
      ? "You both pulled up. Look at you two."
      : date.status === "pending"
        ? `Waiting on ${date.with.name}. Expires at midnight.`
        : date.iWent
          ? `You're there. Waiting on ${date.with.name}.`
          : date.theyWent
            ? `Your date is already at ${where}.`
            : `Your date is pulling up to ${where} tonight.`;
  return (
    <div className={`date-status${date.paid ? " done" : ""}`}>
      <span className="date-pair" aria-label={`${date.iWent ? "You went" : "You haven't gone"}, ${date.theyWent ? `${date.with.name} went` : `${date.with.name} hasn't gone`}`}>
        <Avatar style={me} lit={date.iWent} size={30} />
        <Avatar style={date.with.style} lit={date.theyWent} size={30} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="body-strong" style={{ display: "block" }}>{date.with.name} · {where}</span>
        <span className="meta" style={{ display: "block" }}>{line}</span>
      </span>
      {date.paid ? (
        <span className="date-bonus">🙂 +{bonus.mood} · 🔥 +{bonus.clout}</span>
      ) : date.mine && date.status !== "declined" && onCancel ? (
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Call off</button>
      ) : null}
    </div>
  );
}

/** C41 sending: pick a crush or a friend for this spot tonight. */
export function DateSheet({ spot, api, onClose, onSent, onInviteFriend, onCrushInvite }: {
  spot: { kind: "place" | "event"; target: string; price: number } | null;
  api: DatingApi;
  onClose: () => void;
  onSent: (text: string) => void;
  /** #5: with nobody to ask, the sheet offers these instead of a dead end. */
  onInviteFriend: () => void;
  onCrushInvite: () => void;
}) {
  const [people, setPeople] = useState<DateCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!spot) return;
    setPeople(null);
    setError(null);
    void api.candidates().then((r) => setPeople(r.ok ? r.data : []));
  }, [spot, api]);
  if (!spot) return <Sheet open={false} onClose={onClose} label="Make it a date"><span /></Sheet>;
  const where = dateSpotName(spot.kind, spot.target);
  const ask = async (p: DateCandidate) => {
    setBusy(p.id);
    setError(null);
    const r = await api.invite(p.id, spot.kind, spot.target);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onSent(`Invite sent. ${p.name} has until midnight.`);
  };
  return (
    <Sheet open onClose={onClose} label="Make it a date">
      <div className="stack-16">
        <div className="stack-4">
          <h2 className="display-md" style={{ margin: 0 }}>Make it a date</h2>
          <p className="subtext" style={{ margin: 0 }}>
            {where} tonight · {spot.price > 0 ? <><span className="tabular">{formatCash(spot.price)}</span> each</> : "free"}. Go whenever you&apos;re on; once you both have, you both get a little glow.
          </p>
        </div>
        {error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-600, #C8323A)" }}>{error}</p>}
        {people === null && <p className="meta">Checking who&apos;s free…</p>}
        {people?.length === 0 && (
          <div className="card stack-4">
            <p className="overline" style={{ margin: 0 }}>Nobody to ask yet</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Dates are for people you know: your crew, or someone you&apos;ve actually chatted with. Invite a friend to your crew, or send your crush an invite to Clout City.</p>
          </div>
        )}
        <div className="stack-8">
          {people?.map((p) => (
            <button key={p.id} className="list-row" disabled={busy !== null} onClick={() => void ask(p)}>
              <Avatar style={p.style} size={40} />
              <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{handle(p.name)}</span>
                <span className="meta">{p.matched ? "💗 Matched" : p.crush ? "Your crush" : "Friend"}</span>
              </span>
              <span className="meta">{busy === p.id ? "Sending…" : "Ask"}</span>
            </button>
          ))}
        </div>
        {people?.length === 0 && (
          <div className="sheet-cta stack-8">
            <button className="btn btn-taxi" onClick={onInviteFriend}>Invite a friend</button>
            <button className="btn btn-secondary" onClick={onCrushInvite}>💌 Send a crush invite</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** The home-screen card (C6 style): a reveal or an invite waiting. */
export function DatingPrompt({ inbox, onOpen, onDismiss }: { inbox: DatingInbox; onOpen: () => void; onDismiss: () => void }) {
  const match = inbox.matches.find((m) => !m.seen);
  const invite = inbox.dates.find((d) => !d.mine && d.status === "pending");
  if (!match && !invite) return null;
  return (
    <div className="story-prompt dating-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">{match ? "👀" : "🌙"}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(255,255,255,.8)" }}>{match ? "It's mutual" : "Date night"}</span>
          <span className="title one-line" style={{ display: "block", color: "#fff" }}>
            {match ? `${match.name} picked you too` : `${invite!.with.name} asked you out tonight`}
          </span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" style={{ color: "rgba(255,255,255,.8)" }} onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** Everything tonight in one sheet: the reveal first, then invites to answer, then dates in progress. */
export function DatingSheet({ open, onClose, inbox, me, busy, onSeen, onPlan, onSayHi, onAnswer, onCancel, onCrushInvite }: {
  open: boolean;
  onClose: () => void;
  inbox: DatingInbox | null;
  me: string;
  busy: boolean;
  onSeen: (id: string) => void;
  onPlan: () => void;
  onSayHi: (p: DatePerson) => void;
  onAnswer: (id: number, yes: boolean) => void;
  onCancel: (id: number) => void;
  onCrushInvite: () => void;
}) {
  const match = inbox?.matches.find((m) => !m.seen);
  const invites = inbox?.dates.filter((d) => !d.mine && d.status === "pending") ?? [];
  const tonight = inbox?.dates.filter((d) => d.mine || d.status === "accepted") ?? [];
  return (
    <Sheet open={open} onClose={onClose} label="Date nights" tall>
      <div className="stack-16">
        {match ? (
          <MutualCard
            me={me}
            them={match}
            onPlan={() => { onSeen(match.id); onPlan(); }}
            onSayHi={() => { onSeen(match.id); onSayHi(match); }}
          />
        ) : (
          <>
            <div className="stack-4" style={{ paddingRight: 44 }}>
              <h2 className="display-md" style={{ margin: 0 }}>Date nights</h2>
              {inbox && <span className="meta">{inbox.crushes} of {inbox.max} crushes · they only find out if it&apos;s mutual</span>}
            </div>
            {invites.map((d) => <DateInviteCard key={d.id} date={d} busy={busy} onAnswer={(yes) => onAnswer(d.id, yes)} />)}
            {tonight.length > 0 && (
              <div className="stack-8">
                <p className="overline" style={{ margin: 0 }}>Tonight</p>
                {tonight.map((d) => <DateStatusRow key={d.id} me={me} date={d} bonus={inbox!.bonus} onCancel={() => onCancel(d.id)} />)}
              </div>
            )}
            {invites.length === 0 && tonight.length === 0 && (
              <div className="card stack-4">
                <p className="overline" style={{ margin: 0 }}>Nothing tonight</p>
                <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                  Tap &ldquo;Make it a date&rdquo; on a restaurant or a club night to ask someone. Once you both pull up, you each get 🙂 +{inbox?.bonus.mood ?? 10} Mood and 🔥 +{inbox?.bonus.clout ?? 25} clout.
                </p>
              </div>
            )}
            {(inbox?.matches.length ?? 0) > 0 && (
              <div className="stack-8">
                <p className="overline" style={{ margin: 0 }}>Matched</p>
                {inbox!.matches.map((m) => (
                  <button key={m.id} className="list-row" onClick={() => onSayHi(m)}>
                    <Avatar style={m.style} size={36} />
                    <span className="title" style={{ flex: 1, textAlign: "left" }}>{handle(m.name)}</span>
                    <span className="tag matched-tag">Matched</span>
                  </button>
                ))}
              </div>
            )}
            <button className="list-row" onClick={onCrushInvite}>
              <span style={{ fontSize: 24 }} aria-hidden="true">💌</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>Send a crush invite</span>
                <span className="meta">Your crush isn&apos;t in Clout City yet? Invite them. Same rewards as any invite.</span>
              </span>
              <ChevronRightIcon size={16} />
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
