import { test } from "node:test";
import assert from "node:assert/strict";
import { goalShare, halfwayPay, momentText, surpriseFor, surpriseOptions, SURPRISE } from "../lib/rewards.ts";

test("halfway: only goals with an amount to reach", () => {
  assert.equal(goalShare([{ have: 0, need: 1 }]), null);
  assert.equal(goalShare([]), null);
  assert.equal(goalShare([{ have: 8000, need: 16000 }]), 0.5);
  assert.equal(goalShare([{ have: 20, need: 10 }, { have: 0, need: 4 }]), 0.5);
  assert.equal(halfwayPay(75), 18);
  assert.equal(halfwayPay(2), 1);
});

test("surprises fit the player", () => {
  assert.deepEqual(surpriseOptions({ rank: 1, atNightlife: false, invite: null }), ["freebie"]);
  const inv = { move: "crab-breakfast", title: "Crab", place: "p", placeName: "P", host: "Nassim", face: null };
  const o = surpriseOptions({ rank: 3, atNightlife: true, invite: inv });
  assert.ok(o.includes("selfie") && o.includes("drink") && o.includes("invite"));
  assert.equal(surpriseFor("freebie", 4, null).cash, SURPRISE.freebieCash(4));
  assert.equal(surpriseFor("selfie", 5, null).clout, 50);
  assert.equal(surpriseFor("invite", 3, inv).invite?.move, "crab-breakfast");
  // surprise_give's caps (migration 0177): C$1,000, 200 clout, 20 Energy, 10 Mood.
  for (let r = 1; r <= 10; r++) {
    assert.ok(SURPRISE.freebieCash(r) <= 1000 && SURPRISE.selfieClout(r) <= 200);
  }
  assert.ok(SURPRISE.drink.energy <= 20 && SURPRISE.drink.mood <= 10);
  for (const k of ["freebie", "selfie", "drink", "invite"] as const) assert.ok(surpriseFor(k, 3, inv).line.length <= 140);
});

test("moments", () => {
  assert.equal(momentText("career_promo"), "A promotion");
  assert.equal(momentText("weird"), "Something you did");
});
