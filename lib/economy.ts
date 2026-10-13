// v0.2 economy and onboarding content. The live values sit in the database
// (game_settings, seeded by supabase/migrations/0003_first_party.sql) so they can
// be tuned without a deploy; these are the same defaults, used by the UI and
// checked against the migration by tests/economy.test.ts.

export interface Home {
  id: string;
  name: string;
  neighborhood: string;
  rent: number;
  blurb: string;
  emoji: string;
}

export interface Trait { id: string; emoji: string; name: string; blurb: string }

export interface Economy {
  birthLottery: { min: number; max: number; step: number };
  phoneBill: number;
  firstParty: { entry: number; cashReward: number; cloutReward: number; confidence: number; energy: number };
  invites: { cloutPerInvite: number; cliqueSize: number; cliqueBonus: number };
  startingStats: { energy: number; mood: number; confidence: number };
  playersOnlineThreshold: number;
  homes: Home[];
}

export const ECONOMY: Economy = {
  birthLottery: { min: 6000, max: 10000, step: 100 },
  phoneBill: 85,
  firstParty: { entry: 150, cashReward: 300, cloutReward: 100, confidence: 15, energy: 20 },
  invites: { cloutPerInvite: 50, cliqueSize: 5, cliqueBonus: 500 },
  startingStats: { energy: 100, mood: 60, confidence: 40 },
  playersOnlineThreshold: 1,
  homes: [
    { id: "astoria_studio", name: "Astoria studio walk-up", neighborhood: "Astoria", rent: 2100, emoji: "🪜", blurb: "Fourth floor, no elevator. Free leg day, every day." },
    { id: "jackson_heights_1br", name: "Jackson Heights 1BR", neighborhood: "Jackson Heights", rent: 3200, emoji: "🛋️", blurb: "A real bedroom door. Your parents will finally be proud." },
    { id: "lic_highrise", name: "Long Island City high-rise", neighborhood: "Long Island City", rent: 5900, emoji: "🌆", blurb: "Skyline view, rooftop pool, rent that should be illegal." },
  ],
};

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
  return `$${Math.round(n).toLocaleString("en-US")}`;
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
