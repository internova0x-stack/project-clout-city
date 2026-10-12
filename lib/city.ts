// v0.3 "The City": places and their actions, jobs, club events, gigs, daily
// tasks, the Shop catalog and bills (Clarifications sections 3 to 6 and 13).
// This file is the single source for the content. scripts/gen-city-seed.ts writes
// the same data into the database seed (game_settings 'city'), which the server
// functions use to validate every price and reward; tests/city.test.ts checks
// the two still match. Dependency-free so tests can import it.

import type { LatLng } from "./map/geo";

// ---------------------------------------------------------------------------
// Economy numbers (all tunable; gig pay is a multiple of the shift rate)
// ---------------------------------------------------------------------------
export const CITY_ECONOMY = {
  shiftRate: 120,
  cloutPerDollar: 0.6,
  baseVisitClout: 5,
  /** Mood and Confidence scale clout: 0.7 + 0.3·mood/100 + 0.3·confidence/100. */
  cloutMultiplier: { base: 0.7, mood: 0.3, confidence: 0.3 },
  energy: { dailyTopUp: 20, eventCost: 20 },
  confidenceDriftPerDay: 3,
  dailyTasks: { count: 5, rewardMin: 40, rewardMax: 90, bonus: 150 },
  sellRate: 0.6,
  /** Each purchase's clout is this fraction of the previous one's (diminishing returns). */
  purchaseCloutDecay: 0.85,
  /**
   * Rent, the phone bill and car insurance bill monthly (same day each month, as Postgres
   * intervals); car rentals bill weekly. Insurance is a share of the car's price per month.
   */
  bills: { every: "1 month", carRentalDays: 7, phone: 85, graceDays: 3, moodDropPerDay: 8, evictAfterDays: 7, carInsuranceRate: 0.02 },
  gigs: {
    // Pay is a multiple of shiftRate. Tuned so 1 to 2 gigs cover a month's rent on the cheapest home ($2,100).
    side: { confidence: 0, chance: 0.9, payMin: 3, payMax: 5, energy: 1.5, waitMinutes: 60 },
    pro: { confidence: 50, chance: 0.5, payMin: 8, payMax: 10, energy: 2, waitMinutes: 120 },
    big: { confidence: 80, chance: 0.22, payMin: 15, payMax: 20, energy: 3, waitMinutes: 240 },
  },
  shiftEnergy: 25,
} as const;

// ---------------------------------------------------------------------------
// Places (location wave 1: Milestones v0.3)
// ---------------------------------------------------------------------------
export type InteriorTemplate = "apartment" | "club" | "cafe" | "counter";
export type PlaceDepth = "full" | "scene";

export type ActionKind = "visit" | "eat" | "shift" | "hangout" | "gigs";

export interface PlaceAction {
  id: string;
  kind: ActionKind;
  label: string;
  /** Cash the player pays (visit, eat). */
  price?: number;
  /** Cash the player earns (shift). */
  pay?: number;
  /** Energy spent (positive) or restored (negative) per use. */
  energy: number;
  mood?: number;
  confidence?: number;
  /** Witty one-liner under the action. */
  blurb: string;
  /** Fixed clout instead of the price-based amount (story actions such as the memorial wall). */
  clout?: number;
  /** Hidden until a story effect unlocks it (World State place_state unlock_action). */
  storyUnlock?: boolean;
}

export interface Place {
  id: string;
  name: string;
  emoji: string;
  category: "food" | "nightlife" | "parks" | "places" | "home";
  neighborhood: string;
  at: LatLng;
  depth: PlaceDepth;
  template?: InteriorTemplate;
  tier?: "Budget" | "Medium" | "Luxury";
  /** Lola Lowdown's take, 2 to 3 lines. */
  lore: string;
  /** Colors for the illustration and interior. */
  palette: [string, string, string];
  tags: string[];
  actions: PlaceAction[];
  /** Story places (location wave 2) appear on the map only once their arc has started. */
  story?: string;
}

