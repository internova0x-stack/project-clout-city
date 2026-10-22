import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES, SHOP_ITEMS } from "../lib/city.ts";
import { ECONOMY, SIGNUP_HOMES, moveCost } from "../lib/economy.ts";
import {
  FURNITURE, HOME_FLOORS, HOME_TEMPLATES, PLACE_TEMPLATES, placeFloor, placeFloors, applyLayout, freeSpot, homeTemplate, mergeFloorLayout, ownedId, placedElsewhere, ownedItem, roomAt, type OwnedPiece, findPath, makeGrid, placeRoom, placementOk, toLayout, useSpot, type RoomTemplate,
} from "../lib/rooms.ts";

const all: RoomTemplate[] = [...Object.values(HOME_TEMPLATES), ...Object.values(HOME_FLOORS).flatMap((f) => Object.values(f)), ...Object.values(PLACE_TEMPLATES)];

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

test("#19 Fif's Furniture: bought pieces are placed by the layout, the rest wait in storage", () => {
  const t = HOME_TEMPLATES.jackson_heights_1br;
  const sofa: OwnedPiece = { id: ownedId(7), kind: "sofa", color: "#6C8CFF", name: "Three-seat sofa", emoji: "🛋️" };
  const plant: OwnedPiece = { id: ownedId(8), kind: "plant", name: "Monstera", emoji: "🪴" };
  const placed = applyLayout(t, [{ id: "item:7", x: -0.5, z: 2.0, rot: 2 }], [sofa, plant]);
  const s = placed.find((i) => i.id === "item:7");
  assert.ok(s && s.use?.kind === "sit" && s.color === "#6C8CFF", "the sofa is placed and can be sat on");
  assert.ok(!placed.some((i) => i.id === "item:8"), "the plant has no spot: it's in storage");
  // A spot inside a wall (or another home's spot that no longer fits) sends the piece back to storage.
  assert.ok(!applyLayout(t, [{ id: "item:7", x: -0.5, z: -0.2, rot: 0 }], [sofa]).some((i) => i.id === "item:7"));
  // Taking a piece out of storage finds a free spot; saving keeps it.
  const spot = freeSpot(t, placed, ownedItem(plant, 0, 0, 0));
  assert.ok(spot && placementOk(t, placed, spot));
  assert.ok(toLayout([...placed, spot!]).some((e) => e.id === "item:8"));
});

test("#19 every Home item is a real piece, and Fif's showroom opens the Home tab", () => {
  const home = SHOP_ITEMS.filter((i) => i.category === "home");
  assert.ok(home.length >= 20);
  for (const i of home) assert.ok(i.furniture && FURNITURE[i.furniture.kind as keyof typeof FURNITURE]?.movable, i.sku);
  const fifs = PLACES.find((p) => p.id === "fifs-furniture")!;
  const room = placeRoom(fifs)!;
  const browse = room.items.filter((i) => i.use?.kind === "shop");
  assert.ok(browse.length >= 3 && browse.every((i) => i.use?.kind === "shop" && i.use.category === "home"));
});

test("#19 moving up: Sunnyside is a move-up home, moving costs rent plus the broker fee", () => {
  assert.ok(!SIGNUP_HOMES.some((h) => h.id === "sunnyside_gardens"), "not offered at sign-up");
  const sunny = ECONOMY.homes.find((h) => h.id === "sunnyside_gardens")!;
  assert.equal(moveCost(sunny), 1500);
  assert.equal(sunny.moveClout, 1000);
  assert.ok(HOME_TEMPLATES.sunnyside_gardens && (HOME_TEMPLATES.sunnyside_gardens.rooms?.length ?? 0) === 3);
  assert.ok(HOME_FLOORS["house-hunters-point-duplex"]?.[2], "the duplex has an upstairs");
  for (const [id, floors] of Object.entries(HOME_FLOORS)) {
    const down = HOME_TEMPLATES[id].items.find((i) => i.use?.kind === "floor");
    assert.ok(down && down.use?.kind === "floor" && floors[down.use.to], `${id}: stairs go up`);
    for (const f of Object.values(floors)) assert.ok(f.items.some((i) => i.use?.kind === "floor" && i.use.to === 1), `${f.id}: stairs come down`);
  }
});

