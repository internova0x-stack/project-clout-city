// One coordinate system for the whole game (Clarifications section 4): real
// latitude and longitude. The map renderer projects them; game logic never does.

export type LatLng = readonly [lat: number, lng: number];

/** Straight-line distance in miles (haversine). Good enough for "0.8 mi away". */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
