// Builds the avatar models in public/avatars/ from Quaternius's Ultimate Modular Men and Women
// packs (CC0 1.0, quaternius.com; "Individual Characters/glTF"). Each character is four skinned
// parts on one shared skeleton (Head with its hair or hat, Body, Legs, Feet), so the game mixes
// parts from different characters. This keeps the parts and the skeleton, drops the props
// (pistol, sword, backpack), quantizes the meshes and writes binary .glb. Every character shares
// one skeleton, so the animations are stored once per body type (m/_anims.glb, f/_anims.glb,
// skeleton only) and dropped from the character files.
//
// Usage: node scripts/build-avatar-assets.mjs <men glTF folder> <women glTF folder>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, quantize, weld, resample } from "@gltf-transform/functions";
import { mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const KEEP_ANIMATIONS = new Set(["Idle", "Idle_Neutral", "Walk", "Run", "Wave", "Interact"]);
const PROPS = /^(Pistol|Sword|Backpack)$/;

const [menDir, womenDir] = process.argv.slice(2);
if (!menDir || !womenDir) {
  console.error("Usage: node scripts/build-avatar-assets.mjs <men glTF folder> <women glTF folder>");
  process.exit(1);
}

/** Removes an animation with its samplers and their keyframe data (prune leaves those behind). */
function dropAnimation(anim) {
  for (const s of anim.listSamplers()) {
    const input = s.getInput(), output = s.getOutput();
    s.dispose();
    for (const a of [input, output]) if (a && a.listParents().every((p) => p.propertyType === "Root")) a.dispose();
  }
  for (const c of anim.listChannels()) c.dispose();
  anim.dispose();
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [dir, out] of [[menDir, "public/avatars/m"], [womenDir, "public/avatars/f"]]) {
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".gltf") && !f.startsWith("."))) {
    const doc = await io.read(join(dir, file));
    const root = doc.getRoot();
    for (const node of root.listNodes()) if (PROPS.test(node.getName())) node.dispose();
    for (const anim of root.listAnimations()) dropAnimation(anim);
    await doc.transform(prune(), dedup(), weld(), quantize());
    const target = join(out, `${basename(file, ".gltf")}.glb`);
    await io.write(target, doc);
    console.log(target);
  }
  // The shared animations, from the casual character (every character's are the same).
  const src = readdirSync(dir).find((f) => /^Casual(_2)?\.gltf$/.test(f));
  const doc = await io.read(join(dir, src));
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) if (!KEEP_ANIMATIONS.has(anim.getName())) dropAnimation(anim);
  for (const node of root.listNodes()) if (node.getMesh()) node.setMesh(null).setSkin(null);
  await doc.transform(prune({ keepLeaves: true }), dedup(), resample());
  await io.write(join(out, "_anims.glb"), doc);
  console.log(join(out, "_anims.glb"));
}
