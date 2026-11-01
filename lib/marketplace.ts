// The Player Economy, Phase 2 (owner, Oct 31; docs/PLAYER-ECONOMY.md section 5; migration 0152): the item marketplace
// (listings and swaps in the trade window) and underworld jobs between players. MARKETPLACE mirrors game_settings
// 'marketplace' (checked by tests/marketplace.test.ts). The database enforces every rule and the Studio switches the phase
// (player_economy phases.marketplace); the game reads the live state from market_state() and uses these numbers only to
// explain them. Safe to import anywhere.

import { PLAYER_ECONOMY, economyError, economyFee, priceBand } from "./playerEconomy.ts";

export const MARKETPLACE = {
  /** A player has at most maxOpen listings up at once; each lasts days. */
  listing: { maxOpen: 8, days: 14 },
  /** How many of one sku a player may get on the market a New York week (bought or swapped for). */
  perSkuWeek: 2,
  /** The trade window: up to maxItems a side; C$ only tops a side up (at most cashMaxShare of its total); hours to close. */
  swap: { maxItems: 4, hours: 24, cashMaxShare: 0.5 },
  /** A sale or swap worth more than this needs a second "Are you sure?". */
  bigTrade: 2500,
  /** After a sign-in from a new device or an email change, no listing, buying, swapping or hiring for this long. */
  hold: { hours: 72 },
  /** A Studio admin can reverse a sale or swap this long after it happened. */
  reversalDays: 7,
  /** Underworld jobs between players: the cuts a poster can offer, one a day, 24 hours to take it, Heat for both. */
  hire: { cuts: [100, 250, 500, 1000], perDay: 1, hours: 24, posterHeat: 5, runnerHeat: 3 },
} as const;

const money = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;

/** The sale fee and what the seller keeps. */
export const saleFee = (price: number) => economyFee("sale", price);
export const sellerGets = (price: number) => price - saleFee(price);

/** The most C$ a side with this much in items can add (cashMaxShare of the side's total). */
export const cashMax = (itemsValue: number) =>
  Math.floor((Math.max(0, itemsValue) * MARKETPLACE.swap.cashMaxShare) / (1 - MARKETPLACE.swap.cashMaxShare));

