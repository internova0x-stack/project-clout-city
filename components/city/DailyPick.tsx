"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { placeById } from "@/lib/city";
import type { TodayPick } from "@/lib/placeLife";
import { CloseIcon } from "../icons";
import { guardTaps } from "@/lib/tapGuard";

// The welcome back (owner, Nov 1: "a pop up that shows an activity to be completed"; "a pop up instead of a modal"; "a sort of
// welcome back treatment like mobile games have"): once a New York day, when nothing else is on screen, a card floats over the
// game (no scrim, the game stays live): a greeting by the hour, the task streak, what's waiting since you left (messages, rent,
// rewards, today's tasks), and Lola's pick of one thing worth doing today (a happening on now, a regular card one visit from its
// reward, or a place to try). Let's go, or ✕ / Later.

const WHY: Record<TodayPick["why"], { tag: string; lola: string }> = {
  happening: { tag: "Happening now", lola: "Drop everything. This is only on for a bit." },
  stamp: { tag: "One visit from a reward", lola: "You're one visit from being a real regular." },
  new: { tag: "Try something new", lola: "You've never done this. Everyone who matters has." },
};

export interface WelcomeChip { id: string; emoji: string; text: string; onTap: () => void }

export function DailyWelcome({ open, name, hello, streak, chips, pick, here, onGo, onClose }: {
  open: boolean;
  name: string;
  /** "Good morning" … by the city clock. */
  hello: string;
  /** The all-five streak: days in a row and the next reward day (null with no goals yet). */
  streak: { current: number; nextDay: number; doneToday: boolean } | null;
  /** What's waiting since you left: up to three. */
  chips: WelcomeChip[];
  pick: TodayPick | null;
  here: boolean;
  onGo: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const place = pick ? placeById(pick.place) : undefined;
  const why = pick ? WHY[pick.why] : null;
  const close = () => { guardTaps(); onClose(); };
  return (
    <div className="welcome-pop" role="dialog" aria-label="Welcome back">
      <div className="welcome-hero">
        <button className="daily-pop-x welcome-x" onClick={close} aria-label="Close"><CloseIcon size={14} /></button>
        <span className="welcome-spark" aria-hidden="true">✦</span>
        <span className="welcome-spark s2" aria-hidden="true">✦</span>
        <span className="welcome-hello">{hello},</span>
        <span className="welcome-name">{name}</span>
        {streak && (
          <span className="welcome-streak">
            <span className="welcome-flame" aria-hidden="true">🔥</span>
            {streak.current > 0
              ? <><b>Day {streak.current}</b> streak{!streak.doneToday ? " · finish today's five to keep it" : " · locked in today"}</>
              : <>Start a streak: finish all five tasks today</>}
          </span>
        )}
      </div>
      {chips.length > 0 && (
        <div className="welcome-section">
          <span className="overline">Since you left</span>
          <div className="welcome-chips">
            {chips.slice(0, 3).map((c) => (
              <button key={c.id} className="welcome-chip" onClick={() => { guardTaps(); c.onTap(); }}>
                {c.emoji && <span aria-hidden="true">{c.emoji}</span>}{c.text}
              </button>
            ))}
          </div>
        </div>
      )}
      {pick && place && why && (
        <div className="welcome-section">
          <div className="daily-pop-lola">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOLA_PORTRAIT} alt="" width={32} height={32} />
            <span><b>Lola:</b> {why.lola}</span>
          </div>
          <div className="daily-pop-body">
            <span className="daily-pop-emoji" aria-hidden="true">{pick.activity.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="daily-pick-tag">{pick.why === "happening" && <span className="life-live" aria-hidden="true" />}{why.tag}</span>
              <span className="daily-pop-title">{pick.activity.title}</span>
              <span className="meta" style={{ display: "block" }}>{place.emoji} {place.name}{pick.activity.energy ? ` · ⚡ ${pick.activity.energy}` : ""}</span>
              {pick.note && <span className="daily-pop-note">{pick.why === "stamp" ? `🎟️ ${pick.note}` : `🔥 ${pick.note}`}</span>}
            </span>
          </div>
        </div>
      )}
      <div className="daily-pop-actions">
        <button className="btn btn-ghost btn-sm" onClick={close}>Later</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={() => { guardTaps(); if (pick) onGo(); else onClose(); }}>
          {pick ? (here ? "Do it now" : "Let's go") : "Let's go"}
        </button>
      </div>
    </div>
  );
}
