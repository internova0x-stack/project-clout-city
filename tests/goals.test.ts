import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { GOALS, GOAL_COPY, NEXT_CHAPTER, chapters, goalProgress, nextStreakReward, nextUnlock, partLine, streakRewardOn } from "../lib/goals.ts";
import { CITY_ECONOMY, PLACES, SHOP_ITEMS, citySeed } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";
import { RANKS } from "../lib/ranks.ts";

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

test("the ladder (owner, Oct 18): long, gated by rank clout, pro gigs before moving up, a home for the long run", () => {
  const ids = GOALS.ladder.map((g) => g.id);
  assert.ok(ids.length >= 20, "a long ladder");
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  const rankClout = new Set(RANKS.map((r) => r.clout));
  for (const g of GOALS.ladder) {
    assert.ok(rankClout.has(g.unlock), `${g.id} unlocks at a rank's clout`);
    assert.ok(g.reward > 0, g.id);
    assert.ok(GOAL_COPY[g.id]?.title && GOAL_COPY[g.id].line && GOAL_COPY[g.id].emoji && GOAL_COPY[g.id].toward, g.id);
  }
  assert.ok(GOAL_COPY[NEXT_CHAPTER]);
  for (let i = 1; i < GOALS.ladder.length; i++) assert.ok(GOALS.ladder[i].unlock >= GOALS.ladder[i - 1].unlock, "chapters in order");
  assert.ok(ids.indexOf("pro_gigs") < ids.indexOf("move_up"), "pro gigs before a better apartment");
  const home = GOALS.ladder.find((g) => g.id === "own_home")!;
  assert.ok(home.unlock >= 15000 && home.reward >= 1000, "owning a home is a big deal");
  assert.ok(GOALS.ladder.filter((g) => g.unlock > 0).length > GOALS.ladder.length / 2, "most goals sit behind clout");
  assert.deepEqual(chapters().map((c) => c.unlock), [...new Set(GOALS.ladder.map((g) => g.unlock))]);
  assert.equal(nextUnlock(0), 100);
  assert.equal(nextUnlock(600), 1000);
  assert.equal(nextUnlock(10_000_000), null);
});

test("every goal's check names something the game has", () => {
  for (const { id, check: c } of GOALS.ladder) {
    if (c.type === "business") assert.ok(CITY_ECONOMY.businesses.list.some((b) => b.id === c.id), id);
    if (c.type === "home") assert.ok(ECONOMY.homes.some((h) => h.id === c.home && !h.campus), id);
    if (c.type === "house") assert.ok(SHOP_ITEMS.some((i) => i.sku === c.sku && i.category === "houses"), id);
    if (c.type === "door") assert.ok((PLACES.find((p) => p.id === c.place)?.club?.doorClout ?? 0) > 0, id);
    if (c.type === "vip") assert.ok(PLACES.some((p) => p.club?.vip === c.level), id);
    if (c.type === "save") assert.ok(c.cash > ECONOMY.birthLottery.max, `${id}: more than anyone starts with`);
  }
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
