// Landmark buildings on the city map (owner, Oct 16: "key buildings and landmarks rendered like
// in the earlier build"). Each one is a hand-built low-poly model (components/map/landmarkModels.ts)
// standing at its real lat/lng, drawn by a three.js layer inside MapLibre. The plain OpenStreetMap
// blocks under it are hidden, so the model replaces them. Added in batches of five.
// Pure data, safe to import anywhere.

import type { LatLng } from "./geo.ts";

export type LandmarkKind = "unisphere" | "gantries" | "twin-towers" | "club" | "cafe" | "ballpark" | "tennis" | "bridge" | "studios" | "gallery"
  | "music-hall" | "lounge" | "bodega" | "pizzeria" | "college"
  | "gym" | "diner" | "church" | "library" | "firehouse"
  | "rooftop" | "uv-club" | "mixer" | "dive-club" | "lotto"
  | "boutique" | "showroom" | "dealership" | "cinema" | "arena"
  | "st-johnsons" | "queensborough-u" | "fair-towers" | "discount-disco" | "bike-hub" | "hospital" | "brownstone"
  | "googie-diner" | "hub" | "sky-dining" | "supermarket" | "cowork" | "precinct"
  | "chapel" | "fitness" | "hell-gate" | "el-station" | "condo-towers" | "pier-park"
  | "radio-station" | "clout-tower";

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
  /**
   * A bridge's length between its shores, in meters (the model stretches to it). On a structure
   * over a street (an elevated station) it's the strip along the street, `clear` meters either
   * side, where the buildings are hidden.
   */
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
  { id: "skybridge-tower", placeId: "skybridge-tower", name: "Skybridge Tower", at: [40.7188, -73.9622], kind: "twin-towers", facing: 180, scale: 1.3, clear: 55, ground: "block" },
  { id: "velvet-static", placeId: "velvet-static", name: "Velvet Static", at: [40.7465, -73.9455], kind: "club", facing: 180, scale: 2.2, clear: 55, ground: "block" },
  // Batch 2: Queens landmarks from the owner's list. Not game places, so they carry a name label
  // instead of a pin. Branded venues get invented names (no real brands, CLAUDE.md).
  { id: "flushing-field", placeId: "meteor-park", name: "Meteor Park", at: [40.7571, -73.8458], kind: "ballpark", facing: 225, scale: 1, clear: 150, ground: "block" },
  { id: "open-tennis", name: "Flushing Open Tennis Center", at: [40.7505, -73.8462], kind: "tennis", facing: 180, scale: 1, clear: 105, ground: "park" },
  { id: "queensboro-bridge", name: "Queensboro Bridge", at: [40.7566, -73.9529], kind: "bridge", facing: 208.5, scale: 1, clear: 0, ground: "none", length: 1305 },
  { id: "astoria-sound-stages", name: "Astoria Sound Stages", at: [40.7564, -73.9245], kind: "studios", facing: 180, scale: 1.2, clear: 85, ground: "block" },
  { id: "old-school-gallery", name: "Old School Gallery", at: [40.7455, -73.9474], kind: "gallery", facing: 180, scale: 1.4, clear: 50, ground: "block" },
  // Batch 3: Astoria game places.
  { id: "hellgate-hall", placeId: "hellgate-hall", name: "The Kiln", at: [40.7085, -73.942], kind: "music-hall", facing: 180, scale: 2, clear: 50, ground: "block" },
  { id: "low-light-lounge", placeId: "low-light-lounge", name: "Low Light Lounge", at: [40.7612, -73.9175], kind: "lounge", facing: 180, scale: 2.2, clear: 40, ground: "block" },
  { id: "ditmars-deli", placeId: "ditmars-deli", name: "Ditmars Deli & Dreams", at: [40.7748, -73.9128], kind: "bodega", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  { id: "two-bros-pizza", placeId: "two-bros-pizza", name: "Two Bros Who Fight Pizza", at: [40.725, -73.9565], kind: "pizzeria", facing: 180, scale: 2.4, clear: 28, ground: "block" },
  { id: "astoria-cc", placeId: "astoria-cc", name: "Grand Street Community College", at: [40.7118, -73.9545], kind: "college", facing: 180, scale: 1.3, clear: 90, ground: "block" },
  // Batch 4: more Astoria places.
  { id: "pressed-iron-gym", placeId: "pressed-iron-gym", name: "Pressed Iron Gym", at: [40.7105, -73.9392], kind: "gym", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "rockaway-diner", placeId: "rockaway-diner", name: "Rockaway Diner", at: [40.7712, -73.9158], kind: "diner", facing: 180, scale: 2.2, clear: 38, ground: "block" },
  { id: "radiant-harbor", placeId: "radiant-harbor", name: "Radiant Harbor Church", at: [40.7738, -73.9296], kind: "church", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "ditmars-library", placeId: "ditmars-library", name: "Ditmars Free Library", at: [40.7735, -73.9098], kind: "library", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  { id: "engine-7", placeId: "engine-7", name: "Engine 7 Firehouse", at: [40.772, -73.9205], kind: "firehouse", facing: 180, scale: 2.2, clear: 32, ground: "block" },
  // Batch 5: Long Island City, Jackson Heights and Flushing.
  { id: "altitude-718", placeId: "altitude-718", name: "Altitude 718 Rooftop", at: [40.7112, -73.965], kind: "rooftop", facing: 180, scale: 1.6, clear: 32, ground: "block" },
  { id: "ultraviolet-society", placeId: "ultraviolet-society", name: "Ultraviolet Society", at: [40.7135, -73.9625], kind: "uv-club", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "lucky-seven-deli", placeId: "lucky-seven-deli", name: "Sip & Spill", at: [40.7495, -73.8885], kind: "mixer", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  { id: "the-sticky-floor", placeId: "the-sticky-floor", name: "The Sticky Floor", at: [40.7058, -73.9372], kind: "dive-club", facing: 180, scale: 2.2, clear: 40, ground: "block" },
  { id: "lucky-star", placeId: "lucky-star", name: "Lucky Star Lotto", at: [40.7593, -73.8303], kind: "lotto", facing: 180, scale: 2.4, clear: 30, ground: "block" },
  // Batch 6: shops and entertainment.
  { id: "thread-count", placeId: "thread-count", name: "Thread Count Boutique", at: [40.7172, -73.957], kind: "boutique", facing: 180, scale: 2.2, clear: 30, ground: "block" },
  { id: "fifs-furniture", placeId: "fifs-furniture", name: "Fif's Furniture", at: [40.7272, -73.9532], kind: "showroom", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "boulevard-motors", placeId: "boulevard-motors", name: "Boulevard Motors", at: [40.7292, -73.944], kind: "dealership", facing: 180, scale: 1.8, clear: 50, ground: "block" },
  { id: "reel-queens", placeId: "reel-queens", name: "Reel Kings Cinema", at: [40.7238, -73.9478], kind: "cinema", facing: 180, scale: 2, clear: 40, ground: "block" },
  { id: "respawn-arena", placeId: "respawn-arena", name: "Respawn Arena", at: [40.7098, -73.9482], kind: "arena", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  // Batch 7: campuses, the park's World's Fair towers, a club and the delivery hub.
  { id: "st-johnsons", placeId: "st-johnsons", name: "St. Johnsons University", at: [40.7224, -73.7949], kind: "st-johnsons", facing: 180, scale: 1.2, clear: 175, ground: "park" },
  { id: "queensborough-u", placeId: "queensborough-u", name: "Queensborough University", at: [40.7366, -73.817], kind: "queensborough-u", facing: 180, scale: 1.2, clear: 170, ground: "park" },
  { id: "flushing-meadows", placeId: "flushing-meadows", name: "World's Fair Towers", at: [40.742, -73.844], kind: "fair-towers", facing: 180, scale: 1.3, clear: 75, ground: "park" },
  { id: "discount-disco", placeId: "discount-disco", name: "Discount Disco", at: [40.7038, -73.9328], kind: "discount-disco", facing: 180, scale: 1.9, clear: 45, ground: "block" },
  { id: "pedal-pushers", placeId: "pedal-pushers", name: "Pedal Pushers Hub", at: [40.715, -73.952], kind: "bike-hub", facing: 180, scale: 1.9, clear: 42, ground: "block" },
  // Batch 8: more Astoria places.
  // The Hub (owner, Oct 16): was the Neon Spoon's googie diner; now four tilted glass rings round a lit core.
  { id: "neon-spoon", placeId: "neon-spoon", name: "The Hub", at: [40.7695, -73.9265], kind: "hub", facing: 180, scale: 1.5, clear: 40, ground: "block" },
  { id: "up-on-thirty", placeId: "up-on-thirty", name: "Up on Wythe", at: [40.7205, -73.9595], kind: "sky-dining", facing: 180, scale: 1.4, clear: 30, ground: "block" },
  { id: "steinway-fresh", placeId: "steinway-fresh", name: "Steinway Fresh Mart", at: [40.7628, -73.916], kind: "supermarket", facing: 180, scale: 1.7, clear: 48, ground: "block" },
  { id: "triborough-works", placeId: "triborough-works", name: "Triborough Works", at: [40.766, -73.9252], kind: "cowork", facing: 180, scale: 1.7, clear: 42, ground: "block" },
  { id: "precinct-114-half", placeId: "precinct-114-half", name: "The 114½ Precinct", at: [40.769, -73.9228], kind: "precinct", facing: 180, scale: 2, clear: 36, ground: "block" },
  // Batch 9: the last places. The station stands over its street (no site), like the bridge.
  // Owner, Oct 17: St. Copay's General Hospital (Queens) and Brownstone Sessions (Brooklyn).
  { id: "st-copays", placeId: "st-copays", name: "St. Copay's General Hospital", at: [40.7651, -73.9204], kind: "hospital", facing: 180, scale: 1.6, clear: 45, ground: "block" },
  { id: "brownstone-sessions", placeId: "brownstone-sessions", name: "Brownstone Sessions", at: [40.7128, -73.944], kind: "brownstone", facing: 180, scale: 2.2, clear: 28, ground: "block" },
  { id: "harmony-chapel", placeId: "harmony-chapel", name: "Harmony Community Chapel", at: [40.7652, -73.913], kind: "chapel", facing: 180, scale: 2, clear: 32, ground: "block" },
  { id: "rep-count", placeId: "rep-count", name: "Rep Count Fitness", at: [40.7168, -73.9468], kind: "fitness", facing: 180, scale: 2, clear: 34, ground: "block" },
  { id: "hell-gate-park", placeId: "hell-gate-park", name: "Astoria Park", at: [40.779, -73.9232], kind: "hell-gate", facing: 180, scale: 1.3, clear: 95, ground: "park" },
  { id: "astoria-blvd-station", placeId: "astoria-blvd-station", name: "Astoria Blvd station", at: [40.7702, -73.918], kind: "el-station", facing: 180, scale: 1.6, clear: 18, ground: "none", length: 150 },
  { id: "skyline-pier", placeId: "skyline-pier", name: "Skyline Pier Residences", at: [40.7478, -73.9592], kind: "condo-towers", facing: 180, scale: 1.3, clear: 50, ground: "block" },
  { id: "hunters-pier", placeId: "hunters-pier", name: "Hunter's Pier", at: [40.7432, -73.9612], kind: "pier-park", facing: 270, scale: 1.6, clear: 60, ground: "park" },
  // v0.14 On Air: Real Clout FM's studio and broadcast mast, by the film studios (a place since Oct 16).
  { id: "real-clout-fm", placeId: "real-clout-fm", name: "Real Clout FM", at: [40.7598, -73.9262], kind: "radio-station", facing: 180, scale: 1.6, clear: 40, ground: "block" },
  // v0.14 On Air: the Clout Tower, a Times Square-style tower whose big screen shows Clout TV's feature.
  { id: "clout-tower", placeId: "clout-tower", name: "Clout TV Tower", at: [40.7585, -73.9195], kind: "clout-tower", facing: 180, scale: 1.4, clear: 45, ground: "block" },
  { id: "grind-and-gossip", placeId: "grind-and-gossip", name: "Grind & Gossip Café", at: [40.7645, -73.9225], kind: "cafe", facing: 180, scale: 2.4, clear: 30, ground: "block" },
];

/**
 * A filter that keeps an OpenStreetMap building only when it is clear of every landmark
 * ("distance" from a building to a point inside it is 0).
 */
export function clearOfLandmarks(list: readonly Landmark[] = LANDMARKS): unknown[] {
  return ["all", ...list.filter((l) => l.clear > 0).map((l) => [">", ["distance", siteShape(l)], l.clear])];
}

const M_PER_DEG = 111_320;

/** A site's middle: its point, or for a structure over a street, the line it runs along. */
function siteShape(l: Landmark): GeoJSON.Point | GeoJSON.LineString {
  if (l.ground !== "none" || !l.length) return { type: "Point", coordinates: [l.at[1], l.at[0]] };
  // The model's length runs along its x axis, which points to (facing - 90) on the compass.
  const b = ((l.facing - 90) * Math.PI) / 180;
  const k = Math.cos((l.at[0] * Math.PI) / 180);
  const dx = (Math.sin(b) * l.length) / 2, dy = (Math.cos(b) * l.length) / 2;
  return {
    type: "LineString",
    coordinates: [-1, 1].map((s) => [l.at[1] + (s * dx) / (k * M_PER_DEG), l.at[0] + (s * dy) / M_PER_DEG]),
  };
}

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
