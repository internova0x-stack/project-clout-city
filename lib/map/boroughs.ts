// The five boroughs. Accurate outlines (simplified from NYC's public borough
// boundaries) live in boroughs.geo.json; this file holds names and where each
// locked borough's "Coming soon" pill sits.

import type { LatLng } from "./geo";

export type BoroughId = "queens" | "brooklyn" | "manhattan" | "bronx" | "staten_island";

export interface Borough {
  id: BoroughId;
  name: string;
  labelAt?: LatLng;
  /** Lola Lowdown's one-line teaser on the locked borough's sheet (v0.7, #11). */
  teaser?: string;
}

export const BOROUGHS: Borough[] = [
  { id: "queens", name: "Queens" },
  {
    id: "brooklyn", name: "Brooklyn", labelAt: [40.650, -73.950],
    teaser: "Brownstones, rooftop parties and a man selling C$14 pickles with a straight face. Brooklyn isn't ready for you yet, babe. Neither are the pickles.",
  },
  {
    id: "manhattan", name: "Manhattan", labelAt: [40.785, -73.966],
    teaser: "Everyone's rushing, nobody's on time and the rent has its own publicist. Make Queens jealous first, darling. Then we'll talk.",
  },
  {
    id: "bronx", name: "The Bronx", labelAt: [40.855, -73.870],
    teaser: "Home of the original block party, and they will know if you're faking it. Come back with some clout, sweetie. I'll vouch for you.",
  },
  {
    id: "staten_island", name: "Staten Island", labelAt: [40.585, -74.150],
    teaser: "A free ferry, a lot of opinions and one very loud uncle. The boat isn't running for you yet, babe. I already called ahead.",
  },
];
