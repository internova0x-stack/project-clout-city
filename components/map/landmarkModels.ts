// Low-poly landmark models for the city map (lib/map/landmarks.ts). Built in meters: x east,
// y up, z south, the front facing +z. Monument Valley colors by day; at night windows light up,
// signs glow and monuments are uplit. Everything that changes at night registers in a Themed.

import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CapsuleGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group,
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

/** Whether an object and all its parents are shown (a landmark off screen is hidden). */
function shown(o: Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Searchlights and the like, only those on screen; returns whether anything moved. */
export function animate(t: Themed, seconds: number, night: boolean): boolean {
  if (!night || !t.sweep.length) return false;
  let moved = false;
  for (const s of t.sweep) {
    if (!shown(s.o.parent)) continue;
    s.o.rotation.z = s.base + Math.sin(seconds * s.speed + s.phase) * s.amp;
    moved = true;
  }
  return moved;
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

/** A zigzag fire escape on a facade (the front at z), floors from y0 every 3.6 m. */
function fireEscape(g: Group, x: number, z: number, y0: number, floors: number, m: Material) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * 3.6;
    g.add(at(new Mesh(new BoxGeometry(5, 0.25, 1.4), m), x, y, z + 0.7));
    g.add(at(new Mesh(new BoxGeometry(5, 1, 0.1), m), x, y + 0.5, z + 1.4));
    if (f < floors - 1) g.add(strut([x + (f % 2 ? 2 : -2), y, z + 0.9], [x + (f % 2 ? -2 : 2), y + 3.6, z + 0.9], 0.2, m));
  }
}

/** A sign that hangs off a facade (blade sign), text on both faces. */
function blade(t: Themed, text: string, h: number, colors: { bg: string; fg: string }, night = 2.4): Mesh {
  const m = sign(t, text, h, h / 4.2, colors, night);
  m.rotation.z = Math.PI / 2;
  m.rotation.y = Math.PI / 2;
  return m;
}

// ---------------------------------------------------------------------------
// Hellgate Hall (club): an old brick music hall with arched windows, a marquee and a blade sign
// ---------------------------------------------------------------------------
function musicHall(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: "#8E3B2E", glass: "#3A2E3A", style: "punched", lit: 0.6, seed: 61, frame: C.stoneDark }, 1.2);
  g.add(at(litBox(t, 26, 16, 30, brick, solid("#5E2A22"), C.coral, 0.55), 0, 8, 0));
  // Arched windows on the front: cream arches over tall glass.
  const arch = glowing(t, "#3A2E3A", "#FF8A4C", 1.6, 0);
  for (const x of [-8, 0, 8]) {
    g.add(at(new Mesh(new BoxGeometry(4.5, 6, 0.3), arch), x, 10, 15.05));
    const top = new Mesh(new CylinderGeometry(2.25, 2.25, 0.3, 12, 1, false, 0, Math.PI), arch);
    top.rotation.x = Math.PI / 2;
    top.rotation.z = Math.PI / 2;
    g.add(at(top, x, 13, 15.05));
  }
  g.add(at(new Mesh(new BoxGeometry(27, 1.2, 31), solid(C.cream)), 0, 16.4, 0));
  // Marquee over the doors, with a run of bulbs.
  g.add(at(new Mesh(new BoxGeometry(16, 2.2, 4), solid(C.ink)), 0, 5, 17));
  g.add(at(sign(t, "TONIGHT: LOUD", 15, 1.6, { bg: C.cream, fg: "#C8352B" }, 1.8), 0, 5, 19.05));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.6, 0.1);
  const bulbGeo = new SphereGeometry(0.28, 6, 4);
  for (let i = 0; i < 18; i++) g.add(at(new Mesh(bulbGeo, bulb), -7.65 + i * 0.9, 3.75, 19.05));
  g.add(at(blade(t, "HELLGATE", 13, { bg: C.ink, fg: "#FF5A3C" }), 12, 10, 16.5));
  searchlights(t, g, [[-9, 16.5, -6], [9, 16.5, -6]], 80);
  g.add(at(lightPool(t, 13, "#FF8A4C", 0.6), 0, 0, 20));
  return g;
}

// ---------------------------------------------------------------------------
// Low Light Lounge: a dark, low building with an amber glass box on the roof and string lights
// ---------------------------------------------------------------------------
function lounge(t: Themed): Group {
  const g = new Group();
  const dark = facade(t, { wall: "#2A2F3A", glass: "#A8763E", style: "storefront", lit: 0.95, seed: 71, frame: "#1B1A22" }, 1.1);
  g.add(at(litBox(t, 22, 8, 18, dark, solid("#3B3A44"), C.amber, 0.45), 0, 4, 0));
  // The rooftop glass room, warm inside.
  g.add(at(new Mesh(new BoxGeometry(12, 4, 9), glowing(t, "#C9B79C", C.amber, 1.4, 0.15)), -3, 10, -2));
  g.add(at(new Mesh(new BoxGeometry(13, 0.5, 10), solid(C.ink)), -3, 12.25, -2));
  // Terrace planters and string lights.
  const leaves = solid("#5FA36B");
  for (const x of [4, 7, 10]) g.add(at(new Mesh(new SphereGeometry(1.1, 6, 4), leaves), x, 9, 7));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.4, 0);
  const bulbGeo = new SphereGeometry(0.22, 5, 4);
  for (let i = 0; i <= 14; i++) {
    const x = 3 + i * 0.55;
    g.add(at(new Mesh(bulbGeo, bulb), x, 10.6 - Math.sin((i / 14) * Math.PI) * 0.8, 7.5));
    g.add(at(new Mesh(bulbGeo, bulb), x, 10.6 - Math.sin((i / 14) * Math.PI) * 0.8, -1));
  }
  g.add(at(sign(t, "LOW LIGHT", 10, 1.6, { bg: "#1B1A22", fg: C.amber }, 2.2), 0, 6.6, 9.1));
  g.add(at(lightPool(t, 10, C.amber, 0.6), 0, 0, 11));
  return g;
}

// ---------------------------------------------------------------------------
// Ditmars Deli & Dreams: a corner bodega under a walk-up, green awning, fruit stand, fire escape
// ---------------------------------------------------------------------------
interface BodegaLook { name: string; awning: string; wall: string; seed: number }

function bodega(t: Themed, look: BodegaLook = { name: "DELI & DREAMS", awning: "#2E7D4F", wall: "#B9765A", seed: 81 }): Group {
  const g = new Group();
  const store = facade(t, { wall: C.cream, glass: "#F6D7A8", style: "storefront", lit: 1, seed: look.seed, frame: C.ink }, 1.6);
  const brick = facade(t, { wall: look.wall, glass: "#4E6B7A", style: "punched", lit: 0.7, seed: look.seed + 2, frame: C.cream });
  g.add(at(facadeBox(12, 4.2, 12, store, solid("#7A5A46")), 0, 2.1, 0));
  g.add(at(facadeBox(12, 11, 12, brick, solid("#7A5A46")), 0, 4.2 + 5.5, 0));
  g.add(at(nightGlow(t, 12, 15.2, 12, C.amber, 0.6), 0, 7.6, 0));
  g.add(at(new Mesh(new BoxGeometry(12.6, 0.7, 12.6), solid(C.cream)), 0, 15.5, 0));
  // Green awning on two sides (it's a corner store), with the name.
  const awning = solid(look.awning);
  for (const [w, x, z, ry] of [[12.4, 0, 7, 0], [12.4, 7, 0, Math.PI / 2]] as const) {
    const a = new Mesh(new BoxGeometry(w, 0.3, 2.4), awning);
    a.position.set(x, 4.3, z);
    a.rotation.y = ry;
    a.rotation.x = ry ? 0 : 0.35;
    if (ry) a.rotation.z = -0.35;
    g.add(a);
  }
  g.add(at(sign(t, look.name, 10, 1.2, { bg: look.awning, fg: look.awning === "#F2B705" ? C.ink : C.cream }, 1.6), 0, 4.9, 8.2));
  // Fruit and flowers out front.
  for (const [x, c] of [[-4, C.coral], [-2.4, C.amber], [-0.8, "#5FA36B"], [0.8, C.pink]] as const) {
    g.add(at(new Mesh(new BoxGeometry(1.4, 0.9, 1.2), solid("#8B5E3C")), x, 0.45, 7.4));
    g.add(at(new Mesh(new BoxGeometry(1.2, 0.3, 1), solid(c)), x, 1.05, 7.4));
  }
  fireEscape(g, -3, 6, 5.5, 3, solid(C.ink));
  g.add(at(lightPool(t, 8, C.amber, 0.65), 0, 0, 8));
  return g;
}

// ---------------------------------------------------------------------------
// Two Bros Who Fight Pizza: a narrow walk-up with a giant slice on the roof and a neon PIZZA sign
// ---------------------------------------------------------------------------
function pizzeria(t: Themed): Group {
  const g = new Group();
  const store = facade(t, { wall: C.cream, glass: "#F6C98E", style: "storefront", lit: 1, seed: 91, frame: "#B33A3A" }, 1.5);
  const brick = facade(t, { wall: "#C46A4E", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 93, frame: C.cream });
  g.add(at(facadeBox(9, 4.2, 13, store, solid("#7A3A2C")), 0, 2.1, 0));
  g.add(at(facadeBox(9, 7.6, 13, brick, solid("#7A3A2C")), 0, 4.2 + 3.8, 0));
  g.add(at(nightGlow(t, 9, 11.8, 13, C.amber, 0.6), 0, 5.9, 0));
  // Red-and-white striped awning.
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? "#FFF3DE" : "#C8352B";
    x.fillRect(i * 16, 0, 16, 16);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const awning = new Mesh(new PlaneGeometry(8.6, 2.4), new MeshStandardMaterial({ map: tex, side: DoubleSide, roughness: 0.9 }));
  awning.position.set(0, 4.4, 7.4);
  awning.rotation.x = -0.9;
  g.add(awning);
  g.add(at(sign(t, "PIZZA", 5, 1.3, { bg: "#1B1A22", fg: "#FF5A3C" }, 2.6), 0, 5.6, 6.7));
  // The giant slice on the roof: crust, cheese, pepperoni.
  const slice = new Group();
  const cheese = new Mesh(new CylinderGeometry(0.01, 3.6, 0.6, 3), glowing(t, "#F2C14E", "#FFB347", 0.9, 0));
  cheese.scale.set(1, 1, 1.9);
  slice.add(cheese);
  slice.add(at(new Mesh(new BoxGeometry(6.4, 0.9, 0.9), solid("#C98E5C")), 0, 0, 3.4));
  for (const [px, pz] of [[0, 0.5], [-1.2, 1.9], [1.2, 1.9], [0, -1.2]]) {
    const pep = new Mesh(new CylinderGeometry(0.55, 0.55, 0.2, 8), solid("#B33A3A"));
    slice.add(at(pep, px, 0.35, pz));
  }
  slice.rotation.x = -1.15;
  slice.position.set(0, 15.6, 2);
  g.add(slice);
  for (const sx of [-1.6, 1.6]) g.add(at(new Mesh(new BoxGeometry(0.3, 4, 0.3), solid(C.ink)), sx, 13.6, 1));
  fireEscape(g, 2, 6.5, 5.5, 2, solid(C.ink));
  g.add(at(lightPool(t, 8, "#FF8A4C", 0.6), 0, 0, 8));
  return g;
}

// ---------------------------------------------------------------------------
// Astoria Community College: halls around a lawn, a clock tower, trees and a flagpole
// ---------------------------------------------------------------------------
function college(t: Themed): Group {
  const g = new Group();
  const hall = facade(t, { wall: "#D9C7A7", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 101, frame: C.cream });
  const modern = facade(t, { wall: "#3F7F86", glass: "#BFE6F7", style: "curtain", lit: 0.75, seed: 103, frame: "#2E5F66" });
  const roof = solid("#8FA4B8");
  g.add(at(new Mesh(new BoxGeometry(70, 0.2, 60), solid("#6DB277")), 0, 0.1, 0));
  g.add(at(litBox(t, 60, 18, 16, hall, roof, C.amber, 0.45), 0, 9, -30));
  g.add(at(litBox(t, 16, 14, 40, hall, roof, C.amber, 0.45), -34, 7, 2));
  g.add(at(litBox(t, 18, 22, 30, modern, roof, C.sky, 0.45), 34, 11, 6));
  // Clock tower over the main hall.
  g.add(at(new Mesh(new BoxGeometry(8, 16, 8), solid("#D9C7A7")), 0, 26, -30));
  const face = glowing(t, C.cream, "#FFF3DE", 1.8, 0.1);
  for (const [x, z, ry] of [[0, -25.9, 0], [0, -34.1, Math.PI], [4.1, -30, Math.PI / 2], [-4.1, -30, -Math.PI / 2]] as const) {
    const c = new Mesh(new CylinderGeometry(2.4, 2.4, 0.2, 16), face);
    c.rotation.x = Math.PI / 2;
    c.rotation.z = ry;
    g.add(at(c, x, 29, z));
  }
  const spire = new Mesh(new ConeGeometry(6.2, 8, 4), solid("#5E7B8C"));
  spire.rotation.y = Math.PI / 4;
  g.add(at(spire, 0, 38, -30));
  // Lawn paths, trees and a flagpole.
  g.add(at(new Mesh(new BoxGeometry(4, 0.25, 40), solid("#E9DCC6")), 0, 0.2, 2));
  const leaves = solid("#4E8F5A");
  for (const [x, z] of [[-14, -10], [14, -10], [-14, 12], [14, 12], [-20, 26], [20, 26]]) {
    g.add(at(new Mesh(new CylinderGeometry(0.5, 0.6, 3, 5), solid("#8B5E3C")), x, 1.5, z));
    g.add(at(new Mesh(new SphereGeometry(3.4, 7, 5), leaves), x, 5.4, z));
  }
  g.add(at(new Mesh(new CylinderGeometry(0.2, 0.25, 16, 5), solid(C.steel)), 8, 8, 24));
  g.add(at(new Mesh(new BoxGeometry(3.4, 2, 0.1), solid("#2F8F8A")), 9.8, 15, 24));
  g.add(at(sign(t, "ASTORIA COMMUNITY COLLEGE", 30, 2.4, { bg: C.cream, fg: "#2F5DA8" }, 1.6), 0, 12, -21.9));
  for (const [x, z] of [[-10, 0], [10, 0], [0, 22]]) g.add(at(lightPool(t, 10, C.amber, 0.45), x, 0.25, z));
  return g;
}

