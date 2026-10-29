"use client";

import { STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, nextMission, rewardLine, type StarterMission } from "@/lib/starter";
import { LOLA_PORTRAIT } from "@/lib/cast";
import { Sheet } from "../Sheet";

// Starter Week (owner, Oct 26): the current mission in a pill under "Invite your Crew", and the whole list in a sheet
// with a Go button for the one that's next. Missions can be done in any order (migration 0122 marks them as they happen);
// the pill shows the first one in the list that isn't done. Daily tasks and the tour are unchanged.

export function StarterPill({ done, onOpen }: { done: readonly string[]; onOpen: () => void }) {
  const m = nextMission(done);
  if (!m) return null;
  return (
    <button className="pill-glass glass-hud starter-pill" onClick={onOpen} aria-label={`Starter Week, ${done.length} of ${STARTER_MISSIONS.length} done. Next: ${m.title}`}>
      <span className="starter-count">⭐ {done.length}/{STARTER_MISSIONS.length}</span>
      <span className="starter-next">{m.emoji} {m.title}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function StarterSheet({ open, onClose, done, daysLeft, onGo, onHide }: {
  open: boolean; onClose: () => void; done: readonly string[]; daysLeft: number;
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
        <div className="home-score-bar" aria-hidden="true"><i style={{ width: `${(100 * done.length) / STARTER_MISSIONS.length}%`, background: "var(--neon-500)" }} /></div>
        <div className="stack-8">
          {STARTER_MISSIONS.map((m, i) => {
            const state = done.includes(m.id) ? "done" : m.id === nextMission(done)?.id ? "now" : "later";
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

/** Rank 2 opens Businesses and Jobs (owner, Oct 26): Lola says so once, in the tour's bubble, after the rank-up card. */
export function UnlockReveal({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  return (
    <div className="tour" role="dialog" aria-label="New for you">
      <div className="tour-dim" onClick={onClose} />
      <div className="lola-tip">
        <div className="lola-tip-bubble">
          <p className="lola-tip-who">Lola Lowdown <span>· New for you</span></p>
          <p className="lola-tip-text">EXCLUSIVE 🚨 Rank 2 just opened three new apps on your phone: 🏪 Businesses, 💼 Jobs and 🗳️ Campaign. Real money starts here, babe. Real power too 👀</p>
          <button className="btn btn-taxi lola-tip-next" onClick={onOpen}>Open my phone</button>
          <button className="lola-tip-skip" onClick={onClose}>Later</button>
        </div>
        <div className="lola-tip-head" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOLA_PORTRAIT} alt="" width={64} height={64} />
          <span className="lola-tip-kiss">💋</span>
        </div>
      </div>
    </div>
  );
}
