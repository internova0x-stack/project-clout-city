// Lucky Star Lotto (v0.10, docs/08-new-features-spec.md section 7). The numbers live in
// CITY_ECONOMY.lotto (lib/city.ts, seeded into the database); the server rules in
// supabase/migrations/0032_lucky_star_lotto.sql. The browser never decides anything: a card's prize
// is drawn by the server when the card is bought, kept out of reach until it's scratched, and paid by
// the server. These helpers only explain the odds and mirror the server's limits for the buttons.
// Dependency-free so tests can import it.

import { CITY_ECONOMY } from "./city.ts";

export type LottoGame = (typeof CITY_ECONOMY.lotto.games)[number];
export type LottoGameId = LottoGame["id"];

/** What lotto_state() tells the player: today's cards, this week's jackpot and cards not yet scratched. */
export interface LottoState {
  /** Free cards used today, and how many the player gets today (2 during the first 7 days). */
  freeUsed: number;
  freeToday: number;
  /** Bought cards today. */
  bought: number;
  /** When beginner's luck ends (ISO), or null once it has. */
  beginnerUntil: string | null;
  /** This week's jackpot (seed plus the share of every bought card) and the player's entries. */
  week: { start: string; pool: number; entries: number };
  /** Cards bought but not scratched yet (a closed tab, a lost connection): scratch them any time. */
  unscratched: { id: number; game: string }[];
  /** The last three jackpot draws, newest first (migration 0033; missing before it runs). */
  draws?: LottoDraw[];
}

/** A finished week's jackpot. `winner` is null when they keep out of the gossip (never for "mine"). */
export interface LottoDraw { week: string; pool: number; entries: number; drawnAt: string; mine: boolean; winner: string | null }

/** A card as the server hands it over: no prize until it's scratched. */
export interface LottoCard { id: number; game: string; prize?: number }

/** The badge for winning a weekly jackpot (migration 0033). */
export const LOTTO_BADGE = "lotto-jackpot";

export const LOTTO_GAMES: readonly LottoGame[] = CITY_ECONOMY.lotto.games;
export const lottoGame = (id: string): LottoGame | undefined => LOTTO_GAMES.find((g) => g.id === id);

/** The lotto counter is at places tagged "lotto". */
export const isLottoPlace = (tags: readonly string[]) => tags.some((t) => (CITY_ECONOMY.lotto.tags as readonly string[]).includes(t));

/** A card's prize table: amounts in C$ and "1 in N". */
export function prizeTable(game: LottoGame): { amount: number; oneIn: number; big: boolean; top: boolean }[] {
  const prizes = CITY_ECONOMY.lotto.prizes;
  return prizes.map((p, i) => ({
    amount: p.times * game.price,
    oneIn: 100_000 / p.per100k,
    big: p.times >= CITY_ECONOMY.lotto.bigFrom,
    top: i === prizes.length - 1,
  }));
}

export const topPrize = (game: LottoGame) => game.price * CITY_ECONOMY.lotto.prizes[CITY_ECONOMY.lotto.prizes.length - 1].times;

/** Mirrors lotto_prize (SQL): the prize for a roll from 0 to 99,999, top prize first. Previews and tests only. */
export function prizeFor(price: number, roll: number): number {
  let acc = 0;
  for (const p of [...CITY_ECONOMY.lotto.prizes].sort((a, b) => b.times - a.times)) {
    acc += p.per100k;
    if (roll < acc) return p.times * price;
  }
  return 0;
}

/** The chance any card wins something, and what it pays back on average (a share of its price). */
export function lottoOdds(): { anyOneIn: number; payback: number; bigOneIn: number } {
  const prizes = CITY_ECONOMY.lotto.prizes;
  const win = prizes.reduce((a, p) => a + p.per100k, 0);
  const payback = prizes.reduce((a, p) => a + p.times * p.per100k, 0) / 100_000;
  const big = prizes.filter((p) => p.times >= CITY_ECONOMY.lotto.bigFrom).reduce((a, p) => a + p.per100k, 0);
  return { anyOneIn: 100_000 / win, payback, bigOneIn: 100_000 / big };
}

