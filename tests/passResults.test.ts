import { test } from "node:test";
import assert from "node:assert/strict";
import { SEASON, type PassState } from "../lib/seasonPass.ts";
import { passClaimBanner, passMaxCelebration, passWrapResult } from "../components/game/passResults.ts";

const base = (over: Partial<PassState>): PassState => ({
  season: SEASON, xp: 0, paid: false, vip: false, phase: "on", claimed: { free: [], paid: [] }, today: 0, ...over,
});
const name = (sku: string) => `name:${sku}`;

test("Collect all adds up money and clout, then lists pieces", () => {
  const c = passClaimBanner([{ kind: "cash", amount: 100 }, { kind: "cash", amount: 150 }, { kind: "clout", amount: 10 },
    { kind: "item", sku: "a" }, { kind: "item", sku: "b" }, { kind: "item", sku: "c" }], name);
  assert.equal(c.rung, 2);
  assert.deepEqual(c.rewards?.map((r) => r.text), ["+C$250", "+10 🔥", "name:a", "name:b", "+1 more"]);
});

test("the legend has every tier as its hero", () => {
  const c = passMaxCelebration(base({ xp: SEASON.tiers.length * SEASON.xpPerTier, paid: true }));
  assert.equal(c.rung, 4);
  assert.equal(c.num, String(SEASON.tiers.length));
});

test("the wrap-up counts tiers and keeps the pieces and the badge", () => {
  const n = SEASON.tiers.length;
  const all = Array.from({ length: n }, (_, i) => i + 1);
  const maxed = passWrapResult(base({ phase: "claim", paid: true, xp: n * SEASON.xpPerTier, claimed: { free: all, paid: all } }), name);
  assert.equal(maxed.result?.tone, "win");
  assert.equal(maxed.result?.amount, n);
  assert.ok(maxed.result?.keep?.some((k) => k.includes(SEASON.badge.name)));
  const short = passWrapResult(base({ phase: "claim", xp: 5 * SEASON.xpPerTier, claimed: { free: [1, 2], paid: [] } }), name);
  assert.equal(short.result?.tone, "warn");
  assert.equal(short.result?.meter?.have, 5);
  assert.match(short.cta ?? "", /Claim 3 rewards/);
});
