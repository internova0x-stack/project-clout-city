import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { brandHits, slangCount, validateCulture, withCatchphrases, type CultureData } from "../lib/culture.ts";
import { PLACES, boroughOf } from "../lib/city.ts";
import { REGULARS } from "../lib/cast.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data: CultureData = {
  slang: JSON.parse(read("content/culture/slang.json")),
  parody: JSON.parse(read("content/culture/parody-names.json")),
  npcs: JSON.parse(read("content/culture/npcs.json")),
};

test("culture files: 30 slang terms, one profile per Astoria place, regulars where they stand", () => {
  const astoria = PLACES.filter((p) => p.neighborhood === "Astoria" && boroughOf(p) === "queens").map((p) => p.id);
  assert.deepEqual(validateCulture(data, { placeIds: PLACES.map((p) => p.id), astoria, regulars: REGULARS }), []);
  // Every Astoria place that isn't a story's has someone on its card.
  for (const id of astoria.filter((id) => !PLACES.find((p) => p.id === id)!.story)) {
    assert.ok(REGULARS.some((r) => r.placeId === id), `${id} has a regular`);
  }
});

test("backgrounds vary: no two people share one, and no group is only service staff", () => {
  const bgs = data.npcs.profiles.map((p) => p.background);
  assert.equal(new Set(bgs).size, bgs.length);
  const service = /barista|waitress|clerk|station agent|desk sergeant|store manager/;
  for (const group of ["Greek", "Egyptian", "Brazilian", "Colombian"]) {
    const people = data.npcs.profiles.filter((p) => p.background.startsWith(group));
    assert.ok(people.length >= 2, `${group}: at least two people`);
    assert.ok(people.some((p) => !service.test(p.role)), `${group}: someone outside service roles`);
  }
});

test("brandHits: whole words, case only where it matters", () => {
  const names = data.parody.names;
  assert.deepEqual(brandHits("Catch the Mets tonight", names), ["Mets"]);
  assert.deepEqual(brandHits("The Momager Files, a Colombian bakery, the gentle giant, metal nets", names), []);
  assert.deepEqual(brandHits("Grab a Coke and an Uber", names), ["Uber", "Coke"]);
  assert.deepEqual(brandHits("the Metro Rail Authority", names), []);
});

test("no real brand, team or trademarked name in the game's copy or content", () => {
  const files = (dir: string): string[] => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? files(p) : /\.(ts|tsx|json)$/.test(f) ? [p] : [];
  });
  const all = [...files("content"), ...files("lib"), ...files("components"), ...files("app")]
    .filter((p) => p !== "content/culture/parody-names.json");
  const found = all.flatMap((p) => brandHits(read(p), data.parody.names).map((h) => `${p}: ${h}`));
  assert.deepEqual(found, []);
});

test("Lola's tour and tasks nudge: one or two slang terms per line", () => {
  const src = read("components/game/Tutorial.tsx");
  const lines = [...src.matchAll(/text: "((?:[^"\\]|\\.)*)"/g), ...src.matchAll(/DAILY_HINT_TEXT = "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.equal(lines.length, 7);
  for (const l of lines) {
    const n = slangCount(l, data.slang.terms);
    assert.ok(n >= 1 && n <= 2, `${n} slang terms: "${l.slice(0, 40)}…"`);
  }
});

test("catchphrases join a regular's everyday lines, once each; story people stay out", () => {
  const merged = withCatchphrases({ sal: ["a"] }, [
    { ...data.npcs.profiles[0], regular: "sal", catchphrases: ["a", "b"] },
    { ...data.npcs.profiles[0], id: "x", regular: "gus", story: "sarah-bird", catchphrases: ["c"] },
  ]);
  assert.deepEqual(merged, { sal: ["a", "b"] });
});

test("C6: the four date spots are real places where a date night works", async () => {
  const { readFileSync } = await import("node:fs");
  const { PLACES } = await import("../lib/city.ts");
  const { canDateAt } = await import("../lib/dating.ts");
  const spots = JSON.parse(readFileSync(new URL("../content/culture/date-spots.json", import.meta.url), "utf8")).spots as { place: string; line: string }[];
  assert.equal(spots.length, 4);
  for (const s of spots) {
    const p = PLACES.find((x) => x.id === s.place);
    assert.ok(p && canDateAt(p) && !p.story, s.place);
    assert.ok(s.line.length > 20 && s.line.length <= 200, s.place);
  }
  assert.equal(PLACES.find((p) => p.id === "downstairs-on-main")?.neighborhood, "Flushing");
});
