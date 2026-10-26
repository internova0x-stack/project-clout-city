"use client";

import { STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, rewardLine, type StarterMission } from "@/lib/starter";
import { Sheet } from "../Sheet";

// Starter Week (owner, Oct 26): the current mission in a pill under "Invite your Crew", and the whole list in a sheet
// with a Go button for the one that's next. Daily tasks and the tour are unchanged.

export function StarterPill({ done, onOpen }: { done: number; onOpen: () => void }) {
  const m = STARTER_MISSIONS[done];
  if (!m) return null;
  return (
    <button className="pill-glass glass-hud starter-pill" onClick={onOpen} aria-label={`Starter Week, ${done} of ${STARTER_MISSIONS.length} done. Next: ${m.title}`}>
      <span className="starter-count">⭐ {done}/{STARTER_MISSIONS.length}</span>
      <span className="starter-next">{m.emoji} {m.title}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function StarterSheet({ open, onClose, done, daysLeft, onGo, onHide }: {
  open: boolean; onClose: () => void; done: number; daysLeft: number;
  onGo: (m: StarterMission) => void; onHide: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Starter Week" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <span className="overline">Starter Week · {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
          <h2 className="display-md" style={{ margin: 0 }}>Your first week in Queens</h2>
          <span className="meta">Ten small things that show you how the city works. Each one pays.</span>
        </div>
        <div className="home-score-bar" aria-hidden="true"><i style={{ width: `${(100 * done) / STARTER_MISSIONS.length}%`, background: "var(--neon-500)" }} /></div>
        <div className="stack-8">
          {STARTER_MISSIONS.map((m, i) => {
            const state = i < done ? "done" : i === done ? "now" : "later";
            return (
              <div key={m.id} className={`list-row starter-row ${state}`}>
                <span className="starter-dot" aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ display: "block" }}>{m.emoji} {m.title}</span>
                  <span className="meta">{state === "now" ? `${m.why} ${rewardLine(m.reward)}` : rewardLine(m.reward)}</span>
                </span>
                {state === "now" && <button className="btn btn-taxi btn-sm" onClick={() => onGo(m)}>Go</button>}
              </div>
            );
          })}
        </div>
        <div className="crew-bonus">🏅 All ten: the “{STARTER_FINISH.name}” badge, C${STARTER_FINISH.cash} and a {STARTER_FINISH.furniture.toLowerCase()}.</div>
        <button className="link-btn" style={{ alignSelf: "center" }} onClick={onHide}>Hide Starter Week</button>
        <span className="meta" style={{ textAlign: "center" }}>It goes away by itself after {STARTER_DAYS} days.</span>
      </div>
    </Sheet>
  );
}
