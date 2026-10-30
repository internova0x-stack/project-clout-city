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
    const { o, b } = sel;
    const upCost = upgradeCost(b);
    const publicReady = b.id === BUSINESSES[BUSINESSES.length - 1].id && o.level >= 3 && !o.public;
    return (
      <div className="biz-app stack-12">
        <div>
          <button className="phone-back" onClick={() => setOpen(null)}><ChevronLeftIcon size={20} /> Businesses</button>
          <div className="row" style={{ gap: 12, marginTop: 4 }}>
            <span className="biz-em big" aria-hidden="true">{b.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <h2 className="display-md" style={{ margin: 0 }}>{b.name}</h2>
              <span className="meta">Business {BUSINESSES.indexOf(b) + 1} of {BUSINESSES.length}{o.public ? " · public 🔔" : ""}</span>
            </span>
          </div>
        </div>
        <p className="subtext" style={{ margin: 0 }}>{b.blurb}</p>
        <div className="profile-kpis">
          <span className="profile-kpi"><b>{money(businessValue(b, o.level, o.public, clout))}</b><span>Worth</span></span>
          <span className="profile-kpi"><b>{money(payPerDay(b, o.level))}</b><span>A day</span></span>
          <span className="profile-kpi"><b>×{hype(clout).toFixed(2)}</b><span>Hype</span></span>
        </div>
        <p className="meta" style={{ margin: 0 }}>
          Worth is the price, +50% per upgrade, times hype. Your {clout.toLocaleString("en-US")} clout brings the customers (×2 at 150,000).
        </p>
        <div className="card stack-8">
          <span className="overline">Upgrades · +50% pay and worth each</span>
          {b.upgrades.map((u, i) => {
            const done = i < o.level;
            const nextUp = i === o.level;
            const short = cash + sel.till < upCost;
            return (
              <div key={u.name} className={`biz-upg${!done && !nextUp ? " biz-locked" : ""}`}>
                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <span className="biz-em sm" aria-hidden="true">{u.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="title" style={{ display: "block" }}>{u.name}</span>
                    <span className="subtext" style={{ display: "block" }}>{nextUp || done ? u.blurb : `After ${b.upgrades[i - 1].name.toLowerCase()}`}</span>
                  </span>
                  {done ? <span className="biz-done">✓ Done</span> : !nextUp ? <span className="meta" aria-label="Locked">🔒</span> : null}
                </div>
                {nextUp && (
                  <div className="row biz-upg-buy">
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="biz-price"><b>{money(upCost)}</b></span>
                      {short && <span className="meta" style={{ display: "block" }}>{money(upCost - cash - sel.till)} short</span>}
                    </span>
                    <button className="btn btn-taxi btn-sm" disabled={!!handlers.busy || short} onClick={() => handlers.onUpgrade(b.id)}>Upgrade</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {publicReady && (
          <div className="biz-dusk stack-8">
            <span className="title">🔔 Go public</span>
            <span className="subtext">Triples what the startup is worth. Needs {G.clout.toLocaleString("en-US")} clout and {money(G.fee)} in fees.</span>
            {clout < G.clout && <span className="meta">{(G.clout - clout).toLocaleString("en-US")} more clout to go</span>}
            {clout >= G.clout && cash < G.fee && <span className="meta">{money(G.fee - cash)} short</span>}
            <button className="btn btn-taxi" disabled={!!handlers.busy || !canGoPublic(owned, clout) || cash < G.fee} onClick={handlers.onGoPublic}>Ring the bell</button>
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
        <h2 className="display-lg" style={{ margin: "4px 0 12px" }}>Businesses</h2>
        <p className="subtext" style={{ margin: 0 }}>Buy, upgrade, collect. Every empire starts with a hot dog cart.</p>
      </div>
      <div className="card biz-worth">
        <span className="overline">Net worth</span>
        <span className="biz-worth-n">{money(worth)}</span>
        <RankChip rank={rank} />
        {n && <div className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.round(n.progress * 100)}%` }} /></div>}
        <span className="meta">
          {/* Owner, Oct 30 (fewer words): the next rank only; the businesses' share is in the tills below. */}
          {nextRankLine(clout, worth)}
        </span>
      </div>
      {owned.length > 0 && (
        <div className="biz-dusk biz-worth">
          <span className="overline biz-ink">In the tills</span>
          <span className="biz-worth-n biz-ink">{money(total)}</span>
          <span className="subtext biz-ink">{fullCount ? `${fullCount} full. Tills stop at 2 days.` : "Tills fill by the hour, up to 2 days."}</span>
          <button className="btn btn-taxi" disabled={!!handlers.busy || total <= 0} onClick={handlers.onCollect}>Collect all</button>
        </div>
      )}
      {owned.length > 0 && (
        <div className="card stack-4">
          <span className="overline">Yours · tap one to upgrade</span>
          {tills.map(({ o, b, till, full }) => (
            <button key={o.id} className="list-row biz-own" onClick={() => setOpen(o.id)}>
              <span className="biz-em" aria-hidden="true">{b.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{b.name}</span>
                <span className="meta">{money(payPerDay(b, o.level))} a day · {o.level}/3 upgrades{o.public ? " · 🔔" : ""}</span>
              </span>
              {full ? <span className="tag tag-event">Full</span> : <span className="biz-till-amt">{money(till)}</span>}
            </button>
          ))}
        </div>
      )}
      {next && (
        <div className="card stack-8">
          <div className="row" style={{ gap: 12 }}>
            <span className="biz-em" aria-hidden="true">{next.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>{next.name}</span>
              <span className="meta">Next to buy · pays {money(next.payPerDay)} a day</span>
            </span>
          </div>
          <span className="subtext">{next.blurb}</span>
          <span className="biz-price"><b>{money(next.price)}</b> to buy</span>
          {cash < next.price && <span className="meta">{money(next.price - cash)} short</span>}
          <button className="btn btn-taxi" disabled={!!handlers.busy || cash < next.price} onClick={() => handlers.onBuy(next.id)}>Buy it</button>
        </div>
      )}
      {lockedAfter.length > 0 && (
        <div className="card stack-4">
          <span className="overline">Later</span>
          {lockedAfter.map((b) => (
            <div key={b.id} className="list-row static biz-locked">
              <span className="biz-em sm" aria-hidden="true">{b.emoji}</span>
              <span className="title" style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{b.name}</span>
              <span className="meta">🔒 {money(b.price)}</span>
            </div>
          ))}
        </div>
      )}
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
    <div className="modal-wrap biz-modal" role="dialog" aria-modal="true" aria-label="Tills collected">
      <div className="scrim biz-sky" onClick={onClose} />
      <div className="modal-card modal-light biz-reveal">
        <span className="tag tag-event">💸 Tills collected</span>
        <p className="biz-reveal-n">+{money(total)}</p>
        <p className="subtext" style={{ margin: 0 }}>From {paid.length} {paid.length === 1 ? "business" : "businesses"}. The cat counted it twice.</p>
        <div className="biz-reveal-lines">
          {paid.map((p) => {
            const b = businessById(p.id);
            return (
              <div key={p.id} className="list-row static">
                <span aria-hidden="true">{b?.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{b?.name}</span>
                <b>{money(p.cash)}</b>
              </div>
            );
          })}
        </div>
        {n && <div className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.round(n.progress * 100)}%` }} /></div>}
        <p className="meta" style={{ margin: "6px 0 0" }}>{nextRankLine(clout, worth)}</p>
        <div className="row" style={{ gap: 8, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Done</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} onClick={onUpgrade}>Upgrade</button>
        </div>
      </div>
    </div>
  );
}

/** Going public: the bell rings. */
export function WentPublicCard({ worth, onClose }: { worth: number; onClose: () => void }) {
  return (
    <div className="modal-wrap biz-modal" role="dialog" aria-modal="true" aria-label="You went public">
      <div className="scrim biz-sky" onClick={onClose} />
      <div className="modal-card modal-light biz-reveal">
        <span className="tag tag-event">🔔 Disruptive App Startup is public</span>
        <p className="display-md" style={{ margin: "14px 0 8px" }}>You rang the bell</p>
        <p className="subtext" style={{ margin: 0 }}>Your app for apps is worth three times as much now. Nobody can explain why.</p>
        <p className="biz-price" style={{ margin: "12px 0 0" }}>Net worth: <b>{money(worth)}</b></p>
        <button className="btn btn-taxi" style={{ marginTop: 18, width: "100%" }} onClick={onClose}>Act humble</button>
      </div>
    </div>
  );
}
