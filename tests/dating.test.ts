import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DATING, canDateAt, datingAlerts, datingError, dateSpotName, type DatingInbox } from "../lib/dating.ts";
import { CLUB_EVENTS, PLACES } from "../lib/city.ts";

const sql = readFileSync(new URL("../supabase/migrations/0011_dating.sql", import.meta.url), "utf8");

test("database dating settings match lib/dating.ts", () => {
  const m = sql.match(/\('dating', '([\s\S]*?)'::jsonb\)/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), DATING);
});

test("the date bonus is +10 Mood and +25 clout", () => {
  assert.equal(DATING.dateMood, 10);
  assert.equal(DATING.dateClout, 25);
});

test("date spots are places with a meal; clubs host dates through their events", () => {
  const spots = PLACES.filter(canDateAt).map((p) => p.id);
  assert.ok(spots.includes("lucky-seven-deli"));
  assert.ok(!spots.includes("velvet-static"));
  assert.ok(!spots.includes("low-light-lounge"), "the lounge hosts exclusive events, never dates");
  assert.ok(CLUB_EVENTS.length > 0);
  assert.equal(dateSpotName("event", "neon-nights"), "Neon Nights");
});

test("alerts count unseen reveals and unanswered invites only", () => {
  const person = { id: "x", name: "X", style: "bodega_drip" };
  const inbox: DatingInbox = {
    matches: [{ ...person, seen: false }, { ...person, seen: true }],
    dates: [
      { id: 1, mine: false, kind: "place", target: "lucky-seven-deli", status: "pending", with: person, price: 7, placeId: "lucky-seven-deli", iWent: false, theyWent: false, paid: false, matched: true },
      { id: 2, mine: true, kind: "place", target: "lucky-seven-deli", status: "pending", with: person, price: 7, placeId: "lucky-seven-deli", iWent: false, theyWent: false, paid: false, matched: true },
    ],
    crushes: 1, max: 3, bonus: { mood: 10, clout: 25 },
  };
  assert.equal(datingAlerts(inbox), 2);
  assert.equal(datingAlerts(null), 0);
});

test("errors read like the game", () => {
  assert.match(datingError('ERROR: crush_limit'), /3 crushes/);
  assert.match(datingError(undefined), /glitched/);
});
