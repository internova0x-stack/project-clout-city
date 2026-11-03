"use client";

// Player ranks (owner, Oct 15; lib/ranks.ts): the rank chip, the climb on the profile, the full list and
// the rank-up reveal.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RANKS, money, nextRank, nextRankLine, rankFor, type Rank } from "@/lib/ranks";
import { Sheet } from "../Sheet";
import { SheetTitle } from "../city/Common";
import type { Celebration } from "../Celebrate";

export function RankChip({ rank, onClick }: { rank: Rank; onClick?: () => void }) {
  const cls = `rank-chip${rank.level === 10 ? " god" : rank.level >= 8 ? " rich" : ""}`;
  const inner = <><span aria-hidden="true">{rank.emoji}</span> {rank.title}</>;
  return onClick
    ? <button className={cls} onClick={onClick} aria-label={`${rank.title}, rank ${rank.level} of 10. See every rank`}>{inner}</button>
    : <span className={cls} title={`Rank ${rank.level} of 10`}>{inner}</span>;
}

/** On the profile: the rank, how far to the next one (clout or net worth) and a way to see them all. */
export function RankClimb({ clout, netWorth, best }: { clout: number; netWorth: number; best?: number }) {
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
      {best && best > rank.level && <span className="meta">Best: {RANKS[best - 1].emoji} {RANKS[best - 1].title}</span>}
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

/** A rank-up as a celebration (components/Celebrate.tsx): a takeover, and the top rank a legend. */
export function rankCelebration(rank: Rank, name: string): Celebration {
  const share = `${name} just hit ${rank.title} in Clout City. ${rank.line}`;
  if (rank.level >= 10) {
    return { rung: 4, emoji: rank.emoji, tag: "Rank 10 of 10", num: "10", unit: "rank of 10", title: rank.title, line: rank.line, art: "story",
      rewards: [{ text: "👑 The top of Clout City" }], share, cta: "Bow" };
  }
  return {
    rung: 3, emoji: rank.emoji, num: String(rank.level), tag: "New rank", title: rank.title, line: `Rank ${rank.level} of 10. ${rank.line}`,
    rewards: rank.level === 2 ? [{ text: "🏪 Businesses" }, { text: "💼 Jobs" }, { text: "🗳️ Campaigns" }] : undefined,
    lola: RANK_LOLA[rank.level] ?? "Look who\u2019s climbing. I knew you when.", share, cta: "Let's go",
  };
}
// Lola on each rank (docs/culture/VOICE.md: short, knowing, a little mean, never cruel).
const RANK_LOLA: Record<number, string> = {
  2: "Rank 2. You can open a business now. Please don\u2019t open a candle shop.",
  3: "Side Hustler. Sleep is for people with one income.",
  4: "Eleven people know your name now. Eleven more than last week.",
  5: "On the list. Act like you\u2019ve been here before. You haven\u2019t.",
  6: "Local celebrity. Strangers will now ask for selfies and then not post them.",
  7: "Nepo baby energy, no nepo. Respect.",
  8: "New money. Take the price tags off. Or don\u2019t, it\u2019s a look.",
  9: "A billionaire. Allegedly. I\u2019ll be watching the asterisk.",
};
