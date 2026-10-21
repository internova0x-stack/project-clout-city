import { test } from "node:test";
import assert from "node:assert/strict";
import { CITY_ECONOMY, PLACES, citySeed } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";
import { TRAVEL_MODES, lineFor, lineName, travelQuote } from "../lib/travel.ts";
import { activeDelays, nyClock, transitLive, transitUntil, validateNewsWeek, type NewsItem } from "../lib/news.ts";

// Culture pack C4 (owner, Oct 20): lines, delays from News, the OMG Card, the green cab and the rideshare.

test("every Queens neighborhood with places or homes has a line; Astoria rides the N/W and Flushing the 7", () => {
  assert.equal(lineFor("Astoria"), "N/W");
  assert.equal(lineFor("Flushing"), "7");
  assert.equal(lineFor("Williamsburg"), null, "Brooklyn waits for its borough pack");
  for (const p of PLACES.filter((x) => !x.borough)) assert.ok(lineFor(p.neighborhood), `${p.id} (${p.neighborhood})`);
  const seed = citySeed();
  for (const h of ECONOMY.homes) assert.equal(seed.homeLines[h.id], lineFor(h.neighborhood), h.id);
  assert.equal(lineName("7"), "the 7 train");
  assert.equal(lineName("N/W"), "the N/W");
});

test("the green cab and the rideshare: the rideshare is quicker and dearer at every distance", () => {
  assert.equal(TRAVEL_MODES.find((m) => m.id === "taxi")!.label, "Green cab");
  for (const miles of [0.3, 1.5, 4, 8]) {
    const cab = travelQuote("taxi", miles, false);
    const ride = travelQuote("rideshare", miles, false);
    assert.ok(ride.fare > cab.fare && ride.seconds <= cab.seconds, `${miles} mi`);
  }
});

test("a delay slows only the subway; the OMG Card makes it free", () => {
  const plain = travelQuote("subway", 6, false);
  assert.equal(travelQuote("subway", 6, false, { delay: 20 }).seconds, plain.seconds + 20);
  assert.equal(travelQuote("taxi", 6, false, { delay: 20 }).seconds, travelQuote("taxi", 6, false).seconds);
  assert.equal(travelQuote("subway", 6, false, { pass: true }).fare, 0);
  assert.equal(plain.fare, CITY_ECONOMY.travel.subway.fare);
  const [week, month] = CITY_ECONOMY.travel.subway.passes;
  assert.ok(week.days === 7 && month.days === 30 && month.price < week.price * 30 / 7, "the month is the better deal");
  assert.ok(week.price > plain.fare * 7, "and a week costs more than a ride a day");
});

const week = (items: unknown[]) => validateNewsWeek({ week: "2026-10-19", items });
const base = { id: "mra-test", kind: "transit", day: "Wed", headline: "7 train delays this evening", body: "A signal is thinking about it. Expect delays on the 7." };

test("transit updates: a known line, a window that ends by midnight, a 10 to 30 second delay", () => {
  const ok = week([{ ...base, line: "7", from: "16:00", hours: 4, delay: 20 }]);
  assert.ok(ok.ok && ok.items[0].transit?.delay === 20 && ok.items[0].day === "2026-10-21");
  const bad = (x: object, re: RegExp) => { const r = week([{ ...base, ...x }]); assert.ok(!r.ok && r.problems.some((p) => re.test(p)), JSON.stringify(x)); };
  bad({ line: "L", from: "16:00", hours: 2 }, /line must be/);
  bad({ line: "7", from: "4pm", hours: 2 }, /from must be/);
  bad({ line: "7", from: "22:00", hours: 3 }, /end by midnight/);
  bad({ line: "7", from: "16:00", hours: 2, delay: 90 }, /10 to 30/);
  const city = validateNewsWeek({ week: "2026-10-19", items: [{ ...base, kind: "city", line: "7" }] });
  assert.ok(!city.ok && city.problems.some((p) => /transit updates only/.test(p)));
});

test("a delay counts only on its day, inside its window, and the longest one wins", () => {
  const at = (iso: string) => Date.parse(iso); // New York is UTC−4 in late October
  const item = (id: string, delay: number, from = "16:00", hours = 2): NewsItem =>
    ({ id, kind: "transit", headline: "h", body: "b", cast: [], day: "2026-10-21", transit: { line: "7", from, hours, delay } });
  assert.deepEqual(nyClock(at("2026-10-21T20:30:00Z")), { day: "2026-10-21", minutes: 16 * 60 + 30 });
  assert.ok(transitLive(item("a", 20), at("2026-10-21T20:30:00Z")));
  assert.ok(!transitLive(item("a", 20), at("2026-10-21T22:00:00Z")), "ended at 6 PM");
  assert.ok(!transitLive(item("a", 20), at("2026-10-22T20:30:00Z")), "another day");
  const d = activeDelays([item("a", 20), item("b", 28, "15:00", 3)], at("2026-10-21T20:30:00Z"));
  assert.equal(d["7"].seconds, 28);
  assert.equal(transitUntil({ line: "7", from: "16:00", hours: 4 }), "until 8 PM");
});

test("the preview simulator: delays, the card, showtime once a day", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const api = createSimApi(sampleCityState({ bank_cash: 1000, at_place: "ditmars-deli", transit_pass_until: null }), () => null, () => false,
    { delayFor: (line) => (line === "7" ? 25 : 0), showtimeChance: 1 });
  const go = await api.travel!("queensborough-u", "subway");
  assert.ok(go.ok && go.trip?.line === "7" && go.trip.delay === 25 && go.trip.showtime);
  const watch = await api.watchShowtime!();
  assert.ok(watch.ok && watch.gain?.clout === CITY_ECONOMY.travel.subway.showtime.clout);
  assert.ok(!(await api.watchShowtime!()).ok, "the dancers got off");
  const buy = await api.buyTransitPass!("week");
  assert.ok(buy.ok && buy.gain?.cash === -70 && buy.state.player.transit_pass_until);
  const free = await api.travel!("ditmars-deli", "subway");
  assert.ok(free.ok && free.gain?.cash === 0 && free.trip?.line === "N/W" && free.trip.delay === 0 && !free.trip.showtime, "free ride, no second showtime today");
});
