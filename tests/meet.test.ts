import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_PASS, DAILY_MESSAGES, REACTIONS, hereCountLine, hereLine, icebreakers, partOfDay, pickInView } from "../lib/meet.ts";
import { PLACES } from "../lib/city.ts";
import { PLACE_TEMPLATES, findPath, makeGrid, openSpots, placeFloor, placeRoom, playerSlots } from "../lib/rooms.ts";

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

test("crowded places: every room holds 3 to 7 players beside its regulars (party floors their spots)", () => {
  for (const t of Object.values(PLACE_TEMPLATES)) {
    const n = playerSlots(t);
    if (t.crowdSpots) assert.equal(n, t.crowdSpots.length, t.id);
    else {
      assert.ok(n >= 3 && n <= 7, `${t.id}: ${n}`);
      assert.equal(openSpots(t, t.items, n).length, n, `${t.id} has room for ${n}`);
    }
  }
  const club = PLACES.find((p) => p.id === "velvet-static")!;
  assert.equal(playerSlots(placeFloor(club, 0)!), 3, "the restroom holds three");
  assert.equal(playerSlots(placeFloor(club, 2)!), 4, "VIP holds four");
});

test("crowded places: who's in view (opened first, then crew, then turns)", () => {
  const people = Array.from({ length: 50 }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}`, crew: i === 30 || i === 40 }));
  const view = pickInView(people, 5);
  assert.equal(view.length, 5);
  assert.deepEqual(view.slice(0, 2), ["p30", "p40"], "crew first");
  assert.deepEqual(pickInView(people, 5, ["p07"]).slice(0, 3), ["p07", "p30", "p40"], "the person you opened walks in");
  assert.ok(!pickInView(people, 5, ["nobody"]).includes("nobody"), "only people who are here");
  // One turn: one walks out, one walks in; crew stay.
  const next = pickInView(people, 5, [], 1);
  assert.deepEqual(next.slice(0, 2), ["p30", "p40"]);
  assert.equal(view.filter((id) => !next.includes(id)).length, 1);
  // The same people in a different order (a refresh) give the same room.
  assert.deepEqual(pickInView([...people].reverse(), 5, [], 3), pickInView(people, 5, [], 3));
  // Fewer people than room: everyone, crew first.
  assert.deepEqual(pickInView([{ id: "b", crew: false }, { id: "a", crew: true }], 5), ["a", "b"]);
  assert.deepEqual(pickInView(people, 0), []);
});

test("crowded places: the Here now line gives the true count", () => {
  assert.equal(hereCountLine(50, 5), "50 players here · 5 in the room");
  assert.equal(hereCountLine(3, 3), "3 players here · tap anyone in the room");
  assert.equal(hereCountLine(1, 1), "1 player here · tap anyone in the room");
});
