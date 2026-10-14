import { test } from "node:test";
import assert from "node:assert/strict";
import { actionSeconds } from "../lib/actionTime.ts";
import { PLACES } from "../lib/city.ts";

test("actions take the owner's times (#11): browse 4, snack 4, meal 6, visit 6, shift 12", () => {
  const at = (place: string, action: string) => actionSeconds(PLACES.find((p) => p.id === place)!.actions.find((a) => a.id === action)!);
  assert.equal(at("thread-count", "browse"), 4);
  assert.equal(at("ditmars-deli", "eat"), 4);
  assert.equal(at("neon-spoon", "eat"), 6);
  assert.equal(at("rep-count", "workout"), 6);
  assert.equal(at("astoria-cc", "night-class"), 6);
  assert.equal(at("grind-and-gossip", "shift"), 12);
  assert.equal(at("skybridge-tower", "gigs"), 0);
  for (const p of PLACES) for (const a of p.actions) assert.ok(actionSeconds(a) <= 12, `${p.id}:${a.id}`);
});
