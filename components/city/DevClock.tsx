"use client";

import { useState } from "react";

/** Staging only (game_settings dev.tools): move the game clock to test a week of play. */
export function DevClock({ offsetSeconds, onSet, busy }: { offsetSeconds: number; onSet: (hours: number) => void; busy: boolean }) {
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
        </div>
      ) : (
        <button className="pill-status dev-clock-pill" onClick={() => setOpen(true)} aria-label="Time travel (staging)">⏩ {label}</button>
      )}
    </div>
  );
}
