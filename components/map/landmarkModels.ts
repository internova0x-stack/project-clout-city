// Low-poly landmark models for the city map (lib/map/landmarks.ts). Built in meters: x east,
// y up, z south, the front facing +z. Monument Valley colors by day; at night windows light up,
// signs glow and monuments are uplit. Everything that changes at night registers in a Themed.

import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group,
  IcosahedronGeometry, Vector3,
  type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, PlaneGeometry, RepeatWrapping,
  SphereGeometry, SRGBColorSpace, TorusGeometry,
} from "three";
import type { LandmarkKind } from "@/lib/map/landmarks";

/** What day and night change: glow strengths, night-only pieces, and things that move. */
export interface Themed {
  glows: { mat: MeshStandardMaterial; day: number; night: number }[];
  nightOnly: Object3D[];
  sweep: { o: Object3D; base: number; amp: number; speed: number; phase: number }[];
}

export const newThemed = (): Themed => ({ glows: [], nightOnly: [], sweep: [] });

export function applyTheme(t: Themed, night: boolean) {
  for (const g of t.glows) g.mat.emissiveIntensity = night ? g.night : g.day;
  for (const o of t.nightOnly) o.visible = night;
}

/** Searchlights and the like; returns whether anything moved. */
export function animate(t: Themed, seconds: number, night: boolean): boolean {
  if (!night || !t.sweep.length) return false;
  for (const s of t.sweep) s.o.rotation.z = s.base + Math.sin(seconds * s.speed + s.phase) * s.amp;
  return true;
}

// ---------------------------------------------------------------------------
// Materials and textures
// ---------------------------------------------------------------------------
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solid(color: string, opts: { rough?: number; metal?: number; glow?: string } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, flatShading: true, emissive: opts.glow ?? "#000000", emissiveIntensity: 0 });
}

/** A material that glows at night (and a little, or not at all, by day). */
function glowing(t: Themed, color: string, glow: string, night = 1, day = 0): MeshStandardMaterial {
  const m = solid(color, { glow });
  t.glows.push({ mat: m, day, night });
  m.emissiveIntensity = day;
  return m;
}

const CELL = 4; // meters per window cell (one floor, one bay)
const CELLS = 8; // cells per texture side

type FacadeStyle = "curtain" | "punched" | "storefront" | "industrial";

interface FacadeOpts { wall: string; glass: string; style: FacadeStyle; lit: number; seed: number; frame?: string }

const facadeCache = new Map<string, { map: CanvasTexture; glow: CanvasTexture }>();

/** A window texture (one cell per floor and bay) and its night-lights mask. */
function facadeTextures(o: FacadeOpts) {
  const key = JSON.stringify(o);
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const px = 32;
  const size = px * CELLS;
  const day = document.createElement("canvas");
  const night = document.createElement("canvas");
  day.width = day.height = night.width = night.height = size;
  const d = day.getContext("2d")!;
  const n = night.getContext("2d")!;
  const r = rand(o.seed);
  d.fillStyle = o.wall;
  d.fillRect(0, 0, size, size);
  // Walls glow faintly at night, as if floodlit; windows glow much brighter.
  n.fillStyle = "#2B2118";
  n.fillRect(0, 0, size, size);
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      const x = cx * px, y = cy * px;
      // Window rectangle inside the cell, by style.
      const [wx, wy, ww, wh] =
        o.style === "curtain" ? [x + 1, y + 2, px - 2, px - 5]
        : o.style === "storefront" ? [x + 2, y + 6, px - 4, px - 8]
        : o.style === "industrial" ? [x + 6, y + 4, px - 12, px * 0.42]
        : [x + 8, y + 7, px - 16, px - 13];
      d.fillStyle = o.glass;
      d.fillRect(wx, wy, ww, wh);
      if (o.frame) {
        d.strokeStyle = o.frame;
        d.lineWidth = 2;
        d.strokeRect(wx, wy, ww, wh);
      }
      // A highlight stripe so glass reads as glass by day.
      d.fillStyle = "rgba(255,255,255,.18)";
      d.fillRect(wx, wy, ww * 0.35, wh);
      if (r() < o.lit) {
        n.fillStyle = r() < 0.75 ? "#FFD58A" : "#CFE8FF";
        n.globalAlpha = 0.65 + r() * 0.35;
        n.fillRect(wx, wy, ww, wh);
        n.globalAlpha = 1;
      }
    }
  }
  const wrap = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1 / CELLS, 1 / CELLS);
    t.anisotropy = 4;
    return t;
  };
  const out = { map: wrap(day), glow: wrap(night) };
  facadeCache.set(key, out);
  return out;
}

function facade(t: Themed, o: FacadeOpts, nightStrength = 1.15): MeshStandardMaterial {
  const tex = facadeTextures(o);
  const m = new MeshStandardMaterial({ map: tex.map, emissiveMap: tex.glow, emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.7, flatShading: true });
  t.glows.push({ mat: m, day: 0, night: nightStrength });
  return m;
}

