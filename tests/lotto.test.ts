import assert from "node:assert/strict";
import test from "node:test";
import { CITY_ECONOMY, PLACES } from "../lib/city.ts";
import { LOTTO_GAMES, buyCardAvailability, cardCells, freeCardAvailability, lottoOdds, potOdds, prizeFor, prizeTable, topPrize, type LottoState } from "../lib/lotto.ts";
import { cityError } from "../lib/cityState.ts";
import { createSimApi, sampleCityState } from "../lib/citySim.ts";

const L = CITY_ECONOMY.lotto;

test("five games from C$200 to C$600 (owner, Nov 16), each regular top prize 20 times the card", () => {
  assert.deepEqual(LOTTO_GAMES.map((g) => g.price), [200, 300, 400, 500, 600]);
  assert.deepEqual(LOTTO_GAMES.map(topPrize), [4000, 6000, 8000, 10000, 12000]);
  assert.equal(LOTTO_GAMES.find((g) => g.id === L.freeGame)?.price, 200, "the free card is the cheapest game");
});

test("the prize table (owner, Nov 16): fixed odds, nothing rarer than 1 in 100", () => {
  for (const p of L.prizes) assert.ok(Number.isInteger(100_000 / p.per100k), `1 in ${100_000 / p.per100k} is a whole number`);
  for (const p of L.prizes) assert.ok(100_000 / p.per100k <= 100, `1 in ${100_000 / p.per100k}`);
  for (const g of LOTTO_GAMES) assert.ok(g.pot.oneIn <= 100, g.id);
  const o = lottoOdds();
  assert.equal(o.payback, 0.725);
  assert.equal(Number(o.anyOneIn.toFixed(2)), 2.99);
  assert.deepEqual(prizeTable(LOTTO_GAMES[4]).map((p) => p.amount), [600, 1200, 3000, 12000]);
});

test("prizeFor walks the table like lotto_prize in SQL", () => {
  let paid = 0, wins = 0;
  for (let r = 0; r < 100_000; r++) { const p = prizeFor(100, r); paid += p; if (p) wins++; }
  assert.equal(paid, 7_250_000);
  assert.equal(wins, 33_500);
  assert.equal(prizeFor(100, 0), 2_000, "the top regular prize is one roll in 100");
  assert.equal(prizeFor(100, 99_999), 0);
});

test("no gold on lotto tickets (gold is real money only)", () => {
  for (const g of LOTTO_GAMES) assert.ok(!["#FEF3C0", "#E1BC85", "#AD8759", "#7E5932"].includes(g.color.toUpperCase()), g.id);
});

test("Lucky Star is on Main Street in Flushing (Queens, open from day one; owner Oct 21) and sells cards", () => {
  const p = PLACES.find((x) => x.id === "lucky-star");
  assert.ok(p && p.neighborhood === "Flushing" && p.borough === undefined && p.tags.includes("lotto") && p.template === "lotto");
});

test("limits mirror the server: free cards, then five bought a day and 15 a week, then cash", () => {
  const s: LottoState = { freeUsed: 0, freeToday: 2, bought: 0, boughtWeek: 0, beginnerUntil: null, pots: [], unscratched: [] };
  assert.equal(freeCardAvailability(s).ok, true);
  assert.equal(freeCardAvailability({ ...s, freeUsed: 2 }).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], { ...s, bought: 5 }, 10000).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], { ...s, boughtWeek: 15 }, 10000).ok, false, "the weekly limit");
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], s, 599).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], s, 600).ok, true);
  assert.match(cityError("lotto_weekly_cap"), /15 cards this week/);
  assert.match(cityError("lotto_daily_cap"), /5 cards today/);
  assert.match(cityError("not_here"), /Go there first/, "city errors keep their own wording");
});

test("the preview sim pays exactly what the card says, once", async () => {
  const sim = createSimApi(sampleCityState({ at_place: "lucky-star", bank_cash: 1000 }));
  sim.lottoNext([5, 0]);
  const a = await sim.buyLottoCard!("lucky-star", "rents-due", false);
  assert.ok(a.ok && a.card && a.card.prize === undefined, "a bought card hides its prize");
  assert.equal(a.ok && a.state.player.bank_cash, 600);
  const s = await sim.scratchLottoCard!(a.ok ? a.card!.id : 0);
  assert.ok(s.ok && s.card?.prize === 2000 && s.state.player.bank_cash === 2600);
  assert.equal((await sim.scratchLottoCard!(a.ok ? a.card!.id : 0)).ok, false, "one scratch per card");
  assert.equal((await sim.buyLottoCard!("lucky-star", "main-character", true)).ok, false, "the free card is the cheapest game");
});

