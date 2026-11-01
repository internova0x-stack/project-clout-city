// Real-money products (Story Production and Payments Brief v2, part 2) as the game
// sees them: store_catalog() in supabase/migrations/0008. Safe to import anywhere.

export interface StoreProduct {
  sku: string;
  type: "side_arc" | "exclusive_event" | "collector_item" | "postcard" | "chat_pass" | "season_pass" | "bundle";
  name: string;
  priceCents: number;
  currency: string;
  parent: string | null;
  owned: boolean;
  /** Paid at Stripe, waiting for the webhook to unlock it. */
  pending: boolean;
  /** Postcards: the monument it belongs to, and whether the player has visited it (needed to buy). */
  placeId?: string | null;
  visited?: boolean | null;
  /** Collector pieces: their value in Net Worth. */
  value?: number | null;
  /** Exclusive events: the party itself. */
  event?: ExclusiveEvent | null;
  /** v0.7 (migration 0022): owned copies are numbered in the order players collected them. */
  serial?: number | null;
  ownedAt?: string | null;
  /** Clout Couture (migration 0102): a numbered piece's drop and what's left of it. */
  edition?: Edition | null;
}

/** A numbered drop: `size` per drop, numbers up to `dropEnd`, `issued` so far (refunded copies keep theirs). */
export interface Edition { size: number; drop: number; dropEnd: number; issued: number; left: number; soldOut: boolean }

/** Every real-money purchase over $50 shows the confirmation sheet first (docs/shop-manager.md section 3). */
export const CONFIRM_ABOVE_CENTS = 5000;
export const needsConfirm = (p: Pick<StoreProduct, "priceCents"> | null | undefined) => !!p && p.priceCents > CONFIRM_ABOVE_CENTS;

/** "Drop 1 · 63 of 100 left", or "Sold out" until the next drop. */
export function editionLine(e: Edition): string {
  return e.soldOut ? `Drop ${e.drop} · Sold out` : `Drop ${e.drop} · ${e.left} of ${e.size} left`;
}

/** Badge for owning any Clout Couture piece (migration 0102). */
export const COUTURE_BADGE = { id: "clout-couture", name: "Clout Couture", emoji: "💎", line: "Owns a numbered Clout Couture piece." };

export interface ExclusiveEvent {
  id: string;
  placeId: string;
  name: string;
  host: string;
  blurb: string;
  startsAt: string;
  endsAt: string;
  clout: number;
  energy: number;
  mood: number;
  confidence: number;
  attended: boolean;
  /** v0.9 (migration 0029): on the list as this player's plus-one, without a ticket of your own. */
  plusOneOf?: string | null;
}

/** Badge for owning every postcard (Clarifications 6). */
export const POSTCARD_BADGE = { id: "postcard-collector", name: "Greetings from Queens", emoji: "💌", line: "Every postcard in the set." };

/** Doors state for a party, in real minutes (C26). */
export function partyState(e: ExclusiveEvent, nowMs: number): { open: boolean; minutesToOpen: number; over: boolean } {
  const start = Date.parse(e.startsAt);
  const end = Date.parse(e.endsAt);
  return { open: nowMs >= start && nowMs < end, minutesToOpen: Math.max(0, Math.ceil((start - nowMs) / 60_000)), over: nowMs >= end };
}

/** Parties that have ended stay in the catalog only as the ticket holder's event card (0022). */
export const liveParty = (p: StoreProduct, nowMs: number) => !!p.event && !partyState(p.event, nowMs).over;

/** "No. 0042": the copy's number, four digits until the 10,000th. */
export const serialLabel = (n: number) => `No. ${String(n).padStart(4, "0")}`;

/** Lola's note on the back of each postcard (C39, v0.7 Collection). Keyed by place id. */
export const POSTCARD_NOTES: Record<string, string> = {
  unisphere: "Wish you were here, babe. Actually, glad you're not: more globe for me.",
  "gantry-plaza": "The skyline posed for me. Manhattan never calls back, but darling, it does look good from here.",
};

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export interface StoreApi {
  catalog(): Promise<StoreProduct[] | null>;
  /** Starts Stripe Checkout for one product; the game then sends the player to `url`. */
  checkout(sku: string): Promise<CheckoutResult>;
  /** Inside the Steam app (docs/STEAM.md): starts a Steam order, which Steam shows in its overlay. */
  steamCheckout?(sku: string): Promise<{ ok: true; orderId: string } | { ok: false; error: string }>;
  /** Steam's answer for the order: approved finalizes and unlocks it, declined closes it. */
  steamFinish?(orderId: string, approved: boolean): Promise<{ ok: boolean; error?: string }>;
}

export function formatPrice(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Where Stripe sends the player back to, and what the game reads from it. */
export const RETURN_PARAM = "purchase";
export function readReturn(search: string): { state: "success" | "cancelled"; sku: string } | null {
  const q = new URLSearchParams(search);
  const state = q.get(RETURN_PARAM);
  const sku = q.get("sku");
  return (state === "success" || state === "cancelled") && sku ? { state, sku } : null;
}

const ERRORS: Record<string, string> = {
  payments_off: "Purchases aren't switched on yet. Nothing was charged.",
  already_owned: "You already own that one.",
  visit_first: "Visit the monument first. The postcard is the souvenir, not the trip.",
  event_over: "That party's over. The cleanup crew says hi.",
  unknown_product: "That isn't for sale.",
  no_player: "Finish moving in first.",
  sold_out: "That drop just sold out. Nothing was charged; the next drop gets announced in the News.",
  not_for_sale: "That piece isn't on sale right now. Nothing was charged.",
  already_own_car: "You already own a car. One garage, one car: sell yours first.",
};

export function storeError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "Checkout didn't open. Nothing was charged; try again.";
}
