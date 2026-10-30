// Street life on the compact map (owner, Oct 30: "cars and people don't move naturally on the streets"). Pure motion,
// no three.js: components/map/streetLife.ts draws it. Cars keep to the right-hand lane, take corners on a curve (tight
// right turns, wide left ones), stop for the traffic light at every intersection and queue behind the car ahead.
// People walk around their block on the sidewalk, at their own pace, and stop now and then. Coordinates are the
// map's meters (x east, z south); a grid rect is a borough island in cells (lib/compactMap.ts ISLANDS).

export interface StreetGrid { x0: number; y0: number; x1: number; y1: number }

/** East, south, west, north. */
export type Dir = 0 | 1 | 2 | 3;
const DX = [1, 0, -1, 0] as const;
const DZ = [0, 1, 0, -1] as const;
const reverse = (d: Dir) => ((d + 2) % 4) as Dir;
/** The right-hand side of a heading (where its lane is). */
const rightX = (d: Dir) => -DZ[d];
const rightZ = (d: Dir) => DX[d];

export const TRAFFIC = {
  /** From the street's middle line to the lane's middle. */
  lane: 2.2,
  /** Half the street's width: where the straight part ends and the corner starts. */
  corner: 4.6,
  /** A car's length plus the gap it keeps. */
  spacing: 7.5,
  brake: 7,
  accel: 3.5,
  /** Light cycle in seconds: east-west green, all red, north-south green, all red. */
  green: 6.5,
  allRed: 1.5,
  /** Corner speed as a share of cruising speed. */
  turnSlow: 0.5,
} as const;

export interface Car {
  /** The intersection the car is driving away from (grid lines). */
  nx: number;
  nz: number;
  dir: Dir;
  /** Where it turns at the next intersection. */
  next: Dir;
  /** Meters along this stretch: the straight part, then the corner. */
  s: number;
  v: number;
  cruise: number;
}

export interface Pose { x: number; z: number; yaw: number }

type Rng = () => number;

function hasEdge(g: StreetGrid, nx: number, nz: number, d: Dir): boolean {
  const x = nx + DX[d], z = nz + DZ[d];
  return x >= g.x0 && x <= g.x1 + 1 && z >= g.y0 && z <= g.y1 + 1;
}

/** Where a car arriving at an intersection heading `d` goes next: mostly straight on, never back unless it must. */
export function chooseNext(g: StreetGrid, nx: number, nz: number, d: Dir, rng: Rng): Dir {
  const options: { d: Dir; w: number }[] = [];
  for (const o of [0, 1, 2, 3] as Dir[]) {
    if (o === reverse(d) || !hasEdge(g, nx, nz, o)) continue;
    options.push({ d: o, w: o === d ? 3 : 1 });
  }
  if (!options.length) return reverse(d);
  let pick = rng() * options.reduce((a, o) => a + o.w, 0);
  for (const o of options) if ((pick -= o.w) < 0) return o.d;
  return options[options.length - 1].d;
}

/** The corner's curve through an intersection at (bx, bz): a quadratic Bezier from lane to lane. */
function cornerPoints(bx: number, bz: number, d: Dir, d2: Dir) {
  const { lane, corner: R } = TRAFFIC;
  const p0x = bx - R * DX[d] + lane * rightX(d), p0z = bz - R * DZ[d] + lane * rightZ(d);
  const p2x = bx + R * DX[d2] + lane * rightX(d2), p2z = bz + R * DZ[d2] + lane * rightZ(d2);
  let cx: number, cz: number;
  if (d2 === d) { cx = (p0x + p2x) / 2; cz = (p0z + p2z) / 2; }
  else if (d2 === reverse(d)) { cx = bx + R * DX[d]; cz = bz + R * DZ[d]; }
  else { cx = bx + lane * (rightX(d) + rightX(d2)); cz = bz + lane * (rightZ(d) + rightZ(d2)); }
  return { p0x, p0z, cx, cz, p2x, p2z };
}

