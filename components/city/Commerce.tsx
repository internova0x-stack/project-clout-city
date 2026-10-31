"use client";

import { wearSlot } from "@/lib/wearing";
import { LOOK_LABEL, STYLE } from "@/lib/style";
import { useEffect, useState } from "react";
import { CITY_ECONOMY, FURNITURE_ROOMS, SHOP_CATEGORIES, SHOP_ITEMS, itemBySku, shopBase, purchaseClout, sellPrice, type FurnitureRoom, type ShopCategory, type ShopItem } from "@/lib/city";
import { billCountdown, billStatusLine, daysBetween, dueBills, upcomingBills, netWorth, ownedSkus, type Bill, type CityState, type PlayerItem, type UpcomingBill } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";
import { IconTile, SheetTitle, Stars, useGameNow } from "./Common";
import { storyItemOpen, type StoryFeed } from "@/lib/storyFeed";
import { editionLine, formatPrice, serialLabel, type StoreProduct } from "@/lib/store";
import { JET_SKU, PLAZA_SKU, YACHT_SKU, weekLabel, type CoutureApi, type PlazaWeeks } from "@/lib/coutureMap";
import { CROWN_SKU, CROWN_STYLES, SUIT_CLOTHS, SUIT_LININGS, cleanMonogram, hasOptions, optionsLine, type ItemOptions } from "@/lib/couture";
import { STYLE_LINES, STYLE_LINE_LABEL, catalogShopItems, newArrivals, shippedPictures, shopOrder, type CatalogItem, type ShopCardItem } from "@/lib/shopCatalog";
import { ShopArt } from "./ShopCard";
import { COUPLE_ITEMS } from "@/lib/couples";
import { isGiftable } from "@/lib/playerEconomy";

