import assert from "node:assert/strict";
import test from "node:test";
import { CITY_ECONOMY, PLACES } from "../lib/city.ts";
import { LOTTO_GAMES, buyCardAvailability, freeCardAvailability, lottoOdds, prizeFor, prizeTable, topPrize, type LottoState } from "../lib/lotto.ts";
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
  assert.ok(o.payback + L.jackpot.cut < 1, "prizes plus the jackpot share pay back less than the card");
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
  const s: LottoState = { freeUsed: 0, freeToday: 2, bought: 0, beginnerUntil: null, week: { start: "2026-10-12", pool: 5000, entries: 0 }, unscratched: [] };
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

test("Lola's jackpot card names the winner only when they allow it", async () => {
  const { jackpotLine } = await import("../lib/lotto.ts");
  const base = { week: "2026-10-05", pool: 6120, entries: 1840, drawnAt: "2026-10-12T04:00:00Z", mine: false };
  assert.match(jackpotLine({ ...base, winner: "dana.vibes" }, "@dana.vibes"), /@dana\.vibes/);
  const hidden = jackpotLine({ ...base, winner: null }, "@nobody");
  assert.ok(!hidden.includes("@nobody") && /lucky Astorian/i.test(hidden), hidden);
  assert.match(jackpotLine({ ...base, mine: true, winner: "me" }, "@me"), /^It's you/);
  assert.match(jackpotLine({ ...base, winner: null }, ""), /C\$6,120/);
});
