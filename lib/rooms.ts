// Walkable 3D rooms (Design guide update 7, replacing the 2.5D backdrops in C38):
// room sizes, furniture layouts, what each piece of furniture does when tapped,
// and the walking grid. Pure data and math so it can be unit tested; the three.js
// scene lives in components/room. Units are meters; the room is centered on the
// origin, x to the right, z toward the camera. Furniture faces +z at rot 0; each
// quarter turn (three.js rotation.y = rot * 90°) turns it to face +x, -z, then -x.

export type FurnitureKind =
  // home
  | "bed" | "sofa" | "armchair" | "coffeeTable" | "tvStand" | "rug" | "plant" | "floorLamp" | "kitchen"
  | "fridge" | "diningTable" | "chair" | "wardrobe" | "desk" | "bookshelf"
  // club
  | "bar" | "barStool" | "djBooth" | "speaker" | "danceFloor" | "booth"
  // café
  | "cafeCounter" | "cafeTable" | "pastryCase"
  // deli
  | "deliCounter" | "shelf" | "drinksFridge" | "cat";

export type ItemUse =
  | { kind: "action"; actionId: string }
  | { kind: "events" }
  | { kind: "sit" }
  | { kind: "sleep" }
  | { kind: "look" };

export interface RoomItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  /** Quarter turns (0 to 3): faces +z, +x, -z, -x. */
  rot: number;
  color?: string;
  use?: ItemUse;
  /** A short label for the tap target ("Work a shift"). */
  label?: string;
}

export interface RoomTemplate {
  id: string;
  /** Interior size in meters (x, z). */
  w: number;
  d: number;
  wall: string;
  wallAccent: string;
  floor: string;
  floorKind: "wood" | "tile" | "concrete" | "checker";
  /** Club lighting: warm night-time interior with colored stage lights, whatever the hour. */
  dark?: boolean;
  window?: boolean;
  items: RoomItem[];
  /** Where the avatar enters. */
  spawn: [number, number];
  /** People hanging out (positions and facing), drawn as random New Yorkers. */
  npcs?: { x: number; z: number; facing: number; seated?: boolean }[];
}

