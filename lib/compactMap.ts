// The compact map (owner, Oct 29): New York in miniature, every place on its own city block of a street grid, the
// boroughs as islands around Queens (locked ones under fog until their gate opens, lib/boroughGates.ts). The map is
// only a picture: travel, prices and train lines keep using each place's real lat/lng (lib/travel.ts, travel()).
// Grid cells are (x east, y south); the renderer is components/map/CompactMap.tsx. Pure data, safe to import anywhere.

import type { LatLng } from "./map/geo.ts";
import type { BoroughId } from "./map/boroughs.ts";
import type { LandmarkKind } from "./map/landmarks.ts";

/** Grid size in blocks, and a block's size (street to street) in meters. */
export const COMPACT_GRID = { cols: 18, rows: 20, cell: 60 } as const;

export interface GridRect { x0: number; y0: number; x1: number; y1: number }

/** The boroughs as islands, in grid cells (inclusive). Queens is the open middle. */
export const ISLANDS: Record<BoroughId, GridRect> = {
  queens: { x0: 6, y0: 3, x1: 16, y1: 13 },
  brooklyn: { x0: 5, y0: 14, x1: 13, y1: 16 },
  manhattan: { x0: 0, y0: 1, x1: 3, y1: 16 },
  bronx: { x0: 6, y0: 0, x1: 15, y1: 1 },
  staten_island: { x0: 0, y0: 18, x1: 3, y1: 19 },
};

/** Neighborhoods: each has its own ground color. */
export const DISTRICTS: { id: string; name: string; borough: BoroughId; color: string; rect: GridRect }[] = [
  { id: "ditmars", name: "Astoria Park & Ditmars", borough: "queens", color: "#BFE3A6", rect: { x0: 6, y0: 3, x1: 11, y1: 5 } },
  { id: "astoria", name: "Astoria", borough: "queens", color: "#F6D3A4", rect: { x0: 6, y0: 6, x1: 12, y1: 10 } },
  { id: "lic", name: "Long Island City", borough: "queens", color: "#A9D9E0", rect: { x0: 6, y0: 11, x1: 10, y1: 12 } },
  { id: "meadows", name: "Flushing Meadows", borough: "queens", color: "#C7E89E", rect: { x0: 13, y0: 3, x1: 16, y1: 6 } },
  { id: "flushing", name: "Downtown Flushing", borough: "queens", color: "#F7E29A", rect: { x0: 13, y0: 7, x1: 16, y1: 9 } },
  { id: "jackson-heights", name: "Jackson Heights", borough: "queens", color: "#F1C3DC", rect: { x0: 11, y0: 11, x1: 13, y1: 12 } },
  { id: "jamaica", name: "Jamaica", borough: "queens", color: "#E3C6A4", rect: { x0: 14, y0: 11, x1: 16, y1: 13 } },
  { id: "brooklyn", name: "Brooklyn", borough: "brooklyn", color: "#D6C3F0", rect: { x0: 5, y0: 14, x1: 13, y1: 16 } },
];

/** Every place's block (owner, Oct 29 plan). tests/compactMap.test.ts checks every place has one, and only one. */
export const SPOTS: Record<string, readonly [number, number]> = {
  // Astoria Park & Ditmars
  "hell-gate-park": [7, 3], "ditmars-heights-rooftop": [9, 3], "feta-compli": [10, 4], "ditmars-deli": [8, 4],
  "ditmars-library": [6, 4], "ditmars-walkup": [7, 5],
  // Astoria: Steinway St and 31st St, the elevated train between rows 6 and 7
  "grind-and-gossip": [7, 6], "harmony-chapel": [9, 6], "schlep-and-schmear": [11, 6], "radiant-harbor": [6, 7],
  "still-a-dollar-slice": [7, 7], "astoria-blvd-station": [8, 7], "campaign-hq": [12, 7], "neon-spoon": [6, 8],
  "white-sauce-cart": [8, 8], "boiled-and-beloved": [9, 8], "steinway-fresh": [10, 8], "triborough-works": [12, 8],
  "precinct-114-half": [8, 9], "real-clout-fm": [9, 9], "low-light-lounge": [6, 9], "st-copays": [11, 9],
  "engine-7": [7, 10], "rockaway-diner": [9, 10], "clout-tower": [10, 10],
  // Long Island City waterfront
  "gantry-plaza": [6, 11], "velvet-static": [8, 11], "hunters-pier": [6, 12], "skyline-pier": [7, 12],
  "court-square-courthouse": [9, 12],
  // Flushing Meadows and downtown Flushing
  "flushing-meadows": [13, 4], "unisphere": [14, 4], "meteor-park": [16, 3],
  "downstairs-on-main": [14, 7], "lucky-star": [15, 8], "queensborough-u": [16, 7],
  // Jackson Heights and Jamaica
  "lucky-seven-deli": [12, 11], "st-johnsons": [15, 12], "queens-housing-court": [14, 13],
  // Brooklyn: Greenpoint, Williamsburg, East Williamsburg, Bushwick
  "fifs-furniture": [5, 14], "two-bros-pizza": [6, 14], "altitude-718": [8, 14], "up-on-thirty": [9, 14],
  "ultraviolet-society": [10, 14], "hellgate-hall": [11, 14], "boulevard-motors": [5, 15], "astoria-cc": [6, 15],
  "brownstone-sessions": [8, 15], "thread-count": [9, 15], "skybridge-tower": [10, 15], "the-sticky-floor": [11, 15],
  "discount-disco": [12, 15], "reel-queens": [5, 16], "pedal-pushers": [7, 16], "respawn-arena": [8, 16],
  "rep-count": [9, 16], "pressed-iron-gym": [11, 16],
};

