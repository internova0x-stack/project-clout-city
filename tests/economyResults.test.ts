import test from "node:test";
import assert from "node:assert/strict";
import { assetBoughtBanner, assetSoldResult, giftAcceptedBanner, giftReceivedBanner, listingSoldBanner, swapDoneBanner } from "../components/economy/results.ts";
import { hireBanner, jobResult, landedResult, runnerResult, tableResult } from "../components/underworld/result.ts";
import { holdingOutBanner } from "../components/game/holdingOut.ts";
import type { AssetSale } from "../lib/assetSales.ts";
import type { MarketTrade } from "../lib/marketplace.ts";
import type { UnderworldView } from "../lib/underworld.ts";

const v = (o: Partial<UnderworldView> = {}): UnderworldView => ({
  invited: true, hint: null, rep: 20, tier: { name: "Corner Regular", emoji: "🧍" }, next: { name: "Known Face", at: 35 }, heat: 30,
  heatBand: "warm", offers: [], here: true, holding: false, tooHot: false, lawyer: { on: false, until: null, cost: 400, free: false },
  landed: [], receipts: [], greet: "", intro: null, stats: { jobs: 0, busts: 0, earned: 0 }, crew: [], table: null, ...o,
});

test("gifts: a banner on each side, with crew-friendly handles", () => {
  const sent = giftAcceptedBanner({ id: 1, sku: "x", name: "Kitchen island", price: 1400, status: "accepted", createdAt: "", to: "p", toName: "tasha.b", toStyle: "" });
  assert.equal(sent.rung, 2);
  assert.equal(sent.title, "@tasha.b said yes to the kitchen island");
  const got = giftReceivedBanner({ id: 2, sku: "x", name: "Kitchen island", value: 1400, message: null, createdAt: "", expiresAt: "", from: "p", fromName: "tasha.b", fromStyle: "" });
  assert.equal(got.tag, "Gift from @tasha.b");
  assert.deepEqual(got.rewards, [{ tone: "cash", text: "Worth C$1,400" }]);
});

test("the Market: a sale pays after the fee; a swap lists what you got", () => {
  const sold = listingSoldBanner({ id: 1, itemId: null, sku: "lamp", name: "Floor lamp", emoji: "💡", price: 110, reference: 90, fee: 6, status: "sold", createdAt: "", expiresAt: "", soldAt: "", buyerName: "kai_beats" });
  assert.deepEqual(sold.rewards, [{ tone: "cash", text: "+C$104" }]);
  const item = { id: 3, sku: "blazer", name: "Leather blazer", emoji: "🧥", category: "fashion", reference: 300, side: "a" as const };
  const t: MarketTrade = { id: 9, version: 1, status: "done", mine: "b", createdAt: "", updatedAt: "", expiresAt: "", settledAt: "", with: "p", withName: "tasha.b", withStyle: null,
    you: { items: [], cash: 0, value: 0, ok: true }, them: { items: [item], cash: 50, value: 350, ok: true }, big: false };
  const b = swapDoneBanner(t);
  assert.equal(b.title, "The leather blazer is yours");
  assert.deepEqual(b.rewards?.map((r) => r.text), ["🧥 Leather blazer", "+C$50"]);
});

test("an asset handover: the seller's results card is the price minus the fee; the buyer gets a banner", () => {
  const s: AssetSale = { id: 1, role: "seller", kind: "business", asset: "bodega", label: "Bodega", emoji: "🏪", level: 2, appraisal: 10000, price: 11000, fee: 1100,
    status: "done", reason: null, issues: false, offeredAt: "", expiresAt: "", acceptedAt: "", coolingUntil: "", settledAt: "", closedByMe: false, with: { id: "p", name: "dev.r", style: "" } };
  const c = assetSoldResult(s);
  assert.equal(c.rung, 3);
  assert.equal(c.result?.tone, "win");
  assert.equal(c.result?.amount, 9900);
  assert.equal(c.result?.meter?.need, 10000);
  assert.equal(c.result?.keep?.length, 3);
  assert.equal(c.cta, "Count it");
  assert.equal(assetBoughtBanner({ ...s, role: "buyer" }).rung, 2);
});

test("Pablo's table is a win card; an old job coming back is a near miss, never grey", () => {
  const t = tableResult(v(), { view: v({ rep: 23 }), receipt: "Auntie Bee owes you one. +C$540.", cash: 540 });
  assert.equal(t?.result?.tone, "win");
  assert.equal(t?.result?.amount, 540);
  assert.equal(t?.result?.story, "Auntie Bee owes you one.");
  let bench = 0;
  const l = landedResult({ id: "x", emoji: "🚨", text: "The laptop had a tracker. It cost you C$300 and 2 hours in holding.", fine: 300, holding: 2, day: "" }, v({ heat: 50 }), () => { bench++; });
  assert.equal(l.result?.tone, "warn");
  assert.equal(l.result?.amount, 300);
  assert.equal(l.cta, "Go to the bench");
  l.onCta?.();
  assert.equal(bench, 1);
  assert.equal(landedResult({ id: "y", emoji: "🫡", text: "Tito says it was his van.", fine: 0, holding: 0, day: "" }, v()).result?.stamp?.text, "COVERED");
});

test("runners: the runner's banner carries the cut, a bust is the job's card; the poster hears once it's done", () => {
  const hire = { emoji: "🎃", title: "Pumpkin pivot", withName: "tasha.b" };
  const win = runnerResult(hire, v(), { view: v(), outcome: "win", receipt: "Done.", cut: 238 });
  assert.equal(win?.rung, 2);
  assert.deepEqual(win?.rewards, [{ tone: "cash", text: "+C$238 cut" }]);
  const bust = runnerResult(hire, v(), { view: v({ heat: 50 }), outcome: "bust", receipt: "Busted.", cash: -200, held: 0 });
  assert.equal(bust?.result?.tone, "lose");
  assert.equal(bust?.title, jobResult(undefined, v(), { view: v({ heat: 50 }), outcome: "bust", receipt: "Busted.", cash: -200, held: 0 })?.title);
  const base = { id: 1, job: "j", title: "Pumpkin pivot", emoji: "🎃", cut: 250, fee: 12, day: "", createdAt: "", expiresAt: "", with: "p", withName: "kai_beats", withStyle: null };
  assert.equal(hireBanner({ ...base, status: "offered", outcome: null, pay: 0 }), null);
  assert.deepEqual(hireBanner({ ...base, status: "done", outcome: "win", pay: 400 })?.rewards, [{ tone: "cash", text: "+C$400 Pablo's take" }]);
});

test("leaving holding names how it ended", () => {
  assert.deepEqual(holdingOutBanner("bail", 300).rewards, [{ tone: "cash", text: "Bail C$300" }]);
  assert.equal(holdingOutBanner("bev").tag, "You're out");
  assert.match(holdingOutBanner("time").title, /Time served/);
});
