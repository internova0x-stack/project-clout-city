import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CELEBRITIES, REGULARS, WANNABES, regularAt, regularLine } from "../lib/cast.ts";
import { PLACES } from "../lib/city.ts";

const evergreen = JSON.parse(readFileSync(new URL("../content/cast-lines.json", import.meta.url), "utf8")) as Record<string, string[]>;
const generic = JSON.parse(readFileSync(new URL("../content/chatter-generic.json", import.meta.url), "utf8")) as Record<string, string[]>;

test("the cast: one celebrity per type, unique ids, invented league-free types", () => {
  assert.equal(new Set(CELEBRITIES.map((c) => c.type)).size, 8);
  const ids = [...CELEBRITIES, ...WANNABES, ...REGULARS].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CELEBRITIES) assert.doesNotMatch(c.type, /NBA|NFL/);
});

test("every regular stands at a real place, speaks a known story role and has everyday lines", () => {
  for (const r of REGULARS) {
    assert.ok(PLACES.some((p) => p.id === r.placeId), r.placeId);
    assert.ok(generic[r.role], `${r.id}: role ${r.role}`);
    assert.ok((evergreen[r.id] ?? []).length >= 4, `${r.id}: at least four lines`);
    for (const l of evergreen[r.id]) assert.ok(l.length <= 240, `${r.id}: "${l.slice(0, 30)}…" fits the Studio limit`);
  }
  assert.equal(new Set(REGULARS.map((r) => r.placeId)).size, REGULARS.length, "one regular per place");
  for (const id of Object.keys(evergreen)) assert.ok(REGULARS.some((r) => r.id === id), `${id} in cast-lines.json is a regular`);
  assert.equal(regularAt("ditmars-deli")?.name, "Sal");
  assert.equal(regularAt("thread-count"), undefined);
});

test("lines: Studio lines join the everyday ones; a live story leads every other tap", () => {
  const sal = regularAt("ditmars-deli")!;
  const everyday = { sal: ["a", "b"] };
  assert.deepEqual([0, 1, 2].map((n) => regularLine(sal, n, { evergreen: everyday })), ["a", "b", "a"]);
  assert.deepEqual([0, 1, 2].map((n) => regularLine(sal, n, { evergreen: everyday, live: { sal: ["new"] } })), ["new", "a", "b"]);
  const story = { clerk: ["story!"] };
  assert.equal(regularLine(sal, 0, { evergreen: everyday, story }), "story!");
  assert.equal(regularLine(sal, 1, { evergreen: everyday, story }), "b");
  assert.equal(regularLine(sal, 0, { evergreen: {} }), "Nice day for it.");
});
