import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FLAG_COPY, PLAYER_ECONOMY, afterFee, economyError, economyFee, feeLine, historyLine, inBand, isGiftable, priceBand, uncountedFor, weeklyCap,
  type EconomyRow,
} from "../lib/playerEconomy.ts";
import { PUSH_KINDS } from "../lib/push.ts";

const sql = readFileSync(new URL("../supabase/migrations/0151_player_economy.sql", import.meta.url), "utf8");

test("lib/playerEconomy.ts mirrors game_settings 'player_economy' in migration 0151", () => {
  const m = sql.match(/values \('player_economy', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(PLAYER_ECONOMY)));
});

test("the owner's defaults (Oct 31)", () => {
  assert.deepEqual(PLAYER_ECONOMY.phases, { gifting: true, marketplace: false, assets: false });
  assert.deepEqual(PLAYER_ECONOMY.unlock, { minAccountDays: 3, minRank: 2 });
  assert.equal(PLAYER_ECONOMY.fees.job, 0.05);
  assert.equal(PLAYER_ECONOMY.fees.sale, 0.05);
  assert.equal(PLAYER_ECONOMY.fees.asset, 0.1);
  assert.equal(PLAYER_ECONOMY.fees.gift, 0);
  assert.equal(PLAYER_ECONOMY.noResaleDays, 14);
  assert.deepEqual(priceBand(1000), { min: 500, max: 1500 });
  for (const p of Object.values(PLAYER_ECONOMY.kinds)) assert.ok(p in PLAYER_ECONOMY.phases, p);
});

test("the fee, shown up front", () => {
  assert.equal(economyFee("job", 1000), 50);
  assert.equal(afterFee("job", 1000), 950);
  assert.equal(economyFee("job", 150), 7, "floored, like economy_fee");
  assert.equal(economyFee("asset", 10_000), 1000);
  assert.equal(feeLine("job", 1000), "You get C$950 after the 5% city fee.");
  assert.match(feeLine("gift", 1000), /full C\$1,000/);
});

test("the weekly cap and the net-worth cap", () => {
  assert.equal(weeklyCap(0), 5000, "C$5,000 at least");
  assert.equal(weeklyCap(80_000), 10_000, "half of a week's earnings");
  assert.equal(uncountedFor(9500), 4500);
  assert.equal(uncountedFor(3000), 0);
});

test("price bands", () => {
  assert.ok(inBand(1000, 500) && inBand(1000, 1500));
  assert.ok(!inBand(1000, 499) && !inBand(1000, 1501) && !inBand(0, 0));
});

test("what can be gifted", () => {
  assert.ok(isGiftable({ price: 650, category: "home" }));
  assert.ok(isGiftable({ price: 460, category: "fashion" }));
  assert.ok(!isGiftable({ price: 2000, category: "fashion", collector: true }), "never real money");
  assert.ok(!isGiftable({ price: 300, category: "home", reward: true }), "never streak rewards");
  assert.ok(!isGiftable({ price: 300, category: "fashion", storyOnly: true }), "never story pieces");
  assert.ok(!isGiftable({ price: 9000, category: "cars" }) && !isGiftable({ price: 90_000, category: "houses" }));
});

test("every automatic flag the SQL writes has owner copy", () => {
  const rules = [...sql.matchAll(/economy_flag\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(rules.length >= 4);
  for (const r of rules) assert.ok(r in FLAG_COPY, r);
});

test("every push kind the economy sends is known", () => {
  const kinds = [...sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(kinds.length >= 3);
  for (const k of kinds) assert.ok(k in PUSH_KINDS, k);
});

test("history lines and errors read as words", () => {
  const row: EconomyRow = { id: 1, kind: "job", ref: "job:1", label: "Errands: 2 check-ins", value: 1000, fee: 50, cash: true, status: "done", at: "", direction: "received", with: "x", withName: "tasha.b", withStyle: null };
  assert.deepEqual(historyLine(row), { emoji: "💼", title: "Worked for @tasha.b · Errands: 2 check-ins", amount: "+C$950", note: "C$50 city fee" });
  assert.equal(historyLine({ ...row, kind: "gift", direction: "sent", cash: false, fee: 0, label: "Kitchen island", status: "reversed" }).note, "Sent back");
  for (const code of ["weekly_limit", "their_weekly_limit", "too_new", "economy_locked", "economy_frozen", "phase_off", "not_friends", "not_giftable", "no_resale", "gift_limit"]) {
    assert.notEqual(economyError(code), "That didn't work. Try again.", code);
  }
});
