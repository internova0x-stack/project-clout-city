import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CASH_GOALS, GOALS, GOAL_COPY, goalProgress, nextStreakReward, partLine, streakRewardOn } from "../lib/goals.ts";
import { CITY_ECONOMY, SHOP_ITEMS, citySeed } from "../lib/city.ts";

test("the database's goals settings match lib/goals.ts", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  let seed: unknown = null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().reverse()) {
    const m = readFileSync(new URL(f, dir), "utf8").match(/values \('goals', '(\{[^']*)'::jsonb\)/);
    if (m) { seed = JSON.parse(m[1]); break; }
  }
  assert.ok(seed, "no goals seed");
  assert.deepEqual(seed, JSON.parse(JSON.stringify(GOALS)));
});

test("the ladder: seven goals in the suggested order, each with words and a reward", () => {
  assert.deepEqual(GOALS.ladder, ["first_purchase", "first_gig", "move_up", "pro_gigs", "first_car", "big_gigs", "own_home"]);
  for (const id of GOALS.ladder) {
    assert.ok(GOALS.rewards[id] > 0, id);
    assert.ok(GOAL_COPY[id].title && GOAL_COPY[id].line && GOAL_COPY[id].emoji, id);
    assert.ok(GOALS.tags[id], id);
  }
  for (const id of CASH_GOALS) assert.ok(GOALS.ladder.includes(id));
});

test("the daily mix: 1 gossip + 2 goal + 1 skill + 1 random = 5", () => {
  assert.equal(CITY_ECONOMY.gossip.tasksPerDay, 1);
  assert.equal(GOALS.goalTasksPerDay, 2);
  assert.ok(CITY_ECONOMY.gossip.tasksPerDay + GOALS.goalTasksPerDay + 1 < CITY_ECONOMY.dailyTasks.count, "one random task left");
});

test("streak rewards: day 3 clout, then a collectible and a pass in turn every 7 days", () => {
  assert.deepEqual([1, 2, 3, 4, 7, 14, 21, 28].map((n) => streakRewardOn(n)), [null, null, "clout", null, "collectible", "pass", "collectible", "pass"]);
  assert.deepEqual(nextStreakReward(0), { day: 3, reward: "clout" });
  assert.deepEqual(nextStreakReward(3), { day: 7, reward: "collectible" });
  assert.deepEqual(nextStreakReward(7), { day: 14, reward: "pass" });
  assert.deepEqual(nextStreakReward(15), { day: 21, reward: "collectible" });
});

test("streak collectibles are reward-only Home pieces, never priced, and the seed marks them", () => {
  const seed = citySeed().shop;
  for (const sku of GOALS.streak.collectibles) {
    const it = SHOP_ITEMS.find((i) => i.sku === sku);
    assert.ok(it && it.reward && it.category === "home" && it.price === 0 && it.furniture, sku);
    assert.equal((seed.find((s) => s.sku === sku) as { reward?: boolean } | undefined)?.reward, true, sku);
  }
  assert.equal(SHOP_ITEMS.filter((i) => i.reward).length, GOALS.streak.collectibles.length, "every reward piece is a streak reward");
  assert.ok(seed.filter((s) => !("reward" in s)).length === seed.length - GOALS.streak.collectibles.length, "other items' seed unchanged");
});

test("goal progress and words", () => {
  assert.equal(goalProgress([{ have: 250, need: 500, unit: "clout" }, { have: 50, need: 50, unit: "confidence" }]), 0.75);
  assert.equal(goalProgress([{ have: 9000, need: 100, unit: "cash" }]), 1);
  assert.equal(goalProgress([]), 0);
  assert.equal(partLine({ have: 1240, need: 14000, unit: "cash" }), "C$1,240 of C$14,000");
  assert.equal(partLine({ have: 380, need: 500, unit: "clout" }), "380 of 500 clout");
});
