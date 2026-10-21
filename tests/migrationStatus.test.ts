import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

test("scripts/migration-status.sql has a row for every migration, and changes nothing", () => {
  const sql = readFileSync(new URL("../scripts/migration-status.sql", import.meta.url), "utf8");
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort();
  const listed = [...sql.matchAll(/^\s+\('(\d{4}_[a-z0-9_]+\.sql)',/gm)].map((m) => m[1]);
  assert.deepEqual(listed, files);
  const body = sql.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(body, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i);
});