test("pots (owner, Nov 16): fixed amounts you can believe in, with a weekly limit as the safeguard", () => {
  assert.deepEqual(LOTTO_GAMES.map((g) => g.pot.seed), [5000, 10000, 20000, 50000, 100000]);
  assert.deepEqual(LOTTO_GAMES.map((g) => g.pot.oneIn), [25, 30, 40, 50, 100]);
  assert.deepEqual(LOTTO_GAMES.map((g) => g.period), ["day", "day", "day", "week", "week"]);
  assert.equal(L.potCut, 0, "pots don't grow: the full amount every time");
  // The owner chose generous pots (cards pay back more than they cost) and capped the volume instead.
  for (const g of LOTTO_GAMES) assert.ok(lottoOdds().payback + potOdds(g).share > 1, g.id);
  assert.equal(L.buyPerWeek, 15);
  assert.ok(L.buyPerWeek > L.buyPerDay);
});

test("card numbers: the prize sits under the lucky number, the pot under a star, no repeats", () => {
  let seed = 7;
  const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
  for (let k = 0; k < 200; k++) {
    const prize = [0, 5, 25][k % 3], pot = k % 4 === 0 ? 5100 : 0, lucky = 1 + (k % 40);
    const cells = cardCells(5, prize, pot, lucky, rand);
    assert.equal(cells.length, L.cells);
    assert.equal(new Set(cells.map((c) => c.n)).size, L.cells, "no number twice");
    const hits = cells.filter((c) => c.n === lucky);
    assert.equal(hits.length, prize ? 1 : 0, "the lucky number shows exactly when there's a prize");
    if (prize) assert.equal(hits[0].prize, prize);
    const stars = cells.filter((c) => c.n === 0);
    assert.equal(stars.length, pot ? 1 : 0);
    if (pot) assert.equal(stars[0].prize, pot);
  }
});

test("the preview sim pays the pot with the card, once, and starts the pot over", async () => {
  const sim = createSimApi(sampleCityState({ at_place: "lucky-star", bank_cash: 1000 }));
  sim.lottoNext([0]);
  sim.lottoPot();
  const a = await sim.buyLottoCard!("lucky-star", "main-character", false);
  assert.ok(a.ok);
  const pool = a.ok ? a.state.lotto!.pots.find((p) => p.game === "main-character")!.pool : 0;
  assert.equal(pool, 100_000, "the pot starts over at its amount");
  const s = await sim.scratchLottoCard!(a.ok ? a.card!.id : 0);
  assert.ok(s.ok && s.card?.pot === 100_000 && s.card?.numbers?.some((c) => c.n === 0));
  assert.ok(s.ok && s.state.lotto!.wins![0].mine);
});

test("Lola's pot card names the winner only when they allow it", async () => {
  const { potWinLine } = await import("../lib/lotto.ts");
  const base = { game: "bodega-cat", amount: 10640, wonAt: "2026-10-12T04:00:00Z", mine: false };
  assert.match(potWinLine({ ...base, winner: "dana.vibes" }, "@dana.vibes"), /@dana\.vibes/);
  const hidden = potWinLine({ ...base, winner: null }, "@nobody");
  assert.ok(!hidden.includes("@nobody") && /lucky Astorian/i.test(hidden), hidden);
  assert.match(potWinLine({ ...base, mine: true, winner: "me" }, "@me"), /^It's you/);
  assert.match(potWinLine({ ...base, winner: null }, ""), /C\$10,640/);
});

test("the rent warning (owner, Nov 16): a card that would leave the bank short of what's owed asks first", async () => {
  const { rentShortAfter } = await import("../lib/lotto.ts");
  assert.equal(rentShortAfter(400, 1000, 485), false, "C$600 left covers C$485 owed");
  assert.equal(rentShortAfter(600, 1000, 485), true, "C$400 left doesn't");
  assert.equal(rentShortAfter(600, 1000, 0), false, "nothing owed, nothing to warn about");
});
