// The Charity Gala (migration 0150): lib/gala.ts mirrors game_settings 'gala'; the gift's clout share and cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GALA, galaClout } from "../lib/gala.ts";
import { PLACES } from "../lib/city.ts";

const sql = readFileSync(new URL("../supabase/migrations/0150_underworld_part2.sql", import.meta.url), "utf8");

test("lib/gala.ts mirrors game_settings 'gala' in migration 0150", () => {
  const m = sql.match(/values \('gala', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(GALA)));
  assert.ok(PLACES.some((p) => p.id === GALA.place));
});

test("a quarter of the gift comes back as clout, 250 at most", () => {
  assert.deepEqual(GALA.amounts.map(galaClout), [25, 62, 125, 250]);
});