const COUTURE = "Clout Couture";

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
  open, onClose, state, busy, onBuy, onEquip, story = null, realMoney, initialCategory = "fashion", onTryOn, section, onTryAtHome, fit, catalog, onGift,
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
  /** The player's presentation ("m" or "f"): pieces cut for the other one are hidden unless owned. */
  fit?: "m" | "f";
  /** The Shop Manager (migration 0099): what's on sale, with pictures. Without it (before 0099) the Shop is the code's list. */
  catalog?: CatalogItem[];
  /** The Player Economy (migration 0151): buy a C$ piece for a friend. Hidden without it. */
  onGift?: (item: ShopCardItem) => void;
}) {
  const [cat, setCat] = useState<ShopCategory | "couture">(initialCategory);
  const [lastInitial, setLastInitial] = useState(initialCategory);
  const [line, setLine] = useState<string>("all");
  if (initialCategory !== lastInitial) {
    setLastInitial(initialCategory);
    setCat(initialCategory);
  }
  const [confirm, setConfirm] = useState<{ item: ShopCardItem; mode: "buy" | "rent" } | null>(null);
  const owned = ownedSkus(state);
  const { player } = state;
  // Owned clothes get a Wear button instead of a bare "Owned" (#15).
  const wearControl = (sku: string) => {
    const mine = state.items.find((i) => i.sku === sku && i.category === "fashion");
    if (!mine || !onEquip || !wearSlot(sku)) return null;
    // The card's Owned pill says it's yours, so "Wear" never reads as the price (owner, Oct 22).
    return (
      <button className={`btn btn-sm ${mine.equipped ? "btn-secondary" : "btn-taxi"}`} style={{ whiteSpace: "nowrap" }} disabled={busy !== null} onClick={() => onEquip(mine.id, !mine.equipped)}>
        {mine.equipped ? "Wearing ✓" : "Wear"}
      </button>
    );
  };
  const source: ShopCardItem[] = catalog
    ? catalogShopItems(catalog, shopBase)
    : SHOP_ITEMS.map((i) => ({ ...i, image: shippedPictures(i.sku)?.card ?? null, detailImage: shippedPictures(i.sku)?.detail ?? null, wearableNow: true, styleLines: [], collection: null, priceUsdCents: null, presentation: i.fits ?? "all", retired: false, editionSize: null }));
  // Story-only items (e.g. the "Forever Our Bird" hoodie) show only while a story has them on sale.
  // Collector pieces show only when they're in the store catalog (migration 0008+ and Stripe set up), or, still being
  // built (Clout Couture), locked with their price.
  const shows = (i: ShopCardItem) => (!i.retired || owned.has(i.sku))
    // Clothing shows when it can be worn, or locked until its template exists (owner, Oct 21). Catalog clothes carry
    // their wear in lib/catalogWear.ts and lib/accessories.ts, not on the code's ShopItem (wearSlot knows both).
    && (i.category !== "fashion" || !!i.wear || !!wearSlot(i.sku) || !i.wearableNow)
    && (!i.storyOnly || storyItemOpen(story, i.sku).open || owned.has(i.sku))
    && (!i.collector || !!realMoney?.product(i.sku) || owned.has(i.sku) || !i.wearableNow)
    // Daily tasks 2.0 (migration 0073): streak rewards are never on sale; they show once a streak has earned them.
    && (!i.reward || owned.has(i.sku))
    && (!i.fits || !fit || i.fits === fit || owned.has(i.sku));
  // Clout Couture is its own tab (owner, Oct 22), so its pieces stay out of the other tabs.
  const inTab = source.filter((i) => (cat === "couture" ? i.collection === COUTURE : i.category === cat && i.collection !== COUTURE) && shows(i));
  // Clout Couture (owner, Oct 21): a row at the top of Luxury with every piece, and at the top of a piece's own tab.
  const lines = cat === "fashion" ? STYLE_LINES.filter((l) => inTab.some((i) => i.styleLines.includes(l))) : [];
  // Cheapest first, real-money pieces after the C$ ones (owner, Oct 22), with what's new in a row on top.
  const items = shopOrder(inTab.filter((i) => line === "all" || !lines.length || i.styleLines.includes(line)));
  const fresh = newArrivals(items.filter((i) => !owned.has(i.sku) && !i.retired), Date.now());
  // 🎁 on C$ pieces that can be gifted (never real money, rewards, story pieces, cars or houses: lib/playerEconomy.ts).
  const giftButton = (item: ShopCardItem) => onGift && item.wearableNow && !item.retired && isGiftable(item) ? (
    <button className="btn btn-secondary btn-sm" aria-label={`Gift the ${item.name.toLowerCase()}`} disabled={busy !== null} onClick={() => onGift(item)}>🎁 Gift</button>
  ) : null;
  // A piece in the New row isn't listed again below it (owner, Oct 22: no duplicates in the listing).
  const rest = items.filter((i) => !fresh.includes(i));
  const card = (item: ShopCardItem) => {
    const isOwned = owned.has(item.sku) || (item.category === "cars" && player.car_sku === item.sku);
    const soon = !item.wearableNow;
    if (item.collector) {
      const p = realMoney?.product(item.sku);
      return (
        <div key={item.sku} className="item-card collector">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <ShopArt image={item.image} emoji={item.emoji} item={item} size={item.image ? 72 : 52} />
            <span className="stack-4" style={{ alignItems: "flex-end" }}>
              <span className="tag tag-gold">✨ Real cash</span>
              {(isOwned || p?.owned) && <OwnedPill />}
            </span>
          </div>
          <span className="title" style={{ display: "block" }}>{item.name}</span>
          <span className="subtext clamp-2">{item.blurb}</span>
          <Stars rating={item.rating} />
          {(isOwned || p?.owned) && p?.serial ? <span className="meta">✨ Yours: {serialLabel(p.serial)}</span>
            : p?.edition ? <span className={`meta${p.edition.soldOut ? " locked" : ""}`}>Numbered · {editionLine(p.edition)}</span>
            : item.editionSize ? <span className="meta">Numbered · {item.editionSize} per drop</span> : null}
          <span className="meta">🔥 up to +{purchaseClout(item.clout, player.purchases_count)}{p ? ` · worth ${formatCash(p.value ?? 0)}` : ""}</span>
          {isOwned || p?.owned ? (
            wearControl(item.sku)
          ) : p?.edition?.soldOut && !p.pending ? (
            <button className="btn btn-secondary btn-sm" disabled>Sold out</button>
          ) : soon ? (
            <>
              <span className="meta locked">🔒 Coming soon</span>
              <button className="btn btn-taxi btn-sm" disabled>{item.priceUsdCents ? formatPrice(item.priceUsdCents, "usd") : "Soon"}</button>
            </>
          ) : p?.pending || realMoney?.busy === `buy:${item.sku}` ? (
            <button className="btn btn-taxi btn-sm" disabled>{p?.pending ? "Unlocking…" : "Opening…"}</button>
          ) : (
            <button className="btn btn-taxi btn-sm" disabled={!p || busy !== null} onClick={() => realMoney?.buy(item.sku)}>
              {p ? formatPrice(p.priceCents, p.currency) : "Unavailable"}
            </button>
          )}
        </div>
      );
    }
    const short = player.bank_cash < item.price;
    // Fantasy outfits wait for clout (#9): try them on any time, buy once you're big enough.
    const locked = (item.cloutReq ?? 0) > player.clout;
    return (
      <div key={item.sku} className="item-card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <ShopArt image={item.image} emoji={item.emoji} item={item} size={item.image ? 72 : 52} />
          {isOwned ? <OwnedPill /> : item.storyOnly ? <span className="tag tag-event">Limited</span> : COUPLE_ITEMS.has(item.sku) ? <span className="tag tag-event">💞 Couples</span> : <span className="meta">{item.neighborhood ?? ""}</span>}
        </div>
        <span className="title" style={{ display: "block" }}>{item.name}</span>
        <span className="subtext clamp-2">{item.blurb}</span>
        <Stars rating={item.rating} />
        {!isOwned && <LookHint item={item} counts={state.style?.counts} />}
        {item.cloutReq ? (
          <span className={`meta${locked ? " locked" : ""}`}>{locked ? "🔒" : "🔓"} {item.cloutReq.toLocaleString("en-US")} clout{locked ? ` · you have ${player.clout.toLocaleString("en-US")}` : ""}</span>
        ) : (
          <span className="meta">🔥 up to +{purchaseClout(item.clout, player.purchases_count)}</span>
        )}
        {isOwned ? (
          <>
            {wearControl(item.sku) ?? (player.car_sku === item.sku && player.car_mode === "rented" ? <span className="owned-chip">Renting</span> : null)}
            {giftButton(item)}
          </>
        ) : soon ? (
          <>
            <span className="meta locked">🔒 Coming soon to your wardrobe</span>
            <button className="btn btn-secondary btn-sm" disabled>{formatCash(item.price)}</button>
          </>
        ) : (
          <div className="buy-rent">
            {onTryOn && (item.wear || wearSlot(item.sku)) && (
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
            {!locked && giftButton(item)}
          </div>
        )}
      </div>
    );
  };
  const hasCouture = source.some((i) => i.collection === COUTURE && shows(i));
  const tabs: { id: ShopCategory | "couture"; label: string; emoji: string }[] = [
    ...SHOP_CATEGORIES.filter((c) => c.id !== "accessories" || source.some((i) => i.category === "accessories" && i.collection !== COUTURE && shows(i))),
    // Couture is the last tab (owner, Oct 22).
    ...(hasCouture ? [{ id: "couture" as const, label: "Couture", emoji: "✨" }] : []),
  ];
  return (
    <>
      <Sheet open={open && !confirm} onClose={onClose} label="Shop" tall>
        <div className="stack-16">
          <SheetTitle right={formatCash(player.bank_cash)}>Shop</SheetTitle>
          <div className="chip-row" role="group" aria-label="Categories">
            {tabs.map((c) => (
              <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setLine("all"); }}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
          {lines.length > 0 && (
            <div className="chip-row" role="group" aria-label="Style lines">
              <button className="chip chip-sm" aria-pressed={line === "all"} onClick={() => setLine("all")}>All</button>
              {lines.map((l) => <button key={l} className="chip chip-sm" aria-pressed={line === l} onClick={() => setLine(l)}>{STYLE_LINE_LABEL[l]}</button>)}
            </div>
          )}
          {cat === "couture" && <p className="subtext" style={{ margin: 0 }}>Clout Couture: numbered pieces, paid in real cash. Once a drop sells out, it's gone.</p>}
          {cat === "houses" && <p className="subtext" style={{ margin: 0 }}>Own a house and rent stops. Sell it and rent starts again.</p>}
          {fresh.length > 0 && (
            <section className="stack-8">
              <span className="overline">✨ New in the Shop</span>
              <div className="shop-new-row">{fresh.map(card)}</div>
            </section>
          )}
          {cat === "home" && (
            <HomeShelf
              items={rest}
              owned={owned}
              cash={player.bank_cash}
              purchases={player.purchases_count}
              busy={busy !== null}
              section={section}
              onBuy={(item) => setConfirm({ item, mode: "buy" })}
              onTryAtHome={onTryAtHome}
              giftButton={giftButton}
            />
          )}
          {cat === "cars" && <p className="subtext" style={{ margin: 0 }}>Owned cars cost {CITY_ECONOMY.bills.carInsuranceRate * 100}% of their price a week in insurance. Rentals bill weekly too.</p>}
          {cat !== "home" && <div className="item-grid">{rest.map(card)}</div>}
        </div>
      </Sheet>
      <Sheet open={open && !!confirm} onClose={() => setConfirm(null)} label="Confirm purchase">
        {confirm && (() => {
          const price = confirm.mode === "rent" ? confirm.item.rentPerWeek! : confirm.item.price;
          const after = player.bank_cash - price;
          return (
            <div className="stack-16">
              <ShopArt image={confirm.item.image} emoji={confirm.item.emoji} item={confirm.item} size={confirm.item.image ? 96 : 52} />
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
  open, onClose, state, style, busy, onSell, onEquip, onOpenCollection, serial, onOptions, couture,
}: {
  open: boolean; onClose: () => void; state: CityState; style: StyleId; busy: Busy; onSell: (itemId: number) => Promise<boolean>;
  /** #15: owned clothes can be put on from their detail. */
  onEquip?: (itemId: number, on: boolean) => void;
  /** Postcards live in the Collection, not here (they don't count toward net worth). */
  onOpenCollection?: () => void;
  /** Clout Couture (migration 0102): a numbered piece's edition number. */
  serial?: (sku: string) => number | null | undefined;
  /** Clout Couture (migration 0103): saves a piece's choices (crown or tiara; the suit's cloth, lining, monogram). */
  onOptions?: (itemId: number, options: ItemOptions) => Promise<boolean>;
  /** Clout Couture on the map (migration 0104): the plaza statue's booking. */
  couture?: CoutureApi;
}) {
  const [detail, setDetail] = useState<PlayerItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const total = netWorth(state);
  const starter = getStyle(style).starterItems;
  const close = () => { setDetail(null); setConfirming(false); };
  // Pieces sold from the Shop catalog (the batch files, Clout Couture) have their words and pictures there.
  const listed = state.catalog ? catalogShopItems(state.catalog, shopBase) : [];
  const info = (sku: string): (ShopItem & { image?: string | null }) | undefined => listed.find((c) => c.sku === sku) ?? itemBySku(sku);
  const item = detail ? info(detail.sku) : undefined;
  return (
    <>
      <Sheet open={open && !detail} onClose={onClose} label="Net Worth" tall>
        <div className="stack-16">
          <SheetTitle>Net Worth</SheetTitle>
          <div className="balance-hero">
            <span className="overline">Cash and everything you own</span>
            <span className="balance-big">{formatCash(total)}</span>
          </div>
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
                  const it = info(i.sku);
                  return (
                    <button key={i.id} className="list-row" onClick={() => setDetail(i)}>
                      <ShopArt image={it?.image} emoji={it?.emoji ?? "📦"} size={40} item={it} />
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <span className="title" style={{ display: "block" }}>{it?.name ?? i.sku}</span>
                        <span className="meta">{i.acquired === "earned" ? "Earned" : i.acquired === "collector" ? `✨ Collector${serial?.(i.sku) ? ` · ${serialLabel(serial(i.sku)!)}` : ""}` : "Bought"}{i.equipped ? " · Wearing" : ""}{optionsLine(i.sku, i.options) ? ` · ${optionsLine(i.sku, i.options)}` : ""}</span>
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
            <ShopArt image={item.image} emoji={item.emoji} item={item} />
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
                  if (!live || !onEquip || live.category !== "fashion" || !wearSlot(live.sku)) return null;
                  return (
                    <button className={`btn ${live.equipped ? "btn-secondary" : "btn-taxi"}`} disabled={busy !== null} onClick={() => onEquip(live.id, !live.equipped)}>
                      {live.equipped ? "Take it off" : "Wear it"}
                    </button>
                  );
                })()}
                {detail.sku === YACHT_SKU && <p className="meta" style={{ margin: 0 }}>🛥️ Moored off the Astoria waterfront with your name on the hull. Tap it on the map to open your card.</p>}
                {detail.sku === JET_SKU && <p className="meta" style={{ margin: 0 }}>✈️ Flies over Queens whenever you're in the game, trailing a banner with your name.</p>}
                {detail.sku === PLAZA_SKU && couture && <PlazaBooking key={detail.id} api={couture} />}
                {onOptions && hasOptions(detail.sku) && (
                  <ItemOptionsEditor key={detail.id} sku={detail.sku} saved={state.items.find((i) => i.id === detail.id)?.options}
                    busy={busy !== null} onSave={(o) => onOptions(detail.id, o)} />
                )}
                {detail.acquired === "collector" ? (
                  <p className="meta" style={{ margin: 0 }}>
                    ✨ A collector piece, bought with real cash{serial?.(detail.sku) ? `: ${serialLabel(serial(detail.sku)!)}` : ""}. It can&apos;t be sold for virtual cash.
                  </p>
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

/** Clout Couture (migration 0104): the Plaza Statue's week in front of the Unisphere, then it comes home. */
function PlazaBooking({ api }: { api: CoutureApi }) {
  const [state, setState] = useState<PlazaWeeks | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.weeks().then((r) => (r.ok ? setState(r.data) : setNote(r.error))); }, [api]);
  if (!state) return note ? <p className="meta" style={{ margin: 0 }}>{note}</p> : null;
  if (state.mine) {
    return (
      <div className="card stack-8">
        <span className="title" style={{ display: "block" }}>🗽 Your week: {weekLabel(state.mine)}</span>
        <span className="meta" style={{ display: "block" }}>Your statue stands in front of the Unisphere, with a plaque, all week. After that it moves into your home.</span>
      </div>
    );
  }
  return (
    <div className="card stack-12">
      <span className="title" style={{ display: "block" }}>🗽 Book your week at the Unisphere</span>
      <span className="meta" style={{ display: "block" }}>One statue a week. It's cast in the look you're wearing when you book, then comes home when the week is over.</span>
      <div className="chip-row" role="group" aria-label="Weeks">
        {state.weeks.map((w) => (
          <button key={w.week} className="chip" aria-pressed={pick === w.week} disabled={w.taken} onClick={() => setPick(w.week)}>
            {w.taken ? `${weekLabel(w.week)} · taken` : weekLabel(w.week)}
          </button>
        ))}
      </div>
      <button className="btn btn-taxi" disabled={!pick || busy || !state.canBook} onClick={async () => {
        setBusy(true); setNote(null);
        const r = await api.book(pick!);
        setBusy(false);
        if (r.ok) setState(r.data); else setNote(r.error);
      }}>{busy ? "…" : pick ? `Book the week of ${weekLabel(pick)}` : "Pick a week"}</button>
      {note && <span className="meta">{note}</span>}
    </div>
  );
}

/** Clout Couture (migration 0103): make a piece yours. The Clout Crown as a crown or a tiara; the suit's cloth, lining and
 *  up to three monogram initials (the server runs the chat word filter). Saving changes the avatar at once. */
function ItemOptionsEditor({ sku, saved, busy, onSave }: { sku: string; saved?: ItemOptions; busy: boolean; onSave: (o: ItemOptions) => Promise<boolean> }) {
  const [o, setO] = useState<ItemOptions>(saved ?? {});
  const [note, setNote] = useState<string | null>(null);
  const crown = sku === CROWN_SKU;
  const mono = cleanMonogram(o.monogram ?? "");
  const same = JSON.stringify(saved ?? {}) === JSON.stringify(o);
  const swatches = (label: string, list: { hex: string; label: string }[], key: "cloth" | "lining") => (
    <div className="stack-8">
      <span className="overline">{label}: {list.find((c) => c.hex === (o[key] ?? list[0].hex))?.label}</span>
      <div className="swatches" role="group" aria-label={label}>
        {list.map((c) => (
          <button key={c.hex} aria-pressed={(o[key] ?? list[0].hex) === c.hex} aria-label={c.label} className="swatch" style={{ background: c.hex }}
            onClick={() => setO({ ...o, [key]: c.hex })} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="card stack-12">
      <span className="title">Make it yours</span>
      {crown ? (
        <div className="segmented" role="group" aria-label="Wear it as">
          {CROWN_STYLES.map((c) => (
            <button key={c.id} aria-pressed={(o.style ?? "crown") === c.id} onClick={() => setO({ ...o, style: c.id })}>{c.label}</button>
          ))}
        </div>
      ) : (
        <>
          {swatches("Cloth", SUIT_CLOTHS, "cloth")}
          {swatches("Lining", SUIT_LININGS, "lining")}
          <div className="stack-8">
            <span className="overline">Monogram (up to 3 letters)</span>
            <label className="field">
              <input value={o.monogram ?? ""} maxLength={3} autoCapitalize="characters" placeholder="ABC" aria-label="Monogram"
                onChange={(e) => setO({ ...o, monogram: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
            </label>
          </div>
        </>
      )}
      <button className="btn btn-secondary" disabled={busy || same || mono === null}
        onClick={async () => { setNote(null); setNote((await onSave({ ...o, ...(crown ? {} : { monogram: mono ?? "" }) })) ? "Saved." : null); }}>
        {busy ? "…" : "Save"}
      </button>
      {note && <span className="meta">{note}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bills: what's due now and what's coming up, each with its amount and date (#22).
// ---------------------------------------------------------------------------
const billDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const BILL_LABEL: Record<Bill["kind"], string> = { rent: "🏠 Rent", phone: "📱 Phone", car_rental: "🚗 Car rental", car_insurance: "🛡️ Car insurance" };

/** Counts down to the deadline: full a week out, empty when it's due; amber under 3 days, red under 1. */
function BillBar({ bill, now }: { bill: UpcomingBill; now: number }) {
  const c = billCountdown(bill, now);
  return (
    <span className="bill-bar-row">
      <span className={`gig-progress bill-progress ${c.urgency}`} role="progressbar" aria-label={`${BILL_LABEL[bill.kind]}: time left before it's due`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.left * 100)} aria-valuetext={c.label}>
        <span style={{ width: `${Math.max(c.msLeft > 0 ? 2 : 0, Math.round(c.left * 100))}%` }} />
      </span>
      <span className={`bill-countdown ${c.urgency}`}>{c.label}</span>
    </span>
  );
}

export function BillsSheet({
  open, onClose, state, busy, onPay,
}: { open: boolean; onClose: () => void; state: CityState; busy: Busy; onPay: (billId: number) => void }) {
  const due = dueBills(state);
  const paid = state.bills.filter((b) => b.status !== "due").slice(0, 8);
  const { player, today } = state;
  const upcoming = upcomingBills(state);
  const now = useGameNow(state.clockOffsetSeconds, 30_000);
  const next = upcoming[0] ? billCountdown(upcoming[0], now) : null;
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
            {upcoming[0] && next && (
              <span className="bills-next">
                <span className="meta">Next: {BILL_LABEL[upcoming[0].kind]} · {formatCash(upcoming[0].amount)} on {billDate(upcoming[0].due_date)}</span>
                <span className={`bill-countdown ${next.urgency}`}>{next.label}</span>
              </span>
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
                  <span className="meta">Due {billDate(b.due_date)}</span>
                </span>
                <span className="body-strong tabular">{formatCash(b.amount)}</span>
                <BillBar bill={b} now={now} />
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
/** Bought pieces carry this pill on their card (owner, Oct 22). */
const OwnedPill = () => <span className="tag tag-positive owned-pill">✓ Owned</span>;

function HomeShelf({ items, owned, cash, purchases, busy, section, onBuy, onTryAtHome, giftButton }: {
  items: ShopCardItem[]; owned: Set<string>; cash: number; purchases: number; busy: boolean; section?: string;
  onBuy: (item: ShopCardItem) => void; onTryAtHome?: (item: ShopItem) => void;
  /** Migration 0151: 🎁 Gift for giftable pieces. */
  giftButton?: (item: ShopCardItem) => React.ReactNode;
}) {
  const start = FURNITURE_ROOMS.some((r) => r.id === section) ? (section as FurnitureRoom) : "living";
  const [room, setRoom] = useState<FurnitureRoom>(start);
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) { setLastSection(section); setRoom(start); }
  const [pick, setPick] = useState<Record<string, string>>({});
  const lines = new Map<string, ShopCardItem[]>();
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
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <ShopArt image={item.image} emoji={item.emoji} item={item} size={item.image ? 72 : 52} />
                {mine && <OwnedPill />}
              </div>
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
              {mine ? (
                <>
                  {variants.length > 1 && <span className="meta">You have this color</span>}
                  {giftButton?.(item)}
                </>
              ) : (
                <div className="buy-rent">
                  {onTryAtHome && <button className="btn btn-secondary btn-sm" onClick={() => onTryAtHome(item)}>Try it at home</button>}
                  <button className={`btn btn-taxi btn-sm${cash < item.price ? " short" : ""}`} disabled={busy} onClick={() => onBuy(item)}>{formatCash(item.price)}</button>
                  {giftButton?.(item)}
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

/**
 * "Complete your look" (migration 0100): what a fashion piece would do for a style line the player already wears.
 * Any piece counts the same toward a look, whatever it costs.
 */
function LookHint({ item, counts }: { item: ShopCardItem; counts?: Record<string, number> }) {
  if (!counts || item.category !== "fashion") return null;
  const lines = item.styleLines.length ? item.styleLines : ((STYLE.liveLines as Record<string, readonly string[]>)[item.sku] ?? []);
  // The line closest to a full look first; then one already full ("Matches your Streetwear look").
  const worn = lines.map((l) => ({ l, have: counts[l] ?? 0 })).filter((x) => x.have > 0);
  const best = worn.filter((x) => x.have < STYLE.fullMin).sort((a, b) => b.have - a.have)[0] ?? worn[0];
  if (!best) return null;
  const name = LOOK_LABEL[best.l] ?? best.l;
  const line = best.have >= STYLE.fullMin ? `Matches your ${name} look` : best.have + 1 >= STYLE.fullMin ? `Completes your ${name} look` : `${name} look: you wear ${best.have} of ${STYLE.fullMin}`;
  return <span className="meta">✨ {line}</span>;
}
