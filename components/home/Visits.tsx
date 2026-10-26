"use client";

import { useState } from "react";
import { KIND_LABEL, VISITS, hostCloutPerGuest, visitClock, type VisitKind, type VisitState } from "@/lib/visits";
import { getStyle, type StyleId } from "@/lib/styles";
import { handle } from "@/lib/validation";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";

// Having people over (migration 0121, owner Oct 26; spec section 27). One sheet for everything: invites I've had, the
// visit I'm hosting (guests, send home, end), or inviting people (hangout now, or a house party later tonight). It opens
// from the Mood row of the stats panel at home, the invite card, a push, and the bar during a visit.

function Face({ style, size = 36 }: { style: string; size?: number }) {
  return <span className="date-avatar" style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{getStyle(style as StyleId).emoji}</span>;
}

export interface VisitHandlers {
  busy: boolean;
  error: string | null;
  onHost: (kind: VisitKind, guests: string[], startsAt: string | null) => void;
  onEnd: () => void;
  onSendHome: (id: string) => void;
  onAnswer: (visitId: number, yes: boolean) => void;
  onGo: (visitId: number) => void;
}

const START_OPTIONS = [0, 1, 2, 3, 5];

export function VisitsSheet({ open, onClose, state, h }: { open: boolean; onClose: () => void; state: VisitState | null; h: VisitHandlers }) {
  const [kind, setKind] = useState<VisitKind>("hang");
  const [picked, setPicked] = useState<string[]>([]);
  const [later, setLater] = useState(0);
  const close = () => { setPicked([]); onClose(); };
  const hosting = state?.hosting;
  const cap = state?.capacity ?? 0;
  const per = hostCloutPerGuest(kind, state?.crib ?? 0);
  const startsAt = kind === "party" && later > 0 ? new Date(Date.now() + later * 3600e3).toISOString() : null;
  return (
    <Sheet open={open} onClose={close} label="Have people over" tall>
      {!state ? <p className="meta">Loading…</p> : (
        <div className="stack-16">
          {state.invites.length > 0 && (
            <div className="stack-8">
              <p className="overline" style={{ margin: 0 }}>You&apos;re invited</p>
              {state.invites.map((i) => {
                const live = Date.parse(i.starts) <= Date.now();
                return (
                  <div key={i.id} className="card stack-8">
                    <div className="row" style={{ gap: 10 }}>
                      <Face style={i.host.style} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="title" style={{ display: "block" }}>{KIND_LABEL[i.kind].emoji} {handle(i.host.name)}&apos;s {KIND_LABEL[i.kind].name.toLowerCase()}</span>
                        <span className="meta">{visitClock(i.starts, i.ends)} · {i.going} going · up to {i.capacity}</span>
                      </span>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      {i.status === "invited" && <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.onAnswer(i.id, false)}>Can&apos;t make it</button>}
                      {live
                        ? <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.onGo(i.id)}>Go now</button>
                        : i.status === "invited"
                          ? <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={h.busy} onClick={() => h.onAnswer(i.id, true)}>I&apos;ll be there</button>
                          : <span className="meta" style={{ flex: 1, alignSelf: "center" }}>✓ You&apos;re going</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hosting ? (
            <div className="stack-12">
              <div className="stack-4" style={{ paddingRight: 44 }}>
                <span className="overline">{KIND_LABEL[hosting.kind].emoji} You&apos;re hosting</span>
                <span className="display-md" style={{ display: "block" }}>{KIND_LABEL[hosting.kind].name}</span>
                <span className="meta">{visitClock(hosting.starts, hosting.ends)} · {hostCloutPerGuest(hosting.kind, hosting.crib)} clout for every guest who stays (Crib Rating {hosting.crib})</span>
              </div>
              {hosting.guests.map((g) => (
                <div key={g.id} className="list-row" style={{ gap: 10 }}>
                  <Face style={g.style} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span className="title" style={{ display: "block" }}>{handle(g.name)}</span>
                    <span className="meta">
                      {g.here ? (g.paid ? "Here · stayed ✓" : "Here now") : g.status === "accepted" ? "Coming" : g.status === "invited" ? "Invited" : g.status === "declined" ? "Can't make it" : g.status === "left" ? "Went home" : "Sent home"}
                    </span>
                  </span>
                  {(g.status === "accepted" || g.status === "invited") && (
                    <button className="btn btn-ghost btn-sm" disabled={h.busy} onClick={() => h.onSendHome(g.id)}>Send home</button>
                  )}
                </div>
              ))}
              {h.error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{h.error}</p>}
              <button className="link-btn" onClick={h.onEnd}>{Date.parse(hosting.starts) > Date.now() ? "Call it off" : "Wrap it up"}</button>
            </div>
          ) : state.blocked === "subletting" ? (
            <div className="card stack-4">
              <span className="title">You&apos;re subletting</span>
              <span className="meta">It&apos;s someone else&apos;s place. Hosting waits until you&apos;re home.</span>
            </div>
          ) : (
            <div className="stack-16">
              <div className="stack-4" style={{ paddingRight: 44 }}>
                <h2 className="display-md" style={{ margin: 0 }}>Have people over</h2>
                <span className="meta">Up to {cap} guests fit at your place. Guests who stay a couple of minutes get clout and Mood; you get clout for each, more the higher your Crib Rating ({state.crib}).</span>
              </div>
              <div className="segmented" role="group" aria-label="What kind">
                <button aria-pressed={kind === "hang"} onClick={() => setKind("hang")}>🏠 Hang out</button>
                <button aria-pressed={kind === "party"} onClick={() => setKind("party")}>🎉 House party</button>
              </div>
              <div className="card stack-4">
                {kind === "hang"
                  ? <span className="body" style={{ display: "block" }}>Right now, for an hour. {state.left.hang} of {VISITS.kinds.hang.perDay} left today.</span>
                  : <span className="body" style={{ display: "block" }}>Two hours, snacks {state.snacks ? `C$${state.snacks.toLocaleString("en-US")}` : ""} paid now. {state.left.party ? "One a day." : "Today's party is done."}</span>}
                <span className="meta" style={{ display: "block" }}>You: +{per} clout a guest, +{VISITS.kinds[kind].hostMood} Mood · Them: +{VISITS.kinds[kind].guestClout} clout, +{VISITS.kinds[kind].guestMood} Mood</span>
              </div>
              {kind === "party" && (
                <div className="stack-4">
                  <p className="overline" style={{ margin: 0 }}>Starts</p>
                  <div className="chip-row">
                    {START_OPTIONS.map((hrs) => <button key={hrs} className="chip" aria-pressed={later === hrs} onClick={() => setLater(hrs)}>{hrs ? `In ${hrs} h` : "Now"}</button>)}
                  </div>
                </div>
              )}
              <div className="stack-4">
                <p className="overline" style={{ margin: 0 }}>Who · {picked.length} of {cap}</p>
                {state.invitable.length === 0 && <p className="meta" style={{ margin: 0 }}>Nobody to invite yet. Invite your crew, or chat with someone first.</p>}
                {state.invitable.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button key={p.id} className="list-row crew-pick" aria-pressed={on} disabled={!on && picked.length >= cap}
                      onClick={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])}>
                      <Face style={p.style} />
                      <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                        <span className="title" style={{ display: "block" }}>{handle(p.name)}</span>
                        <span className="meta">{p.partner ? "💞 Your partner" : p.crew ? "Crew" : "You chat"}</span>
                      </span>
                      <span className={`crew-check${on ? " on" : ""}`} aria-hidden="true">✓</span>
                    </button>
                  );
                })}
              </div>
              {h.error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{h.error}</p>}
              <button className="btn btn-taxi" disabled={h.busy || !picked.length || state.left[kind] < 1}
                onClick={() => { h.onHost(kind, picked, startsAt); setPicked([]); }}>
                {picked.length ? `Invite ${picked.length}` : "Pick who to invite"}
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The home card: an invite to someone's place. */
export function VisitPrompt({ invite, onOpen, onDismiss }: { invite: VisitState["invites"][number]; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="story-prompt dating-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">{KIND_LABEL[invite.kind].emoji}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(255,255,255,.8)" }}>{invite.kind === "party" ? "House party" : "Come over"}</span>
          <span className="title one-line" style={{ display: "block", color: "#fff" }}>{handle(invite.host.name)} invited you · {visitClock(invite.starts, invite.ends)}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" style={{ color: "rgba(255,255,255,.8)" }} onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** The bar during a visit, over the room: where, how long, the chat, and leaving (or managing it, for the host). */
export function VisitBar({ title, clock, here, unread, onChat, onLeave, leaveLabel }: {
  title: string; clock: string; here: number; unread: number; onChat: () => void; onLeave: () => void; leaveLabel: string;
}) {
  return (
    <div className="viewing-bar glass-hud" role="group" aria-label={title}>
      <span style={{ minWidth: 0 }}>
        <b>{title}</b>
        <small>{clock} · {here} here</small>
      </span>
      <button className="chip" onClick={onChat}>💬 Chat{unread ? ` · ${unread}` : ""}</button>
      <button className="chip" onClick={onLeave}>{leaveLabel}</button>
    </div>
  );
}
