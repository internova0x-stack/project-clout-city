import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_LOCATIONS, placeById } from "../lib/city.ts";
import { distanceBand, milesBetween, travelQuote } from "../lib/travel.ts";

test("bands follow the owner's table (Oct 13)", () => {
  assert.deepEqual([0.2, 1.4, 3, 8].map(distanceBand), [0, 1, 2, 3]);
  assert.deepEqual([0.2, 1.4, 3, 8].map((m) => travelQuote("taxi", m, false).fare), [8, 16, 28, 45]);
  assert.deepEqual([0.2, 1.4, 3].map((m) => travelQuote("walk", m, false).energy), [5, 10, 20]);
  assert.equal(travelQuote("walk", 8, false).unavailable, "Too far to walk");
  assert.equal(travelQuote("subway", 8, false).fare, 3);
  assert.equal(travelQuote("car", 3, false).unavailable !== undefined, true);
  assert.equal(travelQuote("car", 3, true).fare, 0);
});

test("trips are short: 3 to 10 seconds", () => {
  for (const m of [0.2, 1.4, 3, 8]) for (const mode of ["walk", "subway", "taxi", "car"] as const) {
    const q = travelQuote(mode, m, true);
    if (!q.unavailable) assert.ok(q.seconds >= 3 && q.seconds <= 10, `${mode} at ${m} mi`);
  }
});

test("miles are real distances", () => {
  const home = HOME_LOCATIONS.astoria_studio;
  const d = milesBetween(home, placeById("hell-gate-park")!.at);
  assert.ok(d > 0.1 && d < 3, `Astoria studio to Hell Gate Park: ${d}`);
  assert.equal(milesBetween(home, home), 0);
});

test("rest is home only and capped; the bar sells Energy at clubs and the lounge (v0.8 step 2)", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const { hasBar, restAvailability } = await import("../lib/cityState.ts");
  const { CITY_ECONOMY, PLACES } = await import("../lib/city.ts");
  assert.deepEqual(PLACES.filter((p) => hasBar(p.tags)).map((p) => p.id).sort(), ["hellgate-hall", "low-light-lounge", "velvet-static"].sort());
  const api = createSimApi(sampleCityState({ energy: 10, mood: 50 }));
  const nap = await api.rest!("nap");
  assert.ok(nap.ok && nap.gain?.energy === 30);
  assert.ok((await api.rest!("nap")).ok);
  const third = await api.rest!("nap");
  assert.ok(!third.ok && /rested enough/.test(third.error));
  const sit = await api.rest!("sit");
  assert.ok(sit.ok && sit.gain?.energy === 10 && sit.gain?.mood === 6);
  assert.equal(restAvailability("nap", sit.state).ok, false);
  assert.equal(restAvailability("sit", sit.state).ok, true);
  // Out at the club: no napping, but the bar is open.
  assert.equal((await api.barDrink!("velvet-static")).ok, false, "not there yet");
  await api.travel!("velvet-static", "taxi");
  const out = await api.rest!("sit");
  assert.ok(!out.ok && /Go home first/.test(out.error));
  const drink = await api.barDrink!("velvet-static");
  assert.ok(drink.ok && drink.gain?.cash === -CITY_ECONOMY.barDrink.price && drink.gain?.energy === 20);
  assert.equal(drink.ok && drink.state.player.clout, sit.ok && sit.state.player.clout, "no clout");
  assert.equal((await api.barDrink!("lucky-seven-deli")).ok, false, "no bar at the deli");
});
