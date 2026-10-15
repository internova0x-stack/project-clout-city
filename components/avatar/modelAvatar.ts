// The modeled avatar (#9): Quaternius's Ultimate Modular Men and Women (CC0), mixed part by part
// (lib/avatarCatalog.ts) on one skeleton, recolored by material name, animated by the pack's clips.
// It returns the same AvatarParts as the procedural buildAvatar: legs, knees, arms and head are
// stand-ins that Room3D and Avatar3D turn as before, and update() applies those turns to the bones
// on top of the playing clip. Hair, hats, coverings and glasses still come from buildAvatar, hung
// on the Head bone, so every Look option keeps working.

import {
  AnimationMixer, Color, Euler, Group, Matrix4, Object3D, Quaternion, Skeleton, Vector3,
  type AnimationAction, type AnimationClip, type Bone, type Material, type Mesh, type MeshStandardMaterial, type SkinnedMesh,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look } from "@/lib/look";
import { getStyle, starterOutfit, type Outfit } from "@/lib/styles";
import {
  KEEPS_COVERING, MODEL_HAIR, outfitSet, isBrowMaterial, isEyeMaterial, isHairMaterial, isSkinMaterial, modelParts, modelSex,
  type PartRef, type PartSlot,
} from "@/lib/avatarCatalog";
import { buildAvatar, type AvatarParts } from "./buildAvatar";

const BASE = "/avatars";
const cache = new Map<string, Promise<GLTF>>();
let loader: GLTFLoader | null = null;
function load(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    loader ??= new GLTFLoader();
    p = loader.loadAsync(`${BASE}/${path}.glb`);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}
const fileOf = (r: PartRef) => `${r.sex}/${r.file}`;

/** Which part a mesh belongs to: names look like "Casual_Body" or, split by material, "Casual_Body_1". */
function slotOf(o: Object3D): PartSlot | null {
  const m = `${o.name} ${o.parent?.name ?? ""}`.match(/_(Body|Head|Legs|Pants|Feet)/i);
  if (!m) return null;
  const s = m[1].toLowerCase();
  return (s === "pants" ? "legs" : s) as PartSlot;
}

const vertexCount = (m: Mesh) => m.geometry.attributes.position?.count ?? 0;
const materialName = (m: Mesh) => (m.material as Material).name;

/** The pack's characters are about 1.85 tall with hair, close to the old avatar's 1.87. */
const MODEL_SCALE = 1;

/** Body types: width (x, z) and height multipliers, with the head kept its own size. */
const BUILD_SCALE: Record<Look["build"], { w: number; h: number }> = {
  athletic: { w: 1, h: 1 },
  curvy: { w: 1.04, h: 1 },
  slim: { w: 0.9, h: 1.01 },
  broad: { w: 1.12, h: 1 },
  plus: { w: 1.2, h: 0.99 },
  petite: { w: 0.94, h: 0.94 },
};

/** Hip height at MODEL_SCALE for a height-1 build, measured from the rigs. */
const HIP_Y: Record<"m" | "f", number> = { m: 0.955, f: 1.029 };

/** Where the procedural head's space sits on the Head bone (found by eye, see the #9 notes). */
const HEADWEAR_SCALE = 0.62;
const HEADWEAR_OFFSET = new Vector3(0, 0.12, 0);

export interface ModelAvatarOptions { pedestal?: boolean; outfit?: Outfit }

