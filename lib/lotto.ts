// Lucky Star Lotto (v0.10, docs/08-new-features-spec.md section 7). The numbers live in
// CITY_ECONOMY.lotto (lib/city.ts, seeded into the database); the server rules in
// supabase/migrations/0032_lucky_star_lotto.sql and 0041_lotto_pots.sql. The browser never decides
// anything: a card's prize, its pot win and its numbers are drawn by the server when the card is
// bought, kept out of reach until it's scratched, and paid by the server. These helpers only explain
// the odds and mirror the server's limits for the buttons.
// Dependency-free so tests can import it.

import { CITY_ECONOMY } from "./city.ts";

export type LottoGame = (typeof CITY_ECONOMY.lotto.games)[number];
export type LottoGameId = LottoGame["id"];

/** A game's pot right now (migration 0041): its lucky number, the pot and the day or week it runs. */
export interface LottoPot { game: string; lucky: number; pool: number; period: string }

/** A pot someone won. `winner` is null when they keep out of the gossip (never for "mine"). */
export interface LottoWin { game: string; amount: number; wonAt: string; mine: boolean; winner: string | null }

/** One of the player's numbers on a card and the prize under it; n = 0 is the ⭐ (the pot). */
export interface LottoCell { n: number; prize: number }

/** What lotto_state() tells the player: today's cards, every game's pot and cards not yet scratched. */
export interface LottoState {
  /** Free cards used today, and how many the player gets today (2 during the first 7 days). */
  freeUsed: number;
  freeToday: number;
  /** Bought cards today. */
  bought: number;
  /** When beginner's luck ends (ISO), or null once it has. */
  beginnerUntil: string | null;
  /** Every game's lucky number and pot (migration 0041). */
  pots: LottoPot[];
  /** Cards bought but not scratched yet (a closed tab, a lost connection): scratch them any time. */
  unscratched: { id: number; game: string }[];
  /** The last three pots won, newest first, for Lola's News card. */
  wins?: LottoWin[];
}

/** A card as the server hands it over: nothing but its id until it's scratched. */
export interface LottoCard { id: number; game: string; prize?: number; pot?: number; lucky?: number; numbers?: LottoCell[] }

/** The badge for winning a pot (it was the weekly jackpot's, migration 0033). */
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

/** A game's pot: what it starts at, "1 in N" cards and what the seed is worth per card (a share of the price). */
export function potOdds(game: LottoGame): { seed: number; oneIn: number; share: number } {
  return { seed: game.pot.seed, oneIn: game.pot.oneIn, share: game.pot.seed / game.pot.oneIn / game.price };
}

/** "C$5 game · new number at midnight" / "… every Monday". */
export const periodLine = (game: LottoGame) => (game.period === "day" ? "New number and pot every midnight" : "New number every Monday; the pot grows all week");

/**
 * The player's numbers on a card, as the server lays them out (lotto_numbers, migration 0041): a
 * prize puts the lucky number in one cell with that prize, a pot win puts a ⭐ (0) in another, and
 * every other cell gets a different number with a prize it doesn't pay. `rand(n)` is 0 to n - 1.
 * Previews and tests only; players' cards come from the server.
 */
export function cardCells(price: number, prize: number, pot: number, lucky: number, rand: (n: number) => number): LottoCell[] {
  const L = CITY_ECONOMY.lotto;
  const decoys = L.prizes.filter((p) => p.times <= 100).map((p) => p.times * price);
  const cells: LottoCell[] = [];
  const used = new Set<number>([lucky, 0]);
  while (cells.length < L.cells) {
    const n = 1 + rand(L.luckyMax);
    if (used.has(n)) continue;
    used.add(n);
    cells.push({ n, prize: decoys[rand(decoys.length)] });
  }
  const at = rand(L.cells);
  if (prize > 0) cells[at] = { n: lucky, prize };
  if (pot > 0) cells[prize > 0 ? (at + 1 + rand(L.cells - 1)) % L.cells : at] = { n: 0, prize: pot };
  return cells;
}

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
export function potWinLine(w: LottoWin, name: string): string {
  const pot = `C$${w.amount.toLocaleString("en-US")}`;
  const game = lottoGame(w.game)?.name ?? "a Lucky Star card";
  if (w.mine) return `It's you, babe! A ⭐ on your ${game} card just won the ${pot} pot at Lucky Star. Benny says he isn't jealous. Benny is lying.`;
  const who = w.winner ? name : "A lucky Astorian";
  const lines = [
    `${who} scratched a ⭐ on ${game} and strutted out of Lucky Star with the ${pot} pot. Benny's "happy for them," through his teeth. I have the photos.`,
    `The ${pot} ${game} pot goes to ${w.winner ? name : "a lucky Astorian"}. Benny, who has never bought a ticket, calls it "fine." Sweetie, it's more than fine.`,
  ];
  return lines[Math.floor(Date.parse(w.wonAt) / 60_000) % lines.length];
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
