// The underworld, part 1 (owner, Oct 31; spec section 31): Pablo's back room. The job file's rules, the invite, Heat and
// traces, busts that bite but recover, the lawyer, what the player sees, and a season of play for tuning.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UNDERWORLD, addDays, campaignOpBonus, contentProblems, doJob, invited, liveOdds, newState, refresh, retainLawyer, tierOf, view,
  UnderworldError, type UnderworldContent, type UnderworldCtx, type UnderworldState,
} from "../lib/underworld.ts";

const content: UnderworldContent = JSON.parse(readFileSync(new URL("../content/underworld/jobs.json", import.meta.url), "utf8"));
const DAY = "2026-11-02";
const ctx = (o: Partial<UnderworldCtx> = {}): UnderworldCtx => ({
  rank: 2, integrity: 50, shady: true, atPlace: UNDERWORLD.place, energy: 100, bank: 5000, holding: false, lawJob: false, ...o,
});
const fixed = (n: number) => () => n;
function seeded(seed: number) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

test("the job file passes its rules: faces, ranges, no violence, drugs or weapons, every tier has work", () => {
  assert.deepEqual(contentProblems(content), []);
  assert.ok(content.jobs.length >= 12);
  const bad = structuredClone(content);
  bad.jobs[0].options[0].win = "He pulled a knife.";
  assert.ok(contentProblems(bad).some((p) => /violence/.test(p)));
  bad.jobs[0].options[0].label = "Lower your integrity";
  assert.ok(contentProblems(bad).some((p) => /meter/.test(p)));
});

test("Pablo finds you: Rank 2, then a Hustler at once or anyone after one shady choice", () => {
  assert.equal(invited(ctx({ rank: 1 })), false);
  assert.equal(invited(ctx({ shady: false, integrity: 50 })), false);
  assert.equal(invited(ctx({ shady: false, integrity: null })), false);
  assert.equal(invited(ctx({ shady: false, integrity: 30 })), true);
  assert.equal(invited(ctx({ shady: true, integrity: 90 })), true);
  const v = view(content, null, DAY, ctx({ shady: false }));
  assert.equal(v.invited, false);
  assert.ok(v.hint);
  assert.equal(v.offers.length, 0);
});

test("three offers a day from what Street Rep opens; a new tier's jobs show up", () => {
  const s = newState(DAY);
  refresh(content, s, DAY, ctx(), seeded(1));
  assert.equal(s.offers.ids.length, 3);
  for (const id of s.offers.ids) assert.equal(content.jobs.find((j) => j.id === id)!.minRep, 0);
  s.rep = 60;
  refresh(content, s, addDays(DAY, 1), ctx(), seeded(2));
  assert.ok(s.offers.ids.some((id) => content.jobs.find((j) => j.id === id)!.minRep > 0));
});

test("a job: only in the back room, once a day, never too hot or in holding; a win pays and earns Street Rep", () => {
  const s = newState(DAY);
  refresh(content, s, DAY, ctx(), seeded(3));
  const id = s.offers.ids[0];
  const opt = content.jobs.find((j) => j.id === id)!.options[0].id;
  assert.throws(() => doJob(content, s, id, opt, DAY, ctx({ atPlace: "ditmars-deli" }), fixed(0)), (e: unknown) => e instanceof UnderworldError && e.code === "not_here");
  assert.throws(() => doJob(content, s, id, opt, DAY, ctx({ holding: true }), fixed(0)), (e: unknown) => (e as UnderworldError).code === "in_holding");
  const r = doJob(content, s, id, opt, DAY, ctx(), fixed(0.01));
  assert.ok(r.outcome === "win" || r.outcome === "trace");
  assert.ok(r.payouts[0].amount > 0 && r.payouts[0].kind === "underworld_pay");
  assert.ok(s.rep > 0 && s.heat > 0);
  assert.throws(() => doJob(content, s, id, opt, DAY, ctx(), fixed(0.01)), (e: unknown) => (e as UnderworldError).code === "done");
  const hot = newState(DAY);
  refresh(content, hot, DAY, ctx(), seeded(3));
  hot.heat = UNDERWORLD.heat.refuse;
  assert.throws(() => doJob(content, hot, hot.offers.ids[0], opt, DAY, ctx(), fixed(0.01)), (e: unknown) => (e as UnderworldError).code === "too_hot");
});

