// Gestures (owner, Nov 22: "move on to phase 3"; moments phase 3): poses drawn in code on top of whatever clip is playing.
// Each limb is aimed along a direction in the avatar's own space (AvatarParts.aim: +z forward, +y up, −x its right), so
// the pose is the same whatever the clip under it does. No new animation files.
//   hold   one hand reaching to the person beside you (side: where they stand), while you walk together
//   hug    both arms around the person facing you
//   toast  the glass up, a little bob
//   selfie the phone up and out in front
//   cheer  both arms up, pumping
// Old bodies (no aim) keep their clip.

import { Vector3 } from "three";
import type { AvatarParts } from "./buildAvatar";

export type Gesture = "hold" | "hug" | "toast" | "selfie" | "cheer";
/** Where the other person stands: on the avatar's left (+x) or right (−x). */
export type Side = "left" | "right";

type Limb = "rArm" | "lArm" | "rFore" | "lFore";
const LIMBS: Limb[] = ["rArm", "lArm", "rFore", "lFore"];
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const SQUARE = new Vector3(0, 0, 1);

/** The directions for each limb at time t (right side written; the left mirrors x). */
function pose(g: Gesture, t: number, side: Side): Partial<Record<Limb, Vector3>> {
  const s = Math.sin(t * 6);
  switch (g) {
    case "hold":
      // The inside arm swings out and down to meet the other hand.
      return side === "left"
        ? { lArm: v(0.36, -0.9, 0.22), lFore: v(0.22, -0.86, 0.46) }
        : { rArm: v(-0.36, -0.9, 0.22), rFore: v(-0.22, -0.86, 0.46) };
    case "hug":
      // Upper arms forward at chest height, forearms folding round the other's back.
      return { rArm: v(-0.8, -0.3, 0.52), rFore: v(0.6, 0.0, 0.8), lArm: v(0.8, -0.2, 0.56), lFore: v(-0.6, 0.05, 0.8) };
    case "toast":
      // The right hand up and forward, the glass held high, bobbing on the beat.
      return { rArm: v(-0.3, 0.15 + s * 0.04, 0.94), rFore: v(-0.12, 0.62, 0.78) };
    case "selfie":
      // The right arm up and out in front, the phone a little above the eyes.
      return { rArm: v(-0.5, 0.3, 0.8), rFore: v(-0.2, 0.42, 0.88) };
    case "cheer": {
      // Both arms high in a V, pumping.
      const k = Math.max(0, s) * 0.15;
      return { rArm: v(-0.42, 0.9 - k, 0.12), rFore: v(-0.2, 1, 0.05), lArm: v(0.42, 0.9 - k, 0.12), lFore: v(0.2, 1, 0.05) };
    }
  }
}

/** Sets a gesture's pose for this frame (call before the avatar's update). Limbs it doesn't use go back to the clip. */
export function gesture(p: AvatarParts, g: Gesture, t: number, side: Side = "left") {
  if (!p.aim) return;
  const want = pose(g, t, side);
  for (const l of LIMBS) p.aim(l, want[l] ?? null);
  // Facing straight ahead (the idle clip twists): the hug and the toast need it most; hand in hand walks as it walks.
  p.aim("square", g === "hold" ? null : SQUARE);
  p.hold?.(g === "toast" ? "glass" : g === "selfie" ? "phone" : null);
}

/** Lets go: every limb back to its clip. */
export function clearGesture(p: AvatarParts) {
  for (const l of LIMBS) p.aim?.(l, null);
  p.aim?.("square", null);
  p.hold?.(null);
}
