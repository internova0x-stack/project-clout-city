import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREW, crewActivities, crewAlerts, crewError, crewProgress, type CrewOuting } from "../lib/crew.ts";
import { PLACES } from "../lib/city.ts";

const sql = readFileSync(new URL("../supabase/migrations/0013_crew_outings.sql", import.meta.url), "utf8");
const place = (id: string) => PLACES.find((p) => p.id === id)!;

test("database crew settings match lib/crew.ts", () => {
  const m = sql.match(/\('crew', '([\s\S]*?)'::jsonb\)/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), CREW);
});

test("the full crew is the host plus 5 friends; bonuses are +10 and +100", () => {
  assert.equal(CREW.fullSize, CREW.maxInvites + 1);
  assert.equal(CREW.perFriendClout, 10);
  assert.equal(CREW.fullClout, 100);
});

test("crews do visits, meals, hangouts, lectures and club or campus events, never shifts or gigs", () => {
  assert.deepEqual(crewActivities(place("grind-and-gossip")).map((a) => a.id), ["eat"]);
  assert.deepEqual(crewActivities(place("velvet-static")).map((a) => a.id), ["visit", "neon-nights", "golden-hour"]);
  assert.deepEqual(crewActivities(place("st-johnsons")).map((a) => a.id), ["lecture", "quad", "study", "homecoming-tailgate"]);
  assert.equal(crewActivities(place("skybridge-tower")).length, 0);
  assert.equal(crewActivities(place("pedal-pushers")).length, 0);
  assert.deepEqual(crewActivities(place("skyline-pier")).map((a) => a.id), ["lobby"], "story-only actions are out");
});

test("alerts, progress and errors", () => {
  const p = { id: "a", name: "A", style: "bodega_drip" };
  const o: CrewOuting = {
    id: 1, kind: "place", placeId: "lucky-seven-deli", activity: "eat", price: 7, mine: false, full: false, myStatus: "invited", iWent: false, host: p,
    members: [{ ...p, status: "host", went: true }, { ...p, id: "b", status: "in", went: true }, { ...p, id: "c", status: "declined", went: false }, { ...p, id: "d", status: "invited", went: false }],
  };
  assert.equal(crewAlerts({ outings: [o, { ...o, mine: true }], clout: 0 }), 1);
  assert.deepEqual(crewProgress(o), { went: 2, total: 3 });
  assert.match(crewError("ERROR: outing_limit"), /3 crew outings/);
});
