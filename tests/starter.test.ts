import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOLA_TEXT, STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, STARTER_UNLOCK_DAY, dayLabel, nextDay, nextMission, rewardLine } from "../lib/starter.ts";
import { createStarterSim } from "../lib/starterSim.ts";

// Starter Week (migrations 0122, 0123; by the day since 0163): the code's mission list mirrors game_settings 'starter'.
const sql = readFileSync(new URL("../supabase/migrations/0163_starter_days.sql", import.meta.url), "utf8");
const missions = JSON.parse(sql.match(/'missions', '(\[[\s\S]*?\])'::jsonb/)![1]) as { id: string; day: number; cash: number; clout: number }[];
const finishCash = Number(sql.match(/'\{"cash":(\d+)\}'::jsonb/)![1]);
const first = readFileSync(new URL("../supabase/migrations/0122_starter_week.sql", import.meta.url), "utf8");

test("the missions, days, rewards and finish match the migrations", () => {
  assert.deepEqual(missions.map((m) => m.id), STARTER_MISSIONS.map((m) => m.id));
  for (const m of STARTER_MISSIONS) {
    const s = missions.find((x) => x.id === m.id)!;
    assert.equal(s.day, m.day, m.id);
    assert.equal(s.cash, m.reward.cash ?? 0, m.id);
    assert.equal(s.clout, m.reward.clout ?? 0, m.id);
    // One currency each: starter_state() writes one ledger row per mission.
    assert.ok((s.cash > 0) !== (s.clout > 0), `${m.id}: cash or clout`);
  }
  assert.equal(finishCash, STARTER_FINISH.cash);
  assert.match(first, new RegExp(`"badge":"${STARTER_FINISH.badge}"`));
  assert.match(sql, new RegExp(`'days', ${STARTER_DAYS}`));
});

test("every day of the week opens something, and rent is the last day (the first bill comes a week after moving in)", () => {
  for (let d = 1; d <= STARTER_DAYS; d++) assert.ok(STARTER_MISSIONS.some((m) => m.day === d), `day ${d}`);
  assert.equal(STARTER_MISSIONS.find((m) => m.id === "rent")!.day, STARTER_DAYS);
  assert.equal(dayLabel(STARTER_DAYS), "Rent day");
  assert.equal(dayLabel(3), "Day 3");
  // The biggest prize is the finish, not one mission.
  assert.ok(STARTER_MISSIONS.every((m) => (m.reward.cash ?? 0) < STARTER_FINISH.cash));
  assert.ok(STARTER_UNLOCK_DAY > 1);
});

test("the pill shows the first open mission not done; later days wait, early ones still count", () => {
  assert.equal(nextMission([], 1)?.id, "breakfast");
  assert.equal(nextMission(["breakfast", "gig"], 1)?.id, "park");
  const day1 = STARTER_MISSIONS.filter((m) => m.day === 1).map((m) => m.id);
  assert.equal(nextMission(day1, 1), null, "today's done");
  assert.deepEqual(nextDay(day1, 1), { day: 2, count: 2 });
  assert.equal(nextMission(day1, 2)?.id, "look");
  // Done early: furniture on day 1 doesn't come back on day 2.
  assert.equal(nextMission([...day1, "look", "furniture"], 2), null);
  assert.equal(nextMission(STARTER_MISSIONS.map((m) => m.id), STARTER_DAYS), null);
  assert.equal(nextDay(STARTER_MISSIONS.map((m) => m.id), 1), null);
  assert.equal(rewardLine({ cash: 25 }), "+C$25");
});

test("the preview sim: presets by count or by day, each mission paid once, then the finish", async () => {
  const byDay = createStarterSim("day3", () => {});
  const s3 = await byDay.api.state();
  assert.ok(s3.ok && s3.data?.day === 3 && s3.data.done.length === STARTER_MISSIONS.filter((m) => m.day < 3).length);
  let cash = 0, clout = 0;
  const sim = createStarterSim(STARTER_MISSIONS.length - 2, (c, k) => { cash += c; clout += k; });
  assert.equal(cash + clout, 0, "the preset's missions were paid before");
  sim.mark("host");
  const a = await sim.api.state();
  assert.ok(a.ok && a.data?.paid.length === 1 && clout === 25, "people over: +25 clout");
  sim.mark("rent");
  const b = await sim.api.state();
  assert.ok(b.ok && b.data?.finished && cash === STARTER_FINISH.cash && !b.data.active);
  const c = await sim.api.state();
  assert.ok(c.ok && !c.data?.finished && c.data?.paid.length === 0);
});

test("Lola's text: three short replies, each answered, in her voice", () => {
  assert.equal(LOLA_TEXT.replies.length, 3, "migration 0164 accepts replies 0 to 2");
  for (const line of [LOLA_TEXT.hello, ...LOLA_TEXT.replies.flatMap((r) => [r.label, r.answer])]) assert.ok(line.length <= 140, line);
  assert.ok(LOLA_TEXT.replies.every((r) => r.answer.endsWith("💋")), "she signs off with a kiss");
  const sql = readFileSync(new URL("../supabase/migrations/0164_starter_lola_text.sql", import.meta.url), "utf8");
  assert.match(sql, new RegExp(`not between 0 and ${LOLA_TEXT.replies.length - 1}`));
});
