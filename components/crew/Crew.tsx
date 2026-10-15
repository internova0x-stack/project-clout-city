"use client";

import { useEffect, useState } from "react";
import { placeById, type Place } from "@/lib/city";
import { formatCash } from "@/lib/economy";
import { CREW, activityLabel, crewActivities, crewProgress, type CrewActivity, type CrewApi, type CrewInbox, type CrewOuting, type CrewPerson } from "@/lib/crew";
import { getStyle, type StyleId } from "@/lib/styles";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { handle } from "@/lib/validation";

// Crew outings: one tap on a place card invites the crew to the same activity tonight.
// Everyone who goes gets +10 clout for each friend who also goes; when the host and all
// 5 friends go, everyone gets the full-crew bonus. In-app only, like date nights.

const emoji = (style: string) => getStyle(style as StyleId).emoji;

export function Avatar({ style, lit = true, size = 36 }: { style: string; lit?: boolean; size?: number }) {
  return <span className={`date-avatar${lit ? "" : " dim"}`} style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{emoji(style)}</span>;
}

/** Pick what and who. With no crew yet, it leads to the invite screen instead. */
export function CrewSheet({ place, api, onClose, onSent, onInviteFriends }: {
  place: Place | null;
  api: CrewApi;
  onClose: () => void;
  onSent: (text: string) => void;
  onInviteFriends: () => void;
}) {
  const [people, setPeople] = useState<CrewPerson[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [activity, setActivity] = useState<CrewActivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!place) return;
    setPeople(null);
    setError(null);
    setActivity(crewActivities(place)[0] ?? null);
    void api.members().then((r) => {
      const list = r.ok ? r.data : [];
      setPeople(list);
      setPicked(list.slice(0, CREW.maxInvites).map((p) => p.id));
    });
  }, [place, api]);
  if (!place) return <Sheet open={false} onClose={onClose} label="Bring the crew"><span /></Sheet>;
  const activities = crewActivities(place);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= CREW.maxInvites ? p : [...p, id]));
  const send = async () => {
    if (!activity || picked.length === 0) return;
    setBusy(true);
    setError(null);
    const r = await api.create(activity.kind, place.id, activity.id, picked);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onSent(`Crew invited. ${picked.length === 1 ? "They have" : "They all have"} until midnight.`);
  };
  return (
    <Sheet open onClose={onClose} label="Bring the crew">
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Bring the crew</h2>
          <p className="subtext" style={{ margin: 0 }}>{place.name} · tonight, until midnight</p>
        </div>
        {people === null && <p className="meta">Checking who&apos;s around…</p>}
        {people?.length === 0 && (
          <>
            <div className="card stack-8" style={{ textAlign: "center", padding: "22px 16px" }}>
              <span style={{ fontSize: 36 }} aria-hidden="true">🫥</span>
              <p className="title" style={{ margin: 0 }}>Your crew is empty</p>
              <p className="subtext" style={{ margin: 0 }}>
                A crew of one is just a mood. Invite friends; once they join, you can bring them here for bonus clout.
              </p>
            </div>
            <button className="btn btn-taxi" onClick={onInviteFriends}>Invite friends</button>
            <button className="btn btn-ghost" onClick={onClose}>Go solo for now</button>
          </>
        )}
        {people && people.length > 0 && (
          <>
            {activities.length > 1 && (
              <div className="stack-8">
                <p className="overline" style={{ margin: 0 }}>What</p>
                <div className="chip-row" role="group" aria-label="Activity" style={{ flexWrap: "wrap" }}>
                  {activities.map((a) => (
                    <button key={a.id} className="chip" aria-pressed={activity?.id === a.id} onClick={() => setActivity(a)}>
                      {a.label}{a.price > 0 ? ` · ${formatCash(a.price)}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activities.length === 1 && activity && (
              <p className="body" style={{ margin: 0 }}>{activity.label}{activity.price > 0 ? ` · ${formatCash(activity.price)} each` : " · free"}</p>
            )}
            <div className="stack-4">
              <p className="overline" style={{ margin: 0 }}>Who · {picked.length} of {Math.min(people.length, CREW.maxInvites)}</p>
              {people.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button key={p.id} className="list-row crew-pick" aria-pressed={on} onClick={() => toggle(p.id)}
                    disabled={!on && picked.length >= CREW.maxInvites}>
                    <Avatar style={p.style} />
                    <span className="title" style={{ flex: 1, textAlign: "left" }}>{handle(p.name)}</span>
                    <span className={`crew-check${on ? " on" : ""}`} aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
            <div className="crew-bonus">
              🔥 <b>+{CREW.perFriendClout} clout</b> each for every friend who shows up.<br />
              🎉 All {CREW.maxInvites} show up: <b>+{CREW.fullClout} clout and +{CREW.fullMood} Mood</b> for everyone.
            </div>
            {error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{error}</p>}
            <button className="btn btn-taxi" disabled={busy || picked.length === 0 || !activity} onClick={() => void send()}>
              {busy ? "Sending…" : `Send to ${picked.length} ${picked.length === 1 ? "friend" : "friends"}`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Someone asked: "I'm in" or "Not tonight". */
export function CrewInviteCard({ outing, busy, onAnswer }: { outing: CrewOuting; busy: boolean; onAnswer: (yes: boolean) => void }) {
  const place = placeById(outing.placeId);
  const { went, total } = crewProgress(outing);
  return (
    <div className="card date-invite stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={outing.host.style} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>Crew plans</span>
          <span className="title" style={{ display: "block" }}>{handle(outing.host.name)} wants the crew at {place?.name ?? outing.placeId}</span>
          <span className="meta" style={{ display: "block" }}>
            {activityLabel(place, outing.kind, outing.activity)} · {outing.price > 0 ? <><span className="tabular">{formatCash(outing.price)}</span> · you pay your own way</> : "free"}
          </span>
          <span className="meta" style={{ display: "block" }}>Expires at midnight · {went} of {total} went</span>
        </span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>Not tonight</button>
        <button className="btn btn-green" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>I&apos;m in</button>
      </div>
    </div>
  );
}

/** On the place card: who has gone, and how close the full-crew bonus is. */
export function CrewProgress({ outing, earned }: { outing: CrewOuting; earned?: number }) {
  const place = placeById(outing.placeId);
  const live = outing.members.filter((m) => m.status !== "declined");
  const { went, total } = crewProgress(outing);
  const left = CREW.fullSize - went;
  const fullPossible = total >= CREW.fullSize;
  return (
    <div className={`crew-progress${outing.full ? " done" : ""}`}>
      <div className="row" style={{ gap: 10 }}>
        <span className="date-pair">{live.map((m) => <Avatar key={m.id} style={m.style} lit={m.went} size={30} />)}</span>
        <span className="title" style={{ marginLeft: "auto" }}>{went} of {total}</span>
      </div>
      <div className="crew-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={went}>
        <i style={{ width: `${total ? (went / total) * 100 : 0}%` }} />
      </div>
      <p className="meta" style={{ margin: 0 }}>
        Crew · {activityLabel(place, outing.kind, outing.activity)}
        {earned ? ` · +${earned} clout today` : ""}
        {outing.full ? " · Full crew 🎉" : fullPossible ? ` · ${left} more for the full-crew bonus 🎉` : ""}
      </p>
    </div>
  );
}

/** The whole crew went: a light, Monument Valley-style reveal. */
export function CrewFullCard({ outing, onClose }: { outing: CrewOuting; onClose: () => void }) {
  const place = placeById(outing.placeId);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Full crew">
      <div className="crew-full-scrim" onClick={onClose} />
      <div className="crew-full-card">
        <span className="crew-full-orb a" aria-hidden="true" />
        <span className="crew-full-orb b" aria-hidden="true" />
        <div className="crew-full-avatars">
          {outing.members.filter((m) => m.went).map((m) => <Avatar key={m.id} style={m.style} size={46} />)}
        </div>
        <div className="crew-full-text">
          <h2 className="display-md" style={{ margin: 0 }}>Full crew 🎉</h2>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
            All six of you pulled up to {place?.name ?? "the spot"}. The city noticed. Mostly the noise.
          </p>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          <span className="chip-pill clout">🔥 +{CREW.fullClout} clout</span>
          <span className="chip-pill mood">🙂 +{CREW.fullMood} Mood</span>
        </div>
        <button className="btn btn-taxi" onClick={onClose}>Nice</button>
      </div>
    </div>
  );
}

/** The home-screen card (C6 style) for an invite waiting. */
export function CrewPrompt({ inbox, onOpen, onDismiss }: { inbox: CrewInbox; onOpen: () => void; onDismiss: () => void }) {
  const invite = inbox.outings.find((o) => !o.mine && o.myStatus === "invited");
  if (!invite) return null;
  const place = placeById(invite.placeId);
  return (
    <div className="story-prompt crew-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">👯</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>Crew plans</span>
          <span className="title one-line" style={{ display: "block", color: "var(--night-900)" }}>{handle(invite.host.name)}: {place?.name ?? "tonight"}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** Tonight's crew plans: invites to answer, then outings in progress. */
export function CrewPlansSheet({ open, onClose, inbox, busy, onAnswer, onOpenPlace, onInviteFriends, onPickPlace }: {
  open: boolean;
  /** Owner, Oct 15: an empty evening is a chance to grow the crew. */
  onInviteFriends?: () => void;
  onPickPlace?: () => void;
  onClose: () => void;
  inbox: CrewInbox | null;
  busy: boolean;
  onAnswer: (id: number, yes: boolean) => void;
  onOpenPlace: (placeId: string) => void;
}) {
  const invites = inbox?.outings.filter((o) => !o.mine && o.myStatus === "invited") ?? [];
  const going = inbox?.outings.filter((o) => o.mine || o.myStatus === "in") ?? [];
  return (
    <Sheet open={open} onClose={onClose} label="Crew plans" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Crew plans</h2>
          <span className="meta">{inbox?.clout ? `+${inbox.clout} crew clout today` : "Tonight, until midnight"}</span>
        </div>
        {invites.map((o) => <CrewInviteCard key={o.id} outing={o} busy={busy} onAnswer={(yes) => onAnswer(o.id, yes)} />)}
        {going.length > 0 && (
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Tonight</p>
            {going.map((o) => (
              <button key={o.id} className="crew-plan" onClick={() => onOpenPlace(o.placeId)}>
                <span className="title" style={{ display: "block", textAlign: "left" }}>{placeById(o.placeId)?.name ?? o.placeId}</span>
                <CrewProgress outing={o} />
              </button>
            ))}
          </div>
        )}
        {invites.length === 0 && going.length === 0 && (
          <div className="crew-empty">
            <span className="crew-empty-faces" aria-hidden="true">
              <span>🕺</span><span>💃</span><span className="crew-empty-add">+</span>
            </span>
            <p className="title" style={{ margin: 0 }}>No plans tonight. Yet.</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
              Nights out hit different with your people. Bring friends into Clout City, then tap &ldquo;Bring the crew&rdquo; on any place.
            </p>
            <div className="crew-empty-perks">
              <span><b>+{CREW.perFriendClout}</b> clout for each friend who shows up</span>
              <span><b>+{CREW.fullClout}</b> clout when the whole crew comes</span>
            </div>
            {onInviteFriends && <button className="btn btn-taxi" onClick={onInviteFriends}>Invite friends to your crew</button>}
            {onPickPlace && <button className="btn btn-secondary" onClick={onPickPlace}>Pick a place for tonight</button>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
