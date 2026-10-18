import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSlug, conversion, creatorUrl, giftItems, landingPath, normalizeCreatorCode, slugProblem } from "../lib/creators.ts";

test("creators: codes are typed loosely and stored strictly (3 to 16 letters and numbers)", () => {
  assert.equal(normalizeCreatorCode(" tasha "), "TASHA");
  assert.equal(normalizeCreatorCode("dev-q"), "DEVQ");
  assert.equal(normalizeCreatorCode("ab"), null);
  assert.equal(normalizeCreatorCode("x".repeat(17)), null);
  assert.equal(normalizeCreatorCode(null), null);
});

test("creators: slugs follow the database rule", () => {
  assert.equal(cleanSlug(" Tasha TikTok "), "tasha-tiktok");
  assert.equal(slugProblem("tasha-tiktok"), null);
  assert.ok(slugProblem("a"));
  assert.ok(slugProblem("-tasha"));
  assert.ok(slugProblem("tasha--x"));
  assert.ok(slugProblem("x".repeat(41)));
  assert.equal(creatorUrl("https://example.com/", "tasha"), "https://example.com/c/tasha");
});

test("creators: guests land at the front door, players on the screen", () => {
  assert.equal(landingPath("signup", false), "/?signup=1");
  assert.equal(landingPath("shop", false), "/");
  assert.equal(landingPath("home", true), "/home");
  assert.equal(landingPath("signup", true), "/home");
  assert.equal(landingPath("vip", true), "/home?open=vip");
});

test("creators: the welcome gift is a Shop fashion piece sold for C$, never a collector or reward piece", () => {
  const items = giftItems();
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.category === "fashion" && !i.collector && !i.reward && i.price > 0));
});

test("creators: click to sign-up", () => {
  assert.equal(conversion(12, 100), 12);
  assert.equal(conversion(1, 3), 33.3);
  assert.equal(conversion(5, 0), null);
});

import { commissionOn } from "../lib/creators.ts";
import { estimateFee, feeFromIntent, invoiceIntent, invoiceTax } from "../lib/stripe.ts";

test("commissions: on net revenue (price − Stripe's fee − tax), at the creator's rate, never negative", () => {
  assert.deepEqual(commissionOn(3999, 146, 0, 20), { net: 3853, commission: 771 });
  assert.deepEqual(commissionOn(499, 44, 40, 30), { net: 415, commission: 125 });
  assert.deepEqual(commissionOn(100, 300, 0, 30), { net: 0, commission: 0 });
});

test("commissions: Stripe's fee and tax across API versions, with an estimate when the fee can't be read", () => {
  assert.equal(estimateFee(499), 44);
  assert.equal(feeFromIntent({ latest_charge: { balance_transaction: { fee: 146 } } }), 146);
  assert.equal(feeFromIntent({ latest_charge: "ch_1" }), null);
  assert.equal(invoiceTax({ tax: 40 }), 40);
  assert.equal(invoiceTax({ total_taxes: [{ amount: 25 }, { amount: 15 }] }), 40);
  assert.equal(invoiceTax({}), 0);
  assert.equal(invoiceIntent({ payment_intent: "pi_old" }), "pi_old");
  assert.equal(invoiceIntent({ payments: { data: [{ payment: { payment_intent: { id: "pi_new" } } }] } }), "pi_new");
  assert.equal(invoiceIntent({}), null);
});

import { payoutsCsv } from "../lib/creators.ts";

test("payouts: the CSV for the bank or PayPal run quotes awkward names", () => {
  const csv = payoutsCsv([{ name: "Glow, Tasha", email: "tasha@example.com", handle: "@tasha", code: "TASHA", payableCents: 7473 }], "2026-11-01");
  assert.equal(csv, 'Creator,Email,Handle,Code,Amount (USD),Date\n"Glow, Tasha",tasha@example.com,@tasha,TASHA,74.73,2026-11-01\n');
});
