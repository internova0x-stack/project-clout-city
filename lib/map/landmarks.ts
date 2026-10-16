// Landmark buildings on the city map (owner, Oct 16: "key buildings and landmarks rendered like
// in the earlier build"). Each one is a hand-built low-poly model (components/map/landmarkModels.ts)
// standing at its real lat/lng, drawn by a three.js layer inside MapLibre. The plain OpenStreetMap
// blocks under it are hidden, so the model replaces them. Added in batches of five.
// Pure data, safe to import anywhere.

import type { LatLng } from "./geo.ts";

export type LandmarkKind = "unisphere" | "gantries" | "twin-towers" | "club" | "cafe" | "ballpark" | "tennis" | "bridge" | "studios" | "gallery"
  | "music-hall" | "lounge" | "bodega" | "pizzeria" | "college"
  | "gym" | "diner" | "church" | "library" | "firehouse"
  | "rooftop" | "uv-club" | "lucky-deli" | "dive-club" | "lotto"
  | "boutique" | "showroom" | "dealership" | "cinema" | "arena"
  | "st-johnsons" | "queensborough-u" | "fair-towers" | "discount-disco" | "bike-hub"
  | "googie-diner" | "sky-dining" | "supermarket" | "cowork" | "precinct";

export interface Landmark {
  id: string;
  /** The game place it stands for (lib/city.ts), when there is one. */
  placeId?: string;
  name: string;
  at: LatLng;
  kind: LandmarkKind;
  /** Which way the front faces, degrees clockwise from north (180 = faces south, toward the camera). */
  facing: number;
  /** Drawn bigger than life so it reads from helicopter height. */
  scale: number;
  /**
   * Its site: meters around it (at that scale) where OpenStreetMap buildings are hidden and the
   * ground covers the streets, so a landmark bigger than a block merges the blocks under it
   * (owner, Oct 16: "the white roads don't pass under them"). Traffic stops at the edge.
   */
  clear: number;
  /**
   * What the site's ground is: park grass or a city block. "none" is a structure that stands
   * where it is over roads or water (a bridge): no site, no placement, traffic drives through.
   */
  ground: "park" | "block" | "none";
  /** A bridge's length between its shores, in meters (the model stretches to it). */
  length?: number;
}

/** Where the map stood a landmark: placement moves it; a bridge also turns and stretches to its road. */
export interface Spot { at: LatLng; facing?: number; length?: number }

/** The length the bridge model is built at (components/map/landmarkModels.ts), before stretching. */
export const BRIDGE_BUILT_M = 1136;

