"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CITY_ECONOMY } from "@/lib/city";
import type { CityState } from "@/lib/cityState";
import {
  LOTTO_GAMES, bennyLine, jackpotLine, type LottoDraw, buyCardAvailability, freeCardAvailability, lottoGame, lottoOdds, oneInLine, prizeTable, topPrize,
  type LottoCard, type LottoGame, type LottoState,
} from "@/lib/lotto";
import { localDate, nextNyMonday, nyMidnightLine } from "@/lib/localTime";
import { handle } from "@/lib/validation";
import { Sheet } from "../Sheet";
import { formatCash } from "@/lib/economy";

/**
 * v0.10 Lucky Star Lotto (spec section 7). The counter: five games on a card wheel you spin with a
 * finger, then one card to scratch. Nothing here decides a result: buying asks the server, which
 * draws the prize; scratching asks the server, which reveals and pays it. The foil is only the show.
 */
export function LottoSheet({ open, state, placeId, busy, onClose, onBuy, onScratch }: {
  open: boolean; state: CityState; placeId: string; busy: boolean; onClose: () => void;
  onBuy: (placeId: string, gameId: string, free: boolean) => Promise<LottoCard | null>;
  onScratch: (cardId: number) => Promise<LottoCard | null>;
}) {
  const lotto = state.lotto;
  const [index, setIndex] = useState(0);
  const [card, setCard] = useState<LottoCard | null>(null);
  const [odds, setOdds] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCard(null);
    setOdds(false);
  }
  if (!lotto) return <Sheet open={false} onClose={onClose} label="Lucky Star Lotto">{null}</Sheet>;
  const game = LOTTO_GAMES[index];
  const buy = async (free: boolean) => {
    const c = await onBuy(placeId, game.id, free);
    if (c) setCard(c);
  };
  const resume = lotto.unscratched[0];
  return (
    <Sheet open={open} onClose={onClose} label="Lucky Star Lotto" tall>
      {card ? (
        <ScratchView
          key={card.id}
          card={card}
          busy={busy}
          onScratch={onScratch}
          onRevealed={(c) => setCard(c)}
          onAgain={() => { setIndex(Math.max(0, LOTTO_GAMES.findIndex((g) => g.id === card.game))); setCard(null); }}
          onDone={onClose}
        />
      ) : odds ? (
        <OddsView game={game} onBack={() => setOdds(false)} />
      ) : (
        <div className="stack-16 lotto">
          <div>
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>🌟 Lucky Star Lotto</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>Benny&apos;s corner in Flushing. Spin the wheel, pick a card, scratch it here.</p>
          </div>
          {resume && (
            <div className="reason-banner info lotto-resume">
              <span style={{ flex: 1 }}>🎟️ {lotto.unscratched.length === 1 ? "A card you haven't scratched" : `${lotto.unscratched.length} cards you haven't scratched`}</span>
              <button className="btn btn-night btn-sm" onClick={() => setCard({ id: resume.id, game: resume.game })}>Scratch</button>
            </div>
          )}
          <JackpotStrip lotto={lotto} nowMs={Date.now() + state.clockOffsetSeconds * 1000} />
          {lotto.beginnerUntil && (
            <div className="reason-banner info">🍀 <span><b>Beginner&apos;s luck:</b> an extra free card every day until {localDate(lotto.beginnerUntil)}.</span></div>
          )}
          <CardWheel index={index} onIndex={setIndex} />
          <GamePanel game={game} lotto={lotto} cash={state.player.bank_cash} busy={busy} onBuy={(free) => void buy(free)} onOdds={() => setOdds(true)} />
        </div>
      )}
    </Sheet>
  );
}

