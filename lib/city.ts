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
   * Everything bills weekly (v0.8, #23; owner Oct 13): rent, the phone bill, car insurance and car
   * rentals, every 7 days from the day they start. Insurance is a share of the car's price per week.
   * Missed rent: 2 days' grace, then Mood drops daily, then a move to the cheapest home after 6 days
   * (before the next week's rent arrives).
   */
  bills: { every: "7 days", carRentalDays: 7, phone: 25, graceDays: 2, moodDropPerDay: 8, evictAfterDays: 6, carInsuranceRate: 0.005 },
  gigs: {
    // Pay is a multiple of shiftRate. With weekly rent (v0.8): a side gig is about a week in the studio
    // (C$600), a pro gig a week in the 1BR, a big break a week in the high-rise.
    // Clout (v0.7, owner Oct 13): pro gigs and big breaks also need a reputation, not just a good mood.
    side: { confidence: 0, clout: 0, chance: 0.9, payMin: 3, payMax: 5, energy: 1.5, waitMinutes: 60 },
    pro: { confidence: 50, clout: 500, chance: 0.5, payMin: 8, payMax: 10, energy: 2, waitMinutes: 120 },
    big: { confidence: 80, clout: 2000, chance: 0.22, payMin: 15, payMax: 20, energy: 3, waitMinutes: 240 },
  },
  shiftEnergy: 25,
  /**
   * Rest at home and drinks at venues (v0.8, #3, #26, #27; owner Oct 13). Caps keep meals the main
   * source of Energy: a nap is +30 twice a day (an 8-second nap on the player's own timer), sitting
   * +10 Energy and +6 Mood three times a day; both only at home. A drink at a club or lounge bar is
   * the pricey, convenient option: C$28 for +20 Energy, no clout, no cap.
   */
  rest: {
    nap: { energy: 30, mood: 0, perDay: 2, seconds: 8 },
    sit: { energy: 10, mood: 6, perDay: 3, seconds: 0 },
  },
  barDrink: { price: 28, energy: 20, tags: ["club", "lounge"] },
  /**
   * Groceries and home cooking (v0.8, owner Oct 13): the budget option. Bundles are bought at a
   * supermarket (you have to be there) and fill the fridge, up to fridgeMax meals; a bundle that
   * doesn't fit can't be bought. Cooking at home uses one meal for Energy on a short personal
   * timer: no clout, no cap beyond the fridge. Groceries aren't possessions (no Net Worth, no resale).
   */
  groceries: {
    fridgeMax: 10,
    cook: { energy: 25, seconds: 6 },
    tags: ["supermarket"],
    bundles: [
      { id: "snack-run", emoji: "🥪", label: "Snack run", price: 12, meals: 2, blurb: "Chips, hummus, one sad apple. Technically two meals." },
      { id: "meal-prep", emoji: "🥦", label: "Meal prep for the week", price: 35, meals: 7, blurb: "Seven containers, one Sunday, infinite smugness." },
    ],
  },
  /**
   * Travel (v0.8, #4; owner Oct 13): no spending before arriving. Price and Energy come from four
   * distance bands (under 0.5 mi, 0.5 to 2, 2 to 5, over 5), not routes. Walking is free but tiring
   * and isn't offered past 5 miles; the subway is a flat fare; your own car costs nothing to drive.
   * Trips are short (3 to 10 seconds of watching), on the player's own timer, always skippable.
   */
  travel: {
    bandsMiles: [0.5, 2, 5],
    walk: { energy: [5, 10, 20, null], seconds: [6, 8, 10, null] },
    subway: { fare: 3, seconds: [5, 6, 7, 8] },
    taxi: { fare: [8, 16, 28, 45], seconds: [3, 4, 5, 6] },
    car: { seconds: [3, 4, 5, 6] },
  },
  /**
   * Treasure hunts (v0.6): cash about a pro gig (8 to 10 shifts), clout about 15 to 20% of an
   * active player's week, a wrong answer waits 10 minutes, a badge after four hunts.
   */
  hunt: { cash: 1080, clout: 250, retryMinutes: 10, badgeAfter: 4 },
  /**
   * Lucky Star Lotto (v0.10, spec section 7; owner Oct 13). Five scratch-card games; each top prize is
   * 1,000 times the card. Every game shares one fixed prize table, in multiples of the card's price and
   * chances per 100,000 cards: about 1 card in 3 wins, the average card pays back 60.5% of its price
   * and 10% of every bought card feeds the weekly jackpot, so the lotto takes out more C$ than it pays.
   * A prize of 100 times the card or more is a big prize (about 1 card in 4,760). One free card a day
   * (always the C$5 game), a second one through a player's first 7 days, and 5 bought cards a day across
   * all games; all reset at midnight in New York. The server draws every result when the card is bought
   * (migration 0032), and real money never touches any of it.
   */
  /**
   * Neighborhood gossip (v0.10, spec section 8; owner Oct 13). 3 to 5 stories a week of exactly five
   * pieces; finishing one pays a little clout and Mood (once, ledger 'gossip'), and five finished earn
   * a badge. Stories stay findable for two weeks from their Monday; finished Tea cards are kept.
   */
  gossip: { pieces: 5, storiesPerWeek: { min: 3, max: 5 }, liveDays: 14, clout: 25, mood: 6, badgeAfter: 5 },
  lotto: {
    tags: ["lotto"],
    freeGame: "corner-store",
    freePerDay: 1,
    beginner: { days: 7, extraPerDay: 1 },
    buyPerDay: 5,
    jackpot: { seed: 5000, cut: 0.1 },
    prizes: [
      { times: 1, per100k: 20000 },
      { times: 2, per100k: 10000 },
      { times: 5, per100k: 2500 },
      { times: 20, per100k: 250 },
      { times: 100, per100k: 20 },
      { times: 1000, per100k: 1 },
    ],
    bigFrom: 100,
    games: [
      { id: "corner-store", name: "Corner Store Classic", price: 5, color: "#40B589", blurb: "The one your uncle buys with exact change." },
      { id: "bodega-cat", name: "Bodega Cat Bonanza", price: 10, color: "#3E8EDE", blurb: "The cat picked the numbers. The cat has never been wrong." },
      { id: "rents-due", name: "Rent's Due", price: 20, color: "#FF2E88", blurb: "Financial planning, but make it shiny." },
      { id: "penthouse-dreams", name: "Penthouse Dreams", price: 50, color: "#7A4FD6", blurb: "Scratch here to see the view. The view is the counter." },
      { id: "main-character", name: "Main Character", price: 100, color: "#2A2530", blurb: "For people who are sure the plot is about them." },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Places (location wave 1: Milestones v0.3)
// ---------------------------------------------------------------------------
export type InteriorTemplate = "apartment" | "club" | "cafe" | "counter" | "lounge" | "store" | "campus" | "unisphere" | "gantries" | "lotto";
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
  category: "food" | "nightlife" | "parks" | "places" | "home" | "monument" | "shopping" | "campus";
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
  /** Shopping places open this Shop category; they don't sell anything themselves (Clarifications 4). */
  opensShop?: ShopCategory;
  /** Monuments: the real-money postcard offered on the card after a visit (Clarifications 6). */
  postcard?: string;
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
  // ---- Location wave 3 (Milestones v0.5): two monuments, a lounge, the boutique and the dealership ----
  {
    id: "unisphere", name: "The Unisphere", emoji: "🌐", category: "monument", neighborhood: "Flushing Meadows",
    at: [40.7466, -73.8448], depth: "full", template: "unisphere", palette: ["#8FA4B8", "#9ED8F7", "#2F4F6B"], postcard: "postcard-unisphere",
    tags: ["monument", "park"],
    lore: "A twelve-story steel globe from a World's Fair that promised flying cars. The cars never came, but the globe stayed, and so did Walt, who gives tours whether you asked or not.",
    actions: [
      { id: "visit", kind: "visit", label: "Pose with the globe", energy: 5, mood: 6, clout: 20, blurb: "Hold up the world for a photo. Everyone does. Do it anyway." },
      // v0.9 (#32; owner Oct 13): the plaza's activities.
      { id: "tour", kind: "hangout", label: "Take Walt's tour", price: 15, energy: 8, confidence: 5, blurb: "Forty minutes, three World's Fairs, one ex-wife. You'll know things now." },
      { id: "wish", kind: "hangout", label: "Toss a coin in the fountain", price: 1, energy: 0, mood: 4, blurb: "Wish for clout. The fountain has heard it before." },
      { id: "pretzel", kind: "eat", label: "Pretzel from the cart", price: 5, energy: -12, blurb: "Salt crystals the size of dice. Worth every one." },
      { id: "people", kind: "hangout", label: "People-watch on a bench", energy: 3, mood: 6, blurb: "Tourists, joggers, a man walking a cat. Free entertainment." },
    ],
  },
  {
    id: "gantry-plaza", name: "Gantry Plaza", emoji: "🏗️", category: "monument", neighborhood: "Long Island City",
    at: [40.7454, -73.9584], depth: "full", template: "gantries", palette: ["#3A3540", "#F2A900", "#6C8CFF"], postcard: "postcard-gantry-plaza",
    tags: ["monument", "waterfront"],
    lore: "Old rail gantries standing guard over the East River like retired bouncers. The best skyline view in Queens, if you can find a spot between the engagement shoots.",
    actions: [
      { id: "visit", kind: "visit", label: "Catch the skyline at the gantries", energy: 5, mood: 8, clout: 20, blurb: "Golden hour, river breeze, three proposals in progress behind you." },
      // v0.9 (#32; owner Oct 13): the plaza's activities.
      { id: "photoshoot", kind: "hangout", label: "Golden hour photoshoot", energy: 10, confidence: 6, blurb: "Squint at the sun like it owes you money. Inez says that's your angle." },
      { id: "picnic", kind: "eat", label: "Picnic on the lawn", price: 12, energy: -20, blurb: "A blanket, a baguette and a view that costs nothing. The baguette cost something." },
      { id: "ferries", kind: "hangout", label: "Watch the ferries", energy: 2, mood: 7, blurb: "Boats go by. You do nothing. It's the most productive you've felt all week." },
      { id: "run", kind: "hangout", label: "Run the river path", energy: 15, mood: 4, confidence: 5, blurb: "Two miles, one skyline, zero breath left. You look great, though." },
    ],
  },
  {
    id: "low-light-lounge", name: "Low Light Lounge", emoji: "🥃", category: "nightlife", neighborhood: "Astoria",
    at: [40.7612, -73.9175], depth: "full", template: "lounge", palette: ["#B8743A", "#2A1E2E", "#E8C79A"],
    tags: ["lounge", "nightlife", "exclusive_venue"],
    lore: "Velvet booths, jazz on vinyl and a guest list longer than the drinks menu. Celebrities come here to be left alone, loudly.",
    actions: [
      { id: "visit", kind: "visit", label: "Order something brown and expensive", price: 45, energy: 10, mood: 8, confidence: 3, blurb: "Swirl it. Sniff it. Pretend you can taste the oak." },
    ],
  },
  {
    id: "thread-count", name: "Thread Count Boutique", emoji: "👗", category: "shopping", neighborhood: "Astoria",
    at: [40.7651, -73.9204], depth: "full", template: "store", palette: ["#E0457B", "#F4EDE6", "#2A2530"], opensShop: "fashion",
    tags: ["boutique", "shopping", "fashion"],
    lore: "Racks curated by a woman who once styled a backup dancer for a famous person. The mirrors are flattering on purpose, and so is the lighting.",
    actions: [
      { id: "browse", kind: "visit", label: "Try on things you can't afford", energy: 5, mood: 6, blurb: "The fitting room selfie is free. The jacket is not." },
    ],
  },
  {
    id: "boulevard-motors", name: "Boulevard Motors", emoji: "🚘", category: "shopping", neighborhood: "Long Island City",
    at: [40.7503, -73.9372], depth: "scene", palette: ["#D93A2F", "#E6E8EC", "#1F1B26"], opensShop: "cars",
    tags: ["dealership", "shopping", "cars"],
    lore: "Balloons, a man in a shiny suit and cars that are all \"basically new.\" Test drives are free; the handshake will cost you.",
    actions: [
      { id: "browse", kind: "visit", label: "Take a test drive around the block", energy: 5, mood: 5, confidence: 3, blurb: "Windows down, music up, salesman sweating in the passenger seat." },
    ],
  },
  // ---- The parody universities (brought forward from location wave 4): invented campuses, no real names ----
  {
    id: "st-johnsons", name: "St. Johnsons University", emoji: "🎓", category: "campus", neighborhood: "Jamaica",
    at: [40.7224, -73.7949], depth: "full", template: "campus", palette: ["#C8102E", "#F2E6D8", "#1F2A44"],
    tags: ["university", "campus"],
    lore: "Red brick, a chapel nobody can find and a basketball team that matters more than the library. Half the student body is here on a scholarship; the other half is here on a parking permit.",
    actions: [
      { id: "lecture", kind: "visit", label: "Sit in on a lecture", energy: 15, confidence: 6, clout: 15, blurb: "Intro to Marketing. You take notes on the professor's outfit." },
    ],
  },
  {
    id: "queensborough-u", name: "Queensborough University", emoji: "🏛️", category: "campus", neighborhood: "Flushing",
    at: [40.7366, -73.8170], depth: "full", template: "campus", palette: ["#3B6FB6", "#E8E2D0", "#2A2530"],
    tags: ["university", "campus"],
    lore: "A leafy quad, a library open until 2 AM and forty languages overheard on the walk to class. Tuition is reasonable, which here counts as a personality.",
    actions: [
      { id: "lecture", kind: "visit", label: "Catch a lecture in the big hall", energy: 15, confidence: 6, clout: 15, blurb: "Philosophy 101. Someone asks if the professor is real. Fair question." },
    ],
  },  // ---- v0.6: the Astoria neighborhood (docs/08-new-features-spec.md section 5). Invented names. ----
  {
    id: "ditmars-deli", name: "Ditmars Deli & Dreams", emoji: "🥪", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7748, -73.9128], depth: "full", template: "counter", palette: ["#2E9E6A", "#F4E3C8", "#1F1B26"],
    tags: ["bodega", "dining_budget", "astoria"],
    lore: "Open all night, run by a man named Sal and a cat named Also Sal. The chopped cheese has a fan account. Sal does not know about the fan account.",
    actions: [
      { id: "eat", kind: "eat", label: "Chopped cheese at the counter", price: 6, energy: -15, blurb: "Wrapped in foil, handed over with zero eye contact. Perfect." },
    ],
  },
  {
    id: "two-bros-pizza", name: "Two Bros Who Fight Pizza", emoji: "🍕", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7668, -73.9208], depth: "scene", palette: ["#D93A2F", "#FFF1D6", "#2A2530"],
    tags: ["pizza", "dining_budget", "astoria"],
    lore: "Two brothers, one oven and a feud about anchovies that has lasted eleven years. The slices are great. The yelling is free.",
    actions: [
      { id: "eat", kind: "eat", label: "Grab a slice", price: 4, energy: -12, blurb: "Fold it like a local. Burn the roof of your mouth like a local." },
    ],
  },
  {
    id: "neon-spoon", name: "The Neon Spoon", emoji: "🍳", category: "food", neighborhood: "Astoria", tier: "Medium",
    at: [40.7695, -73.9265], depth: "scene", palette: ["#3BB8C9", "#FFE7C2", "#2A2530"],
    tags: ["diner", "dining_medium", "astoria"],
    lore: "A chrome diner with a menu the size of a novel. Breakfast is served all day; regret is served after 2 AM.",
    actions: [
      { id: "eat", kind: "eat", label: "Pancakes in a booth", price: 16, energy: -28, blurb: "The waitress calls you \"hon.\" You've never felt more seen." },
    ],
  },
  {
    id: "up-on-thirty", name: "Up on Thirty", emoji: "🥂", category: "food", neighborhood: "Astoria", tier: "Luxury",
    at: [40.7672, -73.9238], depth: "scene", palette: ["#C9A0FF", "#F4EDE6", "#1F1B26"],
    tags: ["rooftop", "dining_luxury", "astoria"],
    lore: "A rooftop above 30th Avenue with string lights, small plates and big opinions. The view is Manhattan; the vibe is \"I'm not from Manhattan, on purpose.\"",
    actions: [
      { id: "eat", kind: "eat", label: "Small plates, big view", price: 70, energy: -50, blurb: "Order the octopus. Photograph the octopus. Eventually, eat the octopus." },
    ],
  },
  {
    id: "steinway-fresh", name: "Steinway Fresh Mart", emoji: "🛒", category: "food", neighborhood: "Astoria",
    at: [40.7628, -73.9160], depth: "scene", palette: ["#40B589", "#FFF6E0", "#2A2530"],
    tags: ["supermarket", "astoria"],
    lore: "Forty kinds of feta and one working shopping cart. Stock the fridge here and cook at home: cheaper than eating out, and nobody photographs it.",
    actions: [
      { id: "browse", kind: "visit", label: "Wander the aisles", energy: 3, mood: 3, blurb: "You came for nothing and you're leaving with nothing. Growth." },
    ],
  },
  {
    id: "hellgate-hall", name: "Hellgate Hall", emoji: "🎧", category: "nightlife", neighborhood: "Astoria",
    at: [40.7737, -73.9178], depth: "full", template: "club", palette: ["#FF5A36", "#3A1E6B", "#14111A"],
    tags: ["club", "nightlife", "astoria"],
    lore: "An old warehouse by the tracks with a sound system that registers on seismographs. The DJ booth is a converted subway car. Nobody knows how it got inside.",
    actions: [
      { id: "visit", kind: "visit", label: "Dance under the train tracks", price: 50, energy: 15, mood: 6, confidence: 4, blurb: "Every time the N train passes, the whole room cheers." },
    ],
  },
  {
    id: "triborough-works", name: "Triborough Works", emoji: "🏢", category: "places", neighborhood: "Astoria",
    at: [40.7660, -73.9252], depth: "scene", palette: ["#6C8CFF", "#E6E8EC", "#1F1B26"],
    tags: ["office", "coworking", "gigs_board", "astoria"],
    lore: "Coworking for people who are \"between rounds.\" Free kombucha, a ping-pong table nobody uses and a gigs board that actually pays.",
    actions: [
      { id: "gigs", kind: "gigs", label: "Check the gigs board", energy: 0, blurb: "Side gigs pin up here every morning. Some of them are even legal-sounding." },
    ],
  },
  {
    id: "ditmars-library", name: "Ditmars Free Library", emoji: "📚", category: "places", neighborhood: "Astoria",
    at: [40.7735, -73.9098], depth: "scene", palette: ["#B8743A", "#F2E6D8", "#2A2530"],
    tags: ["library", "free", "astoria"],
    lore: "Quiet, free and full of people pretending to read while charging their phones. The librarian has heard every excuse for a late book. Yours isn't new.",
    actions: [
      { id: "study", kind: "visit", label: "Study in the quiet room", energy: 10, confidence: 5, blurb: "Fifty minutes of focus, ten minutes of looking at strangers' book choices." },
    ],
  },
  {
    id: "precinct-114-half", name: "The 114½ Precinct", emoji: "🚓", category: "places", neighborhood: "Astoria",
    at: [40.7690, -73.9228], depth: "scene", palette: ["#2F5FB3", "#E6E8EC", "#14111A"],
    tags: ["police", "free", "astoria"],
    lore: "The neighborhood's busiest desk sergeant has a coffee mug that says \"World's Okayest Cop.\" Most reports here are about parking. All of them are passionate.",
    actions: [
      { id: "report", kind: "visit", label: "Report a \"stolen\" parking spot", energy: 3, mood: 3, blurb: "They write it down. They will not do anything. You feel heard." },
    ],
  },
  {
    id: "engine-7", name: "Engine 7 Firehouse", emoji: "🚒", category: "places", neighborhood: "Astoria",
    at: [40.7720, -73.9205], depth: "scene", palette: ["#D93A2F", "#F4E3C8", "#1F1B26"],
    tags: ["firehouse", "free", "astoria"],
    lore: "Big red doors, bigger hearts and a dalmatian named Hydrant who has never once been on time for anything.",
    actions: [
      { id: "pet-dog", kind: "visit", label: "Pet the firehouse dog", energy: 2, mood: 6, blurb: "Hydrant leans into it. Best part of your week, statistically." },
    ],
  },
  {
    id: "astoria-cc", name: "Astoria Community College", emoji: "🏫", category: "campus", neighborhood: "Astoria",
    at: [40.7600, -73.9232], depth: "scene", palette: ["#2E9E6A", "#E8E2D0", "#2A2530"],
    tags: ["college", "campus", "astoria"],
    lore: "Night classes for people with day jobs and big plans. The parking lot has more ambition per square foot than most startups.",
    actions: [
      { id: "night-class", kind: "visit", label: "Take a night class", price: 20, energy: 15, confidence: 6, clout: 10, blurb: "Public Speaking 101. You speak publicly. Nobody dies." },
    ],
  },
  {
    id: "harmony-chapel", name: "Harmony Community Chapel", emoji: "🕊️", category: "places", neighborhood: "Astoria",
    at: [40.7652, -73.9130], depth: "scene", palette: ["#E8C79A", "#F4EDE6", "#3A2C5E"],
    tags: ["chapel", "quiet", "free", "astoria"],
    lore: "A small, open-door chapel with stained glass and a bulletin board covered in bake sales. Everyone's welcome; the folding chairs are not comfortable.",
    actions: [
      { id: "quiet", kind: "visit", label: "Sit for a quiet moment", energy: 2, mood: 7, blurb: "Ten minutes without your phone. It feels illegal. It's not." },
    ],
  },
  {
    id: "hell-gate-park", name: "Hell Gate Park", emoji: "🌳", category: "parks", neighborhood: "Astoria",
    at: [40.7790, -73.9232], depth: "scene", palette: ["#5CC28F", "#F4E3C8", "#2A2530"],
    tags: ["park", "outdoors", "free", "astoria"],
    lore: "Riverside lawns under a giant bridge, a running track and a public pool with very strong opinions about swim caps.",
    actions: [
      { id: "hangout", kind: "hangout", label: "Hang out by the river", energy: 5, mood: 12, blurb: "Watch the bridge, the joggers and one guy doing tai chi like it's a competition." },
    ],
  },
  {
    id: "rep-count", name: "Rep Count Fitness", emoji: "🏋️", category: "places", neighborhood: "Astoria",
    at: [40.7640, -73.9146], depth: "scene", palette: ["#FF8A3D", "#E6E8EC", "#1F1B26"],
    tags: ["gym", "astoria"],
    lore: "Neon lights, loud music and mirrors on every wall, so you can watch yourself almost do a pull-up. Nobody here is related to any other gym, thank you for asking.",
    actions: [
      { id: "workout", kind: "visit", label: "Work out", price: 12, energy: 20, confidence: 6, mood: 2, blurb: "Leg day. You'll feel it on the stairs to your walk-up." },
    ],
  },
  {
    id: "astoria-blvd-station", name: "Astoria Blvd station", emoji: "🚇", category: "places", neighborhood: "Astoria",
    at: [40.7702, -73.9180], depth: "scene", palette: ["#FFC21A", "#E6E8EC", "#1F1B26"],
    tags: ["subway", "transit", "free", "astoria"],
    lore: "An elevated platform with a view of everyone's laundry. The train is always \"two stops away.\" Pick the subway in \"Go there\" and it gets you anywhere for C$3, eventually.",
    actions: [
      { id: "platform", kind: "visit", label: "People-watch on the platform", energy: 2, mood: 2, blurb: "A man is eating a full rotisserie chicken. Respect." },
    ],
  },
  {
    id: "reel-queens", name: "Reel Queens Cinema", emoji: "🎬", category: "places", neighborhood: "Astoria",
    at: [40.7605, -73.9196], depth: "scene", palette: ["#E0186F", "#FFE7C2", "#14111A"],
    tags: ["cinema", "date_spot", "astoria"],
    lore: "A restored single-screen movie palace with velvet seats and a popcorn machine older than your parents. Perfect for dates; the dark hides nervous faces.",
    actions: [
      { id: "movie", kind: "eat", label: "Movie and popcorn", price: 15, energy: -10, mood: 8, blurb: "Butter on the popcorn, butter on the seat, butter somehow on your phone." },
    ],
  },
  {
    id: "respawn-arena", name: "Respawn Arena", emoji: "🎮", category: "places", neighborhood: "Astoria",
    at: [40.7708, -73.9105], depth: "scene", palette: ["#6B4FD8", "#9FD8C4", "#14111A"],
    tags: ["games", "arena", "astoria"],
    lore: "Rows of glowing rigs, a stage for tournaments and an energy-drink fridge that hums like a jet engine. Arcade Nerds call it home; everyone else calls it loud.",
    actions: [
      { id: "match", kind: "visit", label: "Play a ranked match", price: 10, energy: 15, confidence: 5, clout: 12, blurb: "You lose to a twelve-year-old. You win the rematch. Character arc." },
    ],
  },
  // v0.10 (spec section 7): the lotto shop, outside Astoria on purpose; you travel to play.
  {
    id: "lucky-star", name: "Lucky Star Lotto", emoji: "🌟", category: "places", neighborhood: "Flushing",
    at: [40.7593, -73.8301], depth: "full", template: "lotto", palette: ["#FFD84D", "#FF2E88", "#2A2530"],
    tags: ["lotto", "flushing"],
    lore: "A narrow shop on a loud Flushing corner: a neon star, a rack of scratch cards and Benny, who has never once bought a ticket. Odds are printed on every card, which Benny calls \"the boring part\".",
    actions: [
      { id: "chat", kind: "visit", label: "Shoot the breeze with Benny", energy: 2, mood: 3, blurb: "He tells you his system. The system is not buying tickets." },
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
  { id: "bass-bath", name: "Bass Bath", placeId: "hellgate-hall", startHour: 21, hours: 5, entry: 70, clout: 50, confidence: 7, mood: 7, blurb: "Bass so heavy the train schedule adjusts around it." },
  { id: "golden-hour", name: "Golden Hour Day Party", placeId: "velvet-static", startHour: 15, hours: 4, entry: 50, clout: 40, confidence: 6, mood: 8, blurb: "A day party for people who can't commit to a night." },
  // Campus events at the two universities.
  { id: "homecoming-tailgate", name: "Homecoming Tailgate", placeId: "st-johnsons", startHour: 16, hours: 4, entry: 15, clout: 35, confidence: 4, mood: 10, blurb: "Foam fingers, lukewarm wings and alumni reliving 2009." },
  { id: "quad-open-mic", name: "Open Mic on the Quad", placeId: "queensborough-u", startHour: 19, hours: 3, entry: 10, clout: 30, confidence: 8, mood: 6, blurb: "Slam poetry, one ukulele and a guy who only does impressions of his roommate." },
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
  /**
   * Real-cash collector piece (Clarifications 5 and 6): bought only through Stripe, priced in
   * store_products, never for virtual cash and never sold. Its Net Worth value is
   * collectorValue() and `price` stays 0.
   */
  collector?: boolean;
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
  { sku: "forever-our-bird-hoodie", category: "fashion", name: "\"Forever Our Bird\" hoodie", emoji: "🕊️", price: 85, clout: 12, rating: 2, storyOnly: true, blurb: "Loretta's grief merch, C$85, \"for healing.\" Limited time, unlimited questions.", wear: { slot: "top", kind: "hoodie", color: "#F4F1EA", accent: "#6C8CFF" } },
  { sku: "col-faux-chinchilla", category: "fashion", name: "Faux chinchilla coat", emoji: "🧥", price: 0, clout: 80, rating: 4, collector: true, blurb: "No chinchillas were harmed. Several egos were.", wear: { slot: "top", kind: "blazer", color: "#D9D2C5", accent: "#A89F92" } },
  { sku: "col-holo-boots", category: "fashion", name: "Holographic platform boots", emoji: "👢", price: 0, clout: 70, rating: 4, collector: true, blurb: "Six inches taller and visible from space.", wear: { slot: "shoes", color: "#B8C6FF" } },
  { sku: "fit-bucket-hat", category: "fashion", name: "Bucket hat", emoji: "👒", price: 55, clout: 8, rating: 2, blurb: "Hides bad hair days and good ideas.", wear: { slot: "accessory", kind: "cap", color: "#40B589" } },
  // Cars
  { sku: "car-hatchback", category: "cars", name: "Pre-loved hatchback", emoji: "🚗", price: 14000, clout: 120, rating: 2, rentPerWeek: 350, blurb: "Previously loved. Heavily. It still gets you to the club." },
  { sku: "car-luxury-sedan", category: "cars", name: "Luxury sedan", emoji: "🚘", price: 52000, clout: 300, rating: 4, rentPerWeek: 900, blurb: "Rent this luxury sedan. Might be fake life, but it's oh so worth it when you pull up to the club." },
  { sku: "car-electric-coupe", category: "cars", name: "Electric coupe", emoji: "🏎️", price: 78000, clout: 420, rating: 4, rentPerWeek: 1300, blurb: "Silent, fast and smug. Like a startup founder." },
  // Houses
  { sku: "house-astoria-townhouse", category: "houses", name: "Astoria townhouse", emoji: "🏡", price: 180000, clout: 900, rating: 3, neighborhood: "Astoria", blurb: "A stoop of your own. Neighbors will judge your plants." },
  { sku: "house-lic-penthouse", category: "houses", name: "LIC penthouse", emoji: "🌆", price: 650000, clout: 2400, rating: 4, neighborhood: "Long Island City", blurb: "Floor-to-ceiling windows, so the city can watch you thrive." },
  // Luxury
  { sku: "lux-gold-chain", category: "luxury", name: "Chunky gold-tone chain", emoji: "⛓️", price: 900, clout: 70, rating: 3, blurb: "Not gold. Nobody needs to know." },
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
/** A collector piece's value in Net Worth: 1.5× the priciest virtual-cash item in its category (Clarifications 5). */
export function collectorValue(category: ShopCategory): number {
  return Math.round(1.5 * Math.max(...SHOP_ITEMS.filter((i) => i.category === category && !i.collector).map((i) => i.price)));
}

export function citySeed() {
  return {
    economy: CITY_ECONOMY,
    places: PLACES.map((p) => ({
      id: p.id, tags: p.tags, story: p.story ?? null, at: p.at, area: p.neighborhood,
      actions: p.actions.map((a) => ({
        id: a.id, kind: a.kind, price: a.price ?? 0, pay: a.pay ?? 0, energy: a.energy, mood: a.mood ?? 0, confidence: a.confidence ?? 0,
        clout: a.clout ?? null, storyUnlock: a.storyUnlock ?? false,
      })),
    })),
    events: CLUB_EVENTS.map((e) => ({ id: e.id, placeId: e.placeId, startHour: e.startHour, hours: e.hours, entry: e.entry, clout: e.clout, confidence: e.confidence, mood: e.mood })),
    gigs: Object.fromEntries(Object.entries(GIG_TITLES).map(([tier, list]) => [tier, list.map((g) => g.title)])),
    shop: SHOP_ITEMS.map((i) => ({
      sku: i.sku, category: i.category, price: i.price, clout: i.clout, rentPerWeek: i.rentPerWeek ?? 0, slot: i.wear?.slot ?? null,
      storyOnly: i.storyOnly ?? false, collector: i.collector ?? false,
    })),
    homeLocations: HOME_LOCATIONS,
  };
}
