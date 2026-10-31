"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCash } from "@/lib/economy";
import { everyVisible } from "@/lib/live";
import { PLAYER_ECONOMY, lockedLine } from "@/lib/playerEconomy";
import {
  MARKETPLACE, cashMax, holdLine, marketAlerts, saleFee, sellerGets, swapCheck,
  type ClosetItem, type MarketApi, type MarketListing, type MarketPerson, type MarketState, type MarketTrade, type MyThing, type TradeItem,
} from "@/lib/marketplace";
import { handle } from "@/lib/validation";
import { Avatar } from "../crew/Crew";
import { Toggle } from "../Toggle";

// The Player Economy, Phase 2 (migration 0152): Phone → Market. Browse (friends, or the open board), My listings with the
// List-an-item flow, and Offers: the trade window, both sides side by side, confirmed by both. The server decides every
// price, fee, limit and hold; this only shows and asks. Built from the app's own cards, rows and chips.

type Tab = "browse" | "listings" | "offers";
type Draft = { with: MarketPerson | { id: string; name: string; style: string }; trade: MarketTrade | null; mine: number[]; theirs: number[]; cashMine: number; cashTheirs: number };

const BLURB: Record<Tab, string> = {
  browse: "Your Crew's closets, priced by people who swear it's a deal.",
  listings: "Sell what you don't wear. The city takes 5% for its trouble.",
  offers: "Swaps in the trade window. Nothing moves until you both confirm.",
};