export const PLACES: Place[] = [
  {
    id: "velvet-static", name: "Velvet Static", emoji: "🍸", category: "nightlife", neighborhood: "Long Island City",
    at: [40.7465, -73.9455], depth: "full", template: "club", palette: ["#FF2E88", "#6B2BD9", "#14111A"],
    tags: ["club", "nightlife", "first_party_venue"],
    lore: "A converted warehouse where the bass is louder than your thoughts. The bouncer has rejected three influencers and one actual prince. You got in once. Act like it was nothing.",
    actions: [
      { id: "visit", kind: "visit", label: "Get seen on the dance floor", price: 60, energy: 15, mood: 6, confidence: 4, blurb: "Fake it till you make it: pay the bar man to let you in." },
    ],
  },
  {
    id: "grind-and-gossip", name: "Grind & Gossip Café", emoji: "☕", category: "food", neighborhood: "Astoria", tier: "Medium",
    at: [40.7645, -73.9225], depth: "full", template: "cafe", palette: ["#C27C4E", "#F4E3C8", "#3A2A20"],
    tags: ["cafe", "dining_medium", "job_barista"],
    lore: "Oat-milk lattes and unverified rumors, both served hot. The barista knows everyone's business and spells every name wrong on purpose.",
    actions: [
      { id: "eat", kind: "eat", label: "Brunch and eavesdrop", price: 18, energy: -30, blurb: "Avocado toast that costs more than your phone bill's feelings." },
      { id: "shift", kind: "shift", label: "Work a barista shift", pay: 120, energy: 25, blurb: "Pull shots, take orders, absorb gossip. Paid in cash and secrets." },
    ],
  },
  {
    id: "lucky-seven-deli", name: "Lucky Seven Deli", emoji: "🥪", category: "food", neighborhood: "Jackson Heights", tier: "Budget",
    at: [40.7495, -73.8885], depth: "full", template: "counter", palette: ["#2E8B63", "#FFC21A", "#1F1B26"],
    tags: ["bodega", "dining_budget"],
    lore: "Open 24 hours, staffed by one man and a cat who runs the place. The chopped cheese is legendary; the receipts are imaginary.",
    actions: [
      { id: "eat", kind: "eat", label: "Grab a chopped cheese", price: 7, energy: -15, blurb: "Cheap, fast, life-changing. The cat watches you eat it." },
    ],
  },
  {
    id: "altitude-718", name: "Altitude 718 Rooftop", emoji: "🍽️", category: "food", neighborhood: "Long Island City", tier: "Luxury",
    at: [40.7425, -73.9555], depth: "scene", palette: ["#F2A900", "#1B2A4A", "#E8D7B0"],
    tags: ["rooftop", "dining_luxury"],
    lore: "Forty floors up, the skyline does the talking. Nobody comes for the food, but the food is incredible, which is suspicious.",
    actions: [
      { id: "eat", kind: "eat", label: "Dine with a view", price: 95, energy: -55, blurb: "Small plates, big prices, bigger photos. Being seen here is the point." },
    ],
  },
  {
    id: "flushing-meadows", name: "Flushing Meadows Corona Park", emoji: "🌳", category: "parks", neighborhood: "Flushing Meadows",
    at: [40.7420, -73.8440], depth: "scene", palette: ["#40B589", "#9ED8F7", "#2F6B4F"],
    tags: ["park", "outdoors"],
    lore: "Fountains, a giant steel globe and joggers judging your form. The fresh air is free, which in this city is basically a scam.",
    actions: [
      { id: "hangout", kind: "hangout", label: "Hang out by the fountains", energy: 5, mood: 12, blurb: "Touch grass. Literally. Your mood will thank you." },
    ],
  },
  {
    id: "pedal-pushers", name: "Pedal Pushers Hub", emoji: "🚲", category: "places", neighborhood: "Astoria",
    at: [40.7590, -73.9280], depth: "scene", palette: ["#6C8CFF", "#FFC21A", "#1F1B26"],
    tags: ["delivery_hub", "job_delivery"],
    lore: "Bikes, batteries and the eternal hum of someone's order running late. The dispatcher calls everyone \"champ\" and means it.",
    actions: [
      { id: "shift", kind: "shift", label: "Ride a delivery shift", pay: 135, energy: 30, blurb: "Four flights of stairs, no elevator, tip: a thumbs up." },
    ],
  },
  {
    id: "skybridge-tower", name: "Skybridge Tower", emoji: "🏢", category: "places", neighborhood: "Long Island City",
    at: [40.7495, -73.9395], depth: "scene", palette: ["#6C8CFF", "#D6CFC4", "#14111A"],
    tags: ["office", "gigs_board"],
    lore: "Glass, steel and a lobby that smells like ambition and burnt coffee. The gigs board in the lobby is where careers start, or at least side hustles.",
    actions: [
      { id: "gigs", kind: "gigs", label: "Check the gigs board", energy: 0, blurb: "Bigger pay than a shift. Bigger egos too." },
    ],
  },
  // ---- Location wave 2 (Milestones v0.4): "Who Killed Sarah Bird?" story places, scene cards only ----
  {
    id: "skyline-pier", name: "Skyline Pier Residences", emoji: "🏙️", category: "places", neighborhood: "Long Island City", story: "sarah-bird",
    at: [40.7478, -73.9592], depth: "scene", palette: ["#9DB2FF", "#E8E2EE", "#2A2350"],
    tags: ["skyline_pier", "residential", "waterfront"],
    lore: "Glass, concierge and a lobby that smells like eucalyptus and old money pretending to be new. Ray has worked the front desk for twenty years and writes everything down in a little paper book.",
    actions: [
      { id: "lobby", kind: "visit", label: "Stop by the lobby", price: 0, energy: 5, blurb: "Ray nods. Ray writes something down." },
      { id: "memorial", kind: "visit", label: "Leave flowers at the memorial wall", price: 0, energy: 2, clout: 10, mood: 4, storyUnlock: true, blurb: "White roses, handwritten notes and a lot of quiet. Rest easy, Glass Bird." },
    ],
  },
  {
    id: "hunters-pier", name: "Hunter's Pier", emoji: "🌊", category: "parks", neighborhood: "Long Island City", story: "sarah-bird",
    at: [40.7432, -73.9612], depth: "scene", palette: ["#7FB3E8", "#F6C9A0", "#2F6B5F"],
    tags: ["hunters_pier", "waterfront", "park"],
    lore: "A pier with the best skyline view in Queens and the worst seagulls in the five boroughs. Joggers, dates and one guy with a saxophone, every single night.",
    actions: [
      { id: "hangout", kind: "hangout", label: "Watch the skyline", energy: 5, mood: 8, blurb: "The city looks better from over here. Most things do." },
    ],
  },
  {
    id: "rockaway-diner", name: "Rockaway Diner", emoji: "🥞", category: "food", neighborhood: "Astoria", tier: "Budget", story: "sarah-bird",
    at: [40.7712, -73.9158], depth: "scene", palette: ["#E5484D", "#F4E3C8", "#2A2530"],
    tags: ["rockaway_diner", "diner", "dining_budget"],
    lore: "Vinyl booths, a pie case that rotates like it's auditioning and coffee that has never once been described as artisanal. The waitresses call everyone \"hon\" and mean it.",
    actions: [
      { id: "eat", kind: "eat", label: "Grab a booth and a stack", price: 14, energy: -25, blurb: "Pancakes the size of hubcaps. The syrup is self-serve and so is the gossip." },
    ],
  },
  {
    id: "radiant-harbor", name: "Radiant Harbor Church", emoji: "⛪", category: "places", neighborhood: "Astoria", story: "sarah-bird",
    at: [40.7738, -73.9296], depth: "scene", palette: ["#F2C46B", "#F4E3C8", "#3A2C5E"],
    tags: ["radiant_harbor", "church"],
    lore: "A warm congregation, a very good choir and a building-fund thermometer that's been at 90% for three years. The pastor hosts a podcast. Of course he does.",
    actions: [
      { id: "visit", kind: "visit", label: "Sit in on a service", price: 0, energy: 5, mood: 5, blurb: "The choir is genuinely incredible. The coffee after is genuinely not." },
    ],
  },
  {
    id: "pressed-iron-gym", name: "Pressed Iron Gym", emoji: "🏋️", category: "places", neighborhood: "Astoria", story: "sarah-bird",
    at: [40.7662, -73.9118], depth: "scene", palette: ["#6C8CFF", "#C7CCD4", "#1F1B26"],
    tags: ["pressed_iron", "gym"],
    lore: "Chalk dust, mirrors and men who grunt in full sentences. The front desk keeps very good membership records, which some people find inconvenient.",
    actions: [
      { id: "workout", kind: "visit", label: "Buy a day pass and lift", price: 15, energy: 20, confidence: 6, mood: 3, blurb: "You lifted. You were seen lifting. Both count." },
    ],
  },
];

