// Compresses furniture models for the rooms (components/room/models.ts): node scripts/models.mjs <in.glb> <out-name> [max KB]
// Duplicate data removed, unused parts pruned, vertices welded, the mesh simplified to about half its triangles (within a
// tiny error), then meshopt-compressed (EXT_meshopt_compression: models.ts gives the loader the decoder). Textures are WebP,
// stepped down from 384 px until the file is under the target (80 KB by default; owner, Nov 20). Writes public/models/<out-name>.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, textureCompress, resample, simplify, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { statSync, writeFileSync } from "node:fs";

const [, , input, name, maxArg] = process.argv;
if (!input || !name) { console.error("usage: node scripts/models.mjs <in.glb> <out-name.glb> [max KB]"); process.exit(1); }
const maxKb = Number(maxArg ?? 80);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

let buf;
for (const [size, quality] of [[384, 72], [320, 68], [256, 64], [192, 60]]) {
  const doc = await io.read(input);
  doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  await doc.transform(
    dedup(), prune(), weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 }),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], quality }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  buf = await io.writeBinary(doc);
  if (buf.byteLength <= maxKb * 1024) break;
}
const out = `public/models/${name}`;
writeFileSync(out, buf);
console.log(`${out}: ${(statSync(input).size / 1024).toFixed(0)} KB -> ${(buf.byteLength / 1024).toFixed(0)} KB`);