/** Footprint (x, z) at rot 0, and whether people can walk over it. */
export const FURNITURE: Record<FurnitureKind, { w: number; d: number; walkable?: boolean; label: string; movable?: boolean }> = {
  bed: { w: 1.6, d: 2.1, label: "Bed", movable: true },
  sofa: { w: 2.0, d: 0.9, label: "Sofa", movable: true },
  armchair: { w: 0.9, d: 0.9, label: "Armchair", movable: true },
  coffeeTable: { w: 1.0, d: 0.6, label: "Coffee table", movable: true },
  tvStand: { w: 1.6, d: 0.45, label: "TV", movable: true },
  rug: { w: 2.2, d: 1.6, walkable: true, label: "Rug", movable: true },
  plant: { w: 0.5, d: 0.5, label: "Plant", movable: true },
  floorLamp: { w: 0.4, d: 0.4, label: "Lamp", movable: true },
  kitchen: { w: 2.4, d: 0.65, label: "Kitchen", movable: true },
  fridge: { w: 0.8, d: 0.75, label: "Fridge", movable: true },
  diningTable: { w: 1.2, d: 0.8, label: "Table", movable: true },
  chair: { w: 0.5, d: 0.5, label: "Chair", movable: true },
  wardrobe: { w: 1.2, d: 0.6, label: "Wardrobe", movable: true },
  desk: { w: 1.2, d: 0.6, label: "Desk", movable: true },
  bookshelf: { w: 1.0, d: 0.4, label: "Bookshelf", movable: true },
  bar: { w: 3.2, d: 0.8, label: "Bar" },
  barStool: { w: 0.45, d: 0.45, label: "Stool" },
  djBooth: { w: 1.8, d: 0.9, label: "DJ booth" },
  speaker: { w: 0.7, d: 0.7, label: "Speaker" },
  danceFloor: { w: 3.0, d: 3.0, walkable: true, label: "Dance floor" },
  booth: { w: 2.0, d: 1.0, label: "Booth" },
  cafeCounter: { w: 2.8, d: 0.8, label: "Counter" },
  cafeTable: { w: 0.8, d: 0.8, label: "Table" },
  pastryCase: { w: 1.2, d: 0.6, label: "Pastries" },
  deliCounter: { w: 2.6, d: 0.8, label: "Counter" },
  shelf: { w: 2.0, d: 0.5, label: "Shelf" },
  drinksFridge: { w: 1.4, d: 0.7, label: "Drinks" },
  cat: { w: 0.5, d: 0.3, label: "The cat" },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
const sit = { kind: "sit" } as const;

/** The starter studio and 1-bedroom (scaled wider with sx). */
const studioItems = (sx: number): RoomItem[] => [
  { id: "bed", kind: "bed", x: -1.85 * sx, z: -1.5, rot: 0, color: "#6C8CFF", use: { kind: "sleep" }, label: "Nap" },
  { id: "lamp", kind: "floorLamp", x: -0.8 * sx, z: -2.3, rot: 0 },
  { id: "tv", kind: "tvStand", x: 0.3 * sx, z: -2.3, rot: 0 },
  { id: "plant", kind: "plant", x: 1.75 * sx, z: -2.3, rot: 0 },
  { id: "kitchen", kind: "kitchen", x: 2.35 * sx, z: -0.6, rot: 3 },
  { id: "rug", kind: "rug", x: 0.3 * sx, z: 0.2, rot: 0, color: "#E0457B" },
  { id: "coffee-table", kind: "coffeeTable", x: 0.3 * sx, z: 0.1, rot: 0 },
  { id: "sofa", kind: "sofa", x: 0.3 * sx, z: 1.4, rot: 2, color: "#FF8A3D", use: sit, label: "Sit" },
  { id: "wardrobe", kind: "wardrobe", x: -2.35 * sx, z: 0.9, rot: 1, use: { kind: "look" }, label: "Your look" },
  { id: "armchair", kind: "armchair", x: -1.9 * sx, z: 1.95, rot: 2, color: "#40B589", use: sit, label: "Sit" },
];

const highriseItems: RoomItem[] = [
  { id: "bed", kind: "bed", x: -2.8, z: -1.8, rot: 0, color: "#1F1B26", use: { kind: "sleep" }, label: "Nap" },
  { id: "lamp", kind: "floorLamp", x: -1.6, z: -2.6, rot: 0 },
  { id: "bookshelf", kind: "bookshelf", x: -0.7, z: -2.65, rot: 0 },
  { id: "tv", kind: "tvStand", x: 1.0, z: -2.6, rot: 0 },
  { id: "plant", kind: "plant", x: 2.3, z: -2.6, rot: 0 },
  { id: "kitchen", kind: "kitchen", x: 3.35, z: -0.6, rot: 3 },
  { id: "rug", kind: "rug", x: 1.0, z: 0.1, rot: 0, color: "#C2AE86" },
  { id: "coffee-table", kind: "coffeeTable", x: 1.0, z: 0.0, rot: 0 },
  { id: "sofa", kind: "sofa", x: 1.0, z: 1.3, rot: 2, color: "#ECE6DC", use: sit, label: "Sit" },
  { id: "wardrobe", kind: "wardrobe", x: -3.4, z: 0.6, rot: 1, use: { kind: "look" }, label: "Your look" },
  { id: "dining", kind: "diningTable", x: -1.4, z: 1.6, rot: 0 },
  { id: "chair-1", kind: "chair", x: -2.35, z: 1.6, rot: 1, use: sit, label: "Sit" },
  { id: "chair-2", kind: "chair", x: -0.45, z: 1.6, rot: 3, use: sit, label: "Sit" },
];

export const HOME_TEMPLATES: Record<string, RoomTemplate> = {
  astoria_studio: {
    id: "astoria_studio", w: 5.4, d: 5.2, wall: "#E9D8C4", wallAccent: "#C9B49C", floor: "#A8744A", floorKind: "wood", window: true,
    items: studioItems(1), spawn: [0.6, 2.3],
  },
  jackson_heights_1br: {
    id: "jackson_heights_1br", w: 6.0, d: 5.4, wall: "#D7E4E0", wallAccent: "#A9C2BB", floor: "#8E6242", floorKind: "wood", window: true,
    items: studioItems(1.1), spawn: [0.6, 2.4],
  },
  lic_highrise: {
    id: "lic_highrise", w: 7.4, d: 5.8, wall: "#ECEAF0", wallAccent: "#C9C6D2", floor: "#C9B79C", floorKind: "wood", window: true,
    items: highriseItems, spawn: [2.2, 2.4],
  },
};

export const PLACE_TEMPLATES: Record<"club" | "cafe" | "counter", RoomTemplate> = {
  club: {
    id: "club", w: 8.0, d: 7.0, wall: "#4A2C5E", wallAccent: "#FF2E88", floor: "#2E2440", floorKind: "concrete", dark: true,
    items: [
      { id: "bar", kind: "bar", x: -2.2, z: -2.9, rot: 0, use: { kind: "action", actionId: "visit" }, label: "Get seen" },
      { id: "stool-1", kind: "barStool", x: -3.2, z: -2.1, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -2.2, z: -2.1, rot: 0 },
      { id: "stool-3", kind: "barStool", x: -1.2, z: -2.1, rot: 0 },
      { id: "dj", kind: "djBooth", x: 2.4, z: -2.9, rot: 0 },
      { id: "speaker-1", kind: "speaker", x: 3.65, z: -2.9, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 1.15, z: -2.9, rot: 0 },
      { id: "floor", kind: "danceFloor", x: 1.6, z: 0.2, rot: 0, use: { kind: "events" }, label: "Dance" },
      { id: "booth", kind: "booth", x: -3.4, z: 1.4, rot: 1, color: "#6B2BD9" },
    ],
    spawn: [0, 3.0],
    npcs: [
      { x: 1.0, z: 0.0, facing: 0.6 }, { x: 2.2, z: 0.6, facing: -2.4 }, { x: -2.2, z: -2.1, facing: 3.14, seated: true },
      { x: 2.4, z: -2.2, facing: 0 }, { x: -1.2, z: -2.1, facing: 3.14, seated: true },
    ],
  },
  cafe: {
    id: "cafe", w: 7.0, d: 6.0, wall: "#F4E3C8", wallAccent: "#C27C4E", floor: "#D9C2A0", floorKind: "checker", window: true,
    items: [
      { id: "counter", kind: "cafeCounter", x: -1.4, z: -2.3, rot: 0, use: { kind: "action", actionId: "shift" }, label: "Work a shift" },
      { id: "pastries", kind: "pastryCase", x: 1.0, z: -2.4, rot: 0 },
      { id: "table-1", kind: "cafeTable", x: -1.8, z: 0.8, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Brunch" },
      { id: "table-2", kind: "cafeTable", x: 0.6, z: 0.4, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Brunch" },
      { id: "table-3", kind: "cafeTable", x: 2.4, z: 1.4, rot: 0 },
      { id: "chair-1", kind: "chair", x: -2.6, z: 0.8, rot: 1 },
      { id: "chair-2", kind: "chair", x: 1.4, z: 0.4, rot: 3 },
      { id: "chair-3", kind: "chair", x: 2.4, z: 2.2, rot: 2 },
      { id: "plant-1", kind: "plant", x: 3.0, z: -2.4, rot: 0 },
      { id: "plant-2", kind: "plant", x: -3.0, z: 2.4, rot: 0 },
    ],
    spawn: [0.4, 2.4],
    npcs: [{ x: -1.4, z: -2.85, facing: 0 }, { x: 1.4, z: 0.4, facing: -1.57, seated: true }, { x: 2.4, z: 2.2, facing: 3.14, seated: true }],
  },
  counter: {
    id: "counter", w: 6.0, d: 5.4, wall: "#E8E2D0", wallAccent: "#2E8B63", floor: "#B9B2A4", floorKind: "tile",
    items: [
      { id: "counter", kind: "deliCounter", x: -1.0, z: -2.0, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Chopped cheese" },
      { id: "shelf-1", kind: "shelf", x: 1.6, z: -2.35, rot: 0 },
      { id: "shelf-2", kind: "shelf", x: 1.8, z: 0.6, rot: 3 },
      { id: "fridge", kind: "drinksFridge", x: -2.5, z: 0.4, rot: 1 },
      { id: "cat", kind: "cat", x: -0.2, z: -1.35, rot: 0 },
    ],
    spawn: [0, 2.0],
    npcs: [{ x: -1.0, z: -2.65, facing: 0 }, { x: 0.6, z: 0.9, facing: -2.6 }],
  },
};

// ---------------------------------------------------------------------------
// Layout and geometry helpers
// ---------------------------------------------------------------------------
export interface LayoutEntry { id: string; x: number; z: number; rot: number }

export function footprint(item: Pick<RoomItem, "kind" | "rot">): { w: number; d: number } {
  const f = FURNITURE[item.kind];
  return item.rot % 2 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

/** Keeps an item fully inside the room. */
export function clampItem(t: RoomTemplate, item: RoomItem): RoomItem {
  const { w, d } = footprint(item);
  const x = Math.min(t.w / 2 - w / 2, Math.max(-t.w / 2 + w / 2, item.x));
  const z = Math.min(t.d / 2 - d / 2, Math.max(-t.d / 2 + d / 2, item.z));
  return { ...item, x, z };
}

function overlaps(a: RoomItem, b: RoomItem): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return Math.abs(a.x - b.x) < (fa.w + fb.w) / 2 - 0.02 && Math.abs(a.z - b.z) < (fa.d + fb.d) / 2 - 0.02;
}

/** True when a moved item sits inside the room without overlapping solid furniture. Rugs may sit under things. */
export function placementOk(t: RoomTemplate, items: RoomItem[], moved: RoomItem): boolean {
  const c = clampItem(t, moved);
  if (Math.abs(c.x - moved.x) > 1e-6 || Math.abs(c.z - moved.z) > 1e-6) return false;
  if (FURNITURE[moved.kind].walkable) return true;
  return items.every((o) => o.id === moved.id || FURNITURE[o.kind].walkable || !overlaps(o, moved));
}

/** Applies a saved home layout to a template; unknown ids and bad numbers are ignored. */
export function applyLayout(t: RoomTemplate, raw: unknown): RoomItem[] {
  const entries = Array.isArray(raw) ? (raw as Partial<LayoutEntry>[]) : [];
  const byId = new Map(entries.filter((e) => e && typeof e.id === "string").map((e) => [e.id as string, e]));
  const out: RoomItem[] = [];
  for (const item of t.items) {
    const e = byId.get(item.id);
    let next = item;
    if (e && Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isInteger(e.rot) && FURNITURE[item.kind].movable) {
      next = clampItem(t, { ...item, x: e.x as number, z: e.z as number, rot: (((e.rot as number) % 4) + 4) % 4 });
      if (!placementOk(t, [...out, ...t.items.filter((o) => o.id !== item.id)], next)) next = item;
    }
    out.push(next);
  }
  return out;
}

export function toLayout(items: RoomItem[]): LayoutEntry[] {
  return items.filter((i) => FURNITURE[i.kind].movable).map((i) => ({ id: i.id, x: round(i.x), z: round(i.z), rot: i.rot }));
}

const round = (v: number) => Math.round(v * 100) / 100;
export const GRID = 0.25;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

export const FACING: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Where someone stands to use an item: just in front of it. */
export function useSpot(item: RoomItem): [number, number] {
  const { d } = FURNITURE[item.kind];
  const gap = FURNITURE[item.kind].walkable ? 0 : d / 2 + 0.45;
  const dir = FACING[item.rot % 4];
  return [item.x + dir[0] * gap, item.z + dir[1] * gap];
}

// ---------------------------------------------------------------------------
// Walking: A* on a 0.25 m grid around solid furniture.
// ---------------------------------------------------------------------------
const BODY_RADIUS = 0.22;

export function makeGrid(t: RoomTemplate, items: RoomItem[]) {
  const cols = Math.floor(t.w / GRID);
  const rows = Math.floor(t.d / GRID);
  const toX = (c: number) => -t.w / 2 + (c + 0.5) * GRID;
  const toZ = (r: number) => -t.d / 2 + (r + 0.5) * GRID;
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = toX(c);
      const z = toZ(r);
      const edge = Math.abs(x) > t.w / 2 - BODY_RADIUS || Math.abs(z) > t.d / 2 - BODY_RADIUS;
      const hit = items.some((i) => {
        if (FURNITURE[i.kind].walkable) return false;
        const f = footprint(i);
        return Math.abs(x - i.x) < f.w / 2 + BODY_RADIUS && Math.abs(z - i.z) < f.d / 2 + BODY_RADIUS;
      });
      blocked[r * cols + c] = edge || hit ? 1 : 0;
    }
  }
  const cellOf = (x: number, z: number) => [
    Math.min(cols - 1, Math.max(0, Math.floor((x + t.w / 2) / GRID))),
    Math.min(rows - 1, Math.max(0, Math.floor((z + t.d / 2) / GRID))),
  ];
  return { cols, rows, blocked, toX, toZ, cellOf };
}

/** Nearest walkable point to (x, z). */
export function nearestFree(grid: ReturnType<typeof makeGrid>, x: number, z: number): [number, number] | null {
  const [c0, r0] = grid.cellOf(x, z);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.blocked[r * grid.cols + c]) continue;
      const d = (c - c0) ** 2 + (r - r0) ** 2;
      if (d < bestD) { bestD = d; best = [grid.toX(c), grid.toZ(r)]; }
    }
  }
  return best;
}

