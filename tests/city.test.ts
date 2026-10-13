import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  CITY_ECONOMY, CLUB_EVENTS, PLACES, SHOP_ITEMS, HOME_LOCATIONS,
  citySeed, eventOpen, purchaseClout, realMinutesUntilOpen, sellPrice, visitClout,
} from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";

// The newest migration that writes the 'city' seed must match lib/city.ts.
const migrations = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort();
const seedSql = migrations
  .map((f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"))
  .filter((t) => /'city'/.test(t) && /\{"economy"/.test(t))
  .at(-1)!;

test("latest database city seed matches lib/city.ts (regenerate with scripts/gen-city-seed.ts)", () => {
  const m = seedSql.match(/'(\{"economy"(?:[^']|'')*)'::jsonb/);
  assert.ok(m, "city seed");
  assert.deepEqual(JSON.parse(m[1].replaceAll("''", "'")), JSON.parse(JSON.stringify(citySeed())));
});

test("ids are unique and every place has a map home", () => {
  const unique = (xs: string[]) => new Set(xs).size === xs.length;
  assert.ok(unique(PLACES.map((p) => p.id)));
  assert.ok(unique(SHOP_ITEMS.map((i) => i.sku)));
  assert.ok(unique(CLUB_EVENTS.map((e) => e.id)));
  for (const e of CLUB_EVENTS) assert.ok(PLACES.some((p) => p.id === e.placeId), e.id);
  for (const h of ECONOMY.homes) assert.ok(HOME_LOCATIONS[h.id], h.id);
});

test("clout formulas match the server", () => {
  assert.equal(visitClout(7, 50, 50), 9);
  assert.equal(visitClout(60, 50, 50), 41);
  assert.equal(purchaseClout(25, 1), 21);
  assert.equal(sellPrice(65), 39);
  assert.ok(visitClout(95, 100, 100) > visitClout(95, 0, 0));
});

test("event doors follow the city clock, including past midnight", () => {
  const neon = CLUB_EVENTS.find((e) => e.id === "neon-nights")!;
  assert.equal(eventOpen(neon, 23 * 60), true);
  assert.equal(eventOpen(neon, 2 * 60), true);
  assert.equal(eventOpen(neon, 3 * 60), false);
  assert.equal(realMinutesUntilOpen(neon, 21 * 60), 5);
});

test("the phone bill agrees between v0.2 and v0.3 settings", () => {
  assert.equal(CITY_ECONOMY.bills.phone, ECONOMY.phoneBill);
});

import { actionAvailability, billStatusLine, netWorth, upcomingBills } from "../lib/cityState.ts";
import { createSimApi, sampleCityState } from "../lib/citySim.ts";

test("availability explains why an action is off", () => {
  const s = sampleCityState({ energy: 5, bank_cash: 3 });
  const club = PLACES.find((p) => p.id === "velvet-static")!;
  const deli = PLACES.find((p) => p.id === "lucky-seven-deli")!;
  assert.deepEqual(actionAvailability(club.id, club.actions[0], s), { ok: false, reason: "Not enough Energy" });
  assert.deepEqual(actionAvailability(deli.id, deli.actions[0], s), { ok: false, reason: "Not enough cash" });
  const fed = sampleCityState();
  fed.visitsToday[deli.id] = 1;
  assert.deepEqual(actionAvailability(deli.id, deli.actions[0], fed), { ok: true, note: "Clout again tomorrow" });
});

test("rent lines walk through grace, Mood drop and moving out", () => {
  const bill = { id: 1, kind: "rent" as const, amount: 2100, due_date: "2026-10-01", status: "due" as const, paid_at: null };
  assert.equal(billStatusLine(bill, "2026-09-29"), "Due in 2 days");
  assert.equal(billStatusLine(bill, "2026-10-01"), "Due today");
  assert.match(billStatusLine(bill, "2026-10-03"), /Grace period/);
  assert.match(billStatusLine(bill, "2026-10-05"), /move out in 3 days/);
});

test("the preview simulator follows the same clout and resale rules", async () => {
  const api = createSimApi(sampleCityState({ mood: 50, confidence: 50, purchases_count: 0 }));
  const meal = await api.doAction("lucky-seven-deli", "eat");
  assert.ok(meal.ok && meal.gain?.clout === 9);
  const again = await api.doAction("lucky-seven-deli", "eat");
  assert.ok(again.ok && again.gain?.clout === 0);
  const buy = await api.buyItem("fit-varsity-tee", "buy");
  assert.ok(buy.ok && buy.gain?.clout === 10);
  const tee = buy.ok ? buy.state.items.find((i) => i.sku === "fit-varsity-tee")! : null;
  const sold = await api.sellItem(tee!.id);
  assert.ok(sold.ok && sold.gain?.cash === 39 && netWorth(sold.state) > 0);
});

test("1 to 2 gigs cover a month's rent on the cheapest home", () => {
  const cheapest = Math.min(...ECONOMY.homes.map((h) => h.rent));
  const { shiftRate, gigs } = CITY_ECONOMY;
  assert.ok(2 * gigs.pro.payMin * shiftRate >= cheapest * 0.9, "two pro gigs");
  assert.ok(gigs.big.payMax * shiftRate >= cheapest, "one big break");
  assert.equal(CITY_ECONOMY.bills.every, "1 month");
});

import { collectorValue } from "../lib/city.ts";

test("collector pieces: real cash only, never sold, valued at 1.5x the priciest item", async () => {
  assert.equal(collectorValue("fashion"), 630);
  for (const i of SHOP_ITEMS.filter((x) => x.collector)) assert.equal(i.price, 0, `${i.sku} has no virtual price`);
  const sim = createSimApi(sampleCityState());
  const r = await sim.buyItem("col-faux-chinchilla", "buy");
  assert.equal(r.ok, false, "virtual cash can't buy it");
  sim.grantCollector("col-faux-chinchilla");
  const s = await sim.refresh();
  assert.ok(s.ok);
  const piece = s.state.items.find((i) => i.sku === "col-faux-chinchilla")!;
  assert.equal(piece.value, 630);
  assert.equal((await sim.sellItem(piece.id)).ok, false, "can't be sold");
});

test("every monument has a postcard and every shopping place opens a Shop category", () => {
  for (const p of PLACES.filter((x) => x.category === "monument")) assert.ok(p.postcard, p.id);
  for (const p of PLACES.filter((x) => x.category === "shopping")) assert.ok(p.opensShop, p.id);
});

test("upcoming bills show each amount and date, including the phone bill (#22)", () => {
  const s = sampleCityState({ home_id: "astoria_studio", next_rent_due: "2026-10-20", next_phone_due: "2026-10-16", car_sku: "car-hatchback", car_mode: "rented", next_car_due: "2026-10-18" });
  assert.deepEqual(upcomingBills(s), [
    { kind: "phone", amount: CITY_ECONOMY.bills.phone, due_date: "2026-10-16" },
    { kind: "car_rental", amount: 350, due_date: "2026-10-18" },
    { kind: "rent", amount: 2100, due_date: "2026-10-20" },
  ]);
  const owner = sampleCityState({ house_sku: "house-x", next_phone_due: "2026-10-16", car_sku: "car-hatchback", car_mode: "owned", next_car_due: "2026-10-30" });
  assert.deepEqual(upcomingBills(owner).map((b) => [b.kind, b.amount]), [["phone", 85], ["car_insurance", 280]]);
});
