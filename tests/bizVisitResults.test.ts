import test from "node:test";
import assert from "node:assert/strict";
import { publicCelebration, upgradeBanner } from "../components/business/results.ts";
import { guestBanner, hostResult, visitRoomRead, visitStateRead } from "../components/home/visitResults.ts";
import { BUSINESSES } from "../lib/businesses.ts";
import type { Celebration } from "../components/Celebrate.tsx";
import type { VisitRoom, VisitState } from "../lib/visits.ts";

test("an upgrade is a banner with the new pay; the third says fully upgraded", () => {
  const b = upgradeBanner("hot-dog-cart", 1)!;
  assert.equal(b.rung, 2);
  assert.equal(b.title, "Second umbrella");
  assert.equal(b.rewards?.[0].text, "C$1,125 a day");
  assert.match(upgradeBanner("hot-dog-cart", 3)!.tag, /Fully upgraded/);
  assert.equal(upgradeBanner("nope", 1), null);
});

test("going public on the last business is the legend", () => {
  const last = BUSINESSES[BUSINESSES.length - 1].id;
  const c = publicCelebration(last, 50_000, 1_000_000_000, "you")!;
  assert.equal(c.rung, 4);
  assert.equal(c.num, "×3");
  assert.equal(c.cta, "Act humble");
  assert.equal(publicCelebration(BUSINESSES[0].id, 0, 0, "you")!.rung, 3);
});

const open = { id: 7, kind: "party" as const, capacity: 4, crib: 50, paid: 4, ends: "2026-11-04T00:00:00Z" };

test("host: a full house is a win with the clout, guests against capacity and the keep pills", () => {
  const c = hostResult(open);
  assert.equal(c.result?.tone, "win");
  assert.equal(c.result?.stamp?.text, "FULL HOUSE");
  assert.equal(c.result?.amount, 4 * 30);
  assert.deepEqual(c.result?.meter && [c.result.meter.have, c.result.meter.need], [4, 4]);
  assert.deepEqual(c.result?.keep, ["🏆 Crib Rating 50: ×1.50 clout", "🙂 +24 Mood", "👥 4 guests stayed"]);
});

test("host: fewer than half is a near miss, nobody is Solo; both keep their colour and a next step", () => {
  let again = 0;
  const near = hostResult({ ...open, paid: 1 }, () => { again++; });
  assert.equal(near.result?.tone, "warn");
  assert.equal(near.result?.stamp?.text, "SO CLOSE");
  near.onCta?.();
  assert.equal(again, 1);
  const none = hostResult({ ...open, paid: 0 });
  assert.equal(none.result?.tone, "lose");
  assert.equal(none.result?.big, "Solo");
  assert.ok((none.result?.keep ?? []).length > 0);
});

test("the host's card shows once, when the visit is gone from visit_state; a call-off before it starts shows nothing", () => {
  const mem = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  g.window = {};
  g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const shown: Celebration[] = [];
  const ctx = { who: "me", show: (c: Celebration) => void shown.push(c) };
  const now = Date.parse("2026-11-04T20:00:00Z");
  const base: VisitState = { hosting: null, invites: [], invitable: [], capacity: 3, snacks: 100, left: { hang: 3, party: 1 }, blocked: null, crib: 20 };
  const guest = (paid: boolean) => ({ id: "a", name: "a", style: "x", look: null, status: "accepted" as const, here: true, paid });
  const live: VisitState = { ...base, hosting: { id: 1, kind: "hang", starts: new Date(now - 60e3).toISOString(), ends: new Date(now + 60e3).toISOString(), capacity: 3, crib: 20, guests: [guest(true), { ...guest(true), id: "b" }] } };
  visitStateRead(live, ctx, now);
  assert.equal(shown.length, 0);
  visitStateRead(base, ctx, now);
  visitStateRead(base, ctx, now);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].result?.amount, 2 * 10);
  const later: VisitState = { ...base, hosting: { ...live.hosting!, id: 2, starts: new Date(now + 3600e3).toISOString() } };
  visitStateRead(later, ctx, now);
  visitStateRead(base, ctx, now);
  assert.equal(shown.length, 1);

  const room = (paid: boolean): VisitRoom => ({ id: 9, kind: "party", starts: "", ends: "", over: false, host: { id: "k", name: "kai_beats", style: "x", look: null },
    mine: false, crib: 0, me: { status: "accepted", paid }, people: [], messages: [] });
  assert.equal(visitRoomRead(room(false), room(true), ctx), true);
  assert.equal(visitRoomRead(room(false), room(true), ctx), false);
  assert.equal(guestBanner(room(true)).rung, 2);
  delete g.window;
  delete g.localStorage;
});
