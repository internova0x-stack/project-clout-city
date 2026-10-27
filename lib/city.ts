// v0.3 "The City": places and their actions, jobs, club events, gigs, daily
// tasks, the Shop catalog and bills (Clarifications sections 3 to 6 and 13).
// This file is the single source for the content. scripts/gen-city-seed.ts writes
// the same data into the database seed (game_settings 'city'), which the server
// functions use to validate every price and reward; tests/city.test.ts checks
// the two still match. Dependency-free so tests can import it.

import type { LatLng } from "./map/geo";
import { RANKS } from "./ranks.ts";
import type { SkillId } from "./skills.ts";
import type { BoroughId } from "./map/boroughs";
import { ECONOMY } from "./economy.ts";

// ---------------------------------------------------------------------------
// Economy numbers (all tunable; gig pay is a multiple of the shift rate)
// ---------------------------------------------------------------------------
export const CITY_ECONOMY = {
  shiftRate: 120,
  /** v0.11 (owner, Oct 14): prices went up about 2.3 times, so clout per dollar came down to match. */
  cloutPerDollar: 0.25,
  baseVisitClout: 5,
  /** Mood and Confidence scale clout: 0.7 + 0.3·mood/100 + 0.3·confidence/100. */
  cloutMultiplier: { base: 0.7, mood: 0.3, confidence: 0.3 },
  energy: { dailyTopUp: 20, eventCost: 20 },
  confidenceDriftPerDay: 3,
  /**
   * C3 (owner, Oct 20): a player's first day of tasks starts with `firstDay` (a BEC at Sal's, pet the cat, a lap in
   * the park); the rest of the five are picked as usual (migration 0094's ensure_daily).
   */
  dailyTasks: {
    count: 5, rewardMin: 25, rewardMax: 50, bonus: 100,
    firstDay: [{ place: "ditmars-deli", action: "bec" }, { place: "ditmars-deli", action: "pet-cat" }, { place: "hell-gate-park", action: "lap" }],
  },
  sellRate: 0.6,
  /** Each purchase's clout is this fraction of the previous one's (diminishing returns). */
  purchaseCloutDecay: 0.85,
  /**
   * Everything bills weekly (v0.8, #23; owner Oct 13): rent, the phone bill, car insurance and car
   * rentals, every 7 days from the day they start. Insurance is a share of the car's price per week.
   * Missed rent: 2 days' grace, then Mood drops daily, then a move to the cheapest home after 6 days
   * (before the next week's rent arrives).
   */
  bills: { every: "7 days", carRentalDays: 7, phone: 60, graceDays: 2, moodDropPerDay: 8, evictAfterDays: 6, carInsuranceRate: 0.005 },
  gigs: {
    // Pay is a multiple of shiftRate. v0.11 recalibration (owner, Oct 14): a side gig is a good day's
    // extra, a pro gig about a third of a week in the studio, a big break about half a week in the 1BR.
    // Clout (v0.7, owner Oct 13): pro gigs and big breaks also need a reputation, not just a good mood.
    side: { confidence: 0, clout: 0, chance: 0.9, payMin: 2, payMax: 3, energy: 1.5, waitMinutes: 60 },
    pro: { confidence: 50, clout: 500, chance: 0.5, payMin: 5, payMax: 6, energy: 2, waitMinutes: 120 },
    big: { confidence: 80, clout: 2000, chance: 0.22, payMin: 10, payMax: 12, energy: 3, waitMinutes: 240 },
  },
  shiftEnergy: 25,
  /**
   * v0.11 recalibration (owner, Oct 14): a work day is at most this many shifts, across every job.
   * Without it, cheap groceries turned Energy into unlimited shifts and money stopped mattering.
   */
  shiftsPerDay: 3,
  /**
   * Rest at home and drinks at venues (v0.8, #3, #26, #27; owner Oct 13). Caps keep meals the main
   * source of Energy: a nap is +30 twice a day (an 8-second nap on the player's own timer), sitting
   * +10 Energy and +6 Mood three times a day; both only at home. A drink at a club or lounge bar is
   * the pricey, convenient option: C$60 for +20 Energy, no clout, no cap.
   */
  rest: {
    nap: { energy: 30, mood: 0, perDay: 2, seconds: 8 },
    sit: { energy: 10, mood: 6, perDay: 3, seconds: 4 },
  },
  barDrink: { price: 60, energy: 20, tags: ["club", "lounge"] },
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
      { id: "snack-run", emoji: "🥪", label: "Snack run", price: 28, meals: 2, blurb: "Chips, hummus, one sad apple. Technically two meals." },
      { id: "meal-prep", emoji: "🥦", label: "Meal prep for the week", price: 95, meals: 7, blurb: "Seven containers, one Sunday, infinite smugness." },
    ],
  },
  /**
   * Travel (v0.8, #4; owner Oct 13): no spending before arriving. Price and Energy come from four
   * distance bands (under 0.5 mi, 0.5 to 2, 2 to 5, over 5), not routes. Walking is free but tiring
   * and isn't offered past 5 miles; the subway is a flat fare; your own car costs nothing to drive.
   * Trips take real time on the player's own timer (see `time`); skipping costs a little cash.
   */
  travel: {
    bandsMiles: [0.5, 2, 5],
    walk: { energy: [5, 10, 20, null] },
    /**
     * Culture pack C4 (owner, Oct 20). Each neighborhood's train line (a trip rides the line of where it's going);
     * the OMG Card's unlimited passes (bought on the Travel screen, not possessions: no Net Worth, no resale; rides
     * are free while one lasts); and showtime dancers, about one subway trip in ten, +3 clout once a New York day.
     * A transit delay posted in News adds its seconds to that line's trips while it lasts (migration 0095).
     */
    subway: {
      fare: 6,
      lines: { Astoria: "N/W", "Long Island City": "N/W", Flushing: "7", "Flushing Meadows": "7", "Jackson Heights": "7", Sunnyside: "7", Jamaica: "E" } as Record<string, string>,
      passes: [
        { id: "week", label: "OMG Card · 7-day unlimited", days: 7, price: 70 },
        { id: "month", label: "OMG Card · 30-day unlimited", days: 30, price: 250 },
      ],
      showtime: { chance: 0.1, clout: 3 },
    },
    /** C4: the green cab (the "taxi" id stays) and a rideshare, a little faster and pricier. */
    taxi: { fare: [18, 35, 60, 95] },
    rideshare: { fare: [25, 49, 84, 133] },
    /**
     * #13 (owner, Oct 14): trips take 0 to 60 real seconds by distance: base + perMile × miles, capped.
     * Taxis are quickest for short hops; the subway wins on long ones (traffic). The server sets the
     * arrival time (players.arrives_at); nothing at the destination works before it.
     */
    time: {
      walk: { base: 6, perMile: 20, max: 60 },
      subway: { base: 12, perMile: 6, max: 45 },
      taxi: { base: 5, perMile: 9, max: 60 },
      rideshare: { base: 4, perMile: 7, max: 50 },
      car: { base: 5, perMile: 8, max: 55 },
    },
    /** Skipping the rest of a trip costs C$1 per `secondsPerCash` seconds left, at least `min`. */
    skip: { secondsPerCash: 2, min: 5 },
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
   * and 10% of every bought card feeds that game's pot, so the lotto takes out more C$ than it pays.
   * A prize of 100 times the card or more is a big prize (about 1 card in 4,760). One free card a day
   * (always the C$5 game), a second one through a player's first 7 days, and 5 bought cards a day across
   * all games; all reset at midnight in New York. The server draws every result when the card is bought
   * (migration 0032), and real money never touches any of it.
   *
   * v0.11 pots (owner, Oct 14; migration 0041; they replace the weekly jackpot draw): every game has a
   * lucky number (1 to luckyMax) and a pot. A card shows `cells` of the player's numbers, each with a
   * prize; a number that matches the lucky number pays its prize at once, and a ⭐ wins the pot. The
   * small games get a new number and a fresh pot every midnight ("day"), the big ones every Monday
   * ("week"). Pots start at `seed` and are won 1 card in `oneIn`, harder for every game; after a win
   * the pot starts again from its seed. The prize table stays the same for every game.
   */
  /**
   * Neighborhood gossip (v0.10, spec section 8; owner Oct 13). 3 to 5 stories a week of exactly five
   * pieces; finishing one pays a little clout and Mood (once, ledger 'gossip'), and five finished earn
   * a badge. Stories stay findable for two weeks from their Monday; finished Tea cards are kept.
   * v0.11 (owner, Oct 14): stories are a trail (each piece found names where the next one is) and
   * tasksPerDay of the five daily tasks send the player to their next piece. Owner, Oct 14: those pay
   * taskClout clout, not cash ("why reward cash for information?"; migration 0042). Daily tasks 2.0 (owner, Oct 18;
   * migration 0073): one gossip task a day, to make room for two goal-linked tasks.
   */
  gossip: {
    pieces: 5, storiesPerWeek: { min: 3, max: 5 }, liveDays: 14, clout: 25, mood: 6, badgeAfter: 5, tasksPerDay: 1, taskClout: 15,
    /** #19 clubs (owner, Oct 14: "juicier gossip in the restroom"): a restroom piece pays a story's clout and Mood again, on the spot. */
    restroom: { clout: 25, mood: 6 },
  },
  /**
   * #19 clubs (owner, Oct 14). Every club and the lounge has a restroom floor downstairs. Medium and
   * exclusive clubs have a VIP floor upstairs: free from freeClout, otherwise a cover for the New York
   * day. "Get seen in VIP" pays vipTimes the clout of getting seen downstairs (once a day per club).
   * The server checks all of it (migration 0046).
   */
  clubs: {
    vip: { medium: { freeClout: 5000, cover: 1500 }, exclusive: { freeClout: 15000, cover: 5000 } },
    vipTimes: 2,
  },
  lotto: {
    tags: ["lotto"],
    freeGame: "corner-store",
    freePerDay: 1,
    beginner: { days: 7, extraPerDay: 1 },
    buyPerDay: 5,
    potCut: 0.1,
    luckyMax: 40,
    cells: 6,
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
      { id: "corner-store", name: "Corner Store Classic", price: 5, color: "#40B589", period: "day", pot: { seed: 5000, oneIn: 5000 }, blurb: "The one your uncle buys with exact change." },
      { id: "bodega-cat", name: "Bodega Cat Bonanza", price: 10, color: "#3E8EDE", period: "day", pot: { seed: 10000, oneIn: 10000 }, blurb: "The cat picked the numbers. The cat has never been wrong." },
      { id: "rents-due", name: "Rent's Due", price: 20, color: "#FF2E88", period: "day", pot: { seed: 15000, oneIn: 20000 }, blurb: "Financial planning, but make it shiny." },
      { id: "penthouse-dreams", name: "Penthouse Dreams", price: 50, color: "#7A4FD6", period: "week", pot: { seed: 50000, oneIn: 50000 }, blurb: "Scratch here to see the view. The view is the counter." },
      { id: "main-character", name: "Main Character", price: 100, color: "#2A2530", period: "week", pot: { seed: 100000, oneIn: 100000 }, blurb: "For people who are sure the plot is about them." },
    ],
  },
  /**
   * v0.12 businesses (owner, Oct 15; docs/08 section 15): buy them in order, upgrade each three times,
   * collect the till. Pay accrues by the hour and stops after tillDays. Worth = price × (1 + value per
   * upgrade) × hype, hype rising with clout to `hype.max` at `hype.clout`. Going public (the last business,
   * fully upgraded) multiplies its worth. Tuned so a steady player reaches C$1B in about 9 months
   * (tests/businesses.test.ts simulates it). The server reads all of this; the browser never sends amounts.
   */
  businesses: {
    tillDays: 2,
    upgrade: { cost: 0.6, pay: 0.5, value: 0.5 },
    hype: { clout: 150000, max: 2 },
    goPublic: { clout: 50000, fee: 50_000_000, times: 3 },
    list: [
      { id: "hot-dog-cart", name: "Dirty Water Dogs", emoji: "🌭", price: 5_000, payPerDay: 750,
        blurb: "One cart, one umbrella, a hot dog water recipe older than the city.",
        upgrades: [
          { name: "Second umbrella", emoji: "⛱️", blurb: "Twice the shade, twice the line." },
          { name: "Secret menu", emoji: "🤫", blurb: "It's the same hot dog. It costs more now." },
          { name: "Influencer collab", emoji: "🤳", blurb: "A creator ate one on camera. The line goes around the block." },
        ] },
      { id: "bodega", name: "Bodega, Cat Included", emoji: "🐈", price: 50_000, payPerDay: 6_000,
        blurb: "Open 24 hours. The cat runs it; you just own it.",
        upgrades: [
          { name: "Hot food counter", emoji: "🥪", blurb: "Chopped cheese, all day, every day." },
          { name: "Lotto machine", emoji: "🎟️", blurb: "Everybody's uncle comes in now." },
          { name: "The cat gets an agent", emoji: "😼", blurb: "Brand deals. The cat negotiates better than you." },
        ] },
      { id: "laundromat", name: "Spin Cycle Laundromat", emoji: "🧺", price: 250_000, payPerDay: 22_500,
        blurb: "Twenty machines, three of them work. The quarters add up.",
        upgrades: [
          { name: "Free Wi-Fi", emoji: "📶", blurb: "People stay. People buy snacks." },
          { name: "Wash and fold", emoji: "👕", blurb: "You fold strangers' socks for money. Lucrative." },
          { name: "Laundromat by night", emoji: "🎧", blurb: "A DJ on Fridays. It's a scene now." },
        ] },
      { id: "cafe", name: "Oat Milk Surcharge Café", emoji: "☕", price: 1_200_000, payPerDay: 81_600,
        blurb: "Seven kinds of milk, none of them from a cow. The Wi-Fi password is \"buyanothercoffee\".",
        upgrades: [
          { name: "Latte art", emoji: "🎨", blurb: "Every cup a portrait of the customer. Mostly." },
          { name: "Laptop ban (for vibes)", emoji: "💻", blurb: "Fewer screenwriters, more turnover." },
          { name: "Second location", emoji: "📍", blurb: "Same café, different neighborhood, same oat milk." },
        ] },
      { id: "taco-trucks", name: "Taco Truck Fleet", emoji: "🌮", price: 6_000_000, payPerDay: 300_000,
        blurb: "Five trucks, one group chat, zero parking tickets paid.",
        upgrades: [
          { name: "Late-night route", emoji: "🌙", blurb: "Outside every club at 2 a.m." },
          { name: "Festival permits", emoji: "🎪", blurb: "Every street fair in Queens." },
          { name: "A truck in every borough", emoji: "🗽", blurb: "Even Staten Island. Especially Staten Island." },
        ] },
      { id: "nightclub", name: "Your Own Nightclub", emoji: "🪩", price: 30_000_000, payPerDay: 1_080_000,
        blurb: "Your name on the door. The bouncer still doesn't respect you.",
        upgrades: [
          { name: "VIP floor", emoji: "🥂", blurb: "Upstairs, where the expensive bottles live." },
          { name: "Celebrity DJ residency", emoji: "🎛️", blurb: "Every Saturday, a famous person presses play." },
          { name: "A gold-plated velvet rope", emoji: "✨", blurb: "Completely unnecessary. Wildly profitable." },
        ] },
      { id: "apartment-building", name: "Luxury* Apartment Building", emoji: "🏢", price: 150_000_000, payPerDay: 3_900_000,
        blurb: "*Exposed brick. Forty units, one elevator, rent that should be illegal.",
        upgrades: [
          { name: "Rooftop amenity", emoji: "🌇", blurb: "Two lounge chairs and a view. Rent goes up 30%." },
          { name: "Doorman with opinions", emoji: "🧑‍✈️", blurb: "He judges every delivery. Tenants love it." },
          { name: "Condo conversion", emoji: "🔑", blurb: "Same units, now for sale, at three times the price." },
        ] },
      { id: "startup", name: "Disruptive App Startup", emoji: "📱", price: 700_000_000, payPerDay: 12_600_000,
        blurb: "It's an app for apps. Investors are thrilled.",
        upgrades: [
          { name: "Pivot to AI", emoji: "🤖", blurb: "Same app, new deck, valuation doubles." },
          { name: "Celebrity board member", emoji: "🌟", blurb: "They don't know what the app does. Nobody does." },
          { name: "Ring the bell", emoji: "🔔", blurb: "Ready to go public." },
        ] },
    ],
  },
  /**
   * v0.13 "Better Together" (owner, Oct 15; docs/08 section 16). Together bonuses: invite one person
   * (crew, or anyone at the place now) to do an activity with you; when both do it within windowMinutes,
   * each gets `multiplier` × its confidence and clout, at most perDay a day. Accounts younger than
   * minAccountDays can't invite, ride or take jobs (throwaway accounts farm nothing).
   */
  together: {
    multiplier: 1.5,
    windowMinutes: 10,
    perDay: 5,
    minAccountDays: 2,
    tags: ["library", "university", "club", "nightlife"],
    /** Ride together: both at the same place, split the fare, arrive together. */
    ride: { modes: ["subway", "taxi"], expireMinutes: 3 },
  },
  /** The Jobs app: hire a real player. Decorator pay is held by the city until the poster approves. */
  jobs: {
    perPairPerDay: 1,
    decorator: { payMin: 200, payMax: 20_000, payChoices: [500, 1_000, 2_500, 5_000], minutes: 30, clout: 25, autoKeepHours: 24 },
    manager: { cutMin: 5, cutMax: 20, cutChoices: [5, 10, 15, 20] },
  },
  /** Player ranks (lib/ranks.ts): each rank's clout and net worth, so the server can name ranks too. */
  ranks: RANKS.map((r) => ({ clout: r.clout, netWorth: r.netWorth })),
} as const;

