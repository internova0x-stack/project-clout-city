"use client";

import { useState } from "react";
import { CITY_ECONOMY, SHOP_CATEGORIES, SHOP_ITEMS, itemBySku, purchaseClout, sellPrice, type ShopCategory, type ShopItem } from "@/lib/city";
import { billStatusLine, daysBetween, dueBills, netWorth, ownedSkus, type Bill, type CityState, type PlayerItem } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";
import { IconTile, SheetTitle, Stars } from "./Common";

type Busy = string | null;

// ---------------------------------------------------------------------------
// Shop (C10 category chips, C23 item cards). Virtual cash only.
// ---------------------------------------------------------------------------
export function ShopSheet({
  open, onClose, state, busy, onBuy,
}: { open: boolean; onClose: () => void; state: CityState; busy: Busy; onBuy: (sku: string, mode: "buy" | "rent") => Promise<boolean> }) {
  const [cat, setCat] = useState<ShopCategory>("fashion");
  const [confirm, setConfirm] = useState<{ item: ShopItem; mode: "buy" | "rent" } | null>(null);
  const owned = ownedSkus(state);
  const { player } = state;
  const items = SHOP_ITEMS.filter((i) => i.category === cat);
  return (
    <>
      <Sheet open={open && !confirm} onClose={onClose} label="Shop" tall>
        <div className="stack-16">
          <SheetTitle right={formatCash(player.bank_cash)}>Shop</SheetTitle>
          <div className="chip-row" role="group" aria-label="Categories">
            {SHOP_CATEGORIES.map((c) => (
              <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
          {cat === "houses" && <p className="subtext" style={{ margin: 0 }}>Own a house and rent stops. Sell it and rent starts again.</p>}
          {cat === "cars" && <p className="subtext" style={{ margin: 0 }}>Owned cars cost {CITY_ECONOMY.bills.carInsuranceRate * 100}% a week in insurance. Rentals bill weekly.</p>}
          <div className="item-grid">
            {items.map((item) => {
              const isOwned = owned.has(item.sku) || (item.category === "cars" && player.car_sku === item.sku);
              const short = player.bank_cash < item.price;
              return (
                <div key={item.sku} className="item-card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <IconTile emoji={item.emoji} />
                    <span className="meta">{item.neighborhood ?? item.wear?.slot ?? ""}</span>
                  </div>
                  <span className="title" style={{ display: "block" }}>{item.name}</span>
                  <span className="subtext clamp-2">{item.blurb}</span>
                  <Stars rating={item.rating} />
                  <span className="meta">🔥 up to +{purchaseClout(item.clout, player.purchases_count)}</span>
                  {isOwned ? (
                    <span className="owned-chip">{player.car_sku === item.sku && player.car_mode === "rented" ? "Renting" : "Owned"}</span>
                  ) : (
                    <div className="stack-4">
                      <button className={`btn btn-green btn-sm${short ? " short" : ""}`} disabled={busy !== null} onClick={() => setConfirm({ item, mode: "buy" })}>
                        {formatCash(item.price)}
                      </button>
                      {!!item.rentPerWeek && (
                        <button className="btn btn-secondary btn-sm" disabled={busy !== null || player.car_mode === "owned"} onClick={() => setConfirm({ item, mode: "rent" })}>
                          Rent {formatCash(item.rentPerWeek)}/wk
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Sheet>
      <Sheet open={open && !!confirm} onClose={() => setConfirm(null)} label="Confirm purchase">
        {confirm && (() => {
          const price = confirm.mode === "rent" ? confirm.item.rentPerWeek! : confirm.item.price;
          const after = player.bank_cash - price;
          return (
            <div className="stack-16">
              <IconTile emoji={confirm.item.emoji} />
              <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>
                {confirm.mode === "rent" ? `Rent the ${confirm.item.name.toLowerCase()}?` : `Buy the ${confirm.item.name.toLowerCase()}?`}
              </h2>
              <div className="card stack-8">
                <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Price</span><span className="body-strong">{formatCash(price)}{confirm.mode === "rent" ? " this week" : ""}</span></div>
                <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Bank after</span><span className={`body-strong ${after < 0 ? "money-neg" : ""}`}>{formatCash(Math.max(0, after))}</span></div>
                {confirm.mode === "buy" && <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Clout</span><span className="body-strong" style={{ color: "var(--taxi-500)" }}>🔥 +{owned.has(confirm.item.sku) ? 0 : purchaseClout(confirm.item.clout, player.purchases_count)}</span></div>}
              </div>
              {after < 0 && <p className="error-text" style={{ margin: 0 }}>You&apos;re {formatCash(-after)} short. Work a shift or take a gig.</p>}
              {confirm.mode === "rent" && <p className="meta" style={{ margin: 0 }}>Bills {formatCash(price)} every week until you return it.</p>}
              <button
                className="btn btn-green"
                disabled={after < 0 || busy !== null}
                onClick={async () => { if (await onBuy(confirm.item.sku, confirm.mode)) setConfirm(null); }}
              >
                {busy ? "…" : confirm.mode === "rent" ? `Rent for ${formatCash(price)}` : `Buy for ${formatCash(price)}`}
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Not now</button>
            </div>
          );
        })()}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Possessions (C25): bank cash, then items by category; sell at 60%.
// ---------------------------------------------------------------------------
export function PossessionsSheet({
  open, onClose, state, style, busy, onSell,
}: { open: boolean; onClose: () => void; state: CityState; style: StyleId; busy: Busy; onSell: (itemId: number) => Promise<boolean> }) {
  const [detail, setDetail] = useState<PlayerItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const total = netWorth(state);
  const starter = getStyle(style).starterItems;
  const close = () => { setDetail(null); setConfirming(false); };
  const item = detail ? itemBySku(detail.sku) : undefined;
  return (
    <>
      <Sheet open={open && !detail} onClose={onClose} label="Possessions" tall>
        <div className="stack-16">
          <SheetTitle right={formatCash(total)}>Possessions</SheetTitle>
          <div className="list-row static">
            <IconTile emoji="💵" size={40} />
            <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>Bank cash</span></span>
            <span className="body-strong tabular">{formatCash(state.player.bank_cash)}</span>
          </div>
          {SHOP_CATEGORIES.map((c) => {
            const mine = state.items.filter((i) => i.category === c.id);
            const starters = c.id === "fashion" ? starter : [];
            if (!mine.length && !starters.length) return null;
            return (
              <div key={c.id}>
                <p className="overline" style={{ margin: "0 0 4px" }}>{c.label}</p>
                {mine.map((i) => {
                  const it = itemBySku(i.sku);
                  return (
                    <button key={i.id} className="list-row" onClick={() => setDetail(i)}>
                      <IconTile emoji={it?.emoji ?? "📦"} size={40} />
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <span className="title" style={{ display: "block" }}>{it?.name ?? i.sku}</span>
                        <span className="meta">{i.acquired === "earned" ? "Earned" : "Bought"}{i.equipped ? " · Wearing" : ""}</span>
                      </span>
                      <span className="body-strong tabular">{formatCash(i.value)}</span>
                    </button>
                  );
                })}
                {starters.map((s) => (
                  <div key={s} className="list-row static">
                    <IconTile emoji="🧺" size={40} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="title" style={{ display: "block" }}>{s}</span>
                      <span className="meta">Starter · Can&apos;t be sold</span>
                    </span>
                    <span className="body-strong tabular">{formatCash(0)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Sheet>
      <Sheet open={open && !!detail} onClose={close} label={item?.name ?? "Item"}>
        {detail && item && (
          <div className="stack-16">
            <IconTile emoji={item.emoji} />
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>
              {confirming ? `Sell your ${item.name.toLowerCase()} for ${formatCash(sellPrice(detail.value))}?` : item.name}
            </h2>
            {confirming ? (
              <>
                <p className="body" style={{ margin: 0 }}>
                  Net worth drops by {formatCash(detail.value - sellPrice(detail.value))}. The clout you earned stays; buying it back pays no clout.
                  {item.category === "houses" && " Rent starts again next week."}
                </p>
                <button className="btn btn-destructive" disabled={busy !== null} onClick={async () => { if (await onSell(detail.id)) close(); }}>
                  {busy ? "…" : `Sell for ${formatCash(sellPrice(detail.value))}`}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Keep it</button>
              </>
            ) : (
              <>
                <p className="subtext" style={{ margin: 0 }}>{item.blurb}</p>
                <div className="card stack-8">
                  <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Value</span><span className="body-strong">{formatCash(detail.value)}</span></div>
                  <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Sells for (60%)</span><span className="body-strong">{formatCash(sellPrice(detail.value))}</span></div>
                </div>
                <button className="btn btn-destructive" onClick={() => setConfirming(true)}>Sell for {formatCash(sellPrice(detail.value))}</button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Your Look: wear owned fashion over the starting style, one item per slot.
// ---------------------------------------------------------------------------
const SLOT_LABEL = { top: "Top", bottom: "Bottom", shoes: "Shoes", accessory: "Accessory" } as const;

export function LookSheet({
  open, onClose, state, busy, onEquip, onShop,
}: { open: boolean; onClose: () => void; state: CityState; busy: Busy; onEquip: (itemId: number, on: boolean) => void; onShop: () => void }) {
  const fashion = state.items.filter((i) => i.category === "fashion");
  return (
    <Sheet open={open} onClose={onClose} label="Your look">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Your look</h2>
        <p className="subtext" style={{ margin: 0 }}>Wear what you own. Anything you don&apos;t wear falls back to your starting style.</p>
        {fashion.length === 0 ? (
          <div className="card stack-8">
            <p className="body" style={{ margin: 0 }}>Your closet is just your starter outfit. Iconic, but finite.</p>
            <button className="btn btn-secondary" onClick={onShop}>Browse fashion</button>
          </div>
        ) : (
          (["top", "bottom", "shoes", "accessory"] as const).map((slot) => {
            const rows = fashion.filter((i) => itemBySku(i.sku)?.wear?.slot === slot);
            if (!rows.length) return null;
            return (
              <div key={slot}>
                <p className="overline" style={{ margin: "0 0 4px" }}>{SLOT_LABEL[slot]}</p>
                {rows.map((i) => {
                  const it = itemBySku(i.sku)!;
                  return (
                    <div key={i.id} className="list-row static">
                      <span className="swatch" style={{ background: it.wear!.color, width: 32, height: 32 }} aria-hidden="true" />
                      <span style={{ flex: 1, minWidth: 0 }}><span className="title">{it.name}</span></span>
                      <button className={`chip${i.equipped ? "" : ""}`} aria-pressed={i.equipped} disabled={busy !== null} onClick={() => onEquip(i.id, !i.equipped)}>
                        {i.equipped ? "Wearing" : "Wear"}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bills: weekly rent and phone, car rental or insurance. Protected from stories.
// ---------------------------------------------------------------------------
const BILL_LABEL: Record<Bill["kind"], string> = { rent: "🏠 Rent", phone: "📱 Phone", car_rental: "🚗 Car rental", car_insurance: "🛡️ Car insurance" };

export function BillsSheet({
  open, onClose, state, busy, onPay,
}: { open: boolean; onClose: () => void; state: CityState; busy: Busy; onPay: (billId: number) => void }) {
  const due = dueBills(state);
  const paid = state.bills.filter((b) => b.status !== "due").slice(0, 8);
  const { player, today } = state;
  const nextRent = player.next_rent_due;
  return (
    <Sheet open={open} onClose={onClose} label="Bills">
      <div className="stack-16">
        <SheetTitle right={due.length ? `${formatCash(due.reduce((a, b) => a + b.amount, 0))} due` : "All paid"}>Bills</SheetTitle>
        {due.length === 0 && (
          <div className="card"><p className="body" style={{ margin: 0 }}>Nothing due. Savor it; in New York this feeling lasts about a week.</p></div>
        )}
        {due.map((b) => {
          const late = daysBetween(b.due_date, today);
          const short = player.bank_cash < b.amount;
          return (
            <div key={b.id} className={`bill-card${late > CITY_ECONOMY.bills.graceDays && b.kind === "rent" ? " overdue" : late > 0 ? " late" : ""}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{BILL_LABEL[b.kind]}</span>
                <span className="meta">{billStatusLine(b, today)}</span>
              </div>
              <button className="btn btn-green btn-sm" disabled={short || busy !== null} onClick={() => onPay(b.id)}>
                {busy === `bill:${b.id}` ? "…" : `Pay ${formatCash(b.amount)}`}
              </button>
            </div>
          );
        })}
        <p className="meta" style={{ margin: 0 }}>
          {player.house_sku ? "You own your home: no rent." : nextRent ? `Next rent bill: ${new Date(`${nextRent}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}.` : ""}
          {" "}Miss rent and you get {CITY_ECONOMY.bills.graceDays} days of grace, then Mood drops daily; after {CITY_ECONOMY.bills.evictAfterDays} days you move to the cheapest studio.
        </p>
        {paid.length > 0 && (
          <div>
            <p className="overline" style={{ margin: "0 0 4px" }}>Recent</p>
            {paid.map((b) => (
              <div key={b.id} className="ledger-row">
                <span><span className="title" style={{ display: "block", fontSize: 15 }}>{BILL_LABEL[b.kind]}</span><span className="meta">{b.status === "paid" ? "Paid" : "Forgiven on move-out"}</span></span>
                <span className="body-strong">{formatCash(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