export function buildModelAvatar(look: Look, opts: ModelAvatarOptions = {}): AvatarParts {
  const outfit = opts.outfit ?? starterOutfit(getStyle(look.style), look.body, look.fit);
  const sex = modelSex(look);
  // A whole outfit's hat or helmet replaces a basic hat, never a faith or cultural covering.
  const set = outfitSet(outfit.set)?.[sex];
  const gear = set?.headgear && !KEEPS_COVERING.has(look.covering) ? set.headgear : undefined;
  const helmet = gear === "helmet";
  const worn: Look = gear ? { ...look, covering: "none", glasses: helmet ? "none" : look.glasses } : look;
  // The procedural avatar, for its hair, headwear and pedestal only.
  const proc = buildAvatar(worn, { pedestal: opts.pedestal ?? false, outfit });

  const root = new Group();
  const body = new Group();
  root.add(body);
  // The pedestal and contact shadow stay; the procedural body does not.
  for (const c of [...proc.root.children]) if (c !== proc.body) root.add(c);

  const proxy = () => new Object3D();
  const legs = [proxy(), proxy()];
  const knees = [proxy(), proxy()];
  const arms = [proxy(), proxy()];
  arms[0].rotation.z = -0.13;
  arms[1].rotation.z = 0.13;
  const head = new Group();
  const torso = new Object3D();
  // Dancing (owner, Oct 15) also turns the hips, the chest and the forearms.
  const hips = proxy();
  const chest = proxy();
  const forearms = [proxy(), proxy()];
  // The stand-ins' rest turns (callers may pose them before the model has loaded).
  const restOf = new Map<Object3D, [number, number, number]>(
    [...legs, ...knees, ...arms, head, hips, chest, ...forearms].map((o) => [o, [o.rotation.x, o.rotation.y, o.rotation.z]]),
  );

  const materials: Material[] = [];
  let mixer: AnimationMixer | null = null;
  let actions: Partial<Record<"idle" | "walk", AnimationAction>> = {};
  let motion: "idle" | "walk" = "idle";
  // Bones driven by the stand-ins, with their rest pose (reset each frame before the clip plays).
  const driven: { bone: Object3D; rest: Quaternion; src: Object3D; restEuler: [number, number, number] }[] = [];
  let model: Object3D | null = null;
  let disposed = false;

  const ready = (async () => {
    const parts = modelParts(look, outfit.top, outfit.bottom, outfit.set);
    // Pack hair only bare-headed (it would poke through hats); none at all under a helmet or hood.
    const hairHidden = helmet || (!!gear && set?.hidesHair);
    const hairRef = !gear && (look.covering === "none" || look.covering === "kippah") ? MODEL_HAIR[sex][look.hair] : undefined;
    const files = new Set([...Object.values(parts).map(fileOf), ...(hairRef ? [fileOf(hairRef)] : []), ...(set ? [fileOf(set.ref)] : [])]);
    const [anims, ...loaded] = await Promise.all([load(`${sex}/_anims`), ...[...files].map(load)]);
    if (disposed) return;
    const byFile = new Map([...files].map((f, i) => [f, loaded[i]]));

    // The skeleton: the shared rig of this sex, from the face file (it has every bone).
    const rig = cloneSkinned(byFile.get(fileOf(parts.head))!.scene);
    const bones = new Map<string, Bone>();
    rig.traverse((o) => { if ((o as Bone).isBone) bones.set(o.name, o as Bone); });
    // The loader drops dots from node names ("UpperLeg.L" is "UpperLegL").
    const bone = (name: string) => bones.get(name.replace(/[.\s]/g, ""));
    const meshes: SkinnedMesh[] = [];
    rig.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh); });
    for (const m of meshes) m.removeFromParent();

    // Takes the meshes of one part from a file and binds them to this rig's bones by name.
    const take = (ref: PartRef, slot: PartSlot, keep: (m: SkinnedMesh) => boolean) => {
      const src = byFile.get(fileOf(ref))!;
      src.scene.traverse((o) => {
        const sm = o as SkinnedMesh;
        if (!sm.isSkinnedMesh || slotOf(sm) !== slot || !keep(sm)) return;
        const mesh = sm.clone() as SkinnedMesh;
        mesh.material = (sm.material as Material).clone();
        mesh.userData.slot = slot;
        materials.push(mesh.material as Material);
        const skel = new Skeleton(sm.skeleton.bones.map((b) => bones.get(b.name) ?? b), sm.skeleton.boneInverses);
        mesh.bind(skel, sm.bindMatrix);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        rig.add(mesh);
      });
    };
    if (helmet && set) take(set.ref, "head", () => true);
    else take(parts.head, "head", (m) => !isHairMaterial(materialName(m), vertexCount(m)));
    if (Array.isArray(gear) && set) take(set.ref, "head", (m) => gear.includes(materialName(m)));
    if (hairRef) take(hairRef, "head", (m) => isHairMaterial(materialName(m), vertexCount(m)));
    take(parts.body, "body", () => true);
    take(parts.legs, "legs", () => true);
    take(parts.feet, "feet", () => true);

    recolor(rig, look, outfit);

    // Hair (when the pack has none for this style), hats, coverings and glasses, on the Head bone.
    const headBone = bone("Head");
    if (headBone) {
      const holder = new Group();
      holder.scale.setScalar(HEADWEAR_SCALE);
      holder.position.copy(HEADWEAR_OFFSET);
      if (proc.hair && !hairRef && !hairHidden) holder.add(proc.hair);
      if (proc.headwear && !helmet) holder.add(proc.headwear);
      holder.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
      headBone.add(holder);
    }

    // Size, body type and facing.
    const build = BUILD_SCALE[look.build] ?? BUILD_SCALE.athletic;
    rig.scale.set(MODEL_SCALE * build.w, MODEL_SCALE * build.h, MODEL_SCALE * build.w);
    if (headBone && build.w !== 1) headBone.scale.set(1 / build.w, 1, 1 / build.w);
    body.add(rig);
    model = rig;

    // Stand-ins → bones. Left and right by where the bones sit (index 0 is the -x side, as in buildAvatar).
    // Their rest pose is taken before any clip plays, and restored each frame before the clip runs.
    rig.updateMatrixWorld(true);
    const side = (a: string, b: string) => {
      const pa = bone(a), pb = bone(b);
      if (!pa || !pb) return [];
      return pa.getWorldPosition(new Vector3()).x <= pb.getWorldPosition(new Vector3()).x ? [pa, pb] : [pb, pa];
    };
    const drive = (b: Object3D | undefined, src: Object3D) => {
      if (b) driven.push({ bone: b, rest: b.quaternion.clone(), src, restEuler: restOf.get(src) ?? [0, 0, 0] });
    };
    side("UpperLeg.L", "UpperLeg.R").forEach((b, i) => drive(b, legs[i]));
    side("LowerLeg.L", "LowerLeg.R").forEach((b, i) => drive(b, knees[i]));
    side("UpperArm.L", "UpperArm.R").forEach((b, i) => drive(b, arms[i]));
    side("LowerArm.L", "LowerArm.R").forEach((b, i) => drive(b, forearms[i]));
    drive(bone("Hips"), hips);
    drive(bone("Chest"), chest);
    drive(headBone, head);

    // Animation: idle, and a walk Room3D switches to.
    mixer = new AnimationMixer(rig);
    const clip = (n: string): AnimationClip | undefined => anims.animations.find((a) => a.name === n);
    const idle = clip("Idle_Neutral") ?? clip("Idle");
    const walk = clip("Walk");
    actions = { idle: idle && mixer.clipAction(idle), walk: walk && mixer.clipAction(walk) };
    actions[motion]?.play();
    mixer.update(Math.random() * 2);
  })().catch(() => {
    // A failed load leaves the procedural avatar in place.
    if (!disposed) body.add(proc.body);
  });

  const q = new Quaternion();
  const pq = new Quaternion();
  const delta = new Quaternion();
  const euler = new Euler();
  const rootQ = new Quaternion();
  const m4 = new Matrix4();

  return {
    root,
    body,
    head,
    torso,
    eyes: [],
    legs,
    knees,
    arms,
    hips,
    chest,
    forearms,
    hipY: HIP_Y[sex] * (BUILD_SCALE[look.build] ?? BUILD_SCALE.athletic).h,
    ready: ready.then(() => undefined),
    setMotion(next) {
      if (next === motion) return;
      const from = actions[motion];
      const to = actions[next];
      motion = next;
      if (!to) return;
      to.reset().play();
      if (from) to.crossFadeFrom(from, 0.2, false);
    },
    update(dt) {
      if (!mixer || !model) return;
      for (const d of driven) d.bone.quaternion.copy(d.rest);
      mixer.update(dt);
      // Turns set on the stand-ins, relative to their rest, applied in the avatar's own frame:
      // bone = P⁻¹ · R · P · bone, with P the bone's parent rotation relative to the model.
      model.updateMatrixWorld(true);
      rootQ.setFromRotationMatrix(m4.extractRotation(model.matrixWorld)).invert();
      for (const d of driven) {
        const { x, y, z } = d.src.rotation;
        const rx = x - d.restEuler[0], ry = y - d.restEuler[1], rz = z - d.restEuler[2];
        if (rx === 0 && ry === 0 && rz === 0) continue;
        q.setFromEuler(euler.set(rx, ry, rz));
        d.bone.parent!.getWorldQuaternion(pq).premultiply(rootQ);
        d.bone.quaternion.premultiply(delta.copy(pq).invert().multiply(q).multiply(pq));
      }
    },
    dispose() {
      disposed = true;
      mixer?.stopAllAction();
      materials.forEach((m) => m.dispose());
      proc.dispose();
    },
  };
}

