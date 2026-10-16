// Low-poly landmark models for the city map (lib/map/landmarks.ts). Built in meters: x east,
// y up, z south, the front facing +z. Monument Valley colors by day; at night windows light up,
// signs glow and monuments are uplit. Everything that changes at night registers in a Themed.

import {
  AdditiveBlending, BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, Group,
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
  n.fillStyle = "#000";
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
  g.add(lightPool(t, 30, C.sky, 0.45));
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
    g.add(one);
  }
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
  const glassA = facade(t, { wall: "#3F7F86", glass: "#9ED8F7", style: "curtain", lit: 0.45, seed: 11, frame: "#2E5F66" });
  const glassB = facade(t, { wall: "#4C8C93", glass: "#BFE6F7", style: "curtain", lit: 0.4, seed: 23, frame: "#356B72" });
  const podium = facade(t, { wall: C.cream, glass: "#F2C7A0", style: "storefront", lit: 0.9, seed: 5, frame: C.stoneDark });
  g.add(at(facadeBox(48, 12, 32, podium, solid(C.stoneDark)), 0, 6, 0));
  g.add(at(facadeBox(18, 120, 18, glassA, roof), -12, 12 + 60, -2));
  g.add(at(facadeBox(16, 92, 16, glassB, roof), 12, 12 + 46, -1));
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
  g.add(lightPool(t, 34, C.amber, 0.3));
  return g;
}

// ---------------------------------------------------------------------------
// Velvet Static (club, Long Island City): a sawtooth-roof warehouse with a neon sign and searchlights
// ---------------------------------------------------------------------------
function club(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: C.charcoal, glass: "#5A6170", style: "industrial", lit: 0.25, seed: 7 }, 0.9);
  const roof = solid("#55545E");
  g.add(at(facadeBox(32, 10, 20, brick, roof), 0, 5, 0));
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
  g.add(at(lightPool(t, 10, C.pink, 0.5), 0, 0, 14));
  // Searchlights sweeping the sky (night only).
  for (const [x, phase] of [[-10, 0], [10, 1.7]] as const) {
    const pivot = at(new Group(), x, 12, 2);
    const beam = new Mesh(
      new ConeGeometry(7, 90, 16, 1, true),
      new MeshBasicMaterial({ color: "#E6F4FF", transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    beam.position.y = 45;
    beam.rotation.x = Math.PI;
    beam.renderOrder = 3;
    pivot.add(beam);
    pivot.rotation.x = -0.25;
    t.nightOnly.push(pivot);
    t.sweep.push({ o: pivot, base: x < 0 ? 0.35 : -0.35, amp: 0.35, speed: 0.6, phase });
    g.add(pivot);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Grind & Gossip Café (Astoria): a brick rowhouse with a striped awning and a rooftop water tower
// ---------------------------------------------------------------------------
function cafe(t: Themed): Group {
  const g = new Group();
  const brick = facade(t, { wall: C.terracotta, glass: "#4E6B7A", style: "punched", lit: 0.55, seed: 3, frame: C.cream });
  const store = facade(t, { wall: C.cream, glass: "#F6D7A8", style: "storefront", lit: 1, seed: 9, frame: "#6B4A3A" }, 1.5);
  const roof = solid("#9A5A46");
  g.add(at(facadeBox(12, 4.5, 14, store, roof), 0, 2.25, 0));
  g.add(at(facadeBox(12, 8.5, 14, brick, roof), 0, 4.5 + 4.25, 0));
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
  g.add(at(lightPool(t, 9, C.amber, 0.45), 0, 0, 9));
  return g;
}

const BUILDERS: Record<LandmarkKind, (t: Themed) => Group> = {
  unisphere, gantries, "twin-towers": twinTowers, club, cafe,
};

export function buildLandmark(kind: LandmarkKind, t: Themed): Group {
  const g = BUILDERS[kind](t);
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) m.frustumCulled = false;
  });
  return g;
}