test("#19 bought pieces remember their floor; saving one floor keeps the other", () => {
  const up = HOME_FLOORS["house-hunters-point-duplex"][2];
  const tub: OwnedPiece = { id: ownedId(3), kind: "plant", name: "Monstera", emoji: "🪴" };
  const layout = [{ id: "item:3", x: 1.6, z: 1.8, rot: 0, f: 2 }];
  assert.ok(applyLayout(up, layout, [tub], 2).some((i) => i.id === "item:3"), "upstairs it stands");
  assert.ok(!applyLayout(HOME_TEMPLATES["house-hunters-point-duplex"], layout, [tub], 1).some((i) => i.id === "item:3"), "downstairs it doesn't");
  assert.ok(placedElsewhere(layout, 1).has("item:3"), "and isn't in storage downstairs");
  const saved = mergeFloorLayout(layout, [{ id: "dx-sofa", x: -2, z: 2.4, rot: 2 }], 1);
  assert.ok(saved.some((e) => e.id === "item:3" && e.f === 2) && saved.some((e) => e.id === "dx-sofa"), "saving downstairs keeps the upstairs piece");
  assert.ok(!mergeFloorLayout(layout, [], 2).some((e) => e.id === "item:3"), "putting it away upstairs removes it");
});

test("#19 clubs: restroom and VIP floors, stairs that fit and can be walked to", () => {
  for (const p of PLACES.filter((x) => placeRoom(x))) {
    const floors = [1, ...placeFloors(p)].map((f) => [f, placeFloor(p, f)!] as const);
    if (p.club) {
      assert.ok(floors.some(([f]) => f === 0), `${p.id} has a restroom`);
      assert.equal(floors.some(([f]) => f === 2), !!p.club.vip || p.tags.includes("exclusive_venue") || p.tags.includes("hub"), `${p.id} upstairs`);
    } else assert.ok(!floors.some(([f]) => f === 0), `${p.id} has no restroom`);
    for (const [f, t] of floors) {
      for (const i of t.items) assert.ok(placementOk(t, t.items, i), `${p.id} floor ${f}: ${i.id} fits`);
      const grid = makeGrid(t, t.items);
      for (const i of t.items.filter((x) => x.use)) assert.ok(findPath(grid, t.spawn, useSpot(i)).length > 0, `${p.id} floor ${f}: ${i.id} reachable`);
      // Every floor's stairs lead to a floor that exists.
      for (const i of t.items) if (i.use?.kind === "floor") assert.ok(placeFloor(p, i.use.to), `${p.id} floor ${f}: ${i.id} goes somewhere`);
    }
  }
  const vip = placeFloor(PLACES.find((p) => p.id === "ultraviolet-society")!, 2)!;
  assert.ok(vip.items.some((i) => i.use?.kind === "vip"), "VIP has Get seen in VIP");
  assert.ok(PLACE_TEMPLATES.restroom.items.some((i) => i.use?.kind === "listen"), "the restroom has Listen in");
});

test("The Hub: four floors (restroom, diner, game room, lounge), each with stairs to the next", () => {
  const hub = PLACES.find((p) => p.tags.includes("hub"))!;
  assert.deepEqual([1, ...placeFloors(hub)].sort(), [0, 1, 2, 3]);
  const stairs = (f: number) => placeFloor(hub, f)!.items.filter((i) => i.use?.kind === "floor").map((i) => (i.use as { to: number }).to).sort();
  assert.deepEqual(stairs(0), [1]);
  assert.deepEqual(stairs(1), [0, 2]);
  assert.deepEqual(stairs(2), [1, 3]);
  assert.deepEqual(stairs(3), [2]);
  // Each floor has something to do, from the Hub's own actions.
  for (const [f, id] of [[1, "eat"], [2, "play"], [3, "hang"]] as const) {
    assert.ok(placeFloor(hub, f)!.items.some((i) => i.use?.kind === "action" && i.use.actionId === id), `floor ${f} has ${id}`);
  }
});
