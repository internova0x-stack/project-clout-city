"use client";

import { CloseIcon } from "../icons";
import { guardTaps } from "@/lib/tapGuard";
import type { WelcomeAction } from "@/lib/welcomePick";

// The welcome back (owner, Nov 1: "a pop up instead of a modal", "a welcome back treatment like mobile games have"; Nov 3:
// "too much information which will lead to indecision. Pick the highest leverage action"): once a New York day, when nothing
// else is on screen, a card floats over the game (no scrim, the game stays live): a greeting with the streak, and ONE thing
// to do, picked for the player's situation by lib/welcomePick.ts. One button, or Later.

export function DailyWelcome({ open, name, hello, streak, action, onGo, onLater }: {
  open: boolean;
  name: string;
  /** "Good morning" … by the city clock. */
  hello: string;
  /** The all-five streak in days (0 = none). */
  streak: number;
  action: WelcomeAction | null;
  onGo: () => void;
  /** Later or ✕: put off for today. */
  onLater: () => void;
}) {
  if (!open || !action) return null;
  const later = () => { guardTaps(); onLater(); };
  return (
    <div className="welcome-pop" role="dialog" aria-label="Welcome back">
      <div className="welcome-hero">
        <button className="daily-pop-x welcome-x" onClick={later} aria-label="Close"><CloseIcon size={14} /></button>
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
      <div className="daily-pop-actions">
        <button className="btn btn-ghost btn-sm" onClick={later}>Later</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={() => { guardTaps(); onGo(); }}>{action.cta}</button>
      </div>
    </div>
  );
}
