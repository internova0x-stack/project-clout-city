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
  /** Unlimited chat (migrations 0047, 0051): "month" or "year" makes it a subscription that renews until cancelled. */
  recurring?: "month" | "year" | null;
  /** The player's Stripe customer (migration 0079), so every purchase lands on one customer and its billing portal. */
  customer?: string | null;
  /**
   * EU/UK withdrawal (owner, Oct 27): "required" makes Checkout show a box the buyer must tick (needs the Terms URL in
   * Stripe's public details); "notice" only says it beside the pay button (the fallback when that URL isn't set).
   */
  consent?: "required" | "notice";
}

/**
 * EU/UK 14-day withdrawal (Consumer Rights Directive art. 16(m); Terms section 5): digital content delivered at once
 * loses the right only with the buyer's express consent and acknowledgement, given at checkout.
 */
export function withdrawalText(siteOrigin: string, subscription: boolean): string {
  const what = subscription ? "VIP to start right away" : "my purchase delivered right away";
  return `I agree to the [Terms](${siteOrigin}/terms). I want ${what}, and I understand I lose my 14-day right to withdraw `
    + `once it starts${subscription ? " (I can still cancel any time to stop renewals)" : ""}.`;
}

/** The same, as a notice beside the pay button. */
export const withdrawalNotice = (subscription: boolean) =>
  `By paying, you ask for ${subscription ? "VIP to start" : "your purchase"} right away and accept that you lose your 14-day `
  + `right to withdraw once it starts${subscription ? " (you can still cancel any time to stop renewals)" : ""}. See our Terms.`;

/** The consent part of a Checkout Session: a required tick box, or the same words beside the pay button. */
function consentParams(i: CheckoutInput): Record<string, unknown> {
  let origin = "";
  try { origin = new URL(i.successUrl).origin; } catch { /* a relative URL: the link stays relative */ }
  const message = withdrawalText(origin, !!i.recurring);
  return (i.consent ?? "required") === "required"
    ? { consent_collection: { terms_of_service: "required" }, custom_text: { terms_of_service_acceptance: { message } } }
    : { custom_text: { submit: { message: withdrawalNotice(!!i.recurring) } } };
}

/** The returning customer, or the email for a new one. */
const who = (i: CheckoutInput) => (i.customer ? { customer: i.customer } : { customer_email: i.email ?? undefined });

/**
 * The form body for one Checkout Session: one item, our ids in metadata. A one-time payment, or a
 * monthly or yearly subscription (unlimited chat's plans), whose webhooks carry the subscription id.
 */
export function checkoutParams(i: CheckoutInput): Record<string, unknown> {
  const metadata = { player_id: i.playerId, sku: i.sku, product_type: i.productType };
  if (i.recurring) {
    return {
      mode: "subscription",
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      client_reference_id: i.playerId,
      ...who(i),
      line_items: {
        0: i.priceId
          ? { price: i.priceId, quantity: 1 }
          : { quantity: 1, price_data: { currency: i.currency, unit_amount: i.amountCents, recurring: { interval: i.recurring }, product_data: { name: i.name } } },
      },
      metadata,
      subscription_data: { metadata },
      ...consentParams(i),
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    };
  }
  return {
    mode: "payment",
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    client_reference_id: i.playerId,
    ...who(i),
    // Membership & purchases (migration 0079): one-off buyers get a customer too, so the billing portal has their receipts.
    customer_creation: i.customer ? undefined : "always",
    line_items: {
      0: i.priceId
        ? { price: i.priceId, quantity: 1 }
        : { quantity: 1, price_data: { currency: i.currency, unit_amount: i.amountCents, product_data: { name: i.name } } },
    },
    metadata,
    payment_intent_data: { metadata },
    // Security review (Oct 29): a numbered piece is paid at once (cards and card wallets), never days later by a delayed
    // method, which could land after the drop sold out.
    ...(i.productType === "collector_item" ? { payment_method_types: { 0: "card" } } : {}),
    ...consentParams(i),
    // Sessions that are never paid end after 30 minutes, which clears the "unlocking" state.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  };
}

export async function createCheckoutSession(secretKey: string, input: CheckoutInput): Promise<{ id: string; url: string }> {
  try {
    return await checkoutOnce(secretKey, input);
  } catch (e) {
    // The tick box needs the Terms URL set in Stripe (Settings → Public details). Until it is, checkout still works,
    // with the same words beside the pay button.
    if ((input.consent ?? "required") !== "required" || !/terms of service/i.test(String(e))) throw e;
    console.error("Stripe checkout: set the Terms of service URL in Stripe's public details to require the withdrawal tick box", e);
    return checkoutOnce(secretKey, { ...input, consent: "notice" });
  }
}

async function checkoutOnce(secretKey: string, input: CheckoutInput): Promise<{ id: string; url: string }> {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(checkoutParams(input)),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.id || !data.url) throw new Error(`stripe_checkout_failed: ${data.error?.message ?? res.status}`);
  return { id: data.id, url: data.url };
}

async function stripeCall<T>(secretKey: string, method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? formEncode(params) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`stripe_${path.split("/")[0]}_failed: ${data.error?.message ?? res.status}`);
  return data;
}

/** The parts of a Subscription the Membership screen reads (https://docs.stripe.com/api/subscriptions/object). */
export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  /** Older API versions put the period end on the subscription; newer ones on each item. */
  current_period_end?: number;
  items?: { data?: { current_period_end?: number; price?: { unit_amount?: number | null; currency?: string; recurring?: { interval?: string } | null } }[] };
}

