// Compresses furniture models for the rooms (components/room/models.ts): node scripts/models.mjs <in.glb> <out-name>
// Textures down to 512 px WebP, duplicate data removed, unused parts pruned, vertices welded. Writes public/models/<out-name>.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, textureCompress, resample } from "@gltf-transform/functions";
import sharp from "sharp";
import { statSync } from "node:fs";

const [, , input, name] = process.argv;
if (!input || !name) { console.error("usage: node scripts/models.mjs <in.glb> <out-name.glb>"); process.exit(1); }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
await doc.transform(dedup(), prune(), weld(), resample(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 80 }));
const out = `public/models/${name}`;
await io.write(out, doc);
console.log(`${out}: ${(statSync(input).size / 1024).toFixed(0)} KB -> ${(statSync(out).size / 1024).toFixed(0)} KB`);
