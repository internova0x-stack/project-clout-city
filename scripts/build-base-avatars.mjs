// Builds the game's base bodies and their garment templates (stages 2 and 3 of the avatar upgrade, docs/shop-manager.md)
// from the owner's bald masters in assets/avatars/ (base-male.glb, base-female.glb: one skinned mesh, a 24-bone
// skeleton, a baked texture and a walk). Each body becomes two files in public/avatars/body/:
//   m.glb, f.glb          the texture at 1024 px WebP, the mesh welded and quantized
//   m-low.glb, f-low.glb  low-graphics mode: the texture at 512 px, the mesh simplified to about half the triangles
// The walk is kept (resampled); the idle is made from it in the game (components/avatar/baseAvatar.ts). Each body
// vertex carries _COVER, the garments that hide it (scripts/garments.mjs COVER), so the game skips skin under clothes.
// Each garment template (scripts/garments.mjs) becomes public/avatars/garments/<template>-<m|f>[-low].glb: the cut
// surface on the same skeleton, no texture, its details in _PAT for the game's shader.
//
// Usage: node scripts/build-base-avatars.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { buildHoodie, coverBits, readBody } from "./garments.mjs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
// Our own attributes (_COVER bits, _PAT details) keep their exact values.
const QUANTIZE = { pattern: /^[^_]/ };
const GARMENTS = { hoodie: buildHoodie };
mkdirSync("public/avatars/garments", { recursive: true });

const size = (out) => `${Math.round(statSync(out).size / 1024)} KB`;
for (const [src, sex] of [["assets/avatars/base-male.glb", "m"], ["assets/avatars/base-female.glb", "f"]]) {
  for (const low of [false, true]) {
    const doc = await io.read(src);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const body = readBody(prim, doc.getRoot().listSkins()[0]);
    prim.setAttribute("_COVER", doc.createAccessor().setType("SCALAR").setArray(coverBits(body)).setBuffer(doc.getRoot().listBuffers()[0]));
    const px = low ? 512 : 1024;
    await doc.transform(
      dedup(),
      weld(),
      ...(low ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 })] : []),
      resample(),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [px, px], quality: 82 }),
      quantize(QUANTIZE),
      prune(),
    );
    const out = `public/avatars/body/${sex}${low ? "-low" : ""}.glb`;
    await io.write(out, doc);
    console.log(out, size(out));

    for (const [name, make] of Object.entries(GARMENTS)) {
      const g = await io.read(src);
      const root = g.getRoot(), buf = root.listBuffers()[0];
      const gp = root.listMeshes()[0].listPrimitives()[0];
      const shape = make(readBody(gp, root.listSkins()[0]));
      for (const sem of gp.listSemantics()) gp.setAttribute(sem, null);
      for (const a of root.listAnimations()) {
        a.listChannels().forEach((c) => c.dispose());
        a.listSamplers().forEach((sm) => { sm.getInput()?.dispose(); sm.getOutput()?.dispose(); sm.dispose(); });
        a.dispose();
      }
      const flat = (rows, Arr) => Arr.from(rows.flat());
      const acc = (type, array, normalized = false) => g.createAccessor().setType(type).setArray(array).setBuffer(buf).setNormalized(normalized);
      gp.setAttribute("POSITION", acc("VEC3", flat(shape.pos, Float32Array)));
      gp.setAttribute("NORMAL", acc("VEC3", normals(shape)));
      gp.setAttribute("JOINTS_0", acc("VEC4", flat(shape.joints, Uint16Array)));
      gp.setAttribute("WEIGHTS_0", acc("VEC4", flat(shape.weights, Float32Array)));
      gp.setAttribute("_PAT", acc("VEC4", Int16Array.from(shape.pat.flat().map((v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767))), true));
      gp.setIndices(acc("SCALAR", Uint32Array.from(shape.idx)));
      gp.setMaterial(g.createMaterial(name).setRoughnessFactor(0.92).setMetallicFactor(0).setDoubleSided(true));
      await g.transform(
        weld(),
        ...(low ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002, lockBorder: true })] : []),
        quantize(QUANTIZE),
        prune(),
      );
      const gout = `public/avatars/garments/${name}-${sex}${low ? "-low" : ""}.glb`;
      await io.write(gout, g);
      console.log(gout, size(gout));
    }
  }
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
