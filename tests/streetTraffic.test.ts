import { test } from "node:test";
import assert from "node:assert/strict";
import { TRAFFIC, carPose, chooseNext, greenFor, spawnCars, stepCars, stepWalkers, straightLength, walkerPose, type Car, type Walker } from "../lib/streetTraffic.ts";

const CELL = 60;
const grid = { x0: 6, y0: 3, x1: 16, y1: 13 };
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 2 ** 32; };
}

test("cars drive on the right-hand side of the street", () => {
  const east = carPose({ nx: 8, nz: 5, dir: 0, next: 0, s: 10, v: 0, cruise: 10 }, CELL);
  assert.equal(east.z, 5 * CELL + TRAFFIC.lane); // heading east, the lane is on the south side
  const west = carPose({ nx: 9, nz: 5, dir: 2, next: 2, s: 10, v: 0, cruise: 10 }, CELL);
  assert.equal(west.z, 5 * CELL - TRAFFIC.lane);
  assert.ok(Math.abs(east.yaw) < 1e-9);
  assert.ok(Math.abs(Math.abs(west.yaw) - Math.PI) < 1e-9);
});

test("a corner is a smooth curve from one lane into the other", () => {
  const ls = straightLength(CELL);
  const car: Car = { nx: 8, nz: 5, dir: 0, next: 1, s: ls, v: 0, cruise: 10 };
  const start = carPose(car, CELL);
  let prev = start;
  for (let s = ls; s <= ls + 8; s += 0.5) {
    const p = carPose({ ...car, s }, CELL);
    assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) < 0.8, "no jumps along the corner");
    prev = p;
  }
  // At the end of the turn the car is in the southbound lane (west side of the street) of the new street.
  const end = carPose({ ...car, nx: 9, nz: 5, dir: 1, next: 1, s: 0 }, CELL);
  assert.equal(end.x, 9 * CELL - TRAFFIC.lane);
});

test("never a U-turn while another way is open", () => {
  const rng = seeded(4);
  for (let i = 0; i < 200; i++) {
    assert.notEqual(chooseNext(grid, 10, 8, 0, rng), 2);
    const corner = chooseNext(grid, 17, 14, 0, rng); // the island's far corner: only north is left
    assert.equal(corner, 3);
  }
});

test("each light gives one direction green at a time, with an all-red between", () => {
  let both = 0, none = 0;
  for (let t = 0; t < 32; t += 0.1) {
    const ew = greenFor(10, 8, 0, t), ns = greenFor(10, 8, 1, t);
    if (ew && ns) both++;
    if (!ew && !ns) none++;
  }
  assert.equal(both, 0);
  assert.ok(none > 0);
});

test("traffic flows for minutes: cars stay on the island, stop at red, never stack up", () => {
  const rng = seeded(11);
  const cars = spawnCars(grid, 40, CELL, rng);
  assert.equal(cars.length, 40);
  let stopped = 0, moving = 0;
  for (let t = 0; t < 180; t += 1 / 30) {
    stepCars(cars, grid, CELL, 1 / 30, t, rng);
    for (const c of cars) {
      assert.ok(c.nx >= grid.x0 && c.nx <= grid.x1 + 1 && c.nz >= grid.y0 && c.nz <= grid.y1 + 1);
      if (c.v < 0.1) stopped++; else moving++;
    }
  }
  assert.ok(stopped > 0, "someone waits at a light");
  assert.ok(moving > stopped * 2, "most cars are moving at any moment");
  for (const a of cars) for (const b of cars) {
    if (a !== b && a.nx === b.nx && a.nz === b.nz && a.dir === b.dir && a.s < straightLength(CELL) && b.s < straightLength(CELL)) {
      assert.ok(Math.abs(a.s - b.s) > TRAFFIC.spacing * 0.6, "cars keep their distance");
    }
  }
});

test("people walk round their block on the sidewalk and stop now and then", () => {
  const w: Walker = { cx: 100, cz: 100, half: 24, s: 0, way: 1, v: 2, pause: 0 };
  const corners = [0, 48, 96, 144].map((s) => walkerPose({ ...w, s }));
  assert.deepEqual(corners.map((p) => [p.x, p.z]), [[76, 76], [124, 76], [124, 124], [76, 124]]);
  const back = walkerPose({ ...w, s: -10 });
  assert.deepEqual([back.x, back.z], [76, 86]);
  const rng = seeded(3);
  const crowd = Array.from({ length: 50 }, () => ({ ...w }));
  let paused = 0;
  for (let t = 0; t < 60; t += 0.1) { stepWalkers(crowd, 0.1, rng); paused += crowd.filter((c) => c.pause > 0).length; }
  assert.ok(paused > 0);
  assert.ok(crowd.every((c) => c.s > 20));
});
