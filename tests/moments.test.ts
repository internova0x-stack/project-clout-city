import { test } from "node:test";
import assert from "node:assert/strict";
import { MOMENTS, QUICK_SECONDS, momentFor, momentSeconds } from "../lib/moments.ts";

test("activities map to the moment they look like", () => {
  assert.equal(momentFor({ id: "park-barksley", title: "Walk Sir Barksley" }), "dogwalk");
  assert.equal(momentFor({ id: "dog-walker-leashes", title: "Hold these six leashes?" }), "dogwalk");
  assert.equal(momentFor({ id: "vs-circle", title: "Step into the circle" }), "dance");
  assert.equal(momentFor({ id: "feta-circle-dance", title: "Join the circle dance" }), "dance");
  assert.equal(momentFor({ id: "park-sprinkler", title: "Run through the sprinklers" }), "run");
  assert.equal(momentFor({ id: "walk-dogs", label: "Walk dogs for the Ditmars crowd", kind: "shift" }), "dogwalk");
  assert.equal(momentFor({ id: "visit", label: "Dance under the train tracks", kind: "visit" }), "dance");
  assert.equal(momentFor({ id: "eat", label: "Two dirty water dogs", kind: "eat" }), "sit");
  assert.equal(momentFor({ id: "tourist-photo", title: "Take our picture?" }), "wave");
  assert.equal(momentFor({ id: "slice-counter", title: "Work the counter" }), "work");
  assert.equal(momentFor({ id: "hub-hotseat", title: "Lola's hot seat" }), null);
});

test("meals sit, shifts work, by kind", () => {
  assert.equal(momentFor({ id: "eat", label: "A plain bagel", kind: "eat" }), "sit");
  assert.equal(momentFor({ id: "x", label: "Stack boxes", kind: "shift" }), "work");
});

test("a repeat is quick", () => {
  assert.equal(momentSeconds("dance", true), MOMENTS.dance.seconds);
  assert.equal(momentSeconds("dance", false), QUICK_SECONDS);
  for (const m of Object.values(MOMENTS)) assert.ok(m.seconds >= 2 && m.seconds <= 6);
});
