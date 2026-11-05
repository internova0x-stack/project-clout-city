"use client";

import { STARTER_FINISH, STARTER_MISSIONS, dayLabel, nextDay, nextMission, rewardLine, type StarterMission } from "@/lib/starter";
import { LOLA_PORTRAIT } from "@/lib/cast";
import { Sheet } from "../Sheet";

// Starter Week (owner, Oct 26; by the day, migration 0163, owner Nov 5): today's mission in a pill under "Invite your
// Crew", and the week in a sheet, grouped by day, with a Go button for the one that's next. A few missions open each New
// York day; one done early still counts and pays. Later days show what they hold but no Go.

export function StarterPill({ done, day, onOpen }: { done: readonly string[]; day: number; onOpen: () => void }) {
  const m = nextMission(done, day);
  const soon = m ? null : nextDay(done, day);
  if (!m && !soon) return null;
  const count = `⭐ ${done.length}/${STARTER_MISSIONS.length}`;
  return (
    <button className="pill-glass glass-hud starter-pill" onClick={onOpen}
      aria-label={m ? `Starter Week, ${done.length} of ${STARTER_MISSIONS.length} done. Next: ${m.title}` : `Starter Week: today's done. More ${soon!.day === day + 1 ? "tomorrow" : `on ${dayLabel(soon!.day)}`}`}>
      <span className="starter-count">{count}</span>
      <span className="starter-next">{m ? `${m.emoji} ${m.title}` : `✅ ${soon!.count} more ${soon!.day === day + 1 ? "tomorrow" : `on ${dayLabel(soon!.day)}`}`}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function StarterSheet({ open, onClose, done, day, onGo, onHide }: {
  open: boolean; onClose: () => void; done: readonly string[]; day: number;
  onGo: (m: StarterMission) => void; onHide: () => void;
}) {
  const next = nextMission(done, day);
  const days = [...new Set(STARTER_MISSIONS.map((m) => m.day))];
  return (
    <Sheet open={open} onClose={onClose} label="Starter Week" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <span className="overline">Starter Week · {dayLabel(day)}</span>
          <h2 className="display-md" style={{ margin: 0 }}>Your first week in Queens</h2>
          <span className="meta">A few new things each day, ending with your first rent. Each one pays.</span>
        </div>
        <div className="home-score-bar" aria-hidden="true"><i style={{ width: `${(100 * done.length) / STARTER_MISSIONS.length}%`, background: "var(--neon-500)" }} /></div>
        {days.map((d) => {
          const list = STARTER_MISSIONS.filter((m) => m.day === d);
          const locked = d > day;
          // A finished day folds into one line, so today is at the top of the list.
          if (list.every((m) => done.includes(m.id))) return (
            <div key={d} className="list-row starter-row done starter-day-done">
              <span className="starter-dot" aria-hidden="true">✓</span>
              <span className="title" style={{ flex: 1 }}>{dayLabel(d)} · {list.length === 1 ? "done" : `all ${list.length} done`}</span>
            </div>
          );
          return (
            <div key={d} className="stack-8">
              <span className="overline">{dayLabel(d)}{d === day ? " · today" : locked ? (d === day + 1 ? " · tomorrow" : "") : ""}</span>
              {list.map((m) => {
                const state = done.includes(m.id) ? "done" : m.id === next?.id ? "now" : "later";
                return (
                  <div key={m.id} className={`list-row starter-row ${state}${locked && state !== "done" ? " locked" : ""}`}>
                    <span className="starter-dot" aria-hidden="true">{state === "done" ? "✓" : locked ? "🔒" : m.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="title" style={{ display: "block" }}>{m.title}</span>
                      <span className="meta">{state === "now" ? `${m.why} ${rewardLine(m.reward)}` : rewardLine(m.reward)}</span>
                    </span>
                    {state === "now" && <button className="btn btn-taxi btn-sm" onClick={() => onGo(m)}>Go</button>}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="crew-bonus">🏅 All {STARTER_MISSIONS.length}: the “{STARTER_FINISH.name}” badge, C${STARTER_FINISH.cash.toLocaleString("en-US")} and a {STARTER_FINISH.furniture.toLowerCase()}.</div>
        <button className="link-btn" style={{ alignSelf: "center" }} onClick={onHide}>Hide Starter Week</button>
        <span className="meta" style={{ textAlign: "center" }}>It ends by itself after rent day.</span>
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
