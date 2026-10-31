"use client";

import { useState } from "react";
import { COUPLES, moveInLine, officialLine, type CohabitState, type CouplePerson, type CoupleState } from "@/lib/couples";
import { ECONOMY, formatCash } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { handle } from "@/lib/validation";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { Toggle } from "../Toggle";

// Relationships (migration 0118, owner Oct 26): "Us", the couple's screen. Single: matches and how close each is
// to "Make it official?", and asks to answer. Dating: the couple streak, gifts, showing it on my card, breaking up.
// Living together (migration 0149): "Move in together" (ask, waiting, answer), "Living together since…", Home together
// and moving out with a confirm.
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
  /** Living together (migration 0149); absent before it runs. */
  home?: {
    onAsk: () => void;
    onCancel: () => void;
    onAnswer: (askId: number, yes: boolean) => void;
    onLeave: () => void;
    onHang: () => void;
    /** The mover: open the Home tab on the shared place. */
    onSeeHome: () => void;
  };
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
            {state.home?.ended && <CohabitEndedNote ended={state.home.ended} onOk={h.onSeen} />}
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

            {h.home && state.home && <MoveInSection home={state.home} partner={p} me={me} h={h} />}

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
                {state.home?.live && (
                  <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                    {state.home.live.role === "mover" ? "You move back to a room share." : `${handle(p.name)} moves back to a room share.`} No fees either way.
                  </p>
                )}
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
            {!state.ended && state.home?.ended && <CohabitEndedNote ended={state.home.ended} onOk={h.onSeen} />}
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

