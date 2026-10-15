"use client";

// Player ranks (owner, Oct 15; lib/ranks.ts): the rank chip, the climb on the profile, the full list and
// the rank-up reveal.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RANKS, money, nextRank, nextRankLine, rankFor, type Rank } from "@/lib/ranks";
import { Sheet } from "../Sheet";
import { SheetTitle } from "../city/Common";

export function RankChip({ rank, onClick }: { rank: Rank; onClick?: () => void }) {
  const cls = `rank-chip${rank.level === 10 ? " god" : rank.level >= 8 ? " rich" : ""}`;
  const inner = <><span aria-hidden="true">{rank.emoji}</span> {rank.title}</>;
  return onClick
    ? <button className={cls} onClick={onClick} aria-label={`${rank.title}, rank ${rank.level} of 10. See every rank`}>{inner}</button>
    : <span className={cls} title={`Rank ${rank.level} of 10`}>{inner}</span>;
}

/** On the profile: the rank, how far to the next one (clout or net worth) and a way to see them all. */
export function RankClimb({ clout, netWorth }: { clout: number; netWorth: number }) {
  const [all, setAll] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rank = rankFor(clout, netWorth);
  const next = nextRank(clout, netWorth);
  return (
    <div className="rank-climb">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <RankChip rank={rank} onClick={() => setAll(true)} />
        <span className="meta">Rank {rank.level} of 10</span>
      </div>
      {next && <div className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.round(next.progress * 100)}%` }} /></div>}
      <p className="meta" style={{ margin: 0 }}>{nextRankLine(clout, netWorth)}</p>
      {/* Opened from inside the profile sheet, whose layer would hold it in place: render at the page. */}
      {mounted && createPortal(<RanksSheet open={all} onClose={() => setAll(false)} clout={clout} netWorth={netWorth} />, document.body)}
    </div>
  );
}

/** Every rank, and how to get there either way. */
export function RanksSheet({ open, onClose, clout, netWorth }: { open: boolean; onClose: () => void; clout: number; netWorth: number }) {
  const mine = rankFor(clout, netWorth).level;
  return (
    <Sheet open={open} onClose={onClose} label="Ranks">
      <SheetTitle>Ranks</SheetTitle>
      <p className="meta" style={{ margin: "4px 0 12px" }}>Climb with clout or with money. Whichever gets you higher counts.</p>
      <div className="rank-list">
        {[...RANKS].reverse().map((r) => (
          <div key={r.level} className={`rank-row${r.level === mine ? " mine" : r.level < mine ? " done" : ""}`}>
            <span className="rank-row-emoji" aria-hidden="true">{r.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{r.title}</b>{r.level === mine && <span className="rank-you">You</span>}
              <span className="meta" style={{ display: "block" }}>
                {r.level === 1 ? "Where everyone starts" : `${r.clout.toLocaleString("en-US")} clout or ${money(r.netWorth)}`}
              </span>
            </span>
            {r.level < mine && <span aria-label="Reached">✓</span>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Crossing into a new rank: the reveal (bigger for the top three). */
export function RankUpCard({ rank, name, onClose }: { rank: Rank; name: string; onClose: () => void }) {
  const share = async () => {
    const text = `${name} just hit ${rank.title} in Clout City. ${rank.line}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch { /* cancelled */ }
  };
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={`New rank: ${rank.title}`}>
      <div className="scrim" onClick={onClose} />
      <div className={`modal-card rank-up${rank.level >= 8 ? " top" : ""}${rank.level === 10 ? " god" : ""}`}>
        <span className="overline rank-up-kicker">New rank · {rank.level} of 10</span>
        <span className="rank-up-emoji" aria-hidden="true">{rank.emoji}</span>
        <p className="display-md" style={{ margin: "6px 0 8px" }}>{rank.title}</p>
        <p className="body" style={{ margin: 0 }}>{rank.line}</p>
        <div className="row" style={{ gap: 8, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void share()}>Share</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} onClick={onClose}>{rank.level === 10 ? "Bow" : "Let's go"}</button>
        </div>
      </div>
    </div>
  );
}
