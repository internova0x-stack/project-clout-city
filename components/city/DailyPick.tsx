"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { CloseIcon } from "../icons";
import { guardTaps } from "@/lib/tapGuard";
import type { WelcomeAction } from "@/lib/welcomePick";
import { isStreakMilestone, milestoneName, milestoneSize } from "@/lib/streakMilestones";
import { Confetti } from "../Confetti";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { reducedMotion, sparks } from "../motion";

// The welcome back (owner, Nov 1: "a pop up instead of a modal", "a welcome back treatment like mobile games have"; Nov 3:
// "too much information which will lead to indecision. Pick the highest leverage action"): once a New York day, when nothing
// else is on screen, a card floats over the game (no scrim, the game stays live): a greeting with the streak, and ONE thing
// to do, picked for the player's situation by lib/welcomePick.ts. One button, or Later.
// Treatments (owner, Nov 3: "explore other treatments, benchmark against top sim and mobile games"; "make lola says the default"),
// `?welcome=` in the preview tries the others:
//   card   the gradient greeting over one action card (today's)
//   lola   the host tells you (Isabelle's morning announcement, The Sims' quest giver): Lola's portrait and a speech bubble
//   ticket today's mission ticket (daily commissions, quest boards): a ticket stub, reward chips, one big Go
//   streak the streak is the hero (Duolingo, Snapchat): the flame count and the week, the action under it
//   banner a slim banner under the HUD (Pokémon GO, Royal Match): the least in the way

export type WelcomeVariant = "card" | "lola" | "ticket" | "streak" | "banner";
export const WELCOME_VARIANTS: readonly WelcomeVariant[] = ["card", "lola", "ticket", "streak", "banner"];

/** "Cash · ⚡ 15 Energy" → reward chips, tinted by what they are. */
function chips(detail: string | null) {
  return (detail ?? "").split(" · ").filter(Boolean).map((t, i) => {
    const tone = /⚡|Energy/.test(t) ? "cost" : /C\$|[Cc]ash|tip/.test(t) ? "cash" : /🔥|[Cc]lout|respect|[Mm]ood/.test(t) ? "clout" : "plain";
    return <span key={i} className={`wb-chip t-${tone}`}>{t}</span>;
  });
}

export function DailyWelcome({ open, name, hello, streak, streakNext, action, variant = "lola", onGo, onLater }: {
  open: boolean;
  name: string;
  /** "Good morning" … by the city clock. */
  hello: string;
  /** The all-five streak in days (0 = none). */
  streak: number;
  /** The day of the next streak reward (goals_state's streak.next.day). */
  streakNext?: number;
  action: WelcomeAction | null;
  variant?: WelcomeVariant;
  onGo: () => void;
  /** Later or ✕: put off for today. */
  onLater: () => void;
}) {
  if (!open || !action) return null;
  // A milestone streak (owner, Nov 3) gets confetti in every treatment.
  const mile = isStreakMilestone(streak);
  const party = mile ? <Confetti size={milestoneSize(streak)} /> : null;
  const later = () => { guardTaps(); onLater(); };
  const go = () => { guardTaps(); onGo(); };
  const x = (cls = "") => <button className={`daily-pop-x welcome-x ${cls}`} onClick={later} aria-label="Close"><CloseIcon size={14} /></button>;
  const buttons = (
    <div className="daily-pop-actions">
      <button className="btn btn-ghost btn-sm" onClick={later}>Later</button>
      <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={go}>{action.cta}</button>
    </div>
  );

  if (variant === "banner") {
    return (
      <div className={`wb-banner k-${action.kind}`} role="dialog" aria-label="Welcome back">
        {party}
        <button className="wb-banner-main" onClick={go}>
          <span className="wb-banner-emoji" aria-hidden="true">{action.emoji}</span>
          <span className="wb-banner-text">
            <span className="wb-banner-hello">{hello}, {name}{streak > 0 ? ` · 🔥 ${streak}` : ""}</span>
            <span className="wb-banner-title">{action.title}</span>
            <span className="wb-banner-why">{action.why ?? action.sub ?? action.detail}</span>
          </span>
          <span className="wb-banner-go">{action.cta} ›</span>
        </button>
        <button className="wb-banner-x" onClick={later} aria-label="Later"><CloseIcon size={12} /></button>
      </div>
    );
  }

  if (variant === "lola") return <LolaSays name={name} hello={hello} streak={streak} action={action} party={party} close={x("on-dark")} buttons={buttons} />;

  if (variant === "ticket") {
    return (
      <div className="welcome-pop wb-ticket" role="dialog" aria-label="Welcome back">
        {party}
        <div className="wb-ticket-stub">
          <span className="wb-ticket-kicker">Today&apos;s move</span>
          <span className="wb-ticket-hello">{hello}, {name}{streak > 0 ? ` · 🔥 ${streak} days` : ""}</span>
          {x("on-taxi")}
        </div>
        <div className="wb-ticket-body">
          <span className="wb-ticket-emoji" aria-hidden="true">{action.emoji}</span>
          <span className="wb-ticket-title">{action.title}</span>
          {action.sub && <span className="wb-ticket-sub">{action.sub}</span>}
          {action.detail && <span className="wb-chips center">{chips(action.detail)}</span>}
          {action.why && <span className="wb-ticket-why">{action.why}</span>}
        </div>
        <div className="wb-ticket-foot">
          <button className="btn btn-taxi wb-ticket-go" onClick={go}>{action.cta}</button>
          <button className="link-btn wb-ticket-later" onClick={later}>Later</button>
        </div>
      </div>
    );
  }

  if (variant === "streak") return <StreakWelcome name={name} hello={hello} streak={streak} streakNext={streakNext} action={action} mile={mile} party={party} close={x("on-light")} buttons={buttons} />;


  return (
    <div className="welcome-pop" role="dialog" aria-label="Welcome back">
      {party}
      <div className="welcome-hero">
        {x()}
        <span className="welcome-spark" aria-hidden="true">✦</span>
        <span className="welcome-spark s2" aria-hidden="true">✦</span>
        <span className="welcome-hello">{hello},</span>
        <span className="welcome-name">
          {name}
          {streak > 0 && <span className="welcome-streak-chip" aria-label={`${streak}-day streak`}><span className="welcome-flame" aria-hidden="true">🔥</span>{streak}</span>}
        </span>
      </div>
      <div className={`welcome-one k-${action.kind}`}>
        <span className="welcome-one-emoji" aria-hidden="true">{action.emoji}</span>
        <span className="welcome-one-title">{action.title}</span>
        {action.sub && <span className="welcome-one-sub">{action.sub}</span>}
        {action.detail && <span className="welcome-one-detail">{action.detail}</span>}
        {action.why && <span className="welcome-one-why">{action.why}</span>}
      </div>
      {buttons}
    </div>
  );
}

