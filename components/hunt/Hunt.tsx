"use client";

import { CITY_ECONOMY, placeById } from "@/lib/city";
import { regularAt } from "@/lib/cast";
import { formatCash } from "@/lib/economy";
import type { HuntState } from "@/lib/hunts";
import { nextNyMonday, nyMidnightLine } from "@/lib/localTime";
import { getStyle } from "@/lib/styles";

const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });

function who(placeId: string): string {
  const r = regularAt(placeId);
  const p = placeById(placeId);
  return `${r?.name ?? "Someone"} at ${p?.name ?? "a place"}`;
}

/**
 * Tasks → Hunt (spec section 1): join with one tap, then the trail so far, the latest clue and
 * where an open question is waiting. Players who haven't joined see only the invitation.
 */
export function HuntTab({ state, style, busy, onJoin, onOpenPlace }: {
  state: HuntState; style: string; busy: boolean; onJoin: () => void; onOpenPlace: (placeId: string) => void;
}) {
  const h = state.hunt;
  const { cash, clout, badgeAfter } = CITY_ECONOMY.hunt;
  return (
    <div className="stack-12">
      {!h ? (
        <div className="card stack-4">
          <p className="overline" style={{ margin: 0 }}>🗺️ Treasure hunt</p>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>No hunt this week. A new one starts {nyMidnightLine(nextNyMonday(Date.now()))}.</p>
        </div>
      ) : !h.joined ? (
        <div className="card stack-12">
          <div className="stack-4">
            <p className="overline" style={{ margin: 0 }}>🗺️ This week&apos;s hunt · until {dayName(h.endsOn)}</p>
            <h3 className="display-md" style={{ margin: 0 }}>{h.theme}</h3>
            <p className="body" style={{ margin: 0 }}>{h.intro}</p>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            Your track follows your style, {getStyle(style).emoji} {getStyle(style).label}. Find the treasure for a hunt card, {formatCash(cash)} and {clout} clout.
            Clues are free; travel costs what it always costs.
          </p>
          <button className="btn btn-taxi" disabled={busy} onClick={onJoin}>Join the hunt</button>
        </div>
      ) : (
        <>
          <div className="card stack-12">
            <div className="hunt-card">
              <span className="hunt-card-art" aria-hidden="true">{h.track!.emoji}</span>
              <div className="hunt-card-text">
                <span className="overline">{h.theme} · until {dayName(h.endsOn)}</span>
                <span className="title">{h.track!.treasure}</span>
                <span className="meta">{h.completedAt ? "Found!" : `Step ${Math.min(h.step + 1, h.track!.steps)} of ${h.track!.steps}`}</span>
              </div>
            </div>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{h.track!.lore}</p>
          </div>
          <div className="stack-12">
            {h.heard.map((x, i) => (
              <div key={i} className="hunt-step">
                <span className={`hunt-dot ${i < h.step ? "done" : "now"}`} aria-hidden="true">{i < h.step ? "✓" : i + 1}</span>
                <div className="stack-4">
                  <span className="meta">{who(x.placeId)}</span>
                  <span className="body">&ldquo;{x.say}&rdquo;</span>
                  {x.then && <span className="body">&ldquo;{x.then}&rdquo;</span>}
                </div>
              </div>
            ))}
            {!h.completedAt && (() => {
              const asked = h.heard.length > h.step;
              const placeId = asked ? h.heard[h.step].placeId : h.step === 0 ? h.firstPlace : null;
              return (
                <div className="hunt-step">
                  <span className="hunt-dot now" aria-hidden="true">{h.step + 1}</span>
                  <div className="stack-8">
                    <span className="body">
                      {asked && h.question
                        ? h.question.retryAt ? "Wrong answer. They'll ask again in a few minutes." : "They asked you a question. Go back and answer it."
                        : h.step === 0 ? `Start with ${who(h.firstPlace)}. Stop in, then tap ${regularAt(h.firstPlace)?.name.split(" ")[0] ?? "them"}.`
                        : "Follow the last clue. Stop in at the place, then tap the regular there."}
                    </span>
                    {placeId && <button className="btn btn-secondary btn-sm" style={{ alignSelf: "start" }} onClick={() => onOpenPlace(placeId)}>Open {placeById(placeId)?.name}</button>}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
      {state.cards.length > 0 && (
        <div className="stack-8">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p className="overline" style={{ margin: 0 }}>Your hunt cards</p>
            <span className="meta">{state.completed >= badgeAfter ? "🏅 Treasure Hunter" : `${state.completed} of ${badgeAfter} for a badge`}</span>
          </div>
          {state.cards.map((c) => <HuntCardRow key={c.huntId} c={c} />)}
        </div>
      )}
    </div>
  );
}

export function HuntCardRow({ c }: { c: HuntState["cards"][number] }) {
  return (
    <div className="card hunt-card top">
      <span className="hunt-card-art" aria-hidden="true">{c.emoji}</span>
      <div className="hunt-card-text">
        <span className="title">{c.treasure}</span>
        <span className="meta">{c.theme} · earned</span>
        <span className="hunt-lore">{c.lore}</span>
      </div>
    </div>
  );
}
