// Copies MapLibre's web worker into public/ so the browser can load it from our
// own domain (MapLibre 6 ships it as a separate module). Runs before dev/build.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = join(root, "public/maplibre/maplibre-gl-worker.mjs");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("copied MapLibre worker to public/maplibre/");
