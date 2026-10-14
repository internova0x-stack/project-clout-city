import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_LOCATIONS, placeById } from "../lib/city.ts";
import { distanceBand, milesBetween, skipCost, travelQuote, tripSeconds } from "../lib/travel.ts";

test("bands follow the owner's table (Oct 13)", () => {
  assert.deepEqual([0.2, 1.4, 3, 8].map(distanceBand), [0, 1, 2, 3]);
  assert.deepEqual([0.2, 1.4, 3, 8].map((m) => travelQuote("taxi", m, false).fare), [18, 35, 60, 95]);
  assert.deepEqual([0.2, 1.4, 3].map((m) => travelQuote("walk", m, false).energy), [5, 10, 20]);
  assert.equal(travelQuote("walk", 8, false).unavailable, "Too far to walk");
  assert.equal(travelQuote("subway", 8, false).fare, 6);
  assert.equal(travelQuote("car", 3, false).unavailable !== undefined, true);
  assert.equal(travelQuote("car", 3, true).fare, 0);
});

test("trips take longer the farther they go, up to a minute (#13)", () => {
  for (const mode of ["walk", "subway", "taxi", "car"] as const) {
    const times = [0, 0.3, 1.4, 3, 8].map((m) => tripSeconds(mode, m));
    for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], `${mode} grows with distance`);
    assert.ok(times[0] >= 5 && times.at(-1)! <= 60, `${mode}: ${times}`);
  }
  assert.equal(tripSeconds("walk", 3), 60);
  assert.equal(tripSeconds("taxi", 0.4), 9);
  assert.equal(travelQuote("taxi", 0.4, false).seconds, 9);
});

test("skipping costs C$1 per 2 seconds left, at least C$5 (#13, matches skip_trip)", () => {
  assert.equal(skipCost(0), 0);
  assert.equal(skipCost(3), 5);
  assert.equal(skipCost(40), 20);
  assert.equal(skipCost(41), 21);
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

test("groceries fill the fridge at the supermarket; cooking at home empties it (v0.8 step 3)", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const { cookAvailability, groceryAvailability, isSupermarket } = await import("../lib/cityState.ts");
  const { CITY_ECONOMY, PLACES } = await import("../lib/city.ts");
  const g = CITY_ECONOMY.groceries;
  // Cooking is the budget option: cheaper per Energy than any meal out.
  const perEnergy = Math.min(...g.bundles.map((b) => b.price / b.meals)) / g.cook.energy;
  const cheapestOut = Math.min(...PLACES.flatMap((p) => p.actions).filter((a) => a.kind === "eat" && (a.price ?? 0) > 0 && a.energy < 0).map((a) => a.price! / -a.energy));
  assert.ok(perEnergy < cheapestOut, `cooking ${perEnergy.toFixed(2)} vs eating out ${cheapestOut.toFixed(2)} per Energy`);
  assert.deepEqual(PLACES.filter((p) => isSupermarket(p.tags)).map((p) => p.id), ["steinway-fresh"]);

  const api = createSimApi(sampleCityState({ energy: 40, fridge_meals: 0 }));
  const prep = g.bundles.find((b) => b.id === "meal-prep")!;
  const empty = await api.cook!();
  assert.ok(!empty.ok && /fridge is empty/.test(empty.error));
  assert.equal((await api.buyGroceries!("steinway-fresh", "meal-prep")).ok, false, "be there first");
  await api.travel!("steinway-fresh", "taxi");
  const bought = await api.buyGroceries!("steinway-fresh", "meal-prep");
  assert.ok(bought.ok && bought.gain?.cash === -prep.price && bought.state.player.fridge_meals === 7);
  assert.ok((await api.buyGroceries!("steinway-fresh", "snack-run")).ok);
  const full = await api.buyGroceries!("steinway-fresh", "snack-run");
  assert.ok(!full.ok && /fridge is full/.test(full.error));
  assert.deepEqual(groceryAvailability(g.bundles[0], { ...bought.state, player: { ...bought.state.player, fridge_meals: 9 } }), { ok: false, reason: "Your fridge only has room for 1 more" });
  const away = await api.cook!();
  assert.ok(!away.ok && /Go home first/.test(away.error));
  const home = await api.travel!("home", "taxi");
  assert.ok(home.ok && cookAvailability(home.state).ok);
  const meal = await api.cook!();
  assert.ok(meal.ok && meal.gain?.energy === g.cook.energy && meal.state.player.fridge_meals === 8);
  assert.equal(meal.ok && meal.state.items.length, home.ok && home.state.items.length, "groceries are not possessions");
});

test("monument plazas: each activity's boost once a day, clout once per place (v0.9, option A)", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const { PLACES } = await import("../lib/city.ts");
  for (const id of ["unisphere", "gantry-plaza"]) assert.equal(PLACES.find((p) => p.id === id)?.actions.length, 5, `${id} has five activities`);
  const api = createSimApi(sampleCityState({ energy: 90, mood: 40, confidence: 40 }));
  await api.travel!("unisphere", "taxi");
  const pose = await api.doAction("unisphere", "visit");
  assert.ok(pose.ok && pose.gain?.clout === 20 && pose.gain?.mood === 6);
  const tour = await api.doAction("unisphere", "tour");
  assert.ok(tour.ok && tour.gain?.confidence === 5 && tour.gain?.clout === 0, "a second activity still lifts its stat, no clout");
  const again = await api.doAction("unisphere", "tour");
  assert.ok(again.ok && again.gain?.confidence === 0, "the same activity twice: no second boost");
});
