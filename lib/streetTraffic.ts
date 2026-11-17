// Street life on the compact map (owner, Oct 30: "cars and people don't move naturally on the streets"). Pure motion,
// no three.js: components/map/streetLife.ts draws it. Cars keep to the right-hand lane, take corners on a curve (tight
// right turns, wide left ones), stop for the traffic light at every intersection and queue behind the car ahead.
// People walk around their block on the sidewalk, at their own pace, and stop now and then. Coordinates are the
// map's meters (x east, z south); a grid rect is a borough island in cells (lib/compactMap.ts ISLANDS).
// Buses (owner, Nov 16: "buses moving around on the map. Making stops. Continuing their journey just like they would in
// real life"): a bus is a long car on a fixed loop (`route`, one heading per block) that pulls in to the curb at its stops,
// waits while the people there board, and carries on; the lights and the queue behind it work as for any car.

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

export const BUS = {
  /** Body length (a car's is 5). */
  len: 11,
  cruise: 8,
  /** Where along a stop's block it halts (share of the straight part), and how far it pulls toward the curb. */
  stopAt: 0.55,
  pull: 1.3,
  /** Seconds at a stop: a base, plus a little per person boarding. */
  dwell: 3,
  perRider: 0.8,
  /** A stop on every other block of the loop, at most this many waiting, a new rider every so many seconds. */
  maxWaiting: 4,
  riderEvery: 9,
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
  /** Length when not a car's 5 m (a bus). */
  len?: number;
  /** A bus: its loop (one heading per block), which block of it it's on, and its stops (by block). */
  route?: Dir[];
  leg?: number;
  stops?: number[];
  /** Seconds left at the stop it's at, and whether this block's stop is done. */
  dwell?: number;
  served?: boolean;
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
    const off = TRAFFIC.lane + pullOf(c, ls) * BUS.pull;
    return { x: ax + DX[c.dir] * along + off * rightX(c.dir), z: az + DZ[c.dir] * along + off * rightZ(c.dir), yaw: Math.atan2(-DZ[c.dir], DX[c.dir]) };
  }
  const k = cornerPoints(ax + DX[c.dir] * cell, az + DZ[c.dir] * cell, c.dir, c.next);
  const t = Math.min(1, (c.s - ls) / cornerLength(c.dir, c.next)), u = 1 - t;
  const x = u * u * k.p0x + 2 * u * t * k.cx + t * t * k.p2x, z = u * u * k.p0z + 2 * u * t * k.cz + t * t * k.p2z;
  const tx = 2 * u * (k.cx - k.p0x) + 2 * t * (k.p2x - k.cx), tz = 2 * u * (k.cz - k.p0z) + 2 * t * (k.p2z - k.cz);
  return { x, z, yaw: Math.atan2(-tz, tx) };
}

