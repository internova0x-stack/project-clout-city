// The meter tests you, not confirms you (owner, Nov 3: "If halo players only get asked for good favors and hustler players
// only get proposed angles, then there is no real dilemma"): temptations grow with trust, Hustlers get a way back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { CHOICES, cardView, pullOf, pullText, repBonus, resolveChoice, type ChoiceCard } from "../lib/choices.ts";

const dir = new URL("../content/choices/", import.meta.url);
const ALL = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as ChoiceCard[]);
const FAVOR = ALL.find((c) => c.id === "favor-sal-freezer")!;
const TEMPT = ALL.find((c) => c.id === "hot-phones-market")!;
const PLAIN: Pick<ChoiceCard, "where"> = { where: { after: ["arrive"] } };

test("ordinary cards keep each end's own bonus", () => {
  assert.deepEqual(pullOf(PLAIN, 1, 80), { cash: 1, clout: CHOICES.haloClout });
  assert.deepEqual(pullOf(PLAIN, -1, 20), { cash: CHOICES.hustlerCash, clout: 1 });
  assert.deepEqual(pullOf(PLAIN, -1, 80), { cash: 1, clout: 1 });
});

test("favors: a Halo is tempted most, more so by a close friend; a Hustler's good deed pays more", () => {
  assert.equal(pullOf(FAVOR, -1, 80).cash, CHOICES.temptHalo);
  assert.equal(pullOf(FAVOR, -1, 50).cash, CHOICES.temptMiddle);
  assert.equal(pullOf(FAVOR, -1, 20).cash, 1, "no Hustler bonus on a favor");
  assert.equal(pullOf(FAVOR, -1, 80, "family").cash, CHOICES.temptHalo * CHOICES.bondFamily);
  assert.equal(pullOf(FAVOR, -1, 50, "friend").cash, CHOICES.temptMiddle * CHOICES.bondFriend);
  assert.equal(pullOf(FAVOR, 1, 20).clout, CHOICES.redeem);
  assert.equal(pullOf(FAVOR, 1, 80).clout, 1, "no Halo bonus on a favor");
  assert.deepEqual(repBonus({ cash: 300, integrity: -12 }, 86, FAVOR, "family"), { cash: 675, integrity: -12 });
});

test("former Hustler-only angles reach everyone, and pay more the further you are from Hustler", () => {
  assert.equal(TEMPT.needs?.integrityMax, undefined);
  assert.equal(TEMPT.pull, "tempt");
  const at = (n: number) => pullOf(TEMPT, -1, n).cash;
  assert.ok(at(86) > at(50) && at(50) >= at(18));
  for (const c of ALL) if (c.needs?.integrityMax !== undefined) assert.equal(c.pull, "redeem", `${c.id}: Hustler-only cards are ways back`);
  assert.ok(ALL.filter((c) => c.pull === "redeem").length >= 5);
});

test("the card shows what the choice will pay", () => {
  const v = cardView(FAVOR, 1, "ditmars-deli", null, { integrity: 86, bond: "friend" });
  assert.equal(v.options.find((o) => o.id === "sell")!.get, "C$563 in pastrami money");
  assert.equal(cardView(FAVOR, 1, null).options.find((o) => o.id === "sell")!.get, "C$300 in pastrami money");
  assert.equal(pullText("40 clout and a hug", { cash: 1, clout: 1.5 }), "60 clout and a hug");
  assert.equal(pullText("C$2,000 profit", { cash: 1.25, clout: 1 }), "C$2,500 profit");
});

test("favors play the card's own odds whatever the meter says", () => {
  const card: ChoiceCard = {
    id: "t", base: "t", area: "life", emoji: "x", title: "t", who: "sal", where: { after: ["talk"] },
    options: [{ id: "a", label: "a", get: "g", cost: "c", outcomes: [{ weight: 1, text: "t", effects: { integrity: 5 }, later: { afterDays: [1, 1], chance: 0.5, text: "l", effects: { clout: 10 } } }] }, { id: "b", label: "b", get: "g", cost: "c", outcomes: [{ weight: 1, text: "t", effects: { integrity: -5 } }] }],
  } as ChoiceCard;
  // rng 0.6 is above the card's 0.5; a Halo's "own game" ×1.5 would have made it land.
  const seq = [0.1, 0.6];
  const r = resolveChoice(card, "a", "2026-11-03", () => seq.shift()!, 90);
  assert.equal(r.later, null);
});
