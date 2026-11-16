// A trip's route on the compact map (owner, Nov 16: "the route just goes across all buildings instead of following the
// streets", and the ride and the route didn't match). Pure: world meters in, a polyline out. Streets run along the grid
// lines (x = n × cell, z = n × cell); a block's middle is (cell + 0.5) × cell. The route leaves the start block onto the
// street on the side facing the destination, drives along that street, turns once onto the destination's street and
// pulls up beside its block: a taxi's L, never through a building. The ride moves along the same polyline
// (`pointAlong`), so the icon is always on the line.

import { COMPACT_GRID, islandAt } from "./compactMap.ts";

export type Pt = readonly [number, number];

const cellOf = (v: number, c: number) => Math.floor(v / c);

/** The street route between two map points (x east, z south, meters). Different islands or one block: a straight hop. */
export function streetRoute(from: Pt, to: Pt, cell: number = COMPACT_GRID.cell): Pt[] {
  const [fx, fz] = from, [tx, tz] = to;
  const bx = cellOf(fx, cell), by = cellOf(fz, cell);
  const ex = cellOf(tx, cell), ey = cellOf(tz, cell);
  if ((bx === ex && by === ey) || islandAt(bx, by) !== islandAt(ex, ey)) return [from, to];
  // The street lines (grid line numbers) the route uses: the start block's side toward the destination (east-west
  // street), then the destination block's side toward the start (north-south street).
  const rowLine = ey > by ? by + 1 : ey < by ? by : (tz >= fz ? by + 1 : by);
  const colLine = ex > bx ? ex : ex < bx ? ex + 1 : (tx >= fx ? ex : ex + 1);
  const pts: Pt[] = [
    from,
    [fx, rowLine * cell], // out onto the street beside the start block
    [colLine * cell, rowLine * cell], // along it to the destination's street
    [colLine * cell, tz], // along that to the destination block
    to,
  ];
  // Drop repeats (a leg of zero length when the blocks share a row or column).
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
}

export function routeLength(pts: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

/** The point a share `t` (0 to 1) of the way along the route, by distance. */
export function pointAlong(pts: readonly Pt[], t: number): Pt {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  let left = Math.min(1, Math.max(0, t)) * routeLength(pts);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const d = Math.hypot(bx - ax, bz - az);
    if (left <= d || i === pts.length - 1) {
      const k = d ? Math.min(1, left / d) : 1;
      return [ax + (bx - ax) * k, az + (bz - az) * k];
    }
    left -= d;
  }
  return pts[pts.length - 1];
}
