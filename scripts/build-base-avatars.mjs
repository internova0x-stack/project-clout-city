// Builds the game's base bodies (step 2 of the avatar upgrade, docs/shop-manager.md) from the owner's bald masters in
// assets/avatars/ (base-male.glb, base-female.glb: one skinned mesh, a 24-bone skeleton, a baked texture and a walk).
// Each becomes two files in public/avatars/body/:
//   m.glb, f.glb          the texture at 1024 px WebP, the mesh welded and quantized
//   m-low.glb, f-low.glb  low-graphics mode: the texture at 512 px, the mesh simplified to about half the triangles
// The walk is kept (resampled); the idle is made from it in the game (components/avatar/baseAvatar.ts).
//
// Usage: node scripts/build-base-avatars.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { statSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
for (const [src, sex] of [["assets/avatars/base-male.glb", "m"], ["assets/avatars/base-female.glb", "f"]]) {
  for (const low of [false, true]) {
    const doc = await io.read(src);
    const size = low ? 512 : 1024;
    await doc.transform(
      dedup(),
      weld(),
      ...(low ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 })] : []),
      resample(),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], quality: 82 }),
      quantize(),
      prune(),
    );
    const out = `public/avatars/body/${sex}${low ? "-low" : ""}.glb`;
    await io.write(out, doc);
    console.log(out, `${Math.round(statSync(out).size / 1024)} KB`);
  }
}
