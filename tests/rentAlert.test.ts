import { test } from "node:test";
import assert from "node:assert/strict";

// The rent alarm (owner, Oct 22): a card and a red bank pill when rent is coming and the bank can't cover it.
test("the rent alarm: short before rent, late or eviction after, quiet when the bank covers it", async () => {
  const { sampleCityState } = await import("../lib/citySim.ts");
  const { rentAlert } = await import("../lib/cityState.ts");
  const base = (cash: number, rentIn: number | null) => {
    const s = sampleCityState({ bank_cash: cash, home_id: "astoria_studio" });
    const day = (n: number) => new Date(Date.parse(`${s.today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    s.bills = s.bills.map((b) => ({ ...b, status: "paid" as const }));
    s.player.next_rent_due = rentIn === null ? day(20) : day(rentIn);
    s.player.next_phone_due = day(20);
    return { s, day };
  };
  // Plenty of cash, or rent far off: nothing.
  assert.equal(rentAlert(base(5000, 2).s), null);
  assert.equal(rentAlert(base(100, 6).s), null);
  // Rent in two days, C$930 against C$1,750: short.
  const short = rentAlert(base(930, 2).s)!;
  assert.equal(short.level, "short");
  assert.equal(short.short, 820);
  assert.match(short.title, /in 2 days/);
  // A day late and short: late, find a gig.
  const { s: late, day } = base(930, null);
  late.bills.push({ id: 9, kind: "rent", amount: 1750, due_date: day(-1), status: "due", paid_at: null });
  assert.equal(rentAlert(late)!.level, "late");
  assert.equal(rentAlert(late)!.canPay, false);
  // Four days late: past the grace period, the move-out countdown.
  const { s: evict, day: d2 } = base(5000, null);
  evict.bills.push({ id: 9, kind: "rent", amount: 1750, due_date: d2(-4), status: "due", paid_at: null });
  const e = rentAlert(evict)!;
  assert.equal(e.level, "evict");
  assert.equal(e.canPay, true);
  assert.match(e.title, /move out in 2 days/);
  // Due today and affordable: the Bills badge is enough.
  const { s: today, day: d3 } = base(5000, null);
  today.bills.push({ id: 9, kind: "phone", amount: 60, due_date: d3(0), status: "due", paid_at: null });
  assert.equal(rentAlert(today), null);
});
