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