// ---------------------------------------------------------------------------
// Places (location wave 1: Milestones v0.3)
// ---------------------------------------------------------------------------
export type InteriorTemplate = "apartment" | "club" | "cafe" | "counter" | "lounge" | "store" | "showroom" | "campus" | "unisphere" | "gantries" | "lotto" | "office" | "civic" | "gym" | "plaza" | "radio" | "broadcast" | "hub";
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
  /** Migration 0064: the skill this action trains, over the place's own (Sip & Spill's speed-meets and Tea Bar). */
  skill?: SkillId;
  /** C3: the daily task's own title when this action is picked ("Get a BEC at Sal's"), instead of the generic one. */
  task?: string;
}

export interface Place {
  id: string;
  /** Owner, Oct 17: the borough it's in (Queens when unset). Places in a locked borough show locked. */
  borough?: BoroughId;
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
  /**
   * #19 clubs (owner, Oct 14): a club or lounge with a restroom floor downstairs; `vip` adds a VIP floor
   * upstairs (CITY_ECONOMY.clubs.vip); `doorClout` is the clout the bouncer wants to let you in at all.
   */
  club?: { vip?: "medium" | "exclusive"; doorClout?: number };
  /**
   * Culture pack C2 (owner, Oct 20): opening hours on the city clock, whole hours 0 to 23. `close` before `open`
   * runs past midnight. Unset means always open (every place before C2, and Sal's, open all night).
   */
  hours?: { open: number; close: number };
}

