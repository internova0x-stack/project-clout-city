"use client";

import { useState } from "react";

export interface DevStoryControls {
  /** The pilot's story day today, or null when it isn't scheduled. */
  day: number | null;
  lastDay: number;
  sideArcs: boolean;
  onStart: (day: number | null) => void;
  onSideArcs: (on: boolean) => void;
}

/** Staging only (game_settings dev.tools): move the game clock to test a week of play, and jump the story. */
export function DevClock({ offsetSeconds, onSet, busy, story }: { offsetSeconds: number; onSet: (hours: number) => void; busy: boolean; story?: DevStoryControls }) {
  const [open, setOpen] = useState(false);
  const hours = offsetSeconds / 3600;
  const label = hours === 0 ? "now" : `+${hours >= 24 ? `${(hours / 24).toFixed(hours % 24 ? 1 : 0)} d` : `${hours.toFixed(1)} h`}`;
  return (
    <div className="dev-clock">
      {open ? (
        <div className="dev-clock-panel" role="group" aria-label="Time travel (staging)">
          <span className="meta" style={{ color: "#fff" }}>⏩ Game clock {label}</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {[["+1 h", 1], ["+6 h", 6], ["+1 day", 24], ["+7 days", 168], ["+30 days", 720]].map(([l, h]) => (
              <button key={l} className="chip" disabled={busy} onClick={() => onSet(hours + (h as number))}>{l}</button>
            ))}
            <button className="chip" disabled={busy || hours === 0} onClick={() => onSet(0)}>Reset</button>
            <button className="chip" onClick={() => setOpen(false)}>Hide</button>
          </div>
          {story && (
            <>
              <span className="meta" style={{ color: "#fff" }}>📰 Sarah Bird {story.day === null ? "not scheduled" : `on Day ${story.day} of ${story.lastDay}`}</span>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {story.day === null ? (
                  <button className="chip" disabled={busy} onClick={() => story.onStart(1)}>Start Day 1 today</button>
                ) : (
                  <>
                    <button className="chip" disabled={busy || story.day <= 1} onClick={() => story.onStart(story.day! - 1)}>Day −1</button>
                    <button className="chip" disabled={busy || story.day > story.lastDay} onClick={() => story.onStart(story.day! + 1)}>Day +1</button>
                    <button className="chip" disabled={busy} onClick={() => story.onStart(null)}>Unschedule</button>
                  </>
                )}
                <button className="chip" disabled={busy} onClick={() => story.onSideArcs(!story.sideArcs)}>{story.sideArcs ? "Lock side arcs" : "Unlock side arcs"}</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className="pill-status dev-clock-pill" onClick={() => setOpen(true)} aria-label="Time travel (staging)">⏩ {label}</button>
      )}
    </div>
  );
}
