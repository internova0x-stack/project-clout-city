import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

// Moving vehicles on the map when zoomed in (Milestones v0.3): up to 30 dots that
// drive along the streets in view. Pauses when the tab is hidden; never starts
// under reduced motion. Purely decorative: nothing in the game reads them.

const MIN_ZOOM = 15;
const MAX_VEHICLES = 30;
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]);
const COLORS = ["#E8692E", "#2A2530", "#FFFFFF", "#6C8CFF", "#D93A2F", "#FFC21A", "#9AA0AA"];

interface Path { pts: [number, number][]; cum: number[]; length: number }
interface Vehicle { path: Path; at: number; speed: number; dir: 1 | -1; color: string }

const M_PER_DEG = 111_320;

function toPath(coords: [number, number][]): Path | null {
  if (coords.length < 2) return null;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i - 1][0]) * k * M_PER_DEG;
    const dy = (coords[i][1] - coords[i - 1][1]) * M_PER_DEG;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const length = cum[cum.length - 1];
  return length > 60 ? { pts: coords, cum, length } : null;
}

function pointAt(p: Path, d: number): [number, number] {
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < d) i++;
  const seg = p.cum[i] - p.cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - p.cum[i - 1]) / seg));
  const a = p.pts[i - 1];
  const b = p.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function roadPaths(map: MapLibreMap): Path[] {
  const b = map.getBounds();
  const feats = map.querySourceFeatures("osm", { sourceLayer: "transportation" });
  const paths: Path[] = [];
  for (const f of feats) {
    if (!ROAD_CLASSES.has(String(f.properties?.class))) continue;
    const g = f.geometry;
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const line of lines) {
      if (!line.some(([x, y]) => b.contains([x, y]))) continue;
      const p = toPath(line as [number, number][]);
      if (p) paths.push(p);
    }
  }
  return paths;
}

export function startVehicles(map: MapLibreMap): () => void {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  let vehicles: Vehicle[] = [];
  let raf = 0;
  let last = 0;
  let stopped = false;

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
    vehicles = Array.from({ length: Math.min(MAX_VEHICLES, paths.length * 2) }, () => {
      const path = paths[Math.floor(Math.random() * paths.length)];
      return {
        path,
        at: Math.random() * path.length,
        speed: 9 + Math.random() * 8, // m/s, a little faster than real Queens traffic
        dir: Math.random() < 0.5 ? 1 : -1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });
  };

  const frame = (t: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || !vehicles.length || t - last < 33) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    for (const v of vehicles) {
      v.at += v.dir * v.speed * dt * 3;
      if (v.at > v.path.length) { v.at = v.path.length; v.dir = -1; }
      if (v.at < 0) { v.at = 0; v.dir = 1; }
    }
    source()?.setData({
      type: "FeatureCollection",
      features: vehicles.map((v) => ({ type: "Feature", properties: { color: v.color }, geometry: { type: "Point", coordinates: pointAt(v.path, v.at) } })),
    });
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
    clear();
  };
}
