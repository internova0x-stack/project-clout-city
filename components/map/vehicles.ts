import type { Map as MapLibreMap } from "maplibre-gl";
import { onLandmarkSite, type Landmark } from "@/lib/map/landmarks";
import { laneOffsetMeters } from "@/lib/map/scale";
import { VEHICLE_COLORS, type VehicleKind } from "./vehicleModels";

// Moving traffic on the map when zoomed in (Milestones v0.3): up to 30 cars, cabs, SUVs, buses
// and scooters driving along the streets in view, in the right-hand lane, turned to face the road.
// Since Oct 16 they are 3D models in the landmark layer (components/map/landmarkLayer.ts), which
// steps this simulation every frame it draws. Under reduced motion they stay parked.
// Purely decorative: nothing in the game reads them.

export const TRAFFIC_MIN_ZOOM = 15;
const MAX_VEHICLES = 30;
const SPEED_UP = 1.2; // a touch faster than real Queens traffic, so it reads as moving
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]);
const BUS_ROADS = new Set(["trunk", "primary", "secondary"]);
const M_PER_DEG = 111_320;

interface Path { pts: [number, number][]; cum: number[]; length: number; k: number; cls: string; visible: number[] }
interface Vehicle { id: number; path: Path; at: number; speed: number; dir: 1 | -1; kind: VehicleKind; color: string }

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
  return length > 60 ? { pts: coords, cum, length, k, cls, visible: [] } : null;
}

/** Position (in the right-hand lane for the direction of travel) and compass bearing. */
function place(v: Vehicle, lane: number): { at: [number, number]; bearing: number } {
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

/** sites: where the landmarks stand now (they move off main roads once the streets load). */
export function createTraffic(map: MapLibreMap, sites: () => readonly Landmark[]): Traffic {
  const parked = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let vehicles: Vehicle[] = [];
  let last = 0;
  let nextId = 1;

  const spawn = (paths: Path[]): Vehicle => {
    const path = paths[Math.floor(Math.random() * paths.length)];
    // Start near a point that's on screen, so traffic shows up where you're looking.
    const near = path.cum[path.visible[Math.floor(Math.random() * path.visible.length)]];
    const kind = pickKind(path.cls);
    const [lo, hi] = SPEED[kind];
    const colors = VEHICLE_COLORS[kind];
    return {
      id: nextId++,
      path,
      kind,
      color: colors[Math.floor(Math.random() * colors.length)],
      at: Math.min(path.length, Math.max(0, near + (Math.random() - 0.5) * 160)),
      speed: parked ? 0 : lo + Math.random() * (hi - lo),
      dir: Math.random() < 0.5 ? 1 : -1,
    };
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
    while (vehicles.length < Math.min(MAX_VEHICLES, paths.length * 3)) vehicles.push(spawn(paths));
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
      return vehicles.map((v) => {
        v.at += v.dir * v.speed * dt * SPEED_UP;
        if (v.at > v.path.length) { v.at = v.path.length; v.dir = -1; } // U-turn at the end of the block
        if (v.at < 0) { v.at = 0; v.dir = 1; }
        const { at, bearing } = place(v, lane);
        return { id: v.id, at, bearing, kind: v.kind, color: v.color };
      });
    },
    dispose() {
      map.off("moveend", respawn);
      map.off("idle", onIdle);
      vehicles = [];
    },
  };
}
