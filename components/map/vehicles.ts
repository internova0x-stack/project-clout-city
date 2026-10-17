import type { Map as MapLibreMap } from "maplibre-gl";
import { onLandmarkSite, type Landmark } from "@/lib/map/landmarks";
import { laneOffsetMeters } from "@/lib/map/scale";
import { VEHICLE_COLORS, type VehicleKind } from "./vehicleModels";

// Moving traffic on the map when zoomed in (Milestones v0.3): up to 30 cars, cabs, SUVs, buses
// and scooters driving along the streets in view, in the right-hand lane, turned to face the road.
// Since Oct 16 they are 3D models in the landmark layer (components/map/landmarkLayer.ts), which
// steps this simulation every frame it draws. Under reduced motion they drive at a crawl (owner, Oct 17:
// they should always be moving along slowly). From the neighborhood view the map opens at, not only up close.
// Since Oct 17 (owner: "park, turn, drive in a randomized manner") each car has a mind of its own: it turns
// onto crossing streets at corners, sometimes pauses at one, eases between speeds, now and then pulls over
// to the curb, sits parked a while and pulls back out. Some start the scene parked.
// Purely decorative: nothing in the game reads them.

export const TRAFFIC_MIN_ZOOM = 13.5;
const MAX_VEHICLES = 30;
const SPEED_UP = 1.2; // a touch faster than real Queens traffic, so it reads as moving
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]);
const BUS_ROADS = new Set(["trunk", "primary", "secondary"]);
const M_PER_DEG = 111_320;

interface Path { pts: [number, number][]; cum: number[]; length: number; k: number; cls: string; visible: number[]; corners: Junction[] }
/** Where another street meets this one: how far along this one, and where on the other. */
interface Junction { at: number; other: Path; otherAt: number }
type Mode = "drive" | "stop" | "park" | "parked" | "leave";
interface Vehicle {
  id: number; path: Path; at: number; dir: 1 | -1; kind: VehicleKind; color: string;
  /** Meters a second now, and what it's easing toward. */
  speed: number; cruise: number;
  mode: Mode;
  /** Seconds left in this mode (stop, parked), or until the next change of pace / next time it parks. */
  timer: number; paceIn: number; parkIn: number;
  /** 0 in the lane, 1 at the curb. */
  shift: number;
  /** The facing it shows, turned smoothly toward the road's (degrees). */
  heading: number | null;
  /** The last corner it decided at (so it decides once per corner). */
  lastCorner: Junction | null;
  /** The street it turned off (so it doesn't turn straight back onto it at the next end). */
  cameFrom: Path | null;
}

const SNAP_M = 8; // a street ending this close to another one meets it
const TURN_CHANCE = 0.45; // at a corner with a crossing street
const PAUSE_CHANCE = 0.2; // a rolling stop at a corner
const ACCEL = 3.2; // m/s², speeding up and braking
const CURB = 1.9; // how far right of the lane a parked car sits, in lane offsets

/** One vehicle this frame: where it is (lng, lat), which way it faces, what it is. */
export interface VehicleState { id: number; at: [number, number]; bearing: number; kind: VehicleKind; color: string }

export interface Traffic {
  /** Moves everything on to now (ms) and returns where each vehicle is. */
  step(now: number): VehicleState[];
  dispose(): void;
}

function toPath(coords: [number, number][], cls: string): Path | null {
  if (coords.length < 2) return null;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i - 1][0]) * k * M_PER_DEG;
    const dy = (coords[i][1] - coords[i - 1][1]) * M_PER_DEG;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const length = cum[cum.length - 1];
  return length > 60 ? { pts: coords, cum, length, k, cls, visible: [], corners: [] } : null;
}