export const PLACES: Place[] = [
  {
    id: "velvet-static", name: "Velvet Static", emoji: "🍸", category: "nightlife", neighborhood: "Long Island City",
    at: [40.7465, -73.9455], depth: "full", template: "club", palette: ["#FF2E88", "#6B2BD9", "#14111A"],
    tags: ["club", "nightlife", "first_party_venue"], club: { vip: "medium" },
    lore: "A warehouse where the bass is louder than your thoughts, babe. That bouncer has turned away three influencers and one actual prince. You got in once. Act like it was nothing.",
    actions: [
      { id: "visit", kind: "visit", label: "Get seen on the dance floor", price: 140, energy: 15, mood: 6, confidence: 4, blurb: "Fake it till you make it: pay the bar man to let you in." },
    ],
  },
  {
    id: "grind-and-gossip", name: "Grind & Gossip Café", emoji: "☕", category: "food", neighborhood: "Astoria", tier: "Medium",
    at: [40.7645, -73.9225], depth: "full", template: "cafe", palette: ["#C27C4E", "#F4E3C8", "#3A2A20"],
    tags: ["cafe", "dining_medium", "job_barista"],
    lore: "Oat-milk lattes and unverified rumors, both served hot. Jojo knows everyone's business and spells every name wrong on purpose. My kind of barista.",
    actions: [
      { id: "eat", kind: "eat", label: "Brunch and eavesdrop", price: 42, energy: -30, blurb: "Avocado toast that costs more than your phone bill's feelings." },
      { id: "shift", kind: "shift", label: "Work a barista shift", pay: 120, energy: 25, blurb: "Pull shots, take orders, absorb gossip. Paid in cash and secrets." },
    ],
  },
  {
    // Owner, Oct 16: the old Lucky Seven Deli became a speed-meet mixer and the city's gossip center. Same id,
    // so history stays; its actions train Aura (speed-meets) and Gossip (the Tea Bar).
    id: "lucky-seven-deli", name: "Sip & Spill", emoji: "🫖", category: "places", neighborhood: "Jackson Heights", tier: "Budget",
    at: [40.7495, -73.8885], depth: "full", template: "lounge", palette: ["#FF6A5C", "#2FB5A8", "#1F1B26"],
    tags: ["mixer", "social", "tea", "dining_budget"],
    lore: "The old Lucky Seven Deli got a glow-up, babe: seven-minute speed-meets up front, the Tea Bar in the back, and the cat stayed on as head of security. Every rumor in Queens passes through here eventually. I'd know. I usually started it.",
    actions: [
      { id: "speed-meet", kind: "visit", label: "Speed-meet", price: 25, energy: 12, mood: 5, confidence: 6, skill: "charisma", blurb: "Seven minutes a table, seven tables a round. Somebody always says they're \"in crypto.\"" },
      { id: "spill", kind: "visit", label: "Spill the tea", price: 12, energy: 6, mood: 6, skill: "gossip", blurb: "Pull up a stool at the Tea Bar. Pour a cup, pour your heart out, pour someone else's." },
      { id: "eat", kind: "eat", label: "Grab the bar bites", price: 16, energy: -15, blurb: "Sliders, fries and the chopped cheese, still on the menu by popular demand. The cat insisted." },
    ],
  },
  {
    id: "altitude-718", borough: "brooklyn", name: "Altitude 718 Rooftop", emoji: "🍽️", category: "food", neighborhood: "Williamsburg", tier: "Luxury",
    at: [40.7112, -73.965], depth: "scene", template: "lounge", palette: ["#F2A900", "#1B2A4A", "#E8D7B0"],
    tags: ["rooftop", "dining_luxury"],
    lore: "Forty floors up, where the skyline does the talking. Nobody comes for the food, but the food is incredible, which is suspicious. I'm looking into it.",
    actions: [
      { id: "eat", kind: "eat", label: "Dine with a view", price: 210, energy: -55, blurb: "Small plates, big prices, bigger photos. Being seen here is the point." },
    ],
  },
  {
    id: "flushing-meadows", name: "Flushing Meadows Corona Park", emoji: "🌳", category: "parks", neighborhood: "Flushing Meadows",
    at: [40.7420, -73.8440], depth: "scene", template: "plaza", palette: ["#40B589", "#9ED8F7", "#2F6B4F"],
    tags: ["park", "outdoors"],
    lore: "Fountains, a giant steel globe and joggers judging your form. Fresh air, free of charge, which in this city is basically a scam. Breathe it in, babe.",
    actions: [
      { id: "hangout", kind: "hangout", label: "Hang out by the fountains", energy: 5, mood: 12, blurb: "Touch grass. Literally. Your mood will thank you." },
    ],
  },
  {
    id: "pedal-pushers", borough: "brooklyn", name: "Pedal Pushers Hub", emoji: "🚲", category: "places", neighborhood: "Williamsburg",
    at: [40.715, -73.952], depth: "scene", template: "office", palette: ["#6C8CFF", "#FFC21A", "#1F1B26"],
    tags: ["delivery_hub", "job_delivery"],
    lore: "Bikes, batteries and the eternal hum of someone's order running late. The dispatcher calls everyone \"champ\" and means it. Rare, in this town.",
    actions: [
      { id: "shift", kind: "shift", label: "Ride a delivery shift", pay: 135, energy: 30, blurb: "Four flights of stairs, no elevator, tip: a thumbs up." },
    ],
  },
  {
    id: "skybridge-tower", borough: "brooklyn", name: "Skybridge Tower", emoji: "🏢", category: "places", neighborhood: "Williamsburg",
    at: [40.7188, -73.9622], depth: "scene", template: "office", palette: ["#6C8CFF", "#D6CFC4", "#14111A"],
    tags: ["office", "gigs_board"],
    lore: "Glass, steel and a lobby that smells like ambition and burnt coffee. The gigs board is where careers start, or at least side hustles. I've seen both.",
    actions: [
      { id: "gigs", kind: "gigs", label: "Check the gigs board", energy: 0, blurb: "Bigger pay than a shift. Bigger egos too." },
    ],
  },
  // ---- Location wave 2 (Milestones v0.4): "Who Killed Sarah Bird?" story places, scene cards only ----
  {
    id: "skyline-pier", name: "Skyline Pier Residences", emoji: "🏙️", category: "places", neighborhood: "Long Island City", story: "sarah-bird",
    at: [40.7478, -73.9592], depth: "scene", template: "civic", palette: ["#9DB2FF", "#E8E2EE", "#2A2350"],
    tags: ["skyline_pier", "residential", "waterfront"],
    lore: "Glass, a concierge and a lobby that smells like eucalyptus and old money pretending to be new. Ray has worked that front desk for twenty years and writes everything down in a little paper book. Everything, darling.",
    actions: [
      { id: "lobby", kind: "visit", label: "Stop by the lobby", price: 0, energy: 5, blurb: "Ray nods. Ray writes something down." },
      { id: "memorial", kind: "visit", label: "Leave flowers at the memorial wall", price: 0, energy: 2, clout: 10, mood: 4, storyUnlock: true, blurb: "White roses, handwritten notes and a lot of quiet. Rest easy, Glass Bird." },
    ],
  },
  {
    id: "hunters-pier", name: "Hunter's Pier", emoji: "🌊", category: "parks", neighborhood: "Long Island City", story: "sarah-bird",
    at: [40.7432, -73.9612], depth: "scene", template: "plaza", palette: ["#7FB3E8", "#F6C9A0", "#2F6B5F"],
    tags: ["hunters_pier", "waterfront", "park"],
    lore: "The best skyline view in Queens and the worst seagulls in the five boroughs. Joggers, first dates and one man with a saxophone, every single night. I've got notes on all of them.",
    actions: [
      { id: "hangout", kind: "hangout", label: "Watch the skyline", energy: 5, mood: 8, blurb: "The city looks better from over here. Most things do." },
    ],
  },
  {
    id: "rockaway-diner", name: "Rockaway Diner", emoji: "🥞", category: "food", neighborhood: "Astoria", tier: "Budget", story: "sarah-bird",
    at: [40.7712, -73.9158], depth: "scene", template: "cafe", palette: ["#E5484D", "#F4E3C8", "#2A2530"],
    tags: ["rockaway_diner", "diner", "dining_budget"],
    lore: "Vinyl booths, a pie case that rotates like it's auditioning and coffee nobody has ever called artisanal. The waitresses call everyone \"hon\" and mean it. They also hear everything.",
    actions: [
      { id: "eat", kind: "eat", label: "Grab a booth and a stack", price: 32, energy: -25, blurb: "Pancakes the size of hubcaps. The syrup is self-serve and so is the gossip." },
    ],
  },
  {
    id: "radiant-harbor", name: "Radiant Harbor Church", emoji: "⛪", category: "places", neighborhood: "Astoria", story: "sarah-bird",
    at: [40.7738, -73.9296], depth: "scene", template: "civic", palette: ["#F2C46B", "#F4E3C8", "#3A2C5E"],
    tags: ["radiant_harbor", "church"],
    lore: "A warm congregation, a gorgeous choir and a building-fund thermometer stuck at 90% for three years. The pastor hosts a podcast. Of course he does, babe.",
    actions: [
      { id: "visit", kind: "visit", label: "Sit in on a service", price: 0, energy: 5, mood: 5, blurb: "The choir is genuinely incredible. The coffee after is genuinely not." },
    ],
  },
  {
    id: "pressed-iron-gym", borough: "brooklyn", name: "Pressed Iron Gym", emoji: "🏋️", category: "places", neighborhood: "East Williamsburg",
    at: [40.7105, -73.9392], depth: "scene", template: "gym", palette: ["#6C8CFF", "#C7CCD4", "#1F1B26"],
    tags: ["pressed_iron", "gym"],
    lore: "Chalk dust, mirrors and men who grunt in full sentences. The front desk keeps very good membership records, which some people find inconvenient. Noted.",
    actions: [
      { id: "workout", kind: "visit", label: "Buy a day pass and lift", price: 35, energy: 20, confidence: 6, mood: 3, blurb: "You lifted. You were seen lifting. Both count." },
    ],
  },
  // ---- Location wave 3 (Milestones v0.5): two monuments, a lounge, the boutique and the dealership ----
  {
    id: "unisphere", name: "The Unisphere", emoji: "🌐", category: "monument", neighborhood: "Flushing Meadows",
    at: [40.7466, -73.8448], depth: "full", template: "unisphere", palette: ["#8FA4B8", "#9ED8F7", "#2F4F6B"], postcard: "postcard-unisphere",
    tags: ["monument", "park"],
    lore: "A twelve-story steel globe from a World's Fair that promised flying cars. The cars never came; the globe stayed, and so did Walt, who gives tours whether you asked or not. Tip him. He talks to me.",
    actions: [
      { id: "visit", kind: "visit", label: "Pose with the globe", energy: 5, mood: 6, clout: 20, blurb: "Hold up the world for a photo. Everyone does. Do it anyway." },
      // v0.9 (#32; owner Oct 13): the plaza's activities.
      { id: "tour", kind: "hangout", label: "Take Walt's tour", price: 35, energy: 8, confidence: 5, blurb: "Forty minutes, three World's Fairs, one ex-wife. You'll know things now." },
      { id: "wish", kind: "hangout", label: "Toss a coin in the fountain", price: 2, energy: 0, mood: 4, blurb: "Wish for clout. The fountain has heard it before." },
      { id: "pretzel", kind: "eat", label: "Pretzel from the cart", price: 12, energy: -12, blurb: "Salt crystals the size of dice. Worth every one." },
      { id: "people", kind: "hangout", label: "People-watch on a bench", energy: 3, mood: 6, blurb: "Tourists, joggers, a man walking a cat. Free entertainment." },
    ],
  },
  {
    id: "gantry-plaza", name: "Gantry Plaza", emoji: "🏗️", category: "monument", neighborhood: "Long Island City",
    at: [40.7454, -73.9584], depth: "full", template: "gantries", palette: ["#3A3540", "#F2A900", "#6C8CFF"], postcard: "postcard-gantry-plaza",
    tags: ["monument", "waterfront"],
    lore: "Old rail gantries guarding the East River like retired bouncers. Best skyline in Queens, if you can find a spot between the engagement shoots. Inez shoots half of them. She tells me who's lying.",
    actions: [
      { id: "visit", kind: "visit", label: "Catch the skyline at the gantries", energy: 5, mood: 8, clout: 20, blurb: "Golden hour, river breeze, three proposals in progress behind you." },
      // v0.9 (#32; owner Oct 13): the plaza's activities.
      { id: "photoshoot", kind: "hangout", label: "Golden hour photoshoot", energy: 10, confidence: 6, blurb: "Squint at the sun like it owes you money. Inez says that's your angle." },
      { id: "picnic", kind: "eat", label: "Picnic on the lawn", price: 28, energy: -20, blurb: "A blanket, a baguette and a view that costs nothing. The baguette cost something." },
      { id: "ferries", kind: "hangout", label: "Watch the ferries", energy: 2, mood: 7, blurb: "Boats go by. You do nothing. It's the most productive you've felt all week." },
      { id: "run", kind: "hangout", label: "Run the river path", energy: 15, mood: 4, confidence: 5, blurb: "Two miles, one skyline, zero breath left. You look great, though." },
    ],
  },
  {
    // Owner, Oct 17: Queens gets a hospital, a city utility.
    id: "st-copays", name: "St. Copay's General Hospital", emoji: "🏥", category: "places", neighborhood: "Astoria",
    at: [40.7651, -73.9204], depth: "scene", template: "civic", palette: ["#5FB3D9", "#F4F7FA", "#1E3A5F"],
    tags: ["hospital", "civic", "astoria"],
    lore: "Clean sheets, long waits and a vending machine that's seen things. Sickness doesn't care about your follower count, babe. Neither does the copay.",
    actions: [
      { id: "checkup", kind: "visit", label: "Get a check-up", price: 60, energy: -30, mood: 6, blurb: "Say ahh. Pay the copay. Walk out feeling like a new person, or at least a rested one." },
      { id: "volunteer", kind: "visit", label: "Volunteer a shift", energy: 15, mood: 5, confidence: 4, clout: 12, skill: "charisma", blurb: "Hand out juice boxes, hold a hand, charm a grumpy nurse. No pay, all heart." },
    ],
  },
  {
    // Owner, Oct 17: Brooklyn's music spot (Low Light Lounge stays in Queens).
    id: "brownstone-sessions", borough: "brooklyn", name: "Brownstone Sessions", emoji: "🎷", category: "nightlife", neighborhood: "Williamsburg",
    at: [40.7128, -73.944], depth: "full", template: "lounge", palette: ["#C8553D", "#2B1D1A", "#F2C57C"],
    tags: ["lounge", "nightlife", "music_venue"],
    lore: "A brownstone basement with a baby grand, forty folding chairs and the best horn section in Brooklyn. Half the room is a scout, the other half thinks they are. Sit close, babe.",
    actions: [
      { id: "set", kind: "visit", label: "Catch a set", price: 35, energy: 8, mood: 8, blurb: "Snap, don't clap. The trumpet player just looked right at you." },
      { id: "open-mic", kind: "visit", label: "Take the open mic", energy: 18, mood: 3, confidence: 8, clout: 15, blurb: "Two minutes, one spotlight, forty strangers. Breathe from the diaphragm." },
    ],
  },
  {
    id: "low-light-lounge", name: "Low Light Lounge", emoji: "🥃", category: "nightlife", neighborhood: "Astoria",
    at: [40.7612, -73.9175], depth: "full", template: "lounge", palette: ["#B8743A", "#2A1E2E", "#E8C79A"],
    tags: ["lounge", "nightlife", "exclusive_venue"], club: {},
    lore: "Velvet booths, jazz on vinyl and a guest list longer than the drinks menu. Celebrities come here to be left alone, loudly. I sit two booths over.",
    actions: [
      { id: "visit", kind: "visit", label: "Order something brown and expensive", price: 105, energy: 10, mood: 8, confidence: 3, blurb: "Swirl it. Sniff it. Pretend you can taste the oak." },
    ],
  },
  {
    id: "thread-count", borough: "brooklyn", name: "Thread Count Boutique", emoji: "👗", category: "shopping", neighborhood: "Williamsburg",
    at: [40.7172, -73.957], depth: "full", template: "store", palette: ["#E0457B", "#F4EDE6", "#2A2530"], opensShop: "fashion",
    tags: ["boutique", "shopping", "fashion"],
    lore: "Racks curated by a woman who once styled a backup dancer for a famous person. The mirrors flatter on purpose, and so does the lighting. Trust the fit, not the mirror.",
    actions: [
      { id: "browse", kind: "visit", label: "Try on things you can't afford", energy: 5, mood: 6, blurb: "The fitting room selfie is free. The jacket is not." },
    ],
  },
  {
    id: "fifs-furniture", borough: "brooklyn", name: "Fif's Furniture", emoji: "🛋️", category: "shopping", neighborhood: "Greenpoint",
    at: [40.7272, -73.9532], depth: "full", template: "showroom", palette: ["#FFC21A", "#F3EBDD", "#2A2530"], opensShop: "home",
    tags: ["furniture", "shopping", "home"],
    lore: "Fif has sold every sofa in Brooklyn at least twice. The showroom is the apartment you wish you had, and Fif swears it fits through your door. It does not, sweetie.",
    actions: [
      { id: "browse", kind: "visit", label: "Lie on a bed you can't afford", energy: 5, mood: 6, blurb: "Ten minutes on the display mattress. Nobody stops you." },
    ],
  },
  {
    id: "boulevard-motors", borough: "brooklyn", name: "Boulevard Motors", emoji: "🚘", category: "shopping", neighborhood: "Greenpoint",
    at: [40.7292, -73.944], depth: "scene", template: "store", palette: ["#D93A2F", "#E6E8EC", "#1F1B26"], opensShop: "cars",
    tags: ["dealership", "shopping", "cars"],
    lore: "Balloons, a man in a shiny suit and cars that are all \"basically new.\" The test drive is free. The handshake will cost you. Read before you sign, babe.",
    actions: [
      { id: "browse", kind: "visit", label: "Take a test drive around the block", energy: 5, mood: 5, confidence: 3, blurb: "Windows down, music up, salesman sweating in the passenger seat." },
    ],
  },
  // ---- The parody universities (brought forward from location wave 4): invented campuses, no real names ----
  {
    id: "st-johnsons", name: "St. Johnsons University", emoji: "🎓", category: "campus", neighborhood: "Jamaica",
    at: [40.7224, -73.7949], depth: "full", template: "campus", palette: ["#C8102E", "#F2E6D8", "#1F2A44"],
    tags: ["university", "campus"],
    lore: "Red brick, a chapel nobody can find and a basketball team that matters more than the library. Half the students are here on scholarship; the other half are here on a parking permit.",
    actions: [
      { id: "lecture", kind: "visit", label: "Sit in on a lecture", energy: 15, confidence: 6, clout: 15, blurb: "Intro to Marketing. You take notes on the professor's outfit." },
      // v0.15 campus areas: the Quad and the Library (CAMPUS_AREAS in lib/rooms.ts).
      { id: "quad", kind: "hangout", label: "Hang out on the Quad", energy: 5, mood: 8, clout: 8, blurb: "Frisbee, a guitar nobody asked for and the best people-watching in Queens." },
      { id: "study", kind: "visit", label: "Study in the Library", energy: 12, confidence: 5, clout: 6, skill: "smarts", blurb: "Silent floor. Someone is eating chips like it's a percussion solo." },
    ],
  },
  {
    id: "queensborough-u", name: "Queensborough University", emoji: "🏛️", category: "campus", neighborhood: "Flushing",
    at: [40.7366, -73.8170], depth: "full", template: "campus", palette: ["#3B6FB6", "#E8E2D0", "#2A2530"],
    tags: ["university", "campus"],
    lore: "A leafy quad, a library open until 2 AM and forty languages overheard on the walk to class. Tuition is reasonable, which around here counts as a personality.",
    actions: [
      { id: "lecture", kind: "visit", label: "Catch a lecture in the big hall", energy: 15, confidence: 6, clout: 15, blurb: "Philosophy 101. Someone asks if the professor is real. Fair question." },
      // v0.15 campus areas: the Quad and the Library (CAMPUS_AREAS in lib/rooms.ts).
      { id: "quad", kind: "hangout", label: "Hang out on the Quad", energy: 5, mood: 8, clout: 8, blurb: "Forty languages, one frisbee and a squirrel with a reputation." },
      { id: "study", kind: "visit", label: "Study in the Library", energy: 12, confidence: 5, clout: 6, skill: "smarts", blurb: "Open until 2 AM. The vending machine is the real librarian." },
    ],
  },  // ---- v0.6: the Astoria neighborhood (docs/08-new-features-spec.md section 5). Invented names. ----
  {
    id: "ditmars-deli", name: "Ditmars Deli & Dreams", emoji: "🥪", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7748, -73.9128], depth: "full", template: "counter", palette: ["#2E9E6A", "#F4E3C8", "#1F1B26"],
    tags: ["bodega", "dining_budget", "astoria", "job_cashier"],
    lore: "Open all night, run by Sal and a cat named Also Sal. The chopped cheese has a fan account. Sal does not know about the fan account. I run the fan account.",
    actions: [
      // C2: the cheapest breakfast in the game, and the cat (a small Mood boost).
      { id: "bec", kind: "eat", label: "Bacon, egg and cheese on a roll", task: "Get a BEC at Sal's and say \"salt, pepper, ketchup\" like you were born here", price: 8, energy: -12, blurb: "Salt, pepper, ketchup. The cheapest breakfast in the city and the best one in Queens." },
      { id: "eat", kind: "eat", label: "Chopped cheese at the counter", price: 14, energy: -15, blurb: "Wrapped in foil, handed over with zero eye contact. Perfect." },
      { id: "pet-cat", kind: "visit", label: "Pet Also Sal", task: "Ask the bodega cat for permission to exist", energy: 1, mood: 4, blurb: "He allows it. Briefly. Then he goes back to sleeping on the bread." },
      // C3: a shift behind the register.
      { id: "cashier", kind: "shift", label: "Work the register", pay: 120, energy: 25, blurb: "Lotto tickets, loose cigarettes you refuse to sell and forty \"you got change for a twenty?\"" },
    ],
  },
  // ---- Culture pack C5 (owner, Oct 20): the rooftop for the NYE countdown, and the Meteors' ballpark in Flushing. ----
  {
    id: "ditmars-heights-rooftop", name: "Ditmars Heights Rooftop", emoji: "🌃", category: "food", neighborhood: "Astoria", tier: "Luxury",
    at: [40.7741, -73.9169], depth: "scene", template: "lounge", palette: ["#6B2BD9", "#FFD2A8", "#14111A"], hours: { open: 16, close: 2 },
    tags: ["rooftop", "dining_luxury", "astoria"],
    lore: "Six floors up on Ditmars, with string lights, heat lamps and the whole skyline from the bridge to the city. Kiki runs the guest list like a border crossing. New Year's Eve up here? Facts, babe: best seat in Queens.",
    actions: [
      { id: "eat", kind: "eat", label: "Small plates and a skyline", price: 120, energy: -45, blurb: "Grilled halloumi, a view of the bridge and a bill you'll photograph for the group chat." },
    ],
  },
  {
    id: "meteor-park", name: "Meteor Park", emoji: "⚾", category: "places", neighborhood: "Flushing Meadows",
    at: [40.7571, -73.8458], depth: "scene", template: "plaza", palette: ["#1F4FA8", "#FF7A1A", "#F4F1EA"],
    tags: ["stadium", "sports", "flushing"],
    lore: "Home of the Flushing Meteors, Queens' own heartbreak since forever. Forty thousand seats, one apple that pops up after a home run and a fan base that boos the Bronx Bigshots on principle. Mad loud on game nights, babe.",
    actions: [
      { id: "eat", kind: "eat", label: "Ballpark dog and a cold soda", price: 16, energy: -12, blurb: "Overpriced, underwhelming, absolutely perfect in the seventh inning." },
      { id: "tour", kind: "visit", label: "Walk the concourse", energy: 6, mood: 5, blurb: "Murals of every season that almost happened. Hope springs eternal in Queens." },
    ],
  },
  // ---- Culture pack C6 (owner, Oct 21): a Flushing food court (a date spot), and the places of two new stories. ----
  {
    id: "downstairs-on-main", name: "Downstairs on Main Food Court", emoji: "🥟", category: "food", neighborhood: "Flushing", tier: "Budget",
    at: [40.7585, -73.8301], depth: "scene", template: "counter", palette: ["#E0452B", "#FFE7B8", "#2A2530"],
    tags: ["food_court", "dining_budget", "flushing"],
    lore: "Down a staircase that looks like a mistake: twenty stalls, hand-pulled noodles, soup dumplings and a line that moves faster than the 7. Wen has run the dumpling stall since before your favorite influencer was born. Cash only vibes, babe.",
    actions: [
      { id: "eat", kind: "eat", label: "Dumplings and hand-pulled noodles", price: 15, energy: -22, blurb: "Burn your tongue on the first soup dumpling. Everybody does. It's the toll." },
      { id: "bubble", kind: "visit", label: "Split a bubble tea", price: 7, energy: 3, mood: 6, blurb: "Two straws, one cup, a lot of eye contact. Works every time." },
    ],
  },
  // Story places (C6): on the map only while their story runs.
  {
    id: "ditmars-walkup", name: "The Ditmars Walk-Up", emoji: "🏚️", category: "places", neighborhood: "Astoria", story: "the-lease",
    at: [40.7746, -73.9121], depth: "scene", template: "civic", palette: ["#B86A4A", "#F2E3C4", "#2A2530"],
    tags: ["walkup_3r", "residential"],
    lore: "Five floors, no elevator, one rent-stabilized one-bedroom: 3R, C$700 a month since the Carter administration. Agnes Pappas lived there 52 years. Now everybody wants it, and Teddy the super has a front-row seat.",
    actions: [
      { id: "stoop", kind: "visit", label: "Sit on the stoop", price: 0, energy: 4, mood: 3, blurb: "Teddy waters the plants. Everyone pretends not to look up at 3R." },
      { id: "vigil", kind: "visit", label: "Leave a card for Agnes", price: 0, energy: 2, clout: 10, mood: 4, storyUnlock: true, blurb: "Her name's still on the buzzer. Somebody keeps bringing her favorite cookies." },
    ],
  },
  {
    id: "queens-housing-court", name: "Queens Housing Court", emoji: "⚖️", category: "places", neighborhood: "Jamaica", story: "the-lease",
    at: [40.7037, -73.8080], depth: "scene", template: "civic", palette: ["#6B6F7A", "#E9EDF3", "#1F2A44"],
    tags: ["housing_court", "civic"],
    lore: "Fluorescent lights, a vending machine that only takes exact change and the most dramatic theater in Queens, free. Bring a sandwich. Bring a lawyer if you can. Bring the sandwich either way.",
    actions: [
      { id: "gallery", kind: "visit", label: "Sit in the gallery", price: 0, energy: 6, mood: 2, blurb: "The judge has seen everything. Twice. She still raises an eyebrow." },
    ],
  },
  {
    id: "court-square-courthouse", name: "Court Square Courthouse", emoji: "🗽", category: "places", neighborhood: "Long Island City", story: "lady-liberty",
    at: [40.7471, -73.9436], depth: "scene", template: "civic", palette: ["#3E8E7E", "#E9EDF3", "#1F2A44"],
    tags: ["liberty_court", "civic"],
    lore: "Columns, marble and a line around the block, because New York and New Jersey are fighting over who gets the Statue of Liberty on weekends. The court-sketch artist is booked solid. The bailiff has a podcast now.",
    actions: [
      { id: "gallery", kind: "visit", label: "Get a seat in the gallery", price: 0, energy: 6, mood: 3, blurb: "Bring snacks. The New Jersey side brought a whole diner." },
      { id: "steps", kind: "visit", label: "Wave a sign on the steps", price: 0, energy: 4, clout: 10, mood: 4, storyUnlock: true, blurb: "\"SHE'S A NEW YORKER\" in glitter. You and four hundred cousins." },
    ],
  },
  // ---- Culture pack C2 (owner, Oct 20): Astoria food. Opening hours on the city clock; Sal's stays open all night. ----
  {
    id: "still-a-dollar-slice", name: "Still-a-Dollar Slice", emoji: "🍕", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7712, -73.9150], depth: "scene", template: "counter", palette: ["#D93A2F", "#FFF1D6", "#2A2530"], hours: { open: 10, close: 1 },
    tags: ["pizza", "dining_budget", "astoria"],
    lore: "The sign says a dollar. The sign is from 2009, babe. Two slices and a soda is still the best lunch deal in Queens, and Arben folds yours for you if you look new.",
    actions: [
      { id: "slice", kind: "eat", label: "Grab a slice", price: 6, energy: -10, blurb: "Fold it. Burn the roof of your mouth. Welcome to New York." },
      { id: "combo", kind: "eat", label: "Two slices and a soda", price: 13, energy: -20, blurb: "The working city's lunch deal. The soda is whatever's coldest." },
    ],
  },
  {
    id: "white-sauce-cart", name: "The White Sauce Cart", emoji: "🥙", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7708, -73.9172], depth: "scene", template: "plaza", palette: ["#F2A33A", "#FFF6E0", "#1F1B26"], hours: { open: 18, close: 5 },
    tags: ["halal_cart", "late_night", "dining_budget", "astoria"],
    lore: "Chicken over rice, a mountain of white sauce and the best thing open on this corner after midnight. Tariq has fed every bartender in Astoria at 3 a.m. Our advice: get the extra sauce.",
    actions: [
      { id: "eat", kind: "eat", label: "Chicken over rice, extra white sauce", price: 14, energy: -20, blurb: "Red sauce at your own risk. Tariq warned you. Twice." },
    ],
  },
  {
    id: "boiled-and-beloved", name: "Boiled & Beloved Hot Dogs", emoji: "🌭", category: "food", neighborhood: "Astoria", tier: "Budget",
    at: [40.7768, -73.9245], depth: "scene", template: "plaza", palette: ["#3E8EDE", "#FFD84D", "#1F1B26"], hours: { open: 10, close: 20 },
    tags: ["hot_dog_cart", "dining_budget", "astoria"],
    lore: "A cart, an umbrella and hot dog water older than some of these buildings. Lou has worked the park gate for thirty summers. Gross? Facts. Beloved? Also facts.",
    actions: [
      { id: "eat", kind: "eat", label: "Two dirty water dogs", price: 9, energy: -12, blurb: "Onions, mustard, no questions. Especially about the water." },
    ],
  },
  {
    id: "feta-compli", name: "Feta Compli Taverna", emoji: "🫒", category: "food", neighborhood: "Astoria", tier: "Medium",
    at: [40.7676, -73.9188], depth: "scene", template: "cafe", palette: ["#2F6FB3", "#F4F1EA", "#1F1B26"], hours: { open: 12, close: 23 },
    tags: ["taverna", "dining_medium", "astoria"],
    lore: "Grilled octopus, spanakopita a yiayia signed off on and a waiter who shouts \"Opa!\" whether or not anything's on fire. Name-day parties take over the back room mad often. Book ahead, sweetie.",
    actions: [
      { id: "eat", kind: "eat", label: "Souvlaki platter and grilled octopus", price: 40, energy: -30, blurb: "Andreas brings bread you didn't order. You eat all of it. That's the plan." },
    ],
  },
  {
    id: "schlep-and-schmear", name: "Schlep & Schmear Deli", emoji: "🥯", category: "food", neighborhood: "Astoria", tier: "Medium",
    at: [40.7645, -73.9205], depth: "scene", template: "counter", palette: ["#B8743A", "#FFF6E0", "#2A2530"], hours: { open: 7, close: 21 },
    tags: ["jewish_deli", "dining_medium", "astoria", "job_deli"],
    lore: "Pastrami stacked like a rent increase, knishes the size of your fist and Hersh at the counter, who has never once said \"have a nice day.\" Kvetch about the line all you want; it's worth the schlep.",
    actions: [
      { id: "eat", kind: "eat", label: "Pastrami on rye, half-sour pickle", price: 38, energy: -28, blurb: "Hersh slices it by hand and judges you by hand. Both are excellent." },
      // C3: a shift at the counter (only while the deli's open).
      { id: "counter", kind: "shift", label: "Work the deli counter", pay: 130, energy: 28, blurb: "Slice, wrap, yell \"next!\" Hersh says you have the wrists for it." },
    ],
  },
  {
    id: "two-bros-pizza", borough: "brooklyn", name: "Two Bros Who Fight Pizza", emoji: "🍕", category: "food", neighborhood: "Greenpoint", tier: "Budget",
    at: [40.725, -73.9565], depth: "scene", template: "counter", palette: ["#D93A2F", "#FFF1D6", "#2A2530"],
    tags: ["pizza", "dining_budget"],
    lore: "Two brothers, one oven and a feud about anchovies going on eleven years. The slices are great, the yelling is free and I have it all on video.",
    actions: [
      { id: "eat", kind: "eat", label: "Grab a slice", price: 9, energy: -12, blurb: "Fold it like a local. Burn the roof of your mouth like a local." },
    ],
  },
  // The Hub (owner, Oct 16): the city's meeting point, first in Places. It was The Neon Spoon and keeps its
  // id (players' visits stay theirs); the Neon Spoon is now the diner on its ground floor. Four floors:
  // 0 the restroom (gossip), 1 the diner, 2 the game room, 3 the lounge (HUB_FLOORS in lib/rooms.ts).
  {
    id: "neon-spoon", name: "The Hub", emoji: "🛸", category: "places", neighborhood: "Astoria",
    at: [40.7695, -73.9265], depth: "full", template: "hub", palette: ["#3BB8C9", "#FF2E88", "#14111A"],
    tags: ["hub", "diner", "dining_medium", "games", "astoria"], club: {},
    lore: "Four floors of glass rings stacked like a spaceship parked on 31st Street, babe. The Neon Spoon diner's chrome counter and all-day breakfast downstairs, games on two, couches on three, and everybody worth knowing. Ask for me.",
    actions: [
      { id: "eat", kind: "eat", label: "Pancakes at the Neon Spoon counter", price: 38, energy: -28, blurb: "The waitress calls you \"hon.\" You've never felt more seen." },
      { id: "play", kind: "visit", label: "A round in the game room", price: 12, energy: 8, mood: 6, confidence: 2, blurb: "You lose to a stranger. You're friends now. That's how it works up here." },
      { id: "hang", kind: "hangout", label: "Hang out in the lounge", energy: 2, mood: 8, blurb: "Big couches, bigger opinions. Nobody's in a hurry on the third floor." },
    ],
  },
  {
    id: "up-on-thirty", borough: "brooklyn", name: "Up on Wythe", emoji: "🥂", category: "food", neighborhood: "Williamsburg", tier: "Luxury",
    at: [40.7205, -73.9595], depth: "scene", template: "lounge", palette: ["#C9A0FF", "#F4EDE6", "#1F1B26"],
    tags: ["rooftop", "dining_luxury"],
    lore: "A rooftop above Wythe Avenue with string lights, small plates and big opinions. The view is Manhattan; the vibe is \"I'm not from Manhattan, on purpose.\" Reservations go through me.",
    actions: [
      { id: "eat", kind: "eat", label: "Small plates, big view", price: 160, energy: -50, blurb: "Order the octopus. Photograph the octopus. Eventually, eat the octopus." },
    ],
  },
  {
    id: "steinway-fresh", name: "Steinway Fresh Mart", emoji: "🛒", category: "food", neighborhood: "Astoria",
    at: [40.7628, -73.9160], depth: "scene", template: "counter", palette: ["#40B589", "#FFF6E0", "#2A2530"],
    tags: ["supermarket", "astoria"],
    lore: "Forty kinds of feta and one working shopping cart. Stock the fridge and cook at home, darling: cheaper than eating out, and nobody photographs it. Your secret's safe.",
    actions: [
      { id: "browse", kind: "visit", label: "Wander the aisles", energy: 3, mood: 3, blurb: "You came for nothing and you're leaving with nothing. Growth." },
    ],
  },
  {
    id: "hellgate-hall", borough: "brooklyn", name: "The Kiln", emoji: "🎧", category: "nightlife", neighborhood: "East Williamsburg",
    at: [40.7085, -73.942], depth: "full", template: "club", palette: ["#FF5A36", "#3A1E6B", "#14111A"],
    tags: ["club", "nightlife"], club: { vip: "medium" },
    lore: "A Bushwick warehouse under the elevated tracks with a sound system that registers on seismographs. The DJ booth is an old subway car. Nobody knows how it got inside. I do. I'm not telling.",
    actions: [
      { id: "visit", kind: "visit", label: "Dance under the train tracks", price: 115, energy: 15, mood: 6, confidence: 4, blurb: "Every time the J train passes, the whole room cheers." },
    ],
  },
  // #19 clubs (owner, Oct 14): two cheap clubs and one exclusive one. Invented, like everything else.
  {
    id: "the-sticky-floor", borough: "brooklyn", name: "The Sticky Floor", emoji: "🪩", category: "nightlife", neighborhood: "East Williamsburg",
    at: [40.7058, -73.9372], depth: "full", template: "club", palette: ["#3DDC97", "#2B2D6B", "#14111A"],
    tags: ["club", "nightlife"], club: {},
    lore: "A basement under a phone repair shop: one strobe light and a floor that keeps your shoes. The DJ takes requests and ignores them. Nobody here is anybody yet. Yet, babe.",
    actions: [
      { id: "visit", kind: "visit", label: "Dance on the sticky floor", price: 40, energy: 15, mood: 6, confidence: 3, blurb: "Your shoes stay. You move. It's a workout, technically." },
    ],
  },
  {
    id: "discount-disco", borough: "brooklyn", name: "Discount Disco", emoji: "💿", category: "nightlife", neighborhood: "Bushwick",
    at: [40.7038, -73.9328], depth: "full", template: "club", palette: ["#FFC21A", "#B0135A", "#14111A"],
    tags: ["club", "nightlife"], club: {},
    lore: "A former mattress outlet with a light-up floor that only lights up on one side. Two-for-one everything, including regrets. The disco ball was on clearance and honey, it shows.",
    actions: [
      { id: "visit", kind: "visit", label: "Do the hustle, on a budget", price: 60, energy: 15, mood: 6, confidence: 3, blurb: "The bass is secondhand. The moves are all yours." },
    ],
  },
  {
    id: "ultraviolet-society", borough: "brooklyn", name: "Ultraviolet Society", emoji: "💜", category: "nightlife", neighborhood: "Williamsburg",
    at: [40.7135, -73.9625], depth: "full", template: "club", palette: ["#9B5CFF", "#0E0B1F", "#E8E0FF"],
    tags: ["club", "nightlife", "exclusive_club"], club: { vip: "exclusive", doorClout: 2000 },
    lore: "A glass box on the waterfront with the skyline for wallpaper. No sign, no line, no photos at the door. The bouncer checks clout like a passport and has sent some very famous faces home. I have the list.",
    actions: [
      { id: "visit", kind: "visit", label: "Get seen by the skyline", price: 350, energy: 15, mood: 8, confidence: 6, blurb: "Everyone's pretending not to look at everyone. Join in." },
    ],
  },
  {
    id: "triborough-works", name: "Triborough Works", emoji: "🏢", category: "places", neighborhood: "Astoria",
    at: [40.7660, -73.9252], depth: "scene", template: "office", palette: ["#6C8CFF", "#E6E8EC", "#1F1B26"],
    tags: ["office", "coworking", "gigs_board", "astoria"],
    lore: "Coworking for people who are \"between rounds.\" Free kombucha, a ping-pong table nobody uses and a gigs board that actually pays. Take the gig, skip the kombucha.",
    actions: [
      { id: "gigs", kind: "gigs", label: "Check the gigs board", energy: 0, blurb: "Side gigs pin up here every morning. Some of them are even legal-sounding." },
    ],
  },
  {
    id: "ditmars-library", name: "Ditmars Free Library", emoji: "📚", category: "places", neighborhood: "Astoria",
    at: [40.7735, -73.9098], depth: "scene", template: "civic", palette: ["#B8743A", "#F2E6D8", "#2A2530"],
    tags: ["library", "free", "astoria"],
    lore: "Quiet, free and full of people pretending to read while charging their phones. The librarian has heard every excuse for a late book. Yours isn't new, sweetie.",
    actions: [
      { id: "study", kind: "visit", label: "Study in the quiet room", energy: 10, confidence: 5, blurb: "Fifty minutes of focus, ten minutes of looking at strangers' book choices." },
    ],
  },
  {
    id: "precinct-114-half", name: "The 114½ Precinct", emoji: "🚓", category: "places", neighborhood: "Astoria",
    at: [40.7690, -73.9228], depth: "scene", template: "civic", palette: ["#2F5FB3", "#E6E8EC", "#14111A"],
    tags: ["police", "free", "astoria"],
    lore: "The busiest desk sergeant in the neighborhood drinks from a mug that says \"World's Okayest Cop.\" Most reports here are about parking. All of them are passionate. Bev tells me everything.",
    actions: [
      { id: "report", kind: "visit", label: "Report a \"stolen\" parking spot", energy: 3, mood: 3, blurb: "They write it down. They will not do anything. You feel heard." },
    ],
  },
  {
    id: "engine-7", name: "Engine 7 Firehouse", emoji: "🚒", category: "places", neighborhood: "Astoria",
    at: [40.7720, -73.9205], depth: "scene", template: "civic", palette: ["#D93A2F", "#F4E3C8", "#1F1B26"],
    tags: ["firehouse", "free", "astoria"],
    lore: "Big red doors, bigger hearts and a dalmatian named Hydrant who has never once been on time. Captain Rosa is my favorite person in Astoria. Keep that between us, babe.",
    actions: [
      { id: "pet-dog", kind: "visit", label: "Pet the firehouse dog", energy: 2, mood: 6, blurb: "Hydrant leans into it. Best part of your week, statistically." },
    ],
  },
  {
    id: "astoria-cc", borough: "brooklyn", name: "Grand Street Community College", emoji: "🏫", category: "campus", neighborhood: "Williamsburg",
    at: [40.7118, -73.9545], depth: "scene", template: "campus", palette: ["#2E9E6A", "#E8E2D0", "#2A2530"],
    tags: ["college", "campus"],
    lore: "Night classes for people with day jobs and big plans. The parking lot has more ambition per square foot than most startups. I respect a hustle.",
    actions: [
      { id: "night-class", kind: "visit", label: "Take a night class", price: 45, energy: 15, confidence: 6, clout: 10, blurb: "Public Speaking 101. You speak publicly. Nobody dies." },
    ],
  },
  {
    id: "harmony-chapel", name: "Harmony Community Chapel", emoji: "🕊️", category: "places", neighborhood: "Astoria",
    at: [40.7652, -73.9130], depth: "scene", template: "civic", palette: ["#E8C79A", "#F4EDE6", "#3A2C5E"],
    tags: ["chapel", "quiet", "free", "astoria"],
    lore: "A small open-door chapel with stained glass and a bulletin board of bake sales. Come say a prayer, everyone's welcome, and the folding chairs are a test of faith. The one place I keep my voice down.",
    actions: [
      // Owner, Oct 16: a place to pray, for Mood and Confidence.
      { id: "quiet", kind: "visit", label: "Say a prayer", energy: 2, mood: 7, confidence: 5, blurb: "Ten quiet minutes, one honest ask. You walk out lighter and standing a little taller." },
    ],
  },
  {
    id: "hell-gate-park", name: "Astoria Park", emoji: "🌳", category: "parks", neighborhood: "Astoria",
    at: [40.7790, -73.9232], depth: "scene", template: "plaza", palette: ["#5CC28F", "#F4E3C8", "#2A2530"],
    tags: ["park", "outdoors", "free", "astoria", "job_dogwalker"],
    lore: "Riverside lawns under a giant bridge, a running track and a public pool with very strong opinions about swim caps. Wear one, babe. They will check.",
    actions: [
      // C3 (owner, Oct 20): the hangout is a bench now (same id, so players' history stays), plus a lap, a picnic and dog walking.
      { id: "hangout", kind: "hangout", label: "Sit on a bench by the river", energy: 5, mood: 12, blurb: "Watch the bridge, the joggers and one guy doing tai chi like it's a competition." },
      { id: "lap", kind: "visit", label: "Take a lap around the track", task: "Get lapped by a 70-year-old in Astoria Park", energy: 12, mood: 4, confidence: 3, skill: "fitness", blurb: "One lap. Okay, half a lap and a very confident walk." },
      { id: "picnic", kind: "eat", label: "Picnic on the lawn", price: 18, energy: -14, mood: 6, blurb: "Bodega sandwiches, a blanket and the bridge doing its best impression of a postcard." },
      { id: "walk-dogs", kind: "shift", label: "Walk dogs for the Ditmars crowd", task: "Work a dog-walking shift", pay: 110, energy: 20, mood: 2, blurb: "Three Frenchies, one leash tangle, zero respect for your schedule. Mad money, though." },
    ],
  },
  {
    id: "rep-count", borough: "brooklyn", name: "Rep Count Fitness", emoji: "🏋️", category: "places", neighborhood: "Williamsburg",
    at: [40.7168, -73.9468], depth: "scene", template: "gym", palette: ["#FF8A3D", "#E6E8EC", "#1F1B26"],
    tags: ["gym"],
    lore: "Neon lights, loud music and mirrors on every wall, so you can watch yourself almost do a pull-up. Nobody here is related to any other gym. Asked and answered.",
    actions: [
      { id: "workout", kind: "visit", label: "Work out", price: 28, energy: 20, confidence: 6, mood: 2, blurb: "Leg day. You'll feel it on the stairs to your walk-up." },
    ],
  },
  {
    id: "astoria-blvd-station", name: "Astoria Blvd station", emoji: "🚇", category: "places", neighborhood: "Astoria",
    at: [40.7702, -73.9180], depth: "scene", palette: ["#FFC21A", "#E6E8EC", "#1F1B26"],
    tags: ["subway", "transit", "free", "astoria"],
    lore: "An elevated platform with a view of everyone's laundry. The train is always \"two stops away.\" Pick the subway in \"Go there\" and it gets you anywhere for a few bucks, eventually.",
    actions: [
      { id: "platform", kind: "visit", label: "People-watch on the platform", energy: 2, mood: 2, blurb: "A man is eating a full rotisserie chicken. Respect." },
    ],
  },
  {
    id: "reel-queens", borough: "brooklyn", name: "Reel Kings Cinema", emoji: "🎬", category: "places", neighborhood: "Greenpoint",
    at: [40.7238, -73.9478], depth: "scene", template: "campus", palette: ["#E0186F", "#FFE7C2", "#14111A"],
    tags: ["cinema", "date_spot"],
    lore: "A restored single-screen movie palace with velvet seats and a popcorn machine older than your parents. Perfect for dates: the dark hides nervous faces. And I see in the dark.",
    actions: [
      { id: "movie", kind: "eat", label: "Movie and popcorn", price: 35, energy: -10, mood: 8, blurb: "Butter on the popcorn, butter on the seat, butter somehow on your phone." },
    ],
  },
  {
    id: "respawn-arena", borough: "brooklyn", name: "Respawn Arena", emoji: "🎮", category: "places", neighborhood: "Williamsburg",
    at: [40.7098, -73.9482], depth: "scene", template: "club", palette: ["#6B4FD8", "#9FD8C4", "#14111A"],
    tags: ["games", "arena"],
    lore: "Rows of glowing rigs, a stage for tournaments and an energy-drink fridge that hums like a jet engine. Gamers call it home; everyone else calls it loud. Pixel runs the place and owes me a favor.",
    actions: [
      { id: "match", kind: "visit", label: "Play a ranked match", price: 24, energy: 15, confidence: 5, clout: 12, blurb: "You lose to a twelve-year-old. You win the rematch. Character arc." },
    ],
  },
  // v0.10 (spec section 7): the lotto shop, outside Astoria on purpose; you travel to play.
  {
    // C4 (owner, Oct 21): back in Flushing, so every player can reach it from day one (it's part of v1.0).
    id: "lucky-star", name: "Lucky Star Lotto", emoji: "🌟", category: "places", neighborhood: "Flushing",
    at: [40.7593, -73.8303], depth: "full", template: "lotto", palette: ["#FFD84D", "#FF2E88", "#2A2530"],
    tags: ["lotto", "flushing"],
    lore: "A narrow shop on Main Street, squeezed between a dumpling counter and a phone-case kiosk: a neon star, a rack of scratch cards and Benny, who has never once bought a ticket. It's a schlep on the 7, babe. Odds are printed on every card, which Benny calls \"the boring part.\"",
    actions: [
      { id: "chat", kind: "visit", label: "Shoot the breeze with Benny", energy: 2, mood: 3, blurb: "He tells you his system. The system is not buying tickets." },
    ],
  },
  // v0.14 On Air (owner, Oct 16): the stations, with the full place treatment.
  {
    id: "real-clout-fm", name: "Real Clout FM", emoji: "📻", category: "places", neighborhood: "Astoria",
    at: [40.7598, -73.9262], depth: "full", template: "radio", palette: ["#FF2E88", "#FFB23D", "#14111A"],
    tags: ["radio", "station", "astoria"],
    lore: "Home of The Wake-Up Call, where DJ Sharm Almight reads one lucky shoutout every morning at 9. The ON AIR sign is always lit. Nobody has checked whether the mic is. I have.",
    actions: [
      { id: "sit-in", kind: "visit", label: "Sit in on The Wake-Up Call", energy: 4, mood: 5, confidence: 2, clout: 6, blurb: "You clap at the jingle. Sharm points at you like you're the jingle." },
    ],
  },
  {
    id: "clout-tower", name: "Clout TV Tower", emoji: "📺", category: "places", neighborhood: "Astoria",
    at: [40.7585, -73.9195], depth: "full", template: "broadcast", palette: ["#FF2E88", "#FF6A3D", "#14111A"],
    tags: ["tv", "station", "astoria"],
    lore: "Clout TV's tower, and the Big Screen on its side: one face, three hours, the whole city looking up. The control room smells like cold coffee and ambition. Get your face up there, babe.",
    actions: [
      { id: "watch", kind: "visit", label: "Watch the Big Screen with the crew", energy: 3, mood: 4, confidence: 3, clout: 6, blurb: "Someone else's face, forty feet tall. You take notes." },
    ],
  },
];

