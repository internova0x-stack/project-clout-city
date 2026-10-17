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
  /** Owner, Oct 17: the Places tab's empty state while the borough has no places yet. */
  empty?: string;
  /** A shorter tab label where the name is long. */
  short?: string;
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
    empty: "Nothing here yet. Manhattan's places are still in a meeting about the meeting, and the doorman says your name isn't on the list. It isn't on any list. Yet.",
  },
  {
    id: "bronx", name: "The Bronx", labelAt: [40.855, -73.870],
    teaser: "Home of the original block party, and they will know if you're faking it. Come back with some clout, sweetie. I'll vouch for you.",
    empty: "No spots yet. The Bronx is still setting up the block party: the DJ's here, the folding tables are here, you are very much not here. Keep building that clout, babe.",
    short: "Bronx",
  },
  {
    id: "staten_island", name: "Staten Island", labelAt: [40.585, -74.150],
    teaser: "A free ferry, a lot of opinions and one very loud uncle. The boat isn't running for you yet, babe. I already called ahead.",
    empty: "Nothing to see yet but a ferry schedule and a very loud uncle with opinions about it. The boat leaves when you're famous. He'll still have opinions.",
    short: "Staten",
  },
];
