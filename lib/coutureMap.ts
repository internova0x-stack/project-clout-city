// Clout Couture on the map (migration 0104): what couture_map() returns and where things go. The yachts moor in rows in
// the East River off the Astoria waterfront (Hell Gate), the jets circle over Queens while their owners play, and the
// week's plaza statue stands in front of the Unisphere. Positions are real lat/lng (lib/map/geo.ts); the models are
// components/map/coutureModels.ts.

import type { LatLng } from "./map/geo.ts";

export const YACHT_SKU = "astoria-yacht";
export const JET_SKU = "clout-one-jet";
export const PLAZA_SKU = "plaza-statue";
export const MANSION_SKU = "waterfront-mansion";
export const MANSION_HOME = "waterfront_mansion";
/** Couture pieces that live on the map rather than on you or in your home. */
export const MAP_SKUS: ReadonlySet<string> = new Set([YACHT_SKU, JET_SKU, PLAZA_SKU, MANSION_SKU]);

export interface MapOwner { player: string; name: string; edition: number | null }
export interface PlazaStatue { player: string; name: string; week: string; look: Record<string, unknown>; style: string; outfit: string[] }
/** A Waterfront Mansion on its plot (1 to 10) of Billionaire's Row (migration 0105). */
export interface MansionOwner { player: string; name: string; plot: number }
export interface CoutureMap {
  mansions?: MansionOwner[];
  /** The player's own plot, if they own the mansion. */
  myPlot?: number | null;
  yachts: MapOwner[];
  jets: MapOwner[];
  statue: PlazaStatue | null;
  /** The player's own booked week (a Monday), if any. */
  myPlazaWeek: string | null;
  /** Client only: how far the marina moved out into the river to be on the map's water (fitMarina). */
  marinaShift?: number;
}
export const EMPTY_COUTURE_MAP: CoutureMap = { yachts: [], jets: [], statue: null, myPlazaWeek: null };

/** The plaza booking: the next twelve weeks and whether the player has a statue to book. */
export interface PlazaWeeks { canBook: boolean; mine: string | null; weeks: { week: string; taken: boolean }[] }

export type CoutureResult<T> = { ok: true; data: T } | { ok: false; error: string };
/** What the game asks the server (app/home/coutureActions.ts; previews: app/preview/coutureActions.ts). */
export interface CoutureApi {
  map(): Promise<CoutureResult<CoutureMap>>;
  weeks(): Promise<CoutureResult<PlazaWeeks>>;
  book(week: string): Promise<CoutureResult<PlazaWeeks>>;
}

const ERRORS: Record<string, string> = {
  no_statue: "That's for statue owners. The Shop has the Plaza Statue.",
  already_booked: "Your statue already has its week.",
  bad_week: "Pick one of the weeks on the list.",
  week_taken: "Someone just took that week. Pick another.",
};
export function coutureError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "That didn't work. Try again in a second.";
}

/** The marina: the first mooring, the line the rows follow along the shore, and the spacing (meters). */
// It starts on the Astoria shore line; fitMarina moves it out into the river until the moorings float.
const MARINA = { at: [40.7752, -73.9268] as LatLng, bearing: 20, spacing: 22, rowGap: 40, perRow: 12 };

/** Meters north and east of a point, as lat/lng. */
function offset([lat, lng]: LatLng, north: number, east: number): LatLng {
  return [lat + north / 111_320, lng + east / (111_320 * Math.cos((lat * Math.PI) / 180))];
}

/** Where the n-th yacht (0-based, by edition) moors: side by side in rows of ten along the shore, bows out toward the
 *  river (`bow`, degrees clockwise from north), the next row further out. */
export function mooring(n: number, shift = 0): { at: LatLng; bow: number } {
  const along = (n % MARINA.perRow) * MARINA.spacing, out = Math.floor(n / MARINA.perRow) * MARINA.rowGap + shift;
  const b = (MARINA.bearing * Math.PI) / 180;
  // Along the shore (bearing), and out into the river (90° to its left, west).
  const north = along * Math.cos(b) + out * Math.cos(b - Math.PI / 2);
  const east = along * Math.sin(b) + out * Math.sin(b - Math.PI / 2);
  return { at: offset(MARINA.at, north, east), bow: MARINA.bearing - 90 };
}

/** A water polygon from the map's tiles: rings of (lng, lat), the first the outline, the rest holes. */
type Water = readonly (readonly (readonly [number, number])[])[];
function inRing(lng: number, lat: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function onWater([lat, lng]: LatLng, water: readonly Water[]): boolean {
  return water.some((rings) => rings.length > 0 && inRing(lng, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lng, lat, h)));
}

/**
 * How far out (meters, toward the bows) the marina has to move for every mooring of `count` yachts to float on the map's
 * water, or null when there's no water near enough (the tiles haven't loaded).
 */
export function fitMarina(water: readonly Water[], count = MARINA.perRow * 2): number | null {
  let best: { shift: number; wet: number } | null = null;
  for (let shift = 0; shift <= 600; shift += 10) {
    let wet = 0;
    for (let n = 0; n < count; n++) if (onWater(mooring(n, shift).at, water)) wet++;
    if (wet === count) return shift;
    if (wet > (best?.wet ?? 0)) best = { shift, wet };
  }
  // Not all of them fit (a full marina in a narrow channel): where the most do.
  return best?.shift ?? null;
}

/** The plaza statue: on the Unisphere's south lawn, facing the camera. */
export const PLAZA_STATUE_AT: LatLng = offset([40.7466, -73.8448], -185, 0);

/** A jet's loop over Queens: centre, radius (meters) and seconds per lap; each owner flies their own circle. */
export function jetLoop(i: number): { center: LatLng; radius: number; lap: number; phase: number; height: number } {
  return { center: offset([40.752, -73.88], (i % 3 - 1) * 900, (Math.floor(i / 3) % 3 - 1) * 1200), radius: 1800 + (i % 4) * 350, lap: 70 + (i % 5) * 9, phase: i * 1.7, height: 260 + (i % 4) * 40 };
}

/** "Mon, Oct 27": a booking week, from its Monday. */
export function weekLabel(monday: string): string {
  return new Date(`${monday}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** The statue's week is over: it has moved home. */
export function plazaWeekOver(monday: string | null, today: string): boolean {
  if (!monday) return false;
  const end = new Date(`${monday}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return today >= end.toISOString().slice(0, 10);
}

/**
 * Billionaire's Row's ten plots in the landmark's own meters (x across, z toward the front; components/map/landmarkModels.ts
 * draws the lawns there): two rows of five either side of the promenade.
 */
export function plotLocal(plot: number): [number, number] {
  const i = plot - 1;
  return [-84 + (i % 5) * 42, i < 5 ? -26 : 26];
}

/** Where a plot is on the map, from where the row stands (its spot, facing and scale; lib/map/landmarks.ts). */
export function plotAt(row: { at: LatLng; facing: number; scale: number }, plot: number): LatLng {
  const [x, z] = plotLocal(plot);
  // As the landmark layer turns a model: rotation.y = (180 - facing)°.
  const t = ((180 - row.facing) * Math.PI) / 180;
  const east = (x * Math.cos(t) + z * Math.sin(t)) * row.scale;
  const south = (-x * Math.sin(t) + z * Math.cos(t)) * row.scale;
  return offset(row.at, -south, east);
}