export const getSubscription = (secretKey: string, id: string) =>
  stripeCall<StripeSubscription>(secretKey, "GET", `subscriptions/${encodeURIComponent(id)}`);

/** Delete my account (owner, Oct 27): every subscription of a customer that would still bill, cancelled now. */
export async function cancelAllSubscriptions(secretKey: string, customer: string): Promise<number> {
  const list = await stripeCall<{ data: StripeSubscription[] }>(secretKey, "GET", `subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`);
  const live = list.data.filter((x) => !["canceled", "incomplete_expired"].includes(x.status));
  for (const x of live) await stripeCall(secretKey, "DELETE", `subscriptions/${encodeURIComponent(x.id)}`);
  return live.length;
}

/** Chargebacks (migration 0125): a dispute names its charge, and the charge its customer (and a VIP charge its invoice). */
export const getCharge = (secretKey: string, charge: string) =>
  stripeCall<{ customer: string | null; invoice?: string | null }>(secretKey, "GET", `charges/${encodeURIComponent(charge)}`);

export const getCheckoutSession = (secretKey: string, id: string) =>
  stripeCall<{ id: string; customer: string | null; status?: string | null }>(secretKey, "GET", `checkout/sessions/${encodeURIComponent(id)}`);

/**
 * Security review (migration 0130): a player's older open checkout is closed when they start a new one, so they can't
 * pay twice. False when it can't be closed because it was already paid.
 */
export async function expireCheckoutSession(secretKey: string, id: string): Promise<boolean> {
  try {
    await stripeCall(secretKey, "POST", `checkout/sessions/${encodeURIComponent(id)}/expire`);
    return true;
  } catch {
    const s = await getCheckoutSession(secretKey, id);
    return s.status !== "complete";
  }
}

/** Stripe's standard US card fee, used when the real fee can't be read (spec section 21: commission on net). */
export const estimateFee = (amountCents: number) => Math.round(amountCents * 0.029) + 30;

interface StripeIntent { latest_charge?: string | { balance_transaction?: string | { fee?: number } | null } | null }
interface StripeInvoice {
  tax?: number | null;
  total_taxes?: { amount?: number }[] | null;
  total_tax_amounts?: { amount?: number }[] | null;
  payment_intent?: string | { id?: string } | null;
  payments?: { data?: { payment?: { payment_intent?: string | { id?: string } | null } }[] } | null;
}

/** The fee on a PaymentIntent expanded to its charge's balance transaction, or null. */
export function feeFromIntent(pi: StripeIntent): number | null {
  const charge = pi.latest_charge;
  const bt = charge && typeof charge === "object" ? charge.balance_transaction : null;
  return bt && typeof bt === "object" && typeof bt.fee === "number" ? bt.fee : null;
}
/** An invoice's tax: older API versions say `tax`, newer ones list `total_taxes` (or `total_tax_amounts`). */
export function invoiceTax(inv: StripeInvoice): number {
  if (typeof inv.tax === "number") return inv.tax;
  const list = inv.total_taxes ?? inv.total_tax_amounts ?? [];
  return list.reduce((t, x) => t + (x.amount ?? 0), 0);
}
/** An invoice's PaymentIntent: on the invoice in older API versions, under `payments` in newer ones. */
export function invoiceIntent(inv: StripeInvoice): string | null {
  const id = (v: string | { id?: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);
  return id(inv.payment_intent) ?? id(inv.payments?.data?.[0]?.payment?.payment_intent) ?? null;
}

/**
 * What Stripe kept and what was tax on one payment, for a creator's commission (migration 0088). Reads the fee from
 * the charge's balance transaction; when Stripe can't be read, estimates it (and says so) rather than failing.
 */
export async function paymentCosts(secretKey: string, ref: { paymentIntent?: string | null; invoice?: string | null; amount: number; tax?: number | null }) {
  let paymentIntent = ref.paymentIntent ?? null;
  let tax = ref.tax ?? null;
  if (ref.invoice) {
    const path = `invoices/${encodeURIComponent(ref.invoice)}`;
    const inv = await stripeCall<StripeInvoice>(secretKey, "GET", `${path}?expand%5B%5D=payments`)
      .catch(() => stripeCall<StripeInvoice>(secretKey, "GET", path)).catch(() => null);
    if (inv) { tax ??= invoiceTax(inv); paymentIntent ??= invoiceIntent(inv); }
  }
  let fee: number | null = null;
  if (paymentIntent) {
    const pi = await stripeCall<StripeIntent>(secretKey, "GET", `payment_intents/${encodeURIComponent(paymentIntent)}?expand%5B%5D=latest_charge.balance_transaction`).catch(() => null);
    fee = pi ? feeFromIntent(pi) : null;
  }
  return { fee: fee ?? estimateFee(ref.amount), estimated: fee === null, tax: tax ?? 0, paymentIntent, invoice: ref.invoice ?? null };
}

/**
 * Stripe doesn't know this id in the current mode: a customer or subscription made with test keys, read with live ones
 * (or another account's). The game forgets it rather than failing (owner, Oct 27).
 */
export const stripeUnknown = (e: unknown, what: "customer" | "subscription") => new RegExp(`No such ${what}`, "i").test(String(e));

/** A billing portal session (https://docs.stripe.com/api/customer_portal/sessions/create): its one-time `url`. */
export const createPortalSession = (secretKey: string, customer: string, returnUrl: string) =>
  stripeCall<{ url: string }>(secretKey, "POST", "billing_portal/sessions", { customer, return_url: returnUrl });

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
