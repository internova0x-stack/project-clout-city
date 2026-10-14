import assert from "node:assert/strict";
import test from "node:test";
import { CITY_ECONOMY, PLACES } from "../lib/city.ts";
import { LOTTO_GAMES, buyCardAvailability, cardCells, freeCardAvailability, lottoOdds, potOdds, prizeFor, prizeTable, topPrize, type LottoState } from "../lib/lotto.ts";
import { cityError } from "../lib/cityState.ts";
import { createSimApi, sampleCityState } from "../lib/citySim.ts";

const L = CITY_ECONOMY.lotto;

test("five games from C$5 to C$100, each top prize 1,000 times the card", () => {
  assert.deepEqual(LOTTO_GAMES.map((g) => g.price), [5, 10, 20, 50, 100]);
  assert.deepEqual(LOTTO_GAMES.map(topPrize), [5000, 10000, 20000, 50000, 100000]);
  assert.equal(LOTTO_GAMES.find((g) => g.id === L.freeGame)?.price, 5, "the free card is the C$5 game");
});

test("the prize table: fixed odds in whole cards per 100,000, a C$ sink", () => {
  for (const p of L.prizes) assert.ok(Number.isInteger(100_000 / p.per100k), `1 in ${100_000 / p.per100k} is a whole number`);
  const o = lottoOdds();
  assert.equal(o.payback, 0.605);
  assert.ok(o.payback + L.potCut < 1, "prizes plus the pot share pay back less than the card");
  assert.equal(Number(o.anyOneIn.toFixed(2)), 3.05);
  // Spec: about 1 to 2% of active players win a big prize in a month. A player scratching about
  // two cards a day (the free one and one more) scratches about 60 a month.
  const monthly = 1 - (1 - 1 / o.bigOneIn) ** 60;
  assert.ok(monthly > 0.01 && monthly < 0.02, `big prize in a month: ${(monthly * 100).toFixed(2)}%`);
  assert.deepEqual(prizeTable(LOTTO_GAMES[4]).map((p) => p.amount), [100, 200, 500, 2000, 10000, 100000]);
});

test("prizeFor walks the table like lotto_prize in SQL", () => {
  let paid = 0, wins = 0;
  for (let r = 0; r < 100_000; r++) { const p = prizeFor(100, r); paid += p; if (p) wins++; }
  assert.equal(paid, 6_050_000);
  assert.equal(wins, 32_771);
  assert.equal(prizeFor(100, 0), 100_000, "the top prize is one roll in 100,000");
  assert.equal(prizeFor(100, 99_999), 0);
});

test("no gold on lotto tickets (gold is real money only)", () => {
  for (const g of LOTTO_GAMES) assert.ok(!["#FEF3C0", "#E1BC85", "#AD8759", "#7E5932"].includes(g.color.toUpperCase()), g.id);
});

test("Lucky Star is in Flushing, outside Astoria, and sells cards", () => {
  const p = PLACES.find((x) => x.id === "lucky-star");
  assert.ok(p && p.neighborhood === "Flushing" && p.tags.includes("lotto") && p.template === "lotto");
});

test("limits mirror the server: free cards, then five bought a day, then cash", () => {
  const s: LottoState = { freeUsed: 0, freeToday: 2, bought: 0, beginnerUntil: null, pots: [], unscratched: [] };
  assert.equal(freeCardAvailability(s).ok, true);
  assert.equal(freeCardAvailability({ ...s, freeUsed: 2 }).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], { ...s, bought: 5 }, 1000).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], s, 99).ok, false);
  assert.equal(buyCardAvailability(LOTTO_GAMES[4], s, 100).ok, true);
  assert.match(cityError("lotto_daily_cap"), /5 cards today/);
  assert.match(cityError("not_here"), /Go there first/, "city errors keep their own wording");
});

test("the preview sim pays exactly what the card says, once", async () => {
  const sim = createSimApi(sampleCityState({ at_place: "lucky-star", bank_cash: 1000 }));
  sim.lottoNext([5, 0]);
  const a = await sim.buyLottoCard!("lucky-star", "rents-due", false);
  assert.ok(a.ok && a.card && a.card.prize === undefined, "a bought card hides its prize");
  assert.equal(a.ok && a.state.player.bank_cash, 980);
  const s = await sim.scratchLottoCard!(a.ok ? a.card!.id : 0);
  assert.ok(s.ok && s.card?.prize === 100 && s.state.player.bank_cash === 1080);
  assert.equal((await sim.scratchLottoCard!(a.ok ? a.card!.id : 0)).ok, false, "one scratch per card");
  assert.equal((await sim.buyLottoCard!("lucky-star", "main-character", true)).ok, false, "the free card is the C$5 game");
});

test("pots (owner, Oct 14): bigger and harder for every game; daily small games, weekly big ones", () => {
  assert.deepEqual(LOTTO_GAMES.map((g) => g.pot.seed), [5000, 10000, 15000, 50000, 100000]);
  assert.deepEqual(LOTTO_GAMES.map((g) => g.pot.oneIn), [5000, 10000, 20000, 50000, 100000]);
  assert.deepEqual(LOTTO_GAMES.map((g) => g.period), ["day", "day", "day", "week", "week"]);
  // Harder for every game: the chance of the pot falls, and so does what the seed is worth per C$.
  const shares = LOTTO_GAMES.map((g) => potOdds(g).share);
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] < shares[i - 1], `pot value per C$ falls: ${shares}`);
  // Still a sink: prizes, the seed's worth and the cut that goes back out stay under the card's price.
  for (const g of LOTTO_GAMES) assert.ok(lottoOdds().payback + potOdds(g).share + L.potCut < 1, g.id);
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
  assert.equal(pool, 100_000, "the pot starts over at its seed");
  const s = await sim.scratchLottoCard!(a.ok ? a.card!.id : 0);
  assert.ok(s.ok && (s.card?.pot ?? 0) > 100_000 && s.card?.numbers?.some((c) => c.n === 0));
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
