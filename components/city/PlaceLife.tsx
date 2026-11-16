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
      {st && (() => {
        // Owner, Nov 16: the row read as a riddle. A small card instead: what it is and your count, the three milestones
        // on a bar, then one line, the reward that's ready (with Claim) or the next one.
        const ready = st.claimable[0];
        const stops = st.stops ?? [...st.unlocked, ...(st.next ? [st.next] : [])].map((pk) => pk.days);
        const last = stops[stops.length - 1] ?? 15;
        const shown = ready ?? st.next;
        return (
          <div className={`life-reg${ready ? " ready" : ""}`}>
            <div className="life-reg-head">
              <span className="life-reg-title">🎟️ Regular card</span>
              <span className="life-reg-count">{st.days} {st.days === 1 ? "day" : "days"} here</span>
            </div>
            <div className="life-reg-bar" aria-hidden="true">
              <span className="life-reg-fill" style={{ width: `${Math.min(100, (st.days / last) * 100)}%` }} />
              {stops.map((d) => (
                <span key={d} className={`life-reg-stop${st.days >= d ? " on" : ""}`} style={{ left: `${(d / last) * 100}%` }}>
                  <i>{st.days >= d ? "✓" : ""}</i><b>Day {d}</b>
                </span>
              ))}
            </div>
            {shown ? (
              <p className="life-reg-line">
                <span className="life-reg-label">{ready ? `Day ${ready.days} reward ready` : `Come back ${shown.days - st.days} more ${shown.days - st.days === 1 ? "day" : "days"}`}</span>
                {shown.text}{!ready && perkReward(shown) && <b className="life-reg-reward"> {perkReward(shown)}</b>}
              </p>
            ) : (
              <p className="life-reg-line"><span className="life-reg-label">You're a regular here</span>{st.unlocked[st.unlocked.length - 1]?.text}</p>
            )}
            {ready && <button className="btn btn-taxi life-reg-claim" disabled={busy} onClick={() => onStamp(ready.days)}>Claim {perkReward(ready)}</button>}
          </div>
        );
      })()}
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
