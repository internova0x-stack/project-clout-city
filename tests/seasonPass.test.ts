import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEASON, STARTER_PACK, claimable, daysLeft, passBadge, seasonStakesSettings, starterPackSettings, WEEKS, challengeById, pace, weekOf, CHALLENGES, tierFor, type PassState } from "../lib/seasonPass.ts";
import { SHOP_ITEMS } from "../lib/city.ts";

const sql = readFileSync(new URL("../supabase/migrations/0156_season_pass_starter_pack.sql", import.meta.url), "utf8");
const setting = (key: string) => {
  const m = sql.match(new RegExp(`\\('${key}', '((?:[^']|'')*)'::jsonb\\)`));
  assert.ok(m, key);
  return JSON.parse(m[1].replaceAll("''", "'"));
};

const stakes = readFileSync(new URL("../supabase/migrations/0167_season_pass_stakes.sql", import.meta.url), "utf8");

test("the migration's settings mirror lib/seasonPass.ts (0167 replaced 0156's season row)", () => {
  const m = stakes.match(/set value = '((?:[^']|'')*)'::jsonb where key = 'season_pass'/);
  assert.ok(m, "0167 updates the season row");
  // Migrations 0173 and 0176 add XP sources to 0167's row: xp.scene, then a list merged in (Clout Pass XP from everything).
  const row = JSON.parse(m[1].replaceAll("''", "'"));
  const added = /set value = jsonb_set\(value, '\{xp\}', \(value -> 'xp'\) \|\| '(\{[^']*\})'::jsonb\)/.exec(readFileSync(new URL("../supabase/migrations/0176_known_for.sql", import.meta.url), "utf8"));
  assert.ok(added, "0176 merges the new XP sources");
  row.xp = { ...row.xp, scene: 10, ...JSON.parse(added![1]) };
  assert.deepEqual(row, JSON.parse(JSON.stringify(seasonStakesSettings())));
  assert.match(readFileSync(new URL("../supabase/migrations/0173_scene_plaques.sql", import.meta.url), "utf8"), /jsonb_set\(value, '\{xp,scene\}', '10'::jsonb\)/);
  assert.equal(setting("season_pass").xpPerTier, 160, "0156 is history: it shipped 160 a level");
  assert.deepEqual(setting("starter_pack"), JSON.parse(JSON.stringify(starterPackSettings())));
  assert.match(sql, /\('season-pass-s1', 'season_pass', 'Clout Pass: Cuffing Season', 799\)/);
  assert.match(sql, /\('starter-pack', 'bundle', 'Day One Starter Pack', 299\)/);
});

test("real money buys looks only: the paid row and the pack are pieces and badges, never C$ or clout", () => {
  for (const t of SEASON.tiers) {
    assert.ok(t.paid.length > 0, `tier ${t.tier} has a paid reward`);
    for (const r of t.paid) assert.ok(r.kind === "item" || r.kind === "badge", `tier ${t.tier}: ${r.kind}`);
  }
  const rewardSkus = [...SEASON.tiers.flatMap((t) => [...t.free, ...t.paid]).flatMap((r) => (r.kind === "item" ? [r.sku] : [])), ...STARTER_PACK.items];
  assert.equal(new Set(rewardSkus).size, rewardSkus.length, "no piece is given twice");
  for (const sku of rewardSkus) {
    const item = SHOP_ITEMS.find((i) => i.sku === sku);
    assert.ok(item, `${sku} exists`);
    assert.ok(item.reward && item.price === 0 && item.clout === 0, `${sku} is reward-only: never sold, sold back, traded or gifted`);
    assert.ok(item.wear || item.furniture, `${sku} can be worn or placed`);
  }
  assert.ok(passBadge(SEASON.badge.id) && passBadge(STARTER_PACK.badge.id), "both badges have a name");
});

