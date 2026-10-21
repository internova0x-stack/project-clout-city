// v0.2 economy and onboarding content. The live values sit in the database
// (game_settings 'economy', seeded by supabase/migrations/0003_first_party.sql and
// re-tuned by later migrations) so they can be tuned without a deploy; these are the
// same values, used by the UI and checked against the newest migration by
// tests/economy.test.ts. Rent and the phone bill are weekly (v0.8, owner Oct 13);
// v0.11 raised them with the rest of the prices (migration 0039, owner Oct 14).

export interface Home {
  id: string;
  name: string;
  neighborhood: string;
  rent: number;
  blurb: string;
  emoji: string;
  /** Moving up (#19, owner Oct 14): clout needed to move in later, from the Apartments app. */
  moveClout?: number;
  /** False for homes you can only move up to, never pick at sign-up. */
  signup?: boolean;
  /** v0.15 campus dorms: only students enrolled at this campus can move in (migration 0072). */
  campus?: string;
  /**
   * Culture pack C3 (owner, Oct 20): a shared apartment. `rent` is the player's half; the roommate (content/culture/
   * npcs.json "roommates") pays the rest. Moving to a home without one finishes "Get your own place".
   */
  roommate?: string;
  /** Clout Couture (migration 0105): only owners of this real-money piece can move in (the Waterfront Mansion). */
  couture?: string;
}

export interface Trait { id: string; emoji: string; name: string; blurb: string }

export interface Economy {
  birthLottery: { min: number; max: number; step: number };
  phoneBill: number;
  firstParty: { entry: number; cashReward: number; cloutReward: number; confidence: number; energy: number };
  /** Owner, Oct 15: the first `paidAtOnce` invites pay at sign-up; later ones when the friend comes back a second day. */
  invites: { cloutPerInvite: number; cliqueSize: number; cliqueBonus: number; paidAtOnce: number };
  startingStats: { energy: number; mood: number; confidence: number };
  playersOnlineThreshold: number;
  homes: Home[];
  /** Moving later costs the first week's rent plus a broker fee of this many weeks' rent. */
  moving: { brokerWeeks: number };
}

export const ECONOMY: Economy = {
  birthLottery: { min: 5000, max: 10000, step: 100 },
  phoneBill: 60,
  firstParty: { entry: 150, cashReward: 300, cloutReward: 100, confidence: 15, energy: 20 },
  invites: { cloutPerInvite: 50, cliqueSize: 5, cliqueBonus: 500, paidAtOnce: 5 },
  startingStats: { energy: 100, mood: 60, confidence: 40 },
  playersOnlineThreshold: 1,
  homes: [
    // C3 (owner, Oct 20): the main pick at sign-up. Two single beds, one roommate, half the rent.
    { id: "astoria_share", name: "Room share with a roommate", neighborhood: "Astoria", rent: 900, emoji: "🛏️", roommate: "priya", blurb: "Two beds, one bathroom schedule, half the rent. Your roommate works nights. Mostly." },
    { id: "astoria_studio", name: "Astoria studio walk-up", neighborhood: "Astoria", rent: 1750, emoji: "🪜", blurb: "Fourth floor, no elevator. Free leg day, every day." },
    { id: "jackson_heights_1br", name: "Jackson Heights 1BR", neighborhood: "Jackson Heights", rent: 2600, emoji: "🛋️", blurb: "A real bedroom door. Your parents will finally be proud." },
    { id: "sunnyside_gardens", name: "Sunnyside Gardens 1BR", neighborhood: "Sunnyside", rent: 3200, emoji: "🌿", blurb: "A garden you share with forty neighbors and one very territorial cat.", moveClout: 1000, signup: false },
    { id: "lic_highrise", name: "Long Island City high-rise", neighborhood: "Long Island City", rent: 4500, emoji: "🌆", blurb: "Skyline view, rooftop pool, rent that should be illegal.", moveClout: 3000 },
    // v0.15 Campus (owner, Oct 18): the cheapest rent in the city, for enrolled students only. A roommate is included.
    { id: "sj_dorm", name: "St. Johnsons dorm room", neighborhood: "Jamaica", rent: 1100, emoji: "🛏️", blurb: "Bunk beds, a mini fridge and a roommate who microwaves fish.", signup: false, campus: "st-johnsons" },
    { id: "qu_dorm", name: "Queensborough dorm room", neighborhood: "Flushing", rent: 1100, emoji: "🛏️", blurb: "Cinder-block chic. The RA has a whistle and opinions.", signup: false, campus: "queensborough-u" },
    // Clout Couture (migration 0105): owners only. The weekly "rent" is its upkeep, the priciest Astoria rent, so living
    // here never saves money compared with a C$ home (content/shop/clout-couture.json).
    { id: "waterfront_mansion", name: "The Waterfront Mansion", neighborhood: "Astoria", rent: 1750, emoji: "🏛️", blurb: "Glass, stone and your name on the gate. Billionaire's Row, Astoria waterfront.", signup: false, couture: "waterfront-mansion" },
  ],
  moving: { brokerWeeks: 1 },
};

