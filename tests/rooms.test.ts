import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";
import {
  FURNITURE, HOME_TEMPLATES, PLACE_TEMPLATES, applyLayout, findPath, makeGrid, placementOk, toLayout, useSpot, type RoomTemplate,
} from "../lib/rooms.ts";

const all: RoomTemplate[] = [...Object.values(HOME_TEMPLATES), ...Object.values(PLACE_TEMPLATES)];

test("every home has a room", () => {
  for (const h of ECONOMY.homes) assert.ok(HOME_TEMPLATES[h.id], h.id);
});

test("furniture fits each room without overlapping", () => {
  for (const t of all) for (const i of t.items) assert.ok(placementOk(t, t.items, i), `${t.id}/${i.id}`);
});

test("every usable item can be walked to from the door", () => {
  for (const t of all) {
    const grid = makeGrid(t, t.items);
    for (const i of t.items.filter((x) => x.use)) assert.ok(findPath(grid, t.spawn, useSpot(i)).length > 0, `${t.id}/${i.id}`);
  }
});

test("room hotspots point at real place actions", () => {
  const byTemplate = { club: "velvet-static", cafe: "grind-and-gossip", counter: "lucky-seven-deli", lounge: "low-light-lounge", store: "thread-count", campus: "st-johnsons" } as const;
  for (const [tpl, placeId] of Object.entries(byTemplate)) {
    const place = PLACES.find((p) => p.id === placeId)!;
    for (const i of PLACE_TEMPLATES[tpl as keyof typeof byTemplate].items) {
      if (i.use?.kind === "action") assert.ok(place.actions.some((a) => a.id === (i.use as { actionId: string }).actionId), `${tpl}/${i.id}`);
    }
  }
});

test("saved layouts round-trip, and bad entries are ignored", () => {
  const t = HOME_TEMPLATES.astoria_studio;
  const moved = t.items.map((i) => (i.id === "plant" ? { ...i, x: 2.0 } : i));
  const back = applyLayout(t, toLayout(moved));
  assert.equal(back.find((i) => i.id === "plant")!.x, 2.0);
  const junk = applyLayout(t, [{ id: "sofa", x: 99, z: "a", rot: 1 }, { id: "nope", x: 0, z: 0, rot: 0 }, null]);
  assert.deepEqual(junk, t.items);
  const onTop = applyLayout(t, [{ id: "plant", x: -1.85, z: -1.5, rot: 0 }]); // onto the bed
  assert.equal(onTop.find((i) => i.id === "plant")!.x, 1.75);
  assert.ok(Object.values(FURNITURE).every((f) => f.w > 0 && f.d > 0));
});