/** Batch 1: the monument in Queens, then the first game places. */
export const LANDMARKS: readonly Landmark[] = [
  { id: "unisphere", placeId: "unisphere", name: "The Unisphere", at: [40.7466, -73.8448], kind: "unisphere", facing: 180, scale: 2.2, clear: 165, ground: "park" },
  { id: "gantry-plaza", placeId: "gantry-plaza", name: "Gantry Plaza", at: [40.7454, -73.9584], kind: "gantries", facing: 270, scale: 2, clear: 75, ground: "park" },
  { id: "skybridge-tower", placeId: "skybridge-tower", name: "Skybridge Tower", at: [40.7495, -73.9395], kind: "twin-towers", facing: 180, scale: 1.3, clear: 55, ground: "block" },
  { id: "velvet-static", placeId: "velvet-static", name: "Velvet Static", at: [40.7465, -73.9455], kind: "club", facing: 180, scale: 2.2, clear: 55, ground: "block" },
  // Batch 2: Queens landmarks from the owner's list. Not game places, so they carry a name label
  // instead of a pin. Branded venues get invented names (no real brands, CLAUDE.md).
  { id: "flushing-field", name: "Flushing Field", at: [40.7571, -73.8458], kind: "ballpark", facing: 225, scale: 1, clear: 150, ground: "block" },
  { id: "open-tennis", name: "Flushing Open Tennis Center", at: [40.7505, -73.8462], kind: "tennis", facing: 180, scale: 1, clear: 105, ground: "park" },
  { id: "queensboro-bridge", name: "Queensboro Bridge", at: [40.7566, -73.9529], kind: "bridge", facing: 208.5, scale: 1, clear: 0, ground: "none", length: 1305 },
  { id: "astoria-sound-stages", name: "Astoria Sound Stages", at: [40.7564, -73.9245], kind: "studios", facing: 180, scale: 1.2, clear: 85, ground: "block" },
  { id: "old-school-gallery", name: "Old School Gallery", at: [40.7455, -73.9474], kind: "gallery", facing: 180, scale: 1.4, clear: 50, ground: "block" },
  // Batch 3: Astoria game places.
  { id: "hellgate-hall", placeId: "hellgate-hall", name: "Hellgate Hall", at: [40.7737, -73.9178], kind: "music-hall", facing: 180, scale: 2, clear: 50, ground: "block" },
  { id: "low-light-lounge", placeId: "low-light-lounge", name: "Low Light Lounge", at: [40.7612, -73.9175], kind: "lounge", facing: 180, scale: 2.2, clear: 40, ground: "block" },
  { id: "ditmars-deli", placeId: "ditmars-deli", name: "Ditmars Deli & Dreams", at: [40.7748, -73.9128], kind: "bodega", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  { id: "two-bros-pizza", placeId: "two-bros-pizza", name: "Two Bros Who Fight Pizza", at: [40.7668, -73.9208], kind: "pizzeria", facing: 180, scale: 2.4, clear: 28, ground: "block" },
  { id: "astoria-cc", placeId: "astoria-cc", name: "Astoria Community College", at: [40.76, -73.9232], kind: "college", facing: 180, scale: 1.3, clear: 90, ground: "block" },
  // Batch 4: more Astoria places.
  { id: "pressed-iron-gym", placeId: "pressed-iron-gym", name: "Pressed Iron Gym", at: [40.7662, -73.9118], kind: "gym", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "rockaway-diner", placeId: "rockaway-diner", name: "Rockaway Diner", at: [40.7712, -73.9158], kind: "diner", facing: 180, scale: 2.2, clear: 38, ground: "block" },
  { id: "radiant-harbor", placeId: "radiant-harbor", name: "Radiant Harbor Church", at: [40.7738, -73.9296], kind: "church", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "ditmars-library", placeId: "ditmars-library", name: "Ditmars Free Library", at: [40.7735, -73.9098], kind: "library", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  { id: "engine-7", placeId: "engine-7", name: "Engine 7 Firehouse", at: [40.772, -73.9205], kind: "firehouse", facing: 180, scale: 2.2, clear: 32, ground: "block" },
  // Batch 5: Long Island City, Jackson Heights and Flushing.
  { id: "altitude-718", placeId: "altitude-718", name: "Altitude 718 Rooftop", at: [40.7425, -73.9555], kind: "rooftop", facing: 180, scale: 1.6, clear: 32, ground: "block" },
  { id: "ultraviolet-society", placeId: "ultraviolet-society", name: "Ultraviolet Society", at: [40.7402, -73.9593], kind: "uv-club", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "lucky-seven-deli", placeId: "lucky-seven-deli", name: "Lucky Seven Deli", at: [40.7495, -73.8885], kind: "lucky-deli", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  { id: "the-sticky-floor", placeId: "the-sticky-floor", name: "The Sticky Floor", at: [40.7512, -73.8832], kind: "dive-club", facing: 180, scale: 2.2, clear: 40, ground: "block" },
  { id: "lucky-star", placeId: "lucky-star", name: "Lucky Star Lotto", at: [40.7593, -73.8301], kind: "lotto", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  // Batch 6: shops and entertainment.
  { id: "thread-count", placeId: "thread-count", name: "Thread Count Boutique", at: [40.7651, -73.9204], kind: "boutique", facing: 180, scale: 2.2, clear: 30, ground: "block" },
  { id: "fifs-furniture", placeId: "fifs-furniture", name: "Fif's Furniture", at: [40.7418, -73.9405], kind: "showroom", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "boulevard-motors", placeId: "boulevard-motors", name: "Boulevard Motors", at: [40.7503, -73.9372], kind: "dealership", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "reel-queens", placeId: "reel-queens", name: "Reel Queens Cinema", at: [40.7605, -73.9196], kind: "cinema", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "respawn-arena", placeId: "respawn-arena", name: "Respawn Arena", at: [40.7708, -73.9105], kind: "arena", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  // Batch 7: campuses, the park's World's Fair towers, a club and the delivery hub.
  { id: "st-johnsons", placeId: "st-johnsons", name: "St. Johnsons University", at: [40.7224, -73.7949], kind: "st-johnsons", facing: 180, scale: 1.2, clear: 175, ground: "park" },
  { id: "queensborough-u", placeId: "queensborough-u", name: "Queensborough University", at: [40.7366, -73.817], kind: "queensborough-u", facing: 180, scale: 1.2, clear: 170, ground: "park" },
  { id: "flushing-meadows", placeId: "flushing-meadows", name: "World's Fair Towers", at: [40.742, -73.844], kind: "fair-towers", facing: 180, scale: 1.3, clear: 75, ground: "park" },
  { id: "discount-disco", placeId: "discount-disco", name: "Discount Disco", at: [40.7577, -73.8336], kind: "discount-disco", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  { id: "pedal-pushers", placeId: "pedal-pushers", name: "Pedal Pushers Hub", at: [40.759, -73.928], kind: "bike-hub", facing: 180, scale: 1.9, clear: 42, ground: "block" },
  // Batch 8: more Astoria places.
  { id: "neon-spoon", placeId: "neon-spoon", name: "The Neon Spoon", at: [40.7695, -73.9265], kind: "googie-diner", facing: 180, scale: 2.1, clear: 36, ground: "block" },
  { id: "up-on-thirty", placeId: "up-on-thirty", name: "Up on Thirty", at: [40.7672, -73.9238], kind: "sky-dining", facing: 180, scale: 1.4, clear: 30, ground: "block" },
  { id: "steinway-fresh", placeId: "steinway-fresh", name: "Steinway Fresh Mart", at: [40.7628, -73.916], kind: "supermarket", facing: 180, scale: 1.7, clear: 48, ground: "block" },
  { id: "triborough-works", placeId: "triborough-works", name: "Triborough Works", at: [40.766, -73.9252], kind: "cowork", facing: 180, scale: 1.7, clear: 42, ground: "block" },
  { id: "precinct-114-half", placeId: "precinct-114-half", name: "The 114½ Precinct", at: [40.769, -73.9228], kind: "precinct", facing: 180, scale: 2, clear: 36, ground: "block" },
  { id: "grind-and-gossip", placeId: "grind-and-gossip", name: "Grind & Gossip Café", at: [40.7645, -73.9225], kind: "cafe", facing: 180, scale: 2.4, clear: 30, ground: "block" },
];

/**
 * A filter that keeps an OpenStreetMap building only when it is clear of every landmark
 * ("distance" from a building to a point inside it is 0).
 */
export function clearOfLandmarks(list: readonly Landmark[] = LANDMARKS): unknown[] {
  return ["all", ...list.filter((l) => l.clear > 0).map((l) => [">", ["distance", { type: "Point", coordinates: [l.at[1], l.at[0]] }], l.clear])];
}

const M_PER_DEG = 111_320;

/** Each landmark's site as a ground polygon (a 40-sided circle), for the map's site layer. */
export function landmarkSites(list: readonly Landmark[] = LANDMARKS): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list.filter((l) => l.ground !== "none").map((l) => {
      const k = Math.cos((l.at[0] * Math.PI) / 180);
      const ring = Array.from({ length: 41 }, (_, i) => {
        const a = ((i % 40) / 40) * Math.PI * 2;
        return [l.at[1] + (Math.cos(a) * l.clear) / (M_PER_DEG * k), l.at[0] + (Math.sin(a) * l.clear) / M_PER_DEG];
      });
      return { type: "Feature", properties: { id: l.id, ground: l.ground }, geometry: { type: "Polygon", coordinates: [ring] } };
    }),
  };
}

/** Whether a point (lng, lat) is on a landmark's site: traffic doesn't drive there. */
export function onLandmarkSite(lng: number, lat: number, list: readonly Landmark[] = LANDMARKS): boolean {
  const k = Math.cos((lat * Math.PI) / 180);
  return list.some((l) => l.ground !== "none" && Math.hypot((lng - l.at[1]) * k * M_PER_DEG, (lat - l.at[0]) * M_PER_DEG) < l.clear);
}

// ---------------------------------------------------------------------------
// Placement (owner, Oct 16: "they should be inside the blocks"): a landmark moves to the nearest
// spot where no main road or rail line crosses its site, covering as few side streets as it can.
// The map runs this on the real streets around it once they've loaded (components/map/CityMap.tsx).
// ---------------------------------------------------------------------------

/** A road from the map's tiles: its points (lng, lat) and whether it's a main road or rail. */
export interface RoadLine { major: boolean; bridge?: boolean; pts: readonly (readonly [number, number])[] }

export const MAJOR_ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "rail", "transit"]);
/** How far a landmark may move from its place's coordinates, and how finely to search. */
export const PLACE_SEARCH = { radius: 360, step: 12, majorMargin: 8 } as const;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Where to stand a landmark: the closest spot (within PLACE_SEARCH.radius) whose site no main road
 * comes near, preferring spots that cover no side street. Returns its own spot when that's clear,
 * or when nothing nearby is.
 */
export function placeLandmark(l: Landmark, roads: readonly RoadLine[], others: readonly Landmark[] = []): LatLng {
  if (l.ground === "none") return l.at;
  const k = Math.cos((l.at[0] * Math.PI) / 180);
  // Local meters around the place (x east, y north).
  const toM = (lng: number, lat: number): [number, number] => [(lng - l.at[1]) * k * M_PER_DEG, (lat - l.at[0]) * M_PER_DEG];
  const reach = PLACE_SEARCH.radius + l.clear + PLACE_SEARCH.majorMargin;
  const segs: { major: boolean; a: [number, number]; b: [number, number] }[] = [];
  for (const r of roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const a = toM(r.pts[i - 1][0], r.pts[i - 1][1]);
      const b = toM(r.pts[i][0], r.pts[i][1]);
      if (segDist(0, 0, a[0], a[1], b[0], b[1]) <= reach) segs.push({ major: r.major, a, b });
    }
  }
  const near = others.filter((o) => o.id !== l.id && o.ground !== "none").map((o) => ({ at: toM(o.at[1], o.at[0]), r: o.clear + l.clear }));
  const cost = (x: number, y: number): number => {
    // Sites never overlap.
    for (const o of near) if (Math.hypot(x - o.at[0], y - o.at[1]) < o.r) return Infinity;
    let minors = 0;
    for (const s of segs) {
      const d = segDist(x, y, s.a[0], s.a[1], s.b[0], s.b[1]);
      if (s.major && d < l.clear + PLACE_SEARCH.majorMargin) return Infinity;
      if (!s.major && d < l.clear) minors++;
    }
    // Moving costs a meter a meter; each side street merged under the site costs as much as 150 m.
    return Math.hypot(x, y) + minors * 150;
  };
  let best: [number, number] = [0, 0];
  let bestCost = cost(0, 0);
  if (bestCost === 0) return l.at;
  const n = Math.floor(PLACE_SEARCH.radius / PLACE_SEARCH.step);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * PLACE_SEARCH.step, y = j * PLACE_SEARCH.step;
      if (Math.hypot(x, y) > PLACE_SEARCH.radius || Math.hypot(x, y) >= bestCost) continue;
      const c = cost(x, y);
      if (c < bestCost) { bestCost = c; best = [x, y]; }
    }
  }
  if (!Number.isFinite(bestCost)) return l.at;
  return [l.at[0] + best[1] / M_PER_DEG, l.at[1] + best[0] / (k * M_PER_DEG)];
}

