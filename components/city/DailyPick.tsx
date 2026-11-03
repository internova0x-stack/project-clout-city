"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { CloseIcon } from "../icons";
import { guardTaps } from "@/lib/tapGuard";
import type { WelcomeAction } from "@/lib/welcomePick";

// The welcome back (owner, Nov 1: "a pop up instead of a modal", "a welcome back treatment like mobile games have"; Nov 3:
// "too much information which will lead to indecision. Pick the highest leverage action"): once a New York day, when nothing
// else is on screen, a card floats over the game (no scrim, the game stays live): a greeting with the streak, and ONE thing
// to do, picked for the player's situation by lib/welcomePick.ts. One button, or Later.
// Treatments (owner, Nov 3: "explore other treatments, benchmark against top sim and mobile games"), `?welcome=` in the preview:
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

export function DailyWelcome({ open, name, hello, streak, action, variant = "card", onGo, onLater }: {
  open: boolean;
  name: string;
  /** "Good morning" … by the city clock. */
  hello: string;
  /** The all-five streak in days (0 = none). */
  streak: number;
  action: WelcomeAction | null;
  variant?: WelcomeVariant;
  onGo: () => void;
  /** Later or ✕: put off for today. */
  onLater: () => void;
}) {
  if (!open || !action) return null;
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

  if (variant === "lola") {
    return (
      <div className="welcome-pop wb-lola" role="dialog" aria-label="Welcome back">
        {x("on-dark")}
        <div className="wb-lola-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wb-lola-face" src={LOLA_PORTRAIT} alt="Lola Lowdown" width={72} height={72} />
          <div className="wb-lola-bubble">
            <span className="wb-lola-hi">{hello}, {name}!{streak > 0 && <span className="wb-lola-streak"> 🔥 {streak}</span>}</span>
            <span className="wb-lola-line">{action.lola}</span>
          </div>
        </div>
        <div className="wb-lola-task">
          <span className="wb-lola-emoji" aria-hidden="true">{action.emoji}</span>
          <span className="wb-lola-text">
            <span className="wb-lola-title">{action.title}</span>
            {action.sub && <span className="wb-lola-sub">{action.sub}</span>}
            {action.detail && <span className="wb-chips">{chips(action.detail)}</span>}
          </span>
        </div>
        {action.why && <p className="wb-why">{action.why}</p>}
        {buttons}
      </div>
    );
  }

  if (variant === "ticket") {
    return (
      <div className="welcome-pop wb-ticket" role="dialog" aria-label="Welcome back">
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

  if (variant === "streak") {
    const days = Math.max(0, streak);
    return (
      <div className="welcome-pop wb-streak" role="dialog" aria-label="Welcome back">
        {x("on-dark")}
        <div className="wb-streak-hero">
          <span className="wb-streak-flame" aria-hidden="true">🔥</span>
          <span className="wb-streak-n">{days}</span>
          <span className="wb-streak-label">{days === 1 ? "day streak" : days ? "day streak" : "Start a streak today"}</span>
          <span className="wb-streak-week" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <span key={i} className={`wb-day${i < days % 7 || (days >= 7 && days % 7 === 0) ? " on" : ""}${i === days % 7 ? " now" : ""}`} />)}
          </span>
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

  return (
    <div className="welcome-pop" role="dialog" aria-label="Welcome back">
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
