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
  assert.equal(visitClout(16, 50, 50), 9);
  assert.equal(visitClout(140, 50, 50), 40);
  assert.equal(purchaseClout(25, 1), 21);
  assert.equal(sellPrice(145), 87);
  assert.ok(visitClout(210, 100, 100) > visitClout(210, 0, 0));
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

import { actionAvailability, billStatusLine, billProgress, netWorth, upcomingBills } from "../lib/cityState.ts";
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
  const bill = { id: 1, kind: "rent" as const, amount: 600, due_date: "2026-10-01", status: "due" as const, paid_at: null };
  assert.equal(billStatusLine(bill, "2026-09-29"), "Due in 2 days");
  assert.equal(billStatusLine(bill, "2026-10-01"), "Due today");
  assert.match(billStatusLine(bill, "2026-10-03"), /Grace period/);
  assert.match(billStatusLine(bill, "2026-10-04"), /Mood is dropping; you move out in 3 days/);
});

test("the preview simulator follows the same clout and resale rules", async () => {
  const api = createSimApi(sampleCityState({ mood: 50, confidence: 50, purchases_count: 0 }));
  assert.equal((await api.doAction("lucky-seven-deli", "eat")).ok, false, "v0.8: no spending before arriving");
  const ride = await api.travel!("lucky-seven-deli", "subway");
  assert.ok(ride.ok && ride.gain?.cash === -6, "the subway is C$6");
  const meal = await api.doAction("lucky-seven-deli", "eat");
  assert.ok(meal.ok && meal.gain?.clout === 9);
  const again = await api.doAction("lucky-seven-deli", "eat");
  assert.ok(again.ok && again.gain?.clout === 0);
  const buy = await api.buyItem("fit-varsity-tee", "buy");
  assert.ok(buy.ok && buy.gain?.clout === 10);
  const tee = buy.ok ? buy.state.items.find((i) => i.sku === "fit-varsity-tee")! : null;
  const sold = await api.sellItem(tee!.id);
  assert.ok(sold.ok && sold.gain?.cash === 87 && netWorth(sold.state) > 0);
});

test("v0.11 recalibration: money stays tight, so there's always a reason to earn more (owner, Oct 14)", () => {
  const rent = (id: string) => ECONOMY.homes.find((h) => h.id === id)!.rent;
  const rents = [rent("astoria_studio"), rent("jackson_heights_1br"), rent("lic_highrise")];
  const { shiftRate, shiftsPerDay, shiftEnergy, gigs, bills, dailyTasks } = CITY_ECONOMY;
  assert.equal(bills.every, "7 days");
  // A full work day: every shift allowed plus the daily tasks and their bonus (no gigs).
  const fullDay = shiftsPerDay * shiftRate + dailyTasks.count * (dailyTasks.rewardMin + dailyTasks.rewardMax) / 2 + dailyTasks.bonus;
  assert.ok(shiftsPerDay * shiftEnergy <= 100, "a work day fits in one day's Energy");
  assert.ok(fullDay < rents[0] / 2, `a full day (${fullDay}) doesn't cover half a week in the studio`);
  assert.ok(5 * fullDay > rents[0] + bills.phone, "five full days cover the studio and the phone");
  assert.ok(5 * fullDay < rents[2], "the high-rise needs gigs, not just shifts");
  assert.ok(gigs.big.payMax * shiftRate < rents[1], "no single gig pays a week in the 1BR");
  assert.ok(bills.evictAfterDays < 7, "the move happens before next week's rent");
});

import { collectorValue } from "../lib/city.ts";

test("collector pieces: real cash only, never sold, valued at 1.5x the priciest item", async () => {
  assert.equal(collectorValue("fashion"), 1388);
  for (const i of SHOP_ITEMS.filter((x) => x.collector)) assert.equal(i.price, 0, `${i.sku} has no virtual price`);
  const sim = createSimApi(sampleCityState());
  const r = await sim.buyItem("col-faux-chinchilla", "buy");
  assert.equal(r.ok, false, "virtual cash can't buy it");
  sim.grantCollector("col-faux-chinchilla");
  const s = await sim.refresh();
  assert.ok(s.ok);
  const piece = s.state.items.find((i) => i.sku === "col-faux-chinchilla")!;
  assert.equal(piece.value, 1388);
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
    { kind: "car_rental", amount: 525, due_date: "2026-10-18" },
    { kind: "rent", amount: 1750, due_date: "2026-10-20" },
  ]);
  const owner = sampleCityState({ house_sku: "house-x", next_phone_due: "2026-10-16", car_sku: "car-hatchback", car_mode: "owned", next_car_due: "2026-10-30" });
  assert.deepEqual(upcomingBills(owner).map((b) => [b.kind, b.amount]), [["phone", 60], ["car_insurance", 105]]);
});

test("a coming bill's bar fills as its due date nears", () => {
  const today = "2026-10-13";
  assert.equal(billProgress({ kind: "phone", amount: 25, due_date: "2026-10-20" }, today), 0);
  assert.equal(billProgress({ kind: "rent", amount: 600, due_date: "2026-10-16" }, today), 4 / 7);
  assert.equal(billProgress({ kind: "car_rental", amount: 350, due_date: "2026-10-13" }, today), 1);
});

test("every piece of clothing in the Shop can be worn, real-cash pieces included (#15)", () => {
  for (const i of SHOP_ITEMS.filter((x) => x.category === "fashion")) assert.ok(i.wear, i.sku);
});

test("v0.11: three shifts a day across every job, in the preview too (owner, Oct 14)", async () => {
  const sim = createSimApi(sampleCityState({ energy: 100, bank_cash: 1000 }));
  await sim.travel!("grind-and-gossip", "subway");
  for (let i = 0; i < CITY_ECONOMY.shiftsPerDay; i++) {
    const r = await sim.doAction("grind-and-gossip", "shift");
    assert.ok(r.ok, `shift ${i + 1}`);
  }
  const fourth = await sim.doAction("grind-and-gossip", "shift");
  assert.equal(fourth.ok, false);
  assert.match(fourth.ok ? "" : fourth.error, /shifts today/);
});
