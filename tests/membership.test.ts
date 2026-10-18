import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutParams } from "../lib/stripe.ts";
import { purchaseEmoji, vipFromSubscription, vipLine } from "../lib/membership.ts";
import { previewMembership } from "../lib/membershipSim.ts";

const fallback = { plan: "monthly" as const, priceCents: 499, currency: "usd" };
const END = 1_800_000_000;
const item = (interval: string, amount = 3999, end: number | undefined = END) => ({ data: [{ current_period_end: end, price: { unit_amount: amount, currency: "usd", recurring: { interval } } }] });

test("membership: the plan comes from Stripe, so a switch in the portal shows at once", () => {
  const v = vipFromSubscription({ status: "active", items: item("year") }, fallback);
  assert.deepEqual(v, { plan: "yearly", status: "active", periodEnd: new Date(END * 1000).toISOString(), priceCents: 3999, currency: "usd" });
});

test("membership: cancelled runs to the end of the paid period; failed payments say so", () => {
  assert.equal(vipFromSubscription({ status: "active", cancel_at_period_end: true, items: item("month", 499) }, fallback).status, "cancelling");
  const at = vipFromSubscription({ status: "active", cancel_at: END + 60, items: item("month", 499) }, fallback);
  assert.equal(at.status, "cancelling");
  assert.equal(at.periodEnd, new Date((END + 60) * 1000).toISOString(), "cancel_at is when VIP ends");
  assert.equal(vipFromSubscription({ status: "past_due", items: item("month", 499) }, fallback).status, "past_due");
  // Older API versions keep the period end on the subscription.
  assert.equal(vipFromSubscription({ status: "active", current_period_end: END, items: item("month", 499, undefined) }, fallback).periodEnd, new Date(END * 1000).toISOString());
  assert.deepEqual(vipFromSubscription({ status: "active" }, fallback), { ...fallback, status: "active", periodEnd: null });
});

test("membership: the plan's line", () => {
  const base = { plan: "monthly" as const, priceCents: 499, currency: "usd" };
  assert.match(vipLine({ ...base, status: "active", periodEnd: "2026-11-05T15:00:00Z" }, "$4.99"), /^Renews Nov 5, 2026 · \$4\.99\/month$/);
  assert.match(vipLine({ ...base, status: "cancelling", periodEnd: "2026-11-05T15:00:00Z" }, "$4.99"), /VIP until Nov 5, 2026/);
  assert.equal(vipLine({ ...base, status: "active", periodEnd: null }, "$4.99"), "$4.99/month");
  assert.equal(vipLine({ ...base, plan: "yearly", status: "past_due", periodEnd: null }, "$39.99"), "Your last payment didn't go through");
});

test("membership: purchase emoji by kind", () => {
  assert.equal(purchaseEmoji("chat_pass", "chat-unlimited-forever"), "✨");
  assert.equal(purchaseEmoji("chat_pass", "chat-unlimited-yearly"), "👑");
  assert.equal(purchaseEmoji("postcard", "postcard-unisphere"), "📮");
  assert.equal(purchaseEmoji("mystery", "x"), "🧾");
});

test("checkout: a returning buyer pays as their Stripe customer; new one-off buyers get one", () => {
  const base = { priceId: null, name: "Clout City: Thing", amountCents: 299, currency: "usd", successUrl: "https://x/s", cancelUrl: "https://x/c", playerId: "p1", sku: "s", productType: "postcard", email: "a@b.c" };
  const fresh = checkoutParams(base);
  assert.equal(fresh.customer_creation, "always");
  assert.equal(fresh.customer_email, "a@b.c");
  const back = checkoutParams({ ...base, customer: "cus_1" });
  assert.equal(back.customer, "cus_1");
  assert.equal(back.customer_email, undefined);
  assert.equal(back.customer_creation, undefined);
  const sub = checkoutParams({ ...base, customer: "cus_1", recurring: "month" });
  assert.equal(sub.customer, "cus_1");
  assert.equal(sub.customer_creation, undefined, "subscriptions always make a customer");
});

test("membership preview: every preset loads", async () => {
  for (const p of ["vip", "monthly", "cancelling", "pastdue", "forever", "free", "none"]) {
    const r = await previewMembership(p).state();
    assert.ok(r.ok);
  }
});
