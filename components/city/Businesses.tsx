"use client";

// v0.12 businesses (owner, Oct 15; docs/08 section 15): the Businesses app on the Phone, a business's
// page with its upgrades, and the tills-collected card. Monument Valley dusk colors (owner, Oct 15:
// "monument valley style hues and gradient", not purple). The server decides every amount (migration
// 0048); this only shows them.

import { useState } from "react";
import {
  BUSINESSES, businessById, businessValue, businessesValue, canGoPublic, hype, money, nextBusiness, payPerDay, tillFull, tillNow, upgradeCost,
  type BusinessState,
} from "@/lib/businesses";
import { CITY_ECONOMY } from "@/lib/city";
import { nextRank, nextRankLine, rankFor } from "@/lib/ranks";
import { useGameNow } from "./Common";
import { RankChip } from "../game/Ranks";
import { ChevronLeftIcon } from "../icons";

const G = CITY_ECONOMY.businesses.goPublic;

export interface BusinessHandlers {
  busy: string | null;
  onBuy: (id: string) => void;
  onUpgrade: (id: string) => void;
  onCollect: () => void;
  onGoPublic: () => void;
}

/** The app: net worth and rank, the till, what you own and what's next. */
export function BusinessesApp({ biz, cash, clout, otherWorth, offsetMs, handlers, onHome }: {
  biz: BusinessState | null;
  cash: number;
  clout: number;
  /** Net worth without businesses (cash and things). */
  otherWorth: number;
  /** Server clock minus this device's, so tills count like the server. */
  offsetMs: number;
  handlers: BusinessHandlers;
  /** Back to the phone's home screen. */
  onHome: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const now = useGameNow(offsetMs / 1000);
  if (!biz) return <p className="meta">Opening the books…</p>;
  const owned = biz.owned;
  const worth = otherWorth + businessesValue(owned, clout);
  const rank = rankFor(clout, worth);
  const tills = owned.map((o) => ({ o, b: businessById(o.id)!, till: tillNow(businessById(o.id)!, o.level, o.collectedAt, now), full: tillFull(o.collectedAt, now) }));
  const total = tills.reduce((a, t) => a + t.till, 0);
  const fullCount = tills.filter((t) => t.full).length;
  const next = nextBusiness(owned);
  const lockedAfter = next ? BUSINESSES.slice(BUSINESSES.indexOf(next) + 1) : [];
  const n = nextRank(clout, worth);
  const sel = open ? tills.find((t) => t.o.id === open) : null;

  if (sel) {
    const { o, b, till } = sel;
    void till;
    const upCost = upgradeCost(b);
    const publicReady = b.id === BUSINESSES[BUSINESSES.length - 1].id && o.level >= 3 && !o.public;
    return (
      <div className="biz-page stack-12">
        <button className="phone-back" onClick={() => setOpen(null)}><ChevronLeftIcon size={20} /> Businesses</button>
        <div className="biz-hero">
          <span className="biz-em big" aria-hidden="true">{b.emoji}</span>
          <span style={{ minWidth: 0 }}>
            <b>{b.name}</b>
            <span className="meta">Business {BUSINESSES.indexOf(b) + 1} of {BUSINESSES.length}{o.public ? " · public 🔔" : ""}</span>
          </span>
        </div>
        <p className="subtext" style={{ margin: 0 }}>{b.blurb}</p>
        <div className="biz-kpis">
          <span><b>{money(businessValue(b, o.level, o.public, clout))}</b>Worth</span>
          <span><b>{money(payPerDay(b, o.level))}</b>A day</span>
          <span><b>×{hype(clout).toFixed(2)}</b>Hype</span>
        </div>
        <p className="meta" style={{ margin: 0 }}>
          Worth = the price, +50% per upgrade, × hype. Your {clout.toLocaleString("en-US")} clout brings the customers (×2 at 150,000).
        </p>
        <p className="overline" style={{ margin: "4px 0 0" }}>Upgrades · +50% pay and worth each</p>
        <div className="biz-ups">
          {b.upgrades.map((u, i) => {
            const done = i < o.level;
            const nextUp = i === o.level;
            return (
              <div key={u.name} className={`biz-up${done ? " done" : nextUp ? "" : " locked"}`}>
                <span className="biz-em" aria-hidden="true">{u.emoji}</span>
                <span className="biz-up-n">
                  <b>{u.name}</b>
                  <span className="meta">{nextUp || done ? u.blurb : `After ${b.upgrades[i - 1].name.toLowerCase()}`}</span>
                </span>
                {done ? <span className="biz-done">✓ Done</span>
                  : nextUp ? <button className="btn btn-taxi btn-sm" disabled={!!handlers.busy || cash + till < upCost} onClick={() => handlers.onUpgrade(b.id)}>{money(upCost)}</button>
                  : <span aria-label="Locked">🔒</span>}
              </div>
            );
          })}
        </div>
        {publicReady && (
          <div className="biz-public">
            <b>🔔 Go public</b>
            <span className="meta">Triples what the startup is worth. Needs {G.clout.toLocaleString("en-US")} clout and {money(G.fee)} in fees.</span>
            <button className="btn btn-taxi" disabled={!!handlers.busy || !canGoPublic(owned, clout) || cash < G.fee} onClick={handlers.onGoPublic}>
              {clout < G.clout ? `${(G.clout - clout).toLocaleString("en-US")} more clout` : cash < G.fee ? `${money(G.fee - cash)} short` : "Ring the bell"}
            </button>
          </div>
        )}
        <button className="btn btn-taxi" disabled={!!handlers.busy || total <= 0} onClick={handlers.onCollect}>Collect the tills · {money(total)}</button>
      </div>
    );
  }

  return (
    <div className="biz-app stack-12">
      <div>
        <button className="phone-back" onClick={onHome}><ChevronLeftIcon size={20} /> Home</button>
        <h2 className="display-lg" style={{ margin: "4px 0 4px" }}>Businesses</h2>
        <p className="subtext" style={{ margin: 0 }}>Buy them, upgrade them, collect the till.</p>
      </div>
      <div className="biz-worth">
        <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
          <span className="overline">Net worth</span>
          <RankChip rank={rank} />
        </div>
        <b className="biz-worth-n">{money(worth)}</b>
        {n && <div className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.round(n.progress * 100)}%` }} /></div>}
        <span className="meta">{nextRankLine(clout, worth)}{owned.length ? ` · ${money(businessesValue(owned, clout))} of it in businesses` : ""}</span>
      </div>
      {owned.length > 0 && (
        <div className="biz-till">
          <span aria-hidden="true" style={{ fontSize: 30 }}>💰</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{money(total)}</b>
            <small>in the tills{fullCount ? ` · ${fullCount} ${fullCount === 1 ? "is" : "are"} full` : ""}</small>
          </span>
          <button className="btn btn-taxi btn-sm" disabled={!!handlers.busy || total <= 0} onClick={handlers.onCollect}>Collect all</button>
        </div>
      )}
      <div className="biz-list">
        {tills.map(({ o, b, till, full }) => (
          <button key={o.id} className="biz-row" onClick={() => setOpen(o.id)}>
            <span className="biz-em" aria-hidden="true">{b.emoji}</span>
            <span className="biz-n">
              <b>{b.name}<span className="biz-lv" aria-label={`${o.level} of 3 upgrades`}>{[0, 1, 2].map((i) => <i key={i} className={i < o.level ? "on" : ""} />)}</span></b>
              <span className="meta">{money(payPerDay(b, o.level))} a day{o.public ? " · public 🔔" : ""}</span>
            </span>
            {full ? <span className="biz-full">Full · collect</span> : <span className="biz-r"><b>{money(till)}</b>in the till</span>}
          </button>
        ))}
        {next && (
          <div className="biz-row next">
            <span className="biz-em" aria-hidden="true">{next.emoji}</span>
            <span className="biz-n">
              <b>{next.name}</b>
              <span className="meta">Pays {money(next.payPerDay)} a day</span>
            </span>
            <button className="btn btn-taxi btn-sm" disabled={!!handlers.busy || cash < next.price} onClick={() => handlers.onBuy(next.id)}>
              {cash < next.price ? `${money(next.price)}` : `Buy ${money(next.price)}`}
            </button>
          </div>
        )}
        {next && cash < next.price && <p className="meta" style={{ margin: "-2px 4px 0" }}>{money(next.price - cash)} to go for the {next.name}.</p>}
        {lockedAfter.slice(0, 2).map((b, i) => (
          <div key={b.id} className="biz-row locked">
            <span className="biz-em" aria-hidden="true">{b.emoji}</span>
            <span className="biz-n"><b>{b.name}</b><span className="meta">After {(i === 0 ? next! : lockedAfter[i - 1]).name}</span></span>
            <span className="biz-r"><b>{money(b.price)}</b>🔒</span>
          </div>
        ))}
      </div>
      {!owned.length && <p className="meta" style={{ margin: 0 }}>Every empire starts with a hot dog cart. Ask anyone.</p>}
    </div>
  );
}

/** After collecting: what each till paid and how close the next rank is. */
export function TillsCollectedCard({ paid, clout, worth, onClose, onUpgrade }: {
  paid: { id: string; cash: number }[];
  clout: number;
  worth: number;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const total = paid.reduce((a, p) => a + p.cash, 0);
  const n = nextRank(clout, worth);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Tills collected">
      <div className="scrim biz-sky" onClick={onClose} />
      <div className="modal-card biz-collected">
        <span className="overline" style={{ color: "#7A2F33" }}>Tills collected</span>
        <span className="biz-collected-em" aria-hidden="true">💸</span>
        <p className="biz-collected-n">+{money(total)}</p>
        <span className="meta">From {paid.length} {paid.length === 1 ? "business" : "businesses"}. The cat counted it twice.</span>
        <div className="biz-collected-lines">
          {paid.map((p) => {
            const b = businessById(p.id);
            return <div key={p.id}><span>{b?.emoji} {b?.name}</span><b>{money(p.cash)}</b></div>;
          })}
        </div>
        {n && <div className="rank-bar" aria-hidden="true" style={{ marginTop: 14 }}><span style={{ width: `${Math.round(n.progress * 100)}%` }} /></div>}
        <span className="meta">{nextRankLine(clout, worth)}</span>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Done</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} onClick={onUpgrade}>Upgrade something</button>
        </div>
      </div>
    </div>
  );
}

/** Going public: the bell rings. */
export function WentPublicCard({ worth, onClose }: { worth: number; onClose: () => void }) {
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="You went public">
      <div className="scrim biz-sky" onClick={onClose} />
      <div className="modal-card biz-collected">
        <span className="overline" style={{ color: "#7A2F33" }}>Disruptive App Startup · public</span>
        <span className="biz-collected-em" aria-hidden="true">🔔</span>
        <p className="biz-collected-n" style={{ fontSize: 30 }}>You rang the bell</p>
        <span className="body">Your app for apps is worth three times as much now. Nobody can explain why. Your net worth: {money(worth)}.</span>
        <button className="btn btn-taxi" style={{ marginTop: 18, width: "100%" }} onClick={onClose}>Act humble</button>
      </div>
    </div>
  );
}