/** How far a bus has pulled toward the curb (0 to 1): easing in before its stop and out after it. */
function pullOf(c: Car, ls: number): number {
  if (!c.route || !c.stops?.includes(c.leg ?? -1)) return 0;
  const d = Math.abs(c.s - ls * BUS.stopAt);
  return Math.max(0, Math.min(1, 1.6 - d / 10));
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
export function stepCars(cars: Car[], g: StreetGrid, cell: number, dt: number, t: number, rng: Rng, onArrive?: (bus: Car) => number) {
  const ls = straightLength(cell);
  const { brake, accel, spacing, turnSlow } = TRAFFIC;
  for (const c of cars) {
    if (c.dwell && c.dwell > 0) { c.dwell = Math.max(0, c.dwell - dt); c.v = 0; continue; }
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
    // A bus pulls up at this block's stop.
    const stopS = ls * BUS.stopAt;
    const atStop = !!c.route && !c.served && !!c.stops?.includes(c.leg ?? -1) && c.s < stopS + 0.5;
    if (atStop) {
      if (stopS - c.s < 0.35 && c.v < 0.6) { c.s = Math.max(c.s, stopS - 0.35); c.served = true; c.v = 0; c.dwell = onArrive ? onArrive(c) : BUS.dwell; continue; }
      limit = Math.min(limit, Math.max(0.5, Math.sqrt(2 * brake * Math.max(0, stopS - c.s))));
    }
    // The car ahead on the same stretch, or just round the corner on the next one.
    for (const o of cars) {
      if (o === c) continue;
      let gap = -1;
      if (o.nx === c.nx && o.nz === c.nz && o.dir === c.dir && o.s > c.s) gap = o.s - c.s;
      else if (o.nx === bx && o.nz === bz && o.dir === c.next) gap = ls + cornerLength(c.dir, c.next) - c.s + o.s;
      const keep = spacing + ((c.len ?? 5) + (o.len ?? 5)) / 2 - 5;
      if (gap < 0 || gap > keep * 4) continue;
      limit = Math.min(limit, Math.sqrt(2 * brake * Math.max(0, gap - keep)));
    }
    c.v = Math.max(0, Math.min(c.v + accel * dt, limit));
    c.s += c.v * dt;
    const total = ls + cornerLength(c.dir, c.next);
    if (c.s >= total) {
      c.s -= total;
      c.nx = bx; c.nz = bz; c.dir = c.next;
      if (c.route) {
        c.leg = ((c.leg ?? 0) + 1) % c.route.length;
        c.next = c.route[(c.leg + 1) % c.route.length];
        c.served = false;
      } else c.next = chooseNext(g, c.nx + DX[c.dir], c.nz + DZ[c.dir], c.dir, rng);
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

// ---------------------------------------------------------------------------------------------------------------
// Buses
// ---------------------------------------------------------------------------------------------------------------

export interface BusRoute {
  id: string;
  /** The intersection it starts from and one heading per block, round a loop back to the start. */
  start: [number, number];
  path: Dir[];
  /** Blocks (indices into path) with a stop. */
  stops: number[];
}

/** A clockwise loop round the rectangle of intersections (x0, z0) to (x1, z1): east, south, west, north. */
export function loopPath(x0: number, z0: number, x1: number, z1: number): Dir[] {
  return [
    ...Array<Dir>(x1 - x0).fill(0), ...Array<Dir>(z1 - z0).fill(1),
    ...Array<Dir>(x1 - x0).fill(2), ...Array<Dir>(z1 - z0).fill(3),
  ];
}

/**
 * A borough's bus routes: loops a block in from its edge (the whole edge on a narrow island); a wide borough is split
 * into two loops, east and west, which share the street between them going opposite ways.
 */
export function busRoutes(g: StreetGrid, id: string): BusRoute[] {
  const nx0 = g.x0, nz0 = g.y0, nx1 = g.x1 + 1, nz1 = g.y1 + 1;
  const w = nx1 - nx0, h = nz1 - nz0;
  const inX = w >= 5 ? 1 : 0, inZ = h >= 5 ? 1 : 0;
  const x0 = nx0 + inX, x1 = nx1 - inX, z0 = nz0 + inZ, z1 = nz1 - inZ;
  const rects: [number, number, number, number][] = x1 - x0 >= 8
    ? [[x0, z0, Math.floor((x0 + x1) / 2), z1], [Math.floor((x0 + x1) / 2), z0, x1, z1]]
    : [[x0, z0, x1, z1]];
  return rects.filter(([a, b, c, d]) => c > a && d > b).map(([a, b, c, d], i) => {
    const path = loopPath(a, b, c, d);
    // A stop on every other block, never on a block that starts a turn's corner both ends (all blocks are fine here).
    return { id: `${id}-${i + 1}`, start: [a, b] as [number, number], path, stops: path.map((_, k) => k).filter((k) => k % 2 === 0) };
  });
}

/** Where block `leg` of a route starts (its first intersection). */
export function legStart(r: BusRoute, leg: number): [number, number] {
  let [x, z] = r.start;
  for (let k = 0; k < leg; k++) { x += DX[r.path[k]]; z += DZ[r.path[k]]; }
  return [x, z];
}

/** A route's stops on the sidewalk: where the shelter stands and which way the street runs (yaw, as a car's). */
export function busStopPoses(r: BusRoute, cell: number): (Pose & { leg: number })[] {
  const ls = straightLength(cell);
  return r.stops.map((leg) => {
    const [nx, nz] = legStart(r, leg);
    const d = r.path[leg];
    const along = TRAFFIC.corner + ls * BUS.stopAt;
    const off = TRAFFIC.corner + 2.6; // the sidewalk, where the people walk
    return { leg, x: nx * cell + DX[d] * along + off * rightX(d), z: nz * cell + DZ[d] * along + off * rightZ(d), yaw: Math.atan2(-DZ[d], DX[d]) };
  });
}

/** `count` buses spread evenly round a route. */
export function spawnBuses(r: BusRoute, count: number, cell: number): Car[] {
  const out: Car[] = [];
  for (let i = 0; i < count; i++) {
    const leg = Math.floor((i * r.path.length) / count);
    const [nx, nz] = legStart(r, leg);
    out.push({
      nx, nz, dir: r.path[leg], next: r.path[(leg + 1) % r.path.length], s: straightLength(cell) * 0.1, v: 0, cruise: BUS.cruise,
      len: BUS.len, route: r.path, leg, stops: r.stops, dwell: 0, served: false,
    });
  }
  return out;
}
