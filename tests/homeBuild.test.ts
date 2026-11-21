import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOME_BUILD, OUTSIDE, GARDEN, builtTemplate, floorProblems, newRoom, planCost, planFromTemplate, planProblems, rectOk, wallsOf, yardTemplate,
  type HomePlan, type PlanRoom,
} from "../lib/homeBuild.ts";
import { FURNITURE, HOME_FLOORS, HOME_TEMPLATES, hitsWall } from "../lib/rooms.ts";

const sql = readFileSync(new URL("../supabase/migrations/0169_home_build.sql", import.meta.url), "utf8");

test("lib/homeBuild.ts mirrors game_settings 'home_build' in migration 0169", () => {
  const m = sql.match(/values \('home_build', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(HOME_BUILD)));
});

test("every garden piece is a furniture kind", () => {
  for (const g of GARDEN) assert.ok(FURNITURE[g.k as keyof typeof FURNITURE], g.k);
});

test("a home's own rooms come back as the same walls", () => {
  for (const [id, t] of [...Object.entries(HOME_TEMPLATES), ...Object.entries(HOME_FLOORS).flatMap(([h, f]) => Object.values(f).map((x) => [`${h}:2`, x] as const))]) {
    if (!t.rooms?.length) continue;
    const fp = planFromTemplate(t);
    assert.deepEqual(floorProblems(t, fp), [], id);
    // The rebuilt walls cover exactly what the template's walls cover.
    const len = (ws: [number, number, number, number][]) => ws.reduce((n, [a, b, c, d]) => n + Math.abs(c - a) + Math.abs(d - b), 0);
    assert.ok(Math.abs(len(wallsOf(fp.rooms, t.w, t.d)) - len(t.walls ?? [])) < 0.01, `${id}: ${len(wallsOf(fp.rooms, t.w, t.d))} vs ${len(t.walls ?? [])}`);
    // Nothing to pay for the home as it came.
    const plan: HomePlan = { v: 1, home: id, floors: { "1": fp } };
    assert.equal(planCost(null, plan, { "1": t }).total, 0, id);
  }
});

test("a new room in the studio gets walls with a doorway, and costs its wall and floor", () => {
  const t = HOME_TEMPLATES.astoria_studio;
  const room = newRoom(t, { rooms: [] }, "a", "Bedroom", "oak")!;
  assert.ok(room);
  assert.ok(rectOk(t, { rooms: [] }, room));
  const walls = wallsOf([room], t.w, t.d);
  assert.ok(walls.length >= 4, "four sides minus a doorway");
  const plan: HomePlan = { v: 1, home: "astoria_studio", floors: { "1": { rooms: [room] } } };
  assert.deepEqual(planProblems(plan, "astoria_studio", { "1": t }), []);
  const cost = planCost(null, plan, { "1": t });
  const perimeter = 2 * (room.x1 - room.x0 + room.z1 - room.z0) - 1;
  assert.equal(cost.lines[0].amount, Math.round(perimeter * HOME_BUILD.wallPerMetre));
  assert.ok(cost.lines.some((l) => l.label.startsWith("Floors")));
  // Saving it again costs nothing; taking it down costs demolition only.
  assert.equal(planCost(plan, plan, { "1": t }).total, 0);
  const down = planCost(plan, { ...plan, floors: { "1": { rooms: [] } } }, { "1": t });
  assert.equal(down.total, Math.round(perimeter * HOME_BUILD.demolishPerMetre));
});

test("the studio's own furniture steps out of a new wall's way", () => {
  const t = HOME_TEMPLATES.astoria_studio;
  const room: PlanRoom = { id: "a", name: "Office", x0: -t.w / 2, z0: -t.d / 2, x1: 0.5, z1: 0.5, floor: "oak", doors: [{ side: "e", at: 1 }] };
  const built = builtTemplate(t, { v: 1, home: "astoria_studio", floors: { "1": { rooms: [room] } } }, "1");
  assert.notEqual(built.id, t.id);
  for (const it of built.items) {
    const f = FURNITURE[it.kind];
    const [fw, fd] = it.rot % 2 ? [f.d, f.w] : [f.w, f.d];
    assert.ok(!hitsWall(built, it.x, it.z, fw / 2 - 0.02, fd / 2 - 0.02), it.id);
  }
});

test("rooms can't overlap, leave the home or be tiny", () => {
  const t = HOME_TEMPLATES.astoria_studio;
  const a: PlanRoom = { id: "a", name: "Office", x0: -2, z0: -2, x1: 0, z1: 0, floor: "oak", doors: [] };
  assert.deepEqual(floorProblems(t, { rooms: [a, { ...a, id: "b", x0: -1, x1: 1 }] }), ["a overlaps b"]);
  assert.ok(floorProblems(t, { rooms: [{ ...a, x0: -9 }] }).some((p) => p.includes("outside")));
  assert.ok(floorProblems(t, { rooms: [{ ...a, x1: -1 }] }).some((p) => p.includes("too small")));
  assert.ok(floorProblems(t, { rooms: [{ ...a, floor: "pavers" }] }).some((p) => p.includes("floor")), "garden finishes stay outside");
});

test("Outside: garden zones have no walls and pieces are priced", () => {
  const y = yardTemplate("astoria_studio", false);
  const plan: HomePlan = {
    v: 1, home: "astoria_studio", floors: {
      [OUTSIDE]: { rooms: [{ id: "z", name: "Patio", x0: -2, z0: -2, x1: 1, z1: 1, floor: "pavers", doors: [] }], pieces: [{ id: "p1", k: "tree", x: 3, z: -2, rot: 0 }, { id: "p2", k: "grill", x: -3, z: 2, rot: 1 }] },
    },
  };
  assert.deepEqual(planProblems(plan, "astoria_studio", { [OUTSIDE]: y }), []);
  const built = builtTemplate(y, plan, OUTSIDE);
  assert.deepEqual(built.walls, []);
  assert.equal(built.items.length, 2);
  const cost = planCost(null, plan, { [OUTSIDE]: y });
  assert.equal(cost.total, 9 * HOME_BUILD.zonePerSqm + 120 + 180);
  assert.ok(floorProblems(y, { rooms: [], pieces: [{ id: "p", k: "tree", x: 20, z: 0, rot: 0 }] }).length, "a piece outside the yard");
});

test("paint is charged once, and only to a new color", () => {
  const t = HOME_TEMPLATES.astoria_studio;
  const plan: HomePlan = { v: 1, home: "astoria_studio", paint: "sage", floors: {} };
  assert.equal(planCost(null, plan, { "1": t }).total, HOME_BUILD.paint);
  assert.equal(planCost(plan, plan, { "1": t }).total, 0);
  assert.equal(builtTemplate(t, plan, "1").wall, "#DCE6DA");
  assert.deepEqual(planProblems({ ...plan, paint: "nope" }, "astoria_studio", { "1": t }), ["bad paint"]);
  assert.deepEqual(planProblems(plan, "lic_highrise", { "1": t }), ["bad plan"], "a plan for another home");
});
