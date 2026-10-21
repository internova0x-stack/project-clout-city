// Body types for the new bodies (owner, Oct 21: "never scale or rotate the head and neck bones for body types"):
// instead of stretching the skeleton, every vertex gets how it would move to be wider, worked out from its own bones
// in the bind pose when the body (or a garment) loads. The game's shader adds them, scaled per body type
// (components/avatar/baseAvatar.ts), before skinning, so they bend with every pose:
//   torso  hips, spine and shoulders: away from the spine's axis, level (the height stays)
//   limb   the arms and legs: away from each bone's own line
// Head, neck, hands and feet have none. Garments get the same from their own vertices, so they widen with the body.

export type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The point on segment a→b nearest p. */
function nearest(p: V3, a: V3, b: V3): V3 {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}

const TORSO = /^(Hips|Spine02|Spine01|Spine|LeftShoulder|RightShoulder)$/;
const LIMB_END: Record<string, string> = { Arm: "ForeArm", ForeArm: "Hand", UpLeg: "Leg", Leg: "Foot" };

/**
 * Both offsets (xyz per vertex) for `count` vertices: pos(i), joint(i, k) and weight(i, k) read the mesh; names are the
 * skin's bones and bone() a bone's bind position, in the mesh's own space.
 */
export function widenOffsets(
  count: number, pos: (i: number) => V3, joint: (i: number, k: number) => number, weight: (i: number, k: number) => number,
  names: readonly string[], bone: (name: string) => V3 | undefined,
): { torso: Float32Array; limb: Float32Array } {
  const torso = new Float32Array(count * 3), limb = new Float32Array(count * 3);
  const spineTop = bone("neck"), spineBottom = bone("Hips");
  const ends = new Map<string, [V3, V3] | null>();
  const segment = (name: string) => {
    if (!ends.has(name)) {
      const m = name.match(/^(Left|Right)(Arm|ForeArm|UpLeg|Leg)$/);
      const a = m && bone(name), b = m && bone(`${m[1]}${LIMB_END[m[2]]}`);
      ends.set(name, a && b ? [a, b] : null);
    }
    return ends.get(name)!;
  };
  for (let i = 0; i < count; i++) {
    const p = pos(i);
    let tw = 0;
    for (let k = 0; k < 4; k++) {
      const w = weight(i, k), name = names[joint(i, k)] ?? "";
      if (!w) continue;
      if (TORSO.test(name)) { tw += w; continue; }
      const seg = segment(name);
      if (!seg) continue;
      // Each limb bone's share, by its weight.
      const c = nearest(p, seg[0], seg[1]);
      for (let a = 0; a < 3; a++) limb[i * 3 + a] += w * (p[a] - c[a]);
    }
    if (tw && spineTop && spineBottom) {
      const c = nearest(p, spineBottom, spineTop);
      torso[i * 3] = (p[0] - c[0]) * tw;
      torso[i * 3 + 2] = (p[2] - c[2]) * tw;
    }
  }
  return { torso, limb };
}
