// Builds the game's base bodies, their animations, garment templates and hair (the avatar upgrade, docs/shop-manager.md)
// from the owner's sources (assets/avatar-animations.json, downloaded by scripts/fetch-avatar-sources.mjs into
// assets/avatars/sources/, never committed): a bald, barefoot body per presentation in flat grey underwear, rigged
// with a 24-bone skeleton and a walk, plus animation clips made on it.
//   public/avatars/body/m.glb, f.glb          the texture at 1024 px WebP (islands padded), matte, the mesh welded
//   public/avatars/body/m-low.glb, f-low.glb  low-graphics mode: 512 px, about half the triangles
//   public/avatars/body/m-anims.glb, f-anims.glb  the walk and every clip (idle, run, sit, sleep, dance, wave),
//                                              retargeted onto the body's own skeleton (scripts/retarget.mjs)
// Each body vertex carries _COVER (the garments that hide it) and _REGION (head or body, for the brows); body types are
// worked out in the game (lib/bodyTypes.ts). Each garment template (scripts/garments.mjs, scripts/wardrobe.mjs) becomes
// public/avatars/garments/<template>-<m|f>[-low].glb and every hairstyle (scripts/hair.mjs) public/avatars/hair/.
//
// Usage: npm run avatars:fetch, then node scripts/build-base-avatars.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { buildHoodie, coverBits, readBody } from "./garments.mjs";
import { buildHair } from "./hair.mjs";
import { retarget } from "./retarget.mjs";
import { bleedTexture } from "./texture-bleed.mjs";
import { WARDROBE, bodyRegions, buildWardrobe, wardrobeCover } from "./wardrobe.mjs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
// The standard attributes are quantized; our own are small by themselves: _COVER bits as whole numbers in a float, _REGION in a byte,
// _PAT details as normalized 16-bit numbers. (Body types are worked out in the game when a body loads: lib/bodyTypes.ts.)
const QUANTIZE = { pattern: /^(POSITION|NORMAL|TEXCOORD|JOINTS|WEIGHTS|TANGENT)/ };
const GARMENTS = { hoodie: buildHoodie, ...Object.fromEntries(Object.keys(WARDROBE).map((n) => [n, (body) => buildWardrobe(body, n)])) };
const SPEC = JSON.parse(readFileSync("assets/avatar-animations.json", "utf8"));
const SRC = "assets/avatars/sources";
// Clips one body takes from the other (same 24 bones, retargeted the same way). The female sit was made for a high
// stool (knees up, feet tucked back under the seat), so on a chair, sofa or bench her shins went through the seat
// (owner, Oct 21: "An error on some of the legs"); she sits with the male clip, an ordinary chair sit.
const BORROW = { female: { sit: "male" } };
mkdirSync("public/avatars/garments", { recursive: true });
mkdirSync("public/avatars/hair", { recursive: true });

const size = (out) => `${Math.round(statSync(out).size / 1024)} KB`;
const dropAnimations = (root) => {
  for (const a of root.listAnimations()) {
    a.listChannels().forEach((c) => c.dispose());
    a.listSamplers().forEach((sm) => { sm.getInput()?.dispose(); sm.getOutput()?.dispose(); sm.dispose(); });
    a.dispose();
  }
};

for (const [body, sex] of [["male", "m"], ["female", "f"]]) {
  const src = `${SRC}/${body}-body.glb`;
  if (!existsSync(src)) throw new Error(`${src} is missing: run npm run avatars:fetch`);
  for (const low of [false, true]) {
    const doc = await io.read(src);
    const root = doc.getRoot(), prim = root.listMeshes()[0].listPrimitives()[0], skin = root.listSkins()[0];
    const b = readBody(prim, skin);
    // Cover bits as whole numbers in a float (the shader tests them as an int); every template's bit at once.
    // (Whole numbers in a float: exact up to 24 bits, more than 16 templates' worth.)
    const bits = Float32Array.from(coverBits(b));
    const more = new Uint32Array(b.count);
    wardrobeCover(b, more);
    for (let i = 0; i < bits.length; i++) bits[i] = bits[i] + more[i];
    if (more.some((m) => m >= 2 ** 24)) throw new Error("cover bits past 24");
    prim.setAttribute("_COVER", doc.createAccessor().setType("SCALAR").setArray(bits).setBuffer(root.listBuffers()[0]));
    // Regions: whole numbers (1 body, 4 head), so a byte each.
    prim.setAttribute("_REGION", doc.createAccessor().setType("SCALAR").setArray(Uint8Array.from(bodyRegions(b), (r) => (r > 3.5 ? 4 : 1))).setBuffer(root.listBuffers()[0]));
    // The texture's islands padded outward, so mipmaps never bring in what's between them (light seams); matte.
    await bleedTexture(root.listTextures()[0], prim);
    for (const m of root.listMaterials()) m.setRoughnessFactor(0.9).setMetallicFactor(0);
    dropAnimations(root); // the walk lives in the shared animation file
    const px = low ? 512 : 1024;
    await doc.transform(
      dedup(),
      weld(),
      ...(low ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 })] : []),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [px, px], quality: 82 }),
      quantize(QUANTIZE),
      prune(),
    );
    const out = `public/avatars/body/${sex}${low ? "-low" : ""}.glb`;
    await io.write(out, doc);
    console.log(out, size(out));

    for (const [name, make] of Object.entries(GARMENTS)) {
      await writeParts(src, `public/avatars/garments/${name}-${sex}${low ? "-low" : ""}.glb`, (bd) => ({ [name]: make(bd) }), low);
    }
    // Every hairstyle for this body in one file (scripts/hair.mjs).
    await writeParts(src, `public/avatars/hair/${sex}${low ? "-low" : ""}.glb`, buildHair, low);
  }
  await writeAnimations(body, sex);
}

