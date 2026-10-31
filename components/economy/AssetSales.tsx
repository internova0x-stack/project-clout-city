"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import {
  ASSET_SALES, blockLine, coolingLine, priceChips, saleFeeLine, saleResultLine,
  type AssetApi, type AssetSale, type AssetSalesState, type AssetView,
} from "@/lib/assetSales";
import { PLAYER_ECONOMY, afterFee, economyFee, type GiftCandidate } from "@/lib/playerEconomy";
import { handle } from "@/lib/validation";
import { Avatar } from "../crew/Crew";
import { ChevronLeftIcon } from "../icons";

// The Player Economy, Phase 3 (migration 0153): selling a business or your house to a friend. The panel sits inside the
// Phone (Businesses, Apartments and the Bank) and shows the deals in play, your sellable assets and, in place, the sale
// form (appraisal, band, price, buyer, the fee up front). The server decides every number; this only shows them.

export type AssetScope = "business" | "house" | "deals";

const TITLE: Record<AssetScope, string> = {
  business: "🔑 Sell a business",
  house: "🔑 Sell your house",
  deals: "🔑 Business & property deals",
};

export function AssetSalesPanel({ api, scope, onChanged, onToast }: {
  api: AssetApi;
  scope: AssetScope;
  /** Something changed hands or cash moved: refresh the businesses and the city. */
  onChanged?: () => void;
  onToast?: (text: string) => void;
}) {
  const [data, setData] = useState<AssetSalesState | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [selling, setSelling] = useState<AssetView | null>(null);
  const load = useCallback(async () => {
    const r = await api.state();
    if (r.ok) { setData(r.data); setOff(false); } else { setOff(!!r.off); setError(r.off ? null : r.error); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: number, p: Promise<{ ok: true; data: AssetSale } | { ok: false; error: string }>, done: (s: AssetSale) => string) => {
    setBusy(id); setError(null);
    const r = await p;
    setBusy(null);
    if (!r.ok) { setError(r.error); await load(); return; }
    onToast?.(done(r.data));
    await load();
    onChanged?.();
  };

  if (selling) {
    return (
      <SellForm asset={selling} api={api} onBack={() => setSelling(null)} onSent={(s) => {
        setSelling(null);
        onToast?.(`Offer sent to ${handle(s.with?.name ?? "")}. They have ${ASSET_SALES.offerDays} days to say yes.`);
        void load();
      }} />
    );
  }

  if (off) {
    // Opening soon: only the deals view says so (the Businesses and Apartments apps stay as they were).
    if (scope !== "deals") return null;
    return (
      <section className="stack-8" aria-label="Business and property deals">
        <span className="overline">{TITLE[scope]}</span>
        <div className="card stack-4">
          <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>Opening soon</span>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
            Selling a business or your house to a friend. The city&apos;s notary is still practicing the stamp.
          </p>
        </div>
      </section>
    );
  }
  if (!data) return error ? <p className="error-text" style={{ margin: 0 }}>{error}</p> : null;

  const kinds = scope === "business" ? ["business"] : scope === "house" ? ["house"] : ["business", "house"];
  const sales = data.sales.filter((s) => kinds.includes(s.kind));
  const live = sales.filter((s) => s.status === "offered" || s.status === "cooling");
  const recent = sales.filter((s) => s.status !== "offered" && s.status !== "cooling");
  const assets = scope === "deals" ? [] : data.assets.filter((a) => a.kind === scope);
  const locked = data.unlock === "economy_frozen" ? "Your trading is paused while the city takes a look."
    : data.unlock ? `Sales open once your account is ${PLAYER_ECONOMY.unlock.minAccountDays} days old and Rank ${PLAYER_ECONOMY.unlock.minRank}.` : null;
  if (scope !== "deals" && !live.length && !recent.length && !assets.length) return null;
  if (scope === "deals" && !live.length && !recent.length) return null;

  return (
    <section className="stack-8" aria-label="Business and property sales">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="overline">{TITLE[scope]}</span>
        <span className="meta">{Math.max(0, data.perMonth - data.used)} of {data.perMonth} deals left this month</span>
      </div>
      {!data.on && <p className="meta" style={{ margin: 0 }}>Sales are paused by the city. Live deals wait, or you can call them off.</p>}
      {live.map((s) => s.status === "cooling"
        ? <CoolingCard key={s.id} sale={s} busy={busy === s.id} onCancel={() => void act(s.id, api.cancel(s.id), () => "Deal called off. Nothing changed hands.")} />
        : s.role === "buyer"
          ? <OfferCard key={s.id} sale={s} busy={busy === s.id}
              onAnswer={(yes) => void act(s.id, api.answer(s.id, yes), (r) => r.status === "cooling" ? `${formatCash(r.price)} in escrow. ${coolingLine(r.coolingUntil)}.` : "You passed.")} />
          : <WaitingCard key={s.id} sale={s} busy={busy === s.id} onWithdraw={() => void act(s.id, api.cancel(s.id), () => "Offer withdrawn.")} />)}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
      {assets.length > 0 && (
        <div className="card stack-4">
          {assets.map((a) => {
            const why = locked ?? blockLine(a);
            return (
              <div key={`${a.kind}:${a.id}`} className="list-row static" style={{ alignItems: "center" }}>
                <span aria-hidden="true" style={{ fontSize: 22 }}>{a.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="title one-line" style={{ display: "block" }}>{a.label}</span>
                  <span className="meta">{why && a.block !== "sale_live" ? why : `Appraised at ${formatCash(a.appraisal)}`}</span>
                </span>
                <button className="btn btn-secondary btn-sm" disabled={!!why || !data.on} onClick={() => setSelling(a)}>
                  {a.block === "sale_live" ? "On offer" : "Sell"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {recent.map((s) => (
        <p key={s.id} className="meta" style={{ margin: 0 }}>{s.emoji} {s.label}: {saleResultLine(s)}</p>
      ))}
    </section>
  );
}

function Who({ sale }: { sale: AssetSale }) {
  return <Avatar style={sale.with?.style ?? "bodega_drip"} size={44} />;
}

/** The buyer's card: what, for how much, any warnings, and yes or no. */
function OfferCard({ sale, busy, onAnswer }: { sale: AssetSale; busy: boolean; onAnswer: (yes: boolean) => void }) {
  const days = Math.max(0, Math.ceil((Date.parse(sale.expiresAt) - Date.now()) / 86_400_000));
  const over = sale.price > sale.appraisal;
  return (
    <div className="card date-invite stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Who sale={sale} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>🏷️ {handle(sale.with?.name ?? "")} is selling</span>
          <span className="title" style={{ display: "block" }}>{sale.emoji} {sale.label}{sale.kind === "business" && sale.level ? ` · ${sale.level}/3 upgrades` : ""}</span>
          <span className="meta" style={{ display: "block" }}>
            {formatCash(sale.price)} · appraised at {formatCash(sale.appraisal)}{over ? " (you'd pay over the odds)" : ""}
          </span>
          <span className="meta" style={{ display: "block" }}>{days <= 1 ? "The offer lapses tomorrow" : `The offer lapses in ${days} days`}</span>
        </span>
      </div>
      {sale.issues && (
        <p className="body" style={{ margin: 0, color: "var(--warn, #FFB547)" }}>
          ⚠️ Undisclosed issues. The city&apos;s records say this one comes with history, and history comes with it. Whatever it
          is, it&apos;ll be yours.
        </p>
      )}
      <p className="meta" style={{ margin: 0 }}>
        Say yes and {formatCash(sale.price)} goes into escrow. Then {ASSET_SALES.coolingHours} hours of cooling-off: either of you can back out and
        the money comes straight back. After that, the keys are yours{sale.kind === "house" ? " and so is the house: no more rent" : ", upgrades and all; the till starts empty"}.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>No thanks</button>
        <button className="btn btn-green" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>{busy ? "…" : `Buy · ${formatCash(sale.price)}`}</button>
      </div>
    </div>
  );
}

/** Both sides, during the cooling-off: "Keys change hands in 23 h · Cancel". */
function CoolingCard({ sale, busy, onCancel }: { sale: AssetSale; busy: boolean; onCancel: () => void }) {
  const seller = sale.role === "seller";
  return (
    <div className="card stack-8">
      <div className="row" style={{ gap: 12 }}>
        <Who sale={sale} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block" }}>⏳ Cooling-off</span>
          <span className="title" style={{ display: "block" }}>{sale.emoji} {sale.label}</span>
          <span className="meta" style={{ display: "block" }}>
            {seller ? `To ${handle(sale.with?.name ?? "")} for ${formatCash(sale.price)} · you get ${formatCash(sale.price - sale.fee)}`
              : `From ${handle(sale.with?.name ?? "")} · ${formatCash(sale.price)} in escrow`}
          </span>
        </span>
      </div>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="body-strong">{coolingLine(sale.coolingUntil)}</span>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onCancel}>{busy ? "…" : "Cancel"}</button>
      </div>
    </div>
  );
}

/** The seller's offer, waiting for an answer. */
function WaitingCard({ sale, busy, onWithdraw }: { sale: AssetSale; busy: boolean; onWithdraw: () => void }) {
  return (
    <div className="list-row static" style={{ alignItems: "center" }}>
      <Avatar style={sale.with?.style ?? "bodega_drip"} size={36} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="title one-line" style={{ display: "block" }}>{sale.emoji} {sale.label} · {formatCash(sale.price)}</span>
        <span className="meta one-line">Waiting for {handle(sale.with?.name ?? "")} to answer</span>
      </span>
      <button className="chip chip-sm" disabled={busy} onClick={onWithdraw}>Withdraw</button>
    </div>
  );
}

/** The sale form, in place: appraisal and band, the price, a friend, the fee up front, then confirm. */
function SellForm({ asset, api, onBack, onSent }: { asset: AssetView; api: AssetApi; onBack: () => void; onSent: (s: AssetSale) => void }) {
  const [people, setPeople] = useState<GiftCandidate[] | null>(null);
  const [price, setPrice] = useState(asset.appraisal);
  const [to, setTo] = useState<string | null>(null);
  const [step, setStep] = useState<"set" | "confirm">("set");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.buyers().then((r) => setPeople(r.ok ? r.data : [])); }, [api]);
  const { min, max } = asset.band;
  const valid = Number.isFinite(price) && price >= min && price <= max;
  const pick = people?.find((p) => p.id === to) ?? null;
  const send = async () => {
    if (!to || !valid) return;
    setBusy(true); setError(null);
    const r = await api.offer(asset.kind, asset.id, to, price);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onSent(r.data);
  };
  return (
    <div className="stack-12">
      <div>
        <button className="phone-back" onClick={step === "confirm" ? () => setStep("set") : onBack}><ChevronLeftIcon size={20} /> Back</button>
        <span className="overline" style={{ display: "block", marginTop: 4 }}>🔑 Sell to a friend</span>
        <h2 className="display-md" style={{ margin: 0 }}>{asset.emoji} {asset.label}</h2>
        <span className="meta">Appraised at {formatCash(asset.appraisal)} · the city allows {formatCash(min)} to {formatCash(max)}</span>
      </div>
      {step === "set" ? (
        <>
          <div className="card stack-8">
            <label className="overline" htmlFor="asset-price">Your price</label>
            <input id="asset-price" className="chat-input" type="number" inputMode="numeric" min={min} max={max} step={1} value={Number.isFinite(price) ? price : ""}
              onChange={(e) => setPrice(Math.round(Number(e.target.value)))} aria-describedby="asset-fee" />
            <input type="range" min={min} max={max} step={Math.max(1, Math.round((max - min) / 100))} value={valid ? price : asset.appraisal}
              aria-label="Price" onChange={(e) => setPrice(Number(e.target.value))} />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {priceChips(asset.appraisal).map((c) => (
                <button key={c} className="chip chip-sm" aria-pressed={price === c} onClick={() => setPrice(c)}>{formatCash(c)}</button>
              ))}
            </div>
            <span id="asset-fee" className={valid ? "body-strong" : "error-text"}>
              {valid ? saleFeeLine(price) : `Pick a price from ${formatCash(min)} to ${formatCash(max)}.`}
            </span>
          </div>
          <div className="stack-8" role="radiogroup" aria-label="Who it's for">
            <p className="overline" style={{ margin: 0 }}>To</p>
            {people === null && <p className="meta" style={{ margin: 0 }}>Finding your people…</p>}
            {people?.length === 0 && (
              <div className="card"><p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                Sales go to your Crew, your partner and people you&apos;ve chatted with. Real estate is a relationship business.
              </p></div>
            )}
            {people?.map((p) => (
              <button key={p.id} role="radio" aria-checked={to === p.id} disabled={!p.canReceive}
                className={`list-row crew-pick${to === p.id ? " on" : ""}`} onClick={() => setTo(p.id)}>
                <Avatar style={p.style} />
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span className="title one-line" style={{ display: "block" }}>{handle(p.name)}</span>
                  <span className="meta one-line">{p.partner ? "💞 Your partner" : p.crew ? "Crew" : "You've chatted"}{p.canReceive ? "" : " · can't buy yet"}</span>
                </span>
                {to === p.id && <span className="tag tag-event">Picked</span>}
              </button>
            ))}
          </div>
          <button className="btn btn-taxi" disabled={!to || !valid} onClick={() => setStep("confirm")}>Next</button>
        </>
      ) : (
        <>
          <div className="card stack-8">
            <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">To</span><span className="body-strong">{handle(pick?.name ?? "")}</span></div>
            <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Price</span><span className="body-strong">{formatCash(price)}</span></div>
            <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">City fee ({Math.round(asset.feeRate * 100)}%)</span><span className="body-strong">−{formatCash(economyFee("asset", price))}</span></div>
            <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">You get</span><span className="body-strong money-pos">{formatCash(afterFee("asset", price))}</span></div>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            They have {ASSET_SALES.offerDays} days to say yes. Then {ASSET_SALES.coolingHours} hours of cooling-off where either of you can back out; after
            that the keys change hands{asset.kind === "business" ? ", upgrades and all (whatever's in the till is yours first)" : " and you go back to renting"}.
            You can sell {ASSET_SALES.perMonth} things a month, and what you buy stays yours {ASSET_SALES.minOwnDays} days before it can be sold on.
          </p>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-taxi" disabled={busy} onClick={() => void send()}>{busy ? "…" : `Offer it · ${formatCash(price)}`}</button>
        </>
      )}
    </div>
  );
}
