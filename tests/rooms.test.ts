import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES, SHOP_ITEMS } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";
import {
  FURNITURE, HOME_TEMPLATES, PLACE_TEMPLATES, applyLayout, homeTemplate, roomAt, findPath, makeGrid, placeRoom, placementOk, toLayout, useSpot, type RoomTemplate,
} from "../lib/rooms.ts";

const all: RoomTemplate[] = [...Object.values(HOME_TEMPLATES), ...Object.values(PLACE_TEMPLATES)];

test("every home has a room", () => {
  for (const h of ECONOMY.homes) assert.ok(HOME_TEMPLATES[h.id], h.id);
});

test("#19: every house for sale has a floor plan; rooms and walls sit inside it", () => {
  for (const i of SHOP_ITEMS.filter((x) => x.category === "houses")) {
    assert.ok(HOME_TEMPLATES[i.sku], i.sku);
    assert.equal(homeTemplate("astoria_studio", i.sku).id, i.sku, "a bought house replaces the rented home");
  }
  assert.equal(homeTemplate("lic_highrise", null).id, "lic_highrise");
  for (const t of Object.values(HOME_TEMPLATES)) {
    for (const r of t.rooms ?? []) assert.ok(r.x0 >= -t.w / 2 && r.x1 <= t.w / 2 && r.z0 >= -t.d / 2 && r.z1 <= t.d / 2 && r.x0 < r.x1 && r.z0 < r.z1, `${t.id}/${r.name}`);
    for (const w of t.walls ?? []) assert.ok(w[0] === w[2] || w[1] === w[3], `${t.id} walls are straight`);
    if (t.rooms) assert.ok(roomAt(t, t.spawn[0], t.spawn[1]), `${t.id} spawns inside a room`);
  }
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

test("v0.11: every place but subway stations can be entered, and its room uses its own actions", () => {
  for (const p of PLACES) {
    const room = placeRoom(p);
    if (p.tags.includes("subway")) { assert.equal(room, null, `${p.id}: subway stations stay a map label`); continue; }
    assert.ok(room, `${p.id} has a room`);
    const uses = room!.items.filter((i) => i.use?.kind === "action" || i.use?.kind === "gigs");
    for (const i of uses) {
      assert.ok(i.label && !i.label.includes("*"), `${p.id}/${i.id} is labelled`);
      if (i.use!.kind === "action") assert.ok(p.actions.some((a) => a.id === (i.use as { actionId: string }).actionId), `${p.id}/${i.id} is a real action`);
    }
    // Something in the room does the place's main thing (rooms built for one place keep their own hotspots).
    const main = p.actions[0];
    assert.ok(uses.some((i) => (i.use!.kind === "gigs" && main.kind === "gigs") || (i.use as { actionId?: string }).actionId === main.id) || p.depth === "full", `${p.id}: ${main.id} is in the room`);
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
