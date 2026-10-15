import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_PASS, DAILY_MESSAGES, REACTIONS, hereLine, icebreakers, partOfDay } from "../lib/meet.ts";
import { PLACES } from "../lib/city.ts";
import { findPath, makeGrid, openSpots, placeFloor, placeRoom } from "../lib/rooms.ts";

test("meeting players: 20 a day, five free reactions, two chat passes", () => {
  assert.equal(DAILY_MESSAGES, 20);
  assert.equal(REACTIONS.length, 5);
  assert.deepEqual(Object.values(CHAT_PASS).sort(), ["chat-unlimited-forever", "chat-unlimited-monthly"]);
});

test("icebreakers: three different openers about the place, the time and the look", () => {
  const lines = icebreakers("Velvet Static", 23, 4);
  assert.equal(lines.length, 3);
  assert.equal(new Set(lines).size, 3);
  assert.ok(lines.some((l) => l.includes("Velvet Static")));
  assert.equal(partOfDay(7), "morning");
  assert.equal(partOfDay(14), "day");
  assert.equal(partOfDay(23), "night");
  assert.ok(icebreakers(null, 9).every((l) => l.length > 5), "works without a place");
});

test("who's here, in words", () => {
  assert.equal(hereLine(["Tasha"], 1), "Tasha");
  assert.equal(hereLine(["Tasha", "Dev"], 2), "Tasha and Dev");
  assert.equal(hereLine(["Tasha", "Dev", "Kai"], 5), "Tasha, Dev and Kai +2 more");
});

test("players get spots in every room: free floor, reachable, apart", () => {
  for (const p of PLACES) {
    for (const t of [placeRoom(p), placeFloor(p, 0), placeFloor(p, 2)]) {
      if (!t || t.crowdSpots) continue;
      const spots = openSpots(t, t.items, 6);
      assert.ok(spots.length >= 3, `${t.id}: room for at least 3 players (${spots.length})`);
      const grid = makeGrid(t, t.items);
      for (const s of spots) {
        const [c, r] = grid.cellOf(s.x, s.z);
        assert.equal(grid.blocked[r * grid.cols + c], 0, `${t.id}: a spot on free floor`);
        assert.ok(findPath(grid, t.spawn, [s.x, s.z]).length > 0, `${t.id}: reachable`);
      }
      assert.deepEqual(openSpots(t, t.items, 6), spots, "the same spots every time");
    }
  }
});
