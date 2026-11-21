// Build mode (migration 0169, owner Nov 20: "Can we build out the building time sink. Move walls, add rooms, landscapes";
// "Renters can move walls"; contractors are "Instant"). A player's plan for their home: the rooms on each floor (walls and
// doorways follow the rooms), the wall paint and an Outside floor with garden zones and pieces. Pure: the editor
// (components/home/BuildMode.tsx), the room view (GameShell) and the server (app/home/buildActions.ts, which prices a
// plan with planCost and charges it through home_build_save) all use it. Safe to import anywhere.

import { FURNITURE, HOME_FLOORS, freeSpot, hitsWall, homeTemplate, type FurnitureKind, type RoomItem, type RoomTemplate } from "./rooms.ts";

/** Mirrors game_settings 'home_build' (tests/homeBuild.test.ts checks it against the migration). */
export const HOME_BUILD = {
  /** C$ per metre of new wall, and per metre taken down. */
  wallPerMetre: 40,
  demolishPerMetre: 10,
  /** C$ per square metre of a new or changed floor (indoors) and of a new or changed garden zone. */
  floorPerSqm: 12,
  zonePerSqm: 8,
  /** Repainting the whole home. */
  paint: 150,
  /** Limits a plan must keep (also checked by the server). */
  maxRooms: 10,
  maxPieces: 40,
  /** The smallest room or zone, in metres. */
  minSide: 1.5,
} as const;

/** The grid rooms snap to, and a doorway's width. */
export const PLAN_GRID = 0.5;
export const DOOR_W = 1.0;

export type Side = "n" | "s" | "e" | "w";
/** A doorway on one side of a room: `at` is its middle, in metres from the side's start (west or north end). */
export interface PlanDoor { side: Side; at: number; w?: number }
export interface PlanRoom {
  id: string;
  name: string;
  x0: number; z0: number; x1: number; z1: number;
  /** A finish from FINISHES, or the template's own floor (`orig`) for a room nobody has refinished. */
  floor: string;
  orig?: { floor: string; kind: RoomTemplate["floorKind"] };
  doors: PlanDoor[];
}
export interface PlanPiece { id: string; k: GardenKind; x: number; z: number; rot: number }
export interface FloorPlan { rooms: PlanRoom[]; pieces?: PlanPiece[] }
/** Stored in players.home_plan. `home` is the home it was built for: another home ignores it. */
export interface HomePlan { v: 1; home: string; paint?: string; floors: Record<string, FloorPlan> }

/** The Outside floor's key in `floors` and its floor number in the room view. */
export const OUTSIDE = "out";
export const OUTSIDE_FLOOR = 0;

export const PAINTS: { id: string; name: string; wall: string; accent: string }[] = [
  { id: "linen", name: "Linen", wall: "#EFE8DC", accent: "#C9BBA5" },
  { id: "cloud", name: "Cloud white", wall: "#F7F8FC", accent: "#C7CCD8" },
  { id: "blush", name: "Blush", wall: "#F2DDE0", accent: "#D4A9B0" },
  { id: "sage", name: "Sage", wall: "#DCE6DA", accent: "#A9BFA6" },
  { id: "sky", name: "Sky", wall: "#DCE8F2", accent: "#A6BCD2" },
  { id: "butter", name: "Butter", wall: "#F5ECCB", accent: "#D6C58E" },
  { id: "lavender", name: "Lavender", wall: "#E6E0F2", accent: "#B8ACD6" },
  { id: "terracotta", name: "Terracotta", wall: "#EBCDBE", accent: "#C08F77" },
  { id: "mint", name: "Mint", wall: "#D9F0E8", accent: "#9CC9B8" },
];

