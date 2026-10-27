import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CITY_ECONOMY, PLACES } from "../lib/city.ts";
import { ECONOMY, SIGNUP_HOMES, canAfford } from "../lib/economy.ts";
import { GOALS, GOAL_COPY } from "../lib/goals.ts";
import { HOME_TEMPLATES } from "../lib/rooms.ts";
import { fillRoommateLine, roommateNoteFor, slangCount, weekdayOf, type Roommate, type SlangTerm } from "../lib/culture.ts";

// Culture pack C3 (owner, Oct 20): Astoria Park, the three shifts, the roommate, the first day and two goals.
const place = (id: string) => PLACES.find((p) => p.id === id)!;
const npcs = JSON.parse(readFileSync(new URL("../content/culture/npcs.json", import.meta.url), "utf8")) as { roommates: Roommate[] };
const slang = JSON.parse(readFileSync(new URL("../content/culture/slang.json", import.meta.url), "utf8")).terms as SlangTerm[];

test("the park: sit on a bench (Mood), take a lap, a picnic and dog walking", () => {
  const park = place("hell-gate-park");
  const by = (id: string) => park.actions.find((a) => a.id === id)!;
  assert.equal(park.actions[0].id, "hangout", "the bench keeps the old id, first");
  assert.match(by("hangout").label, /bench/i);
  assert.ok(by("hangout").mood! > 0);
  assert.ok(by("lap").kind === "visit" && by("lap").skill === "fitness");
  assert.ok(by("picnic").kind === "eat" && by("picnic").price! > 0, "a paid picnic (a date spot later)");
  assert.ok(by("walk-dogs").kind === "shift" && by("walk-dogs").pay! > 0);
});

test("three new shifts: dog walker, bodega cashier, deli counter, each at a hiring place", () => {
  const shifts = { "hell-gate-park": "walk-dogs", "ditmars-deli": "cashier", "schlep-and-schmear": "counter" };
  for (const [id, action] of Object.entries(shifts)) {
    const a = place(id).actions.find((x) => x.id === action)!;
    assert.ok(a.kind === "shift" && a.pay! >= 100 && a.pay! <= 140, `${id}/${action}`);
    assert.ok(place(id).tags.some((t) => t.startsWith("job_")), `${id} shows Hiring`);
  }
});

test("the first day's tasks exist and are always open", () => {
  for (const f of CITY_ECONOMY.dailyTasks.firstDay) {
    const p = place(f.place);
    assert.ok(p.actions.some((a) => a.id === f.action), `${f.place}/${f.action}`);
    assert.equal(p.hours, undefined, `${f.place} never closes, so day one never waits`);
  }
  assert.ok(CITY_ECONOMY.dailyTasks.firstDay.length < CITY_ECONOMY.dailyTasks.count);
});

test("the roommate share: first at sign-up, half the rent, two single beds, a real roommate", () => {
  const share = ECONOMY.homes.find((h) => h.roommate)!;
  assert.equal(SIGNUP_HOMES[0].id, share.id, "the main pick at sign-up");
  assert.ok(share.rent < Math.min(...ECONOMY.homes.filter((h) => !h.roommate && !h.campus).map((h) => h.rent)), "cheaper than living alone");
  assert.ok(canAfford(share, ECONOMY.birthLottery.min));
  const beds = HOME_TEMPLATES[share.id].items.filter((i) => i.kind === "bed");
  assert.equal(beds.length, 2, "two beds");
  assert.equal(beds.filter((b) => b.use?.kind === "sleep").length, 1, "one is yours to nap in");
  const r = npcs.roommates.find((x) => x.id === share.roommate)!;
  assert.ok(r && r.intro.length >= 2 && r.notes.length >= 5);
  assert.ok(r.intro.some((l) => l.includes("{rent}") && l.includes("{day}")), "the intro names your half and your rent day");
  assert.equal(weekdayOf("2026-10-22"), "Thursday");
  assert.equal(fillRoommateLine(r.lola, "C$900", "Thursday"), "Your roommate's sweet till Thursday. That's when rent's due. Deadass.");
  const lola = slangCount(r.lola, slang);
  assert.ok(lola >= 1 && lola <= 2, "Lola: one or two slang terms");
  assert.notEqual(roommateNoteFor(r, "2026-10-20"), roommateNoteFor(r, "2026-10-21"), "a different note each day");
});

test("the two Astoria goals open the ladder", () => {
  const regular = GOALS.ladder.find((g) => g.id === "regular")!;
  const own = GOALS.ladder.find((g) => g.id === "own_place")!;
  assert.equal(GOALS.ladder[0].id, "regular", "suggested first: brings players back on days 2 and 3");
  assert.deepEqual(regular.check, { type: "regular", place: "ditmars-deli", days: 3 });
  assert.ok(regular.unlock === 0 && own.unlock === 0);
  assert.deepEqual(own.check, { type: "solo" });
  assert.equal(GOAL_COPY.own_place.title, "Escape your roommate's sourdough starter");
  assert.equal(GOAL_COPY.regular.title, "Get Sal to start your order before you ask");
});
