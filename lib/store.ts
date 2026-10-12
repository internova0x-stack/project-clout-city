// Real-money products (Story Production and Payments Brief v2, part 2) as the game
// sees them: store_catalog() in supabase/migrations/0008. Safe to import anywhere.

export interface StoreProduct {
  sku: string;
  type: "side_arc" | "exclusive_event" | "collector_item" | "postcard";
  name: string;
  priceCents: number;
  currency: string;
  parent: string | null;
  owned: boolean;
  /** Paid at Stripe, waiting for the webhook to unlock it. */
  pending: boolean;
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export interface StoreApi {
  catalog(): Promise<StoreProduct[] | null>;
  /** Starts Stripe Checkout for one product; the game then sends the player to `url`. */
  checkout(sku: string): Promise<CheckoutResult>;
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
  unknown_product: "That isn't for sale.",
  no_player: "Finish moving in first.",
};

export function storeError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "Checkout didn't open. Nothing was charged; try again.";
}
