import { NextResponse, type NextRequest } from "next/server";
import { paymentCosts, verifyStripeSignature } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

// The Stripe webhook: the only thing that grants (or, on refund, revokes) what a
// player bought. Every call is idempotent per Stripe event id (supabase/migrations/0008).
// Point a Stripe webhook endpoint at /api/stripe/webhook with these events:
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.expired, charge.refunded, and (unlimited chat's monthly plan, migration 0047)
// customer.subscription.updated and customer.subscription.deleted, plus invoice.paid (renewals).
// Creators (migration 0088): a payment by a referred player also writes the creator's commission on net revenue
// (Stripe's fee from the balance transaction, and tax), and a refund, full or partial, takes back its share.

export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!verifyStripeSignature(body, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const event = JSON.parse(body) as StripeEvent;
  const o = event.data.object;
  const meta = (o.metadata ?? {}) as Record<string, string>;
  let call: { fn: string; args: Record<string, unknown> } | null = null;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // Card payments arrive paid; delayed methods wait for async_payment_succeeded.
      if (o.payment_status !== "paid") break;
      call = {
        fn: "payment_grant",
        args: {
          // A subscription's entitlement is keyed by the subscription, so its end can revoke it.
          p_event: event.id, p_session: o.id, p_payment: o.mode === "subscription" ? o.subscription : o.payment_intent,
          p_player: meta.player_id ?? o.client_reference_id,
          p_sku: meta.sku, p_amount: o.amount_total, p_currency: o.currency,
        },
      };
      break;
    case "checkout.session.expired":
      call = { fn: "payment_expired", args: { p_event: event.id, p_session: o.id } };
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // Ended (cancelled, unpaid) revokes unlimited chat, so the daily limit comes back; active restores it.
      call = { fn: "payment_subscription", args: { p_event: event.id, p_subscription: o.id, p_status: event.type.endsWith("deleted") ? "canceled" : o.status } };
      break;
    case "invoice.paid":
      // Insights (migration 0053): VIP renewals count as revenue. The first invoice is the checkout itself.
      if (o.billing_reason !== "subscription_cycle" || !o.subscription) break;
      call = { fn: "payment_renewal", args: { p_event: event.id, p_subscription: o.subscription, p_amount: o.amount_paid, p_currency: o.currency } };
      break;
    case "charge.refunded":
      // Full refunds revoke; a partial refund is a goodwill credit and keeps access.
      if (o.refunded !== true) break;
      call = { fn: "payment_refund", args: { p_event: event.id, p_payment: o.payment_intent } };
      break;
  }
  if (!call) {
    // A partial refund keeps access, but still takes back its share of a creator's commission.
    if (event.type === "charge.refunded") {
      const commission = await creatorCommission(db, event, o);
      if (commission === "error") return NextResponse.json({ error: "db" }, { status: 500 });
      return NextResponse.json({ received: true, commission });
    }
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const { data, error } = await db.rpc(call.fn, call.args);
  // Membership & purchases (migration 0079): remember the buyer's Stripe customer for the billing portal.
  if (!error && call.fn === "payment_grant" && typeof o.customer === "string" && call.args.p_player) {
    const saved = await db.rpc("payment_customer", { p_player: call.args.p_player, p_customer: o.customer });
    if (saved.error) console.error(`stripe ${event.id} customer not saved`, saved.error);
  }
  if (error) {
    // A 500 makes Stripe retry later; the event id keeps the retry from doubling anything.
    console.error(`stripe ${event.type} ${event.id} failed`, error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  const commission = await creatorCommission(db, event, o, call.args.p_player as string | undefined);
  if (commission === "error") return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ received: true, result: data, commission });
}

/**
 * The creator's side of a payment (migration 0088): a commission on a referred player's purchase or renewal, once
 * per payment, or the reversal of a refunded one. Idempotent, so a Stripe retry after a 500 is safe.
 */
async function creatorCommission(db: NonNullable<ReturnType<typeof getAdminSupabase>>, event: StripeEvent, o: Record<string, unknown>, player?: string) {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : null);
  let args: Record<string, unknown> | null = null;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (!player) return null;
    const referred = await db.rpc("creator_referred", { p_player: player });
    if (referred.error) return missing(referred.error) ? null : "error";
    if (!referred.data) return null;
    const amount = Number(o.amount_total ?? 0);
    const sub = o.mode === "subscription";
    const costs = await paymentCosts(secret, {
      paymentIntent: sub ? null : str(o.payment_intent), invoice: sub ? str(o.invoice) : null, amount,
      tax: (o.total_details as { amount_tax?: number } | undefined)?.amount_tax ?? null,
    });
    args = { p_source: `purchase:${o.id}`, p_kind: "sale", p_player: player, p_sku: ((o.metadata ?? {}) as Record<string, string>).sku, amount, costs };
  } else if (event.type === "invoice.paid") {
    const found = await db.rpc("creator_subscription_player", { p_subscription: str(o.subscription) });
    if (found.error) return missing(found.error) ? null : "error";
    if (!found.data) return null;
    const amount = Number(o.amount_paid ?? 0);
    const costs = await paymentCosts(secret, { invoice: String(o.id), amount });
    args = { p_source: `renewal:${o.id}`, p_kind: "renewal", p_player: found.data, p_sku: null, amount, costs };
  } else if (event.type === "charge.refunded") {
    const r = await db.rpc("creator_commission_refund", {
      p_event: event.id, p_payment_intent: str(o.payment_intent), p_invoice: str(o.invoice), p_refunded: o.amount_refunded, p_amount: o.amount,
    });
    if (r.error) return missing(r.error) ? null : "error";
    return r.data;
  }
  if (!args) return null;
  const { costs, amount, ...rest } = args as { costs: Awaited<ReturnType<typeof paymentCosts>>; amount: number } & Record<string, unknown>;
  const r = await db.rpc("creator_commission_record", {
    p_event: event.id, ...rest, p_payment_intent: costs.paymentIntent, p_invoice: costs.invoice,
    p_gross: amount, p_fee: costs.fee, p_tax: costs.tax, p_currency: o.currency, p_fee_estimated: costs.estimated,
  });
  if (r.error) { console.error(`stripe ${event.id} commission failed`, r.error); return missing(r.error) ? null : "error"; }
  return r.data;
}

/** Before migration 0088 is run, payments carry on without commissions. */
const missing = (e: { message: string }) => /does not exist|schema cache|could not find the function/i.test(e.message);
