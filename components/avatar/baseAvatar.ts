// The new base bodies (docs/shop-manager.md section 5; owner, Oct 21): one bald, barefoot body per presentation in a
// plain grey base layer (public/avatars/body/, built by scripts/build-base-avatars.mjs from assets/avatar-animations.json),
// with a 24-bone skeleton and a matte texture. It returns the same AvatarParts as the modeled and procedural avatars,
// so Room3D and Avatar3D pose it the same way (legs, knees, arms, forearms, hips, chest and head stand-ins on top of
// the clip).
//   * Skin tone: the texture's skin is recolored to the Look's (a shader keys on the baked orange, keeping its shading);
//     the brows take the hair color. The base layer itself is never recolored.
//   * Clothes are garment templates (scripts/garments.mjs, scripts/wardrobe.mjs), cut from the same body and sharing its
//     skeleton, so they bend with every pose and body type; the skin they hide isn't drawn (each vertex's cover bits).
//     Shoes without a template of their own are sneakers.
//   * Hair is grown from each body's own scalp (scripts/hair.mjs: public/avatars/hair/), so it fits the head; under a
//     hat only its lengths show, and full coverings hide it. Hats, coverings and glasses are the game's own
//     (buildAvatar), fitted to the head measured from the mesh; so are the whole outfits' hats (setHats.ts).
//   * Whole Shop outfits are garment templates in their own colors and details, with their hat (SET_LOOKS).
//   * Body types never scale the head or neck (owner, Oct 21): every vertex of the body and its garments gets how it
//     moves to be wider (the torso, the arms and legs: lib/bodyTypes.ts), added by the shader before skinning; height is
//     the whole figure's scale.
//   * Animations: {m,f}-anims.glb holds the walk and every clip, retargeted onto the body's skeleton (scripts/retarget.mjs).
//   * Low-graphics mode loads the lighter files (fewer triangles, a 512 px texture).

import {
  AnimationMixer, Box3, LoopOnce, LoopRepeat, BufferAttribute, Color, DoubleSide, Euler, Group, Matrix4, MeshStandardMaterial, Object3D, Quaternion,
  Skeleton, SkinnedMesh, Vector2, Vector3, type AnimationAction, type BufferGeometry, type Bone, type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look } from "@/lib/look";
import { getStyle, starterOutfit, type Outfit } from "@/lib/styles";
import { garmentsFor, KEEPS_COVERING, modelSex, SET_LOOKS } from "@/lib/avatarCatalog";
import { lowGraphics } from "@/lib/graphics";
import { widenOffsets, type V3 } from "@/lib/bodyTypes";
import { buildAvatar, type AvatarParts } from "./buildAvatar";
import { buildSetHat, SET_HAT_HIDES_HAIR } from "./setHats";
import { buildBodyAccessory, buildHeadAccessory, type BodyFit } from "./accessories";
import { ACCESSORY_HATS, ACCESSORY_HIDES_HAIR } from "@/lib/accessories";
import type { ModelAvatarOptions } from "./modelAvatar";

const cache = new Map<string, Promise<GLTF>>();
let loader: GLTFLoader | null = null;
function load(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    loader ??= new GLTFLoader();
    p = loader.loadAsync(path);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

/** The baked skin color the shader keys on (measured from the bodies' textures). */
const SKIN_REF = { m: "rgb(226,140,89)", f: "rgb(253,158,98)" } as const;

/** Body types: how much wider the torso (w) and the arms and legs (l) get, and the whole figure's height (h). */
export const BASE_BUILD_SCALE: Record<Look["build"], { w: number; l: number; h: number }> = {
  athletic: { w: 1, l: 1, h: 1 }, curvy: { w: 1.07, l: 1.05, h: 1 }, slim: { w: 0.9, l: 0.9, h: 1.01 }, broad: { w: 1.14, l: 1.1, h: 1 },
  plus: { w: 1.24, l: 1.2, h: 0.99 }, petite: { w: 0.95, l: 0.95, h: 0.94 },
};
/** Hip height of each body standing (the Hips bone), for sitting. */
export const BASE_HIP_Y: Record<"m" | "f", number> = { m: 0.97, f: 0.97 };

/** The body-type offsets (widenAttrs) added before skinning, for a body or garment material sharing `widen`. */
function widenVertex(sh: WebGLProgramParametersWithUniforms, widen: { value: Vector2 }) {
  sh.uniforms.uWiden = widen;
  sh.vertexShader = sh.vertexShader
    .replace("void main() {", "attribute vec3 widen;\nattribute vec3 widenl;\nuniform vec2 uWiden;\nvoid main() {")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed += widen * uWiden.x + widenl * uWiden.y;");
}
/** The body-type offsets of a skinned mesh's vertices (lib/bodyTypes.ts), worked out once per geometry from its own
 *  skin in the bind pose, as the attributes the shader reads. */
function widenAttrs(mesh: SkinnedMesh) {
  const g = mesh.geometry;
  if (g.getAttribute("widen")) return;
  const pos = g.getAttribute("position"), joints = g.getAttribute("skinIndex"), weights = g.getAttribute("skinWeight");
  const { bones, boneInverses } = mesh.skeleton;
  // A bone's bind position in the mesh's own space (the files are quantized: the inverse bind matrices carry the
  // scale). The bind matrix itself, not bindMatrixInverse: in "attached" mode three.js keeps that one at the mesh's
  // current world matrix (the rig's centimeters).
  const unbind = mesh.bindMatrix.clone().invert();
  const at = new Map(bones.map((b, i) => {
    const v = new Vector3().applyMatrix4(boneInverses[i].clone().invert()).applyMatrix4(unbind);
    return [b.name, [v.x, v.y, v.z] as V3];
  }));
  const { torso, limb } = widenOffsets(
    pos.count, (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)], (i, k) => joints.getComponent(i, k), (i, k) => weights.getComponent(i, k),
    bones.map((b) => b.name), (name) => at.get(name),
  );
  g.setAttribute("widen", new BufferAttribute(torso, 3));
  g.setAttribute("widenl", new BufferAttribute(limb, 3));
}

