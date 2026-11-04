import test from "node:test";
import assert from "node:assert/strict";
import { jobResult, shortLine } from "../components/underworld/result.ts";
import type { UnderworldView } from "../lib/underworld.ts";

const tito = { id: "tito", name: "Tito", emoji: "🚐", role: "Driver", loyalty: 80, line: "", covers: true };
const v = (o: Partial<UnderworldView> = {}): UnderworldView => ({
  invited: true, hint: null, rep: 20, tier: { name: "Corner Regular", emoji: "🧍" }, next: { name: "Known Face", at: 35 }, heat: 30,
  heatBand: "warm", offers: [], here: true, holding: false, tooHot: false, lawyer: { on: false, until: null, cost: 400, free: false },
  landed: [], receipts: [], greet: "", intro: null, stats: { jobs: 0, busts: 0, earned: 0 }, crew: [tito], table: null, ...o,
});
const offer = { id: "j", emoji: "🎃", title: "Pumpkin pivot", done: false, crew: { name: "Tito", emoji: "🚐" }, options: [] };

test("a paid job is a win card: the cut, Street Rep toward the next tier, the crew's loyalty", () => {
  const c = jobResult(offer, v(), { view: v({ rep: 24, crew: [{ ...tito, loyalty: 86 }] }), outcome: "win", receipt: "Gourds sold out by noon. +C$320.", cash: 320, held: 0 });
  assert.equal(c?.result?.tone, "win");
  assert.equal(c?.result?.amount, 320);
  assert.equal(c?.result?.story, "Gourds sold out by noon.");
  assert.deepEqual(c?.result?.meter && [c.result.meter.have, c.result.meter.need], [24, 35]);
  assert.deepEqual(c?.result?.keep, ["+4 Street Rep", "🚐 Tito +6 loyalty", "🧍 Corner Regular"]);
});

test("caught: CAUGHT, the fine, Heat against 80, home, job and crew kept, the button to the bench", () => {
  let bench = 0;
  const c = jobResult(offer, v(), { view: v({ rep: 16, heat: 48 }), outcome: "bust", receipt: "Sgt. Bev was at the farmers market. It cost you a C$300 fine and 2 hours in holding.", cash: -300, held: 2 }, () => { bench++; });
  assert.equal(c?.result?.tone, "lose");
  assert.equal(c?.result?.stamp?.text, "CAUGHT");
  assert.equal(c?.result?.amount, 300);
  assert.equal(c?.result?.story, "Sgt. Bev was at the farmers market.");
  assert.equal(c?.result?.meter?.need, 80);
  assert.deepEqual(c?.result?.keep, ["Your home", "Your job", "Your crew"]);
  assert.equal(c?.cta, "Go to the bench");
  c?.onCta?.();
  assert.equal(bench, 1);
});

test("a crew member taking the fall is a near miss, never grey", () => {
  const c = jobResult(offer, v(), { view: v({ crew: [{ ...tito, covers: false }] }), outcome: "bust", receipt: "Busted. Tito says it was his van.", cash: 0, held: 0 });
  assert.equal(c?.result?.tone, "warn");
  assert.equal(c?.title, "Tito took the fall");
});

test("the story line stays short", () => {
  assert.ok(shortLine("Short one. " + "A long sentence that goes on and on, ".repeat(4) + "done. Third.").length <= 120);
});