test("tiers fill from XP, and a regular can finish the season", () => {
  assert.deepEqual(tierFor(0), { tier: 0, into: 0, need: SEASON.xpPerTier, max: false });
  assert.equal(tierFor(SEASON.xpPerTier * 3 + 5).tier, 3);
  assert.equal(tierFor(1e9).tier, SEASON.tiers.length);
  assert.ok(tierFor(1e9).max);
  // Owner, Nov 16 (stakes): daily play alone no longer finishes it; the weekly challenges plus most days do, even for
  // someone who starts on the week they arrived (Nov 16, with 0 XP).
  const days = daysLeft("2026-11-16");
  const perFullDay = 5 * SEASON.xp.daily_task + SEASON.xp.daily_bonus;
  const total = SEASON.tiers.length * SEASON.xpPerTier;
  const challenges = WEEKS.reduce((n, w) => n + w.ids.reduce((m, id) => m + challengeById(id)!.xp, 0), 0);
  assert.ok(perFullDay * days < total, `daily tasks every day of ${days} reach ${perFullDay * days} of ${total}`);
  assert.ok(perFullDay * days * 0.8 + challenges >= total, `challenges (${challenges}) and most days finish it`);
});

test("claimable: reached and unclaimed, the paid row only when open, nothing before or after the season", () => {
  const base: PassState = { season: SEASON, xp: SEASON.xpPerTier * 3, paid: false, vip: false, phase: "on", claimed: { free: [1], paid: [] }, today: 0 };
  assert.deepEqual(claimable(base), { free: [2, 3], paid: [] });
  assert.deepEqual(claimable({ ...base, paid: true }), { free: [2, 3], paid: [1, 2, 3] });
  assert.deepEqual(claimable({ ...base, phase: "soon" }), { free: [], paid: [] });
  assert.deepEqual(claimable({ ...base, phase: "claim", paid: true }).paid, [1, 2, 3]);
});

test("weekly challenges (owner, Nov 16): three a week, one of each kind, every week to the season's end", () => {
  assert.equal(WEEKS[0].from, "2026-11-16");
  for (const w of WEEKS) {
    assert.equal(weekOf(w.from), w.from, `${w.from} is a Monday`);
    assert.equal(w.ids.length, 3);
    assert.ok(CHALLENGES.social.some((c) => c.id === w.ids[0]) && CHALLENGES.city.some((c) => c.id === w.ids[1]) && CHALLENGES.routine.some((c) => c.id === w.ids[2]));
    const xp = w.ids.reduce((n, id) => n + challengeById(id)!.xp, 0);
    assert.ok(xp >= 260 && xp <= 320, `${w.from}: ${xp} XP`);
  }
  assert.ok(WEEKS[WEEKS.length - 1].from <= SEASON.ends);
  for (let i = 1; i < WEEKS.length; i++) assert.notDeepEqual(WEEKS[i].ids, WEEKS[i - 1].ids, "no week repeats the last");
  assert.equal(weekOf("2026-11-22"), "2026-11-16", "Sunday belongs to the week before");
});

test("the pace line: on track at the rate that finishes, and the level you're heading for when behind", () => {
  const total = SEASON.tiers.length * SEASON.xpPerTier;
  const s = (xp: number) => ({ season: SEASON, xp });
  assert.deepEqual(pace(s(total), "2026-12-01"), { onTrack: true, heading: 18, spare: daysLeft("2026-12-01") });
  const ok = pace(s(2000), "2026-11-30");
  assert.ok(ok.onTrack && ok.spare > 0, JSON.stringify(ok));
  const behind = pace(s(900), "2026-11-30");
  assert.ok(!behind.onTrack && behind.heading < 18 && behind.heading > 5, JSON.stringify(behind));
  assert.equal(pace(s(0), "2026-11-07").heading, 0);
});

test("Level 18's free reward is the season title, and the title never comes from real money", () => {
  assert.ok(SEASON.tiers[17].free.some((r) => r.kind === "title" && r.id === SEASON.title.id));
  for (const t of SEASON.tiers) for (const r of t.paid) assert.notEqual(r.kind, "title");
  assert.match(stakes, /k = 'title' and not p_paid/);
});
