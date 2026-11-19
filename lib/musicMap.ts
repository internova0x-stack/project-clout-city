// Which music plays where (owner, Nov 19: different music by place). Pure: GameShell passes where the player is.
import type { MusicStyleId } from "./musicStyles.ts";

export interface MusicScene {
  /** The game's bottom tab: home (your place) or the map. */
  tab: "home" | "map" | string;
  /** The place the player is inside, if any. */
  place?: { id: string; tags: readonly string[] } | null;
  /** The floor inside it (campus areas: Greek Row is 5). */
  floor?: number;
  /** A date night or a party at someone's place is on. */
  date?: boolean;
  party?: boolean;
}

const has = (tags: readonly string[], ...want: string[]) => want.some((t) => tags.includes(t));

export function musicFor(s: MusicScene): MusicStyleId {
  if (s.date) return "romance";
  if (s.party) return "afrobeats";
  const p = s.place;
  if (p) {
    const t = p.tags;
    if (has(t, "campus") && s.floor === 5) return "afrobeats"; // Greek Row
    if (has(t, "club", "nightlife", "lounge", "music_venue", "exclusive_venue", "gym")) return "techno";
    if (has(t, "mixer", "social", "taverna", "stadium", "sports")) return "afrobeats";
    if (has(t, "rooftop", "dining_luxury", "waterfront", "park", "monument", "church")) return "romance";
    if (has(t, "office", "station", "tv", "radio", "civic", "campaign", "underworld")) return "synth";
    if (has(t, "university", "campus", "library", "residential")) return "lofi";
    return "pop"; // shops, delis, diners, pizza, the lotto counter…
  }
  return s.tab === "home" ? "lofi" : "pop";
}
