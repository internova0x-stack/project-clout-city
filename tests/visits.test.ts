import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ECONOMY } from "../lib/economy.ts";
import { PUSH_KINDS } from "../lib/push.ts";
import { VISITS, hostCloutPerGuest, snacksFor, visitAlerts, visitClock, visitError, type VisitState } from "../lib/visits.ts";

const sql = readFileSync(new URL("../supabase/migrations/0121_home_visits.sql", import.meta.url), "utf8");

test("lib/visits.ts mirrors game_settings 'visits' in migration 0121", () => {
  const m = sql.match(/values \('visits', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(VISITS)));
  for (const id of Object.keys(VISITS.capacity)) assert.ok(ECONOMY.homes.some((h) => h.id === id), id);
  for (const h of ECONOMY.homes) assert.ok(h.id in VISITS.capacity, `${h.id} has a capacity`);
});

test("the Crib Rating multiplies the host's clout, as supabase/tests/home_visits.test.sql checks", () => {
  assert.equal(hostCloutPerGuest("hang", 0), 8);
  assert.equal(hostCloutPerGuest("party", 50), 30);
  assert.equal(hostCloutPerGuest("party", 100), 40);
  assert.equal(snacksFor(3), 100);
});

test("pushes are known, errors read as people, the clock and alerts", () => {
  for (const k of sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(PUSH_KINDS[k[1]], k[1]);
  for (const k of sql.matchAll(/raise exception '([a-z_]+)'/g)) assert.doesNotMatch(visitError(k[1]), /buzzer/, k[1]);
  const now = Date.parse("2026-10-26T20:00:00Z");
  assert.equal(visitClock("2026-10-26T19:30:00Z", "2026-10-26T20:30:00Z", now), "30 min left");
  assert.equal(visitClock("2026-10-26T21:20:00Z", "2026-10-26T23:20:00Z", now), "Starts in 1 h 20 min");
  const base: VisitState = { hosting: null, invites: [], invitable: [], capacity: 3, snacks: 100, left: { hang: 3, party: 1 }, blocked: null, crib: 0 };
  const inv = { id: 1, kind: "hang" as const, starts: "", ends: "", host: { id: "x", name: "x", style: "bodega_drip", look: null }, capacity: 3, going: 0 };
  assert.equal(visitAlerts({ ...base, invites: [{ ...inv, status: "invited" }, { ...inv, id: 2, status: "accepted" }] }), 1);
});