test("busted on the spot: no pay, a capped fine, up to 3 hours in holding, Street Rep down, a Blotter headline", () => {
  const s = newState(DAY);
  s.rep = 20;
  refresh(content, s, DAY, ctx(), seeded(4));
  const job = content.jobs.find((j) => j.id === s.offers.ids[0])!;
  const rolls = [0.99, 0];
  const r = doJob(content, s, job.id, job.options[0].id, DAY, ctx(), () => rolls.shift() ?? 0);
  assert.equal(r.outcome, "bust");
  assert.ok(r.payouts.every((p) => p.amount < 0 && -p.amount <= UNDERWORLD.bust.fineMax));
  assert.ok(r.holding <= UNDERWORLD.bust.holdingMax);
  assert.equal(r.headline, job.headline);
  assert.equal(s.rep, 20 - UNDERWORLD.rep.bustLoss);
});

test("Heat cools faster on a quiet day; traces fade, and a found one costs the job's pay and some", () => {
  const s = newState(DAY);
  s.heat = 50;
  s.worked = [DAY];
  refresh(content, s, addDays(DAY, 1), ctx(), fixed(0.99));
  assert.equal(s.heat, 50 - UNDERWORLD.heat.decayWorked);
  refresh(content, s, addDays(DAY, 2), ctx(), fixed(0.99));
  assert.equal(s.heat, 50 - UNDERWORLD.heat.decayWorked - UNDERWORLD.heat.decayQuiet);

  const t = newState(DAY);
  t.heat = 60;
  t.traces = [{ id: "x", job: "found-laptop", weight: 0.5, day: DAY, pay: 300 }];
  const r = refresh(content, t, addDays(DAY, 1), ctx(), fixed(0));
  assert.equal(t.traces.length, 0);
  assert.equal(r.payouts[0].kind, "underworld_fine");
  assert.equal(r.payouts[0].amount, -450);
  assert.equal(r.holding, 2);
  assert.ok(r.headline?.includes("{name}"));
  assert.equal(t.landed.length, 1);
  assert.match(t.landed[0].text, /^Remember the laptop/);

  const u = newState(DAY);
  u.traces = [{ id: "y", job: "found-laptop", weight: 0.3, day: DAY, pay: 300 }];
  refresh(content, u, addDays(DAY, 1), ctx(), fixed(0.99));
  assert.equal(u.traces[0].weight, 0.255);
  refresh(content, u, addDays(DAY, 20), ctx(), fixed(0.99));
  assert.equal(u.traces.length, 0);
});

test("Whitlock & Hale: a week's retainer halves fines and takes an hour off; a law career is its own lawyer", () => {
  const s = newState(DAY);
  const r = retainLawyer(s, DAY, ctx());
  assert.deepEqual(r.payouts, [{ currency: "cash", amount: -UNDERWORLD.lawyer.cost, kind: "underworld_lawyer", ref: `lawyer:${DAY}` }]);
  assert.throws(() => retainLawyer(s, DAY, ctx()), (e: unknown) => (e as UnderworldError).code === "has_lawyer");
  assert.throws(() => retainLawyer(newState(DAY), DAY, ctx({ bank: 10 })), (e: unknown) => (e as UnderworldError).code === "cant_afford");
  s.heat = 60;
  s.traces = [{ id: "x", job: "found-laptop", weight: 0.5, day: DAY, pay: 300 }];
  const c = refresh(content, s, addDays(DAY, 1), ctx(), fixed(0));
  assert.equal(c.payouts[0].amount, -230);
  assert.equal(c.holding, 1);
  assert.equal(view(content, newState(DAY), DAY, ctx({ lawJob: true })).lawyer.on, true);
});