/** The jokes that aren't places (owner, Oct 29): a bronze Pizza Rat, the empty condo lot, the Mayor's billboard. */
export const DECOR: { id: string; kind: "rat-statue" | "condo-lot" | "billboard"; at: readonly [number, number] }[] = [
  { id: "pizza-rat", kind: "rat-statue", at: [8, 10] },
  { id: "condo-lot", kind: "condo-lot", at: [9, 11] },
  { id: "papa-dani-billboard", kind: "billboard", at: [15, 6] },
];

/** Bridges and the ferry: closed (barriers up) until the borough they reach opens. Ends are grid points. */
export const CROSSINGS: { id: string; name: string; to: BoroughId; from: readonly [number, number]; until: readonly [number, number]; ferry?: boolean }[] = [
  { id: "queensboro", name: "Queensboro Bridge", to: "manhattan", from: [4, 11.5], until: [6, 11.5] },
  { id: "williamsburg", name: "Williamsburg Bridge", to: "brooklyn", from: [4, 15.5], until: [5, 15.5] },
  { id: "rfk", name: "RFK Bridge", to: "bronx", from: [7.5, 2], until: [7.5, 3] },
  { id: "ferry", name: "Staten Island Ferry", to: "staten_island", from: [1.5, 17], until: [1.5, 18], ferry: true },
];

/** The elevated N/W along 31st St: the street between rows 6 and 7, from x 6 to 13. */
export const ELEVATED = { y: 7, x0: 6, x1: 13 } as const;

/** Street names on the grid (vertical streets run north-south between columns, avenues east-west between rows). */
export const STREET_NAMES: { name: string; dir: "ns" | "ew"; at: number; from: number }[] = [
  { name: "Ditmars Blvd", dir: "ew", at: 4, from: 6 },
  { name: "31st St · the el", dir: "ew", at: 7, from: 9 },
  { name: "Broadway", dir: "ew", at: 9, from: 6 },
  { name: "Steinway St", dir: "ns", at: 11, from: 6 },
  { name: "Main St", dir: "ns", at: 15, from: 7 },
  { name: "Bedford Ave", dir: "ns", at: 9, from: 14 },
];

/** Locked islands' cards: where each sits (grid point) and Lola's one-liner (lib/map/boroughs.ts has the teasers). */
export const ISLAND_CARD_AT: Record<Exclude<BoroughId, "queens">, readonly [number, number]> = {
  brooklyn: [9.5, 15.5], manhattan: [2, 8.5], bronx: [11, 1], staten_island: [2, 19],
};

/**
 * The model a place without its own landmark borrows until it gets one (owner, Oct 29: the game's building style).
 * Carts have their own small model in the renderer.
 */
export const BORROWED_KIND: Record<string, LandmarkKind | "cart" | "store"> = {
  "ditmars-heights-rooftop": "rooftop", "downstairs-on-main": "store", "ditmars-walkup": "brownstone",
  "queens-housing-court": "college", "court-square-courthouse": "precinct", "still-a-dollar-slice": "store",
  "white-sauce-cart": "cart", "boiled-and-beloved": "cart", "feta-compli": "store", "schlep-and-schmear": "store",
  "campaign-hq": "store",
};