/** Skin, eyes, brows and hair from the Look; clothes from the Outfit (largest cloth color = main). */
function recolor(rig: Object3D, look: Look, outfit: Outfit) {
  const groups: Record<PartSlot, { mesh: Mesh; count: number }[]> = { head: [], body: [], legs: [], feet: [] };
  rig.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const slot = m.userData.slot as PartSlot | undefined;
    const mat = m.material as MeshStandardMaterial;
    mat.flatShading = true;
    mat.needsUpdate = true;
    const name = mat.name, n = vertexCount(m);
    if (isSkinMaterial(name)) {
      mat.color = new Color(look.skin);
      if (name !== "Skin") mat.color.multiplyScalar(0.85);
      return;
    }
    if (slot === "head") {
      if (isEyeMaterial(name, n)) mat.color = new Color(look.eyes);
      else if (isBrowMaterial(name, n) || isHairMaterial(name, n)) mat.color = new Color(look.hairColor);
      return;
    }
    if (slot) groups[slot].push({ mesh: m, count: n });
  });
  const paint = (slot: PartSlot, colors: string[]) => {
    const list = groups[slot].sort((a, b) => b.count - a.count);
    list.forEach((g, i) => {
      const c = colors[Math.min(i, colors.length - 1)];
      (g.mesh.material as MeshStandardMaterial).color = new Color(i < colors.length ? c : shadeOf(c, 0.12 * (i - colors.length + 1)));
    });
  };
  // A whole outfit keeps the pack's own colors.
  if (outfit.set) return;
  paint("body", [outfit.topColor, outfit.topAccent]);
  paint("legs", [outfit.bottomColor, outfit.bottomColor]);
  paint("feet", [outfit.shoeColor, shadeOf(outfit.shoeColor, -0.3)]);
}

function shadeOf(hex: string, f: number): string {
  const c = new Color(hex);
  if (f < 0) c.multiplyScalar(1 + f);
  else c.lerp(new Color("#ffffff"), f);
  return `#${c.getHexString()}`;
}
