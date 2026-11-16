"use client";

import { useState } from "react";
import { effectLine } from "@/lib/choices";
import type { ActivityView, LifeResult, LifeView, MomentView } from "@/lib/placeLife";
import { Sheet } from "../Sheet";

// Living places (owner, Nov 1): what's happening here, the place's own things to do, and its regular card, on the place
// panel; the activity or crowd moment opens as a card (the Moral Choices format: one line per choice, the picked one shows
// You get / It costs, then Do it), and its receipt. The server rolls and pays (lib/placeLife.ts, migration 0157).

const hourLabel = (h: number) => { const x = ((h % 24) + 24) % 24; return `${x % 12 === 0 ? 12 : x % 12} ${x < 12 ? "AM" : "PM"}`; };

/** What a regular-card milestone pays: "+C$40 · +25 🔥". */
const perkReward = (p: { cash?: number; clout?: number }) =>
  [p.cash ? `+C$${p.cash.toLocaleString("en-US")}` : "", p.clout ? `+${p.clout} 🔥` : ""].filter(Boolean).join(" · ");

/** The strip on the place panel: Happening now, Things to do, the regular card. */
export function LifeStrip({ view, onOpen, onStamp, busy }: {
  view: LifeView;
  onOpen: (a: ActivityView) => void;
  onStamp: (days: number) => void;
  busy: boolean;
}) {
  const st = view.stamps;
  if (!view.activities.length && !view.happenings.length && !st) return null;
  return (
    <div className="life">
      {view.happenings.map((h) => (
        <div key={h.id} className="life-happening">
          <span className="life-live" aria-hidden="true" />
          <span className="life-happening-text"><b>{h.emoji} {h.title}</b>{h.until != null ? ` · until ${hourLabel(h.until)}` : " · now"}</span>
        </div>
      ))}
      {view.activities.length > 0 && (
        <div className="life-row" role="list" aria-label="Things to do here">
          {view.activities.map((a) => (
            <button key={a.id} role="listitem" className={`life-card${a.happening ? " live" : ""}`} disabled={a.done || busy} onClick={() => onOpen(a)}>
              <span className="life-card-emoji" aria-hidden="true">{a.emoji}</span>
              <span className="life-card-title">{a.title}</span>
              <span className="life-card-meta">{a.done ? "✓ Done today" : a.energy ? `⚡ ${a.energy}` : "Free"}</span>
            </button>
          ))}
        </div>
      )}
      {st && (
        // Owner, Nov 16: the three dots read as page dots and "3/7 days · next:" as a riddle. Spelled out instead, and the
        // line wraps: how many days you've come, and what the next milestone gives.
        <div className="life-stamps">
          <span aria-hidden="true" className="life-stamp-icon">🎟️</span>
          <span className="life-stamp-text">
            {st.claimable.length ? <b>Regular card: a reward is waiting</b>
              : st.next ? <><b>Regular card</b> · you've come {st.days} {st.days === 1 ? "day" : "days"} of {st.next.days}
                <span className="life-stamp-next">Day {st.next.days}: {st.next.text}{perkReward(st.next) && <b> {perkReward(st.next)}</b>}</span></>
              : <><b>You're a regular here</b><span className="life-stamp-next">{st.unlocked[st.unlocked.length - 1]?.text}</span></>}
          </span>
          {st.claimable[0] && <button className="btn btn-xs btn-taxi" disabled={busy} onClick={() => onStamp(st.claimable[0].days)}>Claim</button>}
        </div>
      )}
    </div>
  );
}

/** One activity or crowd moment: choose, Do it, then the receipt. */
export function LifeSheet({ card, who, result, busy, onChoose, onClose }: {
  card: (ActivityView | MomentView) | null;
  /** For a crowd moment: who started it ("Pia (tourist)"). */
  who?: string | null;
  result: LifeResult | null;
  busy: boolean;
  onChoose: (option: string) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const close = () => { setSel(null); onClose(); };
  const energy = card && "energy" in card ? card.energy : 0;
  return (
    <Sheet open={!!card} onClose={close} label={card?.title ?? "Things to do"}>
      {card && (
        <div className="stack-16">
          <div className="choice-head">
            <span className="choice-icon" aria-hidden="true">{card.emoji}</span>
            {!result && who && <span className="overline">{who}</span>}
            {!result && <p className="choice-title">{card.title}</p>}
            {!result && <p className="choice-intro">{card.blurb}</p>}
          </div>
          {result ? (
            <div className="stack-16">
              <p className="choice-receipt">{result.text}</p>
              {(() => { const line = effectLine({ cash: result.cash, clout: result.clout, mood: result.mood, energy: result.energy ? -result.energy : 0 }); return line ? <p className="choice-effects">{line}</p> : null; })()}
              <button className="btn btn-taxi" onClick={close}>Nice</button>
            </div>
          ) : (
            <>
              <div className="choice-options" role="radiogroup" aria-label="What do you do?">
                {card.options.map((o) => (
                  <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy} onClick={() => setSel(o.id)}>
                    <span className="choice-opt-row"><span className="choice-opt-label">{o.label}</span></span>
                    {sel === o.id && (
                      <span className="choice-opt-more">
                        <span><b>You get</b> {o.get}</span>
                        <span><b>It costs</b> {o.cost}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button className="btn btn-taxi" disabled={busy || !sel} onClick={() => sel && onChoose(sel)}>
                {busy ? "…" : energy ? `Do it · ⚡ ${energy}` : "Do it"}
              </button>
              {who && <button className="btn btn-ghost" disabled={busy} onClick={close}>Walk away</button>}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
