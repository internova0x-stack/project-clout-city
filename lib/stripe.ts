// The two things the game needs from Stripe, without the SDK: create a hosted
// Checkout Session, and verify a webhook's signature. Server only (secret keys).
// https://docs.stripe.com/api/checkout/sessions/create
// https://docs.stripe.com/webhooks#verify-manually

import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe's form encoding for nested params: a[b][0][c]=1. */
export function formEncode(params: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(formEncode(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

export interface CheckoutInput {
  /** A Stripe Price id, or null to charge `amountCents` for `name` inline. */
  priceId: string | null;
  name: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  playerId: string;
  sku: string;
  productType: string;
  email?: string | null;
}

/** The form body for one Checkout Session: one-time payment, one item, our ids in metadata. */
export function checkoutParams(i: CheckoutInput): Record<string, unknown> {
  const metadata = { player_id: i.playerId, sku: i.sku, product_type: i.productType };
  return {
    mode: "payment",
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    client_reference_id: i.playerId,
    customer_email: i.email ?? undefined,
    line_items: {
      0: i.priceId
        ? { price: i.priceId, quantity: 1 }
        : { quantity: 1, price_data: { currency: i.currency, unit_amount: i.amountCents, product_data: { name: i.name } } },
    },
    metadata,
    payment_intent_data: { metadata },
    // Sessions that are never paid end after 30 minutes, which clears the "unlocking" state.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  };
}

export async function createCheckoutSession(secretKey: string, input: CheckoutInput): Promise<{ id: string; url: string }> {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(checkoutParams(input)),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.id || !data.url) throw new Error(`stripe_checkout_failed: ${data.error?.message ?? res.status}`);
  return { id: data.id, url: data.url };
}

/**
 * Checks the Stripe-Signature header (t=…,v1=…) against the raw body: HMAC-SHA256 of
 * "t.body" with the endpoint secret, within `toleranceSec` of now (stops replays).
 */
export function verifyStripeSignature(body: string, header: string | null, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const fields = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(fields.find(([k]) => k === "t")?.[1]);
  const sigs = fields.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** For tests: the header Stripe would send for this body. */
export function signForTest(body: string, secret: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex")}`;
}
