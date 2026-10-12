import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CITY_ECONOMY, CLUB_EVENTS, PLACES, SHOP_ITEMS, HOME_LOCATIONS,
  citySeed, eventOpen, purchaseClout, realMinutesUntilOpen, sellPrice, visitClout,
} from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";

const sql = readFileSync(new URL("../supabase/migrations/0004_the_city.sql", import.meta.url), "utf8");

test("database city seed matches lib/city.ts (regenerate with scripts/gen-city-seed.ts)", () => {
  const m = sql.match(/\('city', '((?:[^']|'')*)'::jsonb\)/);
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

import { actionAvailability, billStatusLine, netWorth } from "../lib/cityState.ts";
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
