// The compact map's moving street life (owner, Oct 30: "cars and people don't move naturally on the streets"): cars and
// cabs driving the open boroughs' streets and people walking round their blocks, moved by lib/streetTraffic.ts and drawn
// as a handful of instanced meshes (a few draw calls whatever the count). At night the cars' headlights and taillights
// come on, with a pool of light ahead of each car.

import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, CylinderGeometry, InstancedMesh, type Material, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, type Scene, SphereGeometry, SRGBColorSpace, Vector3,
} from "three";
import { carPose, spawnCars, stepCars, stepWalkers, walkerPose, type Car, type StreetGrid, type Walker } from "@/lib/streetTraffic";

const SHIRTS = ["#E5484D", "#3E63DD", "#2F8F5B", "#F5A524", "#8E4EC6", "#E54666", "#12A594", "#FFFFFF", "#1C2024"];
const SKIN = ["#F1C7A5", "#D9A27A", "#C68E5F", "#8D5A3B", "#5E3A26"];
const CAR_COLORS = ["#E5484D", "#3E63DD", "#FFFFFF", "#1C2024", "#8E8C99", "#2F8F5B"];
const CAB = "#F5C518";

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft glow fading out from the middle (light pools, headlight beams). */
export function glowTexture(shape: "round" | "beam", rgb = "255,200,110"): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  if (shape === "round") {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgba(${rgb},1)`);
    r.addColorStop(0.45, `rgba(${rgb},.55)`);
    r.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  } else {
    // Bright at the car (the left edge), fading and widening ahead.
    const l = g.createLinearGradient(0, 0, 64, 0);
    l.addColorStop(0, `rgba(${rgb},.95)`);
    l.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = l;
    g.beginPath();
    g.moveTo(0, 24); g.lineTo(64, 4); g.lineTo(64, 60); g.lineTo(0, 40);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface StreetLife {
  /** The streets and blocks that are open (cars and people only where the player can see them). */
  setAreas(grids: StreetGrid[], blocks: { cx: number; cz: number }[]): void;
  /** Moves everything on; true when something moved. */
  update(dt: number, t: number): boolean;
  setNight(night: boolean): void;
}

export function createStreetLife(scene: Scene, o: { cell: number; block: number; cars: number; peoplePerBlock: [number, number] }): StreetLife {
  const rng = rand(20261030);
  let groups: { grid: StreetGrid; cars: Car[] }[] = [];
  let cars: Car[] = [];
  let walkers: Walker[] = [];
  let night = false;

  const solid = (color: string) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });
  const meshes: InstancedMesh[] = [];
  const make = (geo: BoxGeometry | CylinderGeometry | SphereGeometry | PlaneGeometry, mat: Material, max: number) => {
    const m = new InstancedMesh(geo, mat, Math.max(1, max));
    m.count = 0;
    m.frustumCulled = false;
    scene.add(m);
    meshes.push(m);
    return m;
  };
  const maxCars = o.cars, maxPeople = 2000;
  // Cars, built along +x (their front), sitting on the street.
  const body = make(new BoxGeometry(5, 1.5, 2.4), new MeshStandardMaterial({ flatShading: true, roughness: 0.55 }), maxCars);
  const cabin = make(new BoxGeometry(2.7, 1.1, 2.2), solid("#2A2F3A"), maxCars);
  const wheels = make(new BoxGeometry(3.6, 0.9, 2.6), solid("#16151B"), maxCars);
  const headMat = new MeshStandardMaterial({ color: "#FFF3DE", emissive: "#FFE6AA", emissiveIntensity: 0.2 });
  const tailMat = new MeshStandardMaterial({ color: "#B3202C", emissive: "#FF2D3D", emissiveIntensity: 0.2 });
  const heads = make(new BoxGeometry(0.2, 0.4, 2), headMat, maxCars);
  const tails = make(new BoxGeometry(0.2, 0.35, 2), tailMat, maxCars);
  const sign = make(new BoxGeometry(0.5, 0.35, 1), new MeshStandardMaterial({ color: "#FFF3DE", emissive: "#FFE6AA", emissiveIntensity: 0.3 }), maxCars);
  const beamGeo = new PlaneGeometry(16, 7);
  beamGeo.rotateX(-Math.PI / 2);
  const beams = make(beamGeo, new MeshBasicMaterial({ map: glowTexture("beam"), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }), maxCars);
  beams.renderOrder = 2;
  // People: a shirt and a head.
  const torso = make(new CylinderGeometry(0.55, 0.55, 2.2, 6), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), maxPeople);
  const headsP = make(new SphereGeometry(0.55, 6, 5), new MeshStandardMaterial({ flatShading: true, roughness: 0.85 }), maxPeople);
  for (const m of [body, cabin, wheels, torso, headsP]) m.castShadow = false;

  const local = {
    body: new Matrix4().makeTranslation(0, 1.25, 0),
    cabin: new Matrix4().makeTranslation(-0.3, 2.55, 0),
    wheels: new Matrix4().makeTranslation(0, 0.45, 0),
    head: new Matrix4().makeTranslation(2.52, 1.35, 0),
    tail: new Matrix4().makeTranslation(-2.52, 1.4, 0),
    sign: new Matrix4().makeTranslation(-0.3, 3.3, 0),
    beam: new Matrix4().makeTranslation(10.5, 0.5, 0),
    torso: new Matrix4().makeTranslation(0, 1.1, 0),
    headP: new Matrix4().makeTranslation(0, 2.7, 0),
  };
  const m4 = new Matrix4(), tmp = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), pos = new Vector3(), one = new Vector3(1, 1, 1);
  const set = (mesh: InstancedMesh, i: number, at: Matrix4) => mesh.setMatrixAt(i, tmp.multiplyMatrices(m4, at));

  let taxis: number[] = [];
  const api: StreetLife = {
    setAreas(next, blocks) {
      const cells = next.reduce((a, g) => a + (g.x1 - g.x0 + 1) * (g.y1 - g.y0 + 1), 0);
      groups = next.map((g) => ({ grid: g, cars: spawnCars(g, Math.floor((o.cars * (g.x1 - g.x0 + 1) * (g.y1 - g.y0 + 1)) / Math.max(1, cells)), o.cell, rng) }));
      cars = groups.flatMap((g) => g.cars);
      taxis = [];
      cars.forEach((_, i) => {
        const cab = rng() < 0.3;
        if (cab) taxis.push(i);
        body.setColorAt(i, new Color(cab ? CAB : CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]));
      });
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      for (const m of [body, cabin, wheels, heads, tails, beams]) m.count = cars.length;
      sign.count = taxis.length;

      walkers = [];
      const half = o.block / 2 - 0.6;
      for (const b of blocks) {
        const [lo, hi] = o.peoplePerBlock;
        const n = lo + Math.floor(rng() * (hi - lo + 1));
        for (let i = 0; i < n && walkers.length < maxPeople; i++) {
          const k = walkers.length;
          walkers.push({ cx: b.cx, cz: b.cz, half, s: rng() * 8 * half, way: rng() < 0.5 ? 1 : -1, v: 1.4 + rng() * 1.2, pause: rng() < 0.3 ? rng() * 4 : 0 });
          torso.setColorAt(k, new Color(SHIRTS[Math.floor(rng() * SHIRTS.length)]));
          headsP.setColorAt(k, new Color(SKIN[Math.floor(rng() * SKIN.length)]));
        }
      }
      for (const m of [torso, headsP]) { m.count = walkers.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      api.update(0, 0);
    },
    update(dt, t) {
      if (dt > 0) {
        // A long gap (the tab was away): move on in small steps, at most a few seconds' worth.
        const steps = Math.min(90, Math.ceil(dt / (1 / 20)));
        const h = Math.min(dt, 4) / steps;
        for (let k = 0; k < steps; k++) {
          for (const g of groups) stepCars(g.cars, g.grid, o.cell, h, t - (steps - 1 - k) * h, rng);
        }
        stepWalkers(walkers, Math.min(dt, 4), rng);
      }
      let ti = 0;
      cars.forEach((car, i) => {
        const p = carPose(car, o.cell);
        m4.compose(pos.set(p.x, 0, p.z), q.setFromAxisAngle(up, p.yaw), one);
        set(body, i, local.body); set(cabin, i, local.cabin); set(wheels, i, local.wheels);
        set(heads, i, local.head); set(tails, i, local.tail); set(beams, i, local.beam);
        if (taxis[ti] === i) set(sign, ti++, local.sign);
      });
      walkers.forEach((w, i) => {
        const p = walkerPose(w);
        m4.makeTranslation(p.x, 0.4 + p.lift, p.z);
        set(torso, i, local.torso); set(headsP, i, local.headP);
      });
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      return cars.length + walkers.length > 0;
    },
    setNight(n) {
      night = n;
      headMat.emissiveIntensity = night ? 2.4 : 0.2;
      tailMat.emissiveIntensity = night ? 2 : 0.2;
      (sign.material as MeshStandardMaterial).emissiveIntensity = night ? 1.8 : 0.3;
      beams.visible = night;
    },
  };
  api.setNight(false);
  return api;
}
