// Downloads the owner's avatar sources listed in assets/avatar-animations.json (the base bodies and their animation
// clips, made with Higgsfield) into assets/avatars/sources/, which git ignores: they are full rigged bodies, too large
// for the repository, and never shipped. scripts/build-base-avatars.mjs builds the game's files from them.
//
// Usage: node scripts/fetch-avatar-sources.mjs   (npm run avatars:fetch; skips files already there)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "assets/avatars/sources";
const spec = JSON.parse(readFileSync("assets/avatar-animations.json", "utf8"));
mkdirSync(DIR, { recursive: true });
const files = [
  ...Object.entries(spec.bodies).map(([body, b]) => ({ file: `${body}-body.glb`, url: b.baseBody })),
  ...spec.clips.map((c) => ({ file: `${c.body}-${c.name}.glb`, url: c.url })),
];
for (const f of files) {
  const out = `${DIR}/${f.file}`;
  if (existsSync(out)) continue;
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`${f.file}: download failed (${res.status})`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(out);
}
console.log(`${files.length} sources in ${DIR}`);