test("a Halo's first job pays less; the view never carries odds, traces or outcomes", () => {
  const a = newState(DAY), b = newState(DAY);
  refresh(content, a, DAY, ctx(), seeded(5));
  refresh(content, b, DAY, ctx(), seeded(5));
  const id = a.offers.ids[0];
  const opt = content.jobs.find((j) => j.id === id)!.options[0];
  const halo = doJob(content, a, id, opt.id, DAY, ctx({ integrity: 80 }), fixed(0.01));
  const mid = doJob(content, b, id, opt.id, DAY, ctx(), fixed(0.01));
  assert.ok(halo.payouts[0].amount < mid.payouts[0].amount);
  const v = JSON.stringify(view(content, b, DAY, ctx()));
  for (const k of ['"odds"', '"trace"', '"pay"', '"win"', '"fizzle"', '"bust"', '"caught"', '"traces"']) assert.ok(!v.includes(k), k);
});

test("Street Rep tiers and the campaign's dark-op bonus (+10% at most)", () => {
  assert.equal(tierOf(0).name, "Errand Kid");
  assert.equal(tierOf(60).name, "Pablo's Guy");
  assert.equal(campaignOpBonus(0), 0);
  assert.equal(campaignOpBonus(50), 0.05);
  assert.equal(campaignOpBonus(500), 0.1);
  assert.ok(liveOdds({ odds: 0.7 } as never, 90) < liveOdds({ odds: 0.7 } as never, 40));
});

/** A season: 28 New York days, every job a day with the first (riskier) or the last (safer) option. */
function season(seed: number, pick: "first" | "last", layLow = false) {
  const rng = seeded(seed);
  const s: UnderworldState = newState(DAY);
  let net = 0, held = 0, busts = 0, jobs = 0;
  for (let d = 0; d < 28; d++) {
    const day = addDays(DAY, d);
    const c = ctx();
    const r = refresh(content, s, day, c, rng);
    for (const p of r.payouts) net += p.amount;
    held += r.holding;
    if (layLow && s.heat >= 40) continue;
    for (const id of s.offers.ids) {
      if (s.heat >= UNDERWORLD.heat.refuse) break;
      const job = content.jobs.find((j) => j.id === id)!;
      const o = pick === "first" ? job.options[0] : job.options[job.options.length - 1];
      const x = doJob(content, s, id, o.id, day, c, rng);
      for (const p of x.payouts) net += p.amount;
      held += x.holding;
      jobs++;
      if (x.outcome === "bust") busts++;
    }
  }
  return { net, held, busts, rate: busts / Math.max(1, jobs), rep: s.rep, heat: s.heat };
}

test("tuning: both styles pay over a season, the careful one gets caught less, and nobody is ruined", () => {
  const runs = (pick: "first" | "last", layLow = false) => Array.from({ length: 200 }, (_, i) => season(i + 1, pick, layLow));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const bold = runs("first"), safe = runs("last"), smart = runs("first", true);
  const report = (n: string, r: ReturnType<typeof runs>) =>
    console.log(`${n}: net C$${Math.round(avg(r.map((x) => x.net)))} / 28 days, busts ${avg(r.map((x) => x.busts)).toFixed(1)} (${Math.round(avg(r.map((x) => x.rate)) * 100)}% of jobs), holding ${avg(r.map((x) => x.held)).toFixed(1)} h, rep ${Math.round(avg(r.map((x) => x.rep)))}`);
  report("bold", bold); report("safe", safe); report("bold, lays low", smart);
  assert.ok(avg(bold.map((x) => x.net)) > 0 && avg(safe.map((x) => x.net)) > 0);
  assert.ok(avg(safe.map((x) => x.rate)) < avg(bold.map((x) => x.rate)));
  assert.ok(avg(smart.map((x) => x.rate)) < avg(bold.map((x) => x.rate)));
  // A season of jobs reaches the bigger tiers.
  assert.ok(avg(bold.map((x) => x.rep)) >= 35);
});
