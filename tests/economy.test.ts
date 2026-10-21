import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ECONOMY, moveCost, topAstoriaRent, TRAITS, canAfford, formatCash, formatCashShort, formatShort, lotteryLine } from "../lib/economy.ts";
import { formatPrice } from "../lib/store.ts";

const sql = readFileSync(new URL("../supabase/migrations/0003_first_party.sql", import.meta.url), "utf8");
const seed = (key: string) => {
  const m = sql.match(new RegExp(`\\('${key}', '([\\s\\S]*?)'::jsonb\\)`));
  assert.ok(m, `seed for ${key}`);
  return JSON.parse(m[1]);
};

// The newest migration that writes the 'economy' setting (0003 seeded it; 0028 made bills weekly).
const latestEconomy = () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().reverse()) {
    const text = readFileSync(new URL(f, dir), "utf8");
    const m = text.match(/set value = '(\{[^']*)'::jsonb, updated_at = now\(\) where key = 'economy'/) ?? text.match(/\('economy', '([\s\S]*?)'::jsonb\)/);
    if (m) return JSON.parse(m[1]);
  }
  assert.fail("no economy seed");
};

test("database economy seed matches lib/economy.ts", () => {
  const db = latestEconomy();
  const { homes, ...rest } = ECONOMY;
  const { homes: dbHomes, ...dbRest } = db;
  assert.deepEqual(dbRest, rest);
  // The server keeps each home's id and rent, and the moving-up rules (#19, migration 0045).
  assert.deepEqual(dbHomes, homes.map((h) => ({
    id: h.id, rent: h.rent, ...(h.moveClout ? { moveClout: h.moveClout } : {}), ...(h.signup === false ? { signup: false } : {}), ...(h.campus ? { campus: h.campus } : {}),
    ...(h.roommate ? { roommate: h.roommate } : {}), ...(h.couture ? { couture: h.couture } : {}),
  })));
});

test("the Waterfront Mansion's upkeep is the priciest Astoria rent", () => {
  const mansion = ECONOMY.homes.find((h) => h.couture === "waterfront-mansion")!;
  assert.equal(mansion.rent, topAstoriaRent());
  assert.equal(mansion.signup, false, "never offered at sign-up");
  assert.equal(moveCost(mansion), mansion.rent, "no broker fee to move into your own mansion");
});

test("database trait ids match lib/economy.ts", () => {
  assert.deepEqual(seed("trait_ids"), TRAITS.map((t) => t.id));
});

test("the minimum roll always covers the cheapest home, the phone bill and the party", () => {
  const cheapest = [...ECONOMY.homes].sort((a, b) => a.rent - b.rent)[0];
  assert.equal(canAfford(cheapest, ECONOMY.birthLottery.min), true);
});

test("with weekly rent (v0.8), even the lowest roll covers a first week anywhere", () => {
  for (const h of ECONOMY.homes) assert.equal(canAfford(h, ECONOMY.birthLottery.min), true, h.id);
  assert.equal(canAfford(ECONOMY.homes[2], 1000), false, "the rule still guards a broke player");
});

test("the first party is net positive and the lottery lines cover the range", () => {
  assert.ok(ECONOMY.firstParty.cashReward > ECONOMY.firstParty.entry);
  for (let c = ECONOMY.birthLottery.min; c <= ECONOMY.birthLottery.max; c += ECONOMY.birthLottery.step) assert.ok(lotteryLine(c).length > 0);
});

test("virtual cash is always C$; real money stays $", () => {
  assert.equal(formatCash(2100), "C$2,100");
  assert.equal(formatCash(84.6), "C$85");
  assert.equal(formatPrice(299), "$2.99");
  assert.equal(formatCashShort(9_999), "C$9,999");
  assert.equal(formatCashShort(12_480), "C$12.5K");
  assert.equal(formatCashShort(999_400), "C$999K");
  assert.equal(formatCashShort(999_600), "C$1M");
  assert.equal(formatCashShort(125_450), "C$125K");
  assert.equal(formatCashShort(1_250_450), "C$1.25M");
  assert.equal(formatCashShort(42_000_000), "C$42M");
  assert.equal(formatShort(123_456), "123K");
  assert.equal(formatShort(850), "850");
});

test("no screen writes a bare $ before a virtual amount (use formatCash)", () => {
  const files = ["components", "app"].flatMap((d) =>
    (readdirSync(new URL(`../${d}/`, import.meta.url), { recursive: true }) as string[])
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => `../${d}/${f}`));
  for (const f of files) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    // `$${x}` in a template string, or $ right before {x} in JSX text.
    assert.doesNotMatch(text, /(?<!C)\$\$\{|>\s*\$\{/, f);
  }
});
