"use client";

import { useState } from "react";
import { CITY_ECONOMY, FURNITURE_ROOMS, SHOP_CATEGORIES, SHOP_ITEMS, itemBySku, purchaseClout, sellPrice, type FurnitureRoom, type ShopCategory, type ShopItem } from "@/lib/city";
import { billProgress, billStatusLine, daysBetween, dueBills, upcomingBills, netWorth, ownedSkus, type Bill, type CityState, type PlayerItem } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";
import { IconTile, SheetTitle, Stars } from "./Common";
import { storyItemOpen, type StoryFeed } from "@/lib/storyFeed";
import { formatPrice, type StoreProduct } from "@/lib/store";

/** Real-money purchases from inside a sheet: the catalog row, and Stripe Checkout. */
export interface RealMoney {
  product: (sku: string) => StoreProduct | undefined;
  buy: (sku: string) => void;
  busy: string | null;
}

type Busy = string | null;

// ---------------------------------------------------------------------------
// Shop (C10 category chips, C23 item cards). Virtual cash only.
// ---------------------------------------------------------------------------
export function ShopSheet({
  open, onClose, state, busy, onBuy, onEquip, story = null, realMoney, initialCategory = "fashion", onTryOn, section, onTryAtHome,
}: {
  open: boolean; onClose: () => void; state: CityState; busy: Busy; onBuy: (sku: string, mode: "buy" | "rent") => Promise<boolean>;
  /** #15: owned clothes can be put on straight from the Shop. */
  onEquip?: (itemId: number, on: boolean) => void;
  story?: StoryFeed | null;
  /** Collector pieces are sold for real cash only (Stripe); without it they stay hidden. */
  realMoney?: RealMoney;
  /** The boutique and the dealership open the Shop on their category. */
  initialCategory?: ShopCategory;
  /** v0.7 step 4: every clothing piece can be tried on before buying (#24). */
  onTryOn?: (item: ShopItem) => void;
  /** #19 Fif's Furniture: the Home tab's room to open on ("living", "bedroom"...). */
  section?: string;
  /** #19: place a Home piece in your home for a look before buying. */
  onTryAtHome?: (item: ShopItem) => void;
}) {
  const [cat, setCat] = useState<ShopCategory>(initialCategory);
  const [lastInitial, setLastInitial] = useState(initialCategory);
  if (initialCategory !== lastInitial) {
    setLastInitial(initialCategory);
    setCat(initialCategory);
  }
  const [confirm, setConfirm] = useState<{ item: ShopItem; mode: "buy" | "rent" } | null>(null);
  const owned = ownedSkus(state);
  const { player } = state;
  // Owned clothes get a Wear button instead of a bare "Owned" (#15).
  const wearControl = (sku: string) => {
    const mine = state.items.find((i) => i.sku === sku && i.category === "fashion");
    if (!mine || !onEquip || !itemBySku(sku)?.wear) return null;
    return (
      <button className={`btn btn-sm ${mine.equipped ? "btn-secondary" : "btn-taxi"}`} disabled={busy !== null} onClick={() => onEquip(mine.id, !mine.equipped)}>
        {mine.equipped ? "Wearing ✓" : "Wear"}
      </button>
    );
  };
  // Story-only items (e.g. the "Forever Our Bird" hoodie) show only while a story has them on sale.
  // Collector pieces show only when they're in the store catalog (migration 0008+ and Stripe set up).
  const items = SHOP_ITEMS.filter((i) => i.category === cat
    && (i.category !== "fashion" || !!i.wear) // clothing that can't be worn isn't sold (#15)
    && (!i.storyOnly || storyItemOpen(story, i.sku).open || owned.has(i.sku))
    && (!i.collector || !!realMoney?.product(i.sku) || owned.has(i.sku)));
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
          {cat === "home" && (
            <HomeShelf
              items={items}
              owned={owned}
              cash={player.bank_cash}
              purchases={player.purchases_count}
              busy={busy !== null}
              section={section}
              onBuy={(item) => setConfirm({ item, mode: "buy" })}
              onTryAtHome={onTryAtHome}
            />
          )}
          {cat === "cars" && <p className="subtext" style={{ margin: 0 }}>Owned cars cost {CITY_ECONOMY.bills.carInsuranceRate * 100}% of their price a week in insurance. Rentals bill weekly too.</p>}
          {cat !== "home" && <div className="item-grid">
            {items.map((item) => {
              const isOwned = owned.has(item.sku) || (item.category === "cars" && player.car_sku === item.sku);
              const short = player.bank_cash < item.price;
              // Fantasy outfits wait for clout (#9): try them on any time, buy once you're big enough.
              const locked = (item.cloutReq ?? 0) > player.clout;
              if (item.collector) {
                const p = realMoney?.product(item.sku);
                return (
                  <div key={item.sku} className="item-card collector">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <IconTile emoji={item.emoji} item={item} />
                      <span className="tag tag-gold">✨ Real cash</span>
                    </div>
                    <span className="title" style={{ display: "block" }}>{item.name}</span>
                    <span className="subtext clamp-2">{item.blurb}</span>
                    <Stars rating={item.rating} />
                    <span className="meta">🔥 up to +{purchaseClout(item.clout, player.purchases_count)} · worth {formatCash(p?.value ?? 0)}</span>
                    {isOwned || p?.owned ? (
                      wearControl(item.sku) ?? <span className="owned-chip">Owned</span>
                    ) : p?.pending || realMoney?.busy === `buy:${item.sku}` ? (
                      <button className="btn btn-taxi btn-sm" disabled>{p?.pending ? "Unlocking…" : "Opening checkout…"}</button>
                    ) : (
                      <button className="btn btn-taxi btn-sm" disabled={!p || busy !== null} onClick={() => realMoney?.buy(item.sku)}>
                        {p ? formatPrice(p.priceCents, p.currency) : "Unavailable"}
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <div key={item.sku} className="item-card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <IconTile emoji={item.emoji} item={item} />
                    {item.storyOnly ? <span className="tag tag-event">Limited</span> : <span className="meta">{item.neighborhood ?? item.wear?.slot ?? ""}</span>}
                  </div>
                  <span className="title" style={{ display: "block" }}>{item.name}</span>
                  <span className="subtext clamp-2">{item.blurb}</span>
                  <Stars rating={item.rating} />
                  {item.cloutReq ? (
                    <span className={`meta${locked ? " locked" : ""}`}>{locked ? "🔒" : "🔓"} {item.cloutReq.toLocaleString("en-US")} clout{locked ? ` · you have ${player.clout.toLocaleString("en-US")}` : ""}</span>
                  ) : (
                    <span className="meta">🔥 up to +{purchaseClout(item.clout, player.purchases_count)}</span>
                  )}
                  {isOwned ? (
                    wearControl(item.sku) ?? <span className="owned-chip">{player.car_sku === item.sku && player.car_mode === "rented" ? "Renting" : "Owned"}</span>
                  ) : (
                    <div className="buy-rent">
                      {onTryOn && item.wear && (
                        <button className="btn btn-secondary btn-sm" onClick={() => onTryOn(item)}>Try it on</button>
                      )}
                      {locked ? (
                        <button className="btn btn-secondary btn-sm" disabled>🔒 {formatCash(item.price)}</button>
                      ) : (
                        <button className={`btn btn-taxi btn-sm${short ? " short" : ""}`} disabled={busy !== null} onClick={() => setConfirm({ item, mode: "buy" })}>
                          {formatCash(item.price)}
                        </button>
                      )}
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
          </div>}
        </div>
      </Sheet>
      <Sheet open={open && !!confirm} onClose={() => setConfirm(null)} label="Confirm purchase">
        {confirm && (() => {
          const price = confirm.mode === "rent" ? confirm.item.rentPerWeek! : confirm.item.price;
          const after = player.bank_cash - price;
          return (
            <div className="stack-16">
              <IconTile emoji={confirm.item.emoji} item={confirm.item} />
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
                className="btn btn-taxi"
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
// Net Worth (C25, renamed from Possessions in #30): bank cash, then items by category; sell at 60%.
// ---------------------------------------------------------------------------
export function NetWorthSheet({
  open, onClose, state, style, busy, onSell, onEquip, onOpenCollection,
}: {
  open: boolean; onClose: () => void; state: CityState; style: StyleId; busy: Busy; onSell: (itemId: number) => Promise<boolean>;
  /** #15: owned clothes can be put on from their detail. */
  onEquip?: (itemId: number, on: boolean) => void;
  /** Postcards live in the Collection, not here (they don't count toward net worth). */
  onOpenCollection?: () => void;
}) {
  const [detail, setDetail] = useState<PlayerItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const total = netWorth(state);
  const starter = getStyle(style).starterItems;
  const close = () => { setDetail(null); setConfirming(false); };
  const item = detail ? itemBySku(detail.sku) : undefined;
  return (
    <>
      <Sheet open={open && !detail} onClose={onClose} label="Net Worth" tall>
        <div className="stack-16">
          <SheetTitle right={formatCash(total)}>Net Worth</SheetTitle>
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
                      <IconTile emoji={it?.emoji ?? "📦"} size={40} item={it} />
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <span className="title" style={{ display: "block" }}>{it?.name ?? i.sku}</span>
                        <span className="meta">{i.acquired === "earned" ? "Earned" : i.acquired === "collector" ? "✨ Collector" : "Bought"}{i.equipped ? " · Wearing" : ""}</span>
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
          {onOpenCollection && (
            <button className="list-row" onClick={onOpenCollection}>
              <IconTile emoji="💌" size={40} />
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>Postcard Collection</span>
                <span className="meta">Not part of net worth</span>
              </span>
              <span className="meta">›</span>
            </button>
          )}
        </div>
      </Sheet>
      <Sheet open={open && !!detail} onClose={close} label={item?.name ?? "Item"}>
        {detail && item && (
          <div className="stack-16">
            <IconTile emoji={item.emoji} item={item} />
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>
              {confirming ? `Sell your ${item.name.toLowerCase()} for ${formatCash(sellPrice(detail.value))}?` : item.name}
            </h2>
            {confirming ? (
              <>
                <p className="body" style={{ margin: 0 }}>
                  Net worth drops by {formatCash(detail.value - sellPrice(detail.value))}. The clout you earned stays; buying it back pays no clout.
                  {item.category === "houses" && " Rent starts again next month."}
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
                  {detail.acquired !== "collector" && (
                    <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Sells for (60%)</span><span className="body-strong">{formatCash(sellPrice(detail.value))}</span></div>
                  )}
                </div>
                {(() => {
                  const live = state.items.find((i) => i.id === detail.id);
                  if (!live || !onEquip || !item.wear) return null;
                  return (
                    <button className={`btn ${live.equipped ? "btn-secondary" : "btn-taxi"}`} disabled={busy !== null} onClick={() => onEquip(live.id, !live.equipped)}>
                      {live.equipped ? "Take it off" : "Wear it"}
                    </button>
                  );
                })()}
                {detail.acquired === "collector" ? (
                  <p className="meta" style={{ margin: 0 }}>✨ A collector piece, bought with real cash. It can&apos;t be sold for virtual cash.</p>
                ) : (
                  <button className="btn btn-destructive" onClick={() => setConfirming(true)}>Sell for {formatCash(sellPrice(detail.value))}</button>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Bills: what's due now and what's coming up, each with its amount and date (#22).
// ---------------------------------------------------------------------------
const billDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const BILL_LABEL: Record<Bill["kind"], string> = { rent: "🏠 Rent", phone: "📱 Phone", car_rental: "🚗 Car rental", car_insurance: "🛡️ Car insurance" };

export function BillsSheet({
  open, onClose, state, busy, onPay,
}: { open: boolean; onClose: () => void; state: CityState; busy: Busy; onPay: (billId: number) => void }) {
  const due = dueBills(state);
  const paid = state.bills.filter((b) => b.status !== "due").slice(0, 8);
  const { player, today } = state;
  const upcoming = upcomingBills(state);
  return (
    <Sheet open={open} onClose={onClose} label="Bills">
      <div className="stack-16">
        <SheetTitle right={due.length ? `${formatCash(due.reduce((a, b) => a + b.amount, 0))} due` : "All paid"}>Bills</SheetTitle>
        {due.length === 0 && (
          // #21: a real empty state: what's settled, and what's next.
          <div className="bills-empty" role="status">
            <span className="bills-empty-icon" aria-hidden="true">✅</span>
            <span className="title">All paid up</span>
            <span className="subtext">&ldquo;Nothing due. Savor it, babe; in New York this feeling lasts about a week.&rdquo; Lola</span>
            {upcoming[0] && (
              <span className="meta">Next: {BILL_LABEL[upcoming[0].kind]} · {formatCash(upcoming[0].amount)} on {billDate(upcoming[0].due_date)}</span>
            )}
          </div>
        )}
        {due.map((b) => {
          const late = daysBetween(b.due_date, today);
          const short = player.bank_cash < b.amount;
          return (
            <div key={b.id} className={`bill-card${late > CITY_ECONOMY.bills.graceDays && b.kind === "rent" ? " overdue" : late > 0 ? " late" : ""}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{BILL_LABEL[b.kind]}</span>
                <span className="meta">{formatCash(b.amount)} · {billDate(b.due_date)} · {billStatusLine(b, today)}</span>
              </div>
              <button className="btn btn-taxi btn-sm" disabled={short || busy !== null} onClick={() => onPay(b.id)}>
                {busy === `bill:${b.id}` ? "…" : `Pay ${formatCash(b.amount)}`}
              </button>
            </div>
          );
        })}
        {upcoming.length > 0 && (
          <div>
            <p className="overline" style={{ margin: "0 0 4px" }}>Coming up</p>
            {upcoming.map((b) => (
              <div key={b.kind} className="ledger-row bill-upcoming">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ display: "block", fontSize: 15 }}>{BILL_LABEL[b.kind]}</span>
                  <span className="meta">{billDate(b.due_date)} · {billStatusLine({ ...b, id: 0, status: "due", paid_at: null }, today)}</span>
                </span>
                <span className="body-strong tabular">{formatCash(b.amount)}</span>
                {/* Fills as the due date gets closer: how much of this bill's period has gone by. */}
                <span className="gig-progress bill-progress" role="progressbar" aria-label={`${BILL_LABEL[b.kind]}: how soon it's due`}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(billProgress(b, today) * 100)}>
                  <span style={{ width: `${Math.round(billProgress(b, today) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}
        {upcoming.length > 0 && (
          // v0.8 (#23): everything bills weekly, so one number says what a week of living costs.
          <div className="bills-week">
            <b>{formatCash(upcoming.reduce((a, b) => a + b.amount, 0))} a week</b>
            <span className="meta">{upcoming.map((b) => BILL_LABEL[b.kind].split(" ").slice(1).join(" ").toLowerCase()).join(", ")}. A side gig or two covers it.</span>
          </div>
        )}
        <p className="meta" style={{ margin: 0 }}>
          {player.house_sku ? "You own your home: no rent. " : ""}
          Miss rent and you get {CITY_ECONOMY.bills.graceDays} days of grace, then Mood drops daily; after {CITY_ECONOMY.bills.evictAfterDays} days you move to the cheapest studio.
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

/**
 * #19 Fif's Furniture: the Shop's Home tab. Pieces are shelved by room; the same piece in other colors
 * shares one card with swatches. Every piece can be tried at home before buying.
 */
function HomeShelf({ items, owned, cash, purchases, busy, section, onBuy, onTryAtHome }: {
  items: ShopItem[]; owned: Set<string>; cash: number; purchases: number; busy: boolean; section?: string;
  onBuy: (item: ShopItem) => void; onTryAtHome?: (item: ShopItem) => void;
}) {
  const start = FURNITURE_ROOMS.some((r) => r.id === section) ? (section as FurnitureRoom) : "living";
  const [room, setRoom] = useState<FurnitureRoom>(start);
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) { setLastSection(section); setRoom(start); }
  const [pick, setPick] = useState<Record<string, string>>({});
  const lines = new Map<string, ShopItem[]>();
  for (const i of items) {
    const f = i.furniture;
    if (f?.room === room) lines.set(f.line, [...(lines.get(f.line) ?? []), i]);
  }
  return (
    <div className="stack-12">
      <div className="chip-row" role="group" aria-label="Rooms">
        {FURNITURE_ROOMS.map((r) => (
          <button key={r.id} className="chip chip-sm" aria-pressed={room === r.id} onClick={() => setRoom(r.id)}>{r.label}</button>
        ))}
      </div>
      <div className="item-grid">
        {[...lines.entries()].map(([line, variants]) => {
          const item = variants.find((v) => v.sku === pick[line]) ?? variants.find((v) => !owned.has(v.sku)) ?? variants[0];
          const mine = owned.has(item.sku);
          return (
            <div key={line} className="item-card">
              <IconTile emoji={item.emoji} item={item} />
              <span className="title" style={{ display: "block" }}>{item.name}</span>
              <span className="subtext clamp-2">{item.blurb}</span>
              {variants.length > 1 && (
                <div className="swatches" role="radiogroup" aria-label="Colors">
                  {variants.map((v) => (
                    <button key={v.sku} role="radio" aria-checked={v.sku === item.sku} aria-label={v.sku.split("-").pop()}
                      className="swatch" style={{ background: v.furniture?.color }} onClick={() => setPick({ ...pick, [line]: v.sku })} />
                  ))}
                </div>
              )}
              <span className="meta">🔥 up to +{purchaseClout(item.clout, purchases)}</span>
              {mine ? <span className="owned-chip">Owned{variants.length > 1 ? " in this color" : ""}</span> : (
                <div className="buy-rent">
                  {onTryAtHome && <button className="btn btn-secondary btn-sm" onClick={() => onTryAtHome(item)}>Try it at home</button>}
                  <button className={`btn btn-taxi btn-sm${cash < item.price ? " short" : ""}`} disabled={busy} onClick={() => onBuy(item)}>{formatCash(item.price)}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="meta" style={{ margin: 0 }}>Bought pieces wait in storage at home: tap 🛋️ there to place them.</p>
    </div>
  );
}