/** "1 in 3.05", "1 in 100,000". */
export function oneInLine(n: number): string {
  return `1 in ${Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2)}`;
}

/** The jackpot's share of a bought card, in whole and part C$. */
export const jackpotCut = (game: LottoGame) => Math.round(game.price * CITY_ECONOMY.lotto.jackpot.cut * 100) / 100;

export type LottoAvailability = { ok: true } | { ok: false; reason: string };

/** Mirrors buy_lotto_card for the free card: the C$5 game, while today's free cards last. */
export function freeCardAvailability(s: LottoState): LottoAvailability {
  if (s.freeUsed >= s.freeToday) return { ok: false, reason: "Free cards are used up today. New ones at midnight." };
  return { ok: true };
}

/** Mirrors buy_lotto_card for a bought card: today's cap, then the cash. */
export function buyCardAvailability(game: LottoGame, s: LottoState, bankCash: number): LottoAvailability {
  if (s.bought >= CITY_ECONOMY.lotto.buyPerDay) return { ok: false, reason: `That's ${CITY_ECONOMY.lotto.buyPerDay} cards today. Benny cuts everyone off. New cards at midnight.` };
  if (bankCash < game.price) return { ok: false, reason: "Not enough cash for this card." };
  return { ok: true };
}

/** Benny's line after a card, by how it went. Fixed lines; never a "so close". */
export function bennyLine(prize: number, price: number, n: number): string {
  const won = [
    "See? Don't tell anyone. They'll all want one.",
    "Look at that. I'd buy one myself if I were an idiot.",
    "Money! Spend it on something with a warranty.",
  ];
  const big = [
    "I've been here nineteen years. I need to sit down.",
    "Okay. Okay. Take a picture. Not of me.",
  ];
  const back = ["Your money back. The universe says \"try again\", but quieter.", "Even. Like nothing happened. Very zen."];
  const lost = [
    "The cards can smell desperation. Come back calm.",
    "Not this time. The odds are on the wall. I keep saying.",
    "That's the fee for hope. Very reasonable, honestly.",
  ];
  const pick = (l: string[]) => l[Math.abs(n) % l.length];
  if (prize >= price * CITY_ECONOMY.lotto.bigFrom) return pick(big);
  if (prize > price) return pick(won);
  if (prize === price) return pick(back);
  return pick(lost);
}

/** Lola's line for the News card. Satire about the shop, never about the winner. */
export function jackpotLine(d: LottoDraw, name: string): string {
  const pot = `C$${d.pool.toLocaleString("en-US")}`;
  const entries = d.entries.toLocaleString("en-US");
  if (d.mine) return `It's you. You won last week's ${pot} jackpot at Lucky Star, out of ${entries} cards. Benny is pretending he isn't jealous. He is.`;
  const who = d.winner ? name : "A lucky Astorian";
  const lines = [
    `${who} walked into Lucky Star and walked out with the ${pot} jackpot. ${entries} cards were in the drum. Benny says he's happy for them, through his teeth.`,
    `Last week's ${pot} Lucky Star jackpot goes to ${d.winner ? name : "a lucky Astorian"}, out of ${entries} cards. Benny, who has never bought a ticket, calls it "fine".`,
  ];
  return lines[Number(d.week.replaceAll("-", "")) % lines.length];
}

const ERRORS: Record<string, string> = {
  lotto_not_here: "You're not at Lucky Star. The cards don't travel.",
  lotto_free_used: "Free cards are used up today. New ones at midnight.",
  lotto_not_free_game: "The free card is the Corner Store Classic.",
  lotto_daily_cap: `That's ${CITY_ECONOMY.lotto.buyPerDay} cards today. Benny cuts everyone off. New cards at midnight.`,
  lotto_cant_afford: "Not enough cash for this card.",
  lotto_unknown_game: "Benny's never heard of that one.",
  lotto_unknown_card: "That card isn't yours to scratch.",
  lotto_already_scratched: "Already scratched. The foil doesn't grow back.",
};

export function lottoError(message: string | undefined): string | null {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return null;
}
