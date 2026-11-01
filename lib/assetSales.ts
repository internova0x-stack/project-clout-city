// The Player Economy, Phase 3 (owner, Oct 31; docs/PLAYER-ECONOMY.md section 6; migration 0153): selling a business or
// your house to a friend, through escrow and a 24-hour cooling-off. ASSET_SALES mirrors game_settings 'asset_sales'
// (checked by tests/assetSales.test.ts); the database appraises, checks and moves everything, so these functions only
// explain it (and run the preview). Safe to import anywhere.

import { businessById, payPerDay, upgradeCost } from "./businesses.ts";
import { CITY_ECONOMY, itemBySku } from "./city.ts";
import { PLAYER_ECONOMY, afterFee, economyError, priceBand, type GiftCandidate } from "./playerEconomy.ts";

export const ASSET_SALES = {
  /** Sales a player can be part of (seller or buyer) per 30 days, counted from the buyer's yes. */
  perMonth: 2,
  /** Days you must own an asset before you can sell it. */
  minOwnDays: 14,
  /** Real hours between the buyer's yes and the keys changing hands; either side can cancel. */
  coolingHours: 24,
  /** An unanswered offer lapses after this many days. */
  offerDays: 3,
  /** The Studio can reverse a finished sale for this long. */
  reverseDays: 7,
  /** Buyers younger than this are flagged for the Studio. */
  newBuyerDays: 14,
  /** A business: book value (price, +50% per upgrade, no hype), what was put in, and revenueDays of pay. */
  business: { book: 0.6, paid: 0.2, revenue: 0.2, revenueDays: 7 },
  /** A house: its Shop price and what the owner paid, times its neighborhood. */
  house: {
    list: 0.7, paid: 0.3,
    neighborhoods: { Astoria: 1, "Long Island City": 1.1 } as Record<string, number>,
    where: { "house-astoria-townhouse": "Astoria", "house-hunters-point-duplex": "Long Island City", "house-lic-penthouse": "Long Island City" } as Record<string, string>,
  },
} as const;

export type AssetKind = "business" | "house";
export type AssetBlock = "not_owned" | "went_public" | "real_money" | "too_soon" | "living_together" | "sublet_live" | "sale_live" | "sales_limit";

const U = CITY_ECONOMY.businesses.upgrade;

/** A business's appraisal (asset_appraisal). `acquired`: what the owner paid another player, and at which level. */
export function appraiseBusiness(id: string, level: number, acquired?: { price: number; level: number } | null): number {
  const b = businessById(id);
  if (!b) return 0;
  const up = upgradeCost(b);
  const book = Math.round(b.price * (1 + U.value * level));
  const paid = acquired ? acquired.price + Math.max(0, level - acquired.level) * up : b.price + level * up;
  const rev = payPerDay(b, level) * ASSET_SALES.business.revenueDays;
  const w = ASSET_SALES.business;
  return Math.round(w.book * book + w.paid * paid + w.revenue * rev);
}

/** A house's appraisal: 70% the Shop price, 30% what the owner paid, times the neighborhood. */
export function appraiseHouse(sku: string, paid?: number): number {
  const item = itemBySku(sku);
  const list = item?.price ?? paid ?? 0;
  const hood = ASSET_SALES.house.neighborhoods[ASSET_SALES.house.where[sku] ?? ""] ?? 1;
  return Math.round((ASSET_SALES.house.list * list + ASSET_SALES.house.paid * (paid ?? list)) * hood);
}

const money = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;

/** "You get C$6,300 after the 10% city fee." */
export function saleFeeLine(price: number): string {
  return `You get ${money(afterFee("asset", price))} after the ${Math.round(PLAYER_ECONOMY.fees.asset * 100)}% city fee.`;
}

