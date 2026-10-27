// Location wave 1 as map pins (Milestones v0.1: pins only, before their cards exist).
// Names are invented, except public parks whose names aren't trademarked.

import type { LatLng } from "./map/geo";

export type PlaceCategory = "food" | "nightlife" | "parks" | "places" | "home" | "monument" | "shopping" | "campus";

export interface PlacePin {
  id: string;
  name: string;
  emoji: string;
  category: PlaceCategory;
  neighborhood: string;
  at: LatLng;
  /** World State tags (World State Layer Brief section 2). */
  tags: string[];
  /** Owner, Oct 17: a place in a borough that hasn't opened yet: shown, locked. */
  locked?: boolean;
  borough?: import("./map/boroughs").BoroughId;
  /** Starter Week (owner, Oct 26): the current mission's place glows. */
  glow?: boolean;
}

export const WAVE_1_PINS: PlacePin[] = [
  {
    id: "velvet-static",
    name: "Velvet Static",
    emoji: "🍸",
    category: "nightlife",
    neighborhood: "Long Island City",
    at: [40.7465, -73.9455],
    tags: ["club", "nightlife", "first_party_venue"],
  },
  {
    id: "grind-and-gossip",
    name: "Grind & Gossip Café",
    emoji: "☕",
    category: "food",
    neighborhood: "Astoria",
    at: [40.7645, -73.9225],
    tags: ["cafe", "dining_medium", "job_barista"],
  },
  {
    id: "lucky-seven-deli",
    name: "Sip & Spill",
    emoji: "🫖",
    category: "places",
    neighborhood: "Jackson Heights",
    at: [40.7495, -73.8885],
    tags: ["mixer", "social", "tea", "dining_budget"],
  },
  {
    id: "altitude-718",
    name: "Altitude 718 Rooftop",
    emoji: "🍽️",
    category: "food",
    neighborhood: "Long Island City",
    at: [40.7425, -73.9555],
    tags: ["rooftop", "dining_luxury"],
  },
  {
    id: "flushing-meadows",
    name: "Flushing Meadows Corona Park",
    emoji: "🌳",
    category: "parks",
    neighborhood: "Flushing Meadows",
    at: [40.7420, -73.8440],
    tags: ["park", "outdoors"],
  },
  {
    id: "skybridge-tower",
    name: "Skybridge Tower",
    emoji: "🏢",
    category: "places",
    neighborhood: "Long Island City",
    at: [40.7495, -73.9395],
    tags: ["office", "gigs_board"],
  },
];

/** Until homes ship in v0.2, every player "lives" in Astoria. */
export const DEFAULT_PLAYER_LOCATION: LatLng = [40.7745, -73.9050];

/** v0.6: every player's map opens on the Astoria neighborhood (30th Ave, Steinway St, Ditmars Blvd). */
export const ASTORIA_CENTER: LatLng = [40.7690, -73.9185];
export const ASTORIA_ZOOM = 13.9;

/** The camera's starting view: Queens, framed. */
export const QUEENS_CENTER: LatLng = [40.718, -73.838];

/**
 * Where guests land: the Long Island City waterfront, Queens' going-out spot
 * (rooftop bars, the club strip and the skyline view). Owner, Oct 27: helicopter height, tilted toward the street,
 * instead of the whole city fitted on screen.
 */
export const GUEST_START = { at: [40.7455, -73.9474] as LatLng, zoom: 16.8, pitch: 60, label: "Long Island City", tagline: "Where Queens goes out" };
