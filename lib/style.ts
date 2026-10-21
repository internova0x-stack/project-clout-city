// Style lines in play (stage 4 of the avatar and Shop upgrade; docs/fashion-style-lines.md "Making styles matter in
// play"; migration 0100). The numbers and lists are copied to game_settings 'style' and checked by tests/style.test.ts;
// the server does the counting (style_counts) and the client shows it, mirroring styleCounts() below.
//
//   * What counts: every equipped fashion piece counts 1 toward each of its style lines, whatever it cost (fairness:
//     a budget piece counts the same as a luxury or collector one). A whole outfit (a set) is a look on its own: it
//     counts `fullMin`. Top, bottom and shoes without a Shop piece are the starting style's own clothes, so they count
//     toward its line: a new player arrives in a full look.
//   * Venue match: `venueMin` pieces of a line that fits a place (by its tags) give `venueConfidence` Confidence there,
//     once a New York day.
//   * Full look: `fullMin` pieces of one line show "Full <line> look" on the profile; the first time earns a badge.
//   * Style tasks: some days, one daily task asks for a full look at a place that fits it.

import type { StyleLine } from "./shopCatalog.ts";

export const STYLE = {
  venueMin: 2,
  fullMin: 3,
  venueConfidence: 5,
  /** The chance a day's list gets a style task (when the player owns a full look's worth of a line). */
  taskChance: 0.5,
  /** Places that suit each line, by their tags ("Where it shines"). */
  venues: {
    streetwear: ["park", "pizza", "diner", "bodega", "hot_dog_cart", "halal_cart", "dining_budget"],
    gothic: ["club", "late_night", "music_venue"],
    "nerdy-preppy": ["library", "university", "campus", "games"],
    sporty: ["gym", "park", "sports", "stadium"],
    "business-casual": ["office", "coworking", "rooftop"],
    fashionista: ["rooftop", "dining_luxury", "fashion", "first_party_venue"],
    luxury: ["lounge", "exclusive_venue", "exclusive_club", "dining_luxury"],
    "avant-garde": ["fashion", "music_venue", "cinema"],
    "wasteland-luxe": ["club", "lounge", "exclusive_venue"],
  } satisfies Record<StyleLine, string[]>,
  /** Each starting style's line (its clothes count toward it). */
  startingLines: {
    bodega_drip: "streetwear", thrift_store_icon: "avant-garde", midtown_finance: "business-casual", night_owl_goth: "gothic",
    pilates_princess: "sporty", startup_founder: "business-casual", influencer_soft_glam: "fashionista", arcade_nerd: "nerdy-preppy",
  } satisfies Record<string, StyleLine>,
  /** The pieces on sale before the catalog files (migration 0099 brought them in with no lines). */
  liveLines: {
    "fit-satin-bomber": ["streetwear", "fashionista"],
    "fit-leather-blazer": ["business-casual", "gothic"],
    "fit-varsity-tee": ["streetwear", "nerdy-preppy"],
    "fit-wide-trousers": ["fashionista", "business-casual"],
    "fit-mini-skirt": ["nerdy-preppy", "fashionista"],
    "fit-chunky-sneakers": ["streetwear", "sporty"],
    "forever-our-bird-hoodie": ["streetwear"],
    "col-faux-chinchilla": ["luxury"],
    "col-holo-boots": ["avant-garde", "fashionista"],
    "fit-meteors-cap": ["sporty", "streetwear"],
    "fit-meteors-jersey": ["sporty"],
    "fit-bucket-hat": ["streetwear"],
    "set-site-crew": ["streetwear"],
    "set-st-marks-punk": ["gothic"],
    "set-gala-night": ["luxury", "business-casual"],
    "set-ranch-hand": ["avant-garde"],
    "set-rockaway-beach": ["sporty"],
    "set-adventurer": ["sporty"],
    "set-tactical": ["streetwear"],
    "set-witch": ["gothic"],
    "set-ranger": ["avant-garde"],
    "set-spacefarer": ["avant-garde"],
    "set-royalty": ["luxury"],
  } satisfies Record<string, StyleLine[]>,
} as const;

/** One equipped fashion piece: its slot and lines. */
export interface WornPiece { slot: string | null; lines: readonly string[] }

/** How many pieces of each line a player wears (see the rules at the top). */
export function styleCounts(worn: readonly WornPiece[], startingStyle: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const addTo = (line: string, n: number) => { out[line] = (out[line] ?? 0) + n; };
  const covered = new Set<string>();
  for (const w of worn) {
    if (w.slot === "outfit") { ["top", "bottom", "shoes"].forEach((s) => covered.add(s)); w.lines.forEach((l) => addTo(l, STYLE.fullMin)); continue; }
    if (w.slot) covered.add(w.slot);
    w.lines.forEach((l) => addTo(l, 1));
  }
  const own = startingStyle ? (STYLE.startingLines as Record<string, string>)[startingStyle] : undefined;
  if (own) for (const s of ["top", "bottom", "shoes"]) if (!covered.has(s)) addTo(own, 1);
  return out;
}

/** The lines with a full look, most pieces first. */
export function fullLooks(counts: Record<string, number>): string[] {
  return Object.entries(counts).filter(([, n]) => n >= STYLE.fullMin).sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

/** The line that fits a place (by its tags) with at least venueMin pieces worn, most pieces first; null when none. */
export function venueLine(counts: Record<string, number>, tags: readonly string[]): string | null {
  let best: string | null = null;
  for (const [line, venueTags] of Object.entries(STYLE.venues)) {
    const n = counts[line] ?? 0;
    if (n >= STYLE.venueMin && venueTags.some((t) => tags.includes(t)) && (!best || n > (counts[best] ?? 0))) best = line;
  }
  return best;
}

/** "Full <line> look" badges (player_badges "look-<line>", migration 0100): emoji and name, or null for other ids. */
const LOOK_EMOJI: Record<string, string> = {
  streetwear: "🧢", gothic: "🖤", "nerdy-preppy": "🤓", sporty: "👟", "business-casual": "💼", fashionista: "💅", luxury: "💎",
  "avant-garde": "🌀", "wasteland-luxe": "⛓️",
};
export const LOOK_LABEL: Record<string, string> = {
  streetwear: "Streetwear", gothic: "Goth", "nerdy-preppy": "Preppy", sporty: "Sporty", "business-casual": "Business Casual",
  fashionista: "Fashionista", luxury: "Luxury", "avant-garde": "Avant-garde", "wasteland-luxe": "Wasteland Luxe",
};
export function lookBadge(id: string): { emoji: string; name: string } | null {
  const line = id.startsWith("look-") ? id.slice(5) : null;
  return line && LOOK_LABEL[line] ? { emoji: LOOK_EMOJI[line] ?? "👗", name: `Full ${LOOK_LABEL[line]} look` } : null;
}