/** Homes offered at sign-up (moving-up homes come later, from the Apartments app). */
export const SIGNUP_HOMES = ECONOMY.homes.filter((h) => h.signup !== false);

/** What moving into a home costs now: the first week's rent plus the broker fee (your own mansion has no broker). */
export function moveCost(home: Home, e: Economy = ECONOMY): number {
  return home.rent * (1 + (home.couture ? 0 : e.moving.brokerWeeks));
}

/** The priciest Astoria rent: the Waterfront Mansion's weekly upkeep matches it (tests/economy.test.ts). */
export const topAstoriaRent = (e: Economy = ECONOMY) => Math.max(...e.homes.filter((h) => h.neighborhood === "Astoria" && !h.couture).map((h) => h.rent));

export const TRAITS: Trait[] = [
  { id: "main_character", emoji: "🎬", name: "Main Character Energy", blurb: "Narrates own life in the third person." },
  { id: "photogenic", emoji: "📸", name: "Photogenic", blurb: "Every angle is the good side. Annoyingly." },
  { id: "big_brain", emoji: "🧠", name: "Big Brain", blurb: "Actually reads the terms and conditions." },
  { id: "unbothered", emoji: "💅", name: "Unbothered", blurb: "Has not been pressed since 2017." },
  { id: "party_starter", emoji: "🎉", name: "Party Starter", blurb: "Knows the bouncer's dog by name." },
  { id: "hustler", emoji: "💸", name: "Hustler", blurb: "Three side gigs and a podcast nobody asked for." },
  { id: "ride_or_die", emoji: "🫶", name: "Ride or Die", blurb: "Will help you move. Twice. In August." },
  { id: "mysterious", emoji: "🕶️", name: "Mysterious", blurb: "Nobody knows where they're from. Including them." },
  { id: "loud", emoji: "🎤", name: "Loud", blurb: "Inside voice is a rumor." },
  { id: "wellness_era", emoji: "🌱", name: "Wellness Era", blurb: "Has opinions about your gut biome." },
];

export const TRAIT_COUNT = 2;

/** A home is offered only if the first rent still leaves the phone bill and the party's entry. */
export function canAfford(home: Home, cash: number, e: Economy = ECONOMY): boolean {
  return cash - home.rent >= e.phoneBill + e.firstParty.entry;
}

export function formatCash(n: number): string {
  return `C$${Math.round(n).toLocaleString("en-US")}`;
}

/** Short number for tight spots like the HUD: 9,999, then 12.5K, then 1.25M. */
export function formatShort(n: number): string {
  const a = Math.abs(n);
  if (a < 10_000) return Math.round(n).toLocaleString("en-US");
  const [v, unit] = a < 999_500 ? [n / 1_000, "K"] : [n / 1_000_000, "M"];
  return `${Number(v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0))}${unit}`;
}

/** Cash in the HUD: C$9,999, then C$12.5K, then C$1.25M (never wider than 7 characters). */
export function formatCashShort(n: number): string {
  return `C$${formatShort(n)}`;
}

/** Witty line for the birth lottery reveal, by how lucky the roll was. */
export function lotteryLine(cash: number, e: Economy = ECONOMY): string {
  const { min, max } = e.birthLottery;
  const t = (cash - min) / (max - min);
  if (t >= 0.85) return "Trust fund adjacent. Don't make it weird.";
  if (t >= 0.55) return "Comfortable. Your aunt will still ask what you do.";
  if (t >= 0.25) return "Enough for rent and one bad decision.";
  return "Character-building money. Very gritty. Very New York.";
}