/**
 * v0.14 On Air (owner, Oct 16): the two stations are places too, listed first in Places. Their
 * own buttons open the Radio and Clout TV apps (Send Radio Shoutout, Get on Billboard).
 */
export const STATION_TAGS = ["radio", "tv"] as const;
export const isStation = (p: Pick<Place, "tags">) => p.tags.some((t) => (STATION_TAGS as readonly string[]).includes(t));
/** The Hub (owner, Oct 16): the meeting point, always first in Places. */
export const isHub = (p: Pick<Place, "tags">) => p.tags.includes("hub");

export const HOME_PLACE_ID = "home";

/** Where each starter home sits on the map. */
export const HOME_LOCATIONS: Record<string, LatLng> = {
  sunnyside_gardens: [40.7472, -73.9182],
  // C3: the shared apartment, a few blocks from Sal's.
  astoria_share: [40.7735, -73.9145],
  astoria_studio: [40.7745, -73.9050],
  jackson_heights_1br: [40.7520, -73.8830],
  lic_highrise: [40.7470, -73.9560],
  // v0.15 Campus: the dorms, a short walk from each campus.
  sj_dorm: [40.7208, -73.7972],
  qu_dorm: [40.7352, -73.8192],
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
  /** v0.15 (owner, Oct 18): the New York weekdays it runs (ISO, 1 Monday to 7 Sunday); every day when absent. */
  days?: number[];
}

