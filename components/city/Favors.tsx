"use client";

import { useEffect, useRef, useState } from "react";
import { LEVEL_NAME, toNext, type Bond, type BondLevel, type FavorPeek } from "@/lib/npcBonds";
import { sparks } from "../motion";

// NPC favors and friendships (migration 0159; owner, Nov 3): under a regular's line, the favor they'd ask ("🤝 Can you
// help?") and how close you are (hearts, the next level, "on the house" for a Friend, the big favor back for Family).

export interface FavorHandlers {
  /** Asks the server once per visit whether this regular has a favor today. */
  load: (npc: string) => void;
  peek: (npc: string) => FavorPeek | null;
  bond: (npc: string) => Bond | null;
  busy: boolean;
  /** A card is open over the room: a level gained waits to play until it closes. */
  hold?: boolean;
  onHelp: (npc: string) => void;
  onPerk: (npc: string) => void;
  onBig: (npc: string) => void;
}

const HEARTS = { stranger: 0, friendly: 1, friend: 2, family: 3 } as const;
const UNLOCK: Partial<Record<BondLevel, string>> = { friend: "On the house unlocked", family: "Big favor back unlocked" };
/** The level each regular was at when last shown this session, so a level gained while away still plays once. */
const seenLevel = new Map<string, BondLevel>();

export function FavorStrip({ npc, name, favor }: { npc: string; name: string; favor: FavorHandlers }) {
  const peek = favor.peek(npc);
  const bond = favor.bond(npc);
  const level = bond?.level ?? "stranger";
  const next = toNext(bond?.favors ?? 0);
  const hearts = HEARTS[level];
  // Hearts fill up (owner, Nov 3, the motion kit): a level gained pops the new heart with sparks and a ribbon.
  const [levelUp, setLevelUp] = useState<BondLevel | null>(null);
  const heartsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!bond || favor.hold) return;
    const before = seenLevel.get(npc);
    seenLevel.set(npc, level);
    if (!before || HEARTS[level] <= HEARTS[before] || bond.burnedUntil) return;
    setLevelUp(level);
    const s = setTimeout(() => sparks(heartsRef.current?.children[HEARTS[level] - 1], 14, 46), 120);
    const t = setTimeout(() => setLevelUp(null), 3200);
    return () => { clearTimeout(s); clearTimeout(t); };
  }, [npc, level, bond, favor.hold]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="favor-strip">
      {peek && (
        <button className="favor-ask" disabled={favor.busy} onClick={() => favor.onHelp(npc)}>
          <span className="favor-ask-emoji" aria-hidden="true">{peek.emoji}</span>
          <span className="favor-ask-text"><b>🤝 {name} needs a hand</b><span>{peek.title}</span></span>
          <span className="favor-ask-go" aria-hidden="true">›</span>
        </button>
      )}
      {(bond || peek) && (
        <div className="favor-bond">
          {bond?.burnedUntil ? (
            <span className="favor-level burned">💔 {name} isn&apos;t speaking to you about favors right now.</span>
          ) : (
            <span className="favor-level" aria-label={`${LEVEL_NAME[level]} with ${name}`}>
              <span className="favor-hearts" ref={heartsRef} aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={`${i < hearts ? "on" : ""}${levelUp && i === hearts - 1 ? " pop" : ""}`}>♥</span>)}</span>
              <b>{LEVEL_NAME[level]}</b>
              {levelUp && <span className="favor-ribbon" role="status">{UNLOCK[levelUp] ?? "Level up!"}</span>}
              {next && <span className="meta">{next.need} favor{next.need === 1 ? "" : "s"} to {LEVEL_NAME[next.level]}</span>}
            </span>
          )}
          {bond?.perkReady && <button className="btn btn-secondary btn-sm" disabled={favor.busy} onClick={() => favor.onPerk(npc)}>☕ On the house</button>}
          {bond?.bigReady && <button className="btn btn-taxi btn-sm" disabled={favor.busy} onClick={() => favor.onBig(npc)}>💛 Ask a favor back</button>}
        </div>
      )}
    </div>
  );
}