/** A box whose side faces carry the facade at real scale (windows don't stretch), roof plain. */
function facadeBox(w: number, h: number, d: number, side: Material, roof: Material): Mesh {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const fw = f < 2 ? d : w;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * fw) / CELL, (uv.getY(i) * h) / CELL);
    }
  }
  return new Mesh(g, [side, side, roof, roof, side, side]);
}

let washTex: CanvasTexture | null = null;
const HIDDEN = new MeshBasicMaterial({ visible: false });

/**
 * Night glow on a building: a shell just outside its walls, bright at the foot and fading up,
 * like floodlights washing the facade, plus a lit outline along the roof edge.
 */
function nightGlow(t: Themed, w: number, h: number, d: number, color: string, strength = 0.55): Group {
  if (!washTex) {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 128;
    const x = c.getContext("2d")!;
    const grd = x.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,.28)");
    grd.addColorStop(0.92, "rgba(255,255,255,.12)");
    grd.addColorStop(1, "rgba(255,255,255,.6)");
    x.fillStyle = grd;
    x.fillRect(0, 0, 4, 128);
    washTex = new CanvasTexture(c);
  }
  const g = new Group();
  const wash = new MeshBasicMaterial({ map: washTex, color, transparent: true, opacity: strength, blending: AdditiveBlending, depthWrite: false });
  const shell = new Mesh(new BoxGeometry(w + 0.6, h, d + 0.6), [wash, wash, HIDDEN, HIDDEN, wash, wash]);
  shell.renderOrder = 2;
  g.add(shell);
  const edge = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  for (const z of [-d / 2, d / 2]) g.add(at(new Mesh(new BoxGeometry(w + 0.7, 0.35, 0.35), edge), 0, h / 2, z));
  for (const x of [-w / 2, w / 2]) g.add(at(new Mesh(new BoxGeometry(0.35, 0.35, d + 0.7), edge), x, h / 2, 0));
  t.nightOnly.push(g);
  return g;
}

/** A facade box with its night glow, centered like facadeBox. */
function litBox(t: Themed, w: number, h: number, d: number, side: Material, roof: Material, glow: string, strength?: number): Group {
  const g = new Group();
  g.add(facadeBox(w, h, d, side, roof));
  g.add(nightGlow(t, w, h, d, glow, strength));
  return g;
}