/** The procedural head's size in its own space (buildAvatar's skull: radius 0.19, scaled 0.92, 1.12, 0.98). */
const PROC_HEAD = new Vector3(0.175, 0.213, 0.186);

/** A garment's details from its _PAT attribute (scripts/garments.mjs, scripts/wardrobe.mjs), by its template's kind
 *  (GARMENT_TEMPLATES): ribbed bands, the hoodie's pocket, zips, buttons, lapels, quilting, pleats, waistbands, soles.
 *  Lines are antialiased (fwidth); the inside is darker. */
function garmentMaterial(kind: number, color: string, accent: string, widen: { value: Vector2 }, hideAbove = 9): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: kind === 8 ? 0.55 : kind === 17 ? 0.35 : 0.92, metalness: 0, side: DoubleSide });
  const u = { uTop: { value: new Color(color) }, uAccent: { value: new Color(accent) }, uKind: { value: kind }, uHideAbove: { value: hideAbove } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute vec4 pat;\nvarying vec4 vPat;\nvoid main() {\n  vPat = pat;");
    widenVertex(sh, widen);
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", `uniform vec3 uTop; uniform vec3 uAccent; uniform int uKind; uniform float uHideAbove;
varying vec4 vPat;
// 1 on a line at "at" (half-width w), soft-edged.
float lineAt(float v, float at, float w) { float a = fwidth(v) * 1.2 + 0.0004; return 1.0 - smoothstep(w, w + a, abs(v - at)); }
// 1 inside a round button of radius r at p.
float dotAt(vec2 q, vec2 p, float r) { float d = length(q - p); float a = fwidth(d) * 1.2 + 0.0004; return 1.0 - smoothstep(r, r + a, d); }
void main() {`)
      .replace("#include <map_fragment>", `#include <map_fragment>
  {
    vec3 c = uTop;
    float part = vPat.w, d = vPat.x;
    vec2 q = vPat.yz; // across the front (1 off it), height above the top of the legs
    // A bottom under a top isn't drawn above the top's hem (the two bend a little differently and would cross);
    // every other piece gets a hem far above.
    if (q.y > uHideAbove) discard;
    // On the front only: where a triangle spans the front's coordinates and the back's marker, q.x jumps.
    bool front = q.x < 0.9 && fwidth(q.x) < 0.02;
    if (part > 0.75) c = uAccent;                              // drawstrings
    else if (part > 0.4) c = uTop * 0.93;                      // the hood
    else if (part > 0.2) c = uKind == 5 ? uAccent : uTop * 0.9; // collars (a zip jacket's in its accent)
    else if (uKind == 1) {
      // The hoodie: ribbed hem and cuffs, the kangaroo pocket.
      float band = 1.0 - smoothstep(0.038, 0.042, d);
      c *= mix(1.0, 0.86 + 0.05 * sin(q.x * 900.0), band);
      c *= 1.0 - 0.12 * lineAt(d, 0.04, 0.0);
      float t = (q.y - 0.035) / 0.135;
      float hw = mix(0.15, 0.1, clamp(t, 0.0, 1.0));
      float inside = min(min(hw - abs(q.x), q.y - 0.035), 0.17 - q.y);
      float aa = fwidth(inside) * 1.5 + 0.0005;
      float pocket = smoothstep(-aa, aa, inside);
      c *= 1.0 - 0.04 * pocket - 0.12 * (1.0 - smoothstep(0.0, aa * 2.0, abs(inside - 0.004))) * pocket;
    } else if (uKind == 2 || uKind == 3) {
      // Tee and crop top: a stitched hem and sleeve ends.
      c *= 1.0 - 0.1 * lineAt(d, 0.016, 0.0);
    } else if (uKind == 4) {
      // Vest: a placket with buttons, two welt pockets, bound edges.
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.012, 0.014, d));
      if (front) {
        c *= 1.0 - 0.15 * lineAt(q.x, 0.0, 0.0006);
        for (int i = 0; i < 5; i++) c = mix(c, uAccent, dotAt(q, vec2(0.012, 0.06 + float(i) * 0.06), 0.006));
        c *= 1.0 - 0.18 * lineAt(q.y, 0.13, 0.0012) * step(0.05, abs(q.x)) * step(abs(q.x), 0.13);
      }
    } else if (uKind == 5) {
      // Zip jacket (bomber): wide ribbed cuffs and hem, a zip up the middle.
      float band = 1.0 - smoothstep(0.042, 0.046, d);
      c *= mix(1.0, 0.82 + 0.06 * sin(q.x * 900.0 + q.y * 600.0), band);
      if (front) c = mix(c, uAccent, lineAt(q.x, 0.0, 0.003));
    } else if (uKind == 6) {
      // Cardigan: ribbed edges all round the opening, five buttons below it.
      float band = 1.0 - smoothstep(0.028, 0.032, d);
      c *= mix(1.0, 0.86 + 0.06 * sin(q.y * 700.0), band);
      if (front) for (int i = 0; i < 5; i++) c = mix(c, uAccent, dotAt(q, vec2(0.0, 0.05 + float(i) * 0.055), 0.0075));
    } else if (uKind == 7) {
      // Blazer: lapels a shade darker (the band along the open front, up high), two buttons, pocket flaps.
      c *= 1.0 - 0.16 * (1.0 - smoothstep(0.042, 0.046, d)) * smoothstep(0.26, 0.28, q.y);
      c *= 1.0 - 0.1 * (1.0 - smoothstep(0.006, 0.008, d));
      if (front) {
        for (int i = 0; i < 2; i++) c = mix(c, uAccent, dotAt(q, vec2(0.0, 0.17 + float(i) * 0.09), 0.008));
        c *= 1.0 - 0.22 * lineAt(q.y, 0.09, 0.001) * step(0.06, abs(q.x)) * step(abs(q.x), 0.15);
      }
    } else if (uKind == 8) {
      // Puffer: quilted channels with a soft puff, a zip up the middle.
      float ch = fract(q.y / 0.075);
      c *= 0.84 + 0.16 * sin(ch * 3.14159);
      c *= 1.0 - 0.25 * lineAt(ch, 0.0, 0.02);
      if (front) c = mix(c, uAccent, lineAt(q.x, 0.0, 0.003));
    } else if (uKind == 18) {
      // Hi-vis jacket (a zip jacket): ribbed cuffs and hem, the zip, two reflective bands round the body and sleeves.
      c *= mix(1.0, 0.86, 1.0 - smoothstep(0.03, 0.034, d));
      if (front) c = mix(c, uAccent * 0.7, lineAt(q.x, 0.0, 0.003));
      float band = max(lineAt(q.y, 0.07, 0.016), lineAt(q.y, 0.2, 0.016));
      c = mix(c, uAccent * 1.15, band);
    } else if (uKind >= 9 && uKind <= 11 || uKind == 19) {
      // Trousers, shorts, leggings: a waistband (near the top edge), the fly on trousers, stitched cuffs.
      bool top = q.y > -0.15;
      float wb = top ? 1.0 - smoothstep(0.032, 0.036, d) : 0.0;
      c *= 1.0 - 0.1 * wb - 0.14 * (top ? lineAt(d, 0.034, 0.0) : lineAt(d, 0.015, 0.0));
      if ((uKind == 9 || uKind == 19) && front && q.y > -0.03) c *= 1.0 - 0.14 * lineAt(q.x, 0.018, 0.0006);
      // Ripped (punk): frayed slashes round the knees, the threads showing pale.
      if (uKind == 19 && q.y < -0.3 && q.y > -0.55) {
        float slash = smoothstep(0.93, 0.99, sin(q.y * 48.0));
        c = mix(c, vec3(0.78, 0.76, 0.72) * (0.85 + 0.15 * sin(q.y * 900.0)), slash * 0.85);
      }
    } else if (uKind == 12) {
      // Skirt: knife pleats round it, a waistband.
      float a = q.x;
      c *= 0.9 + 0.1 * abs(sin(a * 3.14159 * 14.0));
      c *= 1.0 - 0.12 * (q.y > -0.05 ? 1.0 - smoothstep(0.028, 0.032, d) : 0.0);
    } else if (uKind == 13) {
      // Boots: a chunky sole in the accent, a padded top.
      c = mix(c, uAccent, 1.0 - smoothstep(0.028, 0.032, q.y));
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.02, 0.024, d));
    } else if (uKind == 15) {
      // Gown or robe: soft folds falling from a waistband.
      c *= 0.92 + 0.08 * abs(sin(q.x * 3.14159 * 9.0));
      c *= 1.0 - 0.12 * (q.y > -0.05 ? 1.0 - smoothstep(0.028, 0.032, d) : 0.0);
    } else if (uKind == 16) {
      // Overalls: denim twill, stitched hems, a bib pocket and brass buttons where the straps meet the bib.
      c *= 0.94 + 0.06 * sin((q.x + q.y) * 700.0);
      c *= 1.0 - 0.14 * lineAt(d, 0.012, 0.0);
      if (front && q.y > 0.1) {
        c *= 1.0 - 0.18 * (lineAt(abs(q.x), 0.07, 0.0008) * step(0.12, q.y) * step(q.y, 0.22) + lineAt(q.y, 0.12, 0.0008) * step(abs(q.x), 0.07));
        // The buttons sit on each strap, 3 cm below the bib's top edge (by the distance to that edge).
        c = mix(c, uAccent, dotAt(vec2(abs(q.x), d), vec2(0.075, 0.03), 0.009) * step(0.15, q.y));
      }
    } else if (uKind == 17) {
      // Dress shoes: polished leather, a thin sole and heel in the accent.
      c = mix(c, uAccent, 1.0 - smoothstep(0.012, 0.016, q.y));
      c *= 1.0 - 0.1 * (1.0 - smoothstep(0.008, 0.012, d));
    } else if (uKind == 14) {
      // Sneakers: a white rubber sole with a stripe in the accent, a padded collar.
      float sole = 1.0 - smoothstep(0.022, 0.026, q.y);
      c = mix(c, vec3(0.94, 0.93, 0.9), sole);
      c = mix(c, uAccent, lineAt(q.y, 0.03, 0.002));
      c *= 1.0 - 0.14 * (1.0 - smoothstep(0.012, 0.016, d));
    }
    if (!gl_FrontFacing) c *= 0.55;
    diffuseColor.rgb = c;
  }`);
  };
  mat.customProgramCacheKey = () => "cc-garment";
  return mat;
}

/** Hair that full coverings hide (as buildAvatar). */
const HIDES_HAIR = new Set(["hijab", "turban", "headwrap", "durag"]);
/** Headwear that sits over the hair: only its lengths show under it (glasses and small coverings leave it all). */
const HATS = new Set(["cap", "fedora", "bucket"]);

/** The hair's look from its _PAT attribute (scripts/hair.mjs): strands as fine streaks round the head and down the
 *  lengths, braids and locs in segments, a darker underside, a soft sheen. */
function hairMaterial(color: string): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: DoubleSide });
  const u = { uHair: { value: new Color(color) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute vec4 pat;\nvarying vec4 vPat;\nvoid main() {\n  vPat = pat;");
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform vec3 uHair;\nvarying vec4 vPat;\nvoid main() {")
      .replace("#include <map_fragment>", `#include <map_fragment>
  {
    float part = vPat.z;
    float streak;
    if (part > 0.4 && part < 0.6) streak = 0.5 + 0.5 * sin(vPat.y * 260.0);          // braids and locs: segments
    else streak = 0.5 + 0.5 * sin(vPat.x * 3.14159 * 160.0 + sin(vPat.y * 9.0) * 3.0); // fine strands
    vec3 c = uHair * (0.94 + (part > 0.4 && part < 0.6 ? 0.18 : 0.07) * streak);
    if (!gl_FrontFacing) c *= 0.6;
    diffuseColor.rgb = c;
  }`);
  };
  mat.customProgramCacheKey = () => "cc-hair";
  return mat;
}

/** Re-skins a part from a parts file (hair, garments) onto the body's bones, beside the body mesh. */
function attachPart(from: SkinnedMesh, mesh: SkinnedMesh, bones: Map<string, Bone>, material: Material): SkinnedMesh {
  const g = from.geometry;
  if (!g.getAttribute("pat")) g.setAttribute("pat", g.getAttribute("_pat"));
  widenAttrs(from);
  const part = new SkinnedMesh(g, material);
  part.position.copy(mesh.position); part.quaternion.copy(mesh.quaternion); part.scale.copy(mesh.scale);
  part.castShadow = true;
  part.frustumCulled = false;
  mesh.parent!.add(part);
  part.bind(new Skeleton(from.skeleton.bones.map((b) => bones.get(b.name) ?? b), from.skeleton.boneInverses), from.bindMatrix);
  return part;
}

/** Each vertex's region (scripts/wardrobe.mjs bodyRegions, built with the files): 4 is the head, for the brows. */
function markRegions(mesh: SkinnedMesh) {
  const g = mesh.geometry;
  if (!g.getAttribute("region")) g.setAttribute("region", g.getAttribute("_region") ?? new BufferAttribute(new Float32Array(g.getAttribute("position").count), 1));
}

/** How far each top template stands off the skin (scripts/wardrobe.mjs gaps, plus its thickness), for what's worn on it. */
const TOP_GAP: Record<string, number> = { hoodie: 0.02, tee: 0.017, crop: 0.014, vest: 0.017, zip: 0.019, cardigan: 0.017, blazer: 0.019, puffer: 0.038 };

/**
 * A body's measurements for its accessories (components/avatar/accessories.ts BodyFit), in the body group's space at the
 * bind pose: the neck's base, the chest, the hip, the left wrist. Widths follow the body type (the shader's widening).
 */
function measureBody(mesh: SkinnedMesh, body: Group, bones: Map<string, Bone>, build: { w: number; l: number }, gap: number): BodyFit {
  body.updateMatrixWorld(true);
  const pos = mesh.geometry.getAttribute("position");
  const pts: Vector3[] = [];
  for (let i = 0; i < pos.count; i++) pts.push(body.worldToLocal(mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld)));
  // The torso without the arms (they hang beside the hips and chest): by each vertex's heaviest bone.
  const joints = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
  const names = mesh.skeleton.bones.map((b) => b.name);
  const torso = pts.filter((_, i) => {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = weights.getComponent(i, k); if (w > bw) { bw = w; best = joints.getComponent(i, k); } }
    return !/(Arm|Hand)$/.test(names[best] ?? "");
  });
  const boneAt = (n: string) => { const b = bones.get(n); return b ? body.worldToLocal(b.getWorldPosition(new Vector3())) : new Vector3(); };
  const flat = (p: Vector3, c: Vector3) => Math.hypot(p.x - c.x, p.z - c.z);
  const mean = (xs: number[], d: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : d);
  // The neck's base: a slice just above the neck bone.
  const nb = boneAt("neck"), ny = nb.y + 0.01;
  const ring = pts.filter((p) => Math.abs(p.y - ny) < 0.012 && flat(p, nb) < 0.11);
  const at = new Vector3(mean(ring.map((p) => p.x), nb.x), ny, mean(ring.map((p) => p.z), nb.z));
  const r = mean(ring.map((p) => flat(p, at)), 0.055);
  const chestFrontRaw = Math.max(at.z + r, ...pts.filter((p) => Math.abs(p.x - at.x) < 0.04 && Math.abs(p.y - (ny - 0.12)) < 0.012).map((p) => p.z));
  // The chest: a slice at the upper spine, without the arms.
  const sb = boneAt("Spine02");
  const slice = torso.filter((p) => Math.abs(p.y - sb.y) < 0.012 && Math.abs(p.x - sb.x) < 0.2);
  const xs = slice.map((p) => p.x), zs = slice.map((p) => p.z);
  const cz = (Math.max(...zs, sb.z) + Math.min(...zs, sb.z)) / 2;
  const chest = { at: new Vector3(sb.x, sb.y, cz), rx: ((Math.max(...xs, sb.x + 0.15) - Math.min(...xs, sb.x - 0.15)) / 2) * build.w, rz: ((Math.max(...zs, cz + 0.1) - Math.min(...zs, cz - 0.1)) / 2) * build.w };
  // A crossbody strap's path: over the top of the +x shoulder, down across the front to the -x hip and back up behind,
  // standing off the body (and its clothes) all the way; the bag sits at the front of that hip.
  const hb = boneAt("Hips"), hy = hb.y + 0.02;
  const sx = nb.x + 0.09;
  const shoulderY = Math.max(nb.y - 0.05, ...torso.filter((p) => Math.abs(p.x - sx) < 0.02 && Math.abs(p.z - at.z) < 0.05 && p.y > nb.y - 0.12 && p.y < nb.y + 0.06).map((p) => p.y));
  const hipX = Math.min(hb.x - 0.12, ...torso.filter((p) => Math.abs(p.y - hy) < 0.015 && Math.abs(p.z - hb.z) < 0.06).map((p) => p.x));
  const off = 0.012 + gap;
  const top = new Vector3(sx, shoulderY + off, at.z), bottom = new Vector3(hb.x + (hipX - hb.x) * build.w - off, hy, hb.z);
  const front: Vector3[] = [], back: Vector3[] = [];
  for (let k = 1; k < 8; k++) {
    const q = top.clone().lerp(bottom, k / 8);
    const near = torso.filter((p) => Math.hypot(p.x - q.x, p.y - q.y) < 0.025).map((p) => p.z);
    const mid = near.length ? (Math.max(...near) + Math.min(...near)) / 2 : cz;
    const hi = near.length ? Math.max(...near) : cz + 0.1, lo = near.length ? Math.min(...near) : cz - 0.1;
    front.push(new Vector3(q.x, q.y, mid + (hi - mid) * build.w + off));
    back.push(new Vector3(q.x, q.y, mid + (lo - mid) * build.w - off));
  }
  const strap = [top, ...front, bottom, ...back.reverse()];
  const bagX = hb.x - 0.1;
  const hipFront = Math.max(hb.z + 0.08, ...torso.filter((p) => Math.abs(p.y - hy) < 0.02 && Math.abs(p.x - bagX) < 0.03).map((p) => p.z));
  const hip = new Vector3(bagX, hy, hb.z + (hipFront - hb.z) * build.w + off);
  // The left wrist: 3 cm up the forearm from the hand bone.
  const hand = boneAt("LeftHand"), dir = hand.clone().sub(boneAt("LeftForeArm")).normalize();
  const cuff = hand.clone().addScaledVector(dir, -0.03);
  const near = pts.filter((p) => Math.abs(p.clone().sub(cuff).dot(dir)) < 0.01).map((p) => p.clone().sub(cuff).projectOnPlane(dir).length()).filter((d) => d < 0.07);
  return {
    neck: { at, r, chestFront: at.z + (chestFrontRaw - at.z) * build.w },
    chest, hip, strap,
    wrist: { at: hand, dir, r: mean(near, 0.028) * build.l },
    hand: boneAt("RightHand"),
    gap,
  };
}

/** The thigh's radius (meters, body space): the mean distance of the left thigh's middle from its bone line. */
function measureThigh(mesh: SkinnedMesh, body: Group, bones: Map<string, Bone>): number {
  const up = bones.get("LeftUpLeg"), knee = bones.get("LeftLeg");
  if (!up || !knee) return 0.085;
  body.updateMatrixWorld(true);
  const a = body.worldToLocal(up.getWorldPosition(new Vector3())), b = body.worldToLocal(knee.getWorldPosition(new Vector3()));
  const ab = b.clone().sub(a), pos = mesh.geometry.getAttribute("position"), v = new Vector3();
  let sum = 0, n = 0;
  for (let i = 0; i < pos.count; i++) {
    body.worldToLocal(mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld));
    const t = v.clone().sub(a).dot(ab) / ab.lengthSq();
    if (t < 0.35 || t > 0.65) continue;
    const d = v.clone().sub(a.clone().addScaledVector(ab, t)).length();
    if (d < 0.14) { sum += d; n++; }
  }
  return n ? sum / n : 0.085;
}

/** `bare` (previews only): the body in its base layer, nothing worn. */
export function buildBaseAvatar(look: Look, opts: ModelAvatarOptions & { bare?: boolean } = {}): AvatarParts {
  const outfit: Outfit = opts.outfit ?? starterOutfit(getStyle(look.style), look.body, look.fit);
  const sex = modelSex(look);
  // A whole outfit's hat (SET_LOOKS), unless the player wears a faith or culture covering: that always stays. It
  // replaces the player's own cap or hat and any headphones.
  // Shop accessories (lib/accessories.ts): a Shop hat steps aside for a faith or culture covering too, and otherwise
  // wins over the outfit's hat; Shop glasses replace the Look's.
  const keeps = KEEPS_COVERING.has(look.covering);
  const extras = (opts.bare ? [] : outfit.extras ?? []).filter((x) => !(x.slot === "head" && keeps));
  const headExtra = extras.find((x) => x.slot === "head");
  const setHat = opts.bare || keeps || headExtra ? undefined : (outfit.set ? SET_LOOKS[outfit.set]?.[sex]?.hat : undefined);
  const anyHat = !!setHat || !!headExtra;
  // The procedural avatar, for its headwear (glasses, caps, coverings) and pedestal only.
  const proc = buildAvatar({ ...look, covering: anyHat ? "none" : look.covering, glasses: extras.some((x) => x.slot === "face") ? "none" : look.glasses }, {
    pedestal: opts.pedestal ?? false,
    outfit: anyHat && outfit.accessory === "headphones" ? { ...outfit, accessory: "none" } : outfit,
  });
  const hat = setHat ? buildSetHat(setHat.kind, setHat.color, setHat.accent) : null;
  const headPieces = extras.filter((x) => x.slot === "head" || x.slot === "face" || x.slot === "ears").map(buildHeadAccessory);
  const bodyPieces: { dispose(): void }[] = [];
  // Bags held in the hand: put down while sitting or lying (they'd go through the legs or the bed).
  const heldBags: Object3D[] = [];
  const showBags = () => heldBags.forEach((b) => { b.visible = !posed; });
  const root = new Group();
  const body = new Group();
  root.add(body);
  for (const c of [...proc.root.children]) if (c !== proc.body) root.add(c);

  const proxy = () => new Object3D();
  const legs = [proxy(), proxy()];
  const knees = [proxy(), proxy()];
  const arms = [proxy(), proxy()];
  arms[0].rotation.z = -0.13;
  arms[1].rotation.z = 0.13;
  const head = new Group();
  const torso = new Object3D();
  const hips = proxy();
  const chest = proxy();
  const forearms = [proxy(), proxy()];
  const restOf = new Map<Object3D, [number, number, number]>(
    [...legs, ...knees, ...arms, head, hips, chest, ...forearms].map((o) => [o, [o.rotation.x, o.rotation.y, o.rotation.z]]),
  );

  const materials: Material[] = [];
  let mixer: AnimationMixer | null = null;
  const actions: Record<string, AnimationAction> = {};
  let motion: "idle" | "walk" = "idle";
  let playing: string | null = null;
  // A clip played once (the wave) goes back to the idle or walk when it ends.
  let once: string | null = null;
  // Sitting and lying (Room3D's poseSit, poseLie): the clip, and the seat or mattress height to put it on.
  let posed: { kind: "sit" | "lie"; y: number } | null = null;
  // Where each of those clips puts the hips (and the knees, the head) in the body's space, measured once loaded.
  const marks: Partial<Record<"sit" | "lie", { hips: Vector3; knees: Vector3; head: Vector3 }>> = {};
  const driven: { bone: Object3D; rest: Quaternion; src: Object3D; restEuler: [number, number, number] }[] = [];
  // Sitting: the clip rests the hands on the knees or between them, on the body it was made on; wider thighs (the female
  // body, wider body types, trousers) would swallow them, so each frame a hand inside a thigh is swung out to its
  // surface by turning its upper arm (keepHandsOut).
  let thighR = 0.085;
  const sitBones: { thighs: [Bone | undefined, Bone | undefined][] } = { thighs: [] };
  const sitSides: { arm: Bone; fore: Bone; hand: Bone }[] = [];
  let model: Object3D | null = null;
  let disposed = false;
  const build = BASE_BUILD_SCALE[look.build] ?? BASE_BUILD_SCALE.athletic;
  const widen = { value: new Vector2(build.w - 1, build.l - 1) };

  const ready = (async () => {
    const gltf = await load(`/avatars/body/${sex}${lowGraphics() ? "-low" : ""}.glb`);
    if (disposed) return;
    const rig = cloneSkinned(gltf.scene);
    const bones = new Map<string, Bone>();
    rig.traverse((o) => { if ((o as Bone).isBone) bones.set(o.name, o as Bone); });
    let skinned: SkinnedMesh | null = null;
    rig.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) skinned = o as SkinnedMesh; });
    if (!skinned) throw new Error("no body mesh");
    const mesh = skinned as SkinnedMesh;
    markRegions(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    // Recolor: the skin to the Look's tone and the brows to the hair; the base layer stays as it is.
    const mat = (mesh.material as MeshStandardMaterial).clone();
    mesh.material = mat;
    materials.push(mat);
    const u = {
      uSkin: { value: new Color(look.skin) }, uSkinRef: { value: new Color(SKIN_REF[sex]) }, uHair: { value: new Color(look.hairColor) },
      uCover: { value: 0 },
    };
    const geo = mesh.geometry;
    if (!geo.getAttribute("cover")) geo.setAttribute("cover", geo.getAttribute("_cover") ?? new BufferAttribute(new Float32Array(geo.getAttribute("position").count), 1));
    widenAttrs(mesh);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute float region;\nattribute float cover;\nvarying float vRegion;\nflat varying float vCover;\nvoid main() {\n  vRegion = region;\n  vCover = cover;");
      widenVertex(sh, widen);
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", `uniform vec3 uSkin; uniform vec3 uSkinRef; uniform vec3 uHair; uniform int uCover;
varying float vRegion;
flat varying float vCover;
float lumOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {`)
        .replace("#include <map_fragment>", `#include <map_fragment>
  // Skin under a garment worn: not drawn.
  if ((int(vCover + 0.5) & uCover) != 0) discard;
  {
    vec3 c = diffuseColor.rgb;
    float lum = lumOf(c);
    // Skin: the baked orange, keyed by its color direction; its light and shade carry over.
    float d = distance(normalize(c + 1e-4), normalize(uSkinRef));
    float skinW = smoothstep(0.26, 0.12, d) * step(0.01, lum);
    vec3 skin = uSkin * clamp(lum / lumOf(uSkinRef), 0.0, 1.6);
    // Brows and lashes (dark, on the head) take the hair color.
    float browW = step(3.5, vRegion) * (1.0 - smoothstep(0.03, 0.08, lum)) * (1.0 - skinW);
    c = mix(c, skin, skinW);
    c = mix(c, uHair * 0.55, browW);
    diffuseColor.rgb = c;
  }`);
    };
    mat.customProgramCacheKey = () => "cc-base-avatar";

    // The garment, on the body's own bones (whole Shop outfits wait for stage 4).
    // The outfit's garments, on the body's own bones; the skin they hide isn't drawn.
    const low = lowGraphics() ? "-low" : "";
    const worn = opts.bare ? [] : garmentsFor(outfit, sex);
    const files = await Promise.all(worn.map((g) => load(`/avatars/garments/${g.file}-${sex}${low}.glb`).catch(() => null)));
    if (disposed) return;
    let cover = 0;
    worn.forEach((g, k) => {
      let src: SkinnedMesh | null = null;
      files[k]?.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) src = o as SkinnedMesh; });
      if (!src) return;
      const topHem = g.slot === "bottom" && g.file !== "overalls" ? worn.find((w) => w.slot === "top")?.hem : undefined;
      const gm = garmentMaterial(g.kind, g.color, g.accent, widen, topHem === undefined ? 9 : topHem + 0.03);
      materials.push(gm);
      attachPart(src, mesh, bones, gm);
      cover |= g.cover;
    });
    u.uCover.value = cover;

    // The hair, grown from this body's scalp: the style, and its lengths; under a hat, the lengths only.
    const hatOn = !!setHat || (!!headExtra && ACCESSORY_HATS.has(headExtra.kind)) || (!anyHat && HATS.has(look.covering));
    const hairHidden = HIDES_HAIR.has(look.covering) || (!!setHat && SET_HAT_HIDES_HAIR.has(setHat.kind)) || (!!headExtra && ACCESSORY_HIDES_HAIR.has(headExtra.kind));
    if (look.hair !== "bald" && !hairHidden) {
      const h = await load(`/avatars/hair/${sex}${low}.glb`).catch(() => null);
      if (disposed) return;
      const want = new Set([...(hatOn ? [] : [look.hair]), `${look.hair}-lengths`]);
      const hm = hairMaterial(look.hairColor);
      materials.push(hm);
      h?.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh && want.has(o.name)) attachPart(o as SkinnedMesh, mesh, bones, hm); });
    }

    // The head: measured from the head's vertices at the bind pose, so the game's hair and hats fit it.
    rig.updateMatrixWorld(true);
    const headBone = bones.get("Head");
    const regionAttr = mesh.geometry.getAttribute("region");
    const pos = mesh.geometry.getAttribute("position");
    const hb = new Box3(), v = new Vector3();
    // Through the skeleton: the files are quantized, and a skinned mesh's dequantization lives in its bind matrices.
    for (let i = 0; i < pos.count; i++) if (regionAttr.getX(i) > 3.5) { mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld); hb.expandByPoint(v); }
    if (headBone && !hb.isEmpty()) {
      const size = hb.getSize(new Vector3()).multiplyScalar(0.5), center = hb.getCenter(new Vector3());
      const k = Math.min(size.x / PROC_HEAD.x, size.y / PROC_HEAD.y, size.z / PROC_HEAD.z) * 1.04;
      const holder = new Group();
      // In head-bone space: the head's center, upright in the avatar's frame whatever the bone's own axes.
      const inv = new Matrix4().copy(headBone.matrixWorld).invert();
      const placed = new Matrix4().compose(center.add(new Vector3(0, size.y * 0.06, 0)), new Quaternion(), new Vector3(k, k, k));
      holder.applyMatrix4(inv.multiply(placed));
      if (proc.headwear) holder.add(proc.headwear);
      if (hat) holder.add(hat.group);
      for (const p of headPieces) holder.add(p.group);
      holder.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) o.castShadow = true; });
      headBone.add(holder);
    }

    // Height (the whole figure; width is the shader's) and facing (the bodies face +z, like the other avatars).
    rig.scale.setScalar(build.h);
    body.add(rig);
    model = rig;

    // Shop accessories on the body (necklaces, the scarf, a crossbody, the watch): made for this body's measurements
    // and pinned to their bone; bags in the hand wait for the idle pose, below.
    const handHeld = extras.filter((x) => x.slot === "hand" && x.kind !== "sling");
    const fit = extras.some((x) => x.slot === "neck" || x.slot === "wrist" || x.slot === "hand") ? measureBody(mesh, body, bones, build, TOP_GAP[worn.find((w) => w.slot === "top")?.file ?? ""] ?? 0) : null;
    const pin = (piece: ReturnType<typeof buildBodyAccessory>) => {
      bodyPieces.push(piece);
      body.add(piece.group);
      root.updateMatrixWorld(true);
      bones.get(piece.bone)?.attach(piece.group);
    };
    if (fit) for (const x of extras) if ((x.slot === "neck" || x.slot === "wrist" || x.slot === "hand") && !handHeld.includes(x)) pin(buildBodyAccessory(x, fit));

    // Stand-ins → bones (index 0 is the -x side, as in buildAvatar).
    rig.updateMatrixWorld(true);
    const side = (a: string, b: string) => {
      const pa = bones.get(a), pb = bones.get(b);
      if (!pa || !pb) return [];
      return pa.getWorldPosition(new Vector3()).x <= pb.getWorldPosition(new Vector3()).x ? [pa, pb] : [pb, pa];
    };
    const drive = (b: Object3D | undefined, src: Object3D) => {
      if (b) driven.push({ bone: b, rest: b.quaternion.clone(), src, restEuler: restOf.get(src) ?? [0, 0, 0] });
    };
    side("LeftUpLeg", "RightUpLeg").forEach((b, i) => drive(b, legs[i]));
    side("LeftLeg", "RightLeg").forEach((b, i) => drive(b, knees[i]));
    side("LeftArm", "RightArm").forEach((b, i) => drive(b, arms[i]));
    side("LeftForeArm", "RightForeArm").forEach((b, i) => drive(b, forearms[i]));
    for (const s of ["Left", "Right"]) {
      const arm = bones.get(`${s}Arm`), fore = bones.get(`${s}ForeArm`), hand = bones.get(`${s}Hand`);
      if (arm && fore && hand) sitSides.push({ arm, fore, hand });
      sitBones.thighs.push([bones.get(`${s}UpLeg`), bones.get(`${s}Leg`)]);
    }
    thighR = measureThigh(mesh, body, bones) * build.l + (worn.some((w) => w.slot === "bottom") ? 0.012 : 0);
    drive(bones.get("Hips"), hips);
    drive(bones.get("Spine"), chest);
    drive(headBone, head);

    mixer = new AnimationMixer(rig);
    const anims = await load(`/avatars/body/${sex}-anims.glb`).catch(() => null);
    if (disposed) return;
    for (const clip of anims?.animations ?? []) actions[clip.name] = mixer.clipAction(clip);
    // The sit and sleep clips' first frames, measured: where the hips, knees and head end up.
    const at = (name: string) => { const b = bones.get(name); return b ? body.worldToLocal(b.getWorldPosition(new Vector3())) : new Vector3(); };
    for (const [kind, clip] of [["sit", "sit"], ["lie", "sleep"]] as const) {
      const a = actions[clip];
      if (!a) continue;
      a.reset().play();
      mixer.update(0);
      root.updateMatrixWorld(true);
      marks[kind] = { hips: at("Hips"), knees: at("LeftLeg").add(at("RightLeg")).multiplyScalar(0.5), head: at("Head") };
      a.stop();
    }
    // A bag is held in the right hand where it hangs standing (the idle's first frame).
    if (fit && handHeld.length && actions.idle) {
      actions.idle.reset().play();
      mixer.update(0);
      root.updateMatrixWorld(true);
      fit.hand = at("RightHand");
      for (const x of handHeld) { const piece = buildBodyAccessory(x, fit); pin(piece); heldBags.push(piece.group); }
      showBags();
      actions.idle.stop();
    }
    mixer.addEventListener("finished", (e) => {
      if (once && e.action === actions[once]) { once = null; playing = null; fade(e.action, actions[motion]); }
    });
    (actions[playing ?? motion] ?? actions.idle)?.play();
    mixer.update(Math.random() * 2);
    place();
  })().catch(() => {
    if (!disposed) body.add(proc.body);
  });

  const hp = new Vector3(), sp = new Vector3(), ta = new Vector3(), tb = new Vector3(), cp = new Vector3(), ws = new Vector3();
  const swing = new Quaternion(), parentQ = new Quaternion();
  /** Pushes each hand's palm out of either thigh (sitting), turning the upper arm; positions in world space. */
  function keepHandsOut() {
    body.getWorldScale(ws);
    const R = (thighR + 0.03) * ws.x;
    for (const s of sitSides) {
      for (let pass = 0; pass < 3; pass++) {
        // The palm: a little past the wrist, along the forearm.
        s.hand.getWorldPosition(hp);
        s.fore.getWorldPosition(cp);
        hp.addScaledVector(hp.clone().sub(cp).normalize(), 0.05 * ws.x);
        let push: Vector3 | null = null;
        for (const [up, knee] of sitBones.thighs) {
          if (!up || !knee) continue;
          up.getWorldPosition(ta);
          knee.getWorldPosition(tb);
          const ab = tb.clone().sub(ta), t = Math.max(0, Math.min(1, hp.clone().sub(ta).dot(ab) / ab.lengthSq()));
          const c = ta.clone().addScaledVector(ab, t), out = hp.clone().sub(c), d = out.length();
          // Out to the surface, never down (a hand below a thigh would go into the seat): up or to the side instead.
          if (d < R) {
            const dir = d > 1e-5 ? out.normalize() : new Vector3(0, 1, 0);
            if (dir.y < 0) { dir.y = 0; if (dir.lengthSq() < 0.04) dir.set(0, 1, 0); dir.normalize(); }
            push = dir.multiplyScalar(R - d + 0.002 * ws.x);
          }
        }
        // Between the thighs and below their tops (where the seat is): up into the lap.
        if (!push && sitBones.thighs.length === 2) {
          const cs = sitBones.thighs.map(([up, knee]) => {
            up!.getWorldPosition(ta);
            knee!.getWorldPosition(tb);
            const ab = tb.clone().sub(ta), t = Math.max(0, Math.min(1, hp.clone().sub(ta).dot(ab) / ab.lengthSq()));
            return ta.clone().addScaledVector(ab, t);
          });
          const across = cs[1].clone().sub(cs[0]), u = hp.clone().sub(cs[0]).dot(across) / across.lengthSq();
          const lapY = (cs[0].y + cs[1].y) / 2 + thighR * 0.5 * ws.x;
          if (u > 0 && u < 1 && hp.y < lapY) push = new Vector3(0, lapY - hp.y, 0);
        }
        if (!push) break;
        // Turn the upper arm about the shoulder so the palm moves by `push`.
        s.arm.getWorldPosition(sp);
        const from = hp.clone().sub(sp), to = hp.clone().add(push).sub(sp);
        swing.setFromUnitVectors(from.normalize(), to.normalize());
        s.arm.parent!.getWorldQuaternion(parentQ);
        s.arm.quaternion.premultiply(parentQ.clone().invert().multiply(swing).multiply(parentQ));
        s.arm.updateMatrixWorld(true);
      }
    }
  }
  const fade = (from: AnimationAction | undefined, to: AnimationAction | undefined, loop = true) => {
    if (!to || to === from) return;
    to.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    to.reset().play();
    if (from) to.crossFadeFrom(from, 0.25, false);
  };
  const switchTo = (clip: string | null, loop = true) => {
    const from = actions[playing ?? motion] ?? actions[motion];
    playing = clip;
    once = loop ? null : clip;
    fade(from, actions[playing ?? motion] ?? actions[motion], loop);
  };
  /**
   * Puts a sitting or lying clip on its seat or mattress (the avatar's root, in the actor's space, as the old poses):
   * sitting, the thighs rest on the seat with the hips 12 cm back from its middle; lying, on the back with the head
   * toward -z (the headboard) and the hips 95 cm from the actor's spot, the clip's floor on the mattress.
   */
  function place() {
    const m = posed && marks[posed.kind];
    if (!posed || !m) return;
    if (posed.kind === "sit") {
      // The thighs' underside: between the hips and the knees, a thigh's thickness below the bones.
      const under = (m.hips.y + m.knees.y) / 2 - 0.08 * build.h;
      root.rotation.set(0, 0, 0);
      root.position.set(-m.hips.x, posed.y - under, -0.12 - m.hips.z);
      return;
    }
    const turn = Math.PI - Math.atan2(m.head.x - m.hips.x, m.head.z - m.hips.z);
    root.rotation.set(0, turn, 0);
    const hips = m.hips.clone().applyAxisAngle(new Vector3(0, 1, 0), turn);
    root.position.set(-hips.x, posed.y, -0.95 * build.h - hips.z);
  }
  const q = new Quaternion();
  const pq = new Quaternion();
  const delta = new Quaternion();
  const euler = new Euler();
  const rootQ = new Quaternion();
  const m4 = new Matrix4();

  return {
    root, body, head, torso, eyes: [], legs, knees, arms, hips, chest, forearms,
    hipY: BASE_HIP_Y[sex] * build.h,
    ready: ready.then(() => undefined),
    setMotion(next) {
      if (next === motion) return;
      const from = actions[playing ?? motion] ?? actions[motion];
      motion = next;
      if (!playing || !actions[playing]) fade(from, actions[next]);
    },
    play(clip, playOnce) {
      // Kept even before the clips have loaded; a clip the body doesn't have leaves the idle or walk on.
      if (clip === playing && !playOnce) return;
      if (posed && clip !== (posed.kind === "sit" ? "sit" : "sleep")) { posed = null; showBags(); }
      switchTo(clip, !playOnce);
    },
    pose(kind, surfaceY = 0) {
      posed = kind ? { kind, y: surfaceY } : null;
      showBags();
      if (!kind) { if (playing === "sit" || playing === "sleep") switchTo(null); return; }
      const clip = kind === "sit" ? "sit" : "sleep";
      if (playing !== clip) switchTo(clip);
      place();
    },
    update(dt) {
      if (!mixer || !model) return;
      for (const d of driven) d.bone.quaternion.copy(d.rest);
      mixer.update(dt);
      model.updateMatrixWorld(true);
      rootQ.setFromRotationMatrix(m4.extractRotation(model.matrixWorld)).invert();
      if (posed?.kind === "sit") keepHandsOut();
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
      hat?.dispose();
      headPieces.forEach((p) => p.dispose());
      bodyPieces.forEach((p) => p.dispose());
    },
  };
}