/** Position (in the right-hand lane for the direction of travel, or at the curb) and compass bearing. */
function place(v: Vehicle, lane: number): { at: [number, number]; bearing: number } {
  lane *= 1 + (CURB - 1) * v.shift;
  const p = v.path;
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < v.at) i++;
  const seg = p.cum[i] - p.cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (v.at - p.cum[i - 1]) / seg));
  const a = p.pts[i - 1];
  const b = p.pts[i];
  // Direction of travel in meters (east, north).
  let ex = (b[0] - a[0]) * p.k * M_PER_DEG;
  let ny = (b[1] - a[1]) * M_PER_DEG;
  if (v.dir < 0) { ex = -ex; ny = -ny; }
  const len = Math.hypot(ex, ny) || 1;
  // Right of travel is (north, -east).
  const offE = (ny / len) * lane;
  const offN = (-ex / len) * lane;
  return {
    at: [a[0] + (b[0] - a[0]) * t + offE / (p.k * M_PER_DEG), a[1] + (b[1] - a[1]) * t + offN / M_PER_DEG],
    bearing: (Math.atan2(ex, ny) * 180) / Math.PI,
  };
}

function roadPaths(map: MapLibreMap, sites: readonly Landmark[]): Path[] {
  const bounds = map.getBounds();
  const paths: Path[] = [];
  for (const f of map.querySourceFeatures("osm", { sourceLayer: "transportation" })) {
    const cls = String(f.properties?.class);
    if (!ROAD_CLASSES.has(cls) || f.properties?.brunnel === "tunnel") continue;
    const g = f.geometry;
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    // Streets stop at landmark sites: split each line into the runs outside them.
    const runs = lines.flatMap((line) => {
      const out: number[][][] = [[]];
      // Every ~20 m, so a long straight block that crosses a site still gets cut.
      const dense = line.flatMap((pt, i) => {
        if (!i) return [pt];
        const [x0, y0] = line[i - 1];
        const n = Math.max(1, Math.ceil(Math.hypot((pt[0] - x0) * 0.76, pt[1] - y0) * M_PER_DEG / 20));
        return Array.from({ length: n }, (_, j) => [x0 + ((pt[0] - x0) * (j + 1)) / n, y0 + ((pt[1] - y0) * (j + 1)) / n]);
      });
      for (const pt of dense) {
        if (onLandmarkSite(pt[0], pt[1], sites)) { if (out[out.length - 1].length) out.push([]); }
        else out[out.length - 1].push(pt);
      }
      return out.filter((r) => r.length > 1);
    });
    for (const line of runs) {
      const visible = line.flatMap(([x, y], i) => (bounds.contains([x, y]) ? [i] : []));
      if (!visible.length) continue;
      const p = toPath(line as [number, number][], cls);
      if (p) paths.push({ ...p, visible });
    }
  }
  return paths;
}

function pickKind(cls: string): VehicleKind {
  const r = Math.random();
  if (BUS_ROADS.has(cls) && r < 0.12) return "bus";
  if (r < 0.24) return "moto";
  if (r < 0.5) return "suv";
  return "car";
}

const SPEED: Record<VehicleKind, [number, number]> = { car: [9, 14], suv: [9, 13], bus: [6, 9], moto: [11, 16] };
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
/** Buses, highways and bridges don't park. */
const canPark = (v: Vehicle) => v.kind !== "bus" && !["motorway", "trunk"].includes(v.path.cls);

/** The first corner a car passes going from a to b along its street (not counting where it started). */
function crossed(p: Path, a: number, b: number): Junction | null {
  const hits = p.corners.filter((j) => (a < b ? j.at > a && j.at <= b : j.at < a && j.at >= b));
  if (!hits.length) return null;
  return hits.reduce((x, y) => (Math.abs(y.at - a) < Math.abs(x.at - a) ? y : x));
}

/**
 * Finds where the streets meet. Map tiles drop the shared point where two straight streets cross, so
 * corners are found by geometry: segments that intersect, and street ends that stop on (or at) another street.
 * Segments go in a ~50 m grid so only near neighbors are compared.
 */
