import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ECONOMY } from "../lib/economy.ts";
import { PUSH_KINDS } from "../lib/push.ts";
import { SUBLETS, canHostHome, daysUntil, endedLine, ratingLine, subletAlerts, subletBounds, subletError, type SubletState } from "../lib/sublets.ts";

const sql = readFileSync(new URL("../supabase/migrations/0119_sublets.sql", import.meta.url), "utf8");

test("lib/sublets.ts mirrors game_settings 'sublets' in migration 0119", () => {
  const m = sql.match(/values \('sublets', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the sublets settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(SUBLETS)));
});

test("only real 1BR-or-bigger rentals host, and a room is a quarter to half the rent", () => {
  for (const id of SUBLETS.homes) assert.ok(ECONOMY.homes.some((h) => h.id === id), id);
  assert.ok(!canHostHome("astoria_share") && !canHostHome("astoria_studio") && !canHostHome("sj_dorm"));
  assert.deepEqual(subletBounds(1050), [263, 525]);
  assert.deepEqual(subletBounds(600), [150, 300]);
  assert.deepEqual(subletBounds(750), [188, 375]);
});

test("every sublet push kind is known to the sender, and every error reads as people", () => {
  for (const k of sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(PUSH_KINDS[k[1]], k[1]);
  for (const k of sql.matchAll(/raise exception '([a-z_]+)'/g)) assert.doesNotMatch(subletError(k[1]), /broker lost/, k[1]);
  assert.match(subletError("weird"), /broker lost/);
});

test("lines: ratings, endings, days", () => {
  assert.equal(ratingLine({ avg: 4.86, count: 7 }), "⭐ 4.9 · 7 stays");
  assert.equal(ratingLine({ avg: null, count: 0 }), "New");
  const who = { id: "x", name: "kai", style: "bodega_drip", rating: { avg: null, count: 0 }, days: 9 };
  assert.match(endedLine({ id: 1, role: "host", reason: "left", with: who, deposit: 100, rated: false }), /moved out early/);
  assert.match(endedLine({ id: 1, role: "sub", reason: "unpaid", with: who, deposit: 100, rated: false }), /didn't clear/);
  assert.equal(daysUntil("2026-10-31", "2026-10-26"), 5);
});

test("alerts: applications, a renewal to answer, an ending to rate", () => {
  const base: SubletState = { hostBlock: null, bounds: null, live: null, mine: null, ended: null, listings: [], rules: { minWeeks: 1, maxWeeks: 8, noticeDays: 7, hangClout: 10, crewHours: 24, noteMax: 140, minAccountDays: 7 } };
  assert.equal(subletAlerts(base), 0);
  const who = { id: "x", name: "kai", style: "bodega_drip", rating: { avg: null, count: 0 }, days: 9 };
  assert.equal(subletAlerts({ ...base, mine: { id: 1, homeId: "lic_highrise", rent: 400, minWeeks: 1, maxWeeks: 2, note: null, crewUntil: "", apps: [{ id: 1, weeks: 1, note: null, at: "", from: who }] } }), 1);
  assert.equal(subletAlerts({ ...base, ended: { id: 1, role: "sub", reason: "done", with: who, deposit: 1, rated: false } }), 1);
});
