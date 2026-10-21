// Animation clips onto a base body (assets/avatar-animations.json; owner, Oct 21). Each clip file is the same body
// and the same 24 bone names, but rigged on its own, so its bind pose and bone lengths differ a little from the base
// body's. Copying its rotations straight across would bend the base body wrongly, so every frame is moved over in
// world space: each bone's rotation relative to the clip's own bind pose is applied to the base body's bind pose, and
// the hips' movement is scaled by the two hips' heights. Only rotations and the hips' position are kept (bone lengths
// stay the base body's). Used by scripts/build-base-avatars.mjs; it reports a clip whose skeleton doesn't match.
import { Matrix4, Quaternion, Vector3 } from "three";

/** Bind-pose world matrices of a skin's joints, in the scene's space (the mesh node's world times inverse IBM). */
function bindWorld(skin, meshNode) {
  const ibm = skin.getInverseBindMatrices().getArray();
  const meshWorld = new Matrix4().fromArray(meshNode.getWorldMatrix());
  return skin.listJoints().map((_, i) => meshWorld.clone().multiply(new Matrix4().fromArray(ibm, i * 16).invert()));
}

const rot = (m) => { const q = new Quaternion(), p = new Vector3(), s = new Vector3(); m.decompose(p, q, s); return q; };
const pos = (m) => new Vector3().setFromMatrixPosition(m);

/** Reads a glTF sampler at time t (linear; slerp for rotations). */
function sample(sampler, t, size) {
  const input = sampler.getInput().getArray(), out = sampler.getOutput().getArray();
  let i = 0;
  while (i < input.length - 1 && input[i + 1] < t) i++;
  const j = Math.min(i + 1, input.length - 1);
  const k = j === i || input[j] === input[i] ? 0 : Math.min(1, Math.max(0, (t - input[i]) / (input[j] - input[i])));
  if (size === 4) {
    const a = new Quaternion().fromArray(out, i * 4), b = new Quaternion().fromArray(out, j * 4);
    return a.slerp(b, k);
  }
  return new Vector3().fromArray(out, i * 3).lerp(new Vector3().fromArray(out, j * 3), k);
}

/**
 * Retargets the first animation of `clipDoc` onto the skeleton of `baseDoc`. Returns
 * { times, rotations: { joint: Float32Array (xyzw per time) }, hips: Float32Array (xyz per time), duration } or throws
 * when the skeletons don't match (names or parents).
 */
export function retarget(baseDoc, clipDoc, fps = 30) {
  const side = (doc) => {
    const root = doc.getRoot(), skin = root.listSkins()[0];
    const meshNode = root.listNodes().find((n) => n.getSkin() === skin);
    const joints = skin.listJoints();
    return { skin, joints, names: joints.map((j) => j.getName()), bind: bindWorld(skin, meshNode), anim: root.listAnimations()[0] };
  };
  const B = side(baseDoc), C = side(clipDoc);
  if (B.names.join() !== C.names.join()) throw new Error(`bones differ: ${C.names.join()} vs ${B.names.join()}`);
  const parentOf = (s) => s.joints.map((j) => { const p = j.getParentNode(); const i = s.joints.indexOf(p); return i; });
  const bp = parentOf(B), cp = parentOf(C);
  if (bp.join() !== cp.join()) throw new Error("the bones are joined differently");
  if (!C.anim) throw new Error("no animation in the clip");

  // The clip's channels by joint.
  const ch = new Map();
  for (const c of C.anim.listChannels()) ch.set(`${c.getTargetNode().getName()}.${c.getTargetPath()}`, c.getSampler());
  const duration = Math.max(...C.anim.listSamplers().map((s) => { const a = s.getInput().getArray(); return a[a.length - 1]; }));
  const n = Math.max(2, Math.round(duration * fps) + 1);
  const times = Float32Array.from({ length: n }, (_, i) => (i * duration) / (n - 1));

  // The skeleton roots' parents (the Armature) in world space, for each side.
  const rootParentWorld = (s) => { const p = s.joints[0].getParentNode(); return p ? new Matrix4().fromArray(p.getWorldMatrix()) : new Matrix4(); };
  const BrootParent = rootParentWorld(B), CrootParent = rootParentWorld(C);
  const Bq = B.bind.map(rot), Cq = C.bind.map(rot);
  const hipsB = pos(B.bind[0]), hipsC = pos(C.bind[0]);
  const ratio = hipsB.y / hipsC.y;

  const rotations = Object.fromEntries(B.names.map((nm) => [nm, new Float32Array(n * 4)]));
  const hips = new Float32Array(n * 3);
  const BrootParentInv = BrootParent.clone().invert(), BparentQ = rot(BrootParent);
  for (let f = 0; f < n; f++) {
    const t = times[f];
    // The clip's posed world matrices (forward kinematics from its own local values; missing channels keep the node's).
    const world = [];
    C.joints.forEach((j, i) => {
      const r = ch.has(`${j.getName()}.rotation`) ? sample(ch.get(`${j.getName()}.rotation`), t, 4) : new Quaternion().fromArray(j.getRotation());
      const tr = ch.has(`${j.getName()}.translation`) ? sample(ch.get(`${j.getName()}.translation`), t, 3) : new Vector3().fromArray(j.getTranslation());
      const local = new Matrix4().compose(tr, r, new Vector3(1, 1, 1));
      world[i] = (cp[i] < 0 ? CrootParent.clone() : world[cp[i]].clone()).multiply(local);
    });
    // The base body's posed world rotations: the clip's change from its bind pose, on the base's bind pose.
    const target = C.joints.map((_, i) => rot(world[i]).multiply(Cq[i].clone().invert()).multiply(Bq[i]));
    B.names.forEach((nm, i) => {
      const parentQ = bp[i] < 0 ? BparentQ : target[bp[i]];
      const local = parentQ.clone().invert().multiply(target[i]).normalize();
      local.toArray(rotations[nm], f * 4);
    });
    // The hips: the clip's movement from its bind position, scaled to the base body, in the hips' parent's space.
    const moved = pos(world[0]).sub(hipsC).multiplyScalar(ratio).add(hipsB).applyMatrix4(BrootParentInv);
    moved.toArray(hips, f * 3);
  }
  return { times, rotations, hips, duration };
}
