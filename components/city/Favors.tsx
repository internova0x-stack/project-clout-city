"use client";

import { LEVEL_NAME, toNext, type Bond, type FavorPeek } from "@/lib/npcBonds";

// NPC favors and friendships (migration 0159; owner, Nov 3): under a regular's line, the favor they'd ask ("🤝 Can you
// help?") and how close you are (hearts, the next level, "on the house" for a Friend, the big favor back for Family).

export interface FavorHandlers {
  /** Asks the server once per visit whether this regular has a favor today. */
  load: (npc: string) => void;
  peek: (npc: string) => FavorPeek | null;
  bond: (npc: string) => Bond | null;
  busy: boolean;
  onHelp: (npc: string) => void;
  onPerk: (npc: string) => void;
  onBig: (npc: string) => void;
}

const HEARTS = { stranger: 0, friendly: 1, friend: 2, family: 3 } as const;

export function FavorStrip({ npc, name, favor }: { npc: string; name: string; favor: FavorHandlers }) {
  const peek = favor.peek(npc);
  const bond = favor.bond(npc);
  const level = bond?.level ?? "stranger";
  const next = toNext(bond?.favors ?? 0);
  const hearts = HEARTS[level];
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
              <span className="favor-hearts" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={i < hearts ? "on" : ""}>♥</span>)}</span>
              <b>{LEVEL_NAME[level]}</b>
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
