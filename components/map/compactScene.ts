// The compact map's 3D scene (lib/compactMap.ts, owner Oct 29): the boroughs as islands on the water, a street grid
// with blocks colored by neighborhood, every place's own low-poly landmark (components/map/landmarkModels.ts, the
// game's building style) standing on its block, filler buildings and parks on the rest, the elevated train, the
// bridges and the ferry, the jokes (a bronze Pizza Rat, the condo lot, the Mayor's billboard), and fog over the
// boroughs that haven't opened. No React here: components/map/CompactMap.tsx drives it.

import {
  Box3, BoxGeometry, CanvasTexture, RepeatWrapping, Raycaster, Vector2, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight,
  InstancedMesh, type Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, PerspectiveCamera,
  PlaneGeometry, Quaternion, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer,
} from "three";
import {
  BORROWED_KIND, STOREFRONTS, COMPACT_GRID, CROSSINGS, DECOR, DISTRICTS, ELEVATED, ISLANDS, SPOTS, WORLD_SIZE, districtAt, gridToWorld,
  islandAt, type GridRect,
} from "@/lib/compactMap";
import { LANDMARKS, type LandmarkKind } from "@/lib/map/landmarks";
import { PLACES } from "@/lib/city";
import type { BoroughId } from "@/lib/map/boroughs";
import { animate, applyTheme, buildLandmark, newThemed, paintBigScreen, storefront, type Themed } from "./landmarkModels";
import { mergeStatic } from "./mergeModel";

const CELL = COMPACT_GRID.cell;
/** A block's size inside its streets. */
const BLOCK = CELL * 0.78;
const ROAD = "#B9BBC3";
const ROAD_NIGHT = "#3A3644";
const WATER = "#7CC4EE";
/** Sidewalks and plazas: light pavement, like the mockups (owner, Oct 29). */
const PAVEMENT = "#ECE8E0";
const WATER_NIGHT = "#16263F";
/** Land on the boroughs that have no neighborhoods yet. */
const LAND: Record<BoroughId, string> = { queens: "#E6DFD0", brooklyn: "#D6C3F0", manhattan: "#D9D4CB", bronx: "#DCD3C4", staten_island: "#D7DCC4" };

/** A neighborhood color mixed with pavement, for the lots inside the sidewalks. */
function tint(hex: string): string {
  const c = new Color(hex).lerp(new Color(PAVEMENT), 0.35);
  return `#${c.getHexString()}`;
}

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const solid = (color: string, o: { metal?: number; rough?: number } = {}) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0 });