/** The home-screen card: an ask to answer, a move-in ask, a gift, the gentle breakup note or the moved-out note. */
export function CouplePrompt({ state, onOpen, onDismiss }: { state: CoupleState; onOpen: () => void; onDismiss: () => void }) {
  const ask = state.asks.find((a) => !a.mine);
  const moveIn = state.home?.asks.find((a) => !a.mine);
  const gift = state.gifts.received[0];
  const ended = state.ended;
  const movedOut = state.home?.ended;
  if (!ask && !moveIn && !gift && !ended && !movedOut) return null;
  const [tile, over, line] = ask ? ["💞", "Make it official?", `${ask.with.name} asked`]
    : moveIn ? ["🏠", "Move in together?", `${state.partner?.name ?? "Your partner"} asked you to move in`]
      : gift ? ["🎁", "A gift", `${gift.from} sent you a gift box`]
        : ended ? ["🌧️", "A note", `You and ${ended.name} aren't together anymore`]
          : ["📦", "A note", movedOut!.role === "host" ? `${movedOut!.name} moved out` : `You moved out of ${movedOut!.name}'s place`];
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

const homeName = (id: string) => ECONOMY.homes.find((x) => x.id === id)?.name ?? "their place";
const sinceLine = (since: string, days: number) =>
  days === 0 ? "Moved in today" : `Living together since ${new Date(`${since}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${days} day${days === 1 ? "" : "s"}`;

/** "Us" while dating: move in together (ask, waiting, answer), or the shared home, Home together and moving out. */
function MoveInSection({ home, partner, me, h }: { home: CohabitState; partner: CouplePerson; me: string; h: CoupleHandlers }) {
  const [confirm, setConfirm] = useState(false);
  const m = h.home!;
  const live = home.live;
  const incoming = home.asks.find((a) => !a.mine);
  const outgoing = home.asks.find((a) => a.mine);
  const name = handle(partner.name);
  if (live) {
    const mover = live.role === "mover";
    const both = live.homeToday && live.homeOther;
    return (
      <div className="card stack-8">
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 28 }} aria-hidden="true">🏠</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="title" style={{ display: "block" }}>{mover ? `Living at ${name}'s place` : `${name} lives with you`}</span>
            <span className="meta">{sinceLine(live.since, live.days)} · {live.houseSku ? "their house" : homeName(live.homeId)}</span>
          </span>
        </div>
        <span className="meta">
          {live.myRent === 0 ? "It's their house, so there's no rent for you. Bring snacks."
            : `Rent split 50/50: your part is ${formatCash(live.myRent ?? 0)} a week${live.fullRent ? ` of ${formatCash(live.fullRent)}` : ""}. It comes in your Bills as usual.`}
        </span>
        <button className="list-row" disabled={h.busy || live.homeToday} onClick={m.onHang}>
          <span style={{ fontSize: 24 }} aria-hidden="true">🛋️</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span className="title" style={{ display: "block" }}>{both ? "Home together today ✓" : live.homeToday ? `Waiting on ${name}` : "Home together"}</span>
            <span className="meta">
              {both ? "Same couch, same show, different opinions. See you tomorrow."
                : live.homeOther ? `${name} is home. Tap it too: you both get 🙂 +${home.rules.homeMood} and 🔥 +${home.rules.homeClout}.`
                  : `Both tap it today: 🙂 +${home.rules.homeMood} and 🔥 +${home.rules.homeClout} each.`}
            </span>
          </span>
        </button>
        {mover && (
          <button className="list-row" onClick={m.onSeeHome}>
            <span style={{ fontSize: 24 }} aria-hidden="true">🗝️</span>
            <span className="title" style={{ flex: 1, textAlign: "left" }}>See our place</span>
            <ChevronRightIcon size={16} />
          </button>
        )}
        {confirm ? (
          <div className="stack-8">
            <p className="title" style={{ margin: 0 }}>{mover ? "Move out?" : `End living together with ${name}?`}</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
              {mover ? `You go back to a room share. No penalty, no broker fee. ${name} keeps the place, and the whole rent.`
                : `${name} moves back to a room share. No penalty for either of you. You keep the place, and the whole rent.`}
              {" "}You're still dating.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(false)}>Stay</button>
              <button className="btn btn-destructive" style={{ flex: 1 }} disabled={h.busy} onClick={() => { setConfirm(false); m.onLeave(); }}>
                {mover ? "Move out" : "End it"}
              </button>
            </div>
          </div>
        ) : (
          <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>{mover ? "Move out" : "End living together"}</button>
        )}
      </div>
    );
  }
  if (incoming) {
    return (
      <div className="reveal-card mutual-card stack-16">
        <div className="mutual-pair">
          <Face style={partner.style} size={58} />
          <span className="mutual-heart" aria-hidden="true">🏠</span>
          <Face style={me} size={58} />
        </div>
        <div className="stack-4">
          <h2 className="display-md" style={{ margin: 0, color: "#fff" }}>{name} wants you to move in</h2>
          <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.82)" }}>
            Into {homeName(incoming.homeId)}. Your lease ends today with no penalty, your furniture goes to storage, and the rent splits 50/50.
          </p>
        </div>
        <button className="btn btn-taxi" disabled={h.busy} onClick={() => m.onAnswer(incoming.id, true)}>Yes, move in</button>
        <button className="btn btn-secondary" disabled={h.busy} onClick={() => m.onAnswer(incoming.id, false)}>Not yet</button>
      </div>
    );
  }
  if (outgoing) {
    return (
      <div className="card stack-4">
        <p className="overline" style={{ margin: 0 }}>🏠 Asked to move in</p>
        <p className="body" style={{ margin: 0 }}>Waiting on {name}. The invitation stays open for {COUPLES.moveInAskDays} days.</p>
        <button className="link-btn" style={{ alignSelf: "flex-start" }} disabled={h.busy} onClick={m.onCancel}>Take it back</button>
      </div>
    );
  }
  const why = moveInLine(home.blockedBy);
  return (
    <button className="list-row" disabled={h.busy || home.blockedBy !== null} onClick={m.onAsk}>
      <span style={{ fontSize: 24 }} aria-hidden="true">🏠</span>
      <span style={{ flex: 1, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>Move in together</span>
        <span className="meta">{why ?? `Invite ${name} to your place. The rent splits 50/50, the closet space won't.`}</span>
      </span>
      {!why && <ChevronRightIcon size={16} />}
    </button>
  );
}

/** The note when the other one ended living together by moving (a breakup has its own), shown once inside "Us". */
export function CohabitEndedNote({ ended, onOk }: { ended: NonNullable<CohabitState["ended"]>; onOk: () => void }) {
  const name = handle(ended.name);
  return (
    <div className="card stack-8">
      <p className="title" style={{ margin: 0 }}>{ended.role === "host" ? `${name} moved out` : "You're back in a room share"}</p>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
        {ended.role === "host" ? "The place is all yours again, and so is the whole rent. The good mug is probably gone."
          : `Living together with ${name} is over. No fees, no penalty, and your furniture is in storage where you left it.`}
      </p>
      <button className="btn btn-secondary" onClick={onOk}>Okay</button>
    </div>
  );
}
