// The new base bodies (step 2 of the avatar upgrade, docs/shop-manager.md section 5; owner, Oct 21): one bald, skinned
// body per presentation (public/avatars/body/, built by scripts/build-base-avatars.mjs), with a 24-bone skeleton,
// a baked texture and a walk. It returns the same AvatarParts as the modeled and procedural avatars, so Room3D and
// Avatar3D pose it the same way (legs, knees, arms, forearms, hips, chest and head stand-ins on top of the clip).
//   * Skin tone: the texture's skin is recolored to the Look's (a shader keys on the baked orange, keeping its shading).
//   * Until garment templates exist (stages 3 and 4), the baked grey basics take the outfit's colors by body region
//     (top, bottom, shoes from each vertex's main bone), and the brows take the hair color.
//   * Hair is grown from each body's own scalp (scripts/hair.mjs: public/avatars/hair/), so it fits the head; under a
//     hat only its lengths show, and full coverings hide it. Hats, coverings and glasses are the game's own
//     (buildAvatar), fitted to the head measured from the mesh.
//   * Body types stretch the skeleton, as before; the idle is made from the walk (arms at rest, a slow breath).
//   * Low-graphics mode loads the lighter file (half the triangles, a 512 px texture).
//   * Garment templates (stage 3: the hoodie) are cut from the same body by scripts/garments.mjs and share its
//     skeleton, so they bend with every pose and body type; the skin they hide is skipped (each vertex's cover bits).

import {
  AnimationClip, AnimationMixer, Box3, BufferAttribute, Color, DoubleSide, Euler, Group, Matrix4, MeshStandardMaterial, Object3D,
  Quaternion, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Vector3, VectorKeyframeTrack, type AnimationAction, type Bone,
  type Material,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Look } from "@/lib/look";
import { getStyle, starterOutfit, type Outfit } from "@/lib/styles";
import { garmentsFor, modelSex } from "@/lib/avatarCatalog";
import { lowGraphics } from "@/lib/graphics";
import { buildAvatar, type AvatarParts } from "./buildAvatar";
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

/** The baked colors the shader keys on (measured from the masters' textures). */
const SKIN_REF = { m: "rgb(226,140,89)", f: "rgb(253,158,98)" } as const;
const GREY_REF = "rgb(147,147,146)";

/** Body types: width (x, z) and height multipliers, with the head kept its own size (as the modeled avatar). */
export const BASE_BUILD_SCALE: Record<Look["build"], { w: number; h: number }> = {
  athletic: { w: 1, h: 1 }, curvy: { w: 1.05, h: 1 }, slim: { w: 0.9, h: 1.01 }, broad: { w: 1.12, h: 1 }, plus: { w: 1.22, h: 0.99 }, petite: { w: 0.94, h: 0.94 },
};
/** Hip height of each body standing (the Hips bone), for sitting; the masters are 1.75 (m) and 1.68 (f) tall. */
export const BASE_HIP_Y: Record<"m" | "f", number> = { m: 0.94, f: 0.92 };

/** The procedural head's size in its own space (buildAvatar's skull: radius 0.19, scaled 0.92, 1.12, 0.98). */
const PROC_HEAD = new Vector3(0.175, 0.213, 0.186);

/** A garment's details from its _PAT attribute (scripts/garments.mjs, scripts/wardrobe.mjs), by its template's kind
 *  (GARMENT_TEMPLATES): ribbed bands, the hoodie's pocket, zips, buttons, lapels, quilting, pleats, waistbands, soles.
 *  Lines are antialiased (fwidth); the inside is darker. */