/** A sign: text on a board, glowing at night. */
function sign(t: Themed, text: string, w: number, h: number, colors: { bg: string; fg: string }, night = 1.6): Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const x = c.getContext("2d")!;
  x.fillStyle = colors.bg;
  x.fillRect(0, 0, c.width, c.height);
  x.font = `800 ${Math.round(c.height * 0.62)}px system-ui, sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  const fit = Math.min(1, (c.width * 0.9) / x.measureText(text).width);
  x.font = `800 ${Math.round(c.height * 0.62 * fit)}px system-ui, sans-serif`;
  x.fillStyle = colors.fg;
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const glow = document.createElement("canvas");
  glow.width = c.width;
  glow.height = c.height;
  const g = glow.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  g.font = x.font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = colors.fg;
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const map = new CanvasTexture(c);
  const em = new CanvasTexture(glow);
  map.colorSpace = em.colorSpace = SRGBColorSpace;
  const m = new MeshStandardMaterial({ map, emissiveMap: em, emissive: "#FFFFFF", emissiveIntensity: 0.15, roughness: 0.6 });
  t.glows.push({ mat: m, day: 0.15, night });
  // Text on both faces, so it reads from either side.
  return new Mesh(new BoxGeometry(w, h, 0.3), [solid(colors.bg), solid(colors.bg), solid(colors.bg), solid(colors.bg), m, m]);
}

/** A soft pool of light on the ground (night only). */
function lightPool(t: Themed, radius: number, color: string, opacity = 0.35): Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  const m = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    new MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.15;
  m.renderOrder = 2;
  t.nightOnly.push(m);
  return m;
}

function at<T extends Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/** Searchlights sweeping the sky from these spots (night only). */
function searchlights(t: Themed, g: Group, spots: [number, number, number][], length = 90) {
  spots.forEach(([x, y, z], i) => {
    const pivot = at(new Group(), x, y, z);
    const beam = new Mesh(
      new ConeGeometry(length * 0.08, length, 16, 1, true),
      new MeshBasicMaterial({ color: "#E6F4FF", transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    beam.position.y = length / 2;
    beam.rotation.x = Math.PI;
    beam.renderOrder = 3;
    pivot.add(beam);
    pivot.rotation.x = -0.25;
    t.nightOnly.push(pivot);
    t.sweep.push({ o: pivot, base: i % 2 ? -0.35 : 0.35, amp: 0.35, speed: 0.6, phase: i * 1.7 });
    g.add(pivot);
  });
}

/** A beam (box) from a to b, for trusses. */
const tmpV = new Vector3();
function strut(a: [number, number, number], b: [number, number, number], thick: number, m: Material): Mesh {
  const va = new Vector3(...a), vb = new Vector3(...b);
  const mesh = new Mesh(new BoxGeometry(thick, thick, va.distanceTo(vb)), m);
  mesh.position.copy(tmpV.copy(va).add(vb).multiplyScalar(0.5));
  mesh.lookAt(vb);
  return mesh;
}

// Monument Valley palette (docs/05): warm stone, coral, teal, sky. Never purple.
const C = {
  stone: "#E3D6C2", stoneDark: "#C9B79C", steel: "#B9C6CF", steelLight: "#D7E1E7", water: "#7FC8E8",
  coral: "#E8735A", terracotta: "#C46A4E", cream: "#FFF3DE", teal: "#2F8F8A", tealLight: "#5FD4C9",
  sky: "#9ED8F7", ink: "#2A2F3A", charcoal: "#3B3A44", amber: "#FFB347", pink: "#FF6B9A",
};

// ---------------------------------------------------------------------------
// The Unisphere (Flushing Meadows): a steel globe on a tripod in a round fountain pool
// ---------------------------------------------------------------------------
function unisphere(t: Themed): Group {
  const g = new Group();
  const stone = solid(C.stone);
  // The paved plaza around the pool, and a ring of trees at the edge of the lawn.
  g.add(at(new Mesh(new CylinderGeometry(58, 58, 0.2, 48), solid("#EFE6D6")), 0, 0.1, 0));
  const leaves = solid("#5FA36B");
  const trunk = solid("#8B5E3C");
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.06;
    const r = 66 + (i % 3) * 2.5;
    g.add(at(new Mesh(new CylinderGeometry(0.5, 0.6, 3, 5), trunk), Math.cos(a) * r, 1.5, Math.sin(a) * r));
    g.add(at(new Mesh(new ConeGeometry(3.2, 7, 6), leaves), Math.cos(a) * r, 6, Math.sin(a) * r));
  }
  const water = glowing(t, C.water, "#3FB7D9", 0.45, 0);
  water.roughness = 0.25;
  g.add(at(new Mesh(new CylinderGeometry(50, 51.5, 1.2, 48), stone), 0, 0.6, 0));
  g.add(at(new Mesh(new CylinderGeometry(47.5, 47.5, 0.3, 48), water), 0, 1.25, 0));
  g.add(at(new Mesh(new CylinderGeometry(7, 9, 3, 12), solid(C.stoneDark)), 0, 1.5, 0));
  // Fountain jets in two rings.
  const jet = glowing(t, "#F4FBFF", C.sky, 0.9, 0.05);
  jet.transparent = true;
  jet.opacity = 0.8;
  for (const [n, r, h] of [[24, 30, 6], [32, 41, 4]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.add(at(new Mesh(new ConeGeometry(0.55, h, 5), jet), Math.cos(a) * r, 1.3 + h / 2, Math.sin(a) * r));
    }
  }
  // The tripod.
  const steel = glowing(t, C.steel, C.sky, 0.45, 0);
  steel.metalness = 0.25;
  steel.roughness = 0.45;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new Mesh(new CylinderGeometry(0.7, 1.5, 11.5, 6), steel);
    leg.position.set(Math.cos(a) * 3.2, 8.5, Math.sin(a) * 3.2);
    leg.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
    g.add(leg);
  }
  // The globe: meridians, parallels, continents and three orbit rings, tilted on its axis.
  const R = 18.5;
  const globe = at(new Group(), 0, 31, 0);
  globe.rotation.z = 0.41;
  for (let i = 0; i < 12; i++) {
    const m = new Mesh(new TorusGeometry(R, 0.32, 5, 48), steel);
    m.rotation.y = (i / 12) * Math.PI;
    globe.add(m);
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const rad = (lat * Math.PI) / 180;
    const m = new Mesh(new TorusGeometry(R * Math.cos(rad), 0.32, 5, 48), steel);
    m.rotation.x = Math.PI / 2;
    m.position.y = R * Math.sin(rad);
    globe.add(m);
  }
  const land = glowing(t, C.steelLight, C.sky, 0.4, 0);
  land.side = DoubleSide;
  land.metalness = 0.2;
  // [phiStart, phiLength, thetaStart, thetaLength]: the Americas, Eurasia, Africa, Australia.
  for (const [p0, pl, t0, tl] of [[3.55, 1.0, 0.5, 0.75], [3.9, 0.55, 1.45, 0.8], [0.0, 1.9, 0.42, 0.7], [0.05, 0.75, 1.12, 0.85], [2.2, 0.6, 1.9, 0.35]]) {
    globe.add(new Mesh(new SphereGeometry(R + 0.15, 20, 12, p0, pl, t0, tl), land));
  }
  for (const [r, rx, rz] of [[R + 4.5, 1.2, 0.3], [R + 5.5, 0.4, 1.1], [R + 6.5, -0.7, -0.6]]) {
    const ring = new Mesh(new TorusGeometry(r, 0.26, 5, 64), steel);
    ring.rotation.set(rx, 0, rz);
    globe.add(ring);
  }
  g.add(globe);
  g.add(lightPool(t, 40, C.sky, 0.6));
  return g;
}

// ---------------------------------------------------------------------------
// Gantry Plaza (Long Island City): two old rail-ferry gantries on a pier, with the LONG ISLAND sign
// ---------------------------------------------------------------------------
function gantries(t: Themed): Group {
  const g = new Group();
  // Floodlit at night, so the gantries' outline reads against the dark water.
  const steel = glowing(t, C.ink, "#6FB4D6", 0.45, 0);
  const deck = solid("#B59E80");
  g.add(at(new Mesh(new BoxGeometry(62, 1.6, 34), deck), 0, 0.8, 4));
  g.add(at(new Mesh(new BoxGeometry(62, 0.4, 2), solid(C.stoneDark)), 0, 1.8, 20.5));
  for (const gx of [-15, 15]) {
    const one = at(new Group(), gx, 0, 0);
    for (const [px, pz] of [[-5.5, -5], [5.5, -5], [-5.5, 5], [5.5, 5]]) one.add(at(new Mesh(new BoxGeometry(1.3, 22, 1.3), steel), px, 12, pz));
    one.add(at(new Mesh(new BoxGeometry(13.5, 3, 11.5), steel), 0, 23.5, 0));
    // Cross bracing on the sides.
    for (const sx of [-5.5, 5.5]) {
      for (const [y, s] of [[8, 1], [16, -1]]) {
        const b = new Mesh(new BoxGeometry(0.5, 12, 0.5), steel);
        b.position.set(sx, y, 0);
        b.rotation.x = s * 0.72;
        one.add(b);
      }
    }
    // The apron ramp down toward the water.
    const ramp = new Mesh(new BoxGeometry(9, 1, 26), steel);
    ramp.position.set(0, 7, 15);
    ramp.rotation.x = 0.4;
    one.add(ramp);
    one.add(at(nightGlow(t, 13.5, 25, 11.5, "#9ED8F7", 0.4), 0, 12.5, 0));
    g.add(one);
  }
  g.add(at(lightPool(t, 36, C.amber, 0.35), 0, 1.7, 4));
  const board = sign(t, "LONG ISLAND", 30, 4.5, { bg: C.ink, fg: "#FF4D5E" }, 2);
  g.add(at(board, 15, 28, 0));
  // Lamp posts along the pier.
  const bulb = glowing(t, C.cream, C.amber, 2, 0);
  for (let i = 0; i < 6; i++) {
    const x = -27 + i * 10.8;
    g.add(at(new Mesh(new CylinderGeometry(0.2, 0.25, 6, 5), steel), x, 4.6, 19));
    g.add(at(new Mesh(new SphereGeometry(0.7, 8, 6), bulb), x, 7.8, 19));
    g.add(at(lightPool(t, 6, C.amber, 0.35), x, 1.75, 19));
  }
  return g;
}

// ---------------------------------------------------------------------------
// Skybridge Tower (Long Island City): two glass towers joined by a sky bridge, on a podium
// ---------------------------------------------------------------------------
function twinTowers(t: Themed): Group {
  const g = new Group();
  const roof = solid("#8FA4B8");
  const glassA = facade(t, { wall: "#3F7F86", glass: "#9ED8F7", style: "curtain", lit: 0.8, seed: 11, frame: "#2E5F66" });
  const glassB = facade(t, { wall: "#4C8C93", glass: "#BFE6F7", style: "curtain", lit: 0.75, seed: 23, frame: "#356B72" });
  const podium = facade(t, { wall: C.cream, glass: "#F2C7A0", style: "storefront", lit: 0.9, seed: 5, frame: C.stoneDark });
  g.add(at(litBox(t, 48, 12, 32, podium, solid(C.stoneDark), C.amber, 0.7), 0, 6, 0));
  g.add(at(litBox(t, 18, 120, 18, glassA, roof, C.sky, 0.45), -12, 12 + 60, -2));
  g.add(at(litBox(t, 16, 92, 16, glassB, roof, C.sky, 0.45), 12, 12 + 46, -1));
  // Crowns.
  const crownGlow = glowing(t, C.steelLight, C.sky, 1.4, 0);
  g.add(at(new Mesh(new BoxGeometry(14, 8, 14), crownGlow), -12, 136, -2));
  g.add(at(new Mesh(new CylinderGeometry(0.5, 0.7, 20, 6), solid(C.steel)), -12, 150, -2));
  g.add(at(new Mesh(new SphereGeometry(1, 8, 6), glowing(t, "#E5283F", "#FF2D3D", 3, 0.6)), -12, 160.5, -2));
  const cap = new Mesh(new ConeGeometry(11.6, 12, 4), crownGlow);
  cap.rotation.y = Math.PI / 4;
  g.add(at(cap, 12, 110, -1));
  // The sky bridge.
  g.add(at(new Mesh(new BoxGeometry(10, 6, 10), glowing(t, C.sky, C.amber, 1.3, 0)), 0, 76, -1.5));
  g.add(at(new Mesh(new BoxGeometry(10.5, 0.8, 10.5), solid(C.steel)), 0, 72.6, -1.5));
  g.add(lightPool(t, 48, C.amber, 0.5));
  return g;
}

// ---------------------------------------------------------------------------
// Velvet Static (club, Long Island City): a sawtooth-roof warehouse with a neon sign and searchlights
// ---------------------------------------------------------------------------
function club(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: C.charcoal, glass: "#5A6170", style: "industrial", lit: 0.55, seed: 7 }, 1.3);
  const roof = solid("#55545E");
  g.add(at(litBox(t, 32, 10, 20, brick, roof, C.pink, 0.6), 0, 5, 0));
  // Sawtooth roof.
  for (let i = 0; i < 4; i++) {
    const tooth = new Mesh(new CylinderGeometry(3.4, 3.4, 20, 3, 1, false), roof);
    tooth.rotation.x = Math.PI / 2;
    tooth.rotation.z = Math.PI / 2;
    tooth.position.set(-12 + i * 8, 11.3, 0);
    g.add(tooth);
  }
  g.add(at(sign(t, "VELVET STATIC", 22, 3.6, { bg: "#1B1A22", fg: C.pink }, 2.4), 0, 7.6, 10.2));
  // Neon strips along the roofline.
  const neon = glowing(t, C.tealLight, C.tealLight, 2.2, 0.25);
  for (const z of [-10, 10]) g.add(at(new Mesh(new BoxGeometry(32.4, 0.35, 0.35), neon), 0, 10.1, z));
  for (const x of [-16, 16]) g.add(at(new Mesh(new BoxGeometry(0.35, 0.35, 20.4), neon), x, 10.1, 0));
  // Entrance canopy and door.
  g.add(at(new Mesh(new BoxGeometry(9, 0.6, 3.5), solid(C.ink)), 0, 4.2, 11.6));
  g.add(at(new Mesh(new BoxGeometry(3.4, 3.8, 0.3), glowing(t, "#1B1A22", C.pink, 1.4, 0)), 0, 1.9, 10.1));
  g.add(at(lightPool(t, 14, C.pink, 0.7), 0, 0, 14));
  g.add(lightPool(t, 30, C.tealLight, 0.25));
  searchlights(t, g, [[-10, 12, 2], [10, 12, 2]]);
  return g;
}

// ---------------------------------------------------------------------------
// Grind & Gossip Café (Astoria): a brick rowhouse with a striped awning and a rooftop water tower
// ---------------------------------------------------------------------------
function cafe(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: C.terracotta, glass: "#4E6B7A", style: "punched", lit: 0.85, seed: 3, frame: C.cream });
  const store = facade(t, { wall: C.cream, glass: "#F6D7A8", style: "storefront", lit: 1, seed: 9, frame: "#6B4A3A" }, 1.5);
  const roof = solid("#9A5A46");
  g.add(at(facadeBox(12, 4.5, 14, store, roof), 0, 2.25, 0));
  g.add(at(facadeBox(12, 8.5, 14, brick, roof), 0, 4.5 + 4.25, 0));
  g.add(at(nightGlow(t, 12, 13, 14, C.amber, 0.7), 0, 6.5, 0));
  g.add(at(new Mesh(new BoxGeometry(12.8, 0.8, 14.8), solid(C.cream)), 0, 13.2, 0));
  // Striped awning.
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? C.cream : C.coral;
    x.fillRect(i * 16, 0, 16, 16);
  }
  const stripes = new CanvasTexture(c);
  stripes.colorSpace = SRGBColorSpace;
  const awning = new Mesh(new PlaneGeometry(11.5, 3), new MeshStandardMaterial({ map: stripes, side: DoubleSide, roughness: 0.9 }));
  awning.position.set(0, 4.6, 8.1);
  awning.rotation.x = -0.9;
  g.add(awning);
  g.add(at(sign(t, "GRIND & GOSSIP", 9, 1.6, { bg: C.cream, fg: "#6B4A3A" }, 1.4), 0, 6.6, 7.2));
  // Water tower.
  const wood = solid("#8B5E3C");
  const tower = at(new Group(), 3, 13.6, -3);
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) tower.add(at(new Mesh(new BoxGeometry(0.3, 3, 0.3), solid(C.ink)), lx, 1.5, lz));
  tower.add(at(new Mesh(new CylinderGeometry(2.1, 2.1, 3.6, 10), wood), 0, 4.8, 0));
  tower.add(at(new Mesh(new ConeGeometry(2.4, 1.6, 10), solid(C.ink)), 0, 7.4, 0));
  g.add(tower);
  g.add(at(lightPool(t, 12, C.amber, 0.7), 0, 0, 9));
  g.add(lightPool(t, 16, C.amber, 0.3));
  return g;
}

// ---------------------------------------------------------------------------
// Flushing Field (ballpark): brick-walled stands around a diamond, light towers, a rotunda
// ---------------------------------------------------------------------------
function ballpark(t: Themed): Group {
  const g = new Group();
  const deg = Math.PI / 180;
  // Grass, the infield diamond and its inner grass (home plate toward +z).
  const grass = glowing(t, "#5FA36B", "#9FE3A0", 0.35, 0);
  const field = new Mesh(new CircleGeometry(100, 48), grass);
  field.rotation.x = -Math.PI / 2;
  g.add(at(field, 0, 0.3, 0));
  for (const [size, color, y] of [[30, "#C98E5C", 0.4], [22, "#6DB277", 0.5]] as const) {
    const sq = new Mesh(new BoxGeometry(size, 0.1, size), solid(color));
    sq.rotation.y = Math.PI / 4;
    g.add(at(sq, 0, y, 72 - size / Math.SQRT2));
  }
  // Stands behind home plate and down the lines, bleachers in the outfield.
  const seats = solid("#3E7C8C");
  seats.side = DoubleSide;
  const stands = new Mesh(new CylinderGeometry(135, 100, 32, 48, 1, true, -125 * deg, 250 * deg), seats);
  g.add(at(stands, 0, 16, 0));
  const bleachers = new Mesh(new CylinderGeometry(122, 104, 9, 24, 1, true, 125 * deg, 110 * deg), seats);
  g.add(at(bleachers, 0, 4.5, 0));
  g.add(at(new Mesh(new CylinderGeometry(101, 101, 3, 24, 1, true, 125 * deg, 110 * deg), solid("#2E4A3A")), 0, 1.5, 0));
  const brick = solid(C.terracotta);
  brick.side = DoubleSide;
  g.add(at(new Mesh(new CylinderGeometry(138, 138, 34, 48, 1, true, -125 * deg, 250 * deg), brick), 0, 17, 0));
  // Rotunda entrance behind home plate, and its sign.
  g.add(at(litBox(t, 34, 24, 26, facade(t, { wall: C.terracotta, glass: "#4E6B7A", style: "punched", lit: 0.8, seed: 31, frame: C.cream }), solid("#9A5A46"), C.amber, 0.6), 0, 12, 150));
  g.add(at(sign(t, "FLUSHING FIELD", 30, 4, { bg: C.cream, fg: "#2F5DA8" }, 1.8), 0, 27, 163.2));
  // Scoreboard.
  g.add(at(new Mesh(new BoxGeometry(44, 16, 3), solid(C.ink)), 0, 22, -128));
  g.add(at(new Mesh(new BoxGeometry(40, 12, 0.4), glowing(t, "#2A3440", "#9ED8F7", 1.6, 0.5)), 0, 22, -126.2));
  // Light towers: bright banks over the field at night.
  const pole = solid(C.steel);
  const lamps = glowing(t, C.cream, "#FFFFFF", 3, 0);
  for (const a of [-110, -60, -20, 20, 60, 110]) {
    const x = Math.sin(a * deg) * 142, z = Math.cos(a * deg) * 142;
    g.add(at(new Mesh(new CylinderGeometry(0.8, 1.2, 58, 6), pole), x, 29, z));
    const bank = at(new Mesh(new BoxGeometry(12, 6, 1), lamps), x, 60, z);
    bank.lookAt(0, 0, 0);
    g.add(bank);
  }
  g.add(at(lightPool(t, 115, "#FFFFFF", 0.4), 0, 0.2, 0));
  return g;
}

// ---------------------------------------------------------------------------
// Flushing Open Tennis Center: the big round stadium with its roof ring, a second stadium, courts
// ---------------------------------------------------------------------------
function stadiumBowl(t: Themed, r: number, h: number): Group {
  const g = new Group();
  const wall = glowing(t, "#3D6F8E", C.sky, 0.35, 0);
  wall.side = DoubleSide;
  g.add(at(new Mesh(new CylinderGeometry(r, r, h, 40, 1, true), wall), 0, h / 2, 0));
  const seats = solid("#4F8FB0");
  seats.side = DoubleSide;
  g.add(at(new Mesh(new CylinderGeometry(r - 3, r * 0.4, h - 4, 40, 1, true), seats), 0, (h - 4) / 2 + 1, 0));
  g.add(at(new Mesh(new BoxGeometry(r * 0.55, 0.2, r * 0.75), solid("#3F8F5E")), 0, 0.5, 0));
  g.add(at(new Mesh(new BoxGeometry(r * 0.3, 0.3, r * 0.5), glowing(t, "#3A6FB0", "#5F9BEA", 1.2, 0)), 0, 0.6, 0));
  const ring = new Mesh(new TorusGeometry(r, 1.6, 6, 48), glowing(t, "#EEF2F5", C.sky, 1.5, 0));
  ring.rotation.x = Math.PI / 2;
  g.add(at(ring, 0, h + 1, 0));
  const roof = solid("#EEF2F5");
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const panel = new Mesh(new BoxGeometry(r * 0.32, 1, r * 0.5), roof);
    panel.position.set(Math.cos(a) * r * 0.78, h + 1.5, Math.sin(a) * r * 0.78);
    panel.rotation.y = -a + Math.PI / 2;
    g.add(panel);
  }
  return g;
}

function tennis(t: Themed): Group {
  const g = new Group();
  g.add(stadiumBowl(t, 76, 38));
  g.add(at(stadiumBowl(t, 44, 22), 118, 0, 40));
  for (let i = 0; i < 6; i++) {
    const x = -110 - (i % 2) * 26, z = -45 + Math.floor(i / 2) * 45;
    g.add(at(new Mesh(new BoxGeometry(20, 0.2, 38), solid("#3F8F5E")), x, 0.3, z));
    g.add(at(new Mesh(new BoxGeometry(11, 0.25, 24), glowing(t, "#3A6FB0", "#5F9BEA", 0.9, 0)), x, 0.4, z));
  }
  g.add(at(sign(t, "FLUSHING OPEN", 34, 5, { bg: "#EEF2F5", fg: "#2F5DA8" }, 1.6), 0, 34, 77));
  g.add(lightPool(t, 95, C.sky, 0.4));
  return g;
}

// ---------------------------------------------------------------------------
// Queensboro Bridge: the cantilever trusses either side of the roadway (the map draws the road
// and the traffic), towers with spires at the piers, a necklace of lights at night
// ---------------------------------------------------------------------------
function bridge(t: Themed): Group {
  const g = new Group();
  // Night (owner, Oct 16: "a yellow glow at night"): the trusses' outline lit warm yellow, a string
  // of bulbs along the top, floodlit towers and the glow reflected on the water.
  const YELLOW = "#FFD54A";
  // By day (owner: "more legible, the outline is too thin"): deep slate steel and heavy chords that
  // read against the pale map.
  const steel = glowing(t, "#3F5A73", YELLOW, 0.5, 0);
  const outline = glowing(t, "#2F4A63", YELLOW, 2.6, 0);
  const pts: [number, number][] = [[-568, 18], [-424, 88], [-244, 38], [-64, 88], [32, 52], [128, 88], [278, 38], [428, 88], [568, 18]];
  const topAt = (x: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return pts[pts.length - 1][1];
  };
  const bulb = glowing(t, "#FFF3DE", "#FFE27A", 3.2, 0);
  const bulbGeo = new SphereGeometry(2, 6, 4);
  for (const z of [-19, 19]) {
    for (let i = 1; i < pts.length; i++) g.add(strut([pts[i - 1][0], pts[i - 1][1], z], [pts[i][0], pts[i][1], z], 5.5, outline));
    g.add(strut([-568, 3, z], [568, 3, z], 5.5, outline));
    let prev: [number, number, number] | null = null;
    for (let x = -560; x <= 560; x += 35) {
      const top = topAt(x);
      g.add(strut([x, 3, z], [x, top, z], 2.8, steel));
      if (prev) g.add(strut(prev, [x, top, z], 2.2, steel));
      prev = [x, 3, z];
    }
    for (let x = -560; x <= 560; x += 24) g.add(at(new Mesh(bulbGeo, bulb), x, topAt(x) + 2.2, z));
  }
  // Towers and spires at the four piers, cross-braced over the road, floodlit at night.
  const stone = solid(C.stoneDark);
  for (const [x] of pts.filter(([, y]) => y === 88)) {
    g.add(at(new Mesh(new BoxGeometry(16, 4, 52), stone), x, 2, 0));
    for (const z of [-19, 19]) {
      g.add(at(new Mesh(new BoxGeometry(9, 98, 9), steel), x, 49, z));
      g.add(at(nightGlow(t, 9, 98, 9, YELLOW, 0.6), x, 49, z));
      g.add(at(new Mesh(new ConeGeometry(5, 16, 4), outline), x, 106, z));
      g.add(at(new Mesh(new SphereGeometry(1.6, 6, 4), glowing(t, "#E5283F", "#FF2D3D", 3, 0.4)), x, 113, z));
    }
    g.add(at(new Mesh(new BoxGeometry(6, 6, 40), outline), x, 92, 0));
    g.add(strut([x, 60, -19], [x, 92, 19], 3, steel));
    g.add(strut([x, 60, 19], [x, 92, -19], 3, steel));
  }
  // The yellow glow on the water, the length of the bridge.
  const reflect = lightPool(t, 1, YELLOW, 0.45);
  reflect.scale.set(600, 70, 1);
  g.add(reflect);
  return g;
}

// ---------------------------------------------------------------------------
// Astoria Sound Stages: barrel-roofed sound stages behind a brick office, a marquee gate
// ---------------------------------------------------------------------------
function studios(t: Themed): Group {
  const g = new Group();
  const stageWall = facade(t, { wall: "#E9DCC6", glass: "#C9B79C", style: "industrial", lit: 0.2, seed: 41 }, 0.8);
  const roofM = solid("#C9B79C");
  for (const x of [-44, 0, 44]) {
    g.add(at(litBox(t, 36, 24, 56, stageWall, roofM, C.amber, 0.4), x, 12, -24));
    const barrel = new Mesh(new CylinderGeometry(18, 18, 56, 16, 1, false, 0, Math.PI), roofM);
    barrel.rotation.x = Math.PI / 2;
    barrel.rotation.y = Math.PI / 2;
    g.add(at(barrel, x, 24, -24));
    g.add(at(new Mesh(new BoxGeometry(12, 14, 0.4), solid("#8FA4B8")), x, 7, 4.2));
  }
  const office = facade(t, { wall: C.terracotta, glass: "#4E6B7A", style: "punched", lit: 0.8, seed: 43, frame: C.cream });
  g.add(at(litBox(t, 128, 14, 18, office, solid("#9A5A46"), C.amber, 0.55), 0, 7, 18));
  g.add(at(sign(t, "ASTORIA SOUND STAGES", 60, 6, { bg: C.ink, fg: C.amber }, 2.2), 0, 18, 18));
  // The gate: two posts, a lintel and a marquee.
  for (const x of [-9, 9]) g.add(at(new Mesh(new BoxGeometry(2, 9, 2), solid(C.cream)), x, 4.5, 34));
  g.add(at(sign(t, "NOW SHOOTING", 20, 3, { bg: C.cream, fg: C.coral }, 1.8), 0, 10, 34));
  searchlights(t, g, [[-60, 15, 18], [60, 15, 18]], 110);
  g.add(at(lightPool(t, 40, C.amber, 0.4), 0, 0, 30));
  return g;
}

// ---------------------------------------------------------------------------
// Old School Gallery: a red-brick schoolhouse with a cupola, a walled courtyard and an art dome
// ---------------------------------------------------------------------------
function gallery(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: "#B5523B", glass: "#4E6B7A", style: "punched", lit: 0.75, seed: 51, frame: C.cream });
  const roof = solid("#7A3A2C");
  g.add(at(litBox(t, 48, 16, 16, brick, roof, C.amber, 0.5), 0, 8, -10));
  for (const x of [-20, 20]) g.add(at(litBox(t, 12, 16, 22, brick, roof, C.amber, 0.5), x, 8, 9));
  g.add(at(new Mesh(new BoxGeometry(6, 5, 6), solid(C.cream)), 0, 18.5, -10));
  const cap = new Mesh(new ConeGeometry(4.6, 5, 4), roof);
  cap.rotation.y = Math.PI / 4;
  g.add(at(cap, 0, 23.5, -10));
  g.add(at(sign(t, "OLD SCHOOL GALLERY", 22, 2.6, { bg: C.cream, fg: "#B5523B" }, 1.6), 0, 12.5, -1.8));
  // Courtyard walls.
  const concrete = solid("#BDB6AA");
  g.add(at(new Mesh(new BoxGeometry(52, 4, 1), concrete), 0, 2, 44));
  for (const x of [-26, 26]) g.add(at(new Mesh(new BoxGeometry(1, 4, 24), concrete), x, 2, 32));
  // The art dome: faceted, in the palette, glowing from inside at night.
  const dome = new IcosahedronGeometry(8, 1);
  const palette = [C.coral, C.tealLight, C.cream, C.sky, C.amber].map((c) => new Color(c));
  const colors: number[] = [];
  for (let f = 0; f < dome.attributes.position.count / 3; f++) {
    const c = palette[f % palette.length];
    for (let v = 0; v < 3; v++) colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const domeMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: "#FFD58A", emissiveIntensity: 0 });
  t.glows.push({ mat: domeMat, day: 0, night: 0.5 });
  g.add(at(new Mesh(dome, domeMat), 0, 2, 30));
  g.add(at(lightPool(t, 22, C.amber, 0.5), 0, 0, 30));
  return g;
}

const BUILDERS: Record<LandmarkKind, (t: Themed) => Group> = {
  unisphere, gantries, "twin-towers": twinTowers, club, cafe, ballpark, tennis, bridge, studios, gallery,
};

export function buildLandmark(kind: LandmarkKind, t: Themed): Group {
  const g = BUILDERS[kind](t);
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) m.frustumCulled = false;
  });
  return g;
}
