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
