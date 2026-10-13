// Real-world scale on the map at New York's latitude, shared by the road widths
// (lib/map/style.ts) and the moving traffic (components/map/vehicles.ts), so two
// lanes of cars always fit inside the road they drive on.

/** Meters per CSS pixel at zoom 0 for 512 px tiles at latitude 40.75°. */
const METERS_PER_PX_Z0 = 59_251;
export const metersPerPx = (zoom: number) => METERS_PER_PX_Z0 / 2 ** zoom;

/** Vehicles (and so their lanes) are drawn bigger than life so they read on a phone. */
export function exaggeration(zoom: number): number {
  if (zoom <= 15) return 2.5;
  if (zoom >= 17) return 2;
  return 2.5 - 0.25 * (zoom - 15);
}

/** Real meters from a road's center line to the middle of each lane. */
export const LANE_CENTER_M = 1.7;
const CAR_WIDTH_M = 1.8;
const CAR_LENGTH_M = 4.5;
/** Car sprite length in CSS pixels at icon-size 1 (components/map/vehicleIcons.ts). */
export const CAR_SPRITE_PX = 22;

export const laneOffsetMeters = (zoom: number) => exaggeration(zoom) * LANE_CENTER_M;

/** Real road width (meters) that fits one lane each way plus a margin. */
export const TWO_LANE_M = 2 * (LANE_CENTER_M + CAR_WIDTH_M / 2) + 0.6;

export const roadPx = (meters: number, zoom: number) => (meters * exaggeration(zoom)) / metersPerPx(zoom);
export const vehicleIconSize = (zoom: number) => (exaggeration(zoom) * CAR_LENGTH_M) / metersPerPx(zoom) / CAR_SPRITE_PX;

/** A line-width expression: thin lines when zoomed out, true two-lane width from zoom 15. */
export function roadWidth(low: [number, number][], meters: number): number {
  const stops: number[] = [];
  let prev = 0;
  for (const [z, px] of low) { stops.push(z, px); prev = px; }
  for (let z = 15; z <= 20; z++) {
    const px = Math.max(prev + 0.1, roadPx(meters, z));
    stops.push(z, Math.round(px * 10) / 10);
    prev = px;
  }
  return ["interpolate", ["exponential", 2], ["zoom"], ...stops] as unknown as number;
}

export function vehicleSizeExpr(): number {
  const stops: number[] = [];
  for (let z = 15; z <= 20; z++) stops.push(z, Math.round(vehicleIconSize(z) * 1000) / 1000);
  return ["interpolate", ["exponential", 2], ["zoom"], ...stops] as unknown as number;
}