export const CLUB_EVENTS: ClubEvent[] = [
  { id: "neon-nights", name: "Neon Nights", placeId: "velvet-static", startHour: 22, hours: 5, entry: 185, clout: 60, confidence: 8, mood: 6, blurb: "Glow sticks, bad decisions, excellent lighting." },
  { id: "bass-bath", name: "Bass Bath", placeId: "hellgate-hall", startHour: 21, hours: 5, entry: 160, clout: 50, confidence: 7, mood: 7, blurb: "Bass so heavy the train schedule adjusts around it." },
  { id: "golden-hour", name: "Golden Hour Day Party", placeId: "velvet-static", startHour: 15, hours: 4, entry: 115, clout: 40, confidence: 6, mood: 8, blurb: "A day party for people who can't commit to a night." },
  // #19 clubs: a night at each new club, priced like its door.
  { id: "two-dollar-night", name: "Two-Dollar Night", placeId: "the-sticky-floor", startHour: 21, hours: 5, entry: 55, clout: 20, confidence: 5, mood: 8, blurb: "Everything costs two dollars except getting in, leaving, and your dignity." },
  { id: "clearance-rack-disco", name: "Clearance Rack Disco", placeId: "discount-disco", startHour: 22, hours: 4, entry: 70, clout: 25, confidence: 5, mood: 8, blurb: "Last season's hits at this season's prices. All sales final." },
  { id: "ultraviolet-afterglow", name: "Afterglow", placeId: "ultraviolet-society", startHour: 23, hours: 4, entry: 450, clout: 140, confidence: 10, mood: 8, blurb: "Black light, white outfits, and a guest list the size of a haiku." },
  // Campus events at the two universities.
  { id: "homecoming-tailgate", name: "Homecoming Tailgate", placeId: "st-johnsons", startHour: 16, hours: 4, entry: 35, clout: 35, confidence: 4, mood: 10, blurb: "Foam fingers, lukewarm wings and alumni reliving 2009." },
  { id: "quad-open-mic", name: "Open Mic on the Quad", placeId: "queensborough-u", startHour: 19, hours: 3, entry: 24, clout: 30, confidence: 8, mood: 6, blurb: "Slam poetry, one ukulele and a guy who only does impressions of his roommate." },
  // v0.15 Greek Row party night (owner, Oct 18): Tuesday, Thursday, Friday and Saturday.
  // C5 (owner, Oct 20): the Flushing Meteors' home games at Meteor Park, five nights a week (no league is ever named).
  { id: "meteors-home-game", name: "Meteors home game", placeId: "meteor-park", startHour: 19, hours: 3, entry: 45, clout: 45, confidence: 4, mood: 10, days: [2, 3, 5, 6, 7], blurb: "Queens vs. whoever's in town. Boo the Bronx Bigshots even when they're not playing. Tradition." },
  { id: "greek-row-sj", name: "Greek Row Party Night", placeId: "st-johnsons", startHour: 21, hours: 5, entry: 20, clout: 40, confidence: 6, mood: 10, days: [2, 4, 5, 6], blurb: "A theme nobody understood, a playlist from 2016 and a couch that has seen things." },
  { id: "greek-row-qu", name: "Greek Row Party Night", placeId: "queensborough-u", startHour: 21, hours: 5, entry: 20, clout: 40, confidence: 6, mood: 10, days: [2, 4, 5, 6], blurb: "Mystery punch, a ping-pong table with a past and someone's cousin DJing." },
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
export type FurnitureRoom = "living" | "bedroom" | "dining" | "decor" | "art";
export const FURNITURE_ROOMS: { id: FurnitureRoom; label: string }[] = [
  { id: "living", label: "Living" }, { id: "bedroom", label: "Bedroom" }, { id: "dining", label: "Dining" }, { id: "decor", label: "Decor" },
  // Wall art (migration 0120, owner Oct 26): paintings for the home score.
  { id: "art", label: "Art" },
];

export type ShopCategory = "fashion" | "accessories" | "home" | "cars" | "houses" | "luxury" | "makeup";

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
  wear?: { slot: "top" | "bottom" | "shoes" | "accessory" | "outfit"; kind?: string; color: string; accent?: string };
  /** Cut for one presentation only (owner, Oct 16: platform boots are womenswear): the Shop hides it from the other. */
  fits?: "m" | "f";
  /**
   * Home (#19, Fif's Furniture): the piece it puts in your home (a lib/rooms.ts FurnitureKind), its color,
   * the room it's shelved under, and its line (the same piece in other colors shares a line).
   */
  furniture?: { kind: string; color?: string; room: FurnitureRoom; line: string; /** Wall art: the painting's picture (public/art/). */ art?: string };
  /** Clout needed to buy it (fantasy outfits); buy_item checks it. */
  cloutReq?: number;
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
  /**
   * Daily tasks 2.0 (migration 0073): a streak reward. Never sold in the Shop (buy_item says 'reward_only') and
   * never sold back; it arrives with a streak (player_items acquired 'earned'). Price stays 0.
   */
  reward?: boolean;
}