function garmentMaterial(kind: number, color: string, accent: string, hideAbove = 9): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: kind === 8 ? 0.55 : 0.92, metalness: 0, side: DoubleSide });
  const u = { uTop: { value: new Color(color) }, uAccent: { value: new Color(accent) }, uKind: { value: kind }, uHideAbove: { value: hideAbove } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute vec4 pat;\nvarying vec4 vPat;\nvoid main() {\n  vPat = pat;");
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
    // A bottom under a top isn't drawn above the top's hem (the two bend a little differently and would cross).
    if (uKind >= 9 && uKind <= 12 && q.y > uHideAbove) discard;
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
    } else if (uKind >= 9 && uKind <= 11) {
      // Trousers, shorts, leggings: a waistband (near the top edge), the fly on trousers, stitched cuffs.
      bool top = q.y > -0.15;
      float wb = top ? 1.0 - smoothstep(0.032, 0.036, d) : 0.0;
      c *= 1.0 - 0.1 * wb - 0.14 * (top ? lineAt(d, 0.034, 0.0) : lineAt(d, 0.015, 0.0));
      if (uKind == 9 && front && q.y > -0.03) c *= 1.0 - 0.14 * lineAt(q.x, 0.018, 0.0006);
    } else if (uKind == 12) {
      // Skirt: knife pleats round it, a waistband.
      float a = q.x;
      c *= 0.9 + 0.1 * abs(sin(a * 3.14159 * 14.0));
      c *= 1.0 - 0.12 * (q.y > -0.05 ? 1.0 - smoothstep(0.028, 0.032, d) : 0.0);
    } else if (uKind == 13) {
      // Boots: a chunky sole in the accent, a padded top.
      c = mix(c, uAccent, 1.0 - smoothstep(0.028, 0.032, q.y));
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.02, 0.024, d));
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
  const part = new SkinnedMesh(g, material);
  part.position.copy(mesh.position); part.quaternion.copy(mesh.quaternion); part.scale.copy(mesh.scale);
  part.castShadow = true;
  part.frustumCulled = false;
  mesh.parent!.add(part);
  part.bind(new Skeleton(from.skeleton.bones.map((b) => bones.get(b.name) ?? b), from.skeleton.boneInverses), from.bindMatrix);
  return part;
}

/** Body regions for the outfit colors, by a vertex's main bone: the shins (2.75, between the bottom and the shoes so
 *  blending across the knee and ankle never crosses the head's code) carry the baked socks, worn in the shoe color. */
const REGION_OF = (name: string): number =>
  /Foot|Toe/i.test(name) ? 3 : /(Left|Right)Leg$/.test(name) ? 2.75 : /UpLeg/i.test(name) || /^Hips$/i.test(name) ? 2 : /^Head$|head_end|headfront/.test(name) ? 4 : 1;

/** Marks each vertex's region (1 top, 2 bottom, 2.75 shins, 3 shoes, 4 head) from its heaviest bone. Once per geometry. */
function markRegions(mesh: SkinnedMesh) {
  const g = mesh.geometry;
  if (g.getAttribute("region")) return;
  // Built with the files (scripts/wardrobe.mjs bodyRegions: the head by shape, so the baked collar is body).
  const built = g.getAttribute("_region");
  if (built) { g.setAttribute("region", built); return; }
  const joints = g.getAttribute("skinIndex"), weights = g.getAttribute("skinWeight");
  const names = mesh.skeleton.bones.map((b) => b.name);
  const out = new Float32Array(joints.count);
  for (let i = 0; i < joints.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = weights.getComponent(i, k); if (w > bw) { bw = w; best = joints.getComponent(i, k); } }
    out[i] = REGION_OF(names[best] ?? "");
  }
  g.setAttribute("region", new BufferAttribute(out, 1));
}