const cornerLengths = new Map<string, number>();
/** The corner's length (the same for every intersection, by turn). */
export function cornerLength(d: Dir, d2: Dir): number {
  const key = `${d}${d2}`;
  const have = cornerLengths.get(key);
  if (have !== undefined) return have;
  const c = cornerPoints(0, 0, d, d2);
  let len = 0, px = c.p0x, pz = c.p0z;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16, u = 1 - t;
    const x = u * u * c.p0x + 2 * u * t * c.cx + t * t * c.p2x, z = u * u * c.p0z + 2 * u * t * c.cz + t * t * c.p2z;
    len += Math.hypot(x - px, z - pz);
    px = x; pz = z;
  }
  cornerLengths.set(key, len);
  return len;
}

/** The straight part of a stretch: one block minus a corner at each end. */
export const straightLength = (cell: number) => cell - 2 * TRAFFIC.corner;

/** Where a car is and which way it faces (yaw: radians around y, 0 = east, three.js's sense). */
export function carPose(c: Car, cell: number): Pose {
  const ls = straightLength(cell);
  const ax = c.nx * cell, az = c.nz * cell;
  if (c.s < ls) {
    const along = TRAFFIC.corner + c.s;
    return { x: ax + DX[c.dir] * along + TRAFFIC.lane * rightX(c.dir), z: az + DZ[c.dir] * along + TRAFFIC.lane * rightZ(c.dir), yaw: Math.atan2(-DZ[c.dir], DX[c.dir]) };
  }
  const k = cornerPoints(ax + DX[c.dir] * cell, az + DZ[c.dir] * cell, c.dir, c.next);
  const t = Math.min(1, (c.s - ls) / cornerLength(c.dir, c.next)), u = 1 - t;
  const x = u * u * k.p0x + 2 * u * t * k.cx + t * t * k.p2x, z = u * u * k.p0z + 2 * u * t * k.cz + t * t * k.p2z;
  const tx = 2 * u * (k.cx - k.p0x) + 2 * t * (k.p2x - k.cx), tz = 2 * u * (k.cz - k.p0z) + 2 * t * (k.p2z - k.cz);
  return { x, z, yaw: Math.atan2(-tz, tx) };
}

/** Each intersection runs its own light, out of step with its neighbors. */
function lightOffset(nx: number, nz: number): number {
  return ((nx * 7919 + nz * 104729) % 97) / 97;
}

/** Whether a car heading `d` may drive into the intersection at (nx, nz) at time `t` (seconds). */
export function greenFor(nx: number, nz: number, d: Dir, t: number): boolean {
  const { green, allRed } = TRAFFIC;
  const cycle = 2 * (green + allRed);
  const p = (((t + lightOffset(nx, nz) * cycle) % cycle) + cycle) % cycle;
  return d % 2 === 0 ? p < green : p >= green + allRed && p < 2 * green + allRed;
}

/** A few cars spread over a borough's streets, no two on top of each other. */
export function spawnCars(g: StreetGrid, count: number, cell: number, rng: Rng): Car[] {
  const cars: Car[] = [];
  const ls = straightLength(cell);
  for (let tries = 0; cars.length < count && tries < count * 20; tries++) {
    const nx = g.x0 + Math.floor(rng() * (g.x1 - g.x0 + 2)), nz = g.y0 + Math.floor(rng() * (g.y1 - g.y0 + 2));
    const dir = Math.floor(rng() * 4) as Dir;
    if (!hasEdge(g, nx, nz, dir)) continue;
    const s = rng() * (ls - 2);
    if (cars.some((c) => c.nx === nx && c.nz === nz && c.dir === dir && Math.abs(c.s - s) < TRAFFIC.spacing * 1.5)) continue;
    const cruise = 9 + rng() * 5;
    cars.push({ nx, nz, dir, next: chooseNext(g, nx + DX[dir], nz + DZ[dir], dir, rng), s, v: cruise, cruise });
  }
  return cars;
}