export interface Finish { id: string; name: string; floor: string; kind: RoomTemplate["floorKind"]; outside?: boolean }
export const FINISHES: Finish[] = [
  { id: "oak", name: "Oak", floor: "#B98A5A", kind: "wood" },
  { id: "walnut", name: "Walnut", floor: "#7A5236", kind: "wood" },
  { id: "honey", name: "Honey pine", floor: "#C99A62", kind: "wood" },
  { id: "ash", name: "Pale ash", floor: "#D8C3A0", kind: "wood" },
  { id: "tile", name: "White tile", floor: "#FFFFFF", kind: "tile" },
  { id: "concrete", name: "Polished concrete", floor: "#C4C0BA", kind: "concrete" },
  { id: "carpet-cream", name: "Cream carpet", floor: "#ECE3D3", kind: "concrete" },
  { id: "carpet-blush", name: "Blush carpet", floor: "#EBCACA", kind: "concrete" },
  { id: "carpet-sage", name: "Sage carpet", floor: "#BFD0BA", kind: "concrete" },
  { id: "carpet-navy", name: "Navy carpet", floor: "#5D6B8C", kind: "concrete" },
  // Outside: the garden's zones.
  { id: "pavers", name: "Stone pavers", floor: "#D9D2C3", kind: "tile", outside: true },
  { id: "deck", name: "Wood deck", floor: "#A87B52", kind: "wood", outside: true },
  { id: "gravel", name: "Gravel", floor: "#CFC8BA", kind: "concrete", outside: true },
  { id: "meadow", name: "Wildflower bed", floor: "#8DBF6A", kind: "concrete", outside: true },
  { id: "sand", name: "Sand", floor: "#EAD9B0", kind: "concrete", outside: true },
  { id: "pool", name: "Pool", floor: "#5EC4E0", kind: "tile", outside: true },
];
export const finishOf = (id: string) => FINISHES.find((f) => f.id === id);

export const ROOM_NAMES = ["Living room", "Bedroom", "Kitchen", "Bathroom", "Dining room", "Office", "Closet", "Studio", "Game room", "Gym", "Library", "Nursery"];
export const ZONE_NAMES = ["Patio", "Path", "Deck", "Flower bed", "Pool", "Sandbox"];

export type GardenKind = "tree" | "hedge" | "picketFence" | "flowerBed" | "planter" | "bench" | "patioUmbrella" | "grill" | "sunLounger" | "lamppost" | "heatLamp" | "fountain" | "hotTub";
export const GARDEN: { k: GardenKind; name: string; emoji: string; price: number }[] = [
  { k: "flowerBed", name: "Flower bed", emoji: "🌷", price: 50 },
  { k: "hedge", name: "Hedge", emoji: "🌿", price: 60 },
  { k: "picketFence", name: "Picket fence", emoji: "🪵", price: 40 },
  { k: "tree", name: "Tree", emoji: "🌳", price: 120 },
  { k: "planter", name: "Planter", emoji: "🪴", price: 45 },
  { k: "bench", name: "Bench", emoji: "🪑", price: 80 },
  { k: "sunLounger", name: "Sun lounger", emoji: "🏖️", price: 90 },
  { k: "patioUmbrella", name: "Patio table", emoji: "⛱️", price: 150 },
  { k: "grill", name: "Grill", emoji: "🍖", price: 180 },
  { k: "lamppost", name: "Garden lamp", emoji: "🏮", price: 100 },
  { k: "heatLamp", name: "Heat lamp", emoji: "🔥", price: 120 },
  { k: "fountain", name: "Fountain", emoji: "⛲", price: 900 },
  { k: "hotTub", name: "Hot tub", emoji: "🛁", price: 2500 },
];
export const gardenOf = (k: string) => GARDEN.find((g) => g.k === k);

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
const EPS = 1e-6;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Snaps a room edge to the plan grid, or to the outer wall when it's within a quarter metre of it. */
export function snapEdge(v: number, half: number): number {
  if (v >= half - PLAN_GRID / 2) return half;
  if (v <= -half + PLAN_GRID / 2) return -half;
  return Math.round(v / PLAN_GRID) * PLAN_GRID;
}