/** Path of points from start to goal (both snapped to free cells), or [] when unreachable. */
export function findPath(grid: ReturnType<typeof makeGrid>, from: [number, number], to: [number, number]): [number, number][] {
  const start = nearestFree(grid, ...from);
  const goal = nearestFree(grid, ...to);
  if (!start || !goal) return [];
  const [sc, sr] = grid.cellOf(...start);
  const [gc, gr] = grid.cellOf(...goal);
  const { cols, rows, blocked } = grid;
  const idx = (c: number, r: number) => r * cols + c;
  const g = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const open = new Set<number>([idx(sc, sr)]);
  const h = (c: number, r: number) => Math.hypot(c - gc, r - gr);
  const f = new Map<number, number>([[idx(sc, sr), h(sc, sr)]]);
  g[idx(sc, sr)] = 0;
  while (open.size) {
    let cur = -1;
    let bestF = Infinity;
    for (const n of open) { const v = f.get(n) ?? Infinity; if (v < bestF) { bestF = v; cur = n; } }
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    if (cc === gc && cr === gr) break;
    open.delete(cur);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || blocked[idx(nc, nr)]) continue;
      if (dc && dr && (blocked[idx(cc + dc, cr)] || blocked[idx(cc, cr + dr)])) continue; // no corner cutting
      const ng = g[cur] + (dc && dr ? Math.SQRT2 : 1);
      const ni = idx(nc, nr);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        f.set(ni, ng + h(nc, nr));
        open.add(ni);
      }
    }
  }
  if (came[idx(gc, gr)] === -1 && idx(gc, gr) !== idx(sc, sr)) return [];
  const cells: number[] = [];
  for (let n = idx(gc, gr); n !== -1; n = came[n]) cells.push(n);
  cells.reverse();
  // Drop points on straight runs so the walk looks natural.
  const pts = cells.map((n) => [grid.toX(n % cols), grid.toZ(Math.floor(n / cols))] as [number, number]);
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1];
    const b = pts[i + 1];
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
  });
}
