import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "../lib/city.ts";
import { PARTY_BENEFITS, PARTY_SUGGESTIONS, ROOM_SIZE, crowdFor, partyRoomError, type PartyPerson } from "../lib/partyRoom.ts";
import { findPath, makeGrid, placeFloor, placementOk, useSpot } from "../lib/rooms.ts";

const person = (n: number, crew = false): PartyPerson => ({ id: `p${n}`, name: `Guest ${n}`, style: "bodega_drip", look: {}, crew });

test("a party room shows 8 to 10 others: real players first, NPCs fill the gap", () => {
  assert.ok(ROOM_SIZE >= 8 && ROOM_SIZE <= 10);
  const few = crowdFor([person(1, true), person(2)], () => null);
  assert.equal(few.length, ROOM_SIZE);
  assert.deepEqual(few.slice(0, 2).map((m) => m.npc), [false, false]);
  assert.ok(few.slice(2).every((m) => m.npc), "the rest are NPCs");
  const many = crowdFor(Array.from({ length: 14 }, (_, i) => person(i)), () => null);
  assert.equal(many.length, ROOM_SIZE);
  assert.ok(many.every((m) => !m.npc), "a full party needs no NPCs");
});

test("the event modal's promises and the positive openers", () => {
  assert.equal(PARTY_BENEFITS.length, 3);
  assert.ok(PARTY_SUGGESTIONS.length >= 4 && PARTY_SUGGESTIONS.every((s) => s.length <= 40));
  assert.match(partyRoomError("party_too_fast"), /one message at a time/i);
});

test("the exclusive venue has two floors, joined by stairs you can walk to", () => {
  const venue = PLACES.find((p) => p.tags.includes("exclusive_venue"))!;
  const ground = placeFloor(venue, 1)!;
  const roof = placeFloor(venue, 2)!;
  assert.ok(ground && roof, "two floors");
  assert.equal(placeFloor(PLACES.find((p) => p.id === "grind-and-gossip")!, 2), null, "other places have one");
  for (const t of [ground, roof]) {
    const stairs = t.items.find((i) => i.use?.kind === "floor")!;
    assert.ok(stairs, `${t.id} has stairs`);
    assert.ok(placementOk(t, t.items, stairs), `${t.id} stairs fit`);
    assert.ok(findPath(makeGrid(t, t.items), t.spawn, useSpot(stairs)).length > 0, `${t.id} stairs reachable`);
  }
  assert.ok((roof.crowdSpots?.length ?? 0) >= ROOM_SIZE, "room for the whole party");
});
