import { test } from "node:test";
import assert from "node:assert/strict";

// Bad news as near-miss results cards (components/game/badNews.ts; owner, Nov 4): the colour stays, You keep pills on
// every card, one button.

test("an eviction: found in the bills, EVICTED, the back rent wiped, days late against the door", async () => {
  const { sampleCityState } = await import("../lib/citySim.ts");
  const { CITY_ECONOMY } = await import("../lib/city.ts");
  const { evictionOf, evictionResult } = await import("../components/game/badNews.ts");
  const s = sampleCityState({ bank_cash: 100, home_id: "astoria_share" });
  const day = (n: number) => new Date(Date.parse(`${s.today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  assert.equal(evictionOf(s), null);
  s.bills = [...s.bills, { id: 300, kind: "rent", amount: 425, due_date: day(-6), status: "forgiven", paid_at: null },
    { id: 301, kind: "rent", amount: 225, due_date: day(0), status: "due", paid_at: null }];
  const e = evictionOf(s)!;
  assert.equal(e.key, 300);
  assert.equal(e.backRent, 425);
  assert.equal(e.lateDays, CITY_ECONOMY.bills.evictAfterDays);
  let gigs = 0;
  const c = evictionResult(e, { gigs: () => { gigs++; } });
  assert.equal(c.result?.tone, "lose");
  assert.equal(c.result?.stamp?.text, "EVICTED");
  assert.equal(c.result?.amount, 425);
  assert.equal(c.cta, "Find a gig");
  c.onCta?.();
  assert.equal(gigs, 1);
  assert.ok((c.result?.keep ?? []).length >= 3);
  // An old eviction stays quiet.
  const old = sampleCityState({});
  old.bills = [{ id: 1, kind: "rent", amount: 425, due_date: day(-30), status: "forgiven", paid_at: null }, { id: 2, kind: "rent", amount: 225, due_date: day(-24), status: "paid", paid_at: null }];
  assert.equal(evictionOf(old), null);
});

test("a breakup: warn, the couple streak reached, the badge kept, back to the city", async () => {
  const { breakupResult } = await import("../components/game/badNews.ts");
  const c = breakupResult({ id: 1, name: "jojo", reason: "mine", streak: 9 });
  assert.equal(c.result?.tone, "warn");
  assert.equal(c.result?.stamp, undefined);
  assert.deepEqual(c.result?.meter && [c.result.meter.have, c.result.meter.need], [9, 14]);
  assert.equal(c.result?.keep?.[0], "💞 7-day couple streak");
  assert.equal(c.cta, "Back to the city");
  assert.equal(breakupResult({ id: 2, name: "jojo", reason: "breakup", streak: null }).result?.meter, undefined);
});

test("a broken streak: the run against your best or the next milestone; Repair it while a repair is open", async () => {
  const { streakBrokenResult, nextMilestone } = await import("../components/game/badNews.ts");
  assert.equal(nextMilestone(12), 14);
  const r = streakBrokenResult({ lastDay: "2026-11-01", run: 12, best: 12, paid: 2, passes: 1, repair: true });
  assert.equal(r.cta, "Repair it");
  assert.equal(r.result?.amount, 12);
  assert.deepEqual(r.result?.meter && [r.result.meter.have, r.result.meter.need], [12, 14]);
  assert.deepEqual(r.result?.keep, ["2 rewards paid", "🎟️ 1 guest pass", "🏆 Best: 12 days"]);
  const b = streakBrokenResult({ lastDay: "2026-11-01", run: 5, best: 20, paid: 1, passes: 0, repair: false });
  assert.equal(b.cta, "Start a new run");
  assert.deepEqual(b.result?.meter && [b.result.meter.have, b.result.meter.need], [5, 20]);
});

test("a sublet ending: the deposit back for the subtenant, the weeks stayed, a rating to give", async () => {
  const { subletEndedResult } = await import("../components/game/badNews.ts");
  const w = { id: "x", name: "remy", style: "casual", rating: { avg: null, count: 0 }, days: 30 };
  const sub = subletEndedResult({ id: 4, role: "sub", reason: "done", with: w, deposit: 150, rated: false }, { id: 4, week: 3, weeks: 3 } as never);
  assert.equal(sub.result?.tone, "warn");
  assert.equal(sub.result?.amount, 150);
  assert.equal(sub.cta, "Rate @remy");
  assert.equal(sub.result?.keep?.[0], "C$150 deposit");
  const host = subletEndedResult({ id: 5, role: "host", reason: "left", with: w, deposit: 150, rated: true }, null);
  assert.equal(host.result?.amount, undefined);
  assert.equal(host.cta, "Back to the city");
});
