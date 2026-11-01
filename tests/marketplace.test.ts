// The Player Economy, Phase 2 (migration 0152): the settings mirror, the swap balance, the copy for every flag, push and
// refusal the SQL writes, and runners in the underworld engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARKETPLACE, cashMax, hireError, holdLine, marketAlerts, marketError, saleFee, sellerGets, swapCheck, type MarketState } from "../lib/marketplace.ts";
import { FLAG_COPY, PHASE_COPY, historyLine, type EconomyRow } from "../lib/playerEconomy.ts";
import { PUSH_KINDS } from "../lib/push.ts";
import { UNDERWORLD, doJob, newState, type UnderworldContent, type UnderworldCtx } from "../lib/underworld.ts";
import { describeEntry } from "../lib/ledger.ts";

const sql = readFileSync(new URL("../supabase/migrations/0152_marketplace.sql", import.meta.url), "utf8");

test("lib/marketplace.ts mirrors game_settings 'marketplace' in migration 0152", () => {
  const m = sql.match(/values \('marketplace', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(MARKETPLACE)));
});

test("the defaults chosen for phase 2", () => {
  assert.equal(MARKETPLACE.hold.hours, 72);
  assert.equal(MARKETPLACE.reversalDays, 7);
  assert.equal(MARKETPLACE.swap.hours, 24);
  assert.equal(MARKETPLACE.perSkuWeek, 2);
  assert.equal(MARKETPLACE.bigTrade, 2500);
  assert.equal(saleFee(700), 35);
  assert.equal(sellerGets(700), 665);
  assert.ok(PHASE_COPY.marketplace.built);
});

test("swaps balance within the band, and C$ only tops up", () => {
  assert.deepEqual(swapCheck({ items: 1, value: 1400, cash: 0 }, { items: 1, value: 925, cash: 0 }), { ok: false, reason: "unbalanced" });
  assert.deepEqual(swapCheck({ items: 1, value: 1400, cash: 0 }, { items: 1, value: 925, cash: 500 }), { ok: true });
  assert.deepEqual(swapCheck({ items: 1, value: 1400, cash: 0 }, { items: 1, value: 925, cash: 1000 }), { ok: false, reason: "too_much_cash" });
  assert.deepEqual(swapCheck({ items: 0, value: 0, cash: 0 }, { items: 1, value: 925, cash: 0 }), { ok: false, reason: "no_items" });
  assert.deepEqual(swapCheck({ items: 5, value: 1000, cash: 0 }, { items: 1, value: 1000, cash: 0 }), { ok: false, reason: "too_many_items" });
  assert.equal(cashMax(925), 925, "at half the side's total, C$ can match its items");
});

test("every automatic flag, push and ledger kind the SQL writes has copy", () => {
  const rules = [...sql.matchAll(/economy_flag\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(rules.includes("sku_limit"));
  for (const r of rules) assert.ok(r in FLAG_COPY, r);
  const kinds = [...sql.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(kinds.length >= 5);
  for (const k of kinds) assert.ok(k in PUSH_KINDS, k);
  for (const [kind, ref] of [["market_hold", "sale:1"], ["market_sale", "sale:1"], ["market_sale", "refund:trade:1:a:1"], ["market_sale", "reversal:sale:1"], ["market_sale", "trade:1:a"]]) {
    const d = describeEntry({ id: 1, kind, ref, amount: 1, currency: "cash", created_at: "" } as unknown as Parameters<typeof describeEntry>[0]);
    assert.notEqual(d.title, kind, `${kind} ${ref}`);
  }
});

test("every refusal the SQL raises reads as words", () => {
  const codes = new Set([...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]));
  for (const c of ["their_trade_hold", "trade_hold", "they_cant_trade", "their_weekly_limit"]) codes.add(c);
  const internal = new Set(["no_player", "bad_cut", "bad_outcome", "bad_kind", "reason_needed", "cant_reverse", "bad_cash", "trade_gone", "rate_limited", "blocked"]);
  for (const c of codes) {
    if (internal.has(c)) continue;
    assert.notEqual(hireError(c) ?? marketError(c), "That didn't work. Try again.", c);
  }
});

test("history lines for sales and swaps", () => {
  const row: EconomyRow = { id: 1, kind: "sale", ref: "sale:1", label: "Big TV", value: 700, fee: 35, cash: true, status: "done", at: "", direction: "received", with: "x", withName: "boboo", withStyle: null };
  assert.deepEqual(historyLine(row), { emoji: "🏷️", title: "Sold to @boboo · Big TV", amount: "+C$665", note: "C$35 city fee" });
  assert.equal(historyLine({ ...row, direction: "sent" }).title, "Bought from @boboo · Big TV");
  assert.equal(historyLine({ ...row, kind: "trade", cash: false, fee: 0, label: "Kitchen island" }).note, "Shop value");
  assert.equal(historyLine({ ...row, status: "reversed" }).note, "Reversed by the city");
});

test("the Market's badge counts swaps waiting on you; the hold says until when", () => {
  const side = { items: [], cash: 0, value: 0, ok: false };
  const s = { on: true, trades: [
    { status: "open", you: { ...side }, them: { ...side, ok: true } },
    { status: "open", you: { ...side, ok: true }, them: { ...side } },
    { status: "done", you: { ...side }, them: { ...side } },
  ] } as unknown as MarketState;
  assert.equal(marketAlerts(s), 1);
  assert.equal(marketAlerts({ ...s, on: false }), 0);
  assert.match(holdLine(new Date(Date.now() + 3_600_000).toISOString())!, /72 hours/);
  assert.equal(holdLine(new Date(Date.now() - 1000).toISOString()), null);
});

test("runners: a hired job is the runner's risk, Pablo's take goes to the poster, Heat for both, once per hire", () => {
  const content: UnderworldContent = JSON.parse(readFileSync(new URL("../content/underworld/jobs.json", import.meta.url), "utf8"));
  const job = content.jobs.find((j) => j.minRep === 0)!;
  const ctx: UnderworldCtx = { rank: 2, integrity: 50, shady: true, atPlace: UNDERWORLD.place, energy: 100, bank: 5000, holding: false, lawJob: false };
  const s = newState("2026-11-02");
  // A clean win: no trace (rolls 0 then 0.99 for the pay and the trace).
  const rolls = [0, 0.5, 0.99];
  let i = 0;
  const r = doJob(content, s, job.id, job.options[0].id, "2026-11-02", ctx, () => rolls[i++ % rolls.length], { id: 7, heat: MARKETPLACE.hire.runnerHeat });
  assert.equal(r.outcome, "win");
  assert.ok((r.hirePay ?? 0) >= job.options[0].pay[0], "Pablo's take, for the poster");
  assert.equal(r.payouts.filter((p) => p.kind === "underworld_pay").length, 0, "not paid to the runner");
  assert.equal(s.heat, job.options[0].heat + MARKETPLACE.hire.runnerHeat, "the job's Heat and the runner's extra");
  assert.equal(s.offers.done.length, 0, "not one of the runner's own three");
  assert.deepEqual(s.hires?.[0], { id: 7, outcome: "win", pay: r.hirePay });
  assert.throws(() => doJob(content, s, job.id, job.options[0].id, "2026-11-02", ctx, () => 0, { id: 7, heat: 3 }), /done/);
  assert.throws(() => doJob(content, s, job.id, job.options[0].id, "2026-11-02", { ...ctx, atPlace: "home" }, () => 0, { id: 8, heat: 3 }), /not_here/);
});
