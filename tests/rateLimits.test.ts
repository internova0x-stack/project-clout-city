import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { RATE_LIMITS, isRateLimited } from "../lib/rateLimits.ts";

const dir = new URL("../supabase/migrations/", import.meta.url);
const sql = readFileSync(new URL("0126_rate_limits.sql", dir), "utf8");

test("lib/rateLimits.ts mirrors game_settings 'rate_limits' in migration 0126", () => {
  const m = sql.match(/values \('rate_limits', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(RATE_LIMITS)));
});

test("every limited function exists", () => {
  const all = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  for (const b of Object.values(RATE_LIMITS.buckets)) {
    for (const fn of b.rpc) assert.match(all, new RegExp(`function public\\.${fn}\\(`), fn);
  }
});

test("only the database's 429s count, not Supabase Auth's", () => {
  assert.equal(isRateLimited("https://x.supabase.co/rest/v1/rpc/travel", 429), true);
  assert.equal(isRateLimited("https://x.supabase.co/auth/v1/otp", 429), false);
  assert.equal(isRateLimited("https://x.supabase.co/rest/v1/rpc/travel", 500), false);
});
