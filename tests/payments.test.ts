import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutParams, formEncode, signForTest, verifyStripeSignature } from "../lib/stripe.ts";
import { formatPrice, readReturn, storeError } from "../lib/store.ts";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const NOW = 1_800_000_000;

test("webhook signatures: only Stripe's, only fresh, only for this body", () => {
  assert.ok(verifyStripeSignature(BODY, signForTest(BODY, SECRET, NOW), SECRET, 300, NOW));
  assert.ok(!verifyStripeSignature(BODY, signForTest(BODY, "whsec_other", NOW), SECRET, 300, NOW), "wrong secret");
  assert.ok(!verifyStripeSignature(BODY + " ", signForTest(BODY, SECRET, NOW), SECRET, 300, NOW), "tampered body");
  assert.ok(!verifyStripeSignature(BODY, signForTest(BODY, SECRET, NOW - 301), SECRET, 300, NOW), "replayed late");
  assert.ok(!verifyStripeSignature(BODY, null, SECRET, 300, NOW), "no header");
  assert.ok(!verifyStripeSignature(BODY, "t=abc,v1=zz", SECRET, 300, NOW), "garbage header");
  assert.ok(!verifyStripeSignature(BODY, signForTest(BODY, SECRET, NOW), "", 300, NOW), "no secret configured");
  // Stripe may send several v1 signatures while a secret rotates.
  const both = `${signForTest(BODY, "whsec_old", NOW)},${signForTest(BODY, SECRET, NOW).split(",")[1]}`;
  assert.ok(verifyStripeSignature(BODY, both, SECRET, 300, NOW));
});

test("checkout: one-time payment, our ids in metadata, price from config or Stripe", () => {
  const base = {
    name: "Clout City: The Momager Files", amountCents: 299, currency: "usd", successUrl: "https://x/home?purchase=success&sku=a",
    cancelUrl: "https://x/home?purchase=cancelled&sku=a", playerId: "p1", sku: "side_sarah_bird_momager_files", productType: "side_arc",
  };
  const inline = checkoutParams({ ...base, priceId: null });
  assert.equal(inline.mode, "payment");
  assert.deepEqual(inline.metadata, { player_id: "p1", sku: "side_sarah_bird_momager_files", product_type: "side_arc" });
  const body = formEncode(inline);
  assert.match(body, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=299/);
  assert.match(body, /payment_intent_data%5Bmetadata%5D%5Bsku%5D=side_sarah_bird_momager_files/);
  assert.match(body, /client_reference_id=p1/);
  const priced = formEncode(checkoutParams({ ...base, priceId: "price_123" }));
  assert.match(priced, /line_items%5B0%5D%5Bprice%5D=price_123/);
  assert.doesNotMatch(priced, /unit_amount/);
});

test("return from Stripe and prices", () => {
  assert.deepEqual(readReturn("?purchase=success&sku=abc"), { state: "success", sku: "abc" });
  assert.deepEqual(readReturn("?purchase=cancelled&sku=abc"), { state: "cancelled", sku: "abc" });
  assert.equal(readReturn("?purchase=hacked&sku=abc"), null);
  assert.equal(readReturn("?sku=abc"), null);
  assert.equal(formatPrice(299), "$2.99");
  assert.equal(formatPrice(99, "usd"), "$0.99");
  assert.match(storeError("payments_off"), /Nothing was charged/);
});

test("unlimited chat's monthly and yearly plans are subscriptions; forever is a one-time payment", () => {
  const base = { name: "Clout City: Unlimited chat", amountCents: 499, currency: "usd", successUrl: "https://x/s", cancelUrl: "https://x/c", playerId: "p1", productType: "chat_pass" };
  const monthly = checkoutParams({ ...base, sku: "chat-unlimited-monthly", priceId: null, recurring: "month" });
  assert.equal(monthly.mode, "subscription");
  const body = formEncode(monthly);
  assert.match(body, /line_items%5B0%5D%5Bprice_data%5D%5Brecurring%5D%5Binterval%5D=month/);
  assert.match(body, /subscription_data%5Bmetadata%5D%5Bsku%5D=chat-unlimited-monthly/);
  assert.doesNotMatch(body, /payment_intent_data/, "subscriptions can't take payment_intent_data");
  const yearly = formEncode(checkoutParams({ ...base, sku: "chat-unlimited-yearly", priceId: null, amountCents: 3999, recurring: "year" }));
  assert.match(yearly, /mode=subscription/);
  assert.match(yearly, /line_items%5B0%5D%5Bprice_data%5D%5Brecurring%5D%5Binterval%5D=year/);
  assert.equal(checkoutParams({ ...base, sku: "chat-unlimited-forever", priceId: null, amountCents: 11999 }).mode, "payment");
});

test("checkout asks for the EU/UK withdrawal consent (a tick box), or says it by the pay button", () => {
  const base = { priceId: null, name: "x", amountCents: 299, currency: "usd", successUrl: "https://cloutcity.app/home?paid=1", cancelUrl: "https://cloutcity.app/home", playerId: "p", sku: "s", productType: "side_arc" };
  const box = checkoutParams(base) as { consent_collection: { terms_of_service: string }; custom_text: { terms_of_service_acceptance: { message: string } } };
  assert.equal(box.consent_collection.terms_of_service, "required");
  assert.match(box.custom_text.terms_of_service_acceptance.message, /\[Terms\]\(https:\/\/cloutcity\.app\/terms\).*14-day right to withdraw/);
  const sub = checkoutParams({ ...base, recurring: "month" }) as typeof box;
  assert.match(sub.custom_text.terms_of_service_acceptance.message, /cancel any time/);
  const notice = checkoutParams({ ...base, consent: "notice" }) as { consent_collection?: unknown; custom_text: { submit: { message: string } } };
  assert.equal(notice.consent_collection, undefined);
  assert.match(notice.custom_text.submit.message, /^By paying, you ask for your purchase right away/);
  for (const m of [box.custom_text.terms_of_service_acceptance.message, notice.custom_text.submit.message]) assert.ok(m.length <= 1200);
});

test("numbered pieces are paid by card at once, never by a delayed method (security review)", () => {
  const base = {
    name: "Clout City: Cloud Nine Sofa", amountCents: 1499, currency: "usd", successUrl: "https://x/home", cancelUrl: "https://x/home",
    playerId: "p1", sku: "cloud-nine-sofa", priceId: null,
  };
  assert.match(formEncode(checkoutParams({ ...base, productType: "collector_item" })), /payment_method_types%5B0%5D=card/);
  assert.doesNotMatch(formEncode(checkoutParams({ ...base, productType: "side_arc" })), /payment_method_types/);
});