/** The price band, and a few sensible prices inside it (the sale sheet's chips). */
export function priceChips(appraisal: number): number[] {
  const b = priceBand(appraisal);
  const round = (n: number) => (n >= 100_000 ? Math.round(n / 1000) * 1000 : n >= 10_000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);
  const out = [0.8, 1, 1.2].map((x) => Math.min(b.max, Math.max(b.min, round(appraisal * x))));
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// What the server sends
// ---------------------------------------------------------------------------
export interface AssetView {
  kind: AssetKind;
  id: string;
  label: string;
  emoji: string;
  level: number;
  appraisal: number;
  band: { min: number; max: number };
  feeRate: number;
  block: AssetBlock | null;
  sellableFrom: string;
}

export type SaleStatus = "offered" | "declined" | "expired" | "cooling" | "cancelled" | "failed" | "done" | "reversed";

export interface AssetSale {
  id: number;
  role: "seller" | "buyer";
  kind: AssetKind;
  asset: string;
  label: string;
  emoji: string;
  level: number;
  appraisal: number;
  price: number;
  fee: number;
  status: SaleStatus;
  reason: string | null;
  /** The asset carries traces: the buyer is warned of "undisclosed issues", never told what. */
  issues: boolean;
  offeredAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  coolingUntil: string | null;
  settledAt: string | null;
  closedByMe: boolean;
  with: { id: string; name: string; style: string } | null;
}

export interface AssetSalesState {
  /** The Studio's assets switch. Off with a live deal: the deal shows (it can be cancelled), nothing new starts. */
  on: boolean;
  now: string;
  assets: AssetView[];
  sales: AssetSale[];
  used: number;
  perMonth: number;
  room: { send: number; receive: number };
  unlock: string | null;
}

export type AssetResult<T> = { ok: true; data: T } | { ok: false; error: string; off?: boolean };

/** What the game calls: app/home/assetActions.ts on the server, lib/assetSalesSim.ts in the preview. */
export interface AssetApi {
  state(): Promise<AssetResult<AssetSalesState>>;
  buyers(): Promise<AssetResult<GiftCandidate[]>>;
  offer(kind: AssetKind, id: string, buyer: string, price: number): Promise<AssetResult<AssetSale>>;
  answer(id: number, accept: boolean): Promise<AssetResult<AssetSale>>;
  cancel(id: number): Promise<AssetResult<AssetSale>>;
}

/** Why an asset can't go on sale yet, in words (null: it can). */
export function blockLine(v: Pick<AssetView, "block" | "sellableFrom" | "kind">, now = Date.now()): string | null {
  switch (v.block) {
    case null: return null;
    case "not_owned": return "That's not yours to sell.";
    case "went_public": return "It's a public company now. The shareholders would like a word.";
    case "real_money": return "Bought with real money: it stays with you.";
    case "too_soon": {
      const d = Math.max(1, Math.ceil((Date.parse(v.sellableFrom) - now) / 86_400_000));
      return `You can sell it in ${d === 1 ? "a day" : `${d} days`}. The city frowns on flipping.`;
    }
    case "living_together": return "You live there with your partner. Selling the roof over both of you needs a different app.";
    case "sublet_live": return "Not while you're in a sublet. One real estate drama at a time.";
    case "sale_live": return "Already on offer.";
    case "sales_limit": return `That's ${ASSET_SALES.perMonth} sales this month. The city's paperwork department needs a nap.`;
  }
  return null;
}

/** "Keys change hands in 23 h" (or minutes near the end). */
export function coolingLine(until: string | null, now = Date.now()): string {
  if (!until) return "Keys change hands soon";
  const ms = Date.parse(until) - now;
  if (ms <= 60_000) return "Keys change hands any minute";
  if (ms < 3_600_000) return `Keys change hands in ${Math.ceil(ms / 60_000)} min`;
  return `Keys change hands in ${Math.ceil(ms / 3_600_000)} h`;
}

/** A finished deal's one-line result. */
export function saleResultLine(s: AssetSale): string {
  const who = s.with ? `@${s.with.name}` : "a former player";
  const net = money(s.price - s.fee);
  switch (s.status) {
    case "done": return s.role === "seller" ? `Sold to ${who}. ${net} landed after the city's cut.` : `Bought from ${who}. The keys are yours.`;
    case "declined": return s.role === "seller" ? `${who} passed. Their loss, probably.` : "You passed.";
    case "expired": return "The offer lapsed. Nobody answered, which is also an answer.";
    case "cancelled": return s.closedByMe ? "You called it off. Nothing changed hands." : `${who} called it off. Nothing changed hands.`;
    case "failed": return "It fell through before the handover. Everyone got their stuff back.";
    case "reversed": return "The city reversed this sale. Everything went back where it came from.";
    default: return "";
  }
}

/** Player-facing words for the server's refusals; the core's (phase, unlock, caps) come from economyError. */
export function assetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("phase_off")) return "Business and property sales open soon. The city's notary is still learning to stamp.";
  if (m.includes("out_of_band")) return "That price is outside what the city allows for this one (50% to 150% of its appraisal).";
  if (m.includes("too_soon")) return `You need to own it ${ASSET_SALES.minOwnDays} days before you sell it.`;
  if (m.includes("went_public")) return blockLine({ block: "went_public", sellableFrom: "", kind: "business" })!;
  if (m.includes("real_money")) return blockLine({ block: "real_money", sellableFrom: "", kind: "house" })!;
  if (m.includes("living_together")) return blockLine({ block: "living_together", sellableFrom: "", kind: "house" })!;
  if (m.includes("sublet_live")) return blockLine({ block: "sublet_live", sellableFrom: "", kind: "house" })!;
  if (m.includes("sale_live")) return "It's already on offer. One buyer at a time.";
  if (m.includes("seller_limit")) return "They've hit their sales for the month. Try again later.";
  if (m.includes("sales_limit")) return blockLine({ block: "sales_limit", sellableFrom: "", kind: "business" })!;
  if (m.includes("buy_limit")) return `That's ${ASSET_SALES.perMonth} deals for you this month. Your accountant says breathe.`;
  if (m.includes("they_cant_buy")) return "They can't buy yet: new accounts and Rank 1 have to wait.";
  if (m.includes("seller_cant_sell")) return "The seller can't sell right now. The deal is on hold.";
  if (m.includes("you_own_it")) return "You already own one of those.";
  if (m.includes("they_own_it")) return "They already own one. Or a house, which is plenty.";
  if (m.includes("you_cant_move")) return "Not while you live with your partner or in a sublet.";
  if (m.includes("they_cant_move")) return "They live with a partner or in a sublet right now, so they can't take a house.";
  if (m.includes("business_locked")) return "Empires go in order: they need every business before this one first.";
  if (m.includes("sale_changed")) return "It changed since the offer (an upgrade, maybe). Ask for a new one.";
  if (m.includes("sale_gone")) return "That deal isn't on the table anymore.";
  if (m.includes("own_sale")) return "Selling to yourself is called accounting.";
  if (m.includes("not_owned")) return "That's not yours to sell.";
  if (m.includes("unknown_player")) return "They're not around anymore.";
  return economyError(message);
}

// ---------------------------------------------------------------------------
// Studio: Economy → Asset sales (admin_asset_sales)
// ---------------------------------------------------------------------------
export interface AssetAdminSale {
  id: number; kind: AssetKind; asset: string; label: string; emoji: string; level: number;
  appraisal: number; price: number; fee: number; status: SaleStatus; reason: string | null; traces: boolean;
  offeredAt: string; acceptedAt: string | null; coolingUntil: string | null; settledAt: string | null;
  reversedAt: string | null; reverseReason: string | null; canReverse: boolean;
  seller: { id: string; name: string; joined: string } | null;
  buyer: { id: string; name: string; joined: string } | null;
  flags: string[];
}
export interface AssetAdmin { reverseDays: number; sales: AssetAdminSale[] }