interface SideLine { side: Side; axis: "x" | "z"; at: number; from: number; to: number }
/** A room's four sides: n and s run along x (at z0 and z1), w and e along z (at x0 and x1). */
export function sidesOf(r: Pick<PlanRoom, "x0" | "z0" | "x1" | "z1">): SideLine[] {
  return [
    { side: "n", axis: "x", at: r.z0, from: r.x0, to: r.x1 },
    { side: "s", axis: "x", at: r.z1, from: r.x0, to: r.x1 },
    { side: "w", axis: "z", at: r.x0, from: r.z0, to: r.z1 },
    { side: "e", axis: "z", at: r.x1, from: r.z0, to: r.z1 },
  ];
}
const onOuter = (s: SideLine, w: number, d: number) => Math.abs(s.at) >= (s.axis === "x" ? d : w) / 2 - EPS;

/** Where a room's doorway sits: clamped to its side, so a resized room keeps a doorway that fits. */
export function doorSpan(r: PlanRoom, door: PlanDoor): [number, number] {
  const s = sidesOf(r).find((x) => x.side === door.side)!;
  const w = Math.min(door.w ?? DOOR_W, s.to - s.from);
  const mid = Math.min(s.to - s.from - w / 2, Math.max(w / 2, door.at));
  return [s.from + mid - w / 2, s.from + mid + w / 2];
}

type Interval = [number, number];
function union(list: Interval[]): Interval[] {
  const s = [...list].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
function subtract(list: Interval[], cut: Interval[]): Interval[] {
  let out = list;
  for (const [c0, c1] of cut) {
    out = out.flatMap(([a, b]): Interval[] => {
      if (c1 <= a + EPS || c0 >= b - EPS) return [[a, b]];
      const parts: Interval[] = [];
      if (c0 > a + EPS) parts.push([a, c0]);
      if (c1 < b - EPS) parts.push([c1, b]);
      return parts;
    });
  }
  return out.filter(([a, b]) => b - a > 0.05);
}

/**
 * The walls between rooms, as the room view draws them ([x0, z0, x1, z1]): every side of every room that isn't on the
 * home's outer wall, merged where rooms meet, with every room's doorways left open.
 */
export function wallsOf(rooms: PlanRoom[], w: number, d: number): [number, number, number, number][] {
  const lines = new Map<string, { axis: "x" | "z"; at: number; spans: Interval[]; doors: Interval[] }>();
  const keyOf = (axis: string, at: number) => `${axis}:${r2(at)}`;
  for (const r of rooms) {
    for (const s of sidesOf(r)) {
      if (onOuter(s, w, d)) continue;
      const k = keyOf(s.axis, s.at);
      const line = lines.get(k) ?? { axis: s.axis, at: s.at, spans: [], doors: [] };
      line.spans.push([s.from, s.to]);
      lines.set(k, line);
    }
  }
  for (const r of rooms) {
    for (const door of r.doors) {
      const s = sidesOf(r).find((x) => x.side === door.side)!;
      lines.get(keyOf(s.axis, s.at))?.doors.push(doorSpan(r, door));
    }
  }
  const out: [number, number, number, number][] = [];
  for (const line of lines.values()) {
    for (const [a, b] of subtract(union(line.spans), line.doors)) {
      out.push(line.axis === "x" ? [r2(a), r2(line.at), r2(b), r2(line.at)] : [r2(line.at), r2(a), r2(line.at), r2(b)]);
    }
  }
  return out;
}

/** The first side of a room that isn't on the outer wall (where a new room's doorway goes), or null for none. */
export function innerSide(r: PlanRoom, w: number, d: number): Side | null {
  return sidesOf(r).find((s) => !onOuter(s, w, d))?.side ?? null;
}

/** A room's area in square metres. */
export const areaOf = (r: Pick<PlanRoom, "x0" | "z0" | "x1" | "z1">) => (r.x1 - r.x0) * (r.z1 - r.z0);

const overlap = (a: PlanRoom, b: PlanRoom) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;

// ---------------------------------------------------------------------------
// From a template, and back onto one
// ---------------------------------------------------------------------------
/** A floor's plan as the home comes: its rooms, with doorways where its walls leave gaps. */
export function planFromTemplate(t: RoomTemplate): FloorPlan {
  const walls = t.walls ?? [];
  const rooms: PlanRoom[] = (t.rooms ?? []).map((rm, i) => {
    const r: PlanRoom = { id: `r${i + 1}`, name: rm.name, x0: rm.x0, z0: rm.z0, x1: rm.x1, z1: rm.z1, floor: "orig", orig: { floor: rm.floor, kind: rm.floorKind }, doors: [] };
    for (const s of sidesOf(r)) {
      if (onOuter(s, t.w, t.d)) continue;
      // The template's walls on this side's line, and the gaps they leave along this side.
      const spans = walls.filter(([x0, z0, x1, z1]) => (s.axis === "x" ? Math.abs(z0 - s.at) < EPS && Math.abs(z1 - s.at) < EPS : Math.abs(x0 - s.at) < EPS && Math.abs(x1 - s.at) < EPS))
        .map(([x0, z0, x1, z1]): Interval => (s.axis === "x" ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(z0, z1), Math.max(z0, z1)]));
      for (const [a, b] of subtract([[s.from, s.to]], union(spans))) r.doors.push({ side: s.side, at: r2((a + b) / 2 - s.from), w: r2(b - a) });
    }
    return r;
  });
  return { rooms };
}

