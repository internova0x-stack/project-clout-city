import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

// The Stripe webhook: the only thing that grants (or, on refund, revokes) what a
// player bought. Every call is idempotent per Stripe event id (supabase/migrations/0008).
// Point a Stripe webhook endpoint at /api/stripe/webhook with these events:
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.expired, charge.refunded.

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
          p_event: event.id, p_session: o.id, p_payment: o.payment_intent, p_player: meta.player_id ?? o.client_reference_id,
          p_sku: meta.sku, p_amount: o.amount_total, p_currency: o.currency,
        },
      };
      break;
    case "checkout.session.expired":
      call = { fn: "payment_expired", args: { p_event: event.id, p_session: o.id } };
      break;
    case "charge.refunded":
      // Full refunds revoke; a partial refund is a goodwill credit and keeps access.
      if (o.refunded !== true) break;
      call = { fn: "payment_refund", args: { p_event: event.id, p_payment: o.payment_intent } };
      break;
  }
  if (!call) return NextResponse.json({ received: true, ignored: event.type });

  const { data, error } = await db.rpc(call.fn, call.args);
  if (error) {
    // A 500 makes Stripe retry later; the event id keeps the retry from doubling anything.
    console.error(`stripe ${event.type} ${event.id} failed`, error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ received: true, result: data });
}