function findCorners(paths: Path[]) {
  const CELL = 0.0005;
  const grid = new Map<string, { p: Path; i: number }[]>();
  const cells = (a: number[], b: number[], pad = 0) => {
    const out: string[] = [];
    for (let x = Math.floor((Math.min(a[0], b[0]) - pad) / CELL); x <= Math.floor((Math.max(a[0], b[0]) + pad) / CELL); x++)
      for (let y = Math.floor((Math.min(a[1], b[1]) - pad) / CELL); y <= Math.floor((Math.max(a[1], b[1]) + pad) / CELL); y++) out.push(`${x}:${y}`);
    return out;
  };
  for (const p of paths) {
    p.corners = [];
    for (let i = 1; i < p.pts.length; i++) for (const c of cells(p.pts[i - 1], p.pts[i])) {
      const l = grid.get(c);
      if (l) l.push({ p, i }); else grid.set(c, [{ p, i }]);
    }
  }
  const seen = new Set<string>();
  const ids = new Map(paths.map((p, n) => [p, n]));
  const add = (a: Path, at: number, b: Path, bAt: number) => {
    const key = `${ids.get(a)}:${ids.get(b)}:${Math.round(at / 6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    a.corners.push({ at, other: b, otherAt: bAt });
    b.corners.push({ at: bAt, other: a, otherAt: at });
  };
  // In meters around a point, so distances and crossings are true.
  const local = (p: Path, o: readonly number[]) => (q: readonly number[]) => [(q[0] - o[0]) * p.k * M_PER_DEG, (q[1] - o[1]) * M_PER_DEG];
  for (const segs of grid.values()) {
    for (let x = 0; x < segs.length; x++) for (let y = x + 1; y < segs.length; y++) {
      const A = segs[x], B = segs[y];
      if (A.p === B.p) continue;
      const m = local(A.p, A.p.pts[A.i - 1]);
      const [a0, a1, b0, b1] = [m(A.p.pts[A.i - 1]), m(A.p.pts[A.i]), m(B.p.pts[B.i - 1]), m(B.p.pts[B.i])];
      const r = [a1[0] - a0[0], a1[1] - a0[1]], d = [b1[0] - b0[0], b1[1] - b0[1]];
      const den = r[0] * d[1] - r[1] * d[0];
      if (Math.abs(den) < 1e-6) continue;
      const t = ((b0[0] - a0[0]) * d[1] - (b0[1] - a0[1]) * d[0]) / den;
      const u = ((b0[0] - a0[0]) * r[1] - (b0[1] - a0[1]) * r[0]) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      add(A.p, A.p.cum[A.i - 1] + t * (A.p.cum[A.i] - A.p.cum[A.i - 1]), B.p, B.p.cum[B.i - 1] + u * (B.p.cum[B.i] - B.p.cum[B.i - 1]));
    }
  }
  // Street ends that stop on another street (T-junctions, and one street carrying on as the next).
  const pad = SNAP_M / M_PER_DEG / 0.75;
  for (const p of paths) for (const end of [0, p.pts.length - 1]) {
    const e = p.pts[end];
    let best: { q: Path; at: number; dist: number } | null = null;
    for (const c of cells(e, e, pad)) for (const { p: q, i } of grid.get(c) ?? []) {
      if (q === p) continue;
      const m = local(q, e);
      const [s0, s1] = [m(q.pts[i - 1]), m(q.pts[i])];
      const len2 = (s1[0] - s0[0]) ** 2 + (s1[1] - s0[1]) ** 2 || 1;
      const t = Math.max(0, Math.min(1, -(s0[0] * (s1[0] - s0[0]) + s0[1] * (s1[1] - s0[1])) / len2));
      const dist = Math.hypot(s0[0] + t * (s1[0] - s0[0]), s0[1] + t * (s1[1] - s0[1]));
      if (dist <= SNAP_M && (!best || dist < best.dist)) best = { q, at: q.cum[i - 1] + t * (q.cum[i] - q.cum[i - 1]), dist };
    }
    if (best) add(p, p.cum[end], best.q, best.at);
  }
}

/** sites: where the landmarks stand now (they move off main roads once the streets load). */
export function createTraffic(map: MapLibreMap, sites: () => readonly Landmark[]): Traffic {
  const crawl = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let vehicles: Vehicle[] = [];
  let last = 0;
  let nextId = 1;

  let turns = 0;
  // The streets in view, for cars that drive off screen to come back as new ones.
  let lastPaths: Path[] = [];
  let recycleIn = 1;
  const pace = (v: Vehicle) => {
    const [lo, hi] = SPEED[v.kind];
    v.cruise = between(lo, hi) * between(0.7, 1.15) * (crawl ? 0.35 : 1);
    v.paceIn = between(4, 10);
  };

  const spawn = (paths: Path[]): Vehicle => {
    const path = paths[Math.floor(Math.random() * paths.length)];
    // Start near a point that's on screen, so traffic shows up where you're looking.
    const near = path.cum[path.visible[Math.floor(Math.random() * path.visible.length)]];
    const kind = pickKind(path.cls);
    const colors = VEHICLE_COLORS[kind];
    const v: Vehicle = {
      id: nextId++,
      path,
      kind,
      color: colors[Math.floor(Math.random() * colors.length)],
      at: Math.min(path.length, Math.max(0, near + (Math.random() - 0.5) * 160)),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: 0, cruise: 0, mode: "drive", timer: 0, paceIn: 0, parkIn: between(12, 50), shift: 0,
      heading: null, lastCorner: null, cameFrom: null,
    };
    pace(v);
    v.speed = v.cruise;
    // Some are already parked along the curb when you arrive.
    if (canPark(v) && Math.random() < 0.18) { v.mode = "parked"; v.shift = 1; v.speed = 0; v.timer = between(3, 20); }
    return v;
  };

  /** At a corner: maybe pause, maybe turn onto the crossing street (always, at the end of its own). */
  const turn = (v: Vehicle, ways: Junction[], must: boolean) => {
    if (!ways.length) return false;
    const j = ways[0];
    if (j === v.lastCorner) return false;
    v.lastCorner = j;
    if (v.mode === "drive" && Math.random() < PAUSE_CHANCE) { v.mode = "stop"; v.timer = between(0.6, 1.8); }
    if (!must && Math.random() > TURN_CHANCE) return false;
    const pick = ways[Math.floor(Math.random() * ways.length)];
    // Pull away from the corner along the new street, whichever way it has room.
    const room: (1 | -1)[] = [];
    if (pick.otherAt < pick.other.length - 10) room.push(1);
    if (pick.otherAt > 10) room.push(-1);
    if (!room.length) return false;
    v.cameFrom = v.path;
    v.path = pick.other;
    v.at = pick.otherAt;
    v.dir = room[Math.floor(Math.random() * room.length)];
    // The same corner, seen from the new street: decided already.
    v.lastCorner = pick.other.corners.find((c) => c.other === v.cameFrom && Math.abs(c.at - pick.otherAt) < 1) ?? null;
    turns++;
    return true;
  };

  // After a pan, cars still on screen keep driving (owner, Oct 16: they "were jumping around");
  // the ones left behind go, and new ones join at the new view's streets.
  const respawn = () => {
    if (map.getZoom() < TRAFFIC_MIN_ZOOM) {
      vehicles = [];
      return;
    }
    const bounds = map.getBounds();
    const lane = laneOffsetMeters(map.getZoom());
    vehicles = vehicles.filter((v) => bounds.contains(place(v, lane).at));
    if (vehicles.length >= MAX_VEHICLES) return;
    const paths = roadPaths(map, sites());
    if (!paths.length) return;
    findCorners(paths);
    lastPaths = paths;
    while (vehicles.length < Math.min(MAX_VEHICLES, paths.length * 3)) vehicles.push(spawn(paths));
    // New cars start their own frames: once the map is idle nothing else draws (owner, Oct 17: they'd stopped).
    map.triggerRepaint();
  };

  const onIdle = () => { if (!vehicles.length) respawn(); };
  map.on("moveend", respawn);
  map.on("idle", onIdle);
  if (map.loaded()) respawn();

  return {
    step(now) {
      if (map.getZoom() < TRAFFIC_MIN_ZOOM) return [];
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const lane = laneOffsetMeters(map.getZoom());
      // Turning takes cars off screen: each one that goes comes back as a new car pulling out from the curb in view.
      recycleIn -= dt;
      if (recycleIn <= 0 && lastPaths.length) {
        recycleIn = 1;
        const bounds = map.getBounds();
        vehicles = vehicles.map((v) => {
          if (bounds.contains(place(v, lane).at)) return v;
          const n = spawn(lastPaths);
          if (canPark(n)) { n.mode = "leave"; n.shift = 1; n.speed = 0; }
          return n;
        });
      }
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __traffic?: Record<string, number> };
        w.__traffic = { cars: vehicles.length, ...Object.fromEntries((["drive", "stop", "park", "parked", "leave"] as Mode[]).map((m) => [m, vehicles.filter((v) => v.mode === m).length])), turns: turns, corners: vehicles.reduce((n, v) => n + v.path.corners.length, 0) };
      }
      return vehicles.map((v) => {
        // What it's doing: cruising, a pause at a corner, pulling over, parked, pulling out.
        let target = v.cruise;
        v.timer -= dt;
        if (v.mode === "drive") {
          v.paceIn -= dt;
          if (v.paceIn <= 0) pace(v);
          v.parkIn -= dt;
          if (v.parkIn <= 0) {
            if (canPark(v) && Math.random() < 0.5) v.mode = "park";
            v.parkIn = between(20, 60);
          }
        } else if (v.mode === "stop") {
          target = 0;
          if (v.timer <= 0) v.mode = "drive";
        } else if (v.mode === "park") {
          target = Math.min(v.cruise, 3);
          v.shift = Math.min(1, v.shift + dt / 1.6);
          if (v.shift >= 1) { target = 0; if (v.speed < 0.3) { v.mode = "parked"; v.timer = between(4, 16); } }
        } else if (v.mode === "parked") {
          target = 0;
          v.speed = 0;
          if (v.timer <= 0) v.mode = "leave";
        } else {
          target = Math.min(v.cruise, 4);
          v.shift = Math.max(0, v.shift - dt / 1.6);
          if (v.shift <= 0) v.mode = "drive";
        }
        v.speed += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, target - v.speed));

        const from = v.at;
        v.at += v.dir * v.speed * dt * SPEED_UP;
        if (v.at >= v.path.length || v.at <= 0) {
          // The end of the street: onto a street that meets it there if there is one, else a U-turn.
          const end = v.at >= v.path.length ? v.path.length : 0;
          v.at = Math.min(v.path.length, Math.max(0, v.at));
          const ways = v.path.corners.filter((c) => Math.abs(c.at - end) <= SNAP_M && c.other !== v.cameFrom);
          if (!turn(v, ways, true)) v.dir = end ? -1 : 1;
        } else if (v.mode === "drive" || v.mode === "stop") {
          const j = crossed(v.path, from, v.at);
          if (j) turn(v, v.path.corners.filter((c) => Math.abs(c.at - j.at) < 1), false);
        }
        const { at, bearing } = place(v, lane);
        // Turn the body smoothly rather than snapping at corners and U-turns.
        if (v.heading === null) v.heading = bearing;
        else {
          const d = ((bearing - v.heading + 540) % 360) - 180;
          v.heading += Math.max(-dt * 220, Math.min(dt * 220, d));
        }
        return { id: v.id, at, bearing: v.heading, kind: v.kind, color: v.color };
      });
    },
    dispose() {
      map.off("moveend", respawn);
      map.off("idle", onIdle);
      vehicles = [];
    },
  };
}
