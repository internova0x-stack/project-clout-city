import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  CHOICES, addDays, applyIntegrity, boundEffects, cardView, effectLine, fit, integrityBand, mayOffer, pickCard, resolveChoice, validateCards,
  type ChoiceCard, type ChoiceContext,
} from "../lib/choices.ts";
import { PLACES } from "../lib/city.ts";
import { REGULARS } from "../lib/cast.ts";

const dir = new URL("../content/choices/", import.meta.url);
const CARDS: ChoiceCard[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
const npcs = JSON.parse(readFileSync(new URL("../content/culture/npcs.json", import.meta.url), "utf8"));
const known = {
  places: PLACES.map((p) => p.id),
  tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))],
  npcs: [...new Set([...REGULARS.map((r) => r.id), ...npcs.profiles.map((p: { id: string }) => p.id), ...npcs.roommates.map((p: { id: string }) => p.id)])],
};
const ctx = (o: Partial<ChoiceContext> = {}): ChoiceContext => ({
  place: "astoria-blvd-station", tags: ["subway", "transit"], after: "arrive", integrity: 70, rank: 1, student: false, business: false, roommate: false,
  history: [], today: "2026-11-02", ...o,
});
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

test("every card file follows the rules", () => {
  assert.deepEqual(validateCards(CARDS, known), []);
});

test("the launch pool: about 25 dilemmas, in 2 or 3 variants, across every area", () => {
  const bases = new Map<string, number>();
  for (const c of CARDS) bases.set(c.base, (bases.get(c.base) ?? 0) + 1);
  assert.ok(bases.size >= 25, `${bases.size} dilemmas`);
  assert.ok(CARDS.length >= 60, `${CARDS.length} cards`);
  for (const area of ["life", "transit", "gigs", "work", "school", "business", "home", "nightlife", "dating", "money"]) {
    assert.ok(CARDS.some((c) => c.area === area), `no ${area} card`);
  }
  // Somewhere for every player: a card that fits a newcomer arriving at a free Astoria place.
  assert.ok(CARDS.some((c) => !c.needs && fit(c, ctx({ place: "hell-gate-park", tags: ["park", "outdoors", "free", "astoria"] })) > 0));
});

test("Integrity: losses in full, gains at half, always 0 to 100", () => {
  assert.equal(applyIntegrity(70, -10), 60);
  assert.equal(applyIntegrity(70, 10), 75);
  assert.equal(applyIntegrity(70, 3), 71);
  assert.equal(applyIntegrity(5, -20), 0);
  assert.equal(applyIntegrity(99, 20), 100);
  assert.equal(integrityBand(70), "high");
  assert.equal(integrityBand(39), "low");
  assert.equal(integrityBand(50), "middle");
});

test("a card fits its place, its moment and the player; cooldowns keep it fresh", () => {
  const wallet = CARDS.find((c) => c.id === "found-wallet-subway")!;
  assert.ok(fit(wallet, ctx()) > 0);
  assert.equal(fit(wallet, ctx({ place: "grind-and-gossip", tags: ["cafe"] })), 0, "wrong place");
  assert.equal(fit(wallet, ctx({ after: "shift" })), 0, "wrong moment");
  assert.equal(fit(wallet, ctx({ history: [{ id: wallet.id, base: wallet.base, day: addDays("2026-11-02", -29) }] })), 0, "30-day cooldown");
  assert.ok(fit(wallet, ctx({ history: [{ id: wallet.id, base: wallet.base, day: addDays("2026-11-02", -30) }] })) > 0);
  assert.equal(fit(wallet, ctx({ history: [{ id: "other", base: wallet.base, day: addDays("2026-11-02", -6) }] })), 0, "a week between variants");
  const named: ChoiceCard = { ...wallet, id: "x", where: { places: ["astoria-blvd-station"] } };
  assert.ok(fit(named, ctx()) > fit(wallet, ctx()), "a named place beats a tag");
  assert.equal(fit({ ...wallet, needs: { student: true } }, ctx()), 0);
  assert.equal(fit({ ...wallet, needs: { integrityMin: 80 } }, ctx()), 0);
  assert.equal(pickCard([wallet], ctx({ after: "shift" }), Math.random), null);
});

test("never more than two a day, never two in a row, never over a waiting card", () => {
  const now = new Date("2026-11-02T18:00:00Z");
  assert.ok(mayOffer({ shownToday: 1, lastShownAt: "2026-11-02T15:00:00Z", open: false, now }));
  assert.ok(!mayOffer({ shownToday: CHOICES.perDay, lastShownAt: null, open: false, now }));
  assert.ok(!mayOffer({ shownToday: 1, lastShownAt: "2026-11-02T17:00:00Z", open: false, now }));
  assert.ok(!mayOffer({ shownToday: 0, lastShownAt: null, open: true, now }));
});

test("the browser's view leaves out every outcome, and marks what may come back", () => {
  const wallet = CARDS.find((c) => c.id === "found-wallet-subway")!;
  const v = cardView(wallet, 7, "astoria-blvd-station");
  const json = JSON.stringify(v);
  assert.ok(!/outcomes|weight|later|effects/.test(json), json);
  assert.ok(v.options.every((o) => o.comesBack));
});

test("resolving rolls an outcome and, sometimes, a consequence on a later day", () => {
  const wallet = CARDS.find((c) => c.id === "found-wallet-subway")!;
  const r = resolveChoice(wallet, "return", "2026-11-02", seq(0.1, 0.1, 0.0));
  assert.equal(r.effects.integrity, 8);
  assert.ok(r.later && r.later.due >= "2026-11-03" && r.later.due <= "2026-11-06");
  const none = resolveChoice(wallet, "return", "2026-11-02", seq(0.1, 0.99));
  assert.equal(none.later, null);
  assert.throws(() => resolveChoice(wallet, "nope", "2026-11-02", Math.random), /unknown_option/);
});

test("effects are capped, and a loss never takes more than the bank holds", () => {
  assert.deepEqual(boundEffects({ cash: -900, clout: 999 }, 200), { cash: -200, clout: CHOICES.caps.clout, mood: undefined, energy: undefined, integrity: undefined });
  assert.equal(effectLine({ cash: 300, integrity: -8 }), "+C$300 · −8 Integrity");
});

test("three regulars can feel your Integrity, in words, never the number", async () => {
  const { reputationLine } = await import("../lib/culture.ts");
  const profiles = npcs.profiles;
  for (const id of ["sal", "jojo", "gus"]) {
    assert.ok(reputationLine(profiles, id, "high", 0) && reputationLine(profiles, id, "low", 1), id);
    assert.equal(reputationLine(profiles, id, "middle", 0), null);
    for (const l of [...profiles.find((p: { id: string }) => p.id === id).reputation.high, ...profiles.find((p: { id: string }) => p.id === id).reputation.low]) {
      assert.ok(l.length <= 240 && !/\d+ ?integrity|integrity/i.test(l), l);
    }
  }
});