function box(w: number, h: number, d: number, m: Material, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** A sign painted on a canvas (banner, billboard text). */
function signTexture(lines: string[], o: { w: number; h: number; bg: string; fg: string; font?: number }) {
  const c = document.createElement("canvas");
  c.width = o.w; c.height = o.h;
  const g = c.getContext("2d")!;
  g.fillStyle = o.bg; g.fillRect(0, 0, o.w, o.h);
  g.fillStyle = o.fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 ${o.font ?? Math.floor(o.h / (lines.length + 0.6))}px system-ui, sans-serif`;
  lines.forEach((l, i) => g.fillText(l, o.w / 2, (o.h / (lines.length + 1)) * (i + 1)));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Small models the landmark set doesn't have
// ---------------------------------------------------------------------------
function cart(color: string, umbrella: string): Group {
  const g = new Group();
  g.add(box(10, 6, 5, solid("#D9DCE2", { metal: 0.4 }), 0, 1.2, 0));
  for (const x of [-3.5, 3.5]) {
    const wheel = new Mesh(new CylinderGeometry(1.2, 1.2, 0.8, 10), solid("#2B2B2F"));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 1.2, 2.8); g.add(wheel);
  }
  g.add(box(10.4, 1.2, 5.4, solid(color), 0, 4.2, 0));
  const pole = new Mesh(new CylinderGeometry(0.25, 0.25, 7, 6), solid("#555"));
  pole.position.set(0, 10.5, 0); g.add(pole);
  const top = new Mesh(new ConeGeometry(7, 3, 8), solid(umbrella));
  top.position.set(0, 14.5, 0); g.add(top);
  // A short queue: the 2 AM line.
  const r = rand(color.length * 31);
  for (let i = 0; i < 4; i++) {
    const p = new Mesh(new CylinderGeometry(0.8, 0.8, 3.4, 6), solid(["#E5484D", "#3E63DD", "#2F8F5B", "#F5A524"][i]));
    p.position.set(-8 + i * -2.4 + r(), 1.7, 6 + r() * 2); g.add(p);
    const h = new Mesh(new SphereGeometry(0.8, 8, 6), solid("#C68E5F")); h.position.set(p.position.x, 4.2, p.position.z); g.add(h);
  }
  return g;
}

/** The bronze Pizza Rat (owner, Oct 29): on a stone pedestal, tourists taking photos. */
function ratStatue(): Group {
  const g = new Group();
  const bronze = solid("#A8743A", { metal: 0.75, rough: 0.35 });
  g.add(box(16, 6, 16, solid("#8E8A86"), 0, 0, 0));
  g.add(box(13, 1.2, 13, solid("#A39E98"), 0, 6, 0));
  const body = new Mesh(new SphereGeometry(5, 12, 10), bronze);
  body.scale.set(1, 1.15, 1.4); body.position.set(0, 12.5, 0); g.add(body);
  const head = new Mesh(new SphereGeometry(3.2, 12, 10), bronze);
  head.scale.set(1, 0.9, 1.3); head.position.set(0, 18, 4.5); g.add(head);
  for (const x of [-2.2, 2.2]) { const ear = new Mesh(new SphereGeometry(1.4, 8, 6), bronze); ear.scale.set(1, 1, 0.4); ear.position.set(x, 20.6, 3.6); g.add(ear); }
  const tail = new Mesh(new CylinderGeometry(0.5, 0.9, 13, 6), bronze);
  tail.rotation.x = Math.PI / 2.6; tail.position.set(0, 9, -9); g.add(tail);
  // The slice: a bronze wedge with a little shine.
  const slice = new Mesh(new ConeGeometry(4.5, 9, 3), bronze);
  slice.rotation.set(Math.PI / 2, 0, Math.PI / 6); slice.position.set(2.5, 16, 9.5); g.add(slice);
  const r = rand(77);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 1.4 + 0.6, d = 13 + r() * 3;
    const p = new Mesh(new CylinderGeometry(0.9, 0.9, 3.6, 6), solid(["#E5484D", "#3E63DD", "#2F8F5B", "#F5A524", "#8E4EC6"][i]));
    p.position.set(Math.cos(a) * d, 1.8, Math.sin(a) * d); g.add(p);
    const h = new Mesh(new SphereGeometry(0.9, 8, 6), solid("#C68E5F")); h.position.set(p.position.x, 4.4, p.position.z); g.add(h);
  }
  return g;
}

/** The empty lot (owner, Oct 29): a fence, two cranes and the banner. */
function condoLot(): Group {
  const g = new Group();
  g.add(box(BLOCK, 0.6, BLOCK, solid("#B79C7A"), 0, 0, 0));
  const fence = solid("#9EA3AD", { metal: 0.3 });
  const s = BLOCK / 2;
  for (const [w, d, x, z] of [[BLOCK, 0.4, 0, s], [BLOCK, 0.4, 0, -s], [0.4, BLOCK, s, 0], [0.4, BLOCK, -s, 0]] as const) g.add(box(w, 4, d, fence, x, 0, z));
  const banner = new Mesh(new PlaneGeometry(32, 8), new MeshBasicMaterial({ map: signTexture(["LUXURY CONDOS SOON"], { w: 640, h: 160, bg: "#FFFFFF", fg: "#26306B", font: 64 }) }));
  banner.position.set(0, 6.5, s + 0.4); g.add(banner);
  const yellow = solid("#F2B705");
  for (const [x, z, h] of [[-12, -10, 46], [12, -6, 38]] as const) {
    g.add(box(2, h, 2, yellow, x, 0, z));
    g.add(box(24, 1.6, 1.6, yellow, x + 6, h, z));
    g.add(box(4, 3, 4, solid("#444"), x - 5, h - 1, z));
  }
  return g;
}

/** Papa-Dani's billboard: his portrait and "A BRIGHTER TOMORROW". */
function billboard(): Group {
  const g = new Group();
  const post = solid("#6B6F7A", { metal: 0.4 });
  g.add(box(1.6, 18, 1.6, post, -10, 0, 0), box(1.6, 18, 1.6, post, 10, 0, 0));
  const c = document.createElement("canvas");
  c.width = 640; c.height = 360;
  const x = c.getContext("2d")!;
  x.fillStyle = "#1F4FA8"; x.fillRect(0, 0, 640, 360);
  x.fillStyle = "#E5484D"; x.fillRect(0, 230, 640, 34);
  x.fillStyle = "#FFFFFF"; x.font = "900 54px system-ui, sans-serif"; x.textAlign = "left";
  x.fillText("A BRIGHTER", 300, 110); x.fillText("TOMORROW", 300, 170);
  x.font = "800 30px system-ui, sans-serif"; x.fillText("— your Mayor", 300, 320);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  new TextureLoader().load("/cast/mayor-papa-dani.webp", (img) => {
    const src = img.image as CanvasImageSource;
    x.save(); x.beginPath(); x.arc(150, 180, 130, 0, Math.PI * 2); x.clip(); x.drawImage(src, 20, 50, 260, 260); x.restore();
    tex.needsUpdate = true;
  });
  const board = new Mesh(new PlaneGeometry(34, 19), new MeshBasicMaterial({ map: tex }));
  board.position.set(0, 26, 1); g.add(board);
  g.add(box(35, 20, 1, solid("#E9E6E0"), 0, 16.5, 0));
  return g;
}

/** Walls with rows of windows (shared per color), a flat roof on top. */
const windowMats = new Map<string, Material[]>();
function windowed(color: string, tall: boolean): Material[] {
  const key = `${color}:${tall}`;
  const have = windowMats.get(key);
  if (have) return have;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = tall ? "rgba(40,60,90,.55)" : "rgba(50,60,80,.5)";
  for (let y = 6; y < 64; y += 16) for (let x = 6; x < 64; x += 16) g.fillRect(x, y, 9, 9);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, tall ? 6 : 2);
  const side = new MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 });
  const roof = solid("#6F6A76");
  const mats = [side, side, roof, roof, side, side];
  windowMats.set(key, mats);
  return mats;
}

/** A filler block: a few low buildings, or a small park. */
function filler(seed: number, borough: BoroughId): Group {
  const r = rand(seed);
  const g = new Group();
  const palette = ["#F2A07B", "#F7D08A", "#9CD3C3", "#C8B6E2", "#F4B6C2", "#B5C99A", "#E8C9A0", "#A7C7E7"];
  const park = borough !== "manhattan" && r() < 0.32;
  if (park) {
    g.add(box(BLOCK, 0.6, BLOCK, solid("#9ED27F"), 0, 0, 0));
    const leaf = solid("#4E9A55");
    for (let i = 0; i < 6; i++) {
      const tx = (r() - 0.5) * BLOCK * 0.8, tz = (r() - 0.5) * BLOCK * 0.8, h = 6 + r() * 5;
      const trunk = new Mesh(new CylinderGeometry(0.5, 0.6, h * 0.4, 5), solid("#7A5A3A")); trunk.position.set(tx, h * 0.2, tz); g.add(trunk);
      const top = new Mesh(new SphereGeometry(h * 0.35, 7, 5), leaf); top.position.set(tx, h * 0.55, tz); g.add(top);
    }
    return g;
  }
  const n = borough === "manhattan" ? 2 : 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const w = BLOCK * (0.3 + r() * 0.25), d = BLOCK * (0.3 + r() * 0.25);
    const h = borough === "manhattan" ? 50 + r() * 120 : 8 + r() * 22;
    const x = (i % 2 ? 1 : -1) * (BLOCK / 2 - w / 2 - 1) * r();
    const z = (i < 2 ? -1 : 1) * (BLOCK / 2 - d / 2 - 1) * r();
    const color = borough === "manhattan" ? ["#B8C4D6", "#9FB3C8", "#C9CED6", "#8EA6C1"][Math.floor(r() * 4)] : palette[Math.floor(r() * palette.length)];
    const mesh = new Mesh(new BoxGeometry(w, h, d), windowed(color, borough === "manhattan"));
    mesh.position.set(x, h / 2, z);
    g.add(mesh);
    g.add(box(w * 0.92, 1, d * 0.92, solid("#6F6A76"), x, h, z));
  }
  return g;
}

/** A storefront with its sign, and a giant thing on its roof (lib/compactMap.ts STOREFRONTS). */
function storeModel(t: Themed, id: string): Group {
  const look = STOREFRONTS[id];
  const g = storefront(t, { name: look.name, awning: look.awning, wall: look.wall, seed: id.length * 13 });
  const top = 16.2;
  if (look.roof === "slice") {
    const slice = new Mesh(new ConeGeometry(6, 11, 3), solid("#F2C14E"));
    slice.rotation.set(-Math.PI / 2.3, 0, 0); slice.position.set(0, top + 4, 0); g.add(slice);
    for (const [x, z] of [[-1.5, 0], [1.6, 1.5], [0, -2.2]] as const) { const p = new Mesh(new CylinderGeometry(1, 1, 0.6, 10), solid("#C0392B")); p.position.set(x, top + 5.6 + z * 0.4, z); g.add(p); }
  } else if (look.roof === "bagel") {
    const bagel = new Mesh(new CylinderGeometry(6, 6, 3.2, 20, 1, false), solid("#C98B4A"));
    bagel.position.set(0, top + 2.2, 0); g.add(bagel);
    const hole = new Mesh(new CylinderGeometry(2, 2, 3.4, 16), solid("#3A2A1E")); hole.position.set(0, top + 2.3, 0); g.add(hole);
  } else if (look.roof === "olive") {
    const olive = new Mesh(new SphereGeometry(4, 12, 10), solid("#6B7F2A")); olive.scale.set(1, 0.8, 1.3); olive.position.set(0, top + 4, 0); g.add(olive);
  } else if (look.roof === "balloons") {
    ["#E5484D", "#FFFFFF", "#3E63DD", "#E5484D", "#3E63DD"].forEach((c, i) => {
      const b = new Mesh(new SphereGeometry(1.6, 10, 8), solid(c)); b.scale.y = 1.2; b.position.set(-5 + i * 2.5, top + 6 + (i % 2) * 1.5, 0); g.add(b);
    });
    const banner = new Mesh(new PlaneGeometry(11, 3), new MeshBasicMaterial({ map: signTexture(["VOTE!"], { w: 330, h: 90, bg: "#FFFFFF", fg: "#C62C3B", font: 70 }) }));
    banner.position.set(0, top + 2, 6.4); g.add(banner);
  } else if (look.roof === "dumpling") {
    const d = new Mesh(new SphereGeometry(4.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), solid("#F3E7CF")); d.scale.z = 0.7; d.position.set(0, top, 0); g.add(d);
  }
  return g;
}

/** A model's footprint and top, leaving out night-only parts (searchlight beams, light pools). */
function measure(model: Object3D, skip: ReadonlySet<Object3D>): Box3 {
  const b = new Box3();
  model.updateMatrixWorld(true);
  const visit = (o: Object3D) => {
    if (skip.has(o)) return;
    if ((o as Mesh).isMesh) b.expandByObject(o, false);
    else o.children.forEach(visit);
  };
  model.children.forEach(visit);
  return b;
}

export interface CompactScene {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  /** Each place's pin height (meters above its block), once its model is built. */
  heights: ReadonlyMap<string, number>;
  resize(w: number, h: number): void;
  render(): void;
  /** Night searchlights move: true while something animates. */
  tick(seconds: number): boolean;
  setNight(night: boolean): void;
  setLocked(locked: ReadonlySet<BoroughId>): void;
  setBigScreen(img: (CanvasImageSource & { width: number; height: number }) | null, handle?: string): void;
  /** Story-only places stand on the map only while their story runs (the pins say which are shown). */
  setShown(ids: ReadonlySet<string>): void;
  /** The place whose building is under a screen point (normalized device coordinates), if any. */
  pick(x: number, y: number): string | null;
  /** Builds a few more landmarks (the ones nearest `near` first); false once all are built. */
  buildMore(near: readonly [number, number], budgetMs: number): boolean;
  dispose(): void;
}

export function createCompactScene(quality: { pixelRatio: number; antialias: boolean }): CompactScene {
  const renderer = new WebGLRenderer({ antialias: quality.antialias, alpha: false });
  renderer.setPixelRatio(quality.pixelRatio);
  // Soft shadows on good phones (the mockups' depth); off in low graphics.
  const shadows = quality.antialias;
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = 2; }
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 5, 12000);
  const themed: Themed = newThemed();
  const hemi = new HemisphereLight("#FFF6E8", "#B9C6CF", 1.6);
  const sun = new DirectionalLight("#FFFFFF", 1.8);
  sun.position.set(WORLD_SIZE.w / 2 - 500, 900, WORLD_SIZE.h / 2 + 400);
  sun.target.position.set(WORLD_SIZE.w / 2, 0, WORLD_SIZE.h / 2);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const half = Math.max(WORLD_SIZE.w, WORLD_SIZE.h) * 0.62;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 100, far: 3000 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.6;
  }
  scene.add(hemi, sun, sun.target);

  // ---- Water, islands, streets, blocks ----
  const waterMat = new MeshBasicMaterial({ color: WATER });
  const water = new Mesh(new PlaneGeometry(WORLD_SIZE.w * 4, WORLD_SIZE.h * 4), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(WORLD_SIZE.w / 2, -0.5, WORLD_SIZE.h / 2);
  scene.add(water);
  const roadMat = solid(ROAD);
  for (const [, r] of Object.entries(ISLANDS) as [BoroughId, GridRect][]) {
    const w = (r.x1 - r.x0 + 1) * CELL, d = (r.y1 - r.y0 + 1) * CELL;
    scene.add(box(w + 6, 1.5, d + 6, roadMat, r.x0 * CELL + w / 2, -1.2, r.y0 * CELL + d / 2));
  }
  // Newtown Creek between Queens and Brooklyn.
  const creek = new Mesh(new PlaneGeometry(9 * CELL, 9), waterMat);
  creek.rotation.x = -Math.PI / 2;
  creek.position.set(5 * CELL + 4.5 * CELL, 0.35, 14 * CELL);
  scene.add(creek);
  // Lane dashes down the middle of every street on land.
  const dash = new BoxGeometry(4, 0.2, 0.8);
  const dashes: Matrix4[] = [];
  for (let y = 0; y <= COMPACT_GRID.rows; y++) {
    for (let x = 0; x < COMPACT_GRID.cols; x++) {
      if (!islandAt(x, y) && !islandAt(x, y - 1)) continue;
      for (const f of [0.25, 0.75]) dashes.push(new Matrix4().makeTranslation((x + f) * CELL, 0.4, y * CELL));
    }
  }
  for (let x = 0; x <= COMPACT_GRID.cols; x++) {
    for (let y = 0; y < COMPACT_GRID.rows; y++) {
      if (!islandAt(x, y) && !islandAt(x - 1, y)) continue;
      for (const f of [0.25, 0.75]) dashes.push(new Matrix4().makeTranslation(x * CELL, 0.4, (y + f) * CELL).multiply(new Matrix4().makeRotationY(Math.PI / 2)));
    }
  }
  const dashMesh = new InstancedMesh(dash, new MeshBasicMaterial({ color: "#FFFFFF" }), dashes.length);
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  scene.add(dashMesh);

  // ---- Street life (instanced): trees on the sidewalks, people, lamps, parked cars ----
  const trees: Matrix4[] = [], people: { m: Matrix4; c: string }[] = [], lamps: Matrix4[] = [], cars: { m: Matrix4; c: string }[] = [];
  const street = (x: number, y: number, cx: number, cz: number, free: boolean) => {
    const r = rand(x * 977 + y * 131 + 5);
    const e = BLOCK / 2 + 0.5;
    // Trees every few meters along two or three sides.
    for (const [ax, az, dx, dz] of [[-e, -e, 1, 0], [-e, e, 1, 0], [-e, -e, 0, 1], [e, -e, 0, 1]] as const) {
      if (r() < 0.25) continue;
      for (let t = 6; t < BLOCK; t += 11 + r() * 4) {
        const s = 0.8 + r() * 0.5;
        trees.push(new Matrix4().compose(new Vector3(cx + ax + dx * t, 0, cz + az + dz * t), new Quaternion(), new Vector3(s, s, s)));
      }
    }
    for (const [ax, az] of [[-e, -e], [e, e]] as const) lamps.push(new Matrix4().makeTranslation(cx + ax, 0, cz + az));
    const n = free ? 2 + Math.floor(r() * 3) : 4 + Math.floor(r() * 5);
    const shirts = ["#E5484D", "#3E63DD", "#2F8F5B", "#F5A524", "#8E4EC6", "#E54666", "#12A594", "#FFFFFF", "#1C2024"];
    for (let i = 0; i < n; i++) {
      const side = Math.floor(r() * 4), t = (r() - 0.5) * BLOCK;
      const px = cx + (side === 0 ? -e + 1.5 : side === 1 ? e - 1.5 : t), pz = cz + (side === 2 ? -e + 1.5 : side === 3 ? e - 1.5 : t);
      people.push({ m: new Matrix4().makeTranslation(px, 0, pz), c: shirts[Math.floor(r() * shirts.length)] });
    }
    if (r() < 0.45) {
      const taxi = r() < 0.35;
      const along = r() < 0.5;
      const px = along ? cx + (r() - 0.5) * BLOCK : cx + CELL / 2 - 3, pz = along ? cz + CELL / 2 - 3 : cz + (r() - 0.5) * BLOCK;
      cars.push({ m: new Matrix4().compose(new Vector3(px, 0, pz), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), along ? 0 : Math.PI / 2), new Vector3(1, 1, 1)),
        c: taxi ? "#F5C518" : ["#E5484D", "#3E63DD", "#FFFFFF", "#1C2024", "#8E8C99"][Math.floor(r() * 5)] });
    }
  };

  const occupied = new Set([...Object.values(SPOTS), ...DECOR.map((d) => d.at)].map(([x, y]) => `${x},${y}`));
  const blockMats = new Map<string, MeshStandardMaterial>();
  const blockMat = (c: string) => blockMats.get(c) ?? (blockMats.set(c, solid(c)), blockMats.get(c)!);
  const fillers = new Group();
  scene.add(fillers);
  for (let y = 0; y < COMPACT_GRID.rows; y++) {
    for (let x = 0; x < COMPACT_GRID.cols; x++) {
      const b = islandAt(x, y);
      if (!b) continue;
      const [cx, cz] = gridToWorld([x, y]);
      const color = districtAt(x, y)?.color ?? LAND[b];
      // Light pavement to the curb, the neighborhood's color as a soft tint on the lot inside it.
      const curb = box(BLOCK + 4, 1.4, BLOCK + 4, blockMat(PAVEMENT), cx, -0.4, cz);
      const lot = box(BLOCK - 4, 0.3, BLOCK - 4, blockMat(tint(color)), cx, 1, cz);
      curb.receiveShadow = lot.receiveShadow = true;
      scene.add(curb, lot);
      street(x, y, cx, cz, !occupied.has(`${x},${y}`));
      if (occupied.has(`${x},${y}`)) continue;
      const f = filler(x * 131 + y * 7919, b);
      if (shadows) f.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      f.position.set(cx, 1, cz);
      fillers.add(f);
    }
  }

  const instanced = (geo: BoxGeometry | CylinderGeometry | SphereGeometry | ConeGeometry, mat: Material, list: Matrix4[], at: Matrix4 = new Matrix4(), colors?: string[]) => {
    const mesh = new InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((m, i) => mesh.setMatrixAt(i, m.clone().multiply(at)));
    colors?.forEach((c, i) => mesh.setColorAt(i, new Color(c)));
    mesh.count = list.length;
    mesh.castShadow = shadows;
    scene.add(mesh);
    return mesh;
  };
  instanced(new CylinderGeometry(0.35, 0.45, 4, 5), solid("#7A5A3A"), trees, new Matrix4().makeTranslation(0, 2, 0));
  instanced(new SphereGeometry(3.2, 7, 5), solid("#5FA85A"), trees, new Matrix4().makeTranslation(0, 6, 0));
  instanced(new CylinderGeometry(0.2, 0.25, 7, 5), solid("#3B3F4A"), lamps, new Matrix4().makeTranslation(0, 3.5, 0));
  const lampHead = instanced(new SphereGeometry(0.6, 6, 4), new MeshStandardMaterial({ color: "#FFF4D6", emissive: "#FFD27A", emissiveIntensity: 0 }), lamps, new Matrix4().makeTranslation(0, 7.2, 0));
  instanced(new CylinderGeometry(0.55, 0.55, 2.2, 6), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), people.map((p) => p.m), new Matrix4().makeTranslation(0, 1.1, 0), people.map((p) => p.c));
  instanced(new SphereGeometry(0.55, 6, 5), solid("#C68E5F"), people.map((p) => p.m), new Matrix4().makeTranslation(0, 2.7, 0));
  instanced(new BoxGeometry(5, 1.6, 2.4), new MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), cars.map((c) => c.m), new Matrix4().makeTranslation(0, 1.2, 0), cars.map((c) => c.c));
  instanced(new BoxGeometry(2.8, 1.2, 2.2), solid("#2A2F3A"), cars.map((c) => c.m), new Matrix4().makeTranslation(-0.2, 2.5, 0));

  // ---- The elevated train, the bridges and the ferry ----
  const el = new Group();
  const green = solid("#2F8F5B");
  const elLen = (ELEVATED.x1 - ELEVATED.x0) * CELL;
  el.add(box(elLen, 2.4, 7, green, ELEVATED.x0 * CELL + elLen / 2, 13, ELEVATED.y * CELL));
  for (let x = ELEVATED.x0; x <= ELEVATED.x1; x += 0.5) el.add(box(1.2, 13, 1.2, green, x * CELL, 0, ELEVATED.y * CELL + 2.6), box(1.2, 13, 1.2, green, x * CELL, 0, ELEVATED.y * CELL - 2.6));
  // The stalled train (the 7, the N/W: it's always stalled).
  const car = solid("#C9CED6", { metal: 0.4 });
  for (let i = 0; i < 3; i++) el.add(box(20, 4.6, 5, car, 9.6 * CELL + i * 21, 15.4, ELEVATED.y * CELL));
  scene.add(el);

  const bridges = new Map<BoroughId, { barrier: Group }>();
  for (const c of CROSSINGS) {
    const [ax, az] = [c.from[0] * CELL, c.from[1] * CELL];
    const [bx, bz] = [c.until[0] * CELL, c.until[1] * CELL];
    const len = Math.hypot(bx - ax, bz - az);
    const g = new Group();
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = -Math.atan2(bz - az, bx - ax);
    if (c.ferry) {
      const hull = solid("#F28C28");
      g.add(box(18, 4, 7, hull, -len / 2 + 16, 0, 0), box(12, 4, 5, solid("#FFFFFF"), -len / 2 + 16, 4, 0));
    } else {
      g.add(box(len + 24, 2.5, 12, solid("#8D8A95"), 0, 7, 0));
      for (const s of [-0.5, 0.5]) g.add(box(2, 9, 2, solid("#6E6B78"), s * len, 0, 5), box(2, 9, 2, solid("#6E6B78"), s * len, 0, -5));
      for (const s of [-1, 1]) {
        const tower = solid("#9C98A6");
        g.add(box(3, 34, 3, tower, s * len * 0.3, 0, 5), box(3, 34, 3, tower, s * len * 0.3, 0, -5));
      }
    }
    // Closed: red-and-white barriers at the Queens end until the borough opens.
    const barrier = new Group();
    const stripes = [solid("#E5484D"), solid("#FFFFFF")];
    for (let i = 0; i < 4; i++) barrier.add(box(1.4, 1.6, 3, stripes[i % 2], 0, 10 + (c.ferry ? -8 : 0), -4.5 + i * 3));
    barrier.position.x = len / 2 - 6;
    g.add(barrier);
    scene.add(g);
    bridges.set(c.to, { barrier });
  }

  // ---- The jokes ----
  for (const d of DECOR) {
    const m = d.kind === "rat-statue" ? ratStatue() : d.kind === "condo-lot" ? condoLot() : billboard();
    const [x, z] = gridToWorld(d.at);
    m.position.set(x, 1, z);
    scene.add(m);
  }

  // ---- Fog over the boroughs that haven't opened ----
  const fogMat = new MeshBasicMaterial({ color: "#F4F1FA", transparent: true, opacity: 0.72, depthWrite: false });
  const fogs = new Map<BoroughId, Mesh>();
  for (const [id, r] of Object.entries(ISLANDS) as [BoroughId, GridRect][]) {
    if (id === "queens") continue;
    const w = (r.x1 - r.x0 + 1) * CELL, d = (r.y1 - r.y0 + 1) * CELL;
    const fog = new Mesh(new BoxGeometry(w + 10, id === "manhattan" ? 120 : 50, d + 10), fogMat);
    fog.position.set(r.x0 * CELL + w / 2, (id === "manhattan" ? 120 : 50) / 2 - 2, r.y0 * CELL + d / 2);
    fog.renderOrder = 10;
    scene.add(fog);
    fogs.set(id, fog);
  }

  // ---- Landmarks: every place's own model on its block, built nearest first ----
  const heights = new Map<string, number>();
  const ownKind = new Map(LANDMARKS.filter((l) => l.placeId).map((l) => [l.placeId!, l.kind]));
  const queue = Object.entries(SPOTS).map(([id, spot]) => ({ id, spot, kind: (ownKind.get(id) ?? BORROWED_KIND[id]) as LandmarkKind | "cart" | "store" | undefined }));
  const nightSkip = new Set<Object3D>();
  let screen: { img: Parameters<CompactScene["setBigScreen"]>[0]; handle?: string } = { img: null };
  let night = false;
  const store = (id: string) => storeModel(themed, id);
  const storyOnly = new Set(PLACES.filter((p) => p.story).map((p) => p.id));
  const storyModels = new Map<string, Group>();
  const placeModels: Group[] = [];
  const ray = new Raycaster();
  let shown: ReadonlySet<string> = new Set();
  const buildOne = (q: (typeof queue)[number]) => {
    if (!q.kind) return;
    const model = q.kind === "cart"
      ? cart(q.id === "white-sauce-cart" ? "#2F8F5B" : "#E5484D", q.id === "white-sauce-cart" ? "#F5D90A" : "#3E63DD")
      : q.kind === "store" ? store(q.id) : buildLandmark(q.kind, themed);
    for (const o of themed.nightOnly) nightSkip.add(o);
    const b = measure(model, nightSkip);
    const size = b.getSize(new Vector3());
    // Fit the block: the footprint to 90% of it, never taller than a tall tower on this little map.
    const s = q.kind === "cart" ? 1.4 : Math.min((BLOCK * 0.9) / Math.max(size.x, size.z, 1), 95 / Math.max(size.y, 1), 3);
    model.scale.setScalar(s);
    const [x, z] = gridToWorld(q.spot);
    const center = b.getCenter(new Vector3());
    model.position.set(x - center.x * s, 1, z - center.z * s);
    model.updateMatrixWorld(true);
    if (q.kind !== "cart") mergeStatic(model, new Set([...nightSkip, ...themed.sweep.map((w) => w.o)]), new Set<Material>(themed.glows.map((g) => g.mat)));
    heights.set(q.id, b.max.y * s + 2);
    if (shadows) model.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.userData.placeId = q.id;
    placeModels.push(model);
    if (storyOnly.has(q.id)) { storyModels.set(q.id, model); model.visible = shown.has(q.id); }
    scene.add(model);
    if (q.kind === "clout-tower") paintBigScreen(screen.img, screen.handle);
  };

  const api: CompactScene = {
    canvas: renderer.domElement,
    camera,
    heights,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    render() { renderer.render(scene, camera); },
    tick(seconds) { return animate(themed, seconds, night); },
    setNight(n) {
      night = n;
      applyTheme(themed, n);
      hemi.intensity = n ? 0.8 : 1.6;
      hemi.color.set(n ? "#8EA2D8" : "#FFF6E8");
      sun.intensity = n ? 0.35 : 1.8;
      sun.color.set(n ? "#AFC3FF" : "#FFFFFF");
      waterMat.color.set(n ? WATER_NIGHT : WATER);
      (lampHead.material as MeshStandardMaterial).emissiveIntensity = n ? 1.6 : 0;
      roadMat.color.set(n ? ROAD_NIGHT : ROAD);
      fogMat.color.set(n ? "#3B3550" : "#F4F1FA");
      scene.background = new Color(n ? WATER_NIGHT : WATER);
    },
    setLocked(locked) {
      for (const [id, fog] of fogs) fog.visible = locked.has(id);
      for (const [id, br] of bridges) br.barrier.visible = locked.has(id);
    },
    pick(x, y) {
      ray.setFromCamera(new Vector2(x, y), camera);
      for (const hit of ray.intersectObjects(placeModels.filter((m) => m.visible), true)) {
        for (let o: Object3D | null = hit.object; o; o = o.parent) if (o.userData.placeId) return o.userData.placeId as string;
      }
      return null;
    },
    setShown(ids) {
      shown = ids;
      for (const [id, m] of storyModels) m.visible = ids.has(id);
    },
    setBigScreen(img, handle) {
      screen = { img, handle };
      paintBigScreen(img, handle);
    },
    buildMore(near, budgetMs) {
      if (!queue.length) return false;
      queue.sort((a, b) => {
        const [ax, az] = gridToWorld(a.spot), [bx, bz] = gridToWorld(b.spot);
        return Math.hypot(ax - near[0], az - near[1]) - Math.hypot(bx - near[0], bz - near[1]);
      });
      const until = performance.now() + budgetMs;
      do buildOne(queue.shift()!); while (queue.length && performance.now() < until);
      applyTheme(themed, night);
      return queue.length > 0;
    },
    dispose() {
      renderer.dispose();
      scene.traverse((o) => { (o as Mesh).geometry?.dispose(); });
    },
  };
  api.setNight(false);
  return api;
}
