import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, nextMission, rewardLine } from "../lib/starter.ts";
import { createStarterSim } from "../lib/starterSim.ts";

// Starter Week (migration 0122): the code's mission list mirrors game_settings 'starter'.
const sql = readFileSync(new URL("../supabase/migrations/0122_starter_week.sql", import.meta.url), "utf8");
const missions = JSON.parse(sql.match(/'missions', '(\[[\s\S]*?\])'::jsonb/)![1]) as { id: string; cash: number; clout: number }[];
const finish = JSON.parse(sql.match(/'finish', '(\{[\s\S]*?\})'::jsonb/)![1]) as { badge: string; cash: number; item: string };

test("the missions, rewards and finish match the migration", () => {
  assert.deepEqual(missions.map((m) => m.id), STARTER_MISSIONS.map((m) => m.id));
  for (const m of STARTER_MISSIONS) {
    const s = missions.find((x) => x.id === m.id)!;
    assert.equal(s.cash, m.reward.cash ?? 0, m.id);
    assert.equal(s.clout, m.reward.clout ?? 0, m.id);
    // One currency each: starter_state() writes one ledger row per mission.
    assert.ok((s.cash > 0) !== (s.clout > 0), `${m.id}: cash or clout`);
  }
  assert.equal(finish.cash, STARTER_FINISH.cash);
  assert.equal(finish.badge, STARTER_FINISH.badge);
  assert.match(sql, new RegExp(`'days', ${STARTER_DAYS}`));
});

test("the pill shows the first mission not done, in any order", () => {
  assert.equal(nextMission([])?.id, "breakfast");
  assert.equal(nextMission(["breakfast", "gig"])?.id, "park");
  assert.equal(nextMission(STARTER_MISSIONS.map((m) => m.id)), null);
  assert.equal(rewardLine({ cash: 25 }), "+C$25");
});

test("the preview sim pays each mission once, then the finish", async () => {
  let cash = 0, clout = 0;
  const sim = createStarterSim(8, (c, k) => { cash += c; clout += k; });
  assert.equal(cash + clout, 0, "the preset's missions were paid before");
  sim.mark("rent");
  const a = await sim.api.state();
  assert.ok(a.ok && a.data?.paid.length === 1 && clout === 20);
  sim.mark("event");
  const b = await sim.api.state();
  assert.ok(b.ok && b.data?.finished && cash === STARTER_FINISH.cash && !b.data.active);
  const c = await sim.api.state();
  assert.ok(c.ok && !c.data?.finished && c.data?.paid.length === 0);
});