export const HOME_PLACE_ID = "home";

/** Where each starter home sits on the map. */
export const HOME_LOCATIONS: Record<string, LatLng> = {
  astoria_studio: [40.7745, -73.9050],
  jackson_heights_1br: [40.7520, -73.8830],
  lic_highrise: [40.7470, -73.9560],
};

// ---------------------------------------------------------------------------
// Club events (virtual cash). Times are on the city clock; the countdown is real minutes.
// ---------------------------------------------------------------------------
export interface ClubEvent {
  id: string;
  name: string;
  placeId: string;
  /** City-clock hour the doors open, and how many city hours it runs. */
  startHour: number;
  hours: number;
  entry: number;
  clout: number;
  confidence: number;
  mood: number;
  blurb: string;
}

export const CLUB_EVENTS: ClubEvent[] = [
  { id: "neon-nights", name: "Neon Nights", placeId: "velvet-static", startHour: 22, hours: 5, entry: 80, clout: 60, confidence: 8, mood: 6, blurb: "Glow sticks, bad decisions, excellent lighting." },
  { id: "golden-hour", name: "Golden Hour Day Party", placeId: "velvet-static", startHour: 15, hours: 4, entry: 50, clout: 40, confidence: 6, mood: 8, blurb: "A day party for people who can't commit to a night." },
];