/** The landmarks with some moved (and bridges turned and stretched) to where the map stood them. */
export function withPositions(moved: Readonly<Record<string, Spot>>, list: readonly Landmark[] = LANDMARKS): Landmark[] {
  return list.map((l) => {
    const m = moved[l.id];
    return m ? { ...l, at: m.at, facing: m.facing ?? l.facing, length: m.length ?? l.length } : l;
  });
}

/**
 * A bridge fitted to its road (owner, Oct 16: "it doesn't cross to the other side"): the bridge
 * segments of the map's roads near it, along their main direction, end to end. Null when the
 * map has no bridge road there.
 */
export function fitBridge(l: Landmark, roads: readonly RoadLine[]): Spot | null {
  const k = Math.cos((l.at[0] * Math.PI) / 180);
  const pts: [number, number][] = [];
  for (const r of roads) {
    if (!r.bridge) continue;
    for (const [lng, lat] of r.pts) {
      const p: [number, number] = [(lng - l.at[1]) * k * M_PER_DEG, (lat - l.at[0]) * M_PER_DEG];
      if (Math.hypot(p[0], p[1]) < 900) pts.push(p);
    }
  }
  if (pts.length < 2) return null;
  // Main direction: the principal axis of the points.
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const along = pts.map(([x, y]) => (x - mx) * ux + (y - my) * uy);
  const lo = Math.min(...along), hi = Math.max(...along);
  const length = hi - lo;
  if (length < 300) return null;
  const cx = mx + ux * (lo + hi) / 2, cy = my + uy * (lo + hi) / 2;
  // The model's length runs along its x axis, which points to (facing - 90) on the compass.
  const bearing = ((Math.atan2(ux, uy) * 180) / Math.PI + 360) % 180;
  return {
    at: [l.at[0] + cy / M_PER_DEG, l.at[1] + cx / (k * M_PER_DEG)],
    facing: bearing + 90,
    length: Math.min(2000, length),
  };
}

