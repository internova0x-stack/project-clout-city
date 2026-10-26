import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COUPLES, coupleAlerts, coupleBadge, coupleError, officialLine, type CoupleState } from "../lib/couples.ts";
import { PUSH_KINDS } from "../lib/push.ts";

const sql = readFileSync(new URL("../supabase/migrations/0118_relationships.sql", import.meta.url), "utf8");

test("lib/couples.ts mirrors game_settings 'couples' in migration 0118", () => {
  const m = sql.match(/values \('couples', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the couples settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(COUPLES)));
});

test("every couple push kind is known to the sender, and every streak badge has a name", () => {
  for (const k of sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(PUSH_KINDS[k[1]], k[1]);
  for (const r of COUPLES.streakRewards) if ("badge" in r) assert.ok(coupleBadge(r.badge), r.badge);
});

test("errors read as people, and the official line counts dates", () => {
  assert.match(coupleError("ERROR: more_dates"), /Three date nights/);
  assert.match(coupleError("weird"), /Cupid/);
  assert.equal(officialLine({ dates: 2, blockedBy: "more_dates" }), "2 of 3 date nights together");
  assert.match(officialLine({ dates: 3, blockedBy: null }), /make it official/);
});

test("alerts: an ask to answer, an unseen gift and the breakup note", () => {
  const base: CoupleState = {
    partner: null, relId: null, since: null, days: null, streak: 0, todayDone: false, nextReward: null, shown: null,
    gifts: { boxes: 0, sentToday: false, received: [] }, paid: [], ended: null, matches: [], asks: [],
    rules: { datesToOfficial: 3, streakMessages: 5, giftMood: 10, giftClout: 10 },
  };
  assert.equal(coupleAlerts(base), 0);
  assert.equal(coupleAlerts({ ...base, asks: [{ id: 1, mine: true, with: { id: "x", name: "x", style: "s" } }] }), 0);
  assert.equal(coupleAlerts({ ...base, asks: [{ id: 1, mine: false, with: { id: "x", name: "x", style: "s" } }],
    gifts: { boxes: 0, sentToday: false, received: [{ id: 2, from: "x", day: "2026-10-26" }] }, ended: { id: 3, reason: "breakup", name: "x" } }), 3);
});