// ---------------------------------------------------------------------------
// Gigs: titles per tier (invented clients only)
// ---------------------------------------------------------------------------
export type GigTier = "side" | "pro" | "big";
export const GIG_TITLES: Record<GigTier, { title: string; blurb: string }[]> = {
  side: [
    { title: "Be a professional crowd at a gallery opening", blurb: "Nod at the art. Say \"it's giving\" at least twice." },
    { title: "Stand in line for a sneaker drop", blurb: "Eight hours, one folding chair, zero sneakers for you." },
    { title: "Laugh on cue at a comedy open mic", blurb: "The comedian's mom is paying. Make it convincing." },
    { title: "Hold a ring light at a rooftop shoot", blurb: "You are now part of the lighting rig. Emotionally, too." },
  ],
  pro: [
    { title: "Run a launch campaign for a $14 artisanal ice cube startup", blurb: "The cubes are hand-carved. The founder is hand-wringing." },
    { title: "Ghost-write a podcast host's \"authentic\" origin story", blurb: "He grew up in Westchester. Make it sound like Queens." },
    { title: "Manage socials for a dog with 40k followers", blurb: "The dog has a brand voice. It's better than yours." },
  ],
  big: [
    { title: "Write a speech for a councilmember candidate", blurb: "Invented district, invented party, very real panic." },
    { title: "Art-direct a perfume ad for a fictional heiress", blurb: "The perfume smells like money. Literally, they used money." },
  ],
};

// ---------------------------------------------------------------------------
// Shop (Fashion, Cars, Houses, Luxury, Makeup). Virtual cash only in v0.3.
// ---------------------------------------------------------------------------
export type ShopCategory = "fashion" | "cars" | "houses" | "luxury" | "makeup";