/** A plan for this home, or null when it was built for another one (or never). */
export function planFor(raw: unknown, homeKey: string): HomePlan | null {
  const p = raw as HomePlan | null;
  return p && p.v === 1 && p.home === homeKey && p.floors && typeof p.floors === "object" ? p : null;
}

/** The key a plan is stored under: the bought house, else the rented home. */
export const homeKeyOf = (homeId: string | null | undefined, houseSku?: string | null) => houseSku || homeId || "astoria_studio";

function hashOf(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * A floor of the home as built: the plan's rooms, walls and paint on the template, and the garden's pieces Outside.
 * The template's own pieces that a new wall now runs through move to the nearest free spot. Without a plan for this
 * floor, the template comes back as it is (bar the paint).
 */
const builtCache = new Map<string, RoomTemplate>();
export function builtTemplate(t: RoomTemplate, plan: HomePlan | null, floorKey: string): RoomTemplate {
  if (!plan) return t;
  // The room view asks on every render: the same plan on the same floor gives back the same template.
  const key = `${t.id}|${floorKey}|${JSON.stringify(plan)}`;
  const hit = builtCache.get(key);
  if (hit) return hit;
  const out = buildTemplate(t, plan, floorKey);
  if (builtCache.size > 12) builtCache.delete(builtCache.keys().next().value!);
  builtCache.set(key, out);
  return out;
}
function buildTemplate(t: RoomTemplate, plan: HomePlan, floorKey: string): RoomTemplate {
  const paint = PAINTS.find((p) => p.id === plan.paint);
  const fp = plan.floors[floorKey];
  if (!fp && !paint) return t;
  const id = `${t.id}~${hashOf(JSON.stringify([plan.paint ?? "", fp ?? null]))}`;
  const out: RoomTemplate = { ...t, id, ...(paint && !t.outdoor ? { wall: paint.wall, wallAccent: paint.accent } : {}) };
  if (!fp) return out;
  out.rooms = fp.rooms.map((r) => {
    const f = finishOf(r.floor);
    return { name: r.name, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, floor: f?.floor ?? r.orig?.floor ?? t.floor, floorKind: f?.kind ?? r.orig?.kind ?? t.floorKind };
  });
  out.walls = t.outdoor ? [] : wallsOf(fp.rooms, t.w, t.d);
  const pieces: RoomItem[] = (fp.pieces ?? []).filter((p) => gardenOf(p.k)).map((p) => ({ id: `plan-${p.id}`, kind: p.k as FurnitureKind, x: p.x, z: p.z, rot: p.rot, name: gardenOf(p.k)!.name }));
  const kept: RoomItem[] = [];
  for (const it of t.items) {
    const f = FURNITURE[it.kind];
    const fw = it.rot % 2 ? f.d : f.w, fd = it.rot % 2 ? f.w : f.d;
    if (!hitsWall(out, it.x, it.z, fw / 2 - 0.02, fd / 2 - 0.02)) { kept.push(it); continue; }
    kept.push(freeSpot(out, [...kept, ...pieces], it) ?? it);
  }
  out.items = [...kept, ...pieces];
  return out;
}

/** The Outside floor: a lawn behind the home, bigger for a house than a rental. */
export function yardTemplate(homeKey: string, owned: boolean): RoomTemplate {
  const [w, d] = owned ? [12, 9] : homeKey === "astoria_share" || homeKey.endsWith("_dorm") ? [7, 5] : [9, 7];
  return {
    id: `yard:${homeKey}`, w, d, wall: "#F2EEE6", wallAccent: "#C9BBA5", floor: "#4C9A3F", floorKind: "concrete",
    outdoor: { height: 3, edge: "#3E7F33", view: [w, d] },
    items: [], spawn: [0, d / 2 - 1],
  };
}

/** Every floor of a home a plan can change, by key: "1", any upstairs ("2"), and Outside. */
export function homeFloorsFor(homeId: string | null | undefined, houseSku?: string | null): Record<string, RoomTemplate> {
  const base = homeTemplate(homeId, houseSku);
  const out: Record<string, RoomTemplate> = { "1": base };
  for (const [n, t] of Object.entries(HOME_FLOORS[base.id] ?? {})) out[n] = t;
  out[OUTSIDE] = yardTemplate(homeKeyOf(homeId, houseSku), !!houseSku);
  return out;
}

// ---------------------------------------------------------------------------
// Checks and the price
// ---------------------------------------------------------------------------
/** What's wrong with a floor's plan (empty when it's fine): rooms inside the home, big enough, not overlapping, named. */
export function floorProblems(t: RoomTemplate, fp: FloorPlan): string[] {
  const out: string[] = [];
  const outside = !!t.outdoor;
  if (!Array.isArray(fp.rooms) || fp.rooms.length > HOME_BUILD.maxRooms) return [`At most ${HOME_BUILD.maxRooms} ${outside ? "zones" : "rooms"}.`];
  const ids = new Set<string>();
  for (const r of fp.rooms) {
    if (typeof r.id !== "string" || r.id.length > 12 || ids.has(r.id)) { out.push("bad room id"); continue; }
    ids.add(r.id);
    if (typeof r.name !== "string" || !(outside ? ZONE_NAMES : ROOM_NAMES).includes(r.name) && !(t.rooms ?? []).some((o) => o.name === r.name)) out.push(`${r.id}: name`);
    for (const v of [r.x0, r.z0, r.x1, r.z1]) if (!Number.isFinite(v)) out.push(`${r.id}: size`);
    if (r.x0 < -t.w / 2 - EPS || r.x1 > t.w / 2 + EPS || r.z0 < -t.d / 2 - EPS || r.z1 > t.d / 2 + EPS) out.push(`${r.id}: outside the home`);
    if (r.x1 - r.x0 < HOME_BUILD.minSide - EPS || r.z1 - r.z0 < HOME_BUILD.minSide - EPS) out.push(`${r.id}: too small`);
    const f = finishOf(r.floor);
    if (r.floor === "orig" ? !r.orig : !f || !!f.outside !== outside) out.push(`${r.id}: floor`);
    if (!Array.isArray(r.doors) || r.doors.length > 8 || r.doors.some((d) => !["n", "s", "e", "w"].includes(d.side) || !Number.isFinite(d.at) || (d.w !== undefined && !(d.w >= 0.05 && d.w <= 30)))) out.push(`${r.id}: doors`);
  }
  for (let i = 0; i < fp.rooms.length; i++) for (let j = i + 1; j < fp.rooms.length; j++) {
    if (overlap(fp.rooms[i], fp.rooms[j])) out.push(`${fp.rooms[i].id} overlaps ${fp.rooms[j].id}`);
  }
  const pieces = fp.pieces ?? [];
  if (pieces.length && !outside) out.push("garden pieces go outside");
  if (pieces.length > HOME_BUILD.maxPieces) out.push(`At most ${HOME_BUILD.maxPieces} pieces.`);
  for (const p of pieces) {
    if (!gardenOf(p.k) || ![0, 1, 2, 3].includes(p.rot) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) { out.push("bad piece"); continue; }
    const f = FURNITURE[p.k];
    const hw = (p.rot % 2 ? f.d : f.w) / 2, hd = (p.rot % 2 ? f.w : f.d) / 2;
    if (Math.abs(p.x) + hw > t.w / 2 + EPS || Math.abs(p.z) + hd > t.d / 2 + EPS) out.push(`${p.id}: outside the yard`);
  }
  return out;
}

/** What's wrong with a whole plan for a home, given its floors' templates by key. */
export function planProblems(plan: HomePlan, homeKey: string, floors: Record<string, RoomTemplate>): string[] {
  if (!plan || plan.v !== 1 || plan.home !== homeKey || typeof plan.floors !== "object") return ["bad plan"];
  if (plan.paint !== undefined && !PAINTS.some((p) => p.id === plan.paint)) return ["bad paint"];
  const out: string[] = [];
  for (const [key, fp] of Object.entries(plan.floors)) {
    const t = floors[key];
    if (!t) { out.push(`no floor ${key}`); continue; }
    out.push(...floorProblems(t, fp));
  }
  return out;
}

export interface BuildCost { total: number; lines: { label: string; amount: number }[] }

/** Wall length on a line set, as unit spans, so new and old walls can be compared metre by metre. */
function wallLength(walls: [number, number, number, number][]): Map<string, Interval[]> {
  const m = new Map<string, Interval[]>();
  for (const [x0, z0, x1, z1] of walls) {
    const alongX = Math.abs(z0 - z1) < EPS;
    const k = alongX ? `x:${r2(z0)}` : `z:${r2(x0)}`;
    m.set(k, [...(m.get(k) ?? []), alongX ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(z0, z1), Math.max(z0, z1)]]);
  }
  return m;
}
const total = (list: Interval[]) => list.reduce((n, [a, b]) => n + (b - a), 0);
/** Metres of wall in `a` that aren't in `b`. */
function wallDiff(a: [number, number, number, number][], b: [number, number, number, number][]): number {
  const A = wallLength(a), B = wallLength(b);
  let n = 0;
  for (const [k, spans] of A) n += total(subtract(union(spans), union(B.get(k) ?? [])));
  return n;
}

