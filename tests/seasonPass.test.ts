import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEASON, STARTER_PACK, claimable, daysLeft, passBadge, seasonSettings, starterPackSettings, tierFor, type PassState } from "../lib/seasonPass.ts";
import { SHOP_ITEMS } from "../lib/city.ts";

const sql = readFileSync(new URL("../supabase/migrations/0156_season_pass_starter_pack.sql", import.meta.url), "utf8");
const setting = (key: string) => {
  const m = sql.match(new RegExp(`\\('${key}', '((?:[^']|'')*)'::jsonb\\)`));
  assert.ok(m, key);
  return JSON.parse(m[1].replaceAll("''", "'"));
};

test("the migration's settings mirror lib/seasonPass.ts", () => {
  assert.deepEqual(setting("season_pass"), JSON.parse(JSON.stringify(seasonSettings())));
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
  // Five tasks and the all-five bonus on about two days in three finish it; the goals add more.
  const days = daysLeft(SEASON.starts);
  const perFullDay = 5 * SEASON.xp.daily_task + SEASON.xp.daily_bonus;
  assert.ok(perFullDay * days * 0.66 >= SEASON.tiers.length * SEASON.xpPerTier, `${days} days`);
  assert.ok(perFullDay * days * 0.4 < SEASON.tiers.length * SEASON.xpPerTier, "but not by showing up now and then");
});

test("claimable: reached and unclaimed, the paid row only when open, nothing before or after the season", () => {
  const base: PassState = { season: SEASON, xp: SEASON.xpPerTier * 3, paid: false, vip: false, phase: "on", claimed: { free: [1], paid: [] }, today: 0 };
  assert.deepEqual(claimable(base), { free: [2, 3], paid: [] });
  assert.deepEqual(claimable({ ...base, paid: true }), { free: [2, 3], paid: [1, 2, 3] });
  assert.deepEqual(claimable({ ...base, phase: "soon" }), { free: [], paid: [] });
  assert.deepEqual(claimable({ ...base, phase: "claim", paid: true }).paid, [1, 2, 3]);
});