/** A gable roof (a triangular prism) w wide, d deep, rising h, its ridge along z. */
function gable(w: number, h: number, d: number, m: Material): Mesh {
  const roof = new Mesh(new CylinderGeometry(1, 1, d, 3, 1, false), m);
  roof.rotation.x = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.set(h / 1.5, 1, w / 1.732);
  return roof;
}

// ---------------------------------------------------------------------------
// Pressed Iron Gym: a glass-fronted box, a running track on the roof and a giant dumbbell
// ---------------------------------------------------------------------------
function gym(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#2F8F8A", glass: "#BFE6F7", style: "storefront", lit: 1, seed: 111, frame: "#1F5F5B" }, 1.4);
  g.add(at(litBox(t, 26, 10, 20, glass, solid("#B9C6CF"), C.tealLight, 0.5), 0, 5, 0));
  // Rooftop track: a coral oval with a grass middle and lit edge.
  const track = new Mesh(new CylinderGeometry(9, 9, 0.3, 32), solid(C.coral));
  track.scale.set(1.3, 1, 0.9);
  g.add(at(track, 0, 10.2, 0));
  const infield = new Mesh(new CylinderGeometry(6.5, 6.5, 0.35, 32), solid("#6DB277"));
  infield.scale.set(1.3, 1, 0.8);
  g.add(at(infield, 0, 10.25, 0));
  const edge = new Mesh(new TorusGeometry(9, 0.25, 4, 40), glowing(t, C.cream, C.tealLight, 2.2, 0));
  edge.rotation.x = Math.PI / 2;
  edge.scale.set(1.3, 0.9, 1);
  g.add(at(edge, 0, 10.4, 0));
  // The dumbbell sign.
  const iron = glowing(t, C.ink, C.coral, 1.6, 0);
  const db = at(new Group(), 0, 14.5, 10);
  db.add(new Mesh(new CylinderGeometry(0.5, 0.5, 10, 8).rotateZ(Math.PI / 2), solid(C.steel)));
  for (const x of [-5, 5]) {
    const plate = new Mesh(new CylinderGeometry(2.4, 2.4, 1.6, 12).rotateZ(Math.PI / 2), iron);
    db.add(at(plate, x, 0, 0));
  }
  g.add(db);
  for (const x of [-3, 3]) g.add(at(new Mesh(new BoxGeometry(0.4, 4, 0.4), solid(C.ink)), x, 12, 10));
  g.add(at(sign(t, "PRESSED IRON", 16, 2, { bg: C.ink, fg: C.tealLight }, 2.2), 0, 8.4, 10.1));
  g.add(at(lightPool(t, 13, C.tealLight, 0.45), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Rockaway Diner: a chrome diner car with a red stripe, a row of windows and a neon pole sign
// ---------------------------------------------------------------------------
function diner(t: Themed): Group {
  const g = new Group();
  const chrome = solid("#D7E1E7", { metal: 0.4, rough: 0.35 });
  const body = new Mesh(new BoxGeometry(24, 4, 8), chrome);
  g.add(at(body, 0, 2.6, 0));
  const top = new Mesh(new CylinderGeometry(4, 4, 24, 16, 1, false, 0, Math.PI), chrome);
  top.rotation.z = Math.PI / 2;
  top.scale.set(0.35, 1, 1);
  g.add(at(top, 0, 4.6, 0));
  g.add(at(new Mesh(new BoxGeometry(24.1, 0.6, 8.1), solid("#C8352B")), 0, 1.2, 0));
  const win = glowing(t, "#4E6B7A", "#FFD58A", 1.6, 0);
  for (let i = 0; i < 9; i++) g.add(at(new Mesh(new BoxGeometry(1.8, 1.4, 8.15), win), -9.6 + i * 2.4, 3.3, 0));
  g.add(at(new Mesh(new BoxGeometry(3, 3.6, 3), solid(C.cream)), 0, 1.8, 5));
  // Pole sign.
  g.add(at(new Mesh(new CylinderGeometry(0.3, 0.3, 10, 6), solid(C.steel)), 13, 5, 6));
  g.add(at(sign(t, "DINER", 6, 2, { bg: "#C8352B", fg: C.cream }, 2.6), 13, 10.5, 6));
  g.add(at(sign(t, "ROCKAWAY", 7, 1.2, { bg: C.cream, fg: "#2F5DA8" }, 1.8), 13, 8.6, 6));
  // A couple of parked cars.
  g.add(at(new Mesh(new BoxGeometry(2, 1.2, 4.4), solid("#2F5DA8")), -8, 0.8, 9));
  g.add(at(new Mesh(new BoxGeometry(2, 1.2, 4.4), solid("#F2B705")), -4.5, 0.8, 9));
  g.add(at(lightPool(t, 13, C.amber, 0.55), 0, 0, 4));
  return g;
}

// ---------------------------------------------------------------------------
// Radiant Harbor Church: a stone nave, a steeple, a rose window and stained glass that glows
// ---------------------------------------------------------------------------
function church(t: Themed): Group {
  const g = new Group();
  const stone = glowing(t, "#E3D6C2", C.amber, 0.25, 0);
  const roof = solid("#5E7B8C");
  g.add(at(new Mesh(new BoxGeometry(16, 12, 30), stone), 0, 6, -2));
  g.add(at(gable(16.6, 7, 30.6, roof), 0, 12, -2));
  // Stained glass down both sides.
  const glassColors = [C.coral, C.sky, C.amber, C.tealLight];
  for (const x of [-8.05, 8.05]) {
    for (let i = 0; i < 5; i++) {
      const m = glowing(t, "#3A4A5A", glassColors[i % 4], 1.8, 0);
      g.add(at(new Mesh(new BoxGeometry(0.2, 5, 2), m), x, 6.5, -12 + i * 5.5));
    }
  }
  // Front tower and spire.
  g.add(at(new Mesh(new BoxGeometry(8, 22, 8), stone), 0, 11, 15));
  g.add(at(new Mesh(new ConeGeometry(5.6, 14, 4).rotateY(Math.PI / 4), roof), 0, 29, 15));
  g.add(at(new Mesh(new BoxGeometry(0.4, 3, 0.4), solid(C.amber)), 0, 37.5, 15));
  g.add(at(new Mesh(new BoxGeometry(2, 0.4, 0.4), solid(C.amber)), 0, 38.2, 15));
  // Rose window and door.
  const rose = new Mesh(new CylinderGeometry(2.4, 2.4, 0.3, 16), glowing(t, "#3A4A5A", C.coral, 2.2, 0));
  rose.rotation.x = Math.PI / 2;
  g.add(at(rose, 0, 14, 19.05));
  g.add(at(new Mesh(new BoxGeometry(3.4, 5, 0.3), solid("#7A3A2C")), 0, 2.5, 19.05));
  g.add(at(nightGlow(t, 8, 22, 8, C.amber, 0.6), 0, 11, 15));
  g.add(at(sign(t, "RADIANT HARBOR", 10, 1.4, { bg: C.cream, fg: "#2F5DA8" }, 1.4), 0, 6.4, 19.2));
  g.add(at(lightPool(t, 14, C.amber, 0.5), 0, 0, 20));
  return g;
}

// ---------------------------------------------------------------------------
// Ditmars Free Library: a classical library with columns, a pediment, wide steps and arched windows
// ---------------------------------------------------------------------------
function library(t: Themed): Group {
  const g = new Group();
  const stone = glowing(t, "#E9DCC6", C.amber, 0.25, 0);
  g.add(at(new Mesh(new BoxGeometry(28, 11, 20), stone), 0, 5.5, -2));
  g.add(at(new Mesh(new BoxGeometry(29, 1, 21), solid(C.cream)), 0, 11.5, -2));
  // Portico: steps, six columns, pediment.
  for (let i = 0; i < 3; i++) g.add(at(new Mesh(new BoxGeometry(18 - i * 1.2, 0.5, 3 - i * 0.8), solid(C.stoneDark)), 0, 0.25 + i * 0.5, 11.5 - i * 0.4));
  for (let i = 0; i < 6; i++) g.add(at(new Mesh(new CylinderGeometry(0.6, 0.7, 8, 10), solid(C.cream)), -6.25 + i * 2.5, 5.5, 9));
  g.add(at(new Mesh(new BoxGeometry(16, 1.2, 4), solid(C.cream)), 0, 10.1, 9));
  // The pediment: a gable 16 m wide and 3.4 m tall, turned to face the street.
  const pediment = gable(16, 3.4, 4.2, solid(C.cream));
  pediment.rotation.z = Math.PI / 2;
  g.add(at(pediment, 0, 11.6, 9));
  // Tall arched windows, warm at night.
  const win = glowing(t, "#4E6B7A", "#FFD58A", 1.7, 0);
  for (const x of [-11, -8, 8, 11]) g.add(at(new Mesh(new BoxGeometry(1.8, 6, 0.3), win), x, 6, 8.05));
  for (const x of [-14.05, 14.05]) for (const z of [-8, -2, 4]) g.add(at(new Mesh(new BoxGeometry(0.3, 6, 1.8), win), x, 6, z));
  g.add(at(sign(t, "FREE LIBRARY", 10, 1.1, { bg: C.cream, fg: "#2F5DA8" }, 1.4), 0, 10.1, 11.05));
  g.add(at(nightGlow(t, 28, 11, 20, C.amber, 0.5), 0, 5.5, -2));
  g.add(at(lightPool(t, 13, C.amber, 0.5), 0, 0, 14));
  return g;
}

// ---------------------------------------------------------------------------
// Engine 7 Firehouse: red brick, two big bay doors (one open), a fire truck out front, a flag
// ---------------------------------------------------------------------------
function firehouse(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: "#B33A3A", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 121, frame: C.cream });
  g.add(at(litBox(t, 14, 13, 16, brick, solid("#5E2A22"), C.amber, 0.5), 0, 6.5, 0));
  g.add(at(new Mesh(new BoxGeometry(14.6, 0.8, 16.6), solid(C.cream)), 0, 13.2, 0));
  // Bay doors: one shut (cream), one open (lit inside).
  g.add(at(new Mesh(new BoxGeometry(5, 5.5, 0.3), solid(C.cream)), -3.4, 2.75, 8.05));
  g.add(at(new Mesh(new BoxGeometry(5, 5.5, 0.3), glowing(t, "#3A3F47", "#FFE6AA", 1.8, 0)), 3.4, 2.75, 8.05));
  g.add(at(sign(t, "ENGINE 7", 9, 1.4, { bg: C.cream, fg: "#B33A3A" }, 1.8), 0, 6.6, 8.2));
  // The truck: cab, body, ladder, light bar.
  const red = solid("#C8352B");
  const truck = at(new Group(), 3.4, 0, 12);
  truck.add(at(new Mesh(new BoxGeometry(2.6, 2.2, 3), red), 0, 1.6, 3.4));
  truck.add(at(new Mesh(new BoxGeometry(2.6, 1.8, 6.5), red), 0, 1.4, -1.4));
  truck.add(at(new Mesh(new BoxGeometry(2.4, 0.3, 7.5), solid(C.steel)), 0, 2.5, -1));
  truck.add(at(new Mesh(new BoxGeometry(1.8, 0.3, 0.4), glowing(t, "#E5283F", "#FF2D3D", 3, 0.5)), 0, 2.85, 3.6));
  for (const z of [3.4, -0.5, -3.4]) for (const x of [-1.35, 1.35]) truck.add(at(new Mesh(new CylinderGeometry(0.5, 0.5, 0.4, 8).rotateZ(Math.PI / 2), solid(C.ink)), x, 0.5, z));
  g.add(truck);
  // Flag on the roof.
  g.add(at(new Mesh(new CylinderGeometry(0.12, 0.15, 6, 5), solid(C.steel)), -5, 16.6, 6));
  g.add(at(new Mesh(new BoxGeometry(2.6, 1.6, 0.08), solid("#2F5DA8")), -3.6, 18.6, 6));
  g.add(at(lightPool(t, 10, "#FF6B4C", 0.5), 2, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Altitude 718 Rooftop: a slim residential tower with a glass-railed rooftop bar, umbrellas and a pool
// ---------------------------------------------------------------------------
function rooftop(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#E9DCC6", glass: "#9ED8F7", style: "curtain", lit: 0.75, seed: 131, frame: "#C9B79C" });
  g.add(at(litBox(t, 20, 64, 20, glass, solid("#C9B79C"), C.amber, 0.4), 0, 32, 0));
  // The roof deck: glass rail, pool, umbrellas, bar.
  g.add(at(new Mesh(new BoxGeometry(20.4, 0.4, 20.4), solid("#B59E80")), 0, 64.2, 0));
  const rail = new MeshStandardMaterial({ color: "#CFE8FF", transparent: true, opacity: 0.45, roughness: 0.2 });
  for (const [w, d, x, z] of [[20.4, 0.2, 0, 10.1], [20.4, 0.2, 0, -10.1], [0.2, 20.4, 10.1, 0], [0.2, 20.4, -10.1, 0]]) g.add(at(new Mesh(new BoxGeometry(w, 1.4, d), rail), x, 65.1, z));
  g.add(at(new Mesh(new BoxGeometry(8, 0.3, 4.5), glowing(t, "#5FD4C9", "#5FD4C9", 1.6, 0.2)), -4, 64.5, 4));
  for (const [x, z, c] of [[4, 4, C.coral], [6, -3, C.cream], [-4, -5, C.coral]] as const) {
    g.add(at(new Mesh(new CylinderGeometry(0.08, 0.08, 2.4, 4), solid(C.ink)), x, 65.6, z));
    g.add(at(new Mesh(new ConeGeometry(1.6, 0.7, 8), solid(c)), x, 66.9, z));
  }
  g.add(at(new Mesh(new BoxGeometry(6, 1.1, 1.4), glowing(t, C.ink, C.amber, 1.4, 0)), 3, 64.9, -8));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.4, 0);
  const bulbGeo = new SphereGeometry(0.25, 5, 4);
  for (let i = 0; i <= 18; i++) g.add(at(new Mesh(bulbGeo, bulb), -9 + i, 67.4 - Math.sin((i / 18) * Math.PI) * 0.9, 0));
  g.add(at(sign(t, "ALTITUDE 718", 12, 1.8, { bg: C.ink, fg: C.amber }, 2.2), 0, 62, 10.2));
  g.add(at(lightPool(t, 16, C.amber, 0.4), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Ultraviolet Society (exclusive club): a black glass cube with glowing seams and a light column
// ---------------------------------------------------------------------------
function uvClub(t: Themed): Group {
  const g = new Group();
  const black = solid("#14111A", { rough: 0.25, metal: 0.3 });
  g.add(at(new Mesh(new BoxGeometry(22, 14, 22), black), 0, 7, 0));
  // Glowing seams: electric blue edges and pink bands.
  const blue = glowing(t, "#3A5BFF", "#4D7BFF", 2.6, 0.4);
  const pink = glowing(t, C.pink, C.pink, 2.4, 0.3);
  for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) g.add(at(new Mesh(new BoxGeometry(0.5, 14.2, 0.5), blue), x, 7, z));
  for (const y of [0.2, 14]) {
    for (const z of [-11, 11]) g.add(at(new Mesh(new BoxGeometry(22.4, 0.5, 0.5), blue), 0, y, z));
    for (const x of [-11, 11]) g.add(at(new Mesh(new BoxGeometry(0.5, 0.5, 22.4), blue), x, y, 0));
  }
  for (const y of [5, 9]) g.add(at(new Mesh(new BoxGeometry(22.2, 0.25, 22.2), pink), 0, y, 0));
  // The velvet-rope entrance and a door of light.
  g.add(at(new Mesh(new BoxGeometry(3, 4.5, 0.3), glowing(t, "#1B1A22", "#CFE8FF", 2.2, 0.3)), 0, 2.25, 11.05));
  for (const x of [-3, -1.6, 1.6, 3]) g.add(at(new Mesh(new CylinderGeometry(0.1, 0.12, 1.2, 5), solid("#C9B79C")), x, 0.6, 13));
  g.add(at(new Mesh(new BoxGeometry(6, 0.15, 0.15), solid("#B33A3A")), 0, 1.05, 13));
  g.add(at(sign(t, "ULTRAVIOLET", 12, 1.6, { bg: "#14111A", fg: "#8FB3FF" }, 2.6), 0, 12, 11.1));
  // A column of light straight up from the roof.
  const column = new Mesh(new CylinderGeometry(2.4, 2.4, 120, 16, 1, true), new MeshBasicMaterial({ color: "#7FA2FF", transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  column.renderOrder = 3;
  t.nightOnly.push(column);
  g.add(at(column, 0, 74, 0));
  g.add(at(lightPool(t, 18, "#4D7BFF", 0.45), 0, 0, 0));
  return g;
}

// ---------------------------------------------------------------------------
// Sip & Spill (owner, Oct 16; the old Lucky Seven Deli): a glass-front mixer with a giant teacup on the roof
// ---------------------------------------------------------------------------
function mixer(t: Themed): Group {
  const g = new Group();
  const glassFront = facade(t, { wall: "#FF6A5C", glass: "#FFE6C8", style: "storefront", lit: 1, seed: 141, frame: C.cream }, 1.6);
  const upper = facade(t, { wall: "#2FB5A8", glass: "#E9F7FA", style: "punched", lit: 0.8, seed: 143, frame: C.cream });
  g.add(at(facadeBox(14, 5, 12, glassFront, solid("#B8473C")), 0, 2.5, 0));
  g.add(at(facadeBox(14, 6.5, 12, upper, solid("#1F7F76")), 0, 5 + 3.25, 0));
  g.add(at(nightGlow(t, 14, 11.5, 12, C.pink, 0.55), 0, 5.75, 0));
  g.add(at(new Mesh(new BoxGeometry(14.6, 0.6, 12.6), solid(C.cream)), 0, 11.8, 0));
  // Striped awning over the speed-meet windows.
  for (let i = 0; i < 7; i++) {
    const a = new Mesh(new BoxGeometry(2, 0.3, 2.4), solid(i % 2 ? C.cream : "#FF6A5C"));
    a.position.set(-6 + i * 2, 5.1, 7);
    a.rotation.x = 0.35;
    g.add(a);
  }
  g.add(at(sign(t, "SIP & SPILL", 11, 1.5, { bg: C.ink, fg: C.tealLight }, 2.2), 0, 6.2, 6.3));
  // The giant teacup on the roof: saucer, cup, handle and a curl of steam that glows at night.
  const china = solid("#FFF8EE");
  g.add(at(new Mesh(new CylinderGeometry(5, 4.4, 0.5, 28), china), 0, 12.4, 0));
  g.add(at(new Mesh(new CylinderGeometry(3.8, 2.6, 3.6, 28), china), 0, 14.4, 0));
  g.add(at(new Mesh(new CylinderGeometry(3.85, 3.85, 0.5, 28), solid("#FF6A5C")), 0, 15.4, 0));
  g.add(at(new Mesh(new CylinderGeometry(3.5, 3.5, 0.15, 28), solid("#C9803F")), 0, 16.05, 0));
  const handle = new Mesh(new TorusGeometry(1.2, 0.4, 8, 16), china);
  handle.position.set(3.9, 14.6, 0);
  g.add(handle);
  const steam = glowing(t, "#FFFFFF", C.tealLight, 1.4, 0.15);
  steam.transparent = true;
  steam.opacity = 0.85;
  for (const [x, y, r] of [[-0.6, 17.4, 0.9], [0.4, 18.9, 0.75], [-0.3, 20.2, 0.6]] as const) g.add(at(new Mesh(new SphereGeometry(r, 12, 10), steam), x, y, 0));
  // A pink speech bubble on the corner: the Tea Bar.
  const bubble = new Mesh(new SphereGeometry(1.6, 16, 12), glowing(t, C.pink, C.pink, 1.6, 0.2));
  bubble.scale.set(1.4, 1, 0.5);
  g.add(at(bubble, 6, 9.5, 6.4));
  g.add(at(lightPool(t, 9, C.pink, 0.6), 0, 0, 8));
  return g;
}

// ---------------------------------------------------------------------------
// The Sticky Floor (dive club): a low painted box with stripes and a disco ball on the roof
// ---------------------------------------------------------------------------
function diveClub(t: Themed): Group {
  const g = new Group();
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const x = c.getContext("2d")!;
  const bands = [C.coral, C.amber, C.tealLight, C.sky, C.pink];
  bands.forEach((col, i) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(i * 60 - 20, 64);
    x.lineTo(i * 60 + 30, 0);
    x.lineTo(i * 60 + 60, 0);
    x.lineTo(i * 60 + 10, 64);
    x.fill();
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const mural = new MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: "#FFFFFF", emissiveMap: tex, emissiveIntensity: 0 });
  t.glows.push({ mat: mural, day: 0, night: 0.5 });
  const wall = solid(C.charcoal);
  g.add(at(new Mesh(new BoxGeometry(24, 7, 16), [wall, wall, solid("#55545E"), wall, mural, wall]), 0, 3.5, 0));
  g.add(at(nightGlow(t, 24, 7, 16, C.pink, 0.5), 0, 3.5, 0));
  // The disco ball, sparkling at night.
  const ball = new Mesh(new IcosahedronGeometry(2.6, 1), glowing(t, "#D7E1E7", "#FFFFFF", 1.2, 0));
  (ball.material as MeshStandardMaterial).metalness = 0.6;
  g.add(at(ball, 0, 11, 0));
  g.add(at(new Mesh(new CylinderGeometry(0.1, 0.1, 1.6, 4), solid(C.ink)), 0, 13.9, 0));
  g.add(at(new Mesh(new BoxGeometry(0.3, 4, 0.3), solid(C.ink)), 0, 9, 0));
  searchlights(t, g, [[-9, 7.2, -4], [9, 7.2, -4]], 70);
  g.add(at(sign(t, "THE STICKY FLOOR", 14, 1.6, { bg: C.ink, fg: C.amber }, 2.2), 0, 5.6, 8.2));
  g.add(at(lightPool(t, 12, C.pink, 0.55), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Lucky Star Lotto: a bright storefront with a giant star on the roof and a run of lights
// ---------------------------------------------------------------------------
function lotto(t: Themed): Group {
  const g = new Group();
  const store = facade(t, { wall: "#C8352B", glass: "#FFE6AA", style: "storefront", lit: 1, seed: 151, frame: C.cream }, 1.6);
  g.add(at(litBox(t, 16, 7, 12, store, solid("#7A2A22"), "#FFD54A", 0.6), 0, 3.5, 0));
  // The star: two triangles, bulbs round the edge.
  const starMat = glowing(t, "#FFD54A", "#FFD54A", 2.4, 0.3);
  for (const rz of [0, Math.PI]) {
    // A flat triangle facing the street, turned in its own plane (two make the star).
    const tri = new Mesh(new CylinderGeometry(4, 4, 0.6, 3).rotateX(Math.PI / 2), starMat);
    tri.rotation.z = rz + Math.PI / 2;
    g.add(at(tri, 0, 12, 2));
  }
  for (const x of [-1.2, 1.2]) g.add(at(new Mesh(new BoxGeometry(0.3, 4, 0.3), solid(C.ink)), x, 8.5, 2));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.6, 0.1);
  const bulbGeo = new SphereGeometry(0.25, 5, 4);
  for (let i = 0; i < 20; i++) g.add(at(new Mesh(bulbGeo, bulb), -7.6 + i * 0.8, 6.8, 6.1));
  g.add(at(sign(t, "LUCKY STAR LOTTO", 12, 1.6, { bg: C.cream, fg: "#C8352B" }, 2), 0, 5.6, 6.2));
  g.add(at(lightPool(t, 11, "#FFD54A", 0.55), 0, 0, 8));
  return g;
}

/** A small parked car (for lots and showrooms). */
function parkedCar(color: string): Group {
  const g = new Group();
  g.add(at(new Mesh(new BoxGeometry(1.9, 0.75, 4.4), solid(color, { rough: 0.4 })), 0, 0.7, 0));
  g.add(at(new Mesh(new BoxGeometry(1.7, 0.6, 2.2), solid("#2A3440")), 0, 1.35, 0.2));
  return g;
}

// ---------------------------------------------------------------------------
// Thread Count Boutique: a cream townhouse with arched display windows, mannequins and topiaries
// ---------------------------------------------------------------------------
function boutique(t: Themed): Group {
  const g = new Group();
  const upper = facade(t, { wall: "#F4E9DA", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 161, frame: C.ink });
  g.add(at(facadeBox(14, 9, 13, upper, solid("#C9B79C")), 0, 5 + 4.5, 0));
  g.add(at(new Mesh(new BoxGeometry(14, 5, 13), solid("#F4E9DA")), 0, 2.5, 0));
  g.add(at(nightGlow(t, 14, 14, 13, C.pink, 0.45), 0, 7, 0));
  g.add(at(new Mesh(new BoxGeometry(14.6, 0.7, 13.6), solid(C.ink)), 0, 14.3, 0));
  // Two arched display windows with mannequins.
  const display = glowing(t, "#3A4A5A", "#FFD6E2", 1.8, 0);
  for (const x of [-3.6, 3.6]) {
    g.add(at(new Mesh(new BoxGeometry(5, 3.6, 0.3), display), x, 2.2, 6.55));
    const top = new Mesh(new CylinderGeometry(2.5, 2.5, 0.3, 12, 1, false, 0, Math.PI), display);
    top.rotation.x = Math.PI / 2;
    top.rotation.z = Math.PI / 2;
    g.add(at(top, x, 4, 6.55));
    for (const dx of [-1, 1]) {
      g.add(at(new Mesh(new CylinderGeometry(0.35, 0.5, 2, 6), solid(dx < 0 ? C.coral : C.tealLight)), x + dx, 1.6, 6));
      g.add(at(new Mesh(new SphereGeometry(0.3, 6, 4), solid(C.cream)), x + dx, 2.9, 6));
    }
  }
  // Black canopy over the door, topiaries either side.
  g.add(at(new Mesh(new BoxGeometry(3, 0.3, 2.4), solid(C.ink)), 0, 4.6, 7.6));
  for (const x of [-6.4, 6.4]) {
    g.add(at(new Mesh(new BoxGeometry(1, 0.9, 1), solid(C.ink)), x, 0.45, 7.4));
    g.add(at(new Mesh(new SphereGeometry(0.9, 7, 5), solid("#4E8F5A")), x, 1.6, 7.4));
  }
  g.add(at(sign(t, "THREAD COUNT", 10, 1.2, { bg: C.ink, fg: "#FFD6E2" }, 2), 0, 5.6, 6.7));
  g.add(at(lightPool(t, 9, "#FFD6E2", 0.55), 0, 0, 8));
  return g;
}

// ---------------------------------------------------------------------------
// Fif's Furniture: a big glass showroom of sofas, with a giant armchair on the roof
// ---------------------------------------------------------------------------
function showroom(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#F2C14E", glass: "#FFF3DE", style: "storefront", lit: 1, seed: 171, frame: "#C98E3C" }, 1.4);
  g.add(at(litBox(t, 34, 10, 22, glass, solid("#C9B79C"), C.amber, 0.45), 0, 5, 0));
  // Sofas in the window.
  for (const [x, c] of [[-12, C.coral], [-4, C.tealLight], [4, C.sky], [12, C.pink]] as const) {
    g.add(at(new Mesh(new BoxGeometry(5, 1.2, 2), solid(c)), x, 0.9, 9.6));
    g.add(at(new Mesh(new BoxGeometry(5, 1.4, 0.6), solid(c)), x, 1.6, 8.8));
  }
  // The giant armchair.
  const chair = at(new Group(), 0, 10, -2);
  const fabric = glowing(t, C.coral, C.coral, 0.6, 0);
  chair.add(at(new Mesh(new BoxGeometry(9, 2.4, 7), fabric), 0, 2.2, 0));
  chair.add(at(new Mesh(new BoxGeometry(9, 6, 1.8), fabric), 0, 4.6, -2.6));
  for (const x of [-4.1, 4.1]) chair.add(at(new Mesh(new BoxGeometry(1.4, 3.4, 7), fabric), x, 3, 0));
  chair.add(at(new Mesh(new BoxGeometry(7, 0.8, 5), solid(C.cream)), 0, 3.7, 0.6));
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) chair.add(at(new Mesh(new BoxGeometry(0.6, 1, 0.6), solid("#8B5E3C")), x, 0.5, z));
  chair.scale.setScalar(1.5);
  g.add(chair);
  g.add(at(sign(t, "FIF'S FURNITURE", 18, 2.2, { bg: "#C8352B", fg: C.cream }, 2.2), 0, 8.4, 11.1));
  g.add(at(lightPool(t, 18, C.amber, 0.45), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Boulevard Motors: a sloped glass showroom, a lot of cars under lights, bunting and a pylon sign
// ---------------------------------------------------------------------------
function dealership(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#D7E1E7", glass: "#BFE6F7", style: "curtain", lit: 0.9, seed: 181, frame: "#8FA4B8" }, 1.3);
  g.add(at(litBox(t, 30, 9, 16, glass, solid("#8FA4B8"), C.sky, 0.45), 0, 4.5, -10));
  const roof = new Mesh(new BoxGeometry(32, 0.6, 18), solid("#5E7B8C"));
  roof.rotation.x = -0.12;
  g.add(at(roof, 0, 9.8, -10));
  // Showroom cars and the lot.
  for (const [x, c] of [[-8, "#C8352B"], [0, "#F4F1EA"], [8, "#2F5DA8"]] as const) g.add(at(parkedCar(c), x, 0, -8));
  const lot = ["#F2B705", "#1F1B26", "#B9BEC6", "#2E4A3A", "#C8352B", "#F4F1EA", "#5B6B7A", "#2F5DA8"];
  lot.forEach((c, i) => {
    const car = parkedCar(c);
    car.rotation.y = 0.5;
    g.add(at(car, -13 + (i % 4) * 8.5, 0, 6 + Math.floor(i / 4) * 7));
  });
  // Lot lights and bunting.
  const lamp = glowing(t, C.cream, "#FFFFFF", 2.6, 0);
  for (const x of [-15, 15]) {
    g.add(at(new Mesh(new CylinderGeometry(0.2, 0.25, 9, 5), solid(C.steel)), x, 4.5, 18));
    g.add(at(new Mesh(new BoxGeometry(2, 0.5, 1), lamp), x, 9, 18));
  }
  for (let i = 0; i < 16; i++) {
    const flag = new Mesh(new ConeGeometry(0.4, 1, 3), solid([C.coral, C.amber, C.sky, C.tealLight][i % 4]));
    flag.rotation.x = Math.PI;
    g.add(at(flag, -15 + i * 2, 8 - Math.sin((i / 15) * Math.PI) * 1.4, 18));
  }
  // Pylon sign.
  g.add(at(new Mesh(new BoxGeometry(1.2, 16, 1.2), solid(C.ink)), 18, 8, 16));
  g.add(at(sign(t, "BOULEVARD", 9, 2, { bg: "#2F5DA8", fg: C.cream }, 2.2), 18, 17, 16));
  g.add(at(sign(t, "MOTORS", 9, 2, { bg: C.cream, fg: "#2F5DA8" }, 1.8), 18, 14.8, 16));
  g.add(at(lightPool(t, 22, "#FFFFFF", 0.35), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Reel Queens Cinema: an art deco movie house, stepped top, tall REEL blade and a bulb marquee
// ---------------------------------------------------------------------------
function cinema(t: Themed): Group {
  const g = new Group();
  const deco = facade(t, { wall: C.cream, glass: "#4E6B7A", style: "punched", lit: 0.6, seed: 191, frame: "#2F8F8A" });
  g.add(at(litBox(t, 22, 12, 26, deco, solid("#C9B79C"), C.amber, 0.4), 0, 6, 0));
  // Stepped deco crown on the front.
  for (let i = 0; i < 3; i++) g.add(at(new Mesh(new BoxGeometry(12 - i * 3.5, 2, 2), solid(i % 2 ? "#2F8F8A" : C.cream)), 0, 13 + i * 2, 12));
  // Marquee: a deep box with chasing bulbs and today's title.
  g.add(at(new Mesh(new BoxGeometry(16, 3, 4), solid(C.ink)), 0, 5.5, 15));
  g.add(at(sign(t, "NOW: SEQUEL 7", 14, 1.8, { bg: C.cream, fg: "#C8352B" }, 2), 0, 5.5, 17.05));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.8, 0.15);
  const bulbGeo = new SphereGeometry(0.25, 5, 4);
  for (let i = 0; i < 20; i++) {
    g.add(at(new Mesh(bulbGeo, bulb), -7.6 + i * 0.8, 7.2, 17.05));
    g.add(at(new Mesh(bulbGeo, bulb), -7.6 + i * 0.8, 3.8, 17.05));
  }
  g.add(at(blade(t, "REEL", 12, { bg: "#C8352B", fg: "#FFE27A" }, 2.8), 0, 13, 14.5));
  // Poster boxes by the doors.
  for (const x of [-9, 9]) g.add(at(new Mesh(new BoxGeometry(2.4, 3.4, 0.3), glowing(t, "#3A4A5A", C.sky, 1.4, 0)), x, 2.2, 13.1));
  g.add(at(lightPool(t, 13, "#FFE27A", 0.6), 0, 0, 17));
  return g;
}

// ---------------------------------------------------------------------------
// Respawn Arena: a rounded games arena with an LED band, a giant screen and a controller sign
// ---------------------------------------------------------------------------
function arena(t: Themed): Group {
  const g = new Group();
  // Faintly lit at night, so the shell reads against the dark map.
  const shell = glowing(t, "#2A2F3A", "#5FD4C9", 0.3, 0);
  const body = new Mesh(new CylinderGeometry(18, 20, 12, 32), shell);
  body.scale.set(1.3, 1, 1);
  g.add(at(body, 0, 6, 0));
  const roof = new Mesh(new SphereGeometry(18, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), solid("#3B3A44"));
  roof.scale.set(1.3, 0.35, 1);
  g.add(at(roof, 0, 12, 0));
  // LED bands, cyan and pink.
  for (const [y, c] of [[3, C.tealLight], [9, C.pink]] as const) {
    const band = new Mesh(new TorusGeometry(19.5 - (y === 9 ? 1 : 0), 0.4, 4, 48), glowing(t, c, c, 2.6, 0.4));
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.3, 1, 1);
    g.add(at(band, 0, y, 0));
  }
  // The big screen over the entrance.
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  const grd = x.createLinearGradient(0, 0, 256, 128);
  grd.addColorStop(0, "#2F8F8A");
  grd.addColorStop(1, "#E8735A");
  x.fillStyle = grd;
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = "#FFF3DE";
  x.font = "900 54px system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("GG", 128, 66);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const screen = new MeshStandardMaterial({ map: tex, emissive: "#FFFFFF", emissiveMap: tex, emissiveIntensity: 0.3 });
  t.glows.push({ mat: screen, day: 0.3, night: 1.4 });
  const scr = new Mesh(new PlaneGeometry(14, 7), screen);
  g.add(at(scr, 0, 8, 20.7));
  // Controller sign on the roof.
  const pad = at(new Group(), 0, 18.5, 4);
  const padMat = glowing(t, C.ink, C.tealLight, 0.8, 0);
  pad.add(new Mesh(new BoxGeometry(8, 2.6, 1), padMat));
  for (const sx of [-3.6, 3.6]) pad.add(at(new Mesh(new CylinderGeometry(1.6, 1.6, 1, 10).rotateX(Math.PI / 2), padMat), sx, -0.8, 0));
  for (const [bx, by, col] of [[2.2, 0.5, C.coral], [3.2, -0.3, C.amber], [1.4, -0.3, C.tealLight]] as const) pad.add(at(new Mesh(new CylinderGeometry(0.35, 0.35, 0.3, 8).rotateX(Math.PI / 2), glowing(t, col, col, 2.4, 0.3)), bx, by, 0.6));
  g.add(pad);
  g.add(at(sign(t, "RESPAWN ARENA", 14, 1.8, { bg: C.ink, fg: C.tealLight }, 2.4), 0, 3.4, 20.6));
  g.add(at(lightPool(t, 22, C.tealLight, 0.4), 0, 0, 6));
  return g;
}

/** A ring of low-poly trees around a site, radius r, n of them. */
function treeRing(g: Group, r: number, n: number, y = 0) {
  const leaves = solid("#4E8F5A");
  const trunk = solid("#8B5E3C");
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1;
    g.add(at(new Mesh(new CylinderGeometry(0.4, 0.5, 2.6, 5), trunk), Math.cos(a) * r, y + 1.3, Math.sin(a) * r));
    g.add(at(new Mesh(new ConeGeometry(2.6, 5.5, 6), leaves), Math.cos(a) * r, y + 4.8, Math.sin(a) * r));
  }
}

// ---------------------------------------------------------------------------
// Campus pieces (owner, Oct 16: "bigger so they feel like a campus with multiple buildings")
// ---------------------------------------------------------------------------

/** A hall: a lit facade box with a gable or flat roof, w along x, d along z, turned ry. */
function hall(t: Themed, g: Group, x: number, z: number, w: number, h: number, d: number, wall: Material, roof: Material, glow: string, kind: "gable" | "flat" = "gable", ry = 0) {
  const one = at(new Group(), x, 0, z);
  one.rotation.y = ry;
  one.add(at(litBox(t, w, h, d, wall, roof, glow, 0.4), 0, h / 2, 0));
  if (kind === "gable") one.add(at(gable(w + 0.8, Math.min(5, d * 0.3), d + 0.8, roof), 0, h, 0));
  else one.add(at(new Mesh(new BoxGeometry(w + 0.6, 0.8, d + 0.6), roof), 0, h + 0.4, 0));
  g.add(one);
}

/** A straight path from (x1, z1) to (x2, z2), w wide, with trees along both sides. */
function avenue(g: Group, x1: number, z1: number, x2: number, z2: number, w: number, paving: string, trees = true) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const path = new Mesh(new BoxGeometry(w, 0.25, len), solid(paving));
  path.position.set((x1 + x2) / 2, 0.22, (z1 + z2) / 2);
  path.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  g.add(path);
  if (!trees) return;
  const leaves = solid("#4E8F5A");
  const trunk = solid("#8B5E3C");
  const n = Math.floor(len / 11);
  const ux = (x2 - x1) / len, uz = (z2 - z1) / len;
  for (let i = 1; i < n; i++) {
    for (const side of [-1, 1]) {
      const px = x1 + ux * i * 11 + uz * side * (w / 2 + 2.5);
      const pz = z1 + uz * i * 11 - ux * side * (w / 2 + 2.5);
      g.add(at(new Mesh(new CylinderGeometry(0.35, 0.45, 2.4, 5), trunk), px, 1.2, pz));
      g.add(at(new Mesh(new SphereGeometry(2.4, 6, 5), leaves), px, 4.4, pz));
    }
  }
}

/** A sports field with a running track, at (x, z). */
function sportsField(t: Themed, g: Group, x: number, z: number, ry = 0) {
  const f = at(new Group(), x, 0, z);
  f.rotation.y = ry;
  const track = new Mesh(new CylinderGeometry(28, 28, 0.3, 32), solid(C.coral));
  track.scale.set(1.6, 1, 1);
  f.add(at(track, 0, 0.25, 0));
  const pitch = new Mesh(new CylinderGeometry(22, 22, 0.35, 32), solid("#5FA36B"));
  pitch.scale.set(1.55, 1, 0.95);
  f.add(at(pitch, 0, 0.3, 0));
  f.add(at(new Mesh(new BoxGeometry(1, 0.4, 36), solid(C.cream)), 0, 0.5, 0));
  f.add(at(new Mesh(new BoxGeometry(40, 5, 6), solid("#8FA4B8")), 0, 2.5, -33));
  const lamp = glowing(t, C.cream, "#FFFFFF", 2.6, 0);
  for (const sx of [-40, 40]) for (const sz of [-26, 26]) {
    f.add(at(new Mesh(new CylinderGeometry(0.4, 0.5, 20, 6), solid(C.steel)), sx, 10, sz));
    f.add(at(new Mesh(new BoxGeometry(4, 2, 0.8), lamp), sx, 20, sz));
  }
  f.add(at(lightPool(t, 42, "#FFFFFF", 0.3), 0, 0.4, 0));
  g.add(f);
}

/** A parking lot with rows of cars, at (x, z), w by d. */
function parkingLot(g: Group, x: number, z: number, w: number, d: number) {
  g.add(at(new Mesh(new BoxGeometry(w, 0.2, d), solid("#9AA3AE")), x, 0.15, z));
  const colors = ["#F4F1EA", "#1F1B26", "#C8352B", "#2F5DA8", "#B9BEC6", "#2E4A3A", "#F2B705"];
  let k = 0;
  for (let row = 0; row < 2; row++) for (let cx = -w / 2 + 3; cx < w / 2 - 2; cx += 3.4) {
    if ((k * 7) % 5 === 0) { k++; continue; }
    g.add(at(parkedCar(colors[k++ % colors.length]), x + cx, 0, z - d / 4 + row * (d / 2)));
  }
}

/** Lamp posts along a line, warm pools of light under them at night. */
function lampRow(t: Themed, g: Group, x1: number, z1: number, x2: number, z2: number, n: number) {
  const bulb = glowing(t, C.cream, "#FFE27A", 2.4, 0);
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n, z = z1 + ((z2 - z1) * i) / n;
    g.add(at(new Mesh(new CylinderGeometry(0.15, 0.2, 4.5, 5), solid(C.ink)), x, 2.25, z));
    g.add(at(new Mesh(new SphereGeometry(0.5, 6, 4), bulb), x, 4.7, z));
    g.add(at(lightPool(t, 6, C.amber, 0.4), x, 0.3, z));
  }
}

// ---------------------------------------------------------------------------
// St. Johnsons University: a red-brick campus round a great lawn: the white chapel and its spire,
// a domed library, eight halls, dorm towers, a sports field and a parking lot
// ---------------------------------------------------------------------------
function stJohnsons(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: "#A9483A", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 201, frame: C.cream });
  const dorm = facade(t, { wall: "#B9765A", glass: "#4E6B7A", style: "punched", lit: 0.8, seed: 203, frame: C.cream });
  const slate = solid("#4A5A6A");
  const white = glowing(t, "#F4F1EA", C.amber, 0.3, 0);
  // Grounds: the whole campus lawn, the great lawn in the middle, crossing paths.
  // Round grounds that sit inside the site, so no corner pokes out over a street.
  g.add(at(new Mesh(new CylinderGeometry(140, 140, 0.2, 48), solid("#7CBF7A")), 0, 0.1, 0));
  g.add(at(new Mesh(new BoxGeometry(80, 0.25, 70), solid("#6DB277")), 0, 0.18, 0));
  avenue(g, 0, 92, 0, -38, 8, "#E9DCC6");
  avenue(g, -95, 0, 95, 0, 6, "#E9DCC6");
  avenue(g, -40, -40, 40, 40, 4, "#E9DCC6", false);
  avenue(g, -40, 40, 40, -40, 4, "#E9DCC6", false);
  // The chapel at the head of the lawn, its spire the tallest thing on campus.
  g.add(at(new Mesh(new BoxGeometry(16, 16, 30), white), 0, 8, -58));
  g.add(at(gable(16.6, 7, 30.6, slate), 0, 16, -58));
  g.add(at(new Mesh(new BoxGeometry(8, 26, 8), white), 0, 13, -41));
  g.add(at(new Mesh(new CylinderGeometry(3.4, 3.8, 7, 8), white), 0, 29.5, -41));
  g.add(at(new Mesh(new ConeGeometry(3.6, 22, 8), slate), 0, 44, -41));
  g.add(at(new Mesh(new BoxGeometry(0.4, 3, 0.4), solid(C.amber)), 0, 56.5, -41));
  g.add(at(nightGlow(t, 8, 26, 8, C.amber, 0.6), 0, 13, -41));
  // The domed library at the foot of the lawn.
  g.add(at(litBox(t, 30, 14, 20, brick, slate, C.amber, 0.45), 0, 7, 50));
  for (let i = 0; i < 6; i++) g.add(at(new Mesh(new CylinderGeometry(0.7, 0.8, 11, 8), solid(C.cream)), -7.5 + i * 3, 5.5, 39));
  g.add(at(new Mesh(new SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowing(t, "#5E8C7A", "#9FE3A0", 0.4, 0)), 0, 14, 50));
  // Eight halls round the lawn, four a side.
  for (const side of [-1, 1]) {
    for (const [z, w, h] of [[-48, 34, 16], [-14, 34, 14], [18, 34, 14], [52, 30, 12]] as const) hall(t, g, side * 62, z, w, h, 16, brick, slate, C.amber, "gable", Math.PI / 2);
  }
  // Dorm towers in the northeast, a sports field in the southwest, parking in the southeast.
  for (const [x, z, h] of [[78, -70, 34], [96, -70, 30], [96, -50, 26]] as const) hall(t, g, x, z, 14, h, 14, dorm, slate, C.amber, "flat");
  sportsField(t, g, -80, 62, 0);
  parkingLot(g, 80, 66, 50, 30);
  // The gate and sign at the main entrance.
  for (const x of [-8, 8]) g.add(at(new Mesh(new BoxGeometry(2, 8, 2), solid("#A9483A")), x, 4, 93));
  g.add(at(new Mesh(new BoxGeometry(18, 1.4, 2), solid("#A9483A")), 0, 8.6, 93));
  g.add(at(sign(t, "ST. JOHNSONS UNIVERSITY", 20, 1.8, { bg: C.cream, fg: "#B33A3A" }, 1.6), 0, 6.4, 94.1));
  lampRow(t, g, -38, 0, 38, 0, 6);
  lampRow(t, g, 0, 30, 0, 86, 4);
  return g;
}

// ---------------------------------------------------------------------------
// Queensborough University: cream halls with tile roofs round a quad and a fountain, arcades, a
// glass library tower, a modern science block, a student union, dorms, courts and parking
// ---------------------------------------------------------------------------
function queensboroughU(t: Themed): Group {
  const g = new Group();
  const stucco = facade(t, { wall: "#EFE3CC", glass: "#4E6B7A", style: "punched", lit: 0.7, seed: 211, frame: "#C46A4E" });
  const tile = solid("#C46A4E");
  const glass = facade(t, { wall: "#3F7F86", glass: "#BFE6F7", style: "curtain", lit: 0.8, seed: 213, frame: "#2E5F66" });
  const modern = facade(t, { wall: "#D7E1E7", glass: "#9ED8F7", style: "curtain", lit: 0.75, seed: 215, frame: "#8FA4B8" });
  const dorm = facade(t, { wall: "#E9DCC6", glass: "#4E6B7A", style: "punched", lit: 0.8, seed: 217, frame: "#C46A4E" });
  // Grounds, the quad and its paths.
  g.add(at(new Mesh(new CylinderGeometry(136, 136, 0.2, 48), solid("#7CBF7A")), 0, 0.1, 0));
  g.add(at(new Mesh(new BoxGeometry(70, 0.25, 60), solid("#6DB277")), -10, 0.18, 0));
  avenue(g, -10, 88, -10, -30, 7, "#E9C9A8");
  avenue(g, -90, 0, 70, 0, 6, "#E9C9A8");
  // A round fountain in the middle of the quad.
  g.add(at(new Mesh(new CylinderGeometry(7, 7.5, 0.8, 20), solid(C.stoneDark)), -10, 0.4, 0));
  g.add(at(new Mesh(new CylinderGeometry(6.2, 6.2, 0.9, 20), glowing(t, C.water, "#3FB7D9", 0.5, 0)), -10, 0.5, 0));
  g.add(at(new Mesh(new ConeGeometry(0.6, 4, 5), glowing(t, "#F4FBFF", C.sky, 0.9, 0.05)), -10, 2.6, 0));
  // Mission-style halls round the quad, with an arcade along the main one.
  hall(t, g, -10, -42, 64, 13, 16, stucco, tile, C.amber);
  hall(t, g, -56, -6, 50, 12, 16, stucco, tile, C.amber, "gable", Math.PI / 2);
  hall(t, g, 36, -14, 34, 12, 16, stucco, tile, C.amber, "gable", Math.PI / 2);
  for (let i = 0; i < 12; i++) g.add(at(new Mesh(new BoxGeometry(0.9, 5, 0.9), solid("#EFE3CC")), -36 + i * 4.7, 2.5, -32.5));
  g.add(at(new Mesh(new BoxGeometry(56, 0.8, 3.4), tile), -10, 5.4, -32.5));
  // The library tower, with a lit clock band.
  g.add(at(litBox(t, 18, 46, 18, glass, solid("#8FA4B8"), C.sky, 0.45), 40, 23, 26));
  g.add(at(new Mesh(new BoxGeometry(18.6, 3.4, 18.6), glowing(t, C.cream, "#FFF3DE", 1.4, 0.1)), 40, 42, 26));
  // Science block and student union.
  hall(t, g, -50, 46, 36, 18, 22, modern, solid("#8FA4B8"), C.sky, "flat");
  hall(t, g, 0, 52, 30, 10, 18, stucco, tile, C.amber);
  // Dorms, courts and parking at the edges.
  for (const [x, z] of [[-90, -60], [-72, -72], [-90, -80]] as const) hall(t, g, x, z, 14, 24, 14, dorm, tile, C.amber, "flat");
  for (let i = 0; i < 3; i++) {
    g.add(at(new Mesh(new BoxGeometry(14, 0.2, 26), solid("#3F8F5E")), 70 + i * 16, 0.2, -66));
    g.add(at(new Mesh(new BoxGeometry(10, 0.25, 22), glowing(t, "#3A6FB0", "#5F9BEA", 0.9, 0)), 70 + i * 16, 0.3, -66));
  }
  parkingLot(g, 78, 62, 46, 30);
  g.add(at(sign(t, "QUEENSBOROUGH UNIVERSITY", 24, 1.8, { bg: C.cream, fg: "#C46A4E" }, 1.6), -10, 3, 89));
  for (const x of [-24, 4]) g.add(at(new Mesh(new BoxGeometry(1.2, 4, 1.2), solid("#C46A4E")), x, 2, 89));
  lampRow(t, g, -40, 4, 20, 4, 5);
  lampRow(t, g, -14, 20, -14, 84, 4);
  return g;
}

// ---------------------------------------------------------------------------
// World's Fair Towers (Flushing Meadows): three observation towers with saucer tops beside the
// open ring of the old pavilion
// ---------------------------------------------------------------------------
function fairTowers(t: Themed): Group {
  const g = new Group();
  const concrete = glowing(t, "#D9D2C5", C.amber, 0.35, 0);
  const saucer = glowing(t, "#E8735A", "#FF8A4C", 1.2, 0);
  for (const [x, z, h] of [[-30, -6, 68], [-18, 8, 54], [-36, 14, 40]] as const) {
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) g.add(at(new Mesh(new CylinderGeometry(0.7, 1, h, 6), concrete), x + dx, h / 2, z + dz));
    const top = new Mesh(new CylinderGeometry(7, 4.5, 3, 16), saucer);
    g.add(at(top, x, h + 1.5, z));
    g.add(at(new Mesh(new CylinderGeometry(7.4, 7.4, 0.5, 16), glowing(t, C.cream, "#FFE27A", 2.2, 0)), x, h + 3.2, z));
  }
  // The pavilion: a ring of tall columns holding an open oval roof frame.
  const ringR = 26;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(at(new Mesh(new CylinderGeometry(0.9, 1.1, 30, 8), concrete), 18 + Math.cos(a) * ringR * 1.25, 15, Math.sin(a) * ringR));
  }
  const roofRing = new Mesh(new TorusGeometry(ringR, 1.2, 6, 48), glowing(t, "#F2C14E", "#FFD54A", 1.6, 0));
  roofRing.rotation.x = Math.PI / 2;
  roofRing.scale.set(1.25, 1, 1);
  g.add(at(roofRing, 18, 30, 0));
  // Map of the city on the floor, as at the fair (a tiled ellipse).
  const floor = new Mesh(new CylinderGeometry(ringR - 2, ringR - 2, 0.3, 40), solid("#9ED8F7"));
  floor.scale.set(1.25, 1, 1);
  g.add(at(floor, 18, 0.2, 0));
  treeRing(g, 62, 20);
  g.add(at(lightPool(t, 34, C.amber, 0.35), 18, 0.3, 0));
  g.add(at(lightPool(t, 20, "#FF8A4C", 0.4), -28, 0.3, 4));
  return g;
}

// ---------------------------------------------------------------------------
// Discount Disco: a strip-mall store turned club: a giant price tag, a light-up floor on the roof
// ---------------------------------------------------------------------------
function discountDisco(t: Themed): Group {
  const g = new Group();
  const store = facade(t, { wall: C.cream, glass: "#FFD6E2", style: "storefront", lit: 1, seed: 221, frame: "#C8352B" }, 1.4);
  g.add(at(litBox(t, 30, 8, 18, store, solid("#B9C6CF"), C.pink, 0.55), 0, 4, 0));
  g.add(at(new Mesh(new BoxGeometry(31, 2, 1), solid("#C8352B")), 0, 7.6, 9.2));
  g.add(at(sign(t, "DISCOUNT DISCO", 16, 1.8, { bg: "#C8352B", fg: C.cream }, 2.2), 0, 7.6, 9.8));
  // The giant price tag on the roof, with its string.
  const tag = at(new Group(), 4, 13, 0);
  tag.add(sign(t, "50% OFF", 10, 5, { bg: "#F2C14E", fg: "#C8352B" }, 2.4));
  tag.add(at(new Mesh(new CylinderGeometry(0.6, 0.6, 0.4, 10).rotateX(Math.PI / 2), solid(C.cream)), -4, 1.6, 0.3));
  tag.rotation.z = 0.15;
  g.add(tag);
  for (const x of [1, 7]) g.add(at(new Mesh(new BoxGeometry(0.3, 4, 0.3), solid(C.ink)), x, 9.5, 0));
  // Light-up dance floor on the roof: a grid of colored tiles.
  const tileColors = [C.coral, C.tealLight, C.amber, C.pink, C.sky];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const c = tileColors[(i + j * 2) % tileColors.length];
      g.add(at(new Mesh(new BoxGeometry(2.2, 0.2, 2.2), glowing(t, c, c, 1.8, 0.3)), -12 + i * 2.4, 8.15, -6 + j * 2.4));
    }
  }
  g.add(at(lightPool(t, 16, C.pink, 0.45), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Pedal Pushers Hub: a delivery depot with loading docks, racks of cargo bikes and a wheel sign
// ---------------------------------------------------------------------------
function bikeHub(t: Themed): Group {
  const g = new Group();
  const shed = facade(t, { wall: "#5E7B8C", glass: "#BFE6F7", style: "industrial", lit: 0.6, seed: 231 });
  g.add(at(litBox(t, 30, 9, 20, shed, solid("#3F5A73"), C.tealLight, 0.4), 0, 4.5, -2));
  // Roll-up dock doors, lit at night.
  for (const x of [-9, -3, 3, 9]) g.add(at(new Mesh(new BoxGeometry(4.4, 5, 0.3), glowing(t, "#B9C6CF", "#FFE6AA", 1.6, 0)), x, 2.5, 8.1));
  // Cargo bikes and stacked boxes out front.
  const frame = solid(C.coral);
  const tire = solid(C.ink);
  for (let i = 0; i < 6; i++) {
    const b = at(new Group(), -12 + i * 4.6, 0, 12);
    b.add(at(new Mesh(new TorusGeometry(0.45, 0.1, 4, 10), tire), 0, 0.5, -0.9));
    b.add(at(new Mesh(new TorusGeometry(0.45, 0.1, 4, 10), tire), 0, 0.5, 0.9));
    for (const m of b.children) (m as Mesh).rotation.y = Math.PI / 2;
    b.add(at(new Mesh(new BoxGeometry(0.15, 0.15, 2), frame), 0, 0.9, 0));
    b.add(at(new Mesh(new BoxGeometry(1, 0.9, 0.9), solid(C.amber)), 0, 1.3, -0.7));
    g.add(b);
  }
  for (const [x, y] of [[12, 0.5], [13.1, 0.5], [12.5, 1.5]]) g.add(at(new Mesh(new BoxGeometry(1, 1, 1), solid("#C9A27A")), x, y, 9));
  // The wheel sign on the roof.
  const wheel = at(new Group(), 0, 14, 0);
  wheel.add(new Mesh(new TorusGeometry(4, 0.45, 6, 24), glowing(t, C.ink, C.tealLight, 2.2, 0)));
  for (let i = 0; i < 6; i++) {
    const spoke = new Mesh(new BoxGeometry(0.15, 8, 0.15), solid(C.steel));
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  g.add(wheel);
  for (const x of [-2, 2]) g.add(at(new Mesh(new BoxGeometry(0.3, 3, 0.3), solid(C.ink)), x, 10, 0));
  g.add(at(sign(t, "PEDAL PUSHERS", 14, 1.6, { bg: C.ink, fg: C.tealLight }, 2.2), 0, 7.8, 8.2));
  g.add(at(lightPool(t, 16, C.amber, 0.45), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// The Neon Spoon: a space-age diner with an upswept roof, a wall of glass and a giant neon spoon
// ---------------------------------------------------------------------------
function googieDiner(t: Themed): Group {
  const g = new Group();
  const store = facade(t, { wall: C.cream, glass: "#FFE6AA", style: "storefront", lit: 1, seed: 241, frame: C.tealLight }, 1.5);
  g.add(at(facadeBox(22, 5, 12, store, solid(C.cream)), 0, 2.5, 0));
  // The upswept roof: a tilted slab rising to the front.
  const roof = new Mesh(new BoxGeometry(26, 0.8, 16), solid(C.tealLight));
  roof.rotation.x = -0.18;
  g.add(at(roof, 0, 6.4, 1));
  g.add(at(new Mesh(new BoxGeometry(26.4, 0.4, 0.4), glowing(t, C.pink, C.pink, 2.4, 0.3)), 0, 7.8, 9));
  // The spoon: a tilted bowl and handle on a pole, outlined in neon.
  const spoon = at(new Group(), 9, 13, 4);
  const neon = glowing(t, "#D7E1E7", C.tealLight, 2.6, 0.3);
  const bowl = new Mesh(new SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), neon);
  bowl.scale.set(1, 0.35, 1.4);
  bowl.rotation.x = Math.PI / 2;
  spoon.add(at(bowl, 0, 3.5, 0));
  spoon.add(at(new Mesh(new BoxGeometry(0.6, 6, 0.3), neon), 0, -0.5, 0));
  spoon.rotation.z = -0.35;
  g.add(spoon);
  g.add(at(new Mesh(new CylinderGeometry(0.2, 0.25, 9, 6), solid(C.steel)), 9, 4.5, 4));
  g.add(at(sign(t, "THE NEON SPOON", 12, 1.6, { bg: C.ink, fg: C.pink }, 2.4), -2, 6, 7.6));
  // Starburst lamps along the front.
  for (const x of [-9, -3, 3]) g.add(at(new Mesh(new IcosahedronGeometry(0.6, 0), glowing(t, C.amber, C.amber, 2.4, 0.2)), x, 5.8, 7.4));
  g.add(at(lightPool(t, 12, C.tealLight, 0.5), 0, 0, 9));
  return g;
}

// ---------------------------------------------------------------------------
// The Hub (owner, Oct 16: "an unusual, futuristic design"): four glass rings, one per floor, stacked
// off-center and each tilted its own way around a lit core, neon on every rim, a halo and a spire on top
// ---------------------------------------------------------------------------
function hub(t: Themed): Group {
  const g = new Group();
  g.add(at(new Mesh(new CylinderGeometry(17, 17.5, 0.6, 32), solid("#D9E6EA")), 0, 0.3, 0));
  g.add(at(new Mesh(new CylinderGeometry(4.6, 5.2, 40, 16), glowing(t, "#9FE3EC", C.tealLight, 1.8, 0.45)), 0, 20, 0));
  // Slanted legs carry the first ring.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = new Mesh(new CylinderGeometry(0.5, 0.7, 9, 6), solid(C.steelLight, { metal: 0.4, rough: 0.4 }));
    leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(at(leg, Math.cos(a) * 9, 4.2, Math.sin(a) * 9));
  }
  const floors = [
    { y: 7, r: 13, h: 4.5, dx: 0, dz: 1.2, tilt: [0.05, -0.04], rim: C.pink, glass: "#E9F7FA" },
    { y: 15.5, r: 11, h: 4, dx: 1.6, dz: -0.6, tilt: [-0.07, 0.05], rim: C.tealLight, glass: "#DDF2F7" },
    { y: 23.5, r: 12.5, h: 4, dx: -1.4, dz: 0.4, tilt: [0.06, 0.07], rim: C.amber, glass: "#F2F0FA" },
    { y: 31.5, r: 9.5, h: 3.6, dx: 0.6, dz: 0.8, tilt: [-0.04, -0.08], rim: C.coral, glass: "#E9F7FA" },
  ];
  for (const f of floors) {
    const ring = new Group();
    ring.add(new Mesh(new CylinderGeometry(f.r, f.r * 0.92, f.h, 28), glowing(t, f.glass, "#FFE6AA", 1.4, 0.12)));
    ring.add(at(new Mesh(new CylinderGeometry(f.r + 0.4, f.r + 0.4, 0.5, 28), solid(C.steelLight, { metal: 0.3, rough: 0.35 })), 0, f.h / 2, 0));
    ring.add(at(new Mesh(new CylinderGeometry(f.r * 0.92 + 0.3, f.r * 0.92 + 0.3, 0.4, 28), solid(C.steel, { metal: 0.3, rough: 0.4 })), 0, -f.h / 2, 0));
    const rim = new Mesh(new TorusGeometry(f.r + 0.35, 0.28, 6, 40), glowing(t, f.rim, f.rim, 2.6, 0.6));
    rim.rotation.x = Math.PI / 2;
    ring.add(at(rim, 0, f.h / 2 + 0.1, 0));
    ring.rotation.set(f.tilt[0], 0, f.tilt[1]);
    g.add(at(ring, f.dx, f.y, f.dz));
  }
  // The halo and the spire.
  const halo = new Mesh(new TorusGeometry(6.5, 0.35, 6, 40), glowing(t, C.pink, C.pink, 2.8, 0.7));
  halo.rotation.set(Math.PI / 2 + 0.35, 0.2, 0);
  g.add(at(halo, 0, 39, 0));
  g.add(at(new Mesh(new ConeGeometry(1.2, 10, 8), solid(C.steelLight, { metal: 0.5, rough: 0.3 })), 0, 45, 0));
  g.add(at(new Mesh(new SphereGeometry(0.9, 10, 8), glowing(t, C.pink, C.pink, 3, 1)), 0, 50.5, 0));
  g.add(at(sign(t, "THE HUB", 12, 2.4, { bg: C.ink, fg: C.tealLight }, 2.6), 0, 7.4, 14.2));
  g.add(at(lightPool(t, 20, C.tealLight, 0.5), 0, 0, 4));
  return g;
}

// ---------------------------------------------------------------------------
// Up on Thirty: a slender thirty-floor tower crowned by a glass dining room and a lit "30"
// ---------------------------------------------------------------------------
function skyDining(t: Themed): Group {
  const g = new Group();
  const tower = facade(t, { wall: "#C9B79C", glass: "#4E6B7A", style: "punched", lit: 0.75, seed: 251, frame: C.cream });
  g.add(at(litBox(t, 16, 96, 16, tower, solid("#8FA4B8"), C.amber, 0.35), 0, 48, 0));
  // The dining room on top, cantilevered over the street side, all glass and warm light.
  g.add(at(new Mesh(new BoxGeometry(20, 6, 20), glowing(t, "#BFE6F7", C.amber, 1.6, 0.1)), 0, 99, 2));
  g.add(at(new Mesh(new BoxGeometry(21, 0.8, 21), solid(C.ink)), 0, 102.4, 2));
  g.add(at(new Mesh(new BoxGeometry(21, 0.6, 21), solid(C.ink)), 0, 95.7, 2));
  const bulb = glowing(t, C.cream, "#FFE27A", 2.4, 0);
  const bulbGeo = new SphereGeometry(0.3, 5, 4);
  for (let i = 0; i < 16; i++) g.add(at(new Mesh(bulbGeo, bulb), -10 + i * 1.33, 103.2, 12.6));
  g.add(at(sign(t, "30", 6, 5, { bg: C.ink, fg: C.amber }, 2.8), 0, 107, 2));
  g.add(at(sign(t, "UP ON THIRTY", 12, 1.6, { bg: C.ink, fg: C.amber }, 2), 0, 4, 8.2));
  g.add(at(lightPool(t, 14, C.amber, 0.45), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Steinway Fresh Mart: a wide supermarket, a green sign, produce stands, carts and a small lot
// ---------------------------------------------------------------------------
function supermarket(t: Themed): Group {
  const g = new Group();
  const store = facade(t, { wall: "#F4F1EA", glass: "#FFF3DE", style: "storefront", lit: 1, seed: 261, frame: "#2E7D4F" }, 1.4);
  g.add(at(litBox(t, 40, 8, 26, store, solid("#B9C6CF"), C.amber, 0.4), 0, 4, -4));
  g.add(at(new Mesh(new BoxGeometry(42, 2.4, 1.2), solid("#2E7D4F")), 0, 7.4, 9.3));
  g.add(at(sign(t, "STEINWAY FRESH MART", 26, 2, { bg: "#2E7D4F", fg: C.cream }, 2), 0, 7.4, 10));
  // Produce stands under a canopy.
  g.add(at(new Mesh(new BoxGeometry(16, 0.3, 3.4), solid("#2E7D4F")), -10, 4, 11));
  const fruit = [C.coral, C.amber, "#5FA36B", "#C8352B", "#F2C14E"];
  for (let i = 0; i < 5; i++) {
    g.add(at(new Mesh(new BoxGeometry(2.6, 0.9, 1.6), solid("#8B5E3C")), -16 + i * 3, 0.45, 11));
    g.add(at(new Mesh(new BoxGeometry(2.4, 0.4, 1.4), solid(fruit[i])), -16 + i * 3, 1.1, 11));
  }
  // Cart corral and the lot.
  for (let i = 0; i < 4; i++) g.add(at(new Mesh(new BoxGeometry(0.8, 0.9, 1.4), solid(C.steel)), 8 + i * 0.5, 0.6, 12));
  parkingLot(g, 0, 22, 40, 14);
  g.add(at(lightPool(t, 20, C.amber, 0.4), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Triborough Works: a converted brick factory: big arched windows, a rooftop greenhouse, a chimney
// ---------------------------------------------------------------------------
function cowork(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: "#9E4A38", glass: "#BFE6F7", style: "industrial", lit: 0.85, seed: 271 }, 1.3);
  g.add(at(litBox(t, 36, 16, 20, brick, solid("#5E2A22"), C.amber, 0.45), 0, 8, 0));
  // Tall arched factory windows along the front.
  const win = glowing(t, "#4E6B7A", "#FFD58A", 1.8, 0);
  for (let i = 0; i < 5; i++) {
    const x = -14 + i * 7;
    g.add(at(new Mesh(new BoxGeometry(4.4, 8, 0.3), win), x, 7, 10.05));
    const top = new Mesh(new CylinderGeometry(2.2, 2.2, 0.3, 12, 1, false, 0, Math.PI), win);
    top.rotation.x = Math.PI / 2;
    top.rotation.z = Math.PI / 2;
    g.add(at(top, x, 11, 10.05));
  }
  // Rooftop greenhouse and the old chimney.
  g.add(at(new Mesh(new BoxGeometry(14, 4, 9), glowing(t, "#CFEFD8", "#9FE3A0", 1.2, 0.1)), -8, 18, -3));
  g.add(at(gable(14.4, 2.4, 9.4, glowing(t, "#CFEFD8", "#9FE3A0", 1.2, 0.1)), -8, 20, -3));
  g.add(at(new Mesh(new CylinderGeometry(1.4, 1.8, 14, 8), solid("#8E3B2E")), 12, 23, -5));
  g.add(at(sign(t, "TRIBOROUGH WORKS", 20, 2, { bg: C.cream, fg: "#9E4A38" }, 1.8), 0, 14.6, 10.2));
  // Bike racks out front.
  for (let i = 0; i < 6; i++) g.add(at(new Mesh(new TorusGeometry(0.5, 0.08, 4, 10, Math.PI), solid(C.steel)), -6 + i * 1.6, 0.5, 13));
  g.add(at(lightPool(t, 14, C.amber, 0.45), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// The 114½ Precinct: a stone station house, green lamps by the door, a flag, patrol cars
// ---------------------------------------------------------------------------
function precinct(t: Themed): Group {
  const g = new Group();
  const stone = facade(t, { wall: "#D9CFC0", glass: "#4E6B7A", style: "punched", lit: 0.75, seed: 281, frame: "#8FA4B8" });
  g.add(at(litBox(t, 18, 13, 16, stone, solid("#5E7B8C"), C.amber, 0.45), 0, 6.5, 0));
  g.add(at(new Mesh(new BoxGeometry(18.6, 1, 16.6), solid(C.cream)), 0, 13.5, 0));
  for (let i = 0; i < 3; i++) g.add(at(new Mesh(new BoxGeometry(6 - i, 0.4, 1.2), solid(C.stoneDark)), 0, 0.2 + i * 0.4, 8.6 - i * 0.4));
  g.add(at(new Mesh(new BoxGeometry(3, 4.4, 0.3), solid("#2F4A63")), 0, 2.4, 8.05));
  // The green lamps either side of the door, as every station house has.
  const green = glowing(t, "#4E9A5E", "#7CFF9A", 2.8, 0.4);
  for (const x of [-2.6, 2.6]) {
    g.add(at(new Mesh(new CylinderGeometry(0.08, 0.08, 1, 5), solid(C.ink)), x, 4.6, 8.3));
    g.add(at(new Mesh(new SphereGeometry(0.45, 8, 6), green), x, 4.1, 8.5));
  }
  g.add(at(sign(t, "114½ PRECINCT", 12, 1.4, { bg: C.cream, fg: "#2F4A63" }, 1.6), 0, 10.5, 8.2));
  // Flag on the roof and two patrol cars out front.
  g.add(at(new Mesh(new CylinderGeometry(0.12, 0.15, 6, 5), solid(C.steel)), -7, 17, 6));
  g.add(at(new Mesh(new BoxGeometry(2.6, 1.6, 0.08), solid("#2F5DA8")), -5.6, 19, 6));
  for (const x of [-5, 5]) {
    const car = parkedCar("#F4F1EA");
    car.rotation.y = Math.PI / 2;
    car.add(at(new Mesh(new BoxGeometry(1.6, 0.3, 0.5), glowing(t, "#2F5DA8", "#4D7BFF", 3, 0.4)), 0, 1.8, 0));
    car.add(at(new Mesh(new BoxGeometry(1.95, 0.25, 4.45), solid("#2F5DA8")), 0, 0.75, 0));
    g.add(at(car, x, 0, 12));
  }
  g.add(at(lightPool(t, 10, "#7CFF9A", 0.35), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Harmony Community Chapel: a small white clapboard chapel with a bell tower and a garden
// ---------------------------------------------------------------------------
function chapel(t: Themed): Group {
  const g = new Group();
  const white = glowing(t, "#F4F1EA", C.amber, 0.3, 0);
  const roof = solid("#2F8F8A");
  g.add(at(new Mesh(new BoxGeometry(9, 7, 16), white), 0, 3.5, -2));
  g.add(at(gable(9.6, 4.5, 16.6, roof), 0, 7, -2));
  g.add(at(new Mesh(new BoxGeometry(4.5, 12, 4.5), white), 0, 6, 7));
  g.add(at(new Mesh(new ConeGeometry(3.4, 6, 4).rotateY(Math.PI / 4), roof), 0, 15, 7));
  g.add(at(new Mesh(new SphereGeometry(0.7, 8, 6), glowing(t, "#C9A26B", C.amber, 1.6, 0)), 0, 10, 7));
  const glass = [C.coral, C.sky, C.amber];
  for (const x of [-4.55, 4.55]) for (let i = 0; i < 3; i++) g.add(at(new Mesh(new BoxGeometry(0.2, 3, 1.4), glowing(t, "#3A4A5A", glass[i], 1.8, 0)), x, 3.6, -7 + i * 5));
  g.add(at(new Mesh(new BoxGeometry(2, 3.4, 0.3), solid("#8B5E3C")), 0, 1.7, 9.3));
  // Garden: hedges and flower beds.
  for (const x of [-7, 7]) {
    g.add(at(new Mesh(new BoxGeometry(2, 1, 14), solid("#4E8F5A")), x, 0.5, 0));
    g.add(at(new Mesh(new BoxGeometry(1.6, 0.4, 3), solid(C.pink)), x, 1.2, 8));
  }
  g.add(at(sign(t, "HARMONY CHAPEL", 7, 0.9, { bg: C.cream, fg: "#2F8F8A" }, 1.4), 0, 4.6, 9.3));
  g.add(at(lightPool(t, 9, C.amber, 0.5), 0, 0, 9));
  return g;
}

// ---------------------------------------------------------------------------
// Rep Count Fitness: a corner gym with a glass front, a big digital rep counter and a rooftop yoga deck
// ---------------------------------------------------------------------------
function fitness(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#3B3A44", glass: "#BFE6F7", style: "storefront", lit: 1, seed: 291, frame: C.coral }, 1.4);
  g.add(at(litBox(t, 18, 9, 16, glass, solid("#55545E"), C.coral, 0.5), 0, 4.5, 0));
  // The rep counter: a lit digital display on the corner.
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const x = c.getContext("2d")!;
  x.fillStyle = "#14111A";
  x.fillRect(0, 0, 256, 96);
  x.fillStyle = "#FF5A3C";
  x.font = "900 72px ui-monospace, monospace";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("0 9 8", 128, 52);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const screen = new MeshStandardMaterial({ map: tex, emissive: "#FFFFFF", emissiveMap: tex, emissiveIntensity: 0.4 });
  t.glows.push({ mat: screen, day: 0.4, night: 1.8 });
  g.add(at(new Mesh(new PlaneGeometry(8, 3), screen), 0, 7.4, 8.1));
  // Rooftop yoga deck with mats and planters.
  g.add(at(new Mesh(new BoxGeometry(14, 0.3, 12), solid("#C9A27A")), 0, 9.2, 0));
  for (let i = 0; i < 4; i++) g.add(at(new Mesh(new BoxGeometry(1.2, 0.1, 3), solid([C.coral, C.tealLight, C.amber, C.sky][i])), -4.5 + i * 3, 9.4, 0));
  for (const x2 of [-6, 6]) g.add(at(new Mesh(new SphereGeometry(1, 6, 4), solid("#4E8F5A")), x2, 10.2, -5));
  g.add(at(sign(t, "REP COUNT", 8, 1.2, { bg: C.ink, fg: C.coral }, 2.2), 0, 5.4, 8.2));
  g.add(at(lightPool(t, 10, C.coral, 0.45), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Hell Gate Park: the great steel arch of the rail bridge rising over the park, its stone towers,
// lawns and a running track
// ---------------------------------------------------------------------------
function hellGate(t: Themed): Group {
  const g = new Group();
  const stone = glowing(t, "#C9B79C", C.amber, 0.35, 0);
  const steel = glowing(t, "#B33A3A", "#FF7A5A", 0.5, 0);
  // Lawns and a track.
  g.add(at(new Mesh(new CylinderGeometry(70, 70, 0.2, 40), solid("#7CBF7A")), 0, 0.1, 0));
  const track = new Mesh(new CylinderGeometry(20, 20, 0.3, 32), solid(C.coral));
  track.scale.set(1.6, 1, 1);
  g.add(at(track, -26, 0.2, 30));
  const pitch = new Mesh(new CylinderGeometry(15, 15, 0.35, 32), solid("#5FA36B"));
  pitch.scale.set(1.6, 1, 1);
  g.add(at(pitch, -26, 0.25, 30));
  // Two stone towers and the arch between them (the arch's half reaching over the park).
  for (const x of [-40, 40]) {
    g.add(at(new Mesh(new BoxGeometry(12, 40, 14), stone), x, 20, -20));
    g.add(at(new Mesh(new BoxGeometry(14, 3, 16), stone), x, 41.5, -20));
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    pts.push([-34 + (i / 16) * 68, 30 + Math.sin(a) * 26]);
  }
  for (const z of [-26, -14]) {
    for (let i = 1; i < pts.length; i++) g.add(strut([pts[i - 1][0], pts[i - 1][1], z], [pts[i][0], pts[i][1], z], 2.4, steel));
    g.add(strut([-34, 34, z], [34, 34, z], 1.8, steel));
    for (let i = 1; i < pts.length - 1; i += 2) g.add(strut([pts[i][0], 34, z], [pts[i][0], pts[i][1], z], 0.8, steel));
  }
  g.add(at(new Mesh(new BoxGeometry(70, 1.2, 14), solid(C.stoneDark)), 0, 34, -20));
  // Lamps along the paths.
  lampRow(t, g, -50, 10, 50, 10, 6);
  g.add(at(lightPool(t, 40, "#FF7A5A", 0.3), 0, 0.3, -20));
  return g;
}

// ---------------------------------------------------------------------------
// Astoria Blvd station: the elevated platform over the avenue: steel columns, a canopy, stairs,
// and a train waiting at the platform
// ---------------------------------------------------------------------------
function elStation(t: Themed): Group {
  const g = new Group();
  const steel = solid("#2F6B5A");
  const len = 90;
  // Columns along the curbs, girders and the deck: as wide as the street, no wider (owner, Oct 16:
  // "clashing with other structures").
  for (let x = -len / 2; x <= len / 2; x += 10) for (const z of [-7, 7]) g.add(at(new Mesh(new BoxGeometry(0.9, 9, 0.9), steel), x, 4.5, z));
  for (const z of [-7, 7]) g.add(at(new Mesh(new BoxGeometry(len + 2, 1.2, 1), steel), 0, 9.2, z));
  g.add(at(new Mesh(new BoxGeometry(len, 0.8, 16), solid("#6B6570")), 0, 10.2, 0));
  // Platform canopies, lit underneath at night.
  for (const z of [-5, 5]) {
    g.add(at(new Mesh(new BoxGeometry(len - 10, 0.4, 5), solid("#2F6B5A")), 0, 14.4, z));
    for (let x = -len / 2 + 8; x <= len / 2 - 8; x += 12) g.add(at(new Mesh(new BoxGeometry(0.4, 3.8, 0.4), steel), x, 12.5, z));
    g.add(at(new Mesh(new BoxGeometry(len - 12, 0.2, 4), glowing(t, "#D7E1E7", "#FFE6AA", 1.6, 0)), 0, 14.1, z));
  }
  // A train at the platform, windows lit at night.
  const car = solid("#B9C6CF", { metal: 0.3, rough: 0.4 });
  for (let i = 0; i < 4; i++) {
    g.add(at(new Mesh(new BoxGeometry(18, 3.4, 3), car), -27 + i * 18.4, 12.5, 0));
    g.add(at(new Mesh(new BoxGeometry(16, 1, 3.05), glowing(t, "#3A4A5A", "#FFE6AA", 1.4, 0)), -27 + i * 18.4, 13, 0));
    g.add(at(new Mesh(new BoxGeometry(18.05, 0.4, 3.05), solid("#F2C14E")), -27 + i * 18.4, 11.4, 0));
  }
  // Stairs down to the sidewalks, running along the street beside the deck, and the station sign.
  for (const [x, z] of [[-34, 9.5], [34, -9.5]] as const) {
    const stair = new Mesh(new BoxGeometry(14, 0.6, 2.6), steel);
    stair.rotation.z = x > 0 ? 0.62 : -0.62;
    g.add(at(stair, x, 5, z));
  }
  g.add(at(sign(t, "ASTORIA BLVD", 12, 1.4, { bg: "#14111A", fg: C.cream }, 1.6), 0, 16, 7.6));
  g.add(at(lightPool(t, 30, "#FFE6AA", 0.35), 0, 0.2, 0));
  return g;
}

// ---------------------------------------------------------------------------
// Real Clout FM (v0.14 On Air): a three-storey studio with a lit ON AIR sign and the station name, a
// lattice broadcast mast on the roof with red beacons, and a satellite dish
// ---------------------------------------------------------------------------
function radioStation(t: Themed): Group {
  const g = new Group();
  const front = facade(t, { wall: "#2E6F7E", glass: "#FFE2B8", style: "punched", lit: 0.85, seed: 331, frame: "#1E3A44" });
  g.add(at(litBox(t, 18, 12, 14, front, solid("#3D5C66"), C.amber, 0.45), 0, 6, 0));
  // The station's name across the top, and the ON AIR box over the door (red at night).
  g.add(at(sign(t, "REAL CLOUT FM 88.8", 14, 1.6, { bg: "#F4F1EA", fg: "#C8352B" }, 1.6), 0, 10.6, 7.1));
  g.add(at(sign(t, "ON AIR", 4.4, 1.3, { bg: "#C8352B", fg: "#FFF3DE" }, 2.4), 0, 4.2, 7.1));
  g.add(at(new Mesh(new BoxGeometry(3, 3.2, 0.3), solid("#1E3A44")), 0, 1.6, 7.05));
  // The mast: four legs tapering to a point, cross-braced, with beacons up its height.
  const steel = solid("#C8352B", { metal: 0.4, rough: 0.5 });
  const white = solid("#F4F1EA", { metal: 0.4, rough: 0.5 });
  const base = 12, top = 46, half0 = 2.2, half1 = 0.3;
  const corner = (y: number, sx: number, sz: number): [number, number, number] => {
    const k = (y - base) / (top - base);
    const h = half0 + (half1 - half0) * k;
    return [-4 + sx * h, y, -2 + sz * h];
  };
  const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) g.add(strut(corner(base, sx, sz), corner(top, sx, sz), 0.35, steel));
  for (let y = base, i = 0; y < top - 3; y += 5, i++) {
    const m = i % 2 ? white : steel;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4];
      g.add(strut(corner(y, ax, az), corner(y + 5, bx, bz), 0.14, m));
      g.add(strut(corner(y, ax, az), corner(y, bx, bz), 0.16, m));
    }
  }
  g.add(at(new Mesh(new CylinderGeometry(0.12, 0.12, 6, 6), white), -4, top + 3, -2));
  const beacon = glowing(t, "#B3202C", "#FF2D3D", 2.6, 0.4);
  for (const y of [24, 36, top + 6]) g.add(at(new Mesh(new SphereGeometry(0.45, 8, 6), beacon), -4, y, -2));
  // A dish on the roof, tilted at the sky.
  const dish = new Mesh(new SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), solid("#F4F1EA", { rough: 0.4 }));
  dish.material.side = DoubleSide;
  dish.rotation.set(-0.9, 0.6, 0);
  g.add(at(dish, 5, 13.4, 0));
  g.add(at(new Mesh(new CylinderGeometry(0.2, 0.3, 1.6, 6), solid("#55545E")), 5, 12.8, 0));
  g.add(at(lightPool(t, 10, C.amber, 0.45), 0, 0, 9));
  return g;
}

// ---------------------------------------------------------------------------
// The Clout Tower (v0.14 On Air): a Times Square-style tower in Astoria. Its big screen shows Clout TV's
// featured photo (paintBigScreen), with LED bands and a lit crown; the screen glows hard at night.
// ---------------------------------------------------------------------------
const BIG_SCREEN = { w: 512, h: 640 };
let bigScreenTex: CanvasTexture | null = null;

/** Draws the big screen: the featured photo with its @handle, or the station's ident when there's none. */
export function paintBigScreen(img: CanvasImageSource & { width: number; height: number } | null, handle?: string) {
  const tex = bigScreenTex;
  if (!tex) return;
  const c = tex.image as HTMLCanvasElement;
  const x = c.getContext("2d")!;
  const { w, h } = BIG_SCREEN;
  x.fillStyle = "#14111A";
  x.fillRect(0, 0, w, h);
  if (img && img.width && img.height) {
    // Cover the screen, centered.
    const k = Math.max(w / img.width, h / img.height);
    const dw = img.width * k, dh = img.height * k;
    x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const g = x.createLinearGradient(0, h - 170, 0, h);
    g.addColorStop(0, "rgba(20,17,26,0)");
    g.addColorStop(1, "rgba(20,17,26,.85)");
    x.fillStyle = g;
    x.fillRect(0, h - 170, w, 170);
    x.fillStyle = "#F2A07B";
    x.font = "800 30px system-ui, sans-serif";
    x.fillText("CLOUT TV", 28, h - 86);
    x.fillStyle = "#FFFFFF";
    x.font = "800 46px system-ui, sans-serif";
    x.fillText(handle ? `@${handle}`.slice(0, 18) : "", 28, h - 34);
  } else {
    // Nobody on the screen (owner, Oct 16): "Make it BIG in NY".
    const g = x.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, w * 0.85);
    g.addColorStop(0, "#3A1F3A");
    g.addColorStop(1, "#14111A");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.textAlign = "center";
    x.fillStyle = "#FFFFFF";
    x.font = "800 64px system-ui, sans-serif";
    x.fillText("Make it", w / 2, h * 0.3);
    x.save();
    x.translate(w / 2, h * 0.56);
    x.rotate(-0.04);
    x.fillStyle = "#B8410F";
    x.font = "900 196px system-ui, sans-serif";
    x.fillText("BIG", 0, 8);
    x.fillStyle = "#FFC21A";
    x.fillText("BIG", 0, 0);
    x.restore();
    x.fillStyle = "#FFFFFF";
    x.font = "800 64px system-ui, sans-serif";
    x.fillText("in NY", w / 2, h * 0.73);
    x.fillStyle = "#FA2D48";
    x.font = "800 30px system-ui, sans-serif";
    x.fillText("CLOUT TV", w / 2, h * 0.9);
    x.textAlign = "start";
  }
  tex.needsUpdate = true;
}

function cloutTower(t: Themed): Group {
  const g = new Group();
  // The podium: shops along the street, lit windows.
  const shops = facade(t, { wall: "#3D5C66", glass: "#FFE2B8", style: "storefront", lit: 1, seed: 341, frame: C.coral }, 1.4);
  g.add(at(litBox(t, 28, 9, 22, shops, solid("#4A6A74"), C.amber, 0.55), 0, 4.5, 0));
  // The shaft, glass all the way up.
  const glass = facade(t, { wall: "#2E6F7E", glass: "#BFE6F7", style: "curtain", lit: 0.75, seed: 343, frame: "#1E3A44" });
  g.add(at(litBox(t, 18, 62, 16, glass, solid("#2E4A55"), C.sky, 0.4), 0, 9 + 31, -1));
  // The big screen on the front, in a dark frame.
  const c = document.createElement("canvas");
  c.width = BIG_SCREEN.w;
  c.height = BIG_SCREEN.h;
  bigScreenTex = new CanvasTexture(c);
  bigScreenTex.colorSpace = SRGBColorSpace;
  paintBigScreen(null);
  const screen = new MeshStandardMaterial({ map: bigScreenTex, emissive: "#FFFFFF", emissiveMap: bigScreenTex, emissiveIntensity: 0.55, roughness: 0.6 });
  t.glows.push({ mat: screen, day: 0.55, night: 1.25 });
  g.add(at(new Mesh(new BoxGeometry(18, 23, 0.8), solid("#14111A")), 0, 33, 7.2));
  g.add(at(new Mesh(new PlaneGeometry(16, 20), screen), 0, 33, 7.65));
  // LED bands wrapping the tower above and below the screen.
  const coral = glowing(t, "#F2A07B", "#FF8A5C", 1.8, 0.35);
  const teal = glowing(t, "#7FE3F0", "#7FE3F0", 1.6, 0.3);
  g.add(at(new Mesh(new BoxGeometry(18.6, 2, 16.6), coral), 0, 19, -1));
  g.add(at(new Mesh(new BoxGeometry(18.6, 1.2, 16.6), teal), 0, 47, -1));
  g.add(at(new Mesh(new BoxGeometry(28.6, 1.4, 22.6), teal), 0, 9.6, 0));
  // The crown: the station's name and a lit spire.
  g.add(at(sign(t, "CLOUT TV", 14, 3, { bg: "#14111A", fg: "#F2A07B" }, 2.2), 0, 67, 7.1));
  g.add(at(new Mesh(new BoxGeometry(14.5, 3.6, 14.5), solid("#1E3A44")), 0, 67, -1));
  g.add(at(new Mesh(new CylinderGeometry(0.25, 0.6, 12, 8), solid("#F4F1EA", { metal: 0.5, rough: 0.4 })), 0, 75, -1));
  g.add(at(new Mesh(new SphereGeometry(0.8, 10, 8), glowing(t, "#FFE6AA", "#FFE6AA", 2.6, 0.6)), 0, 81.5, -1));
  g.add(at(lightPool(t, 14, "#7FE3F0", 0.4), 0, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Skyline Pier Residences: three stepped glass towers by the water with balconies and a lit crown
// ---------------------------------------------------------------------------
function condoTowers(t: Themed): Group {
  const g = new Group();
  const glass = facade(t, { wall: "#9ED8F7", glass: "#E8F6FF", style: "curtain", lit: 0.8, seed: 301, frame: "#5E8FA6" });
  const glass2 = facade(t, { wall: "#BFE6F7", glass: "#F4FBFF", style: "curtain", lit: 0.75, seed: 303, frame: "#6FA0B6" });
  g.add(at(litBox(t, 46, 8, 24, facade(t, { wall: C.cream, glass: "#F2C7A0", style: "storefront", lit: 0.9, seed: 305, frame: C.stoneDark }), solid("#C9B79C"), C.amber, 0.5), 0, 4, 0));
  for (const [x, h, m] of [[-14, 76, glass], [2, 62, glass2], [16, 48, glass]] as const) {
    g.add(at(litBox(t, 13, h, 13, m, solid("#8FA4B8"), C.sky, 0.4), x, 8 + h / 2, -2));
    // Balconies every few floors on the front.
    for (let y = 14; y < 8 + h; y += 8) g.add(at(new Mesh(new BoxGeometry(13.6, 0.4, 1.6), solid("#F4FBFF")), x, y, 5));
    g.add(at(new Mesh(new BoxGeometry(13.4, 1, 13.4), glowing(t, C.cream, C.sky, 1.6, 0)), x, 8 + h + 0.5, -2));
  }
  g.add(at(sign(t, "SKYLINE PIER", 14, 1.6, { bg: C.ink, fg: C.sky }, 1.8), 0, 6.4, 12.2));
  g.add(at(lightPool(t, 22, C.sky, 0.35), 0, 0, 10));
  return g;
}

// ---------------------------------------------------------------------------
// Hunter's Pier: a waterfront park: a cantilevered overlook, wavy lawns, a kayak launch, benches
// ---------------------------------------------------------------------------
function pierPark(t: Themed): Group {
  const g = new Group();
  const deck = solid("#B59E80");
  // The overlook: a long deck reaching out over the water (toward +z), on slim legs, rail lit at night.
  const over = new Mesh(new BoxGeometry(10, 0.8, 34), deck);
  over.rotation.x = -0.08;
  g.add(at(over, 0, 3.2, 22));
  for (const z of [10, 24, 36]) for (const x of [-4, 4]) g.add(at(new Mesh(new CylinderGeometry(0.25, 0.25, 4, 5), solid(C.steel)), x, 1.5, z));
  for (const x of [-5, 5]) g.add(at(new Mesh(new BoxGeometry(0.2, 0.2, 34), glowing(t, C.cream, "#FFE6AA", 2.2, 0)), x, 4.4, 22));
  // Wavy lawns: low mounds.
  const grass = solid("#7CBF7A");
  for (const [x, z, r] of [[-16, -8, 10], [14, -12, 12], [-4, -22, 9]] as const) {
    const mound = new Mesh(new SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), grass);
    mound.scale.set(1.4, 0.18, 1);
    g.add(at(mound, x, 0, z));
  }
  // Kayak launch and kayaks.
  g.add(at(new Mesh(new BoxGeometry(8, 0.4, 6), deck), 18, 0.4, 8));
  for (const [x, c] of [[16, C.coral], [18.5, C.amber], [21, C.tealLight]] as const) g.add(at(new Mesh(new CapsuleGeometry(0.4, 3.2, 3, 6).rotateX(Math.PI / 2), solid(c)), x, 0.9, 9));
  // Benches and lamps.
  for (const x of [-10, -4, 4, 10]) g.add(at(new Mesh(new BoxGeometry(2.4, 0.5, 0.8), solid("#8B5E3C")), x, 0.5, 2));
  lampRow(t, g, -18, 4, 18, 4, 4);
  treeRing(g, 30, 10);
  return g;
}


// ---------------------------------------------------------------------------
// St. Copay's General Hospital (owner, Oct 17): a white block with blue glass, a red cross on top
// and an ambulance bay out front
// ---------------------------------------------------------------------------
function hospital(t: Themed): Group {
  const g = new Group();
  const wing = facade(t, { wall: "#F4F7FA", glass: "#8FC7E8", style: "punched", lit: 0.9, seed: 211, frame: "#C9D6E2" });
  const tower = facade(t, { wall: "#EAF1F7", glass: "#5FB3D9", style: "curtain", lit: 1, seed: 213, frame: "#F4F7FA" }, 1.3);
  g.add(at(facadeBox(26, 9, 16, wing, solid("#D5DEE6")), 0, 4.5, 0));
  g.add(at(facadeBox(13, 22, 13, tower, solid("#D5DEE6")), -4, 11, -1));
  g.add(at(nightGlow(t, 13, 22, 13, "#9FD8FF", 0.45), -4, 11, -1));
  // The red cross on the roof, lit at night.
  const red = glowing(t, "#E5484D", "#FF5A5F", 1.6, 0.3);
  g.add(at(new Mesh(new BoxGeometry(7, 1.8, 1), red), -4, 24.5, 4.6));
  g.add(at(new Mesh(new BoxGeometry(1.8, 7, 1), red), -4, 24.5, 4.6));
  // The ambulance bay: a canopy on posts and a red EMERGENCY sign.
  g.add(at(new Mesh(new BoxGeometry(10, 0.6, 5), solid("#2B6CB0")), 7, 4.2, 10.2));
  for (const x of [2.6, 11.4]) g.add(at(new Mesh(new BoxGeometry(0.4, 4, 0.4), solid(C.steel)), x, 2, 12.4));
  g.add(at(sign(t, "EMERGENCY", 8, 1.3, { bg: "#E5484D", fg: "#FFFFFF" }, 2), 7, 5.3, 12.8));
  g.add(at(sign(t, "ST. COPAY'S", 10, 1.4, { bg: "#1E3A5F", fg: "#FFFFFF" }, 1.6), -4, 21, 5.6));
  g.add(at(lightPool(t, 10, "#9FD8FF", 0.45), 7, 0, 12));
  return g;
}

// ---------------------------------------------------------------------------
// Brownstone Sessions (owner, Oct 17): a Fort Greene brownstone with a stoop, warm basement windows
// and a neon horn over the door
// ---------------------------------------------------------------------------
function brownstone(t: Themed): Group {
  const g = new Group();
  const stone = facade(t, { wall: "#8A4B32", glass: "#FFD9A0", style: "punched", lit: 1, seed: 221, frame: "#E8D3BF" }, 1.4);
  g.add(at(facadeBox(9, 15, 12, stone, solid("#5A3020")), 0, 7.5, 0));
  g.add(at(nightGlow(t, 9, 15, 12, C.amber, 0.6), 0, 7.5, 0));
  g.add(at(new Mesh(new BoxGeometry(9.6, 0.8, 12.6), solid("#3A2418")), 0, 15.4, 0));
  // The stoop: steps up to the parlor door, iron rails.
  for (let i = 0; i < 5; i++) g.add(at(new Mesh(new BoxGeometry(3, 0.6, 1), solid("#9A5A3C")), 1.5, 0.3 + i * 0.6, 9.4 - i * 0.7));
  for (const x of [-0.1, 3.1]) g.add(at(new Mesh(new BoxGeometry(0.15, 2.4, 3.6), solid(C.ink)), x, 2.2, 8.2));
  // The basement windows glow; a neon saxophone over the club door.
  const warm = glowing(t, "#FFB347", "#FFB347", 1.4, 0.35);
  g.add(at(new Mesh(new BoxGeometry(3, 1.2, 0.2), warm), -2.4, 0.9, 6.1));
  const horn = glowing(t, "#FF6A3D", "#FF6A3D", 2.2, 0.4);
  const bell = new Mesh(new ConeGeometry(0.9, 1.6, 16, 1, true), horn);
  bell.rotation.z = Math.PI / 2.4;
  g.add(at(bell, -2, 5.4, 6.4));
  g.add(at(new Mesh(new TorusGeometry(1.1, 0.18, 8, 16, Math.PI), horn), -3.2, 4.6, 6.4));
  g.add(at(sign(t, "BROWNSTONE SESSIONS", 8, 1.1, { bg: C.ink, fg: C.amber }, 2), 0, 3.6, 6.3));
  g.add(at(lightPool(t, 7, C.amber, 0.6), 0, 0, 9));
  return g;
}

const BUILDERS: Record<LandmarkKind, (t: Themed) => Group> = {
  unisphere, gantries, "twin-towers": twinTowers, club, cafe, ballpark, tennis, bridge, studios, gallery,
  "music-hall": musicHall, lounge, bodega: (t) => bodega(t), pizzeria, college,
  gym, diner, church, library, firehouse,
  rooftop, "uv-club": uvClub, mixer, "dive-club": diveClub, lotto,
  boutique, showroom, dealership, cinema, arena,
  "st-johnsons": stJohnsons, "queensborough-u": queensboroughU, "fair-towers": fairTowers, "discount-disco": discountDisco, "bike-hub": bikeHub,
  "googie-diner": googieDiner, hub, "sky-dining": skyDining, supermarket, cowork, precinct,
  chapel, fitness, "hell-gate": hellGate, "el-station": elStation, "condo-towers": condoTowers, "pier-park": pierPark, "radio-station": radioStation, "clout-tower": cloutTower, hospital, brownstone,
};

export function buildLandmark(kind: LandmarkKind, t: Themed): Group {
  return BUILDERS[kind](t);
}
