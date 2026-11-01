import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSET_SALES, appraiseBusiness, appraiseHouse, assetError, blockLine, coolingLine, priceChips, saleFeeLine, saleResultLine,
  type AssetSale,
} from "../lib/assetSales.ts";
import { SHOP_ITEMS } from "../lib/city.ts";
import { FLAG_COPY, PHASE_COPY, PLAYER_ECONOMY, historyLine, priceBand, type EconomyRow } from "../lib/playerEconomy.ts";
import { PUSH_KINDS } from "../lib/push.ts";

const sql = readFileSync(new URL("../supabase/migrations/0153_asset_sales.sql", import.meta.url), "utf8");

test("lib/assetSales.ts mirrors game_settings 'asset_sales' in migration 0153", () => {
  const m = sql.match(/values \('asset_sales', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(ASSET_SALES)));
});

test("the owner's placeholders (docs/PLAYER-ECONOMY.md section 6)", () => {
  assert.equal(ASSET_SALES.coolingHours, 24);
  assert.equal(ASSET_SALES.minOwnDays, 14);
  assert.equal(PLAYER_ECONOMY.fees.asset, 0.1);
  assert.equal(PLAYER_ECONOMY.phases.assets, false, "the assets switch starts off");
  assert.ok(PHASE_COPY.assets.built, "the Studio knows phase 3 is built");
  assert.ok(FLAG_COPY.asset_new_buyer, "the new-buyer flag has words");
  assert.ok(sql.includes("'asset_new_buyer'"));
});

test("every house in the Shop has a neighborhood in the appraisal", () => {
  const houses = SHOP_ITEMS.filter((i) => i.category === "houses");
  assert.ok(houses.length > 0);
  for (const h of houses) {
    assert.equal(ASSET_SALES.house.where[h.sku], h.neighborhood, h.sku);
    assert.ok(ASSET_SALES.house.neighborhoods[h.neighborhood!], h.neighborhood);
  }
  assert.deepEqual(Object.keys(ASSET_SALES.house.where).sort(), houses.map((h) => h.sku).sort());
});

test("appraisals match the SQL scenario (supabase/tests/asset_sales.test.sql)", () => {
  assert.equal(appraiseBusiness("hot-dog-cart", 1), 7675);
  assert.equal(appraiseBusiness("hot-dog-cart", 1, { price: 7000, level: 1 }), 7475, "what the owner paid a player counts");
  assert.equal(appraiseBusiness("bodega", 0), 48_400);
  assert.equal(priceBand(48_400).max, 72_600);
  assert.equal(appraiseHouse("house-astoria-townhouse"), 270_000);
  assert.equal(appraiseHouse("house-lic-penthouse"), Math.round(975_000 * 1.1));
  assert.equal(appraiseBusiness("nope", 0), 0);
});

test("the fee up front, the chips inside the band", () => {
  assert.equal(saleFeeLine(7000), "You get C$6,300 after the 10% city fee.");
  for (const v of [5050, 48_400, 270_000, 5_220_000]) {
    const b = priceBand(v);
    for (const c of priceChips(v)) assert.ok(c >= b.min && c <= b.max, `${v}: ${c}`);
  }
});

test("cooling-off and results in words", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.equal(coolingLine("2026-11-02T11:00:00Z", now), "Keys change hands in 23 h");
  assert.equal(coolingLine("2026-11-01T12:30:00Z", now), "Keys change hands in 30 min");
  assert.match(blockLine({ block: "too_soon", sellableFrom: "2026-11-04T12:00:00Z", kind: "business" }, now)!, /in 3 days/);
  assert.equal(blockLine({ block: null, sellableFrom: "", kind: "house" }), null);
  const s = { role: "seller", status: "done", price: 7000, fee: 700, with: { id: "x", name: "boboo", style: "" }, closedByMe: false } as AssetSale;
  assert.equal(saleResultLine(s), "Sold to @boboo. C$6,300 landed after the city's cut.");
});

test("refusals in words", () => {
  for (const code of ["phase_off", "out_of_band", "too_soon", "went_public", "sales_limit", "buy_limit", "they_cant_buy", "business_locked", "sale_gone", "they_own_it", "you_own_it", "sale_changed", "they_cant_move"]) {
    assert.notEqual(assetError(code), "That didn't work. Try again.", code);
  }
  assert.match(assetError("weekly_limit"), /weekly limit/, "the core's words for the core's limits");
  // Every code the migration raises has words.
  for (const m of sql.matchAll(/raise exception '([a-z_]+)'/g)) {
    // Internal or Studio-only codes, and buy_business / upgrade_business (lib/businesses.ts businessError has those).
    if (["bad_kind", "no_player", "unknown_sale", "cant_reverse", "unknown_business", "max_level"].includes(m[1])) continue;
    assert.notEqual(assetError(m[1]), "That didn't work. Try again.", m[1]);
  }
});

test("history shows sales to both sides", () => {
  const row = (direction: "sent" | "received"): EconomyRow => ({
    id: 1, kind: "asset", ref: "asset:1", label: "Dirty Water Dogs", value: 7000, fee: 700, cash: false, status: "done",
    at: "2026-11-01T00:00:00Z", direction, with: "x", withName: "boboo", withStyle: null,
  });
  assert.deepEqual(historyLine(row("received")), { emoji: "🔑", title: "Sold to @boboo · Dirty Water Dogs", amount: "+C$6,300", note: "C$700 city fee" });
  assert.equal(historyLine(row("sent")).title, "Bought from @boboo · Dirty Water Dogs");
  assert.equal(historyLine(row("sent")).amount, "−C$7,000");
});

test("pushes the migration queues are known kinds", () => {
  for (const k of sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(k[1] in PUSH_KINDS, k[1]);
});

// Migration 0155 (owner, Nov 1): asset sales skip the weekly cap, inside a tighter band.
import { ASSET_BAND, assetBand } from "../lib/assetSales.ts";
test("ASSET_BAND mirrors game_settings 'asset_sales'.band in migration 0155", () => {
  const sql0155 = readFileSync(new URL("../supabase/migrations/0155_asset_cap_rent_alarm.sql", import.meta.url), "utf8");
  const m = sql0155.match(/value \|\| '(\{"band":.*?\})'::jsonb/);
  assert.ok(m, "the band update");
  assert.deepEqual(JSON.parse(m![1]).band, { ...ASSET_BAND });
  assert.deepEqual(assetBand(300_000), { min: 240_000, max: 360_000 });
});
