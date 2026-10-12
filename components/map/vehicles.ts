import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { laneOffsetMeters } from "@/lib/map/scale";
import { PIXEL_RATIO, VEHICLE_COLORS, drawVehicleIcon, type VehicleKind } from "./vehicleIcons";

// Moving traffic on the map when zoomed in (Milestones v0.3): up to 30 top-down
// cars, SUVs, buses and motorcycles driving along the streets in view, in the
// right-hand lane, turned to face the road. Pauses when the tab is hidden; never
// starts under reduced motion. Purely decorative: nothing in the game reads them.

const MIN_ZOOM = 15;
const MAX_VEHICLES = 30;
const FRAME_MS = 40;
const SPEED_UP = 2; // a little faster than real Queens traffic, so it reads as moving
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]);
const BUS_ROADS = new Set(["trunk", "primary", "secondary"]);
const M_PER_DEG = 111_320;

interface Path { pts: [number, number][]; cum: number[]; length: number; k: number; cls: string; visible: number[] }
interface Vehicle { path: Path; at: number; speed: number; dir: 1 | -1; kind: VehicleKind; color: number }

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

function roadPaths(map: MapLibreMap): Path[] {
  const bounds = map.getBounds();
  const paths: Path[] = [];
  for (const f of map.querySourceFeatures("osm", { sourceLayer: "transportation" })) {
    const cls = String(f.properties?.class);
    if (!ROAD_CLASSES.has(cls)) continue;
    const g = f.geometry;
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const line of lines) {
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

export function startVehicles(map: MapLibreMap): () => void {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  let vehicles: Vehicle[] = [];
  let raf = 0;
  let last = 0;
  let stopped = false;

  // Sprites are drawn on first use, and again after a day/night restyle.
  map.setMissingStyleImageResolver((id) => {
    if (!id.startsWith("veh-") || map.hasImage(id)) return;
    const img = drawVehicleIcon(id);
    if (img) map.addImage(id, img, { pixelRatio: PIXEL_RATIO });
  });

  const source = () => map.getSource("vehicles") as GeoJSONSource | undefined;
  const clear = () => {
    try { source()?.setData({ type: "FeatureCollection", features: [] }); } catch { /* map already removed */ }
  };

  const respawn = () => {
    if (map.getZoom() < MIN_ZOOM) {
      vehicles = [];
      clear();
      return;
    }
    const paths = roadPaths(map);
    if (!paths.length) return;
    vehicles = Array.from({ length: Math.min(MAX_VEHICLES, paths.length * 3) }, () => {
      const path = paths[Math.floor(Math.random() * paths.length)];
      // Start near a point that's on screen, so traffic shows up where you're looking.
      const near = path.cum[path.visible[Math.floor(Math.random() * path.visible.length)]];
      const kind = pickKind(path.cls);
      const [lo, hi] = SPEED[kind];
      return {
        path,
        kind,
        color: Math.floor(Math.random() * VEHICLE_COLORS[kind].length),
        at: Math.min(path.length, Math.max(0, near + (Math.random() - 0.5) * 160)),
        speed: lo + Math.random() * (hi - lo),
        dir: Math.random() < 0.5 ? 1 : -1,
      };
    });
  };

  const frame = (t: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || !vehicles.length || t - last < FRAME_MS) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    const features: GeoJSON.Feature[] = [];
    const lane = laneOffsetMeters(map.getZoom());
    for (const v of vehicles) {
      v.at += v.dir * v.speed * dt * SPEED_UP;
      if (v.at > v.path.length) { v.at = v.path.length; v.dir = -1; } // U-turn at the end of the block
      if (v.at < 0) { v.at = 0; v.dir = 1; }
      const { at, bearing } = place(v, lane);
      features.push({ type: "Feature", properties: { kind: v.kind, color: v.color, bearing }, geometry: { type: "Point", coordinates: at } });
    }
    source()?.setData({ type: "FeatureCollection", features });
  };

  const onIdle = () => { if (!vehicles.length) respawn(); };
  map.on("moveend", respawn);
  map.on("idle", onIdle);
  if (map.loaded()) respawn();
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    map.off("moveend", respawn);
    map.off("idle", onIdle);
    try { map.setMissingStyleImageResolver(null); } catch { /* map already removed */ }
    clear();
  };
}
