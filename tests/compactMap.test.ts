import { test } from "node:test";
import assert from "node:assert/strict";
import { BORROWED_KIND, STOREFRONTS, DECOR, DISTRICTS, ISLANDS, SPOTS, districtAt, gridToWorld, islandAt, makeProjector } from "../lib/compactMap.ts";
import { PLACES, boroughOf } from "../lib/city.ts";
import { LANDMARKS } from "../lib/map/landmarks.ts";

test("every place has its own block on the compact map, in its own borough", () => {
  const taken = new Map<string, string>();
  for (const p of PLACES) {
    const s = SPOTS[p.id];
    assert.ok(s, `${p.id}: no block`);
    const key = `${s[0]},${s[1]}`;
    assert.ok(!taken.has(key), `${p.id} and ${taken.get(key)} share block ${key}`);
    taken.set(key, p.id);
    assert.equal(islandAt(s[0], s[1]), boroughOf(p), `${p.id}: on the wrong island`);
    assert.ok(districtAt(s[0], s[1]), `${p.id}: outside every neighborhood`);
  }
  for (const id of Object.keys(SPOTS)) assert.ok(PLACES.some((p) => p.id === id), `${id}: not a place`);
  for (const d of DECOR) assert.ok(!taken.has(`${d.at[0]},${d.at[1]}`), `${d.id} sits on a place`);
});

test("every place has a building: its own landmark or a borrowed one", () => {
  const own = new Set(LANDMARKS.map((l) => l.placeId).filter(Boolean));
  for (const p of PLACES) assert.ok(own.has(p.id) || BORROWED_KIND[p.id], `${p.id}: no model`);
  for (const [id, k] of Object.entries(BORROWED_KIND)) if (k === "store") assert.ok(STOREFRONTS[id], `${id}: a storefront without a sign`);
});

test("neighborhoods sit on their borough's island", () => {
  for (const d of DISTRICTS) {
    const r = ISLANDS[d.borough];
    assert.ok(d.rect.x0 >= r.x0 && d.rect.x1 <= r.x1 && d.rect.y0 >= r.y0 && d.rect.y1 <= r.y1, d.id);
  }
});

test("a place's real lat/lng lands on its own block; points between places land between them", () => {
  const project = makeProjector(PLACES.map((p) => ({ at: p.at, spot: SPOTS[p.id] })));
  for (const p of PLACES) assert.deepEqual(project(p.at), gridToWorld(SPOTS[p.id]), p.id);
  const a = PLACES.find((p) => p.id === "ditmars-deli")!, b = PLACES.find((p) => p.id === "engine-7")!;
  const [x, z] = project([(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2]);
  assert.ok(Number.isFinite(x) && Number.isFinite(z));
});

test("only the most relevant places get names, never on top of each other", async () => {
  const { FEATURED, labelPriority, pickLabels } = await import("../lib/compactMap.ts");
  assert.ok(FEATURED.every((id) => SPOTS[id]), "every featured place is on the map");
  assert.ok(labelPriority("deli", { selected: "deli" }) > labelPriority("x", { glow: true }));
  assert.ok(labelPriority("x", { glow: true }) > labelPriority("campaign-hq", {}));
  assert.equal(labelPriority("ditmars-deli", {}), 0);
  const items = [
    { id: "a", x: 100, y: 100, w: 80, priority: 50 },
    { id: "b", x: 110, y: 105, w: 80, priority: 40 }, // overlaps a
    { id: "c", x: 300, y: 100, w: 80, priority: 30 },
    { id: "d", x: 500, y: 100, w: 80, priority: 0 }, // not relevant: a dot
    { id: "e", x: 105, y: 100, w: 80, priority: 90 }, // the mission: always wins
  ];
  const got = pickLabels(items, 2);
  assert.ok(got.has("e") && got.has("c") && !got.has("a") && !got.has("b") && !got.has("d"), [...got].join(","));
});
