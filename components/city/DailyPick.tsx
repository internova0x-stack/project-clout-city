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
/** One line of "Today": the tasks, the goal that's nearly done, the skill about to level up, the story's new chapter. */
export interface WelcomeRow { id: string; emoji: string; kicker: string; title: string; sub: string; progress?: number; hot?: boolean; onTap: () => void }

export function DailyWelcome({ open, name, hello, streak, chips, rows, pick, here, onGo, onClose }: {
  open: boolean;
  name: string;
  /** "Good morning" … by the city clock. */
  hello: string;
  /** The all-five streak: days in a row and the next reward day (null with no goals yet). */
  streak: { current: number; nextDay: number; doneToday: boolean } | null;
  /** What's waiting since you left: up to three. */
  chips: WelcomeChip[];
  /** Today's mix, in order (up to four). */
  rows: WelcomeRow[];
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
      {(rows.length > 0 || (pick && place)) && (
        <div className="welcome-section">
          <span className="overline">Today</span>
          <div className="welcome-rows">
            {pick && place && why && (
              <button className="welcome-row pick" onClick={() => { guardTaps(); onGo(); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="welcome-row-lola" src={LOLA_PORTRAIT} alt="" width={40} height={40} />
                <span className="welcome-row-text">
                  <span className="welcome-row-kicker">{pick.why === "happening" && <span className="life-live" aria-hidden="true" />}Lola&apos;s pick · {why.tag}</span>
                  <span className="welcome-row-title">{pick.activity.emoji} {pick.activity.title}</span>
                  <span className="welcome-row-sub">{place.emoji} {place.name}{pick.activity.energy ? ` · ⚡ ${pick.activity.energy}` : ""}{pick.note ? ` · ${pick.note}` : ""}</span>
                </span>
                <span className="welcome-row-go" aria-hidden="true">›</span>
              </button>
            )}
          </div>
          {rows.length > 0 && (
            <div className="welcome-tiles">
              {rows.slice(0, 4).map((r) => (
                <button key={r.id} className={`welcome-tile${r.hot ? " hot" : ""}`} onClick={() => { guardTaps(); r.onTap(); }} aria-label={`${r.kicker}: ${r.title}. ${r.sub}`}>
                  <span className="welcome-tile-top"><span aria-hidden="true">{r.emoji}</span>{r.kicker}</span>
                  <span className="welcome-tile-title">{r.title}</span>
                  <span className="welcome-tile-sub">{r.sub}</span>
                  {r.progress != null && <span className="welcome-bar"><span style={{ width: `${Math.round(Math.max(0.04, Math.min(1, r.progress)) * 100)}%` }} /></span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="daily-pop-actions">
        <button className="btn btn-ghost btn-sm" onClick={close}>Later</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={() => { guardTaps(); if (pick) onGo(); else if (rows[0]) rows[0].onTap(); else onClose(); }}>
          {pick && here ? "Do it now" : "Let's go"}
        </button>
      </div>
    </div>
  );
}