/** A furniture line: one Home sku per color (or one plain sku), shelved under a room at Fif's. */
function furnitureLine(id: string, room: FurnitureRoom, kind: string, name: string, emoji: string, price: number, clout: number, rating: ShopItem["rating"], blurb: string, colors?: Record<string, string>): ShopItem[] {
  const entries: [string | null, string | undefined][] = colors ? Object.entries(colors) : [[null, undefined]];
  return entries.map(([c, color]) => ({
    sku: c ? `home-${id}-${c}` : `home-${id}`, category: "home", name, emoji, price, clout, rating, blurb,
    furniture: { kind, color, room, line: id },
  }));
}

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; emoji: string }[] = [
  { id: "fashion", label: "Fashion", emoji: "👗" },
  // The Shop Manager (owner, Oct 21): hats, shades, scarves and bags; jewelry and watches stay in Luxury.
  { id: "accessories", label: "Accessories", emoji: "🕶️" },
  { id: "home", label: "Furniture", emoji: "🛋️" },
  { id: "cars", label: "Cars", emoji: "🚗" },
  { id: "houses", label: "Houses", emoji: "🏠" },
  { id: "luxury", label: "Luxury", emoji: "💍" },
  { id: "makeup", label: "Makeup", emoji: "💄" },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Fashion
  { sku: "fit-satin-bomber", category: "fashion", name: "Satin bomber jacket", emoji: "🧥", price: 395, clout: 25, rating: 3, blurb: "Shiny enough to be seen from Jersey.", wear: { slot: "top", kind: "zip", color: "#E0186F", accent: "#14111A" } },
  { sku: "fit-leather-blazer", category: "fashion", name: "Leather blazer", emoji: "🧥", price: 925, clout: 45, rating: 4, blurb: "Says \"I have a publicist.\" You don't. Yet.", wear: { slot: "top", kind: "blazer", color: "#1F1B26", accent: "#6B6570" } },
  { sku: "fit-varsity-tee", category: "fashion", name: "Vintage varsity tee", emoji: "👕", price: 145, clout: 10, rating: 2, blurb: "From a college you didn't attend. Iconic.", wear: { slot: "top", kind: "tee", color: "#FFF6E0", accent: "#D93A2F" } },
  { sku: "fit-wide-trousers", category: "fashion", name: "Wide-leg trousers", emoji: "👖", price: 310, clout: 18, rating: 3, blurb: "Extra fabric, extra confidence.", wear: { slot: "bottom", kind: "pants", color: "#C2AE86" } },
  { sku: "fit-mini-skirt", category: "fashion", name: "Pleated mini skirt", emoji: "👗", price: 265, clout: 16, rating: 3, blurb: "Brunch-approved. Weather-ignored.", wear: { slot: "bottom", kind: "skirt", color: "#6B2BD9" } },
  { sku: "fit-chunky-sneakers", category: "fashion", name: "Chunky dad sneakers", emoji: "👟", price: 460, clout: 28, rating: 4, blurb: "Ugly on purpose. Expensive on purpose.", wear: { slot: "shoes", color: "#ECE6DC" } },
  { sku: "forever-our-bird-hoodie", category: "fashion", name: "\"Forever Our Bird\" hoodie", emoji: "🕊️", price: 185, clout: 12, rating: 2, storyOnly: true, blurb: "Loretta's grief merch, C$185, \"for healing.\" Limited time, unlimited questions.", wear: { slot: "top", kind: "hoodie", color: "#F4F1EA", accent: "#6C8CFF" } },
  { sku: "col-faux-chinchilla", category: "fashion", name: "Faux chinchilla coat", emoji: "🧥", price: 0, clout: 80, rating: 4, collector: true, blurb: "No chinchillas were harmed. Several egos were.", wear: { slot: "top", kind: "blazer", color: "#D9D2C5", accent: "#A89F92" } },
  { sku: "col-holo-boots", category: "fashion", name: "Holographic platform boots", emoji: "👢", price: 0, clout: 70, rating: 4, collector: true, blurb: "Six inches taller and visible from space.", wear: { slot: "shoes", kind: "boots", color: "#B8C6FF", accent: "#7FE3E0" }, fits: "f" },
  // Whole outfits (#9, owner Oct 14): city sets for cash; fantasy sets need clout too, "to give players something to work towards".
  { sku: "set-site-crew", category: "fashion", name: "Site crew hi-vis", emoji: "🦺", price: 240, clout: 14, rating: 2, blurb: "Hard hat, hi-vis, zero construction experience.", wear: { slot: "outfit", kind: "site-crew", color: "#F2A541" } },
  { sku: "set-st-marks-punk", category: "fashion", name: "St. Marks punk", emoji: "🎸", price: 380, clout: 22, rating: 3, blurb: "Ripped on purpose. Angry on schedule.", wear: { slot: "outfit", kind: "st-marks-punk", color: "#14111A" } },
  { sku: "set-gala-night", category: "fashion", name: "Gala night", emoji: "🥂", price: 1200, clout: 55, rating: 4, blurb: "For galas you were not technically invited to.", wear: { slot: "outfit", kind: "gala-night", color: "#4E7A3A" } },
  { sku: "set-ranch-hand", category: "fashion", name: "Ranch hand overalls", emoji: "🤠", price: 290, clout: 16, rating: 2, blurb: "The nearest ranch is a salad place in Astoria.", wear: { slot: "outfit", kind: "ranch-hand", color: "#5B7FA6" } },
  { sku: "set-rockaway-beach", category: "fashion", name: "Rockaway beach set", emoji: "🩳", price: 160, clout: 10, rating: 2, blurb: "Two trains and a bus to the beach. Worth it.", wear: { slot: "outfit", kind: "rockaway-beach", color: "#B33A3A" } },
  { sku: "set-adventurer", category: "fashion", name: "Adventurer", emoji: "🧭", price: 600, clout: 30, rating: 3, cloutReq: 1000, blurb: "Has explored every corner of Queens. Most of them twice.", wear: { slot: "outfit", kind: "adventurer", color: "#5E7B3A" } },
  { sku: "set-tactical", category: "fashion", name: "Tactical gear", emoji: "🪖", price: 1100, clout: 45, rating: 3, cloutReq: 2500, blurb: "Ready for anything, mostly brunch.", wear: { slot: "outfit", kind: "tactical", color: "#3A3F47" } },
  { sku: "set-witch", category: "fashion", name: "Witch of Ditmars", emoji: "🧙", price: 1800, clout: 60, rating: 4, cloutReq: 5000, blurb: "Hexes on request. Tarot on Thursdays.", wear: { slot: "outfit", kind: "witch", color: "#5B2C8F" } },
  { sku: "set-ranger", category: "fashion", name: "Hooded ranger", emoji: "🏹", price: 1800, clout: 60, rating: 4, cloutReq: 5000, blurb: "Mysterious. Also cold.", wear: { slot: "outfit", kind: "ranger", color: "#5A3A22" } },
  { sku: "set-spacefarer", category: "fashion", name: "Spacefarer", emoji: "🚀", price: 4200, clout: 110, rating: 4, cloutReq: 10000, blurb: "First Queens resident in orbit, according to their bio.", wear: { slot: "outfit", kind: "spacefarer", color: "#E8692E" } },
  { sku: "set-royalty", category: "fashion", name: "Royalty", emoji: "👑", price: 9500, clout: 200, rating: 4, cloutReq: 25000, blurb: "Crown included. Kingdom sold separately.", wear: { slot: "outfit", kind: "royalty", color: "#C9A227" } },
  // C5: the Flushing Meteors' gear (an invented team, its own colors).
  { sku: "fit-meteors-cap", category: "fashion", name: "Flushing Meteors cap", emoji: "🧢", price: 45, clout: 6, rating: 2, blurb: "Blue and orange. Worn backwards in the bleachers, forwards at job interviews.", wear: { slot: "accessory", kind: "cap", color: "#1F4FA8" } },
  { sku: "fit-meteors-jersey", category: "fashion", name: "Flushing Meteors home jersey", emoji: "⚾", price: 120, clout: 10, rating: 2, blurb: "Pinstripes are for the Bronx. This is for believers.", wear: { slot: "top", kind: "tee", color: "#F4F1EA", accent: "#FF7A1A" } },
  { sku: "fit-bucket-hat", category: "fashion", name: "Bucket hat", emoji: "👒", price: 120, clout: 8, rating: 2, blurb: "Hides bad hair days and good ideas.", wear: { slot: "accessory", kind: "cap", color: "#40B589" } },
  // Cars
  // ---- Home (#19): Fif's Furniture. One sku per color; pieces in a line share a card in the Shop. ----
  ...furnitureLine("sofa", "living", "sofa", "Three-seat sofa", "🛋️", 480, 14, 3, "Seats three. Holds one person and their laundry.", { orange: "#FF8A3D", blue: "#6C8CFF", green: "#40B589", cream: "#ECE6DC" }),
  ...furnitureLine("armchair", "living", "armchair", "Reading armchair", "💺", 220, 8, 2, "For reading. Or for the clothes chair.", { green: "#40B589", berry: "#B0135A", mustard: "#D9A43A" }),
  ...furnitureLine("coffee-table", "living", "coffeeTable", "Coffee table", "🫖", 140, 5, 2, "Holds coffee, remotes and unopened mail."),
  ...furnitureLine("tv", "living", "tvStand", "Big TV", "📺", 650, 12, 3, "Larger than your ambitions. For now."),
  ...furnitureLine("rug", "living", "rug", "Area rug", "🧶", 120, 4, 2, "Ties the room together. Allegedly.", { pink: "#E0457B", sand: "#C2AE86", violet: "#6B4FD8" }),
  ...furnitureLine("floor-lamp", "living", "floorLamp", "Floor lamp", "💡", 90, 3, 1, "Mood lighting for a mood you're working on."),
  ...furnitureLine("bookshelf", "living", "bookshelf", "Bookshelf", "📚", 210, 7, 2, "Books you'll read, books you'll display."),
  ...furnitureLine("bed", "bedroom", "bed", "Platform bed", "🛏️", 900, 20, 3, "Off the floor at last. Your back says thank you.", { blue: "#6C8CFF", pink: "#F2B8C6", black: "#2A2530" }),
  ...furnitureLine("nightstand", "bedroom", "nightstand", "Nightstand with lamp", "🛏️", 110, 4, 2, "Somewhere to put the phone you won't stop checking."),
  ...furnitureLine("desk", "bedroom", "desk", "Work desk", "🖥️", 260, 8, 2, "Where side hustles become main hustles."),
  ...furnitureLine("dining-table", "dining", "diningTable", "Dining table", "🍽️", 340, 10, 2, "Seats four. Mostly holds takeout."),
  ...furnitureLine("chair", "dining", "chair", "Dining chair", "🪑", 75, 2, 1, "Matches nothing, on purpose.", { oak: "#9A6B45", black: "#1F1B26" }),
  ...furnitureLine("island", "dining", "kitchenIsland", "Kitchen island", "🏝️", 1400, 30, 4, "Stools included. Dinner parties not."),
  ...furnitureLine("plant", "decor", "plant", "Monstera", "🪴", 45, 3, 1, "Thrives on neglect. Relatable."),
  ...furnitureLine("piano", "decor", "piano", "Upright piano", "🎹", 6000, 90, 4, "You'll learn. Eventually. It looks great either way."),
  // Daily tasks 2.0 (owner, Oct 18): streak rewards, never on sale. lib/goals.ts GOALS.streak.collectibles gives them out in this order.
  { sku: "home-neon-five-sign", category: "home", name: "Neon \"5/5\" sign", emoji: "🔆", price: 0, clout: 0, rating: 3, reward: true, blurb: "Five tasks, every day, for a week. Glows like you have your life together.", furniture: { kind: "tvStand", color: "#FF3EA5", room: "decor", line: "neon-five-sign" } },
  { sku: "home-trophy-shelf", category: "home", name: "Trophy shelf", emoji: "🏆", price: 0, clout: 0, rating: 3, reward: true, blurb: "Trophies for showing up. Participation has never looked this good.", furniture: { kind: "bookshelf", color: "#B87333", room: "decor", line: "trophy-shelf" } },
  { sku: "home-employee-frame", category: "home", name: "Framed \"Employee of the Month\"", emoji: "🖼️", price: 0, clout: 0, rating: 3, reward: true, blurb: "You don't have an employer. The frame doesn't need to know.", furniture: { kind: "nightstand", color: "#6C8CFF", room: "decor", line: "employee-frame" } },
  { sku: "home-streak-lava-lamp", category: "home", name: "Streak lava lamp", emoji: "🌋", price: 0, clout: 0, rating: 4, reward: true, blurb: "Bubbles up every time you don't break the streak. Do not shake.", furniture: { kind: "floorLamp", color: "#8A3FFC", room: "decor", line: "streak-lava-lamp" } },
  { sku: "car-hatchback", category: "cars", name: "Pre-loved hatchback", emoji: "🚗", price: 21000, clout: 120, rating: 2, rentPerWeek: 525, blurb: "Previously loved. Heavily. It still gets you to the club." },
  { sku: "car-luxury-sedan", category: "cars", name: "Luxury sedan", emoji: "🚘", price: 78000, clout: 300, rating: 4, rentPerWeek: 1350, blurb: "Rent this luxury sedan. Might be fake life, but it's oh so worth it when you pull up to the club." },
  { sku: "car-electric-coupe", category: "cars", name: "Electric coupe", emoji: "🏎️", price: 117000, clout: 420, rating: 4, rentPerWeek: 1950, blurb: "Silent, fast and smug. Like a startup founder." },
  // Houses
  { sku: "house-astoria-townhouse", category: "houses", name: "Astoria townhouse", emoji: "🏡", price: 270000, clout: 900, rating: 3, neighborhood: "Astoria", blurb: "A stoop of your own. Neighbors will judge your plants." },
  { sku: "house-hunters-point-duplex", category: "houses", name: "Hunters Point duplex penthouse", emoji: "🏙️", price: 2400000, clout: 4200, rating: 4, neighborhood: "Long Island City", blurb: "Two floors, a terrace and a hot tub with a view of everyone who doubted you." },
  { sku: "house-lic-penthouse", category: "houses", name: "LIC penthouse", emoji: "🌆", price: 975000, clout: 2400, rating: 4, neighborhood: "Long Island City", blurb: "Floor-to-ceiling windows, so the city can watch you thrive." },
  // Luxury
  { sku: "lux-gold-chain", category: "luxury", name: "Chunky gold-tone chain", emoji: "⛓️", price: 2250, clout: 70, rating: 3, blurb: "Not gold. Nobody needs to know." },
  { sku: "lux-diamond-studs", category: "luxury", name: "Diamond-ish studs", emoji: "💎", price: 6000, clout: 140, rating: 4, blurb: "They sparkle. That's the whole personality." },
  { sku: "lux-designer-watch", category: "luxury", name: "Designer watch", emoji: "⌚", price: 17000, clout: 260, rating: 4, blurb: "Tells the time and tells everyone you're doing fine." },
  // Makeup
  { sku: "mu-glow-kit", category: "makeup", name: "Glass-skin glow kit", emoji: "✨", price: 165, clout: 12, rating: 3, blurb: "Look like you sleep eight hours. You don't." },
  { sku: "mu-lip-set", category: "makeup", name: "Lip set in 12 shades of \"nude\"", emoji: "💄", price: 210, clout: 14, rating: 3, blurb: "Twelve shades. You'll wear one. Forever." },
  { sku: "mu-lash-bar", category: "makeup", name: "Lash bar appointment", emoji: "👁️", price: 350, clout: 20, rating: 2, blurb: "Blink and you'll fan the person next to you." },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/** The borough a place is in (Queens unless set). */
export const boroughOf = (p: Pick<Place, "borough">): BoroughId => p.borough ?? "queens";

/** C2: is a place open at this city-clock minute (0 to 1439)? Places without hours always are. */
export function placeOpen(p: Pick<Place, "hours">, cityMinutes: number): boolean {
  if (!p.hours) return true;
  const { open, close } = p.hours;
  const h = cityMinutes / 60;
  return open < close ? h >= open && h < close : h >= open || h < close;
}

/** "6 PM", "12 AM". */
export function hourLabel(h: number): string {
  const h24 = ((h % 24) + 24) % 24;
  return `${h24 % 12 === 0 ? 12 : h24 % 12} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "Open 6 PM to 5 AM". */
export function hoursLine(p: Pick<Place, "hours">): string | null {
  return p.hours ? `Open ${hourLabel(p.hours.open)} to ${hourLabel(p.hours.close)}` : null;
}

/** Real minutes until a closed place opens (one city hour = 5 real minutes at the default clock). */
export function realMinutesUntilPlaceOpens(p: Pick<Place, "hours">, cityMinutes: number, realHoursPerCityDay = 2): number {
  if (!p.hours || placeOpen(p, cityMinutes)) return 0;
  const wait = (p.hours.open * 60 - cityMinutes + 1440) % 1440;
  return Math.ceil((wait * realHoursPerCityDay * 60) / 1440);
}

/** "Closed · opens 6 PM (in 25 min)". */
export function closedLine(p: Pick<Place, "hours">, cityMinutes: number, realHoursPerCityDay = 2): string {
  const mins = realMinutesUntilPlaceOpens(p, cityMinutes, realHoursPerCityDay);
  return `Closed · opens ${hourLabel(p.hours?.open ?? 0)} (in ${mins} min)`;
}

export function itemBySku(sku: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.sku === sku);
}

/**
 * The furniture of home pieces sold from the Shop catalog (Clout Couture, migration 0102): the code's own pieces carry
 * theirs on SHOP_ITEMS. The statue is the owner's avatar in gold on a pedestal (components/room/Room3D.tsx).
 */
export const CATALOG_FURNITURE: Record<string, NonNullable<ShopItem["furniture"]>> = {
  "cloud-nine-sofa": { kind: "sofa", color: "#E3CFA6", room: "living", line: "cloud-nine-sofa" },
  "self-portrait-statue": { kind: "statue", color: "#D4AF37", room: "decor", line: "self-portrait-statue" },
  "clout-throne": { kind: "throne", color: "#D4AF37", room: "living", line: "clout-throne" },
  // The Midnight Edition: gunmetal and gold (components/room/furniture.ts THRONE_MIDNIGHT).
  "clout-throne-midnight": { kind: "throne", color: "#2E3138", room: "living", line: "clout-throne" },
  // The Plaza Statue comes home after its week in front of the Unisphere (migration 0104).
  "plaza-statue": { kind: "statue", color: "#D4AF37", room: "decor", line: "plaza-statue" },
  // Wall art (migration 0120; content/shop/wall-art.json): paintings that hang on a wall, sold in Furniture → Art.
  "art-bodega-cat-sunday": { kind: "painting", room: "art", line: "art-bodega-cat-sunday", art: "/art/art-bodega-cat-sunday.webp" },
  "art-golden-hour-7": { kind: "painting", room: "art", line: "art-golden-hour-7", art: "/art/art-golden-hour-7.webp" },
  "art-rent-is-due": { kind: "painting", room: "art", line: "art-rent-is-due", art: "/art/art-rent-is-due.webp" },
  "art-astoria-rooftops": { kind: "painting", room: "art", line: "art-astoria-rooftops", art: "/art/art-astoria-rooftops.webp" },
  "art-pigeon-portrait": { kind: "painting", room: "art", line: "art-pigeon-portrait", art: "/art/art-pigeon-portrait.webp" },
  "art-bagel-blue": { kind: "painting", room: "art", line: "art-bagel-blue", art: "/art/art-bagel-blue.webp" },
  "art-globe-fog": { kind: "painting", room: "art", line: "art-globe-fog", art: "/art/art-globe-fog.webp" },
  "art-night-game": { kind: "painting", room: "art", line: "art-night-game", art: "/art/art-night-game.webp" },
  "art-laundromat-dreams": { kind: "painting", room: "art", line: "art-laundromat-dreams", art: "/art/art-laundromat-dreams.webp" },
  "art-bridge-rain": { kind: "painting", room: "art", line: "art-bridge-rain", art: "/art/art-bridge-rain.webp" },
  "art-self-made": { kind: "painting", room: "art", line: "art-self-made", art: "/art/art-self-made.webp" },
  "art-clout": { kind: "painting", room: "art", line: "art-clout", art: "/art/art-clout.webp" },
};

/** The code's piece for a sku, or a catalog painting's (its furniture only; the catalog has the words and price). */
export function shopBase(sku: string): ShopItem | undefined {
  const it = itemBySku(sku);
  const f = CATALOG_FURNITURE[sku];
  if (it || f?.room !== "art") return it;
  return { sku, category: "home", name: sku, emoji: "🖼️", price: 0, clout: 0, rating: 1, blurb: "", furniture: f };
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
/** Today's ISO weekday in New York (1 Monday to 7 Sunday). */
export function nyDow(now = Date.now()): number {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(now));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}

/** v0.15: the event runs today (New York); events without days run every day. */
export const eventToday = (ev: ClubEvent, dow = nyDow()) => !ev.days || ev.days.includes(dow);

/** "Tue, Thu, Fri & Sat". */
export function eventDaysLine(ev: ClubEvent): string {
  const names = (ev.days ?? [1, 2, 3, 4, 5, 6, 7]).map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0] ?? "";
}

export function eventOpen(ev: ClubEvent, cityMinutes: number, dow = nyDow()): boolean {
  if (!eventToday(ev, dow)) return false;
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

/**
 * Real milliseconds until doors open, to the second (owner, Oct 15: "the mins should be a countdown").
 * The city clock loops every realHoursPerCityDay real hours; doors open at the event's start hour.
 */
export function realMsUntilOpen(ev: ClubEvent, nowMs: number, realHoursPerCityDay = 2): number {
  const cycle = realHoursPerCityDay * 3_600_000;
  const at = ((ev.startHour * 60) / 1440) * cycle;
  const into = ((nowMs % cycle) + cycle) % cycle;
  return (at - into + cycle) % cycle;
}

/** "47:05", or "1:02:05" past an hour. */
export function formatCountdown(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** The seed the database stores (game_settings 'city'); generated into the migration. */
/**
 * A collector piece's value in Net Worth: 1.5× the priciest virtual-cash item in its category (Clarifications 5).
 * Whole outfits (#9) don't count: a collector piece is one garment, priced against garments.
 */
export function collectorValue(category: ShopCategory): number {
  return Math.round(1.5 * Math.max(...SHOP_ITEMS.filter((i) => i.category === category && !i.collector && i.wear?.slot !== "outfit").map((i) => i.price)));
}

export function citySeed() {
  return {
    economy: CITY_ECONOMY,
    // C4: each home's train line, from its neighborhood (a trip home rides it).
    homeLines: Object.fromEntries(ECONOMY.homes.map((h) => [h.id, CITY_ECONOMY.travel.subway.lines[h.neighborhood] ?? null])),
    places: PLACES.map((p) => ({
      id: p.id, name: p.name, tags: p.tags, story: p.story ?? null, at: p.at, area: p.neighborhood, club: p.club ?? null, borough: boroughOf(p),
      ...(p.hours ? { hours: p.hours } : {}),
      actions: p.actions.map((a) => ({
        id: a.id, kind: a.kind, price: a.price ?? 0, pay: a.pay ?? 0, energy: a.energy, mood: a.mood ?? 0, confidence: a.confidence ?? 0,
        clout: a.clout ?? null, storyUnlock: a.storyUnlock ?? false, ...(a.skill ? { skill: a.skill } : {}),
      })),
    })),
    events: CLUB_EVENTS.map((e) => ({ id: e.id, name: e.name, placeId: e.placeId, startHour: e.startHour, hours: e.hours, entry: e.entry, clout: e.clout, confidence: e.confidence, mood: e.mood, ...(e.days ? { days: e.days } : {}) })),
    gigs: Object.fromEntries(Object.entries(GIG_TITLES).map(([tier, list]) => [tier, list.map((g) => g.title)])),
    shop: SHOP_ITEMS.map((i) => ({
      sku: i.sku, category: i.category, price: i.price, clout: i.clout, rentPerWeek: i.rentPerWeek ?? 0, slot: i.wear?.slot ?? null,
      storyOnly: i.storyOnly ?? false, collector: i.collector ?? false, cloutReq: i.cloutReq ?? 0, ...(i.reward ? { reward: true } : {}),
    })),
    homeLocations: HOME_LOCATIONS,
  };
}