export function MarketApp({ api, cash, onChanged, onToast }: {
  api: MarketApi;
  cash: number;
  /** Cash or things changed: the game refreshes its numbers. */
  onChanged: () => void;
  onToast: (text: string) => void;
}) {
  const [s, setS] = useState<MarketState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [busy, setBusy] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const load = useCallback(async () => {
    const r = await api.state();
    if (r.ok) { setS(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => {
    void load();
    return everyVisible(() => void load(), 15_000);
  }, [load]);
  const run = async <T,>(key: string, p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: (d: T) => void) => {
    setBusy(key);
    const r = await p;
    setBusy(null);
    if (!r.ok) { onToast(r.error); return false; }
    done?.(r.data);
    void load();
    onChanged();
    return true;
  };

  if (!s) return <p className="meta">{error ?? "Unlocking the stall…"}</p>;
  if (!s.on) {
    return (
      <div className="card stack-8">
        <p className="overline" style={{ margin: 0 }}>🏷️ Opening soon</p>
        <p className="body" style={{ margin: 0 }}>The Market isn&apos;t open yet. The city is still printing price tags and arguing about what a used sofa is worth.</p>
        <p className="meta" style={{ margin: 0 }}>Soon: sell your things to your Crew, swap pieces in the trade window, all in C$. Gifts and the Jobs board are open now.</p>
      </div>
    );
  }
  const locked = lockedLine(s);
  const hold = holdLine(s.hold);
  const waiting = marketAlerts(s);
  if (draft) {
    return <TradeWindow api={api} draft={draft} me={s} cash={cash} busy={busy} onClose={() => setDraft(null)}
      run={run} onDone={(t) => { setDraft(null); setTab("offers"); if (t?.status === "done") onToast("🔁 Swap done. Everything moved at once, as promised."); }} />;
  }
  if (listing) {
    return <ListFlow items={s.items} busy={busy !== null} onClose={() => setListing(false)}
      onList={(id, price) => void run("list", api.list(id, price), () => { setListing(false); setTab("listings"); onToast(`🏷️ Listed. You'd get ${formatCash(sellerGets(price))} after the city fee.`); })} />;
  }
  return (
    <div className="stack-12">
      <p className="subtext" style={{ margin: 0 }}>{BLURB[tab]}</p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="tablist">
        <button className="chip" role="tab" aria-pressed={tab === "browse"} onClick={() => setTab("browse")}>Browse</button>
        <button className="chip" role="tab" aria-pressed={tab === "listings"} onClick={() => setTab("listings")}>My listings</button>
        <button className="chip" role="tab" aria-pressed={tab === "offers"} onClick={() => setTab("offers")}>Offers{waiting ? ` · ${waiting}` : ""}</button>
      </div>
      {(locked || hold) && <div className="card"><p className="body" style={{ margin: 0 }}>{locked ?? hold}</p></div>}
      {tab === "browse" && <Browse s={s} cash={cash} busy={busy} canTrade={!locked && !hold}
        onBuy={(l, sure) => run(`buy:${l.id}`, api.buy(l.id, sure), () => onToast(`🛍️ It's yours: ${l.name.toLowerCase()}. Keep it ${PLAYER_ECONOMY.noResaleDays} days before you flip it.`))}
        onOpen={(on) => void run("open", api.setOpen(on))} />}
      {tab === "listings" && (
        <div className="stack-8">
          <button className="btn btn-taxi" disabled={!!locked || !!hold} onClick={() => setListing(true)}>🏷️ List something</button>
          {s.mine.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing listed. Your closet is full of potential, and also clothes.</p>}
          {s.mine.map((l) => (
            <div key={l.id} className="list-row static">
              <span className="date-avatar" aria-hidden="true">{l.emoji ?? "🛍️"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="title one-line" style={{ display: "block" }}>{l.name}</span>
                <span className="meta one-line">
                  {l.status === "open" ? `${formatCash(l.price)} · you'd get ${formatCash(l.price - l.fee)}`
                    : l.status === "sold" ? `Sold to ${handle(l.buyerName)} · +${formatCash(l.price - l.fee)}`
                    : l.status === "reversed" ? "Reversed by the city" : l.status === "expired" ? "Expired, it's back in your things" : "Taken down"}
                </span>
              </span>
              {l.status === "open" && <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void run(`cancel:${l.id}`, api.cancel(l.id), () => onToast("Taken down. It's back in your things."))}>Take down</button>}
            </div>
          ))}
          <p className="meta" style={{ margin: 0 }}>Up to {MARKETPLACE.listing.maxOpen} at once, {MARKETPLACE.listing.days} days each. Prices stay within {Math.round(PLAYER_ECONOMY.band.min * 100)}% to {Math.round(PLAYER_ECONOMY.band.max * 100)}% of the Shop price.</p>
        </div>
      )}
      {tab === "offers" && <Offers s={s} api={api} busy={busy} canTrade={!locked && !hold}
        onOpen={(t) => setDraft({ with: { id: t.with ?? "", name: t.withName, style: t.withStyle ?? "" }, trade: t,
          mine: t.you.items.map((i) => i.id), theirs: t.them.items.map((i) => i.id), cashMine: t.you.cash, cashTheirs: t.them.cash })}
        onNew={(p) => setDraft({ with: p, trade: null, mine: [], theirs: [], cashMine: 0, cashTheirs: 0 })} />}
      <p className="subtext" style={{ margin: 0 }}>C$ and things only, never real money. Selling items for real money gets accounts banned. Clout Couture stays with its owner.</p>
    </div>
  );
}

function Browse({ s, cash, busy, canTrade, onBuy, onOpen }: {
  s: MarketState; cash: number; busy: string | null; canTrade: boolean;
  onBuy: (l: MarketListing, sure: boolean) => Promise<boolean>; onOpen: (on: boolean) => void;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [sure, setSure] = useState(false);
  const p = s.browse.find((l) => l.id === pick) ?? null;
  return (
    <div className="stack-8">
      {s.browse.length === 0 && (
        <div className="card stack-4">
          <p className="overline" style={{ margin: 0 }}>Nothing for sale</p>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>You see listings from your Crew, your partner and people you&apos;ve chatted with. Switch on the open board to see strangers&apos; too.</p>
        </div>
      )}
      {s.browse.map((l) => (
        <div key={l.id} className={`card stack-8${pick === l.id ? " date-invite" : ""}`}>
          <button className="list-row static" style={{ padding: 0, background: "none", border: 0, width: "100%", textAlign: "left" }}
            onClick={() => { setPick(pick === l.id ? null : l.id); setSure(false); }} aria-expanded={pick === l.id}>
            <span className="date-avatar" aria-hidden="true">{l.emoji ?? "🛍️"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="title one-line" style={{ display: "block" }}>{l.name}</span>
              <span className="meta one-line">{handle(l.sellerName)} · {l.friend ? "Crew & friends" : "Open board"} · Shop {formatCash(l.reference)}</span>
            </span>
            <span className="body-strong">{formatCash(l.price)}</span>
          </button>
          {pick === l.id && p && (
            <>
              <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">You pay</span><span className="body-strong">{formatCash(p.price)}</span></div>
              <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Bank after</span><span className={`body-strong${cash < p.price ? " money-neg" : ""}`}>{formatCash(Math.max(0, cash - p.price))}</span></div>
              <p className="meta" style={{ margin: 0 }}>
                They get {formatCash(sellerGets(p.price))} after the {formatCash(saleFee(p.price))} city fee. Yours to keep, not to flip, for {PLAYER_ECONOMY.noResaleDays} days.
                {p.skuLeft <= 1 ? ` You can get ${p.skuLeft} more of these from the Market this week.` : ""}
              </p>
              {p.owned ? <p className="meta" style={{ margin: 0 }}>You already own one.</p> : sure ? (
                <>
                  <p className="body-strong" style={{ margin: 0 }}>Are you sure? {formatCash(p.price)} is a lot of sofa.</p>
                  <button className="btn btn-taxi" disabled={busy !== null || !canTrade} onClick={() => void onBuy(p, true).then((ok) => { if (ok) setPick(null); })}>Yes, buy it</button>
                  <button className="btn btn-ghost" onClick={() => setSure(false)}>Not yet</button>
                </>
              ) : (
                <button className="btn btn-taxi" disabled={busy !== null || !canTrade || cash < p.price}
                  onClick={() => (p.price > MARKETPLACE.bigTrade ? setSure(true) : void onBuy(p, false).then((ok) => { if (ok) setPick(null); }))}>
                  {cash < p.price ? `${formatCash(p.price - cash)} short` : `Buy it · ${formatCash(p.price)}`}
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <div className="list-row static">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="title" style={{ display: "block" }}>Open board</span>
          <span className="meta">{s.open ? "Strangers on the open board see your listings and can offer swaps, and you see theirs." : "Only your Crew, partner and chats see your listings."}</span>
        </span>
        <Toggle on={s.open} label="Open board" disabled={busy !== null} onChange={() => onOpen(!s.open)} />
      </div>
    </div>
  );
}

const whyNot = (t: MyThing) =>
  t.worn ? "You're wearing it" : t.locked ? "Already listed or in a swap"
    : t.holdUntil && Date.parse(t.holdUntil) > Date.now() ? `Yours to keep until ${new Date(t.holdUntil).toLocaleDateString([], { month: "short", day: "numeric" })}`
    : t.acquired !== "bought" ? "Rewards stay with you" : "Can't be traded";

/** List an item: pick one of your things, set a price inside its band, see the fee. */
function ListFlow({ items, busy, onClose, onList }: { items: MyThing[]; busy: boolean; onClose: () => void; onList: (id: number, price: number) => void }) {
  const [pick, setPick] = useState<MyThing | null>(null);
  const [price, setPrice] = useState(0);
  const ready = items.filter((t) => t.ok && !t.worn && !t.locked);
  const not = items.filter((t) => !ready.includes(t));
  return (
    <div className="stack-12">
      <button className="btn btn-ghost" onClick={pick ? () => setPick(null) : onClose}>‹ {pick ? "Pick something else" : "Back to the Market"}</button>
      {!pick ? (
        <>
          <p className="overline" style={{ margin: 0 }}>What are you selling?</p>
          {ready.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing you can list right now. Buy something in the Shop first, or take something off.</p>}
          {ready.map((t) => (
            <button key={t.id} className="list-row crew-pick" onClick={() => { setPick(t); setPrice(t.reference); }}>
              <span className="date-avatar" aria-hidden="true">{t.emoji ?? "🛍️"}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="title one-line" style={{ display: "block" }}>{t.name}</span>
                <span className="meta one-line">Shop {formatCash(t.reference)} · list for {formatCash(t.min)} to {formatCash(t.max)}</span>
              </span>
            </button>
          ))}
          {not.length > 0 && (
            <div className="stack-4">
              <p className="overline" style={{ margin: 0 }}>Not now</p>
              {not.map((t) => <p key={t.id} className="meta" style={{ margin: 0 }}>{t.emoji} {t.name} · {whyNot(t)}</p>)}
            </div>
          )}
        </>
      ) : (
        <div className="card stack-12">
          <p className="title" style={{ margin: 0 }}>{pick.emoji} {pick.name}</p>
          <label className="stack-4">
            <span className="meta">Price: {formatCash(price)} (Shop {formatCash(pick.reference)})</span>
            <input type="range" min={pick.min} max={pick.max} step={Math.max(1, Math.round(pick.reference / 100))} value={price}
              aria-label="Price" onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {[0.75, 1, 1.25].map((f) => {
              const v = Math.min(pick.max, Math.max(pick.min, Math.round(pick.reference * f)));
              return <button key={f} className="chip chip-sm" aria-pressed={price === v} onClick={() => setPrice(v)}>{formatCash(v)}</button>;
            })}
          </div>
          <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">City fee (5%)</span><span className="body-strong">−{formatCash(saleFee(price))}</span></div>
          <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">You get</span><span className="body-strong money-pos">{formatCash(sellerGets(price))}</span></div>
          <p className="meta" style={{ margin: 0 }}>It&apos;s locked while it&apos;s listed: no wearing it, no selling it to the Shop. Take it down any time.</p>
          <button className="btn btn-taxi" disabled={busy} onClick={() => onList(pick.id, price)}>List it · {formatCash(price)}</button>
        </div>
      )}
    </div>
  );
}

function Offers({ s, api, busy, canTrade, onOpen, onNew }: {
  s: MarketState; api: MarketApi; busy: string | null; canTrade: boolean; onOpen: (t: MarketTrade) => void; onNew: (p: MarketPerson) => void;
}) {
  const [people, setPeople] = useState<MarketPerson[] | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => { if (picking && !people) void api.people().then((r) => setPeople(r.ok ? r.data : [])); }, [picking, people, api]);
  const open = s.trades.filter((t) => t.status === "open");
  const closed = s.trades.filter((t) => t.status !== "open");
  return (
    <div className="stack-8">
      {!picking ? <button className="btn btn-taxi" disabled={!canTrade || busy !== null} onClick={() => setPicking(true)}>🔁 Offer a swap</button> : (
        <div className="card stack-8" role="radiogroup" aria-label="Swap with">
          <p className="overline" style={{ margin: 0 }}>Swap with</p>
          {people === null && <p className="meta" style={{ margin: 0 }}>Finding your people…</p>}
          {people?.length === 0 && <p className="meta" style={{ margin: 0 }}>Swaps are for your Crew, your partner and people you&apos;ve chatted with. Make a friend. Brunch works.</p>}
          {people?.map((p) => (
            <button key={p.id} className="list-row crew-pick" disabled={!p.canTrade} onClick={() => { setPicking(false); onNew(p); }}>
              <Avatar style={p.style} />
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="title one-line" style={{ display: "block" }}>{handle(p.name)}</span>
                <span className="meta one-line">{p.partner ? "💞 Your partner" : p.crew ? "Crew" : "You've chatted"}{p.canTrade ? "" : " · can't trade yet"}</span>
              </span>
            </button>
          ))}
          <button className="btn btn-ghost" onClick={() => setPicking(false)}>Never mind</button>
        </div>
      )}
      {open.length === 0 && !picking && <p className="meta" style={{ margin: 0 }}>No swaps open. Your closet is a trading floor waiting to happen.</p>}
      {open.map((t) => <TradeRow key={t.id} t={t} onOpen={() => onOpen(t)} />)}
      {closed.length > 0 && <p className="overline" style={{ margin: "8px 0 0" }}>Lately</p>}
      {closed.map((t) => <TradeRow key={t.id} t={t} />)}
    </div>
  );
}

const STATUS: Record<MarketTrade["status"], string> = {
  open: "", done: "Done 🔁", declined: "Declined", cancelled: "Called off", expired: "Ran out of time", reversed: "Reversed by the city",
};

function TradeRow({ t, onOpen }: { t: MarketTrade; onOpen?: () => void }) {
  const line = t.status !== "open" ? STATUS[t.status]
    : t.you.ok ? "Waiting for them to confirm" : t.them.ok ? "They confirmed: your turn" : "Changed: you both need to confirm";
  const body = (
    <>
      <Avatar style={t.withStyle ?? ""} size={36} />
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="title one-line" style={{ display: "block" }}>{handle(t.withName)} · {t.you.items.map((i) => i.emoji).join("")} ⇄ {t.them.items.map((i) => i.emoji).join("")}</span>
        <span className="meta one-line">{line}</span>
      </span>
      {t.status === "open" && !t.you.ok && <span className="tag tag-event">You</span>}
    </>
  );
  return onOpen ? <button className="list-row" onClick={onOpen}>{body}</button> : <div className="list-row static">{body}</div>;
}

const sum = (xs: { reference: number }[]) => xs.reduce((n, x) => n + x.reference, 0);

/** The trade window: what you give and what you get, side by side, exactly as both of you see it. */
function TradeWindow({ api, draft, me, cash, busy, onClose, onDone, run }: {
  api: MarketApi; draft: Draft; me: MarketState; cash: number; busy: string | null; onClose: () => void;
  onDone: (t: MarketTrade | null) => void;
  run: <T,>(key: string, p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: (d: T) => void) => Promise<boolean>;
}) {
  const [t, setTrade] = useState<MarketTrade | null>(draft.trade);
  const [editing, setEditing] = useState(!draft.trade);
  const [mine, setMine] = useState<number[]>(draft.mine);
  const [theirs, setTheirs] = useState<number[]>(draft.theirs);
  const [cashMine, setCashMine] = useState(draft.cashMine);
  const [cashTheirs, setCashTheirs] = useState(draft.cashTheirs);
  const [closet, setCloset] = useState<ClosetItem[] | null>(null);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!editing || closet) return;
    void api.closet(draft.with.id).then((r) => setCloset(r.ok ? r.data : []));
  }, [editing, closet, api, draft.with.id]);
  const myThings = me.items.filter((x) => (x.ok && !x.worn && !x.locked) || (t && x.locked === `trade:${t.id}`) || mine.includes(x.id));
  const theirThings: (ClosetItem | TradeItem)[] = useMemo(() => {
    const extra = (t?.them.items ?? []).filter((i) => !(closet ?? []).some((c) => c.id === i.id));
    return [...(closet ?? []), ...extra];
  }, [closet, t]);
  const youGive = editing ? myThings.filter((x) => mine.includes(x.id)) : t!.you.items;
  const youGet = editing ? theirThings.filter((x) => theirs.includes(x.id)) : t!.them.items;
  const giveCash = editing ? cashMine : t!.you.cash;
  const getCash = editing ? cashTheirs : t!.them.cash;
  const gv = sum(youGive);
  const tv = sum(youGet);
  const check = swapCheck({ items: youGive.length, value: gv, cash: giveCash }, { items: youGet.length, value: tv, cash: getCash });
  const big = Math.max(gv + giveCash, tv + getCash) > MARKETPLACE.bigTrade;
  const toggle = (xs: number[], set: (v: number[]) => void, id: number) =>
    set(xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= MARKETPLACE.swap.maxItems ? xs : [...xs, id]);
  const closed = t && t.status !== "open";
  const confirm = (s: boolean) => void run(`confirm:${t!.id}`, api.confirm(t!.id, t!.version, s), (r) => onDone(r));
  return (
    <div className="stack-12">
      <button className="btn btn-ghost" onClick={onClose}>‹ Back to offers</button>
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={draft.with.style} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block" }}>🔁 Trade window</span>
          <span className="title">With {handle(draft.with.name)}</span>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Side title="You give" items={youGive} cash={giveCash} ok={t && !editing ? t.you.ok : null} />
        <Side title="You get" items={youGet} cash={getCash} ok={t && !editing ? t.them.ok : null} />
      </div>
      <p className={`meta${check.ok ? "" : " error-text"}`} style={{ margin: 0 }}>
        {check.ok ? `Shop value ${formatCash(gv + giveCash)} for ${formatCash(tv + getCash)}. Balanced enough for the city.`
          : check.reason === "no_items" ? "Pick at least one thing on each side."
          : check.reason === "too_much_cash" ? "C$ can only top a side up: at most as much as its things are worth."
          : check.reason === "too_many_items" ? `Up to ${MARKETPLACE.swap.maxItems} things a side.`
          : "Not balanced: each side has to be worth between half and one and a half times the other."}
      </p>
      {editing ? (
        <>
          <div className="stack-4">
            <p className="overline" style={{ margin: 0 }}>Your things</p>
            {myThings.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing you can trade right now.</p>}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {myThings.map((x) => <button key={x.id} className="chip chip-sm" aria-pressed={mine.includes(x.id)} onClick={() => toggle(mine, setMine, x.id)}>{x.emoji} {x.name} · {formatCash(x.reference)}</button>)}
            </div>
            <CashField label="Add C$ from you" value={cashMine} max={Math.min(cashMax(sum(myThings.filter((x) => mine.includes(x.id)))), cash)} onChange={setCashMine} />
          </div>
          <div className="stack-4">
            <p className="overline" style={{ margin: 0 }}>{handle(draft.with.name)}&apos;s things</p>
            {closet === null && <p className="meta" style={{ margin: 0 }}>Peeking in their closet…</p>}
            {closet?.length === 0 && theirThings.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing they can trade right now.</p>}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {theirThings.map((x) => <button key={x.id} className="chip chip-sm" aria-pressed={theirs.includes(x.id)} onClick={() => toggle(theirs, setTheirs, x.id)}>{x.emoji} {x.name} · {formatCash(x.reference)}</button>)}
            </div>
            <CashField label="Ask for C$ from them" value={cashTheirs} max={cashMax(sum(theirThings.filter((x) => theirs.includes(x.id))))} onChange={setCashTheirs} />
          </div>
          <p className="meta" style={{ margin: 0 }}>
            {t ? "Changing it resets both confirmations and hands everything back until you both confirm again." : "Sending it confirms your side: your things are locked and your C$ held until they answer, for up to 24 hours."}
            {" "}The city takes 5% of any C$ that changes hands.
          </p>
          <button className="btn btn-taxi" disabled={busy !== null || !check.ok}
            onClick={() => void (t
              ? run(`edit:${t.id}`, api.edit(t.id, t.version, mine, theirs, cashMine, cashTheirs), (r) => { setTrade(r); setEditing(false); })
              : run("offer", api.offer(draft.with.id, mine, theirs, cashMine, cashTheirs), (r) => onDone(r)))}>
            {t ? "Send the changes" : "Send the offer"}
          </button>
          {t && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Keep it as it was</button>}
        </>
      ) : closed ? (
        <p className="meta" style={{ margin: 0 }}>{STATUS[t!.status]}.</p>
      ) : (
        <>
          <p className="meta" style={{ margin: 0 }}>
            {t!.you.ok ? `You confirmed. Waiting for ${handle(t!.withName)}.` : t!.them.ok ? `${handle(t!.withName)} confirmed. Your turn.` : "It changed, so you both confirm again."}
            {" "}Closes {new Date(t!.expiresAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} if not.
          </p>
          {!t!.you.ok && (sure ? (
            <>
              <p className="body-strong" style={{ margin: 0 }}>Are you sure? That&apos;s over {formatCash(MARKETPLACE.bigTrade)} of stuff changing hands.</p>
              <button className="btn btn-green" disabled={busy !== null} onClick={() => confirm(true)}>Yes, confirm</button>
              <button className="btn btn-ghost" onClick={() => setSure(false)}>Not yet</button>
            </>
          ) : (
            <button className="btn btn-green" disabled={busy !== null || (giveCash > cash)} onClick={() => (big ? setSure(true) : confirm(false))}>
              {giveCash > cash ? `${formatCash(giveCash - cash)} short` : "Confirm the swap"}
            </button>
          ))}
          <button className="btn btn-secondary" disabled={busy !== null} onClick={() => setEditing(true)}>Change it</button>
          <button className="btn btn-ghost" disabled={busy !== null} onClick={() => void run(`cancel:${t!.id}`, api.cancelTrade(t!.id), (r) => onDone(r))}>Walk away</button>
        </>
      )}
    </div>
  );
}

function Side({ title, items, cash, ok }: { title: string; items: { id: number; name: string; emoji: string | null; reference: number }[]; cash: number; ok: boolean | null }) {
  return (
    <div className="card stack-4" style={{ minWidth: 0 }}>
      <span className="overline">{title}{ok !== null ? (ok ? " · ✓" : " · …") : ""}</span>
      {items.length === 0 && cash === 0 && <span className="meta">Nothing yet</span>}
      {items.map((i) => <span key={i.id} className="body one-line">{i.emoji} {i.name}</span>)}
      {cash > 0 && <span className="body-strong">+ {formatCash(cash)}</span>}
      <span className="meta">Shop value {formatCash(sum(items) + cash)}</span>
    </div>
  );
}

function CashField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const cap = Math.max(0, max);
  useEffect(() => { if (value > cap) onChange(cap); }, [value, cap, onChange]);
  if (cap <= 0) return null;
  return (
    <label className="stack-4">
      <span className="meta">{label}: {formatCash(Math.min(value, cap))} (up to {formatCash(cap)})</span>
      <input type="range" min={0} max={cap} step={Math.max(1, Math.round(cap / 50))} value={Math.min(value, cap)} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