/** The storefronts: a corner store with the place's own sign and colors, and its rooftop joke. */
export const STOREFRONTS: Record<string, { name: string; awning: string; wall: string; roof?: "slice" | "bagel" | "olive" | "balloons" | "dumpling" }> = {
  "still-a-dollar-slice": { name: "STILL $1 SLICE", awning: "#D93A2B", wall: "#C8553D", roof: "slice" },
  "schlep-and-schmear": { name: "SCHLEP & SCHMEAR", awning: "#1F6F4A", wall: "#A86B4C", roof: "bagel" },
  "feta-compli": { name: "FETA COMPLI", awning: "#2C5FA8", wall: "#F1EEE6", roof: "olive" },
  "campaign-hq": { name: "CAMPAIGN HQ · VOTE", awning: "#C62C3B", wall: "#3B5BA9", roof: "balloons" },
  "downstairs-on-main": { name: "FOOD COURT ↓", awning: "#E0A21B", wall: "#9C4A3A", roof: "dumpling" },
};

/** A grid point's center in meters (x east, z south) from the map's top-left corner. */
export function gridToWorld([x, y]: readonly [number, number]): [number, number] {
  const c = COMPACT_GRID.cell;
  return [(x + 0.5) * c, (y + 0.5) * c];
}

export const WORLD_SIZE = { w: COMPACT_GRID.cols * COMPACT_GRID.cell, h: COMPACT_GRID.rows * COMPACT_GRID.cell } as const;

/** Whether a grid cell is land (on an island) and which borough. */
export function islandAt(x: number, y: number): BoroughId | null {
  for (const [id, r] of Object.entries(ISLANDS) as [BoroughId, GridRect][]) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return id;
  }
  return null;
}

export function districtAt(x: number, y: number) {
  return DISTRICTS.find((d) => x >= d.rect.x0 && x <= d.rect.x1 && y >= d.rect.y0 && y <= d.rect.y1) ?? null;
}

/**
 * Any real lat/lng (a place, a home, a trip's end) on the compact map: a place's own block exactly, anywhere else
 * a blend of the nearest places' blocks (weighted by 1/distance²), so homes and in-between points land among their
 * real neighbors.
 */
export function makeProjector(anchors: readonly { at: LatLng; spot: readonly [number, number] }[]) {
  return (at: LatLng): [number, number] => {
    const k = Math.cos((at[0] * Math.PI) / 180);
    const near = anchors
      .map((a) => ({ a, d2: ((a.at[0] - at[0]) ** 2 + ((a.at[1] - at[1]) * k) ** 2) * 1e8 }))
      .sort((p, q) => p.d2 - q.d2)
      .slice(0, 4);
    if (!near.length) return gridToWorld([9, 9]);
    if (near[0].d2 < 1e-3) return gridToWorld(near[0].a.spot);
    let wx = 0, wz = 0, sum = 0;
    for (const n of near) {
      const w = 1 / n.d2;
      const [x, z] = gridToWorld(n.a.spot);
      wx += x * w; wz += z * w; sum += w;
    }
    return [wx / sum, wz / sum];
  };
}

// ---------------------------------------------------------------------------
// Which places get a name (owner, Oct 29: "name for only the most relevant locations, small dots for most buildings,
// and taps that reveal building details")
// ---------------------------------------------------------------------------
/** The city's landmarks: named whenever there's room, after what matters to the player right now. */
export const FEATURED: readonly string[] = [
  "campaign-hq", "clout-tower", "hell-gate-park", "unisphere", "meteor-park", "astoria-blvd-station", "velvet-static",
  "grind-and-gossip", "still-a-dollar-slice", "st-johnsons", "lucky-star", "gantry-plaza", "queensborough-u",
];

/** How much a place deserves its name on screen: the selected one, the mission's, where you are, then landmarks. */
export function labelPriority(id: string, o: { selected?: string | null; glow?: boolean; here?: string | null }): number {
  if (id === o.selected) return 100;
  if (o.glow) return 90;
  if (id === o.here) return 80;
  const f = FEATURED.indexOf(id);
  return f >= 0 ? 50 - f : 0;
}

/**
 * Names that fit: highest priority first, never overlapping another name, at most `max` (plus any priority 80 and up).
 * Boxes are screen rectangles centered on x, sitting above y.
 */
export function pickLabels<T extends { id: string; x: number; y: number; w: number; priority: number }>(items: readonly T[], max: number, h = 30): Set<string> {
  const out = new Set<string>();
  const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const it of [...items].sort((a, b) => b.priority - a.priority)) {
    if (it.priority <= 0) break;
    if (out.size >= max && it.priority < 80) break;
    const r = { x0: it.x - it.w / 2 - 4, x1: it.x + it.w / 2 + 4, y0: it.y - h, y1: it.y + 2 };
    if (taken.some((t) => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0)) continue;
    taken.push(r);
    out.add(it.id);
  }
  return out;
}
