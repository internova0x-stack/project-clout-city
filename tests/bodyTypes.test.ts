import { test } from "node:test";
import assert from "node:assert/strict";
import { widenOffsets, type V3 } from "../lib/bodyTypes.ts";

// A tiny skeleton: the spine up the y axis, a left arm out along x, a head on top.
const BONES: Record<string, V3> = {
  Hips: [0, 1, 0], neck: [0, 1.5, 0], Head: [0, 1.6, 0], LeftArm: [0.2, 1.4, 0], LeftForeArm: [0.5, 1.4, 0], LeftHand: [0.75, 1.4, 0],
};
const NAMES = Object.keys(BONES);

function offsets(points: [V3, string][]) {
  return widenOffsets(points.length, (i) => points[i][0], (i, k) => (k ? 0 : NAMES.indexOf(points[i][1])), (_, k) => (k ? 0 : 1), NAMES, (n) => BONES[n]);
}

test("body types widen the torso level from the spine and the limbs from their bones, never the head", () => {
  const { torso, limb } = offsets([[[0.15, 1.2, 0.1], "Hips"], [[0.35, 1.45, 0], "LeftArm"], [[0.05, 1.7, 0.05], "Head"], [[0.8, 1.4, 0], "LeftHand"]]);
  assert.deepEqual(Array.from(torso.slice(0, 3)).map((v) => +v.toFixed(3)), [0.15, 0, 0.1], "torso: away from the spine, the height kept");
  assert.deepEqual(Array.from(limb.slice(3, 6)).map((v) => +v.toFixed(3)), [0, 0.05, 0], "arm: away from the bone's line");
  assert.ok(Array.from(torso.slice(6, 12)).every((v) => v === 0) && Array.from(limb.slice(6, 12)).every((v) => v === 0), "head and hands stay");
});