/** Does a swap balance (market_trade_contents): each side's total inside the other's band, C$ only a top-up. */
export function swapCheck(a: { items: number; value: number; cash: number }, b: { items: number; value: number; cash: number }):
  { ok: true } | { ok: false; reason: "no_items" | "too_many_items" | "too_much_cash" | "unbalanced" } {
  if (a.items < 1 || b.items < 1) return { ok: false, reason: "no_items" };
  if (a.items > MARKETPLACE.swap.maxItems || b.items > MARKETPLACE.swap.maxItems) return { ok: false, reason: "too_many_items" };
  if (a.cash > cashMax(a.value) || b.cash > cashMax(b.value)) return { ok: false, reason: "too_much_cash" };
  const ta = a.value + a.cash;
  const tb = b.value + b.cash;
  const ba = priceBand(ta);
  const bb = priceBand(tb);
  if (tb < ba.min || tb > ba.max || ta < bb.min || ta > bb.max) return { ok: false, reason: "unbalanced" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// What the server sends (market_state)
// ---------------------------------------------------------------------------
export interface MarketListing {
  id: number; sku: string; name: string; emoji: string | null; category: string; price: number; reference: number;
  createdAt: string; expiresAt: string;
  seller: string; sellerName: string; sellerStyle: string;
  /** Crew, partner or a chat (otherwise the open board). */
  friend: boolean;
  /** You own one already (you can't buy a second). */
  owned: boolean;
  /** How many more of this sku you can get on the market this week. */
  skuLeft: number;
}
export interface MyListing {
  id: number; itemId: number | null; sku: string; name: string; emoji: string | null; price: number; reference: number; fee: number;
  status: "open" | "sold" | "cancelled" | "expired" | "reversed"; createdAt: string; expiresAt: string; soldAt: string | null; buyerName: string | null;
}
export interface TradeItem { id: number; sku: string; name: string; emoji: string | null; category: string; reference: number; side: "a" | "b" }
export interface TradeSide { items: TradeItem[]; cash: number; value: number; ok: boolean }
export interface MarketTrade {
  id: number; version: number; status: "open" | "done" | "declined" | "cancelled" | "expired" | "reversed";
  /** Which side you are: a sent it, b received it. */
  mine: "a" | "b";
  createdAt: string; updatedAt: string; expiresAt: string; settledAt: string | null;
  with: string | null; withName: string; withStyle: string | null;
  you: TradeSide; them: TradeSide;
  /** Over bigTrade: the second confirmation. */
  big: boolean;
}
export interface MyThing {
  id: number; sku: string; name: string; emoji: string | null; category: string; reference: number; min: number; max: number;
  /** Can go on the market now. */
  ok: boolean; worn: boolean; locked: string | null; holdUntil: string | null; acquired: string;
}
export interface MarketState {
  on: boolean;
  unlocked: boolean;
  reason: "economy_frozen" | "too_new" | "economy_locked" | "no_player" | null;
  unlocksAt: string;
  /** The trade hold after a new device or an email change, until then. */
  hold: string | null;
  open: boolean;
  browse: MarketListing[];
  mine: MyListing[];
  trades: MarketTrade[];
  items: MyThing[];
}
export interface MarketPerson { id: string; name: string; style: string; crew: boolean; partner: boolean; canTrade: boolean }
export interface ClosetItem { id: number; sku: string; name: string; emoji: string | null; category: string; reference: number }

export type MarketResult<T> = { ok: true; data: T } | { ok: false; error: string };
/** What the game calls: app/home/marketActions.ts on the server, lib/marketSim.ts in the preview. */
export interface MarketApi {
  state(): Promise<MarketResult<MarketState>>;
  people(): Promise<MarketResult<MarketPerson[]>>;
  closet(player: string): Promise<MarketResult<ClosetItem[]>>;
  list(item: number, price: number): Promise<MarketResult<{ id: number; fee: number }>>;
  cancel(id: number): Promise<MarketResult<unknown>>;
  buy(id: number, sure: boolean): Promise<MarketResult<{ id: number; cash: number }>>;
  offer(to: string, mine: number[], theirs: number[], cashMine: number, cashTheirs: number): Promise<MarketResult<MarketTrade>>;
  edit(id: number, version: number, mine: number[], theirs: number[], cashMine: number, cashTheirs: number): Promise<MarketResult<MarketTrade>>;
  confirm(id: number, version: number, sure: boolean): Promise<MarketResult<MarketTrade>>;
  cancelTrade(id: number): Promise<MarketResult<MarketTrade>>;
  setOpen(open: boolean): Promise<MarketResult<unknown>>;
}

/** Swaps waiting on you (to badge the Phone's Market tile). */
export const marketAlerts = (s: MarketState | null) =>
  s?.on ? s.trades.filter((t) => t.status === "open" && !t.you.ok).length : 0;

/** "Trading paused until Sat 3 PM" for the trade hold. */
export function holdLine(until: string | null, now = Date.now()): string | null {
  if (!until) return null;
  const t = Date.parse(until);
  if (!(t > now)) return null;
  const when = new Date(t).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  return `New phone, new email, new you? The Market waits ${MARKETPLACE.hold.hours} hours after a sign-in from a new device or an email change, in case it isn't you. Back ${when}.`;
}

/** Player-facing words for the marketplace's refusals (the core's go through economyError). */
export function marketError(message: string): string {
  const m = message.toLowerCase();
  const code = (c: string) => m.includes(c);
  if (code("phase_off")) return "The Market isn't open yet. The city is still printing price tags.";
  if (code("their_trade_hold")) return "They just signed in somewhere new, so their trading is paused for a few days. Try later.";
  if (code("trade_hold")) return `New device or new email: the Market waits ${MARKETPLACE.hold.hours} hours, in case it isn't you. Thieves hate this one trick.`;
  if (code("they_cant_trade")) return "They can't trade yet: new accounts and Rank 1 have to wait.";
  if (code("out_of_band")) return `Prices stay between ${Math.round(PLAYER_ECONOMY.band.min * 100)}% and ${Math.round(PLAYER_ECONOMY.band.max * 100)}% of the Shop price. The city has seen what "a steal" means.`;
  if (code("unbalanced")) return "That swap doesn't balance. Both sides have to be worth about the same, give or take half.";
  if (code("too_much_cash")) return "C$ can only top a swap up. Put more things on that side instead.";
  if (code("no_items")) return "A swap needs at least one thing on each side. Otherwise it's just money, and that's not allowed.";
  if (code("too_many_items")) return `Up to ${MARKETPLACE.swap.maxItems} things a side.`;
  if (code("same_item")) return "Swapping a thing for the same thing. Bold. No.";
  if (code("their_item_locked") || code("their_not_tradable") || code("their_item_worn")) return "One of their pieces isn't available right now.";
  if (code("item_locked")) return "That piece is already listed or in a swap.";
  if (code("item_worn")) return "Take it off first. Selling the clothes off your back is a different game.";
  if (code("item_changed")) return "Something in the swap changed hands. Take another look.";
  if (code("not_tradable")) return "That one can't be traded: real-money pieces, rewards, story pieces, cars and houses stay with their owner.";
  if (code("no_resale")) return `Things you got from other players stay with you ${PLAYER_ECONOMY.noResaleDays} days before you can sell or swap them.`;
  if (code("listing_limit")) return `That's ${MARKETPLACE.listing.maxOpen} listings up. Sell something first, mogul.`;
  if (code("listing_gone")) return "That listing isn't there anymore. Someone was faster.";
  if (code("own_listing")) return "That's yours. Buying it would be a choice.";
  if (code("not_visible")) return "You can only trade with your Crew, your partner and people you've chatted with, unless you're both on the open board.";
  if (code("confirm_big")) return "Big one. Confirm it again.";
  if (code("sku_limit")) return `You've had ${MARKETPLACE.perSkuWeek} of those from the Market this week. Leave some for the rest of Queens.`;
  if (code("need_clout")) return "You don't have the clout for that one yet.";
  if (code("already_owned")) return "Someone in this deal already owns one of those.";
  if (code("trade_open")) return "You already have a swap open with them. Finish that one first.";
  if (code("trade_changed")) return "The swap changed while you were looking. Check it again before you confirm.";
  if (code("trade_gone")) return "That swap is closed.";
  if (code("own_trade")) return "Trading with yourself is called a closet.";
  if (code("unknown_player")) return "That player isn't around anymore.";
  if (code("unknown_item") || code("bad_items")) return "One of those things isn't where it should be. Refresh and try again.";
  return economyError(message);
}

// ---------------------------------------------------------------------------
// Underworld jobs between players (lib/underworld.ts runs them; migration 0152 holds the cut)
// ---------------------------------------------------------------------------
export interface UnderworldHire {
  id: number; job: string; title: string; emoji: string | null; cut: number; fee: number;
  status: "offered" | "done" | "declined" | "expired"; outcome: "win" | "trace" | "fizzle" | "bust" | null; pay: number;
  day: string; createdAt: string; expiresAt: string;
  with: string | null; withName: string; withStyle: string | null;
  /** Received hires: the job's options as a You get / It costs card (the server adds them; never the odds). */
  options?: { id: string; label: string; get: string; cost: string; energy: number }[];
}
export interface UnderworldHires { sent: UnderworldHire[]; received: UnderworldHire[] }
export interface UnderworldRunner { id: string; name: string; style: string; canTake: boolean }

export function hireError(code: string): string | null {
  const m = code.toLowerCase();
  if (m.includes("hire_limit")) return `One runner a day. Pablo doesn't like crowds.`;
  if (m.includes("runner_not_in")) return "Pablo doesn't know them. He doesn't do introductions.";
  if (m.includes("bad_cut")) return `Pick a cut: ${MARKETPLACE.hire.cuts.map(money).join(", ")}.`;
  if (m.includes("no_offer")) return "That job isn't yours to hand out anymore.";
  if (m.includes("hire_gone")) return "That job isn't waiting anymore.";
  if (m.includes("own_hire")) return "You can't hire yourself. You're already doing it for free.";
  return null;
}

/** "C$250 cut, C$238 after the city fee". */
export const cutLine = (cut: number) => `${money(cut)} cut, ${money(cut - economyFee("job", cut))} after the city fee`;

// ---------------------------------------------------------------------------
// Studio → Economy → Recent trades (admin_market_recent, admin_market_reverse)
// ---------------------------------------------------------------------------
export interface MarketRecentRow {
  kind: "sale" | "trade"; id: number; at: string; status: "done" | "reversed";
  /** A sale: the piece. A swap: what went each way. */
  label: string;
  /** A sale: the price and the piece's Shop price. A swap: each side's Shop value plus C$. */
  value: number; reference: number; fee: number;
  from: { id: string | null; name: string }; to: { id: string | null; name: string };
  reversible: boolean;
  reversal: { reason: string; at: string } | null;
}
export interface MarketAdmin {
  reversalDays: number;
  week: { sales: number; trades: number; listed: number; value: number; fees: number };
  recent: MarketRecentRow[];
  /** After a reversal: C$ that couldn't be taken back (already spent), and pieces that were gone (paid at Shop value). */
  last?: { short: number; missing: { sku: string; name: string; value: number }[] };
}