/** This week's jackpot: the pot so far, when it's drawn, my entries and last week's winner. */
function JackpotStrip({ lotto, nowMs }: { lotto: LottoState; nowMs: number }) {
  const when = nyMidnightLine(nextNyMonday(nowMs)).replace(/^Monday at midnight$/, "Sunday at midnight");
  const last = lotto.draws?.[0];
  return (
    <div className="lotto-jackpot">
      <span className="lotto-jackpot-star" aria-hidden="true">🌟</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span className="lotto-jackpot-label">This week&apos;s jackpot</span>
        <span className="lotto-jackpot-amount">{formatCash(lotto.week.pool)}</span>
        <span className="lotto-jackpot-meta">
          Drawn {when}{sameNy(when) ? " (New York)" : ""} · you have {lotto.week.entries} {lotto.week.entries === 1 ? "entry" : "entries"}
        </span>
        {last && (
          <span className="lotto-jackpot-meta">
            Last draw: {formatCash(last.pool)} to {last.mine ? "you 🎉" : last.winner ? handle(last.winner) : "a lucky Astorian"}
          </span>
        )}
      </div>
    </div>
  );
}
const sameNy = (line: string) => line.endsWith("at midnight");

/** Lola's jackpot card in the News (City tab). */
export function JackpotNewsCard({ d }: { d: LottoDraw }) {
  return (
    <div className={`card stack-4 jackpot-news${d.mine ? " mine" : ""}`}>
      <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>🌟 Jackpot · Lola Lowdown</span>
      <p className="display-sm" style={{ margin: 0 }}>{formatCash(d.pool)} at Lucky Star</p>
      <p className="body" style={{ margin: 0 }}>{jackpotLine(d, handle(d.winner))}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The card wheel: the five games on a drum that turns with a drag, a flick, the arrows or a tap.
// ---------------------------------------------------------------------------
const STEP = 360 / LOTTO_GAMES.length;

function CardWheel({ index, onIndex }: { index: number; onIndex: (i: number) => void }) {
  const n = LOTTO_GAMES.length;
  // The drum's angle in degrees; it keeps counting past 360 so a spin never jumps back.
  const [angle, setAngle] = useState(index * STEP);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; a: number; t: number; v: number; moved: boolean } | null>(null);
  const settle = useCallback((a: number) => {
    const snapped = Math.round(a / STEP) * STEP;
    setAngle(snapped);
    onIndex((((Math.round(snapped / STEP)) % n) + n) % n);
  }, [n, onIndex]);
  const turn = (by: number) => settle(Math.round(angle / STEP) * STEP + by * STEP);
  const front = (((Math.round(angle / STEP)) % n) + n) % n;
  // The panel always describes the card in front, even mid-spin.
  useEffect(() => { if (front !== index) onIndex(front); }, [front]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lw" role="listbox" aria-label="Scratch-card games" aria-activedescendant={`lw-${LOTTO_GAMES[front].id}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowRight") turn(1); if (e.key === "ArrowLeft") turn(-1); }}>
      <div
        className={`lw-stage${dragging ? " dragging" : ""}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, a: angle, t: performance.now(), v: 0, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          e.stopPropagation();
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          const next = d.a - dx * 0.45;
          const now = performance.now();
          d.v = (next - angle) / Math.max(1, now - d.t);
          d.t = now;
          setAngle(next);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (!d) return;
          e.stopPropagation();
          // A flick keeps the wheel rolling for a moment; a tap on a side card brings it to the front.
          if (!d.moved) {
            const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-game]");
            const i = hit ? Number(hit.dataset.game) : front;
            const delta = ((((i - front) % n) + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
            if (delta) turn(delta);
            return;
          }
          settle(angle + Math.max(-2 * STEP, Math.min(2 * STEP, d.v * 220)));
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); settle(angle); }}
      >
        <div className="lw-drum" style={{ "--lw-angle": `${-angle}deg` } as CSSProperties}>
          {LOTTO_GAMES.map((g, i) => {
            // How far this card is from the front, in degrees (−180 to 180).
            const off = ((((i * STEP - angle) % 360) + 540) % 360) - 180;
            const near = Math.max(0, 1 - Math.abs(off) / 150);
            return (
              <div
                key={g.id}
                id={`lw-${g.id}`}
                role="option"
                aria-selected={i === front}
                data-game={i}
                className={`lw-slot${i === front ? " front" : ""}`}
                style={{ "--lw-at": `${i * STEP}deg`, opacity: 0.25 + near * 0.75 } as CSSProperties}
              >
                <Ticket game={g} />
              </div>
            );
          })}
        </div>
      </div>
      <button className="lw-arrow left" aria-label="Previous game" onClick={() => turn(-1)}>‹</button>
      <button className="lw-arrow right" aria-label="Next game" onClick={() => turn(1)}>›</button>
      <div className="lw-dots" aria-hidden="true">
        {LOTTO_GAMES.map((g, i) => <i key={g.id} className={i === front ? "on" : ""} />)}
      </div>
    </div>
  );
}

/** A scratch card's face: the game's color, its name, the price and the top prize. */
function Ticket({ game, big = false }: { game: LottoGame; big?: boolean }) {
  return (
    <div className={`ticket${big ? " big" : ""}${game.id === "main-character" ? " dark" : ""}`} style={{ "--ticket": game.color } as CSSProperties}>
      <span className="ticket-mark">★ Lucky Star</span>
      <span className="ticket-name">{game.name}</span>
      <span className="ticket-foil" aria-hidden="true" />
      <span className="ticket-foot">
        <span>Top prize<b>{formatCash(topPrize(game))}</b></span>
        <span className="ticket-price">{formatCash(game.price)}</span>
      </span>
    </div>
  );
}

function GamePanel({ game, lotto, cash, busy, onBuy, onOdds }: {
  game: LottoGame; lotto: LottoState; cash: number; busy: boolean; onBuy: (free: boolean) => void; onOdds: () => void;
}) {
  const odds = lottoOdds();
  const isFree = game.id === CITY_ECONOMY.lotto.freeGame;
  const free = freeCardAvailability(lotto);
  const bought = buyCardAvailability(game, lotto, cash);
  const freeLeft = Math.max(0, lotto.freeToday - lotto.freeUsed);
  return (
    <div className="lotto-panel stack-12">
      <div>
        <p className="display-sm" style={{ margin: 0 }}>{game.name}</p>
        <p className="subtext" style={{ margin: "2px 0 0" }}>{game.blurb}</p>
      </div>
      <span className="fx-row" style={{ marginTop: 0 }}>
        <span className="fx fx-cost">−{formatCash(game.price)}</span>
        <span className="fx">🏆 up to {formatCash(topPrize(game))}</span>
        <span className="fx">🎯 {oneInLine(Number(odds.anyOneIn.toFixed(2)))} wins</span>
        <button className="fx lotto-odds-link" onClick={onOdds}>Odds ›</button>
      </span>
      {isFree && free.ok && (
        <button className="btn btn-green" disabled={busy} onClick={() => onBuy(true)}>
          {busy ? "…" : `Free card · ${freeLeft} left today`}
        </button>
      )}
      <button className={isFree && free.ok ? "btn btn-secondary" : "btn btn-taxi"} disabled={!bought.ok || busy} onClick={() => onBuy(false)}>
        {busy && !(isFree && free.ok) ? "…" : `Buy a card · ${formatCash(game.price)}`}
      </button>
      {!bought.ok && <p className="meta reason" style={{ margin: 0 }}>{bought.reason}</p>}
      <p className="meta" style={{ margin: 0 }}>
        Bought today {lotto.bought} of {CITY_ECONOMY.lotto.buyPerDay}
        {freeLeft ? ` · ${freeLeft} free card${freeLeft === 1 ? "" : "s"} left (the C$5 game)` : " · free card used"} · resets at midnight
      </p>
    </div>
  );
}

function OddsView({ game, onBack }: { game: LottoGame; onBack: () => void }) {
  const odds = lottoOdds();
  return (
    <div className="stack-16">
      <div>
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>The odds</h2>
        <p className="subtext" style={{ margin: "4px 0 0" }}>{game.name} · {formatCash(game.price)} a card. Fixed, published and the same for everyone.</p>
      </div>
      <OddsTable game={game} />
      <ul className="lotto-facts">
        <li>Any prize: {oneInLine(Number(odds.anyOneIn.toFixed(2)))}.</li>
        <li>On average a card pays back {Math.round(odds.payback * 1000) / 10}% of its price. The shop always wins; that&apos;s the point of a shop.</li>
        <li>Every game uses the same table: prizes are multiples of the card.</li>
        <li>Every card, free or bought, is one entry in the weekly jackpot. It starts at {formatCash(CITY_ECONOMY.lotto.jackpot.seed)}, and {Math.round(CITY_ECONOMY.lotto.jackpot.cut * 100)}% of every bought card goes into it.</li>
        <li>The server draws each card&apos;s prize the moment you buy it. Scratching only uncovers it.</li>
        <li>No real money: cards cost C$, prizes are C$, and C$ can&apos;t be bought.</li>
      </ul>
      <button className="btn btn-secondary" onClick={onBack}>Back to the counter</button>
    </div>
  );
}

function OddsTable({ game, highlight }: { game: LottoGame; highlight?: number }) {
  return (
    <table className="lotto-odds">
      <thead><tr><th scope="col">Prize</th><th scope="col">Odds</th></tr></thead>
      <tbody>
        {prizeTable(game).reverse().map((p) => (
          <tr key={p.amount} className={`${p.top ? "top" : ""}${highlight === p.amount ? " hit" : ""}`}>
            <td>{formatCash(p.amount)}{p.amount === game.price ? <small> your card back</small> : p.big ? <small> big prize</small> : null}</td>
            <td>{oneInLine(p.oneIn)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Scratching: a foil canvas over one prize window. The first touch asks the server for the result.
// ---------------------------------------------------------------------------
function ScratchView({ card, busy, onScratch, onRevealed, onAgain, onDone }: {
  card: LottoCard; busy: boolean;
  onScratch: (cardId: number) => Promise<LottoCard | null>;
  onRevealed: (c: LottoCard) => void;
  onAgain: () => void; onDone: () => void;
}) {
  const game = lottoGame(card.game) ?? LOTTO_GAMES[0];
  const canvas = useRef<HTMLCanvasElement>(null);
  const asked = useRef(false);
  const [prize, setPrize] = useState<number | undefined>(card.prize);
  const [cleared, setCleared] = useState(card.prize !== undefined);
  const [failed, setFailed] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);

  const ask = useCallback(async () => {
    if (asked.current) return;
    asked.current = true;
    const r = await onScratch(card.id);
    if (!r || r.prize === undefined) { asked.current = false; setFailed(true); return; }
    setFailed(false);
    setPrize(r.prize);
    onRevealed(r);
  }, [card.id, onScratch, onRevealed]);

  // Paint the foil: silver with a fine diagonal grain and the shop's star.
  useEffect(() => {
    const c = canvas.current;
    if (!c || cleared) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const x = c.getContext("2d");
    if (!x) return;
    x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#D9DCE3"); g.addColorStop(0.5, "#BFC4CE"); g.addColorStop(1, "#D3D7DF");
    x.fillStyle = g;
    x.fillRect(0, 0, width, height);
    x.strokeStyle = "rgba(255,255,255,.35)";
    x.lineWidth = 1;
    for (let i = -height; i < width; i += 7) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + height, height); x.stroke(); }
    x.fillStyle = "rgba(42,37,48,.55)";
    x.font = "700 13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif";
    x.textAlign = "center";
    x.fillText("★  SCRATCH HERE  ★", width / 2, height / 2 + 5);
  }, [cleared]);

  const clearedShare = () => {
    const c = canvas.current;
    const x = c?.getContext("2d");
    if (!c || !x) return 0;
    const { data } = x.getImageData(0, 0, c.width, c.height);
    let clear = 0, n = 0;
    for (let i = 3; i < data.length; i += 4 * 64) { n++; if (data[i] === 0) clear++; }
    return n ? clear / n : 0;
  };

  const scratchAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current;
    const x = c?.getContext("2d");
    if (!c || !x) return;
    const r = c.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    x.globalCompositeOperation = "destination-out";
    x.lineCap = "round";
    x.lineJoin = "round";
    x.lineWidth = 34;
    x.beginPath();
    x.moveTo(last.current?.x ?? p.x, last.current?.y ?? p.y);
    x.lineTo(p.x, p.y);
    x.stroke();
    last.current = p;
    if (++strokes.current % 6 === 0 && clearedShare() > 0.5 && prize !== undefined) setCleared(true);
  };

  const revealAll = () => { void ask(); setCleared(true); };
  // The foil comes off once the server has answered and most of it is scratched (or on "Scratch it all").
  useEffect(() => { if (prize !== undefined && strokes.current > 0 && clearedShare() > 0.5) setCleared(true); }, [prize]);
  const shown = cleared && prize !== undefined;
  const won = (prize ?? 0) > 0;
  const big = (prize ?? 0) >= game.price * CITY_ECONOMY.lotto.bigFrom;

  return (
    <div className="stack-16 lotto">
      <div className={`scratch-card${game.id === "main-character" ? " dark" : ""}${shown && big ? " jackpot" : ""}`} style={{ "--ticket": game.color } as CSSProperties}>
        <div className="scratch-head">
          <span className="ticket-mark">★ Lucky Star</span>
          <span className="ticket-price">{formatCash(game.price)}</span>
        </div>
        <p className="scratch-name">{game.name}</p>
        <p className="scratch-hint">{shown ? "Card #" + card.id : "Scratch the window. One prize, set when you bought the card."}</p>
        <div className="scratch-window" aria-live="polite">
          <div className="scratch-result">
            {prize === undefined ? (
              <span className="scratch-wait">{failed ? "Couldn't reach Benny. Try again." : "…"}</span>
            ) : won ? (
              <>
                <span className="scratch-amount">{formatCash(prize)}</span>
                <span className="scratch-sub">{prize === game.price ? "Your card back" : `${prize / game.price}× your card`}</span>
              </>
            ) : (
              <>
                <span className="scratch-amount none">No win</span>
                <span className="scratch-sub">Not this card</span>
              </>
            )}
          </div>
          {!shown && (
            <canvas
              ref={canvas}
              className="scratch-foil"
              aria-label="Scratch-off foil. Drag to scratch, or use Scratch it all."
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                last.current = null;
                void ask();
                scratchAt(e);
              }}
              onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") { e.stopPropagation(); scratchAt(e); } }}
              onPointerUp={() => { last.current = null; if (prize !== undefined && clearedShare() > 0.5) setCleared(true); }}
            />
          )}
        </div>
      </div>
      {!shown ? (
        <>
          {failed ? (
            <button className="btn btn-taxi" disabled={busy} onClick={() => void ask()}>Try again</button>
          ) : (
            <button className="btn btn-secondary" disabled={busy && prize === undefined && asked.current} onClick={revealAll}>Scratch it all</button>
          )}
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>The server drew this card&apos;s prize when you bought it.</p>
        </>
      ) : (
        <>
          <div className={`lotto-result${won ? " won" : ""}`}>
            <p className="lotto-result-amount">{won ? `+${formatCash(prize!)}` : "Not this time"}</p>
            <p className="subtext" style={{ margin: 0 }}>{won ? "Straight to your bank." : "The odds are on the wall. Benny keeps saying."}</p>
            <p className="lotto-benny">🧑‍🦳 <b>Benny:</b> “{bennyLine(prize!, game.price, card.id)}”</p>
          </div>
          <div className="lotto-actions">
            <button className="btn btn-secondary" onClick={onDone}>Done</button>
            <button className="btn btn-taxi" onClick={onAgain}>Another card</button>
          </div>
          <details className="lotto-details">
            <summary>This card&apos;s odds</summary>
            <OddsTable game={game} highlight={prize} />
          </details>
        </>
      )}
    </div>
  );
}
