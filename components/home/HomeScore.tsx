"use client";

import { HOME_SCORE, homeTips, nextMilestone, type HomeScore } from "@/lib/homeScore";
import { ChevronRightIcon } from "../icons";
import { Sheet } from "../Sheet";

// The home score (migration 0120, owner Oct 26; spec section 26): what it is, what makes it, what to add next, and the
// milestones that pay clout. Relative to the home, so a small place can score 100 too.

const ROOMS: Record<string, { label: string; emoji: string }> = {
  living: { label: "Living", emoji: "🛋️" }, bedroom: { label: "Bedroom", emoji: "🛏️" },
  dining: { label: "Dining", emoji: "🍽️" }, decor: { label: "Decor", emoji: "🪴" },
};

function Bar({ label, value, max, note }: { label: string; value: number; max: number; note: string }) {
  return (
    <div className="stack-4">
      <div className="row" style={{ gap: 8 }}>
        <span className="body-strong" style={{ flex: 1 }}>{label}</span>
        <b>{value}<span className="meta"> / {max}</span></b>
      </div>
      <div className="home-score-bar" aria-hidden="true"><i style={{ width: `${(100 * value) / max}%` }} /></div>
      <span className="meta">{note}</span>
    </div>
  );
}

export function HomeScoreSheet({ open, onClose, s, reached, onShop }: {
  open: boolean; onClose: () => void; s: HomeScore | null; reached: number[];
  /** Opens the Shop's Furniture tab at a room ("art" for paintings). */
  onShop: (room?: string) => void;
}) {
  const next = s ? nextMilestone(s.score) : null;
  const tips = s ? homeTips(s) : [];
  return (
    <Sheet open={open} onClose={onClose} label="Crib Rating" tall>
      {!s ? <p className="meta">Loading…</p> : (
        <div className="stack-16">
          <div className="home-score-head">
            <span className="home-score-ring" style={{ ["--p" as string]: `${s.score}%` }}>
              <b>{s.score}</b>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="overline" style={{ display: "block" }}>Crib Rating</span>
              <span className="display-md" style={{ display: "block" }}>{s.tier}</span>
              <span className="meta">Out of 100, for the place you live now. Only pieces you&apos;ve placed count.</span>
            </span>
          </div>

          <Bar label="Rooms" value={Object.values(s.rooms).filter(Boolean).length * HOME_SCORE.roomPoints} max={HOME_SCORE.rooms.length * HOME_SCORE.roomPoints}
            note="10 for every room with a piece you bought (the ones the place came with don't count)." />
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {HOME_SCORE.rooms.map((r) => (
              <span key={r} className={`tag ${s.rooms[r] ? "tag-positive" : "tag-neutral"}`}>{s.rooms[r] ? "✓" : ROOMS[r].emoji} {ROOMS[r].label}</span>
            ))}
          </div>
          <Bar label="Quality" value={s.quality.points} max={HOME_SCORE.qualityPoints}
            note={`${s.quality.stars} of ${s.quality.target} stars placed. Each piece counts once, by its stars; bigger homes need more.`} />
          <Bar label="Wall art" value={s.art.points} max={HOME_SCORE.artPoints}
            note={s.art.count ? `${s.art.count} painting${s.art.count === 1 ? "" : "s"} on the walls. ${HOME_SCORE.artEach} each, up to ${HOME_SCORE.artPoints / HOME_SCORE.artEach}.` : `None yet. Every painting you hang adds ${HOME_SCORE.artEach}.`} />

          {tips.length > 0 && (
            <div className="stack-8">
              <p className="overline" style={{ margin: 0 }}>Next up</p>
              {tips.map((t) => (
                <button key={t.text} className="list-row" onClick={() => onShop(t.room)}>
                  <span className="tag tag-event" style={{ minWidth: 44, justifyContent: "center" }}>+{t.gain}</span>
                  <span className="body" style={{ flex: 1, textAlign: "left" }}>{t.text}</span>
                  <ChevronRightIcon size={16} />
                </button>
              ))}
            </div>
          )}

          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Milestones</p>
            {HOME_SCORE.milestones.map((m) => {
              const got = reached.includes(m.score) || s.score >= m.score;
              return (
                <div key={m.score} className="row" style={{ gap: 10 }}>
                  <span className={`home-score-dot${got ? " on" : ""}`} aria-hidden="true">{got ? "✓" : m.score}</span>
                  <span className="body" style={{ flex: 1 }}>Reach {m.score}</span>
                  <span className={got ? "meta" : "body-strong"}>{got ? "Paid" : `+${m.clout} 🔥`}</span>
                </div>
              );
            })}
            {next && <span className="meta">{next.score - s.score} to go for +{next.clout} clout.</span>}
          </div>
          <button className="btn btn-taxi" onClick={() => onShop(tips[0]?.room)}>Shop furniture and art</button>
        </div>
      )}
    </Sheet>
  );
}
