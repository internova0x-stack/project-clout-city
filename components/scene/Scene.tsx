"use client";

// Your Scene (owner, Nov 21; lib/scene.ts): the full-screen tab (SceneScreen), the "Start a move here" row on a place's
// panel (SceneHere) and the door card for a move above your rank (SneakSheet).

import { useEffect, useState } from "react";
import { Sheet } from "../Sheet";
import { SNEAK, sneakLabel, type SneakWay } from "@/lib/scene";
import type { MoveCard, Offer, SceneView } from "@/lib/sceneView";

/** The view's clock, ticking: the preview's runs fast. */
export function useSceneNow(view: SceneView | null): number {
  const [got, setGot] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { setGot(Date.now()); }, [view]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return view ? view.now + (Date.now() - got) * view.speed : Date.now();
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "now";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m && h < 10 ? `${h} h ${m} min` : `${h} h`;
}
const money = (n: number) => (n > 0 ? `C$${n.toLocaleString("en-US")}` : "Free");

function Face({ host, emoji, size = 48 }: { host?: Offer["host"]; emoji: string; size?: number }) {
  return host?.portrait
    ? <img className="scene-face" src={host.portrait} alt="" style={{ width: size, height: size }} />
    : <span className="scene-ico" style={{ width: size, height: size }} aria-hidden="true">{emoji}</span>;
}

function SlotTag({ n, muted }: { n: number; muted?: boolean }) {
  return <span className={`scene-slot-tag${muted ? " muted" : ""}`}>SLOT {n}</span>;
}

function MoveSlot({ m, now, at, busy, onHype, onCollect, onGo }: {
  m: MoveCard; now: number; at: string | null; busy: boolean;
  onHype: (m: MoveCard) => void; onCollect: (m: MoveCard) => void; onGo: (place: string) => void;
}) {
  const ready = now >= Date.parse(m.readyAt);
  const stale = now >= Date.parse(m.staleAt);
  const total = Date.parse(m.readyAt) - Date.parse(m.startedAt);
  const pct = ready ? 100 : Math.max(2, Math.min(100, ((now - Date.parse(m.startedAt)) / total) * 100));
  const hypeDue = !ready && m.hypes < m.need && (!m.hypeAt || now >= Date.parse(m.hypeAt));
  return (
    <div className={`scene-card${stale ? " stale" : ready ? " ready" : ""}`}>
      <SlotTag n={m.slot} />
      <div className="scene-row">
        <Face host={m.host} emoji={m.emoji} />
        <div className="scene-grow">
          <div className="scene-title">{m.title}</div>
          <div className="meta">{m.placeName}{m.entry === "sneak" ? " · snuck in 🤫" : ""}</div>
        </div>
        {stale ? <span className="scene-chip grey">STALE</span>
          : ready ? <span className="scene-chip green">READY</span>
          : <span className="meta scene-left">{timeLeft(Date.parse(m.readyAt) - now)} left</span>}
      </div>
      <div className="scene-bar" aria-hidden="true"><span className={ready ? "done" : ""} style={{ width: `${pct}%` }} /></div>
      {!ready && m.need > 0 && (
        <div className="scene-chips">
          <span className="scene-chip">⚡ Hyped {m.hypes} / {m.need}</span>
          {!hypeDue && m.hypes < m.need && m.hypeAt && <span className="meta">Next hype in {timeLeft(Date.parse(m.hypeAt) - now)}</span>}
        </div>
      )}
      {ready ? (
        <div className="scene-row">
          <span className="meta scene-grow">{stale ? "Went stale. You get a quarter." : `Goes stale in ${timeLeft(Date.parse(m.staleAt) - now)}`}</span>
          <button className="btn btn-taxi scene-btn" disabled={busy} onClick={() => onCollect(m)}>Collect +{(stale ? m.stalePay : m.pay).clout} 🔥</button>
        </div>
      ) : hypeDue ? (
        <button className="btn btn-taxi" disabled={busy} onClick={() => (at === m.place ? onHype(m) : onGo(m.place))}>
          {at === m.place ? "Hype it now" : "Go hype it"}
        </button>
      ) : null}
    </div>
  );
}

function OfferCard({ o, at, busy, onStart, onGo, compact }: {
  o: Offer; at: string | null; busy: boolean; onStart: (o: Offer) => void; onGo: (place: string) => void; compact?: boolean;
}) {
  const here = !!at && o.places.some((p) => p.id === at);
  const where = here ? o.places.find((p) => p.id === at)! : o.places[0];
  return (
    <div className={`scene-offer${compact ? " compact" : ""}`}>
      <div className="scene-row">
        <Face host={o.host} emoji={o.emoji} size={44} />
        <div className="scene-grow">
          <div className="scene-title">{o.title}</div>
          <div className="scene-why">{o.short ? `Not on the list yet (${o.short})` : o.why}</div>
        </div>
      </div>
      <div className="meta">📍 {where?.name ?? "Somewhere new"} · {o.hours} h · +{o.clout} 🔥 · {money(o.cost)}{o.energy ? ` · ⚡${o.energy}` : ""}</div>
      {o.running ? <span className="meta">Already going ✓</span>
        : o.bounced ? <span className="meta">They know your face tonight. Tomorrow.</span>
        : here ? <button className="btn btn-taxi scene-btn" disabled={busy} onClick={() => onStart(o)}>{o.short ? "Try to get in" : "Start it"}</button>
        : where ? <button className="btn btn-secondary scene-btn" onClick={() => onGo(where.id)}>Go to {where.name}</button> : null}
    </div>
  );
}