export interface ShopItem {
  sku: string;
  category: ShopCategory;
  name: string;
  emoji: string;
  price: number;
  /** Base clout for the purchase, before diminishing returns. */
  clout: number;
  rating: 1 | 2 | 3 | 4;
  blurb: string;
  /** Fashion: which outfit slot it fills and how it renders on the avatar. */
  wear?: { slot: "top" | "bottom" | "shoes" | "accessory"; kind?: string; color: string; accent?: string };
  /** Cars: weekly rental price, if it can be rented. */
  rentPerWeek?: number;
  /** Houses: replaces the rented home. */
  neighborhood?: string;
  /** Only sold while a story effect opens it (World State availability "open" by sku). */
  storyOnly?: boolean;
}

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; emoji: string }[] = [
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "cars", label: "Cars", emoji: "🚗" },
  { id: "houses", label: "Houses", emoji: "🏠" },
  { id: "luxury", label: "Luxury", emoji: "💍" },
  { id: "makeup", label: "Makeup", emoji: "💄" },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Fashion
  { sku: "fit-satin-bomber", category: "fashion", name: "Satin bomber jacket", emoji: "🧥", price: 180, clout: 25, rating: 3, blurb: "Shiny enough to be seen from Jersey.", wear: { slot: "top", kind: "zip", color: "#E0186F", accent: "#14111A" } },
  { sku: "fit-leather-blazer", category: "fashion", name: "Leather blazer", emoji: "🧥", price: 420, clout: 45, rating: 4, blurb: "Says \"I have a publicist.\" You don't. Yet.", wear: { slot: "top", kind: "blazer", color: "#1F1B26", accent: "#6B6570" } },
  { sku: "fit-varsity-tee", category: "fashion", name: "Vintage varsity tee", emoji: "👕", price: 65, clout: 10, rating: 2, blurb: "From a college you didn't attend. Iconic.", wear: { slot: "top", kind: "tee", color: "#FFF6E0", accent: "#D93A2F" } },
  { sku: "fit-wide-trousers", category: "fashion", name: "Wide-leg trousers", emoji: "👖", price: 140, clout: 18, rating: 3, blurb: "Extra fabric, extra confidence.", wear: { slot: "bottom", kind: "pants", color: "#C2AE86" } },
  { sku: "fit-mini-skirt", category: "fashion", name: "Pleated mini skirt", emoji: "👗", price: 120, clout: 16, rating: 3, blurb: "Brunch-approved. Weather-ignored.", wear: { slot: "bottom", kind: "skirt", color: "#6B2BD9" } },
  { sku: "fit-chunky-sneakers", category: "fashion", name: "Chunky dad sneakers", emoji: "👟", price: 210, clout: 28, rating: 4, blurb: "Ugly on purpose. Expensive on purpose.", wear: { slot: "shoes", color: "#ECE6DC" } },
  { sku: "forever-our-bird-hoodie", category: "fashion", name: "\"Forever Our Bird\" hoodie", emoji: "🕊️", price: 85, clout: 12, rating: 2, storyOnly: true, blurb: "Loretta's grief merch, $85, \"for healing.\" Limited time, unlimited questions.", wear: { slot: "top", kind: "hoodie", color: "#F4F1EA", accent: "#6C8CFF" } },
  { sku: "fit-bucket-hat", category: "fashion", name: "Bucket hat", emoji: "👒", price: 55, clout: 8, rating: 2, blurb: "Hides bad hair days and good ideas.", wear: { slot: "accessory", kind: "cap", color: "#40B589" } },
  // Cars
  { sku: "car-hatchback", category: "cars", name: "Pre-loved hatchback", emoji: "🚗", price: 14000, clout: 120, rating: 2, rentPerWeek: 350, blurb: "Previously loved. Heavily. It still gets you to the club." },
  { sku: "car-luxury-sedan", category: "cars", name: "Luxury sedan", emoji: "🚘", price: 52000, clout: 300, rating: 4, rentPerWeek: 900, blurb: "Rent this luxury sedan. Might be fake life, but it's oh so worth it when you pull up to the club." },
  { sku: "car-electric-coupe", category: "cars", name: "Electric coupe", emoji: "⚡", price: 78000, clout: 420, rating: 4, rentPerWeek: 1300, blurb: "Silent, fast and smug. Like a startup founder." },
  // Houses
  { sku: "house-astoria-townhouse", category: "houses", name: "Astoria townhouse", emoji: "🏡", price: 180000, clout: 900, rating: 3, neighborhood: "Astoria", blurb: "A stoop of your own. Neighbors will judge your plants." },
  { sku: "house-lic-penthouse", category: "houses", name: "LIC penthouse", emoji: "🌆", price: 650000, clout: 2400, rating: 4, neighborhood: "Long Island City", blurb: "Floor-to-ceiling windows, so the city can watch you thrive." },
  // Luxury
  { sku: "lux-gold-chain", category: "luxury", name: "Chunky gold-tone chain", emoji: "📿", price: 900, clout: 70, rating: 3, blurb: "Not gold. Nobody needs to know." },
  { sku: "lux-diamond-studs", category: "luxury", name: "Diamond-ish studs", emoji: "💎", price: 2400, clout: 140, rating: 4, blurb: "They sparkle. That's the whole personality." },
  { sku: "lux-designer-watch", category: "luxury", name: "Designer watch", emoji: "⌚", price: 6800, clout: 260, rating: 4, blurb: "Tells the time and tells everyone you're doing fine." },
  // Makeup
  { sku: "mu-glow-kit", category: "makeup", name: "Glass-skin glow kit", emoji: "✨", price: 75, clout: 12, rating: 3, blurb: "Look like you sleep eight hours. You don't." },
  { sku: "mu-lip-set", category: "makeup", name: "Lip set in 12 shades of \"nude\"", emoji: "💄", price: 95, clout: 14, rating: 3, blurb: "Twelve shades. You'll wear one. Forever." },
  { sku: "mu-lash-bar", category: "makeup", name: "Lash bar appointment", emoji: "👁️", price: 160, clout: 20, rating: 2, blurb: "Blink and you'll fan the person next to you." },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

