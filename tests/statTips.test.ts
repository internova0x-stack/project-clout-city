import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "../lib/city.ts";
import { sampleCityState } from "../lib/citySim.ts";
import { contextTipLists, contextTips } from "../lib/statTips.ts";

test("stat suggestions follow the context (#3): at home a nap, then cooking, then sitting", () => {
  const s = sampleCityState({ energy: 20, mood: 40 });
  s.player.at_place = null;
  s.player.fridge_meals = 3;
  s.restToday = { nap: 0, sit: 0 };
  let t = contextTips(PLACES, s, { restOn: true, kitchenOn: true });
  assert.equal(t.energy?.placeId, "rest:nap");
  assert.match(t.energy!.detail!, /\+30 Energy · Free · ⏱ 8s · 2 of 2 left today/);
  assert.equal(t.mood?.placeId, "rest:sit");
  s.restToday = { nap: 2, sit: 0 };
  t = contextTips(PLACES, s, { restOn: true, kitchenOn: true });
  assert.equal(t.energy?.placeId, "cook");
  assert.match(t.energy!.detail!, /3 meals in the fridge/);
  s.player.fridge_meals = 0;
  assert.equal(contextTips(PLACES, s, { restOn: true, kitchenOn: true }).energy?.placeId, "rest:sit");
});

test("out and about, something right here comes first", () => {
  const s = sampleCityState({ energy: 20, mood: 40 });
  s.player.at_place = "neon-spoon";
  const t = contextTips(PLACES, s, { restOn: true, kitchenOn: true });
  assert.equal(t.energy?.placeId, "neon-spoon");
  assert.equal(t.energy?.go, "Do it");
  assert.match(t.energy!.detail!, /⏱ 6s/);
});

test("each stat offers more than one action (owner, Oct 26): home options first, then a place to go", () => {
  const s = sampleCityState({ energy: 20, mood: 40 });
  s.player.at_place = null;
  s.player.fridge_meals = 3;
  s.restToday = { nap: 0, sit: 0 };
  const t = contextTipLists(PLACES, s, { restOn: true, kitchenOn: true });
  assert.deepEqual(t.energy.map((x) => x.placeId), ["rest:nap", "cook", "rest:sit"]);
  assert.equal(t.mood[0].placeId, "rest:sit");
  assert.ok(t.mood.length >= 2 && t.mood[1].go === "Go", "and a place to go");
  assert.ok(Object.values(t).every((l) => l.length <= 3));
});