/** The idle: the walk's average upper-body pose (arms at rest), legs at their bind pose, and a slow breath. */
function makeIdle(walk: AnimationClip, bones: Map<string, Bone>): AnimationClip {
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [];
  const upper = /Spine|neck|Head|Shoulder|Arm|Hand/;
  for (const t of walk.tracks) {
    const [name, prop] = t.name.split(".");
    if (prop === "quaternion") {
      const bone = bones.get(name);
      let q = new Quaternion();
      if (upper.test(name)) {
        // The mean rotation over the cycle (sign-aligned to the first key).
        const v = t.values, acc = new Quaternion(0, 0, 0, 0), first = new Quaternion().fromArray(v, 0);
        for (let i = 0; i < v.length; i += 4) {
          const k = new Quaternion().fromArray(v, i);
          const s = k.dot(first) < 0 ? -1 : 1;
          acc.set(acc.x + s * k.x, acc.y + s * k.y, acc.z + s * k.z, acc.w + s * k.w);
        }
        q = acc.normalize();
      } else if (bone) q.copy(bone.quaternion);
      else continue;
      // The chest breathes: a small nod forward and back every four seconds. Every other bone sways by a hair, so the
      // pose keeps changing: three.js only rewrites a property whose value changed, and update() resets the driven
      // bones every frame, so a perfectly still clip would leave them at the bind pose.
      const keys = [0, 2, 4];
      const sway = /^Spine$/.test(name) ? 0.025 : 0.0002;
      const values: number[] = [];
      for (const time of keys) {
        const b = time === 2 ? q.clone().multiply(new Quaternion().setFromEuler(new Euler(sway, 0, 0))) : q;
        values.push(b.x, b.y, b.z, b.w);
      }
      tracks.push(new QuaternionKeyframeTrack(t.name, keys, values));
    } else if (prop === "position" && /Hips/.test(name)) {
      const v = t.values, n = v.length / 3, avg = [0, 0, 0];
      for (let i = 0; i < v.length; i += 3) { avg[0] += v[i] / n; avg[1] += v[i + 1] / n; avg[2] += v[i + 2] / n; }
      tracks.push(new VectorKeyframeTrack(t.name, [0, 2, 4], [...avg, avg[0], avg[1] + 0.0004, avg[2], ...avg]));
    }
  }
  return new AnimationClip("Idle", 4, tracks);
}