/** Moves every car on by `dt` seconds at time `t`: lights, queues, corners. */
export function stepCars(cars: Car[], g: StreetGrid, cell: number, dt: number, t: number, rng: Rng) {
  const ls = straightLength(cell);
  const { brake, accel, spacing, turnSlow } = TRAFFIC;
  for (const c of cars) {
    const turning = c.next !== c.dir;
    let limit = c.s >= ls && turning ? c.cruise * turnSlow : c.cruise;
    // Ease off ahead of a turn, so the corner isn't a sudden brake.
    if (turning && c.s < ls) limit = Math.min(limit, Math.sqrt((c.cruise * turnSlow) ** 2 + 2 * brake * (ls - c.s)));
    // The light at the end of this stretch. Cars already in the intersection carry on, and so does a car too close to
    // stop gently when it changes (an amber light, New York style).
    const bx = c.nx + DX[c.dir], bz = c.nz + DZ[c.dir];
    const toLine = ls - 0.6 - c.s;
    if (c.s < ls && !greenFor(bx, bz, c.dir, t) && toLine > (c.v * c.v) / (2 * brake * 1.4) - 0.5) {
      limit = Math.min(limit, Math.sqrt(2 * brake * Math.max(0, toLine)));
    }
    // The car ahead on the same stretch, or just round the corner on the next one.
    for (const o of cars) {
      if (o === c) continue;
      let gap = -1;
      if (o.nx === c.nx && o.nz === c.nz && o.dir === c.dir && o.s > c.s) gap = o.s - c.s;
      else if (o.nx === bx && o.nz === bz && o.dir === c.next) gap = ls + cornerLength(c.dir, c.next) - c.s + o.s;
      if (gap < 0 || gap > spacing * 4) continue;
      limit = Math.min(limit, Math.sqrt(2 * brake * Math.max(0, gap - spacing)));
    }
    c.v = Math.max(0, Math.min(c.v + accel * dt, limit));
    c.s += c.v * dt;
    const total = ls + cornerLength(c.dir, c.next);
    if (c.s >= total) {
      c.s -= total;
      c.nx = bx; c.nz = bz; c.dir = c.next;
      c.next = chooseNext(g, c.nx + DX[c.dir], c.nz + DZ[c.dir], c.dir, rng);
    }
  }
}

export interface Walker {
  /** The block's middle and the half-width of the sidewalk loop around it. */
  cx: number;
  cz: number;
  half: number;
  /** Meters along the loop (clockwise from the north-west corner). */
  s: number;
  way: 1 | -1;
  v: number;
  /** Seconds left standing still (window shopping, a phone call). */
  pause: number;
}

/** A walker's spot on the loop round their block, and how high their step lifts them. */
export function walkerPose(w: Walker): { x: number; z: number; lift: number } {
  const side = 2 * w.half, loop = 4 * side;
  const s = ((w.s % loop) + loop) % loop;
  const k = Math.floor(s / side), u = (s % side) - w.half;
  const x = k === 0 ? w.cx + u : k === 1 ? w.cx + w.half : k === 2 ? w.cx - u : w.cx - w.half;
  const z = k === 0 ? w.cz - w.half : k === 1 ? w.cz + u : k === 2 ? w.cz + w.half : w.cz - u;
  return { x, z, lift: w.pause > 0 ? 0 : Math.abs(Math.sin(w.s * 2.4)) * 0.3 };
}

export function stepWalkers(walkers: Walker[], dt: number, rng: Rng) {
  for (const w of walkers) {
    if (w.pause > 0) { w.pause -= dt; continue; }
    w.s += w.way * w.v * dt;
    if (rng() < 0.04 * dt) w.pause = 1 + rng() * 4;
  }
}
