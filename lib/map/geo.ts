// One coordinate system for the whole map (Clarifications section 4).
// Game data stores real lat/lng; the 2D map projects it into map units.
// A later 3D map can consume the same lat/lng without touching game logic.

export type LatLng = readonly [lat: number, lng: number];
export interface MapPoint { x: number; y: number }

// Equirectangular projection around New York, corrected for latitude.
const WEST = -74.28;
const EAST = -73.68;
const NORTH = 40.93;
const SOUTH = 40.48;
const COS_LAT = Math.cos((40.7 * Math.PI) / 180);

/** Map units per degree of latitude. */
const SCALE = 2200;

export const MAP_WIDTH = Math.round((EAST - WEST) * COS_LAT * SCALE);
export const MAP_HEIGHT = Math.round((NORTH - SOUTH) * SCALE);

export function project([lat, lng]: LatLng): MapPoint {
  return {
    x: (lng - WEST) * COS_LAT * SCALE,
    y: (NORTH - lat) * SCALE,
  };
}

export function toPath(points: readonly LatLng[]): string {
  return (
    points
      .map((p, i) => {
        const { x, y } = project(p);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function toPolyline(points: readonly LatLng[]): string {
  return points
    .map((p) => {
      const { x, y } = project(p);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function centroid(points: readonly LatLng[]): MapPoint {
  let x = 0;
  let y = 0;
  for (const p of points) {
    const m = project(p);
    x += m.x;
    y += m.y;
  }
  return { x: x / points.length, y: y / points.length };
}