export function buildBaseAvatar(look: Look, opts: ModelAvatarOptions = {}): AvatarParts {
  const outfit: Outfit = opts.outfit ?? starterOutfit(getStyle(look.style), look.body, look.fit);
  const sex = modelSex(look);
  // The procedural avatar, for its hair, headwear and pedestal only (whole outfits' hats arrive with stage 4).
  const proc = buildAvatar(look, { pedestal: opts.pedestal ?? false, outfit });
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
  let actions: Partial<Record<"idle" | "walk", AnimationAction>> = {};
  let motion: "idle" | "walk" = "idle";
  const driven: { bone: Object3D; rest: Quaternion; src: Object3D; restEuler: [number, number, number] }[] = [];
  let model: Object3D | null = null;
  let disposed = false;
  const build = BASE_BUILD_SCALE[look.build] ?? BASE_BUILD_SCALE.athletic;

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

    // Recolor: skin to the Look's tone, the grey basics to the outfit by region, the shoes, the brows to the hair.
    const mat = (mesh.material as MeshStandardMaterial).clone();
    mesh.material = mat;
    materials.push(mat);
    const u = {
      uSkin: { value: new Color(look.skin) }, uSkinRef: { value: new Color(SKIN_REF[sex]) }, uGreyRef: { value: new Color(GREY_REF) },
      uTop: { value: new Color(outfit.topColor) }, uBottom: { value: new Color(outfit.bottomColor) }, uShoe: { value: new Color(outfit.shoeColor) },
      uHair: { value: new Color(look.hairColor) }, uCover: { value: 0 }, uTopSkin: { value: 0 }, uBottomSkin: { value: 0 },
    };
    const geo = mesh.geometry;
    if (!geo.getAttribute("cover")) geo.setAttribute("cover", geo.getAttribute("_cover") ?? new BufferAttribute(new Float32Array(geo.getAttribute("position").count), 1));
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute float region;\nattribute float cover;\nvarying float vRegion;\nflat varying float vCover;\nvoid main() {\n  vRegion = region;\n  vCover = cover;");
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", `uniform vec3 uSkin; uniform vec3 uSkinRef; uniform vec3 uGreyRef; uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uShoe; uniform vec3 uHair; uniform int uCover; uniform float uTopSkin; uniform float uBottomSkin;
varying float vRegion;
flat varying float vCover;
float lumOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {`)
        .replace("#include <map_fragment>", `#include <map_fragment>
  // Skin under a garment worn: not drawn.
  if ((int(vCover + 0.5) & uCover) != 0) discard;
  {
    vec3 c = diffuseColor.rgb;
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
    float lum = lumOf(c);
    // Skin: the baked orange, keyed by its color direction; its light and shade carry over.
    float d = distance(normalize(c + 1e-4), normalize(uSkinRef));
    float skinW = smoothstep(0.26, 0.12, d) * step(0.01, lum);
    vec3 skin = uSkin * clamp(lum / lumOf(uSkinRef), 0.0, 1.6);
    // The grey basics and white shoes take the outfit's colors by region.
    float grey = 1.0 - smoothstep(0.06, 0.16, sat);
    vec3 cloth = vRegion < 1.5 ? uTop : vRegion < 2.5 ? uBottom : uShoe;
    float ref = vRegion > 2.5 ? 0.9 : lumOf(uGreyRef);
    // Half the texture's light and shade: the baked basics are noisy (folds, frayed edges, dark socks).
    vec3 dyed = cloth * mix(1.0, clamp(lum / ref, 0.0, 1.4), vRegion > 2.5 ? 0.3 : 0.5);
    // AI textures are noisy, so the region decides, not the texel: anything on the body that isn't skin is cloth.
    float clothW = step(0.5, vRegion) * step(vRegion, 3.5) * step(0.02, lum) * max(grey, 0.85);
    // Brows and lashes (dark, on the head) take the hair color.
    float browW = step(3.5, vRegion) * (1.0 - smoothstep(0.03, 0.08, lum)) * (1.0 - skinW);
    vec3 brow = uHair * 0.55;
    c = mix(c, skin, skinW);
    c = mix(c, dyed, clothW * (1.0 - skinW));
    c = mix(c, brow, browW);
    // Under template clothes, what shows of the baked basics (a crop top's midriff, a vest's arms) is plain skin: no
    // trace of the basics' print.
    if ((uTopSkin > 0.5 && vRegion < 1.5) || (uBottomSkin > 0.5 && vRegion > 1.5 && vRegion < 2.5)) c = uSkin * (0.93 + 0.07 * clamp(lum / lumOf(uSkinRef), 0.0, 1.0));
    diffuseColor.rgb = c;
  }`);
    };
    mat.customProgramCacheKey = () => "cc-base-avatar";

    // The garment, on the body's own bones (whole Shop outfits wait for stage 4).
    // The outfit's garments, on the body's own bones; the skin they hide isn't drawn.
    const low = lowGraphics() ? "-low" : "";
    const worn = garmentsFor(outfit);
    const files = await Promise.all(worn.map((g) => load(`/avatars/garments/${g.file}-${sex}${low}.glb`).catch(() => null)));
    if (disposed) return;
    let cover = 0;
    worn.forEach((g, k) => {
      let src: SkinnedMesh | null = null;
      files[k]?.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) src = o as SkinnedMesh; });
      if (!src) return;
      const topHem = g.slot === "bottom" ? worn.find((w) => w.slot === "top")?.hem : undefined;
      const gm = garmentMaterial(g.kind, g.color, g.accent, topHem === undefined ? 9 : topHem + 0.03);
      materials.push(gm);
      attachPart(src, mesh, bones, gm);
      cover |= g.cover;
    });
    u.uCover.value = cover;
    // Under a template top, the baked basics' top shows as skin (a crop top's midriff, a vest's arms).
    u.uTopSkin.value = worn.some((g) => g.slot === "top") ? 1 : 0;
    u.uBottomSkin.value = worn.some((g) => g.slot === "bottom") ? 1 : 0;

    // The hair, grown from this body's scalp: the style, and its lengths; under a hat, the lengths only.
    const hatOn = !!proc.headwear?.children.length;
    if (look.hair !== "bald" && !HIDES_HAIR.has(look.covering)) {
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
      holder.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) o.castShadow = true; });
      headBone.add(holder);
    }

    // Size, body type and facing (the masters face +z, like the other avatars).
    rig.scale.set(build.w, build.h, build.w);
    if (headBone && build.w !== 1) headBone.scale.set(1 / build.w, 1, 1 / build.w);
    body.add(rig);
    model = rig;

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
    drive(bones.get("Hips"), hips);
    drive(bones.get("Spine"), chest);
    drive(headBone, head);

    mixer = new AnimationMixer(rig);
    const walk = gltf.animations[0];
    const idle = walk ? makeIdle(walk, bones) : undefined;
    actions = { idle: idle && mixer.clipAction(idle), walk: walk && mixer.clipAction(walk) };
    actions[motion]?.play();
    mixer.update(Math.random() * 2);
  })().catch(() => {
    if (!disposed) body.add(proc.body);
  });

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