const sameRect = (a: PlanRoom, b: PlanRoom) => [a.x0 - b.x0, a.z0 - b.z0, a.x1 - b.x1, a.z1 - b.z1].every((v) => Math.abs(v) < EPS);

/**
 * What a plan costs over the one before it (or the home as it came): new walls by the metre, walls taken down, new or
 * refinished floors by the square metre, the paint and the garden pieces added. Taking things away is never refunded.
 */
export function planCost(prev: HomePlan | null, next: HomePlan, floors: Record<string, RoomTemplate>): BuildCost {
  const lines: BuildCost["lines"] = [];
  let built = 0, down = 0, floorSqm = 0, zoneSqm = 0, pieces = 0;
  for (const [key, t] of Object.entries(floors)) {
    const before = prev?.floors[key] ?? planFromTemplate(t);
    const after = next.floors[key] ?? before;
    if (!t.outdoor) {
      const wa = wallsOf(before.rooms, t.w, t.d), wb = wallsOf(after.rooms, t.w, t.d);
      built += wallDiff(wb, wa);
      down += wallDiff(wa, wb);
    }
    for (const r of after.rooms) {
      const was = before.rooms.find((o) => sameRect(o, r) && o.floor === r.floor);
      if (was || r.floor === "orig") continue;
      if (t.outdoor) zoneSqm += areaOf(r); else floorSqm += areaOf(r);
    }
    const had = new Map<string, number>();
    for (const p of before.pieces ?? []) had.set(p.k, (had.get(p.k) ?? 0) + 1);
    for (const p of after.pieces ?? []) {
      const n = had.get(p.k) ?? 0;
      if (n > 0) had.set(p.k, n - 1);
      else pieces += gardenOf(p.k)?.price ?? 0;
    }
  }
  const add = (label: string, amount: number) => { if (amount > 0) lines.push({ label, amount }); };
  add(`New walls · ${r2(built)} m`, Math.round(built * HOME_BUILD.wallPerMetre));
  add(`Walls taken down · ${r2(down)} m`, Math.round(down * HOME_BUILD.demolishPerMetre));
  add(`Floors · ${Math.round(floorSqm)} m²`, Math.round(floorSqm * HOME_BUILD.floorPerSqm));
  add(`Garden zones · ${Math.round(zoneSqm)} m²`, Math.round(zoneSqm * HOME_BUILD.zonePerSqm));
  add("Paint", (next.paint ?? "") !== (prev?.paint ?? "") && next.paint ? HOME_BUILD.paint : 0);
  add("Garden pieces", pieces);
  return { total: lines.reduce((n, l) => n + l.amount, 0), lines };
}

