import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACES, closedLine, hoursLine, placeOpen, realMinutesUntilPlaceOpens } from "../lib/city.ts";
import { rememberedLine, type NpcProfile } from "../lib/culture.ts";

// Culture pack C2 (owner, Oct 20): Astoria food, opening hours on the city clock, Sal remembers your order.
const FOOD = ["still-a-dollar-slice", "white-sauce-cart", "boiled-and-beloved", "feta-compli", "schlep-and-schmear"];
const place = (id: string) => PLACES.find((p) => p.id === id)!;
const at = (h: number) => h * 60 + 30;

test("the new food places: Astoria, a tier, a meal that restores that tier's Energy, and hours", () => {
  const energy = { Budget: [10, 25], Medium: [26, 35] } as const;
  for (const id of FOOD) {
    const p = place(id);
    assert.equal(p.neighborhood, "Astoria", id);
    assert.ok(p.tier === "Budget" || p.tier === "Medium", `${id}: tier`);
    assert.ok(p.tags.includes(`dining_${p.tier!.toLowerCase()}`), `${id}: dining tag matches the tier`);
    assert.ok(p.hours && p.hours.open !== p.hours.close && [p.hours.open, p.hours.close].every((h) => h >= 0 && h <= 23), `${id}: hours`);
    const [lo, hi] = energy[p.tier as keyof typeof energy];
    for (const a of p.actions.filter((x) => x.kind === "eat")) assert.ok(-a.energy >= lo && -a.energy <= hi, `${id}/${a.id}: ${-a.energy} Energy`);
  }
  assert.equal(place("ditmars-deli").hours, undefined, "Sal's stays open all night");
});

test("the BEC is the cheapest breakfast, Also Sal is pettable, and the combo is two slices and a soda", () => {
  const sal = place("ditmars-deli");
  const bec = sal.actions.find((a) => a.id === "bec")!;
  assert.ok(bec.kind === "eat" && bec.price! < sal.actions.find((a) => a.id === "eat")!.price!);
  const breakfasts = PLACES.flatMap((p) => p.actions).filter((a) => a.kind === "eat" && /breakfast|pancake|egg|bagel/i.test(`${a.label} ${a.blurb}`));
  assert.equal(Math.min(...breakfasts.map((a) => a.price!)), bec.price);
  const cat = sal.actions.find((a) => a.id === "pet-cat")!;
  assert.ok(cat.mood! > 0 && cat.mood! <= 5 && !cat.price, "a small Mood boost, free");
  assert.match(place("still-a-dollar-slice").actions.find((a) => a.id === "combo")!.label, /two slices and a soda/i);
});

test("opening hours: past midnight, and when a shut place opens", () => {
  const cart = place("white-sauce-cart"); // 6 PM to 5 AM
  assert.ok(placeOpen(cart, at(23)) && placeOpen(cart, at(0)) && placeOpen(cart, at(4)));
  assert.ok(!placeOpen(cart, at(5)) && !placeOpen(cart, at(12)));
  const slice = place("still-a-dollar-slice"); // 10 AM to 1 AM
  assert.ok(placeOpen(slice, at(0)) && !placeOpen(slice, at(3)) && placeOpen(slice, at(10)));
  const deli = place("schlep-and-schmear"); // 7 AM to 9 PM
  assert.ok(placeOpen(deli, at(7)) && !placeOpen(deli, at(21)));
  assert.equal(hoursLine(cart), "Open 6 PM to 5 AM");
  assert.equal(realMinutesUntilPlaceOpens(cart, 17 * 60), 5, "one city hour is five real minutes");
  assert.equal(closedLine(cart, 17 * 60), "Closed · opens 6 PM (in 5 min)");
  assert.equal(realMinutesUntilPlaceOpens(cart, at(20)), 0);
  // At any hour, somewhere in Astoria is serving food.
  for (let h = 0; h < 24; h++) assert.ok(PLACES.some((p) => p.neighborhood === "Astoria" && p.actions.some((a) => a.kind === "eat") && placeOpen(p, at(h))), `food at ${h}:30`);
  // The halal cart is the only new place serving at 3 AM.
  assert.deepEqual(FOOD.filter((id) => placeOpen(place(id), at(3))), ["white-sauce-cart"]);
});

test("Sal remembers your order after three different days", () => {
  const profiles = JSON.parse(readFileSync(new URL("../content/culture/npcs.json", import.meta.url), "utf8")).profiles as NpcProfile[];
  assert.equal(rememberedLine(profiles, "sal", 2), null);
  assert.match(rememberedLine(profiles, "sal", 3)!, /BEC/);
  assert.equal(rememberedLine(profiles, "gus", 30), null, "only people with a 'remembers' line");
});

test("the preview simulator keeps the hours and counts days at a place", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const api = createSimApi(sampleCityState({ energy: 40 }));
  // Hours depend on the clock; find the cart's state now and check the simulator agrees.
  const { cityMinutes } = await import("../lib/cityClock.ts");
  const { GAME_CONFIG } = await import("../lib/config.ts");
  await api.travel!("white-sauce-cart", "taxi");
  await new Promise((r) => setTimeout(r, 0));
  const open = placeOpen(place("white-sauce-cart"), cityMinutes(Date.now(), GAME_CONFIG.cityClock));
  const meal = await api.doAction("white-sauce-cart", "eat");
  if (open) assert.ok(meal.ok && meal.gain?.energy === 20 && meal.state.regularDays?.["white-sauce-cart"] === 1);
  else assert.ok(!meal.ok && /Closed right now/.test(meal.error));
});
