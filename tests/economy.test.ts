import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ECONOMY, TRAITS, canAfford, lotteryLine } from "../lib/economy.ts";

const sql = readFileSync(new URL("../supabase/migrations/0003_first_party.sql", import.meta.url), "utf8");
const seed = (key: string) => {
  const m = sql.match(new RegExp(`\\('${key}', '([\\s\\S]*?)'::jsonb\\)`));
  assert.ok(m, `seed for ${key}`);
  return JSON.parse(m[1]);
};

test("database economy seed matches lib/economy.ts", () => {
  const db = seed("economy");
  const { homes, ...rest } = ECONOMY;
  const { homes: dbHomes, ...dbRest } = db;
  assert.deepEqual(dbRest, rest);
  assert.deepEqual(dbHomes, homes.map((h) => ({ id: h.id, rent: h.rent })));
});

test("database trait ids match lib/economy.ts", () => {
  assert.deepEqual(seed("trait_ids"), TRAITS.map((t) => t.id));
});

test("the minimum roll always covers the cheapest home, the phone bill and the party", () => {
  const cheapest = [...ECONOMY.homes].sort((a, b) => a.rent - b.rent)[0];
  assert.equal(canAfford(cheapest, ECONOMY.birthLottery.min), true);
});

test("the priciest home is out of reach on a low roll, so the rule matters", () => {
  const priciest = [...ECONOMY.homes].sort((a, b) => b.rent - a.rent)[0];
  assert.equal(canAfford(priciest, ECONOMY.birthLottery.min), false);
  assert.equal(canAfford(priciest, ECONOMY.birthLottery.max), true);
});

test("the first party is net positive and the lottery lines cover the range", () => {
  assert.ok(ECONOMY.firstParty.cashReward > ECONOMY.firstParty.entry);
  for (let c = ECONOMY.birthLottery.min; c <= ECONOMY.birthLottery.max; c += ECONOMY.birthLottery.step) assert.ok(lotteryLine(c).length > 0);
});
