import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STARTING_STYLES } from "../lib/styles.ts";
import { SKIN_TONES } from "../lib/look.ts";
import { WAVE_1_PINS } from "../lib/places.ts";

test("exactly the eight starting styles (owner, Oct 30: casual, athletic, streetwear, corporate, new money, thrift, nerdy/preppy, goth)", () => {
  assert.deepEqual(
    STARTING_STYLES.map((s) => s.label),
    ["Everyday Casual", "Gym Regular", "Bodega Streetwear", "Midtown Corporate", "New Money", "Thrift Store Regular", "Arcade Prep", "Night Owl Goth"],
  );
});

test("each style sets 3 to 4 starter items", () => {
  for (const s of STARTING_STYLES) {
    assert.ok(s.starterItems.length >= 3 && s.starterItems.length <= 4, s.label);
  }
});

test("style ids match the database constraint", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0001_players_and_invites.sql", import.meta.url), "utf8");
  for (const s of STARTING_STYLES) assert.ok(sql.includes(`'${s.id}'`), s.id);
});

test("skin tones are unique hex colors", () => {
  assert.equal(new Set(SKIN_TONES).size, SKIN_TONES.length);
  for (const t of SKIN_TONES) assert.match(t, /^#[0-9A-F]{6}$/i);
});

test("v0.1 shows six wave-1 pins, all in Queens", () => {
  assert.equal(WAVE_1_PINS.length, 6);
  for (const p of WAVE_1_PINS) {
    assert.ok(p.at[0] > 40.54 && p.at[0] < 40.81 && p.at[1] > -73.97 && p.at[1] < -73.70, p.name);
  }
});
