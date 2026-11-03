import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STREAK_REPAIR, repairCash } from "../lib/streakRepair.ts";
import { PUSH_KINDS } from "../lib/push.ts";

const sql = readFileSync(new URL("../supabase/migrations/0158_streak_repair.sql", import.meta.url), "utf8");

test("game_settings 'streak_repair' matches the client's numbers", () => {
  const m = sql.match(/\('streak_repair', '(\{.*?\})'::jsonb\)/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m![1]), STREAK_REPAIR);
});

test("the repair costs C$20 a day up to C$1,500", () => {
  assert.equal(repairCash(3), 60);
  assert.equal(repairCash(42), 840);
  assert.equal(repairCash(200), 1500);
});

test("every push the migration sends is a known kind", () => {
  for (const k of sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(PUSH_KINDS[k[1]], k[1]);
});

test("real money never repairs a streak on its own", () => {
  assert.match(sql, /method in \('earn', 'cash', 'pass', 'vip'\)/);
  assert.doesNotMatch(sql, /store_products|start_purchase/);
});
