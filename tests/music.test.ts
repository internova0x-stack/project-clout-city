import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSIC_STYLES, MUSIC_STYLE_IDS } from "../lib/musicStyles.ts";
import { musicFor } from "../lib/musicMap.ts";
import { PLACES } from "../lib/city.ts";

test("every style's patterns are one 16-step bar and its chords and roots loop together", () => {
  for (const id of MUSIC_STYLE_IDS) {
    const s = MUSIC_STYLES[id];
    for (const p of [s.bass, s.kick, s.snare, s.hat, s.leadSteps, s.open ?? "x".repeat(16), s.chordMode.kind === "stab" ? s.chordMode.steps : "x".repeat(16)]) {
      assert.equal(p.length, 16, `${id}: ${p}`);
    }
    assert.match(s.bass, /^[0-9c.]+$/, id);
    assert.equal(s.chords.length, s.roots.length, id);
    assert.ok(s.bpm >= 60 && s.bpm <= 140, id);
  }
});

test("music follows the place (owner, Nov 19)", () => {
  assert.equal(musicFor({ tab: "home" }), "lofi");
  assert.equal(musicFor({ tab: "map" }), "pop");
  assert.equal(musicFor({ tab: "map", place: { id: "x", tags: ["club", "nightlife"] } }), "techno");
  assert.equal(musicFor({ tab: "map", place: { id: "x", tags: ["rooftop", "dining_luxury"] } }), "romance");
  assert.equal(musicFor({ tab: "map", place: { id: "x", tags: ["office", "campaign"] } }), "synth");
  assert.equal(musicFor({ tab: "map", place: { id: "x", tags: ["university", "campus"] }, floor: 5 }), "afrobeats");
  assert.equal(musicFor({ tab: "map", place: { id: "x", tags: ["pizza"] } }), "pop");
  // Every real place gets a style.
  for (const p of PLACES) assert.ok(MUSIC_STYLE_IDS.includes(musicFor({ tab: "map", place: { id: p.id, tags: p.tags ?? [] } })), p.id);
});
