"use client";

import { useState } from "react";
import { COUPLES, officialLine, type CouplePerson, type CoupleState } from "@/lib/couples";
import { getStyle, type StyleId } from "@/lib/styles";
import { handle } from "@/lib/validation";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { Toggle } from "../Toggle";

// Relationships (migration 0118, owner Oct 26): "Us", the couple's screen. Single: matches and how close each is
// to "Make it official?", and asks to answer. Dating: the couple streak, gifts, showing it on my card, breaking up.
// Copy stays gender-neutral and never makes a breakup public.

const emoji = (style: string) => getStyle(style as StyleId).emoji;
function Face({ style, size = 44 }: { style: string; size?: number }) {
  return <span className="date-avatar" style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{emoji(style)}</span>;
}

export interface CoupleHandlers {
  busy: boolean;
  error: string | null;
  onAsk: (id: string) => void;
  onAnswer: (askId: number, yes: boolean) => void;
  onGift: () => void;
  onShow: (on: boolean) => void;
  onEnd: () => void;
  onPlanDate: () => void;
  onMessage: (p: CouplePerson) => void;
  /** The gentle note was read. */
  onSeen: () => void;
}

export function CoupleSheet({ open, onClose, me, state, h }: {
  open: boolean; onClose: () => void; me: string; state: CoupleState | null; h: CoupleHandlers;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const close = () => { setConfirmEnd(false); onClose(); };
  const p = state?.partner;
  const incoming = state?.asks.filter((a) => !a.mine) ?? [];
  const outgoing = state?.asks.filter((a) => a.mine) ?? [];
  return (
    <Sheet open={open} onClose={close} label="Us" tall>
      <div className="stack-16">
        {!state ? <p className="meta">Loading…</p> : p ? (
          <>
            <div className="couple-head">
              <div className="mutual-pair">
                <Face style={me} size={58} />
                <span className="mutual-heart" aria-hidden="true">💞</span>
                <Face style={p.style} size={58} />
              </div>
              <h2 className="display-md" style={{ margin: 0 }}>You &amp; {handle(p.name)}</h2>
              <span className="meta">{state.days === 0 ? "Official since today" : `Together ${state.days} day${state.days === 1 ? "" : "s"}`}</span>
            </div>

            <div className="couple-streak card stack-8">
              <span className="title">🔥 {state.streak}-day couple streak</span>
              {state.nextReward && <span className="meta">Next: day {state.nextReward.day}, +{state.nextReward.clout} clout{state.nextReward.badge ? " and a badge" : ""}</span>}
              <span className={`couple-today${state.todayDone ? " done" : ""}`}>
                {state.todayDone
                  ? "✓ Today counts. Same again tomorrow."
                  : `Today: go on a date, do something together, or trade ${state.rules.streakMessages} messages each.`}
              </span>
            </div>

            <div className="stack-8">
              <button className="list-row" disabled={h.busy || state.gifts.sentToday || state.gifts.boxes < 1} onClick={h.onGift}>
                <span style={{ fontSize: 24 }} aria-hidden="true">🎁</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span className="title" style={{ display: "block" }}>{state.gifts.sentToday ? "Gift sent today" : "Send a gift box"}</span>
                  <span className="meta">
                    {state.gifts.sentToday ? "One a day. Keep a little mystery."
                      : state.gifts.boxes > 0 ? `${state.gifts.boxes} in your pocket · their Mood +${state.rules.giftMood}, your clout +${state.rules.giftClout}`
                        : "No gift box on you. Sal's and Schlep & Schmear sell them."}
                  </span>
                </span>
              </button>
              <button className="list-row" onClick={h.onPlanDate}>
                <span style={{ fontSize: 24 }} aria-hidden="true">🌹</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span className="title" style={{ display: "block" }}>Plan a date night</span>
                  <span className="meta">Pick a restaurant or a club night. Dates together pay 🙂 +{COUPLES.dateMood} and 🔥 +{COUPLES.dateClout}.</span>
                </span>
                <ChevronRightIcon size={16} />
              </button>
              <button className="list-row" onClick={() => h.onMessage(p)}>
                <span style={{ fontSize: 24 }} aria-hidden="true">💬</span>
                <span className="title" style={{ flex: 1, textAlign: "left" }}>Message {handle(p.name)}</span>
                <ChevronRightIcon size={16} />
              </button>
            </div>

            <div className="couple-toggle">
              <span style={{ flex: 1 }}>
                <span className="body-strong" style={{ display: "block" }}>Show &ldquo;💞 Dating&rdquo; on my card</span>
                <span className="meta">Only changes your card. {handle(p.name)} decides theirs.</span>
              </span>
              <Toggle on={!!state.shown} label="Show dating on my card" disabled={h.busy} onChange={() => h.onShow(!state.shown)} />
            </div>

            {h.error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{h.error}</p>}

            {confirmEnd ? (
              <div className="card stack-8">
                <p className="title" style={{ margin: 0 }}>End things with {handle(p.name)}?</p>
                <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                  No penalty, nothing posted anywhere. They&apos;ll see a gentle note next time they&apos;re on. Your streak ends, and you
                  can&apos;t make it official with each other again for {COUPLES.cooloffDays} days.
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmEnd(false)}>Never mind</button>
                  <button className="btn btn-destructive" style={{ flex: 1 }} disabled={h.busy} onClick={() => { setConfirmEnd(false); h.onEnd(); }}>End it</button>
                </div>
              </div>
            ) : (
              <button className="link-btn couple-end" onClick={() => setConfirmEnd(true)}>Break up</button>
            )}
          </>
        ) : (
          <>
            {state.ended && <CoupleEndedNote name={state.ended.name} onOk={h.onSeen} />}
            <div className="stack-4" style={{ paddingRight: 44 }}>
              <h2 className="display-md" style={{ margin: 0 }}>Make it official</h2>
              <span className="meta">Match with a crush, go on {COUPLES.datesToOfficial} date nights, then one of you asks.</span>
            </div>
            {incoming.map((a) => (
              <div key={a.id} className="reveal-card mutual-card stack-16">
                <div className="mutual-pair">
                  <Face style={a.with.style} size={58} />
                  <span className="mutual-heart" aria-hidden="true">💞</span>
                  <Face style={me} size={58} />
                </div>
                <div className="stack-4">
                  <h2 className="display-md" style={{ margin: 0, color: "#fff" }}>{handle(a.with.name)} wants to make it official</h2>
                  <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.82)" }}>A couple streak, gifts and better date nights. Take your time.</p>
                </div>
                <button className="btn btn-taxi" disabled={h.busy} onClick={() => h.onAnswer(a.id, true)}>Yes, make it official</button>
                <button className="btn btn-secondary" disabled={h.busy} onClick={() => h.onAnswer(a.id, false)}>Not yet</button>
              </div>
            ))}
            {outgoing.map((a) => (
              <div key={a.id} className="card stack-4">
                <p className="overline" style={{ margin: 0 }}>Asked</p>
                <p className="body" style={{ margin: 0 }}>Waiting on {handle(a.with.name)}. The ask stays open for {COUPLES.askDays} days.</p>
              </div>
            ))}
            {h.error && <p className="meta" role="alert" style={{ margin: 0, color: "var(--red-text)" }}>{h.error}</p>}
            {state.matches.length > 0 ? (
              <div className="stack-8">
                <p className="overline" style={{ margin: 0 }}>Your matches</p>
                {state.matches.map((m) => {
                  const asked = state.asks.some((a) => a.with.id === m.id);
                  return (
                    <div key={m.id} className="list-row couple-match">
                      <Face style={m.style} size={40} />
                      <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                        <span className="title" style={{ display: "block" }}>{handle(m.name)}</span>
                        <span className="meta">{officialLine(m, state.rules.datesToOfficial)}</span>
                        {m.blockedBy === "more_dates" && (
                          <span className="couple-dates" aria-hidden="true">
                            {Array.from({ length: state.rules.datesToOfficial }, (_, i) => <i key={i} className={i < m.dates ? "on" : ""} />)}
                          </span>
                        )}
                      </span>
                      {m.blockedBy === null && !asked && (
                        <button className="btn btn-taxi btn-sm" disabled={h.busy} onClick={() => h.onAsk(m.id)}>Make it official?</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : incoming.length === 0 && (
              <div className="card stack-4">
                <p className="overline" style={{ margin: 0 }}>No matches yet</p>
                <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                  Tap the heart on someone you know. If they pick you too, it&apos;s a match. Three date nights later, you can make it official.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** The home-screen card: an ask to answer, a gift, or the gentle breakup note. */
export function CouplePrompt({ state, onOpen, onDismiss }: { state: CoupleState; onOpen: () => void; onDismiss: () => void }) {
  const ask = state.asks.find((a) => !a.mine);
  const gift = state.gifts.received[0];
  const ended = state.ended;
  if (!ask && !gift && !ended) return null;
  const [tile, over, line] = ask ? ["💞", "Make it official?", `${ask.with.name} asked`]
    : gift ? ["🎁", "A gift", `${gift.from} sent you a gift box`]
      : ["🌧️", "A note", `You and ${ended!.name} aren't together anymore`];
  return (
    <div className="story-prompt dating-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">{tile}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(255,255,255,.8)" }}>{over}</span>
          <span className="title one-line" style={{ display: "block", color: "#fff" }}>{line}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" style={{ color: "rgba(255,255,255,.8)" }} onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** The gentle note, shown once inside "Us" after the other one ended it. */
export function CoupleEndedNote({ name, onOk }: { name: string; onOk: () => void }) {
  return (
    <div className="card stack-8">
      <p className="title" style={{ margin: 0 }}>You and {handle(name)} aren&apos;t together anymore</p>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
        It happens, even in Queens. Nothing was posted anywhere, and everything you own is still yours. Go get a bagel.
      </p>
      <button className="btn btn-secondary" onClick={onOk}>Okay</button>
    </div>
  );
}