export function itemBySku(sku: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.sku === sku);
}

/** Clout from a visit or meal: by price (base value, never a story-modified price), scaled by Mood and Confidence. */
export function visitClout(price: number, mood: number, confidence: number): number {
  const m = CITY_ECONOMY.cloutMultiplier;
  const mult = m.base + (m.mood * mood) / 100 + (m.confidence * confidence) / 100;
  return Math.round((CITY_ECONOMY.baseVisitClout + price * CITY_ECONOMY.cloutPerDollar) * mult);
}

/** Clout for the nth purchase (0-based), with diminishing returns. */
export function purchaseClout(base: number, purchasesSoFar: number): number {
  return Math.round(base * Math.pow(CITY_ECONOMY.purchaseCloutDecay, purchasesSoFar));
}

export function sellPrice(value: number): number {
  return Math.floor(value * CITY_ECONOMY.sellRate);
}

/** Minutes since city-clock midnight for a given instant (same formula as lib/cityClock.ts). */
export function eventOpen(ev: ClubEvent, cityMinutes: number): boolean {
  const start = ev.startHour * 60;
  const end = (start + ev.hours * 60) % 1440;
  return start < end ? cityMinutes >= start && cityMinutes < end : cityMinutes >= start || cityMinutes < end;
}

/** Real minutes until doors open (one city day = 120 real minutes). */
export function realMinutesUntilOpen(ev: ClubEvent, cityMinutes: number, realHoursPerCityDay = 2): number {
  const start = ev.startHour * 60;
  const wait = (start - cityMinutes + 1440) % 1440;
  return Math.ceil((wait * realHoursPerCityDay * 60) / 1440);
}

/** The seed the database stores (game_settings 'city'); generated into the migration. */
export function citySeed() {
  return {
    economy: CITY_ECONOMY,
    places: PLACES.map((p) => ({
      id: p.id, tags: p.tags, story: p.story ?? null,
      actions: p.actions.map((a) => ({
        id: a.id, kind: a.kind, price: a.price ?? 0, pay: a.pay ?? 0, energy: a.energy, mood: a.mood ?? 0, confidence: a.confidence ?? 0,
        clout: a.clout ?? null, storyUnlock: a.storyUnlock ?? false,
      })),
    })),
    events: CLUB_EVENTS.map((e) => ({ id: e.id, placeId: e.placeId, startHour: e.startHour, hours: e.hours, entry: e.entry, clout: e.clout, confidence: e.confidence, mood: e.mood })),
    gigs: Object.fromEntries(Object.entries(GIG_TITLES).map(([tier, list]) => [tier, list.map((g) => g.title)])),
    shop: SHOP_ITEMS.map((i) => ({ sku: i.sku, category: i.category, price: i.price, clout: i.clout, rentPerWeek: i.rentPerWeek ?? 0, slot: i.wear?.slot ?? null, storyOnly: i.storyOnly ?? false })),
    homeLocations: HOME_LOCATIONS,
  };
}
