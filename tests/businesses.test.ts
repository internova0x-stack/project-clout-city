import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESSES, businessById, businessValue, businessesValue, canGoPublic, hype, money, nextBusiness, payPerDay, tillFull, tillNow, upgradeCost,
  type OwnedBusiness,
} from "../lib/businesses.ts";
import { CITY_ECONOMY } from "../lib/city.ts";
import { RANKS, rankFor } from "../lib/ranks.ts";

const B = CITY_ECONOMY.businesses;

test("businesses: eight, each dearer and slower to pay back than the last, three upgrades each", () => {
  assert.equal(BUSINESSES.length, 8);
  BUSINESSES.forEach((b, i) => {
    assert.equal(b.upgrades.length, 3, b.id);
    if (i) {
      const prev = BUSINESSES[i - 1];
      assert.ok(b.price > prev.price, b.id);
      assert.ok(b.price / b.payPerDay > prev.price / prev.payPerDay, `${b.id} pays back slower`);
    }
  });
  assert.equal(BUSINESSES[0].price, 5_000, "the first is affordable with the birth lottery");
});

test("businesses: pay, upgrades, hype and worth", () => {
  const cafe = businessById("cafe")!;
  assert.equal(payPerDay(cafe, 0), 81_600);
  assert.equal(payPerDay(cafe, 3), 81_600 * 2.5);
  assert.equal(upgradeCost(cafe), 720_000);
  assert.equal(hype(0), 1);
  assert.equal(hype(75_000), 1.5);
  assert.equal(hype(1_000_000), 2);
  assert.equal(businessValue(cafe, 0, false, 0), 1_200_000);
  assert.equal(businessValue(cafe, 2, false, 150_000), 1_200_000 * 2 * 2);
  const startup = businessById("startup")!;
  assert.equal(businessValue(startup, 3, true, 0), 700_000_000 * 2.5 * 3, "going public triples it");
  const owned: OwnedBusiness[] = [{ id: "hot-dog-cart", level: 1, public: false, collectedAt: "" }, { id: "bodega", level: 0, public: false, collectedAt: "" }];
  assert.equal(businessesValue(owned, 0), 7_500 + 50_000);
});

test("businesses: the till fills by the hour and stops after two days", () => {
  const cart = businessById("hot-dog-cart")!;
  const t0 = "2026-10-15T12:00:00Z";
  assert.equal(tillNow(cart, 0, t0, "2026-10-15T18:00:00Z"), 187, "six hours: a quarter of C$750");
  assert.equal(tillNow(cart, 0, t0, "2026-10-17T12:00:00Z"), 1_500);
  assert.equal(tillNow(cart, 0, t0, "2026-10-20T12:00:00Z"), 1_500, "full after two days");
  assert.ok(!tillFull(t0, "2026-10-17T11:00:00Z"));
  assert.ok(tillFull(t0, "2026-10-17T12:00:00Z"));
});

test("businesses: bought in order; going public needs the startup maxed and the clout", () => {
  assert.equal(nextBusiness([])!.id, "hot-dog-cart");
  assert.equal(nextBusiness([{ id: "hot-dog-cart", level: 0, public: false, collectedAt: "" }])!.id, "bodega");
  assert.equal(nextBusiness(BUSINESSES.map((b) => ({ id: b.id, level: 0, public: false, collectedAt: "" }))), null);
  const startup = (level: number, pub = false): OwnedBusiness[] => [{ id: "startup", level, public: pub, collectedAt: "" }];
  assert.ok(!canGoPublic(startup(2), 60_000));
  assert.ok(!canGoPublic(startup(3), 40_000));
  assert.ok(canGoPublic(startup(3), 50_000));
  assert.ok(!canGoPublic(startup(3, true), 60_000));
});

test("money: short for big numbers", () => {
  assert.equal(money(5_000), "C$5,000");
  assert.equal(money(1_200_000), "C$1.2M");
  assert.equal(money(700_000_000), "C$700M");
  assert.equal(money(10_000_000_000), "C$10B");
  assert.equal(money(1_842_300), "C$1.84M");
});

/**
 * The pace (owner, Oct 15: "billionaire means billionaire", about 9 months): a steady player collects once
 * a day, makes C$800 a day besides (gigs and shifts, after rent) and 180 clout, and buys the best thing it
 * can afford: the next business or an upgrade.
 */
function simulate(side = 800, cloutPerDay = 180, days = 450) {
  let cash = 7_500, clout = 0;
  const owned: OwnedBusiness[] = [];
  const hit: Record<number, number> = {};
  for (let d = 1; d <= days; d++) {
    clout += cloutPerDay;
    cash += side;
    for (const o of owned) cash += payPerDay(businessById(o.id)!, o.level);
    for (;;) {
      const opts: { cost: number; gain: number; act: () => void }[] = [];
      const next = nextBusiness(owned);
      if (next) opts.push({ cost: next.price, gain: next.payPerDay, act: () => owned.push({ id: next.id, level: 0, public: false, collectedAt: "" }) });
      for (const o of owned) {
        const b = businessById(o.id)!;
        if (o.level < 3) opts.push({ cost: upgradeCost(b), gain: b.payPerDay * B.upgrade.pay, act: () => { o.level++; } });
      }
      if (canGoPublic(owned, clout)) opts.push({ cost: B.goPublic.fee, gain: 1, act: () => { owned.find((o) => o.id === "startup")!.public = true; } });
      const ok = opts.filter((x) => x.cost <= cash).sort((a, b) => b.gain / b.cost - a.gain / a.cost);
      if (!ok.length) break;
      cash -= ok[0].cost;
      ok[0].act();
    }
    const nw = cash + businessesValue(owned, clout);
    for (const m of [1e6, 1e7, 1e9, 1e10]) if (!hit[m] && nw >= m) hit[m] = d;
  }
  return hit;
}

test("businesses: a steady player is a millionaire in about 2 months and a billionaire in about 9", () => {
  const hit = simulate();
  assert.ok(hit[1e6] >= 40 && hit[1e6] <= 75, `C$1M on day ${hit[1e6]}`);
  assert.ok(hit[1e7] >= 85 && hit[1e7] <= 130, `C$10M on day ${hit[1e7]}`);
  assert.ok(hit[1e9] >= 240 && hit[1e9] <= 300, `C$1B on day ${hit[1e9]}`);
  assert.ok(hit[1e10] >= 330, `C$10B (God Status) on day ${hit[1e10]}`);
  assert.equal(rankFor(0, 1e9).title, RANKS[8].title);
});