export function SceneScreen({ view, busy, onStart, onHype, onCollect, onGo }: {
  view: SceneView; busy: boolean;
  onStart: (o: Offer) => void; onHype: (m: MoveCard) => void; onCollect: (m: MoveCard) => void; onGo: (place: string) => void;
}) {
  const now = useSceneNow(view);
  const free = view.slots - view.moves.length;
  const freeSlots = Array.from({ length: view.slots }, (_, i) => i + 1).filter((s) => !view.moves.some((m) => m.slot === s));
  const forYou = (
    <section className="scene-section" aria-label="For you today">
      <div className="scene-label">FOR YOU TODAY</div>
      <div className="scene-swipe">
        {view.forYou.map((o) => <OfferCard key={o.move} o={o} at={view.at} busy={busy} onStart={onStart} onGo={onGo} compact />)}
        {!view.forYou.length && <p className="meta">Nothing new right now. Check back tomorrow.</p>}
      </div>
    </section>
  );
  return (
    <div className="scene-screen" role="region" aria-label="Your Scene">
      <div className="scene-inner">
        <div className="scene-head">
          <h1>Your Scene</h1>
          <span className="scene-count">{view.moves.length} / {view.slots} slots</span>
        </div>
        <p className="meta scene-sub">Start moves around the city. Hype them, collect them before they go stale.</p>
        {free > 0 && forYou}
        <section className="scene-section" aria-label="Your moves">
          <div className="scene-label">YOUR MOVES</div>
          {view.moves.map((m) => <MoveSlot key={m.id} m={m} now={now} at={view.at} busy={busy} onHype={onHype} onCollect={onCollect} onGo={onGo} />)}
          {freeSlots.map((s) => (
            <div key={s} className="scene-card free">
              <SlotTag n={s} />
              <div className="scene-title">Free slot</div>
              <div className="meta">Pick one from For you today, or start one wherever you are.</div>
            </div>
          ))}
          {view.nextSlotRank && (
            <div className="scene-card locked">
              <SlotTag n={view.slots + 1} muted />
              <span className="meta">🔒 Another slot opens at Rank {view.nextSlotRank}</span>
            </div>
          )}
        </section>
        {free <= 0 && forYou}
        <section className="scene-section" aria-label="Known for">
          <div className="scene-label">KNOWN FOR</div>
          <div className="scene-scores">
            {view.scores.map((s) => (
              <div key={s.id} className="scene-score">
                <span className="meta">{s.emoji} {s.label}</span>
                <b>{s.title}</b>
                {s.next !== null && <span className="scene-score-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (s.points / s.next) * 100)}%` }} /></span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** The place panel's row: the moves you can start here. */
export function SceneHere({ view, busy, onPick }: { view: SceneView; busy: boolean; onPick: (o: Offer) => void }) {
  if (!view.here.length) return null;
  const free = view.slots - view.moves.length;
  return (
    <div className="scene-here">
      <div className="scene-label">🎬 START A MOVE HERE · {free > 0 ? `${free} SLOT${free === 1 ? "" : "S"} FREE` : "SLOTS FULL"}</div>
      <div className="life-row" role="list" aria-label="Moves you can start here">
        {view.here.map((o) => (
          <button key={o.move} role="listitem" className={`life-card${o.short ? " scene-short" : ""}`} disabled={busy || o.running || o.bounced || free <= 0} onClick={() => onPick(o)}>
            <span className="life-card-emoji" aria-hidden="true">{o.emoji}</span>
            <span className="life-card-title">{o.title}</span>
            <span className="life-card-meta">{o.running ? "✓ Going" : o.bounced ? "Bounced tonight" : o.short ? `🤫 Sneak in` : `${o.hours} h · +${o.clout} 🔥`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Starting a move: a plain confirm when invited, the door's three options when you're short of its rank. */
export function SceneStartSheet({ offer, busy, onClose, onGo }: { offer: Offer | null; busy: boolean; onClose: () => void; onGo: (way?: SneakWay["id"]) => void }) {
  return (
    <Sheet open={!!offer} onClose={onClose} label={offer?.title ?? "Start a move"}>
      {offer && (
        <div className="stack-12">
          <div className="scene-row">
            <Face host={offer.host} emoji={offer.emoji} size={56} />
            <div className="scene-grow">
              <div className="scene-title" style={{ fontSize: 19 }}>{offer.title}</div>
              <div className="meta">{offer.line}</div>
            </div>
          </div>
          {offer.short ? (
            <>
              <p className="scene-why" style={{ margin: 0 }}>You're not on the list ({offer.short}). How do you get in?</p>
              {SNEAK.map((w) => {
                const l = sneakLabel(w, offer.host?.name ?? null, offer.cost);
                return (
                  <button key={w.id} className="scene-way" disabled={busy} onClick={() => onGo(w.id)}>
                    <span className="scene-way-title">{w.emoji} {l.label}</span>
                    <span className="scene-get">You get: {w.get}</span>
                    <span className="meta">It costs: {l.cost} · ⚡{offer.energy}{offer.cost ? ` · ${money(offer.cost)} once you're in` : ""}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div className="scene-chips">
                <span className="scene-chip green">You get +{offer.clout} 🔥</span>
                <span className="scene-chip">It costs {money(offer.cost)} · ⚡{offer.energy}</span>
                <span className="scene-chip">Ready in {offer.hours} h</span>
              </div>
              <button className="btn btn-taxi" disabled={busy} onClick={() => onGo()}>Start it</button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
