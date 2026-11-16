import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPACT_GRID, gridToWorld, SPOTS } from "../lib/compactMap.ts";
import { pointAlong, routeLength, streetRoute } from "../lib/compactRoute.ts";

const c = COMPACT_GRID.cell;
const onStreet = (v: number) => Math.abs(v / c - Math.round(v / c)) < 1e-9;

test("a route between two Queens blocks runs on streets between its first and last hop", () => {
  const ids = Object.keys(SPOTS);
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const from = gridToWorld(SPOTS[a]), to = gridToWorld(SPOTS[b]);
    const r = streetRoute(from, to);
    assert.deepEqual(r[0], from);
    assert.deepEqual(r[r.length - 1], to);
    if (r.length === 2) continue;
    // Every leg but the first and last (block to curb, curb to block) is on a street line, horizontal or vertical.
    for (let i = 2; i < r.length - 1; i++) {
      const [ax, az] = r[i - 1], [bx, bz] = r[i];
      assert.ok(ax === bx || az === bz, `${a}→${b}: leg ${i} is diagonal`);
      assert.ok(ax === bx ? onStreet(ax) : onStreet(az), `${a}→${b}: leg ${i} is off the street`);
    }
    // The curb hops stay within half a block.
    assert.ok(Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) <= c / 2 + 1e-9, `${a}→${b}: long first hop`);
    assert.ok(Math.hypot(r[r.length - 1][0] - r[r.length - 2][0], r[r.length - 1][1] - r[r.length - 2][1]) <= c / 2 + 1e-9, `${a}→${b}: long last hop`);
  }
});

test("the ride is always on the route: start, end and every point in between", () => {
  const r = streetRoute(gridToWorld([7, 3]), gridToWorld([15, 8]));
  assert.deepEqual(pointAlong(r, 0), r[0]);
  assert.deepEqual(pointAlong(r, 1), r[r.length - 1]);
  const total = routeLength(r);
  for (let k = 0; k <= 20; k++) {
    const p = pointAlong(r, k / 20);
    // On some leg: its distance to the nearest segment is ~0.
    const d = Math.min(...r.slice(1).map((b, i) => {
      const a = r[i];
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
      return Math.hypot(p[0] - (a[0] + vx * u), p[1] - (a[1] + vz * u));
    }));
    assert.ok(d < 1e-6, `t=${k / 20} is ${d} m off the route`);
  }
  assert.ok(total > 0);
});
