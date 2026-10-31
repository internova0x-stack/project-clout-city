import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHARACTERS, careerPersonId, characterById, charactersAt } from "../lib/characters.ts";
import { REMEMBER, remembered, rememberedTap, validateRemembers, type RememberRule } from "../lib/characterMemory.ts";
import { EMPTY_MEMORY } from "../lib/storylets.ts";
import { REGULARS } from "../lib/cast.ts";
import { PLACES } from "../lib/city.ts";
import type { Fact, FactKey, Memory } from "../lib/memory.ts";

const RULES: RememberRule[] = JSON.parse(readFileSync(new URL("../content/characters/remembers.json", import.meta.url), "utf8"));
const f = (key: FactKey, subject = "", count = 1): Fact => ({ key, subject, value: {}, count, first: "2026-11-01T12:00:00Z", last: "2026-11-01T12:00:00Z", expires: null });
const mem = (facts: Fact[], snap: Partial<Memory["snapshot"]> = {}): Memory => ({ snapshot: { ...EMPTY_MEMORY.snapshot, ...snap }, facts });

test("one registry: every regular, the Mayor, the cast, the career people and Sir Barksley, ids unique, places real", () => {
  const ids = CHARACTERS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of REGULARS) assert.equal(characterById(r.id)?.place, r.placeId);
  assert.equal(characterById("mayor-papa-dani")?.kind, "official");
  assert.equal(characterById(careerPersonId("tech", "rival"))?.name, "Brent");
  assert.equal(characterById("sir-barksley")?.kind, "pet");
  for (const c of CHARACTERS) if (c.place) assert.ok(PLACES.some((p) => p.id === c.place), `${c.id}: ${c.place}`);
  assert.ok(charactersAt("triborough-works").some((c) => c.kind === "boss"));
});

test("every remembered line passes; most regulars remember something", () => {
  assert.deepEqual(validateRemembers(RULES), []);
  assert.ok(RULES.length >= 40);
  assert.ok(new Set(RULES.map((r) => r.who)).size >= 20);
  const bad = validateRemembers([{ id: "x", who: "nobody", when: { all: [{ has: "career.nonsense" as FactKey }] }, lines: ["{who} said hi"] }]).join("; ");
  assert.match(bad, /unknown character/); assert.match(bad, /unknown fact/); assert.match(bad, /unknown slot/);
});

test("they remember what fits: a ban with the place's name, a partner, nothing for a stranger", () => {
  assert.deepEqual(remembered(RULES, mem([]), "2026-11-02"), {});
  assert.deepEqual(remembered(RULES, null, "2026-11-02"), {});
  const banned = remembered(RULES, mem([f("place.banned", "the-sticky-floor")]), "2026-11-02");
  assert.ok(banned.sal?.some((l) => l.includes("The Sticky Floor")));
  assert.ok(banned.lola?.some((l) => l.includes("The Sticky Floor")));
  const official = remembered(RULES, mem([f("dating.official", "p")]), "2026-11-02");
  assert.ok(official.mags?.length);
  // Old news is forgotten: an official couple from long ago isn't news at the bar.
  assert.equal(remembered(RULES, mem([f("dating.official", "p")]), "2027-01-02").mags, undefined);
  // No more than a few lines each.
  const busy = remembered(RULES, mem([f("place.banned", "the-sticky-floor"), f("police.held", "", 3), f("police.bailed"), f("money.lotto_win", "", 4)]), "2026-11-02");
  for (const lines of Object.values(busy)) assert.ok(lines.length <= REMEMBER.perCharacter);
});

test("a remembered line every few taps", () => {
  assert.equal(rememberedTap(undefined, 0), null);
  assert.equal(rememberedTap(["a", "b"], 1), null);
  assert.equal(rememberedTap(["a", "b"], 0), "a");
  assert.equal(rememberedTap(["a", "b"], REMEMBER.everyTaps), "b");
});