/**
 * Which way a landmark should face so it lines up with the street grid around it (owner, Oct 16:
 * "make them tilt in line with the grid"). The grid's direction is the length-weighted average of
 * nearby street bearings folded into a quarter turn; of the four facings that line up with it, the
 * one closest to the landmark's own (south, toward the camera) wins. Its own facing when no streets.
 */
export function gridFacing(l: Landmark, roads: readonly RoadLine[], radius = 250): number {
  const k = Math.cos((l.at[0] * Math.PI) / 180);
  let sx = 0, sy = 0;
  for (const r of roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const ax = (r.pts[i - 1][0] - l.at[1]) * k * M_PER_DEG, ay = (r.pts[i - 1][1] - l.at[0]) * M_PER_DEG;
      const bx = (r.pts[i][0] - l.at[1]) * k * M_PER_DEG, by = (r.pts[i][1] - l.at[0]) * M_PER_DEG;
      if (Math.hypot((ax + bx) / 2, (ay + by) / 2) > radius) continue;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      const bearing = Math.atan2(bx - ax, by - ay); // radians clockwise from north
      sx += len * Math.cos(4 * bearing);
      sy += len * Math.sin(4 * bearing);
    }
  }
  if (Math.hypot(sx, sy) < 1) return l.facing;
  const grid = ((Math.atan2(sy, sx) / 4) * 180) / Math.PI; // one street direction, -45..45
  let best = l.facing, bestDiff = Infinity;
  for (let q = 0; q < 4; q++) {
    const f = (((grid + q * 90) % 360) + 360) % 360;
    const diff = Math.abs(((f - l.facing + 540) % 360) - 180);
    if (diff < bestDiff) { bestDiff = diff; best = f; }
  }
  return best;
}