/**
 * Lola says, texting you (owner, Nov 3, the motion lab's pick): she bounces in, typing dots show in her bubble for a beat,
 * her line arrives a word at a time as the one task slides up, and a shine sweeps the button once. Under two seconds;
 * the buttons work from the first frame; "reduce motion" shows it all at once.
 */
function LolaSays({ name, hello, streak, action, party, close, buttons }: {
  name: string; hello: string; streak: number; action: WelcomeAction; party: ReactNode; close: ReactNode; buttons: ReactNode;
}) {
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    if (reducedMotion()) { setTyping(false); return; }
    const t = setTimeout(() => setTyping(false), 950);
    return () => clearTimeout(t);
  }, []);
  const words = (action.lola ?? "").split(" ");
  // The task slides up while her line is still arriving, so the card never sits half empty.
  const after = typing ? 0 : 180;
  return (
    <div className={`welcome-pop wb-lola${typing ? " is-typing" : " is-said"}`} role="dialog" aria-label="Welcome back">
      {party}
      {close}
      <div className="wb-lola-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="wb-lola-face" src={LOLA_PORTRAIT} alt="Lola Lowdown" width={72} height={72} />
        <div className="wb-lola-bubble">
          {typing ? (
            <span className="wb-typing" aria-label="Lola is typing"><i /><i /><i /></span>
          ) : (
            <>
              <span className="wb-lola-hi wb-word-in">{hello}, {name}!{streak > 0 && <span className="wb-lola-streak"> 🔥 {streak}</span>}</span>
              <span className="wb-lola-line">
                {words.map((w, i) => <span key={i} className="wb-word wb-word-in" style={{ animationDelay: `${60 + i * 70}ms` }}>{w}{i < words.length - 1 ? " " : ""}</span>)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className={`wb-lola-task${typing ? " wb-wait" : " wb-slide-in"}`} style={typing ? undefined : { animationDelay: `${after}ms` }}>
        <span className="wb-lola-emoji" aria-hidden="true">{action.emoji}</span>
        <span className="wb-lola-text">
          <span className="wb-lola-title">{action.title}</span>
          {action.sub && <span className="wb-lola-sub">{action.sub}</span>}
          {action.detail && <span className="wb-chips">{chips(action.detail)}</span>}
        </span>
      </div>
      {action.why && <p className={`wb-why${typing ? " wb-wait" : " wb-slide-in"}`} style={typing ? undefined : { animationDelay: `${after + 60}ms` }}>{action.why}</p>}
      <div className={`wb-lola-foot${typing ? " wb-wait" : " wb-slide-in"}`} style={typing ? undefined : { animationDelay: `${after + 90}ms`, ["--shine-delay" as string]: `${60 + words.length * 70 + 300}ms` }}>{buttons}</div>
    </div>
  );
}

/** One digit column of the odometer: rolls up from `from` (null: a new digit appearing) to `to`, wrapping past 9. */
function Reel({ from, to, i, n }: { from: number | null; to: number; i: number; n: number }) {
  const seq: (number | null)[] = [from];
  if (from === null) seq.push(to);
  else for (let k = from; k !== to;) { k = (k + 1) % 10; seq.push(k); }
  return (
    // One gradient across the whole number: each column shows its own slice of it.
    <span className="wb-reel-col" style={{ ["--gx" as string]: n > 1 ? `${(i / (n - 1)) * 100}%` : "0%", ["--gw" as string]: `${n * 100}%` }}>
      <span className={`wb-reel${seq.length > 1 ? " rolling" : ""}`} style={{ ["--steps" as string]: seq.length - 1 }}>
        {seq.map((d, i) => <span key={i} className="wb-reel-digit">{d === null ? "\u00a0" : d}</span>)}
      </span>
    </span>
  );
}

/**
 * The streak welcome (owner, Nov 3: "yes, build the streak animation"; the Welcome Back Motion pick): the flame starts as an
 * ember and whooshes up with sparks, the number rolls like an odometer from yesterday's count to today's, and this week's dots
 * light one after another along a fuse, ending on the one to earn today. When the streak is at risk (the evening rung,
 * kind 'streak'), the colours drain, the flame gutters and today's dot blinks red instead.
 */
function StreakWelcome({ name, hello, streak, streakNext, action, mile, party, close, buttons }: {
  name: string; hello: string; streak: number; streakNext?: number; action: WelcomeAction; mile: boolean;
  party: ReactNode; close: ReactNode; buttons: ReactNode;
}) {
  const days = Math.max(0, streak);
  // This week's dots: a full week (7, 14, 42 days) lights all seven; the next dot to earn pulses.
  const lit = days > 0 && days % 7 === 0 ? 7 : days % 7;
  const weeks = Math.floor(days / 7);
  const risk = action.kind === "streak";
  const [still] = useState(() => reducedMotion());
  const roll = !still && !risk && days > 0;
  // The reels only while the number rolls; once it lands it is the plain number again (one glyph run, nothing clipped).
  const [rolling, setRolling] = useState(roll);
  useEffect(() => {
    if (!rolling) return;
    const t = setTimeout(() => setRolling(false), 1450);
    return () => clearTimeout(t);
  }, [rolling]);
  const flame = useRef<HTMLSpanElement>(null);
  const week = useRef<HTMLSpanElement>(null);
  // The timeline (ms after the card opens): the flame flares at 560, the number rolls 640 to 1340, the dots light from 1440.
  const DOTS_AT = 1440, DOT_STEP = 90;
  useEffect(() => {
    if (!roll) return;
    const a = setTimeout(() => sparks(flame.current, 14, 54), 560);
    const b = setTimeout(() => sparks(week.current?.querySelectorAll(".wb-day")[Math.max(0, lit - 1)], 8, 30), DOTS_AT + lit * DOT_STEP);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [roll, lit]);
  const to = String(days), from = String(Math.max(0, days - 1)).padStart(to.length, " ");
  return (
    <div className={`welcome-pop wb-streak${roll ? " ignite" : ""}${risk ? " at-risk" : ""}`} role="dialog" aria-label="Welcome back">
      {party}
      {close}
      <div className="wb-streak-hero">
        <span className="wb-streak-flame" ref={flame} aria-hidden="true">🔥</span>
        <span className="wb-streak-n" aria-label={`${days}`}>
          <span className="wb-streak-slant" aria-hidden="true">
            {rolling ? to.split("").map((d, i) => <Reel key={`${i}-${to.length}`} from={from[i] === " " ? null : Number(from[i])} to={Number(d)} i={i} n={to.length} />) : days}
          </span>
        </span>
        <span className="wb-streak-label">{days ? "day streak" : "Start a streak today"}</span>
        {mile ? <span className="wb-streak-mile">🎉 {milestoneName(days)}!</span>
          : weeks > 0 && <span className="wb-streak-weeks">🏅 {weeks} {weeks === 1 ? "week" : "weeks"} straight</span>}
        <span className="wb-streak-week" ref={week} aria-hidden="true" style={roll ? { ["--fuse" as string]: `${Math.max(0, lit - 1) * 30}px` } : undefined}>
          {roll && lit > 1 && <span className="wb-fuse" style={{ animationDelay: `${DOTS_AT}ms`, animationDuration: `${(lit - 1) * DOT_STEP}ms` }} />}
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`wb-day${i < lit ? " on" : ""}${i === lit ? " now" : ""}`}
              style={roll && i < lit ? { animationDelay: `${DOTS_AT + i * DOT_STEP}ms` } : roll && i === lit ? { animationDelay: `${DOTS_AT + lit * DOT_STEP + 200}ms` } : undefined} />
          ))}
        </span>
        {!!streakNext && streakNext > days && <span className="wb-streak-next">Next reward on day {streakNext}</span>}
        <span className="wb-streak-hello">{hello}, {name}</span>
      </div>
      <div className="wb-streak-task">
        <span className="wb-lola-emoji" aria-hidden="true">{action.emoji}</span>
        <span className="wb-lola-text">
          <span className="wb-lola-title">{action.title}</span>
          <span className="wb-lola-sub">{action.why ?? action.sub ?? action.detail}</span>
        </span>
      </div>
      {buttons}
    </div>
  );
}