/**
 * The body's walk and every clip for it in assets/avatar-animations.json, retargeted onto its skeleton, in one file:
 * the skeleton's nodes and the animations (rotations, and the hips' position), named by the clip ("idle", "dance").
 */
async function writeAnimations(body, sex) {
  const doc = await io.read(`${SRC}/${body}-body.glb`);
  const root = doc.getRoot(), buf = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buf);
  const joints = root.listSkins()[0].listJoints();
  const byName = Object.fromEntries(joints.map((j) => [j.getName(), j]));
  const add = (name, r) => {
    const anim = doc.createAnimation(name), input = acc("SCALAR", r.times);
    for (const [bone, values] of Object.entries(r.rotations)) {
      const s = doc.createAnimationSampler().setInput(input).setOutput(acc("VEC4", values)).setInterpolation("LINEAR");
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(byName[bone]).setTargetPath("rotation").setSampler(s));
    }
    const s = doc.createAnimationSampler().setInput(input).setOutput(acc("VEC3", r.hips)).setInterpolation("LINEAR");
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(byName.Hips).setTargetPath("translation").setSampler(s));
  };
  // The walk is the body's own (its skeleton), retargeted onto itself so every clip is made the same way.
  const clips = [{ name: "walk", file: `${SRC}/${body}-body.glb` }, ...SPEC.clips.filter((c) => c.body === body).map((c) => {
    const from = BORROW[body]?.[c.name] ?? body;
    return { name: c.name, file: `${SRC}/${from}-${c.name}.glb` };
  })];
  const results = [];
  for (const c of clips) {
    try {
      results.push([c.name, retarget(doc, await io.read(c.file))]);
    } catch (e) {
      console.log(`  ! ${body} ${c.name}: ${e.message} (left out)`);
    }
  }
  dropAnimations(root);
  for (const [name, r] of results) add(name, r);
  // Nothing but the skeleton and the animations.
  for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.dispose(); }
  root.listSkins().forEach((s) => s.dispose());
  await doc.transform(resample({ tolerance: 1e-4 }), prune());
  const out = `public/avatars/body/${sex}-anims.glb`;
  await io.write(out, doc);
  console.log(out, size(out), results.map((r) => `${r[0]} ${r[1].duration.toFixed(1)}s`).join(", "));
}

/**
 * Writes skinned parts built from a body (garments, hair) as one file: the body's skeleton, no animation or texture,
 * one mesh per part (named), each with its _PAT details for the game's shader.
 */
async function writeParts(src, out, make, low) {
  const g = await io.read(src);
  const root = g.getRoot(), buf = root.listBuffers()[0];
  const bodyNode = root.listNodes().find((n) => n.getMesh());
  const skin = bodyNode.getSkin(), parent = bodyNode.getParentNode();
  const body = readBody(bodyNode.getMesh().listPrimitives()[0], skin);
  const parts = make(body);
  dropAnimations(root);
  bodyNode.getMesh().dispose();
  bodyNode.dispose();
  const flat = (rows, Arr) => Arr.from(rows.flat());
  const acc = (type, array, normalized = false) => g.createAccessor().setType(type).setArray(array).setBuffer(buf).setNormalized(normalized);
  const material = g.createMaterial("part").setRoughnessFactor(0.92).setMetallicFactor(0).setDoubleSided(true);
  for (const [name, shape] of Object.entries(parts)) {
    const prim = g.createPrimitive()
      .setAttribute("POSITION", acc("VEC3", flat(shape.pos, Float32Array)))
      .setAttribute("NORMAL", acc("VEC3", normals(shape)))
      .setAttribute("JOINTS_0", acc("VEC4", flat(shape.joints, Uint16Array)))
      .setAttribute("WEIGHTS_0", acc("VEC4", flat(shape.weights, Float32Array)))
      .setAttribute("_PAT", acc("VEC4", Int16Array.from(shape.pat.flat().map((v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767))), true))
      .setIndices(acc("SCALAR", Uint32Array.from(shape.idx)))
      .setMaterial(material);
    const node = g.createNode(name).setMesh(g.createMesh(name).addPrimitive(prim)).setSkin(skin);
    parent.addChild(node);
  }
  await g.transform(
    weld(),
    ...(low ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002, lockBorder: true })] : []),
    quantize(QUANTIZE),
    prune(),
  );
  await io.write(out, g);
  console.log(out, size(out));
}

/** Area-weighted vertex normals of a garment. */
function normals({ pos, idx }) {
  const n = new Float32Array(pos.length * 3);
  for (let f = 0; f < idx.length; f += 3) {
    const [a, b, c] = [idx[f], idx[f + 1], idx[f + 2]].map((i) => pos[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const fn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [idx[f], idx[f + 1], idx[f + 2]]) for (let k = 0; k < 3; k++) n[i * 3 + k] += fn[k];
  }
  for (let i = 0; i < pos.length; i++) {
    const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) n[i * 3 + k] /= l;
  }
  return n;
}