/** A fresh room for the editor: the biggest free square up to 3 m, searched from the middle out; null when none fits. */
export function newRoom(t: RoomTemplate, fp: FloorPlan, id: string, name: string, floor: string): PlanRoom | null {
  for (const size of [3, 2.5, 2, HOME_BUILD.minSide]) {
    const half = size / 2;
    for (let ring = 0; ring < 30; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const cx = dx * PLAN_GRID, cz = dz * PLAN_GRID;
      const r: PlanRoom = { id, name, x0: snapEdge(cx - half, t.w / 2), z0: snapEdge(cz - half, t.d / 2), x1: snapEdge(cx + half, t.w / 2), z1: snapEdge(cz + half, t.d / 2), floor, doors: [] };
      if (r.x1 - r.x0 < HOME_BUILD.minSide - EPS || r.z1 - r.z0 < HOME_BUILD.minSide - EPS) continue;
      if (r.x0 < -t.w / 2 - EPS || r.x1 > t.w / 2 + EPS || r.z0 < -t.d / 2 - EPS || r.z1 > t.d / 2 + EPS) continue;
      if (fp.rooms.some((o) => overlap(o, r))) continue;
      const side = t.outdoor ? null : innerSide(r, t.w, t.d);
      if (side) r.doors = [{ side, at: (side === "n" || side === "s" ? r.x1 - r.x0 : r.z1 - r.z0) / 2 }];
      return r;
    }
  }
  return null;
}

/** True when a room can take this rectangle: inside the home, big enough and clear of the others. */
export function rectOk(t: RoomTemplate, fp: FloorPlan, r: PlanRoom): boolean {
  return r.x0 >= -t.w / 2 - EPS && r.x1 <= t.w / 2 + EPS && r.z0 >= -t.d / 2 - EPS && r.z1 <= t.d / 2 + EPS
    && r.x1 - r.x0 >= HOME_BUILD.minSide - EPS && r.z1 - r.z0 >= HOME_BUILD.minSide - EPS
    && !fp.rooms.some((o) => o.id !== r.id && overlap(o, r));
}
