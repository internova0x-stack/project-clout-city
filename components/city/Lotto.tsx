"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CITY_ECONOMY } from "@/lib/city";
import type { CityState } from "@/lib/cityState";
import {
  LOTTO_GAMES, bennyLine, buyCardAvailability, freeCardAvailability, lottoGame, lottoOdds, oneInLine, potOdds, potWinLine, prizeTable, topPrize,
  type LottoCard, type LottoGame, type LottoPot, type LottoState, type LottoWin,
} from "@/lib/lotto";
import { localDate, nextNyMonday, nyMidnight, nyMidnightLine } from "@/lib/localTime";
import { handle } from "@/lib/validation";
import { Sheet } from "../Sheet";
import { formatCash } from "@/lib/economy";

/**
 * Lucky Star Lotto (spec section 7; v0.11 pots, owner Oct 14, migration 0041). The counter lists the
 * five games with their lucky numbers and pots: the three small ones start over every midnight, the
 * two big ones every Monday. A card shows six of the player's numbers; one that matches the lucky
 * number pays the prize under it, and a ⭐ wins the pot. Nothing here decides a result: buying asks
 * the server, which draws the card; scratching asks the server, which reveals and pays it.
 */
export function LottoSheet({ open, state, placeId, busy, onClose, onBuy, onScratch }: {
  open: boolean; state: CityState; placeId: string; busy: boolean; onClose: () => void;
  onBuy: (placeId: string, gameId: string, free: boolean) => Promise<LottoCard | null>;
  onScratch: (cardId: number) => Promise<LottoCard | null>;
}) {
  const lotto = state.lotto;
  const [card, setCard] = useState<LottoCard | null>(null);
  const [odds, setOdds] = useState<LottoGame | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCard(null);
    setOdds(null);
  }
  if (!lotto) return <Sheet open={false} onClose={onClose} label="Lucky Star Lotto">{null}</Sheet>;
  const nowMs = Date.now() + state.clockOffsetSeconds * 1000;
  const buy = async (game: LottoGame, free: boolean) => {
    const c = await onBuy(placeId, game.id, free);
    if (c) setCard(c);
  };
  const resume = lotto.unscratched[0];
  const freeLeft = Math.max(0, lotto.freeToday - lotto.freeUsed);
  const freeGame = lottoGame(CITY_ECONOMY.lotto.freeGame)!;
  const row = (g: LottoGame) => (
    <GameRow key={g.id} game={g} pot={lotto.pots?.find((x) => x.game === g.id)} lotto={lotto} cash={state.player.bank_cash} busy={busy}
      onBuy={(free) => void buy(g, free)} onOdds={() => setOdds(g)} />
  );
  return (
    <Sheet open={open} onClose={onClose} label="Lucky Star Lotto" tall>
      {card ? (
        <ScratchView
          key={card.id}
          card={card}
          pot={lotto.pots?.find((x) => x.game === card.game)}
          busy={busy}
          onScratch={onScratch}
          onRevealed={(c) => setCard(c)}
          again={(() => {
            const g = lottoGame(card.game) ?? freeGame;
            const free = g.id === freeGame.id && freeCardAvailability(lotto).ok;
            const ok = free || buyCardAvailability(g, lotto, state.player.bank_cash).ok;
            return ok ? { label: free ? `Play again · Free (${freeLeft} left)` : `Play again · ${formatCash(g.price)}`, go: () => { setCard(null); void buy(g, free); } } : null;
          })()}
          onBack={() => setCard(null)}
          onDone={onClose}
        />
      ) : odds ? (
        <OddsView game={odds} onBack={() => setOdds(null)} />
      ) : (
        <div className="stack-12 lotto">
          <div>
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>🌟 Lucky Star Lotto</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>Match the lucky number, win on the spot.</p>
          </div>
          {resume && (
            <div className="reason-banner info lotto-resume">
              <span style={{ flex: 1 }}>🎟️ {lotto.unscratched.length === 1 ? "A card you haven't scratched" : `${lotto.unscratched.length} cards you haven't scratched`}</span>
              <button className="btn btn-night btn-sm" onClick={() => setCard({ id: resume.id, game: resume.game })}>Scratch</button>
            </div>
          )}
          <div className={`lotto-free${freeLeft ? "" : " used"}`} role="status">
            <span className="lotto-free-icon" aria-hidden="true">🎟️</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>Free plays: {freeLeft} of {lotto.freeToday} left today</b>
              <small>{freeGame.name} · {freeLeft ? "new ones at midnight" : "back at midnight"}{lotto.beginnerUntil ? ` · 🍀 beginner's luck until ${localDate(lotto.beginnerUntil)}` : ""}</small>
            </span>
            <span className="lotto-pips" aria-hidden="true">
              {Array.from({ length: lotto.freeToday }, (_, i) => <i key={i} className={i < lotto.freeUsed ? "used" : ""} />)}
            </span>
          </div>
          <div className="lotto-sec"><b>Daily pots</b><span>New numbers {untilMidnight(nowMs)}</span></div>
          {LOTTO_GAMES.filter((g) => g.period === "day").map(row)}
          <div className="lotto-sec"><b>Weekly pots</b><span>New numbers {nyMidnightLine(nextNyMonday(nowMs)).replace(/^Monday at midnight$/, "Monday")}</span></div>
          {LOTTO_GAMES.filter((g) => g.period === "week").map(row)}
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>
            Bought today {lotto.bought} of {CITY_ECONOMY.lotto.buyPerDay} · resets at midnight · about {oneInLine(Math.round(lottoOdds().anyOneIn))} cards wins something
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** "in 6 h 12 m" until midnight in New York. */
function untilMidnight(nowMs: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(nowMs);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const mins = Math.max(1, Math.round((nyMidnight(d.toISOString().slice(0, 10)) - nowMs) / 60_000));
  return mins >= 60 ? `in ${Math.floor(mins / 60)} h ${mins % 60} m` : `in ${mins} min`;
}

/** One game at the counter: its lucky number on a ball, its pot, and the button to play. */
function GameRow({ game, pot, lotto, cash, busy, onBuy, onOdds }: {
  game: LottoGame; pot?: LottoPot; lotto: LottoState; cash: number; busy: boolean; onBuy: (free: boolean) => void; onOdds: () => void;
}) {
  const isFree = game.id === CITY_ECONOMY.lotto.freeGame && freeCardAvailability(lotto).ok;
  const bought = buyCardAvailability(game, lotto, cash);
  const weekly = game.period === "week";
  return (
    <div className={`lotto-game${weekly ? " weekly" : ""}`}>
      <span className="lotto-ball" style={{ "--ball": game.color } as CSSProperties} aria-label={pot ? `Lucky number ${pot.lucky}` : undefined}>{pot?.lucky ?? "?"}</span>
      <button className="lotto-game-info" onClick={onOdds} aria-label={`${game.name}: the odds`}>
        <b>{game.name}</b>
        <small>Pot <span className="lotto-pot">{formatCash(pot?.pool ?? game.pot.seed)}</span> · {weekly ? "grows all week" : `prizes to ${formatCash(topPrize(game))}`} ›</small>
      </button>
      {isFree ? (
        <button className="btn btn-green btn-sm lotto-buy" disabled={busy} onClick={() => onBuy(true)}>Free</button>
      ) : (
        <button className="btn btn-taxi btn-sm lotto-buy" disabled={busy || !bought.ok} onClick={() => onBuy(false)} title={bought.ok ? undefined : bought.reason}>
          {formatCash(game.price)}
        </button>
      )}
    </div>
  );
}

function OddsView({ game, onBack }: { game: LottoGame; onBack: () => void }) {
  const odds = lottoOdds();
  const pot = potOdds(game);
  return (
    <div className="stack-16">
      <div>
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>The odds</h2>
        <p className="subtext" style={{ margin: "4px 0 0" }}>{game.name} · {formatCash(game.price)} a card. Fixed, published and the same for everyone.</p>
      </div>
      <OddsTable game={game} />
      <ul className="lotto-facts">
        <li>Any prize: {oneInLine(Number(odds.anyOneIn.toFixed(2)))}. Every game uses the same table: prizes are multiples of the card.</li>
        <li>The pot (a ⭐ on your card): {oneInLine(pot.oneIn)}. It starts at {formatCash(pot.seed)}, and {Math.round(CITY_ECONOMY.lotto.potCut * 100)}% of every bought card goes into it. {game.period === "day" ? "It starts over every midnight with a new lucky number." : "It grows all week and starts over every Monday with a new lucky number."} After a win it starts again from {formatCash(pot.seed)}.</li>
        <li>On average a card pays back {Math.round(odds.payback * 1000) / 10}% of its price in prizes. The shop always wins; that&apos;s the point of a shop.</li>
        <li>The server draws each card the moment you buy it. Scratching only uncovers it.</li>
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
        <tr className="top"><td>⭐ The pot<small> from {formatCash(game.pot.seed)}</small></td><td>{oneInLine(game.pot.oneIn)}</td></tr>
        {prizeTable(game).reverse().map((p) => (
          <tr key={p.amount} className={highlight === p.amount ? "hit" : ""}>
            <td>{formatCash(p.amount)}{p.amount === game.price ? <small> your card back</small> : p.big ? <small> big prize</small> : null}</td>
            <td>{oneInLine(p.oneIn)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Lola's card in the News (City tab) when someone wins a pot, laid out like the other city news cards. */
export function PotWinNewsCard({ w }: { w: LottoWin }) {
  const when = new Date(w.wonAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <article className={`card stack-8 news-card jackpot-news${w.mine ? " mine" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="tag jackpot-tag">⭐ Lucky Star pot</span>
        <span className="meta">{when}</span>
      </div>
      <h3 className="title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25 }}>{w.mine ? `You won ${formatCash(w.amount)}` : `${formatCash(w.amount)} pot won`}</h3>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{potWinLine(w, handle(w.winner))}</p>
      <p className="meta" style={{ margin: 0 }}>Lola Lowdown</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Scratching: a foil canvas over the six numbers. The first touch asks the server for the result.
// ---------------------------------------------------------------------------
function ScratchView({ card, pot, busy, onScratch, onRevealed, again, onBack, onDone }: {
  card: LottoCard; pot?: LottoPot; busy: boolean;
  onScratch: (cardId: number) => Promise<LottoCard | null>;
  onRevealed: (c: LottoCard) => void;
  again: { label: string; go: () => void } | null; onBack: () => void; onDone: () => void;
}) {
  const game = lottoGame(card.game) ?? LOTTO_GAMES[0];
  const canvas = useRef<HTMLCanvasElement>(null);
  const asked = useRef(false);
  const [prize, setPrize] = useState<number | undefined>(card.prize);
  const [result, setResult] = useState<LottoCard>(card);
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
    setResult(r);
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
    x.fillText("★  SCRATCH YOUR NUMBERS  ★", width / 2, height / 2 + 5);
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
    x.lineWidth = 38;
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
  const potWon = result.pot ?? 0;
  const total = (prize ?? 0) + potWon;
  const won = total > 0;
  const big = (prize ?? 0) >= game.price * CITY_ECONOMY.lotto.bigFrom || potWon > 0;
  const lucky = result.lucky ?? pot?.lucky;
  const cells = result.numbers;

  return (
    <div className="stack-12 lotto">
      <div className={`scratch-card${game.id === "main-character" ? " dark" : ""}${shown && big ? " jackpot" : ""}`} style={{ "--ticket": game.color } as CSSProperties}>
        <div className="scratch-head">
          <span className="ticket-mark">★ Lucky Star</span>
          <span className="ticket-price">{formatCash(game.price)}</span>
        </div>
        <p className="scratch-name">{game.name}</p>
        <div className="scratch-lucky">
          <span className="lotto-ball light">{lucky ?? "?"}</span>
          <span>
            <b>{game.period === "day" ? "Today's" : "This week's"} lucky number</b>
            <small>Match it to win the prize under it. Find a ⭐ to win the pot.</small>
          </span>
        </div>
        <div className="scratch-window grid" aria-live="polite">
          <div className="scratch-cells">
            {cells ? cells.map((c, i) => (
              <span key={i} className={`scratch-cell${c.n === 0 ? " star" : ""}${shown && (c.n === lucky || c.n === 0) ? " hit" : ""}`}>
                <b>{c.n === 0 ? "⭐" : c.n}</b>
                <small>{c.n === 0 ? `Pot ${formatCash(c.prize)}` : formatCash(c.prize)}</small>
              </span>
            )) : (
              <span className="scratch-wait">{failed ? "Couldn't reach Benny. Try again." : prize !== undefined ? (prize ? `${formatCash(prize)}` : "No win") : "…"}</span>
            )}
          </div>
          {!shown && (
            <canvas
              ref={canvas}
              className="scratch-foil"
              aria-label="Scratch-off foil. Drag to scratch, or use Reveal all."
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
        <p className="scratch-hint" style={{ textAlign: "center", marginTop: 10 }}>
          {!shown ? "Rub with your finger, or reveal all." : won ? [prize ? `${lucky} matched · ${formatCash(prize!)}` : "", potWon ? `⭐ the pot · ${formatCash(potWon)}` : ""].filter(Boolean).join(" · ") : `No ${lucky ?? "match"} this time · card #${card.id}`}
        </p>
      </div>
      {!shown ? (
        <>
          {failed ? (
            <button className="btn btn-taxi" disabled={busy} onClick={() => void ask()}>Try again</button>
          ) : (
            <button className="btn btn-secondary" disabled={busy && prize === undefined && asked.current} onClick={revealAll}>Reveal all</button>
          )}
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>Your numbers were decided by the counter when you bought the card. Scratching only shows them.</p>
        </>
      ) : (
        <>
          <div className={`lotto-result${won ? " won" : ""}`}>
            <p className="lotto-result-amount">{won ? `+${formatCash(total)}` : "Not this time"}</p>
            <p className="subtext" style={{ margin: 0 }}>{potWon ? "You won the pot. Straight to your bank." : won ? "Straight to your bank." : "The odds are on the wall. Benny keeps saying."}</p>
            <p className="lotto-benny">🧑‍🦳 <b>Benny:</b> “{potWon ? "The pot? The whole pot? I'm closing early." : bennyLine(prize!, game.price, card.id)}”</p>
          </div>
          <div className="lotto-actions">
            <button className="btn btn-secondary" onClick={onDone}>Done</button>
            {again ? <button className="btn btn-taxi" disabled={busy} onClick={again.go}>{again.label}</button> : <button className="btn btn-secondary" onClick={onBack}>Back to the counter</button>}
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
