// The five boroughs. Accurate outlines (simplified from NYC's public borough
// boundaries) live in boroughs.geo.json; this file holds names and where each
// locked borough's "Coming soon" pill sits.

import type { LatLng } from "./geo";

export type BoroughId = "queens" | "brooklyn" | "manhattan" | "bronx" | "staten_island";

export interface Borough {
  id: BoroughId;
  name: string;
  labelAt?: LatLng;
}

export const BOROUGHS: Borough[] = [
  { id: "queens", name: "Queens" },
  { id: "brooklyn", name: "Brooklyn", labelAt: [40.650, -73.950] },
  { id: "manhattan", name: "Manhattan", labelAt: [40.785, -73.966] },
  { id: "bronx", name: "The Bronx", labelAt: [40.855, -73.870] },
  { id: "staten_island", name: "Staten Island", labelAt: [40.585, -74.150] },
];
