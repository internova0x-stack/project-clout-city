import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDMARKS, landmarkSites } from "../lib/map/landmarks.ts";
import { PLACES } from "../lib/city.ts";

const M = 111_320;
test("every landmark is a real place, with a site when it stands on the ground", () => {
  for (const l of LANDMARKS) {
    if (l.placeId) assert.ok(PLACES.some((p) => p.id === l.placeId), l.id);
  }
  assert.equal(landmarkSites().features.length, LANDMARKS.filter((l) => l.ground !== "none").length);
});

test("landmarks' sites don't overlap", () => {
  const sited = LANDMARKS.filter((l) => l.ground !== "none");
  for (const a of sited) for (const b of sited) {
    if (a === b) continue;
    const k = Math.cos((a.at[0] * Math.PI) / 180);
    const d = Math.hypot((a.at[1] - b.at[1]) * k * M, (a.at[0] - b.at[0]) * M);
    assert.ok(d > a.clear + b.clear, `${a.id} and ${b.id} are ${d.toFixed(0)} m apart`);
  }
});

