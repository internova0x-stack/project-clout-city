// Landmark buildings on the city map (owner, Oct 16: "key buildings and landmarks rendered like
// in the earlier build"). Each one is a hand-built low-poly model (components/map/landmarkModels.ts)
// standing at its real lat/lng, drawn by a three.js layer inside MapLibre. The plain OpenStreetMap
// blocks under it are hidden, so the model replaces them. Added in batches of five.
// Pure data, safe to import anywhere.

import type { LatLng } from "./geo.ts";

export type LandmarkKind = "unisphere" | "gantries" | "twin-towers" | "club" | "cafe";

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
  /** What the site's ground is: park grass or a city block. */
  ground: "park" | "block";
}

/** Batch 1: the monument in Queens, then the first game places. */
export const LANDMARKS: readonly Landmark[] = [
  { id: "unisphere", placeId: "unisphere", name: "The Unisphere", at: [40.7466, -73.8448], kind: "unisphere", facing: 180, scale: 2.2, clear: 165, ground: "park" },
  { id: "gantry-plaza", placeId: "gantry-plaza", name: "Gantry Plaza", at: [40.7454, -73.9584], kind: "gantries", facing: 270, scale: 2, clear: 75, ground: "park" },
  { id: "skybridge-tower", placeId: "skybridge-tower", name: "Skybridge Tower", at: [40.7495, -73.9395], kind: "twin-towers", facing: 180, scale: 1.3, clear: 55, ground: "block" },
  { id: "velvet-static", placeId: "velvet-static", name: "Velvet Static", at: [40.7465, -73.9455], kind: "club", facing: 180, scale: 2.2, clear: 55, ground: "block" },
  { id: "grind-and-gossip", placeId: "grind-and-gossip", name: "Grind & Gossip Café", at: [40.7645, -73.9225], kind: "cafe", facing: 180, scale: 2.4, clear: 30, ground: "block" },
];

/**
 * A filter that keeps an OpenStreetMap building only when it is clear of every landmark
 * ("distance" from a building to a point inside it is 0).
 */
export function clearOfLandmarks(list: readonly Landmark[] = LANDMARKS): unknown[] {
  return ["all", ...list.map((l) => [">", ["distance", { type: "Point", coordinates: [l.at[1], l.at[0]] }], l.clear])];
}

const M_PER_DEG = 111_320;

/** Each landmark's site as a ground polygon (a 40-sided circle), for the map's site layer. */
export function landmarkSites(list: readonly Landmark[] = LANDMARKS): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list.map((l) => {
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
  return list.some((l) => Math.hypot((lng - l.at[1]) * k * M_PER_DEG, (lat - l.at[0]) * M_PER_DEG) < l.clear);
}

// ---------------------------------------------------------------------------
// Placement (owner, Oct 16: "they should be inside the blocks"): a landmark moves to the nearest
// spot where no main road or rail line crosses its site, covering as few side streets as it can.
// The map runs this on the real streets around it once they've loaded (components/map/CityMap.tsx).
// ---------------------------------------------------------------------------

/** A road from the map's tiles: its points (lng, lat) and whether it's a main road or rail. */
export interface RoadLine { major: boolean; pts: readonly (readonly [number, number])[] }

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
export function placeLandmark(l: Landmark, roads: readonly RoadLine[]): LatLng {
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
  const cost = (x: number, y: number): number => {
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

/** The landmarks with some moved to where placeLandmark stood them. */
export function withPositions(moved: Readonly<Record<string, LatLng>>, list: readonly Landmark[] = LANDMARKS): Landmark[] {
  return list.map((l) => (moved[l.id] ? { ...l, at: moved[l.id] } : l));
}
