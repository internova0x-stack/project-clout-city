// Low-poly, flat-shaded furniture and props for the walkable rooms, built from
// primitives (after the Lagos Life look). Every piece faces +z and sits on y = 0;
// the room rotates and places it from lib/rooms.ts. Modeled assets can replace
// a builder later without touching the layouts.

import {
  BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh,
  MeshStandardMaterial, Plane, RepeatWrapping, SRGBColorSpace, Vector3, SphereGeometry, TorusGeometry, type BufferGeometry, type Material, type Object3D,
} from "three";
import { FURNITURE, type RoomItem } from "@/lib/rooms";
import { placedModel } from "./models";

export interface Kit {
  mat(color: string, o?: { emissive?: string; emissiveIntensity?: number; roughness?: number; metalness?: number; opacity?: number; map?: CanvasTexture }): MeshStandardMaterial;
  geo<T extends BufferGeometry>(g: T): T;
  dispose(): void;
}

/** Shares materials by color and tracks everything for disposal. */
export function makeKit(): Kit {
  const geos: BufferGeometry[] = [];
  const mats = new Map<string, MeshStandardMaterial>();
  const extra: Material[] = [];
  return {
    mat(color, o = {}) {
      const key = JSON.stringify([color, o.emissive, o.emissiveIntensity, o.roughness, o.metalness, o.opacity]);
      if (!o.map && mats.has(key)) return mats.get(key)!;
      const m = new MeshStandardMaterial({
        color: new Color(color), roughness: o.roughness ?? 0.75, metalness: o.metalness ?? 0, flatShading: true,
        transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
      });
      if (o.emissive) { m.emissive = new Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
      if (o.map) { m.map = o.map; extra.push(m); } else mats.set(key, m);
      return m;
    },
    geo(g) { geos.push(g); return g; },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      extra.forEach((m) => { (m as MeshStandardMaterial).map?.dispose(); m.dispose(); });
    },
  };
}

export interface Built {
  group: Group;
  /** Called every frame (seconds) for anything that moves or glows. */
  tick?: (t: number) => void;
  /** Seat height for sitting, or mattress height for lying down. */
  seatY?: number;
}

/** The Clout Throne's Midnight Edition is drawn in this gunmetal (lib/city.ts CATALOG_FURNITURE). */
export const THRONE_MIDNIGHT = "#2E3138";

/** The statue's pedestal height: the gold avatar stands on it. */
export const STATUE_TOP = 0.62;

const WOOD = "#9A6B45";
const WOOD_DARK = "#5A3E2B";
const METAL = "#B9BEC6";
const BLACK = "#1F1B26";

/**
 * A piece, box-built at once; when the item names a model (components/room/models.ts) the model replaces it once loaded,
 * in the same group, so the room's placement, taps and shadows carry on (low graphics keeps the box-built piece).
 */
export function buildFurniture(item: RoomItem, k: Kit, opts: { night: boolean; low?: boolean }): Built {
  const built = buildBoxFurniture(item, k, opts);
  if (item.model && !opts.low && typeof window !== "undefined") {
    const { w, d } = FURNITURE[item.kind];
    void placedModel(item.model, w, d).then((m) => {
      if (!m) return;
      const keep = built.group.children.slice();
      for (const c of keep) built.group.remove(c);
      // Taps read itemId from userData: copy it onto the model's meshes.
      const id = keep[0]?.userData.itemId;
      if (id !== undefined) m.traverse((o) => { o.userData.itemId = id; });
      built.group.add(m);
    });
  }
  return built;
}

function buildBoxFurniture(item: RoomItem, k: Kit, opts: { night: boolean }): Built {
  const g = new Group();
  const box = (w: number, h: number, d: number, color: string | Material, x = 0, y = 0, z = 0) => {
    const m = new Mesh(k.geo(new BoxGeometry(w, h, d)), typeof color === "string" ? k.mat(color) : color);
    m.position.set(x, y + h / 2, z);
    g.add(m);
    return m;
  };
  const cyl = (rt: number, rb: number, h: number, color: string | Material, x = 0, y = 0, z = 0, seg = 10) => {
    const m = new Mesh(k.geo(new CylinderGeometry(rt, rb, h, seg)), typeof color === "string" ? k.mat(color) : color);
    m.position.set(x, y + h / 2, z);
    g.add(m);
    return m;
  };
  const legs4 = (w: number, d: number, h: number, color = WOOD_DARK, r = 0.025) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(r, r, h, color, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 6);
  };
  const { w, d } = FURNITURE[item.kind];
  const color = item.color;
  const glow = (c: string, i = 1.2) => k.mat(c, { emissive: c, emissiveIntensity: opts.night ? i : i * 0.6 });

  switch (item.kind) {
    case "bed": {
      box(w, 0.28, d, WOOD);
      box(w - 0.08, 0.18, d - 0.1, "#F4F1EA", 0, 0.28, 0.02);
      box(w - 0.04, 0.06, d * 0.62, color ?? "#6C8CFF", 0, 0.45, d * 0.18);
      for (const s of [-1, 1]) box(0.6, 0.12, 0.38, "#FFFFFF", s * 0.36, 0.46, -d / 2 + 0.32);
      box(w, 0.85, 0.08, WOOD_DARK, 0, 0, -d / 2 + 0.04);
      return { group: g, seatY: 0.5 };
    }
    case "sofa":
    case "armchair": {
      const c = color ?? "#FF8A3D";
      box(w, 0.42, d, c);
      box(w, 0.48, 0.2, c, 0, 0.38, -d / 2 + 0.1);
      for (const s of [-1, 1]) box(0.18, 0.62, d, new Color(c).multiplyScalar(0.85).getStyle(), s * (w / 2 - 0.09), 0, 0);
      const cushions = item.kind === "sofa" ? 2 : 1;
      const cw = (w - 0.36) / cushions;
      for (let i = 0; i < cushions; i++) box(cw - 0.04, 0.1, d - 0.3, new Color(c).lerp(new Color("#ffffff"), 0.15).getStyle(), -w / 2 + 0.18 + cw * (i + 0.5), 0.42, 0.08);
      return { group: g, seatY: 0.5 };
    }
    case "coffeeTable":
      box(w, 0.05, d, WOOD, 0, 0.36);
      legs4(w, d, 0.36);
      box(0.18, 0.04, 0.12, "#E0457B", -0.2, 0.41, 0.05);
      cyl(0.04, 0.035, 0.09, "#FFFFFF", 0.25, 0.41, -0.05, 8);
      return { group: g };
    case "tvStand": {
      box(w, 0.45, d, BLACK);
      box(1.3, 0.78, 0.06, "#0B0A10", 0, 0.62, -0.05);
      const screen = box(1.2, 0.68, 0.01, glow("#3B6FD8", 0.9), 0, 0.67, -0.015);
      return { group: g, tick: (t) => { (screen.material as MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.15; } };
    }
    case "rug": {
      box(w, 0.015, d, color ?? "#E0457B");
      box(w - 0.3, 0.017, d - 0.3, new Color(color ?? "#E0457B").lerp(new Color("#ffffff"), 0.35).getStyle());
      return { group: g };
    }
    case "plant": {
      cyl(0.2, 0.15, 0.36, "#C9A27A");
      for (let i = 0; i < 6; i++) {
        const leaf = new Mesh(k.geo(new DodecahedronGeometry(0.16, 0)), k.mat(i % 2 ? "#2E8B63" : "#40B589"));
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.12, 0.55 + (i % 3) * 0.12, Math.sin(a) * 0.12);
        leaf.scale.set(1, 1.4, 1);
        g.add(leaf);
      }
      return { group: g };
    }
    case "floorLamp": {
      cyl(0.16, 0.18, 0.04, BLACK);
      cyl(0.02, 0.02, 1.5, BLACK, 0, 0.04);
      const shade = new Mesh(k.geo(new ConeGeometry(0.22, 0.3, 10, 1, true)), glow("#FFD58A", 0.9));
      shade.position.set(0, 1.62, 0);
      g.add(shade);
      return { group: g };
    }
    case "kitchen": {
      box(w, 0.88, d, "#F4F1EA");
      box(w + 0.02, 0.05, d + 0.02, "#3A3540", 0, 0.88);
      box(w, 0.6, 0.34, "#F4F1EA", 0, 1.45, -d / 2 + 0.17);
      for (let i = 0; i < 4; i++) box(0.02, 0.7, 0.01, "#C9C6D2", -w / 2 + (i + 1) * (w / 5), 0.08, d / 2 + 0.005);
      box(0.5, 0.02, 0.36, METAL, -0.6, 0.93, 0);
      for (const s of [-1, 1]) cyl(0.08, 0.08, 0.015, BLACK, 0.55 + s * 0.2, 0.93, 0.05, 10);
      return { group: g };
    }
    case "fridge":
      box(w, 1.8, d, "#E6E8EC");
      box(0.03, 0.5, 0.04, METAL, w / 2 - 0.1, 1.1, d / 2 + 0.02);
      return { group: g };
    case "diningTable":
      box(w, 0.05, d, WOOD, 0, 0.72);
      legs4(w, d, 0.72);
      return { group: g };
    case "chair":
    case "barStool":
      if (item.kind === "barStool") {
        cyl(0.2, 0.2, 0.06, "#FF2E88", 0, 0.72);
        cyl(0.03, 0.03, 0.72, METAL);
        cyl(0.18, 0.2, 0.03, METAL);
        return { group: g, seatY: 0.78 };
      }
      box(0.46, 0.05, 0.46, color ?? WOOD, 0, 0.44);
      box(0.46, 0.5, 0.05, color ?? WOOD, 0, 0.49, -0.2);
      legs4(0.46, 0.46, 0.44, WOOD_DARK, 0.02);
      return { group: g, seatY: 0.48 };
    case "wardrobe":
      box(w, 2.0, d, WOOD);
      box(0.01, 1.9, 0.01, WOOD_DARK, 0, 0.05, d / 2 + 0.005);
      for (const s of [-1, 1]) box(0.03, 0.18, 0.03, METAL, s * 0.07, 1.0, d / 2 + 0.02);
      return { group: g };
    case "desk":
      box(w, 0.05, d, WOOD, 0, 0.74);
      legs4(w, d, 0.74);
      return { group: g };
    case "bookshelf": {
      box(w, 1.8, d, WOOD_DARK);
      const books = ["#D93A2F", "#2F5DA8", "#F2B705", "#40B589", "#E0457B", "#F4F1EA"];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) box(0.09, 0.26 + ((i * 7 + r) % 3) * 0.03, 0.26, books[(i + r) % books.length], -w / 2 + 0.12 + i * 0.12, 0.1 + r * 0.43, 0.07);
      return { group: g };
    }
    case "bar": {
      box(w, 1.05, d, "#2A2530");
      box(w + 0.06, 0.05, d + 0.06, "#14111A", 0, 1.05);
      const strip = box(w, 0.04, 0.02, glow("#FF2E88", 1.6), 0, 0.1, d / 2 + 0.01);
      const bottles = ["#40B589", "#F2B705", "#6C8CFF", "#FF2E88", "#F4F1EA"];
      for (let i = 0; i < 10; i++) cyl(0.035, 0.04, 0.28, k.mat(bottles[i % 5], { opacity: 0.85, roughness: 0.2 }), -w / 2 + 0.2 + i * 0.3, 1.1, -0.25, 7);
      return { group: g, tick: (t) => { (strip.material as MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.5; } };
    }
    case "djBooth": {
      box(w, 1.0, d, BLACK);
      const panel = box(w - 0.1, 0.5, 0.02, glow("#6B2BD9", 1.4), 0, 0.3, d / 2 + 0.01);
      for (const s of [-1, 1]) {
        const deck = cyl(0.17, 0.17, 0.03, "#3A3540", s * 0.5, 1.0, 0, 14);
        deck.userData.spin = true;
      }
      box(0.36, 0.02, 0.24, glow("#FFC21A", 0.8), 0, 1.0, 0.05);
      return { group: g, tick: (t) => { (panel.material as MeshStandardMaterial).emissive.setHSL((t * 0.08) % 1, 0.9, 0.5); } };
    }
    case "speaker":
      box(w, 1.4, d, BLACK);
      for (const [y, r] of [[1.05, 0.12], [0.55, 0.22]] as const) {
        const cone = cyl(r, r, 0.02, "#3A3540", 0, y, d / 2, 14);
        cone.rotation.x = Math.PI / 2;
        cone.position.y = y;
      }
      return { group: g };
    case "danceFloor": {
      const tiles: Mesh[] = [];
      const n = 6;
      const s = w / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const m = new Mesh(k.geo(new BoxGeometry(s - 0.03, 0.03, s - 0.03)), k.mat("#ffffff", { emissive: "#FF2E88", emissiveIntensity: 1 }).clone());
        m.position.set(-w / 2 + s * (c + 0.5), 0.015, -d / 2 + s * (r + 0.5));
        g.add(m);
        tiles.push(m);
      }
      return {
        group: g,
        tick: (t) => tiles.forEach((m, i) => {
          const mm = m.material as MeshStandardMaterial;
          const beat = Math.floor(t * 2.2);
          mm.emissive.setHSL(((i * 7 + beat * 3) % 12) / 12, 0.9, 0.5);
          mm.color.copy(mm.emissive);
          mm.emissiveIntensity = (i + beat) % 3 === 0 ? 1.4 : 0.35;
        }),
      };
    }
    case "booth": {
      const c = color ?? "#6B2BD9";
      box(w, 0.42, d, c);
      box(w, 0.6, 0.2, c, 0, 0.42, -d / 2 + 0.1);
      box(0.9, 0.05, 0.6, "#14111A", 0, 0.72, d / 2 + 0.25);
      cyl(0.03, 0.03, 0.72, METAL, 0, 0, d / 2 + 0.25, 6);
      return { group: g, seatY: 0.48 };
    }
    case "cafeCounter": {
      box(w, 1.0, d, "#F4E3C8");
      box(w + 0.05, 0.05, d + 0.05, WOOD_DARK, 0, 1.0);
      box(w, 0.25, 0.02, "#C27C4E", 0, 0.6, d / 2 + 0.01);
      box(0.55, 0.45, 0.4, METAL, -0.8, 1.05, -0.05);
      box(0.4, 0.1, 0.1, BLACK, -0.8, 1.25, 0.18);
      box(0.32, 0.22, 0.28, BLACK, 0.8, 1.05, 0);
      for (let i = 0; i < 3; i++) cyl(0.04, 0.035, 0.09, "#FFFFFF", 0.1 + i * 0.12, 1.05, 0.2, 8);
      return { group: g };
    }
    case "cafeTable":
      cyl(0.4, 0.4, 0.04, "#F4F1EA", 0, 0.72, 0, 14);
      cyl(0.04, 0.04, 0.72, BLACK, 0, 0, 0, 6);
      cyl(0.2, 0.22, 0.03, BLACK, 0, 0, 0, 10);
      cyl(0.045, 0.04, 0.09, "#FFFFFF", 0.12, 0.76, 0.05, 8);
      return { group: g };
    case "pastryCase": {
      box(w, 0.9, d, "#C27C4E");
      box(w, 0.4, d, k.mat("#DDEFF6", { opacity: 0.35, roughness: 0.1 }), 0, 0.9);
      const treats = ["#E8A44A", "#E0457B", "#F4E3C8", "#8B5A3C"];
      for (let i = 0; i < 6; i++) {
        const p = new Mesh(k.geo(new SphereGeometry(0.07, 6, 4)), k.mat(treats[i % 4]));
        p.position.set(-0.45 + i * 0.18, 0.97, 0);
        p.scale.y = 0.6;
        g.add(p);
      }
      return { group: g };
    }
    case "deliCounter": {
      box(w, 1.0, d, "#F4F1EA");
      box(w + 0.04, 0.04, d + 0.04, "#2E8B63", 0, 1.0);
      box(w - 0.2, 0.4, 0.02, k.mat("#DDEFF6", { opacity: 0.4, roughness: 0.1 }), 0, 1.04, 0.15);
      box(0.4, 0.3, 0.3, METAL, 0.8, 1.04, -0.15);
      box(0.3, 0.2, 0.25, BLACK, -0.9, 1.04, -0.1);
      return { group: g };
    }
    case "shelf": {
      box(w, 1.6, d, "#D6CFC4");
      const goods = ["#D93A2F", "#F2B705", "#2F5DA8", "#40B589", "#FF8A3D", "#F4F1EA"];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) box(0.18, 0.22, 0.3, goods[(i * 3 + r) % goods.length], -w / 2 + 0.15 + i * 0.24, 0.12 + r * 0.38, 0.05);
      return { group: g };
    }
    case "drinksFridge": {
      box(w, 1.9, d, "#E6E8EC");
      const front = box(w - 0.1, 1.7, 0.02, glow("#CFE8FF", 0.5), 0, 0.1, d / 2 + 0.005);
      front.material = k.mat("#CFE8FF", { emissive: "#CFE8FF", emissiveIntensity: opts.night ? 0.7 : 0.35, opacity: 0.9 });
      const cans = ["#D93A2F", "#40B589", "#F2B705", "#6C8CFF"];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) cyl(0.04, 0.04, 0.16, cans[(i + r) % 4], -w / 2 + 0.2 + i * 0.2, 0.2 + r * 0.42, 0.1, 6);
      return { group: g };
    }
    case "statue": {
      // A black marble pedestal with a gold plaque; Room3D stands the owner's avatar, in gold, on top (STATUE_TOP).
      const marble = k.mat("#1F1B26", { roughness: 0.25, metalness: 0.1 });
      box(w, 0.08, d, marble);
      box(w - 0.14, STATUE_TOP - 0.16, d - 0.14, marble, 0, 0.08, 0);
      box(w, 0.08, d, marble, 0, STATUE_TOP - 0.08, 0);
      box(0.3, 0.1, 0.01, k.mat(color ?? "#D4AF37", { roughness: 0.3, metalness: 0.85 }), 0, STATUE_TOP * 0.45, (d - 0.14) / 2 + 0.006);
      return { group: g };
    }
    case "throne": {
      // The Clout Throne: a stepped dais, a velvet seat, and behind it a fan of spikes, phones on selfie sticks and ring
      // lights. Look A (owner, Oct 21) is gold with magenta velvet; the Midnight Edition (look B) is gunmetal with gold
      // trim, red velvet, microphones among the spikes and one magenta ring light. Sitting puts you on the cushion (seatY).
      const midnight = color === THRONE_MIDNIGHT;
      const gold = k.mat(midnight ? THRONE_MIDNIGHT : color ?? "#D4AF37", { roughness: midnight ? 0.35 : 0.42, metalness: midnight ? 0.45 : 0.25 });
      const bronze = k.mat(midnight ? "#1F2126" : "#A9772A", { roughness: 0.5, metalness: 0.2 });
      const trim = midnight ? k.mat("#EBC657", { roughness: 0.4, metalness: 0.25 }) : gold;
      const velvet = k.mat(midnight ? "#A3172F" : "#8E1F4A", { roughness: 0.9 });
      const screen = k.mat("#1F1B26", { roughness: 0.25, metalness: 0.2 });
      for (let i = 0; i < 3; i++) {
        box(w - i * 0.22, 0.15, d - i * 0.24, midnight ? k.mat("#4A4D55", { roughness: 0.8 }) : i % 2 ? bronze : gold, 0, i * 0.15, -i * 0.1);
        // Gold edging on the Midnight Edition's stone steps.
        if (midnight) box(w - i * 0.22 + 0.01, 0.025, 0.02, trim, 0, i * 0.15 + 0.13, (d - i * 0.24) / 2 - i * 0.1);
      }
      box(0.72, 0.26, 0.62, gold, 0, 0.45, -0.18);
      box(0.66, 0.07, 0.56, velvet, 0, 0.71, -0.16);
      for (const sx of [-1, 1]) { box(0.14, 0.36, 0.6, gold, sx * 0.42, 0.45, -0.18); if (midnight) box(0.15, 0.03, 0.61, trim, sx * 0.42, 0.8, -0.18); }
      box(0.6, 0.95, 0.08, velvet, 0, 0.71, -0.47);
      const fan = new Group();
      fan.position.set(0, 0.95, -0.55);
      g.add(fan);
      const ray = (angle: number, len: number, part: "spike" | "stick" | "ring" | "mic", z = 0) => {
        const arm = new Group();
        arm.rotation.z = angle;
        arm.position.z = z;
        fan.add(arm);
        if (part === "spike") {
          const m = new Mesh(k.geo(new ConeGeometry(0.075, len, 4)), z < 0 ? bronze : gold);
          m.position.y = len / 2;
          arm.add(m);
          // A gold tip on the Midnight Edition's spikes; phones laid along each spike, screens out.
          if (midnight) {
            const tip = new Mesh(k.geo(new ConeGeometry(0.03, 0.14, 4)), trim);
            tip.position.y = len - 0.06;
            arm.add(tip);
          }
          for (const at of [0.28, 0.55]) {
            const ph = new Mesh(k.geo(new BoxGeometry(0.1, 0.17, 0.02)), midnight ? trim : gold);
            ph.position.set(0, len * at, 0.035);
            arm.add(ph);
            const sc = new Mesh(k.geo(new BoxGeometry(0.08, 0.14, 0.006)), screen);
            sc.position.set(0, len * at, 0.047);
            arm.add(sc);
          }
        } else {
          const stick = new Mesh(k.geo(new CylinderGeometry(0.008, 0.008, len, 5)), midnight ? trim : gold);
          stick.position.y = len / 2;
          arm.add(stick);
          if (part === "mic") {
            const head = new Mesh(k.geo(new SphereGeometry(0.05, 8, 6)), k.mat("#14111A", { roughness: 0.6 }));
            head.position.set(0, len + 0.04, 0);
            arm.add(head);
          } else if (part === "stick") {
            const ph = new Mesh(k.geo(new BoxGeometry(0.1, 0.06, 0.015)), screen);
            ph.position.set(0, len + 0.02, 0.01);
            arm.add(ph);
          } else {
            const ring = new Mesh(k.geo(new TorusGeometry(midnight ? 0.13 : 0.09, 0.018, 6, 20)), glow(midnight ? "#FF3DA5" : "#FFF4D6", 1.4));
            ring.position.set(0, len + 0.09, 0.02);
            arm.add(ring);
          }
        }
      };
      // Two layers of spikes, the back one offset and darker, tallest in the middle.
      for (let i = 0; i <= 18; i++) {
        const t = -1.4 + (i / 18) * 2.8;
        ray(t, 0.6 + 0.8 * Math.cos(t * 0.9) + (i % 2) * 0.22, "spike");
        if (i < 18) ray(t + 0.078, 0.75 + 0.85 * Math.cos(t * 0.9), "spike", -0.08);
      }
      for (const t of [-1.15, -0.55, 0.55, 1.15]) ray(t, 1.05 + Math.cos(t) * 0.25, "stick");
      if (midnight) {
        for (const t of [-0.95, -0.3, 0.3, 0.95]) ray(t, 1.2 + Math.cos(t) * 0.2, "mic");
        ray(0, 0.62, "ring", 0.06);
      } else for (const t of [-0.85, 0.1, 0.85]) ray(t, 0.95 + Math.cos(t) * 0.3, "ring");
      return { group: g, seatY: 0.78 };
    }
    case "piano": {
      box(w, 0.75, 0.6, BLACK, 0, 0.22, -0.35);
      const lid = box(w, 0.04, d - 0.1, k.mat(BLACK, { roughness: 0.25, metalness: 0.2 }), 0, 0.97, 0.05);
      lid.rotation.x = -0.12;
      box(w - 0.2, 0.05, 0.2, "#F4F1EA", 0, 0.8, 0.0);
      for (let i = 0; i < 9; i++) box(0.05, 0.03, 0.12, BLACK, -w / 2 + 0.2 + i * 0.14, 0.84, -0.02);
      for (const sx of [-1, 1]) cyl(0.05, 0.05, 0.22, BLACK, sx * (w / 2 - 0.15), 0, -0.35, 6);
      cyl(0.05, 0.05, 0.22, BLACK, 0, 0, 0.5, 6);
      box(0.7, 0.45, 0.35, BLACK, 0, 0, 0.62);
      return { group: g };
    }
    case "clothesRack": {
      for (const sx of [-1, 1]) cyl(0.02, 0.02, 1.5, METAL, sx * (w / 2 - 0.05), 0, 0, 6);
      const bar = cyl(0.02, 0.02, w - 0.1, METAL, 0, 1.45, 0, 6);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.45;
      box(w, 0.04, 0.4, METAL, 0, 0, 0);
      const cloth = ["#E0457B", "#F4F1EA", "#2A2530", "#6C8CFF", "#F2B705", "#40B589", "#C27C4E"];
      for (let i = 0; i < 7; i++) box(0.05, 0.75 - (i % 3) * 0.1, 0.38, cloth[(i + (color ? 2 : 0)) % cloth.length], -w / 2 + 0.25 + i * 0.18, 0.65 + (i % 3) * 0.1, 0);
      return { group: g };
    }
    case "mirror": {
      box(w, 0.06, d, WOOD_DARK);
      const frame = box(w - 0.1, 1.8, 0.06, "#E8C79A", 0, 0.06, 0);
      frame.position.z = -0.05;
      box(w - 0.24, 1.62, 0.02, k.mat("#DDEFF6", { roughness: 0.05, metalness: 0.6, emissive: "#DDEFF6", emissiveIntensity: opts.night ? 0.25 : 0.1 }), 0, 0.15, 0.0);
      return { group: g };
    }
    case "displayTable": {
      box(w, 0.06, d, "#F4F1EA", 0, 0.8);
      box(w - 0.2, 0.8, d - 0.2, "#E8DCCF");
      const folded = ["#E0457B", "#2A2530", "#6C8CFF", "#F4F1EA"];
      for (let i = 0; i < 4; i++) box(0.24, 0.08 + (i % 2) * 0.04, 0.3, folded[i], -0.4 + i * 0.27, 0.86, 0);
      return { group: g };
    }
    case "storeCounter": {
      box(w, 1.0, d, "#2A2530");
      box(w + 0.04, 0.04, d + 0.04, "#E0457B", 0, 1.0);
      box(0.35, 0.25, 0.3, BLACK, 0.5, 1.04, 0);
      box(0.4, 0.2, 0.3, "#F4EDE6", -0.5, 1.04, 0);
      return { group: g };
    }
    case "lectureDesk": {
      // A bench and a writing surface for two, with notebooks; faces +z (the board is behind at rot 2).
      box(w, 0.05, 0.45, WOOD, 0, 0.72, 0.15);
      box(w - 0.1, 0.7, 0.04, WOOD_DARK, 0, 0, 0.36);
      box(w, 0.05, 0.3, WOOD, 0, 0.44, -0.22);
      for (const sx of [-1, 1]) {
        box(0.05, 0.72, 0.05, METAL, sx * (w / 2 - 0.08), 0, 0.15);
        box(0.05, 0.44, 0.05, METAL, sx * (w / 2 - 0.08), 0, -0.22);
      }
      box(0.3, 0.02, 0.22, "#F4F1EA", -0.4, 0.77, 0.15);
      box(0.24, 0.02, 0.32, color ?? "#2F5DA8", 0.35, 0.77, 0.12);
      return { group: g, seatY: 0.46 };
    }
    case "lectern": {
      box(w, 0.06, d, WOOD_DARK);
      box(w - 0.2, 1.0, d - 0.2, WOOD, 0, 0.06, 0);
      const top = box(w, 0.06, d, WOOD_DARK, 0, 1.06, 0);
      top.rotation.x = 0.25;
      cyl(0.015, 0.015, 0.3, METAL, 0.18, 1.1, -0.1, 5);
      return { group: g };
    }
    case "chalkboard": {
      box(w, 1.4, 0.06, "#7A5A3A", 0, 0.8, 0);
      box(w - 0.16, 1.24, 0.03, k.mat("#2F4A3A", { roughness: 0.95 }), 0, 0.88, 0.03);
      box(w, 0.06, 0.16, "#7A5A3A", 0, 0.78, 0.06);
      // chalk scribbles: a formula, a diagram and an underlined word
      box(1.0, 0.03, 0.01, "#F4F1EA", -0.8, 1.8, 0.05);
      box(0.7, 0.03, 0.01, "#F4F1EA", -0.95, 1.6, 0.05);
      box(0.9, 0.03, 0.01, "#F4F1EA", -0.85, 1.4, 0.05);
      box(0.5, 0.5, 0.01, k.mat("#F4F1EA", { opacity: 0.35 }), 0.6, 1.25, 0.05);
      box(0.6, 0.03, 0.01, "#F2B705", 0.9, 1.85, 0.05);
      for (const sx of [-1, 1]) box(0.08, 0.8, 0.08, "#7A5A3A", sx * (w / 2 - 0.2), 0, 0);
      return { group: g };
    }
    // ---- v0.9 monument plazas: landmarks and park furniture ----
    case "globe": {
      // The Unisphere: a steel globe of meridians and rings on a tripod, in a round fountain pool.
      // Modeled at a 3 m footprint and scaled to the plaza's.
      cyl(1.5, 1.5, 0.18, "#C9C2B6");
      cyl(1.38, 1.38, 0.2, k.mat("#7FC8E8", { emissive: "#7FC8E8", emissiveIntensity: opts.night ? 0.35 : 0.12, roughness: 0.2 }), 0, 0.01);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = cyl(0.05, 0.08, 1.0, METAL, Math.cos(a) * 0.18, 0.15, Math.sin(a) * 0.18, 6);
        leg.rotation.z = Math.cos(a) * 0.12;
        leg.rotation.x = -Math.sin(a) * 0.12;
      }
      const steel = k.mat("#AEB8C4", { metalness: 0.5, roughness: 0.35 });
      const globe = new Group();
      globe.position.set(0, 2.15, 0);
      for (let i = 0; i < 6; i++) {
        const meridian = new Mesh(k.geo(new TorusGeometry(1.0, 0.025, 4, 32)), steel);
        meridian.rotation.y = (i / 6) * Math.PI;
        globe.add(meridian);
      }
      for (const y of [-0.7, -0.35, 0, 0.35, 0.7]) {
        const r = Math.sqrt(1 - y * y);
        const ring = new Mesh(k.geo(new TorusGeometry(r, 0.025, 4, 32)), steel);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        globe.add(ring);
      }
      // Continents: a few flat plates hugging the frame.
      for (const [lat, lon, sz] of [[0.35, 0.4, 0.5], [-0.2, 1.4, 0.4], [0.5, 2.6, 0.6], [-0.4, 3.9, 0.35], [0.1, 5.1, 0.45]] as const) {
        const p = new Mesh(k.geo(new BoxGeometry(sz, sz * 0.7, 0.03)), k.mat("#8FA4B8", { metalness: 0.4 }));
        const cl = Math.cos(lat);
        p.position.set(Math.cos(lon) * cl * 0.98, Math.sin(lat) * 0.98, Math.sin(lon) * cl * 0.98);
        p.lookAt(0, 0, 0);
        globe.add(p);
      }
      globe.rotation.z = 0.41;
      g.add(globe);
      g.scale.setScalar(w / 3);
      return { group: g, tick: (t) => { globe.rotation.y = t * 0.08; } };
    }
    case "gantry": {
      // Two old rail gantries with the "LONG ISLAND" sign across the top.
      const iron = "#3A3540";
      for (const sx of [-1, 1]) {
        const x = sx * 1.05;
        for (const sz of [-1, 1]) box(0.12, 2.9, 0.12, iron, x + sz * 0.35, 0, -0.25);
        box(0.9, 0.14, 0.14, iron, x, 2.9, -0.25);
        for (let y = 0.6; y < 2.8; y += 0.55) box(0.82, 0.05, 0.05, iron, x, y, -0.25);
        box(0.12, 0.6, 1.0, iron, x, 0, 0.2);
      }
      // The sign's lettering, painted on a canvas (in the browser; tests have no canvas).
      let signMat: Material = k.mat("#F2A900", { emissive: "#F2A900", emissiveIntensity: opts.night ? 0.8 : 0.15 });
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 74;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#F2A900"; x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#2A2530"; x.font = "800 50px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
          x.fillText("LONG ISLAND", c.width / 2, c.height / 2 + 2);
          const tex = new CanvasTexture(c);
          signMat = k.mat("#ffffff", { map: tex, emissive: opts.night ? "#F2A900" : undefined, emissiveIntensity: 0.25 });
        }
      }
      const sign = box(2.9, 0.42, 0.06, signMat, 0, 3.05, -0.25);
      sign.castShadow = true;
      g.scale.setScalar(w / 3);
      return { group: g };
    }
    case "bench": {
      box(w, 0.06, 0.4, WOOD, 0, 0.42, 0);
      box(w, 0.35, 0.06, WOOD, 0, 0.5, -0.18);
      for (const sx of [-1, 1]) box(0.06, 0.42, 0.42, BLACK, sx * (w / 2 - 0.1), 0, 0);
      return { group: g, seatY: 0.48 };
    }
    case "foodCart": {
      box(w, 0.75, d, "#F4F1EA", 0, 0.2);
      box(w, 0.06, d, color ?? "#E0457B", 0, 0.95);
      for (const sx of [-1, 1]) cyl(0.18, 0.18, 0.06, BLACK, sx * (w / 2 - 0.25), 0.02, d / 2 + 0.02, 10).rotation.x = Math.PI / 2;
      cyl(0.02, 0.02, 0.9, METAL, 0, 0.95);
      const umbrella = new Mesh(k.geo(new ConeGeometry(0.75, 0.35, 8)), k.mat(color ?? "#E0457B"));
      umbrella.position.set(0, 2.0, 0);
      g.add(umbrella);
      return { group: g };
    }
    case "lamppost": {
      cyl(0.08, 0.1, 0.1, BLACK);
      cyl(0.035, 0.035, 2.4, BLACK, 0, 0.1);
      const bulb = new Mesh(k.geo(new SphereGeometry(0.14, 8, 6)), glow("#FFE6B0", 1.1));
      bulb.position.set(0, 2.6, 0);
      g.add(bulb);
      return { group: g };
    }
    case "tree": {
      cyl(0.08, 0.12, 0.9, "#7A5A3A");
      for (let i = 0; i < 5; i++) {
        const leaf = new Mesh(k.geo(new DodecahedronGeometry(0.42, 0)), k.mat(i % 2 ? "#2E8B63" : "#40B589"));
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.25, 1.2 + (i % 2) * 0.3, Math.sin(a) * 0.25);
        g.add(leaf);
      }
      return { group: g };
    }
    // ---- v0.10 Lucky Star Lotto ----
    case "lottoCounter": {
      // A glass-front counter: ticket stacks in the five game colors under the glass, a register and
      // the ticket terminal on top.
      box(w, 1.0, d, "#2A2140");
      box(w + 0.04, 0.04, d + 0.04, "#FF2E88", 0, 1.0);
      box(w - 0.2, 0.55, 0.02, k.mat("#DDEFF6", { opacity: 0.35, roughness: 0.1 }), 0, 0.3, d / 2 + 0.01);
      const games = ["#40B589", "#3E8EDE", "#FF2E88", "#7A4FD6", "#FFF6E0"];
      games.forEach((c, i) => box(0.3, 0.08 + (i % 2) * 0.05, 0.2, c, -w / 2 + 0.4 + i * 0.42, 0.42, d / 2 - 0.14));
      box(0.45, 0.28, 0.35, BLACK, 0.8, 1.04, -0.1);
      box(0.4, 0.04, 0.2, "#7FE0A8", 0.8, 1.32, -0.05);
      const screen = box(0.36, 0.3, 0.04, glow("#7FE0A8", 0.9), -0.7, 1.12, -0.15);
      screen.rotation.x = -0.25;
      box(0.12, 0.12, 0.12, METAL, -0.7, 1.04, -0.15);
      return { group: g };
    }
    case "cardRack": {
      // Five rows of scratch cards on a back panel, one color per game.
      box(w, 1.9, 0.08, "#1F1B26", 0, 0, -d / 2 + 0.04);
      const games = ["#40B589", "#3E8EDE", "#FF2E88", "#7A4FD6", "#FFF6E0"];
      games.forEach((c, r) => {
        box(w - 0.1, 0.03, 0.18, METAL, 0, 0.5 + r * 0.28, -d / 2 + 0.17);
        for (let i = 0; i < 5; i++) box(0.2, 0.24, 0.02, c, -w / 2 + 0.2 + i * 0.25, 0.53 + r * 0.28, -d / 2 + 0.12);
      });
      return { group: g };
    }
    case "starSign": {
      // The neon star on the back wall. It flickers, like it should.
      const pink = k.mat("#FF2E88", { emissive: "#FF2E88", emissiveIntensity: opts.night ? 1.6 : 0.9 });
      const star = new Mesh(k.geo(new ConeGeometry(0.28, 0.08, 5)), pink);
      star.rotation.x = Math.PI / 2;
      star.position.set(0, 2.25, 0);
      g.add(star);
      // A neon tube ring around it; the shop's name is already painted on the wall above the counter.
      const ring = new Mesh(k.geo(new TorusGeometry(0.42, 0.025, 6, 24)), pink);
      ring.position.set(0, 2.25, 0);
      g.add(ring);
      return { group: g, tick: (t) => { pink.emissiveIntensity = (opts.night ? 1.6 : 0.9) * (Math.sin(t * 13) > 0.97 ? 0.3 : 1); } };
    }
    case "lottoBoard": {
      // The published odds, painted on the wall: the same table as every card's back.
      let boardMat: Material = k.mat("#FFF6E0");
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 360; c.height = 256;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#FFF6E0"; x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#14111A"; x.font = "800 30px system-ui, sans-serif"; x.textAlign = "center";
          x.fillText("THE ODDS", c.width / 2, 40);
          x.font = "600 21px system-ui, sans-serif";
          const rows = [["Card back", "1 in 5"], ["2×", "1 in 10"], ["5×", "1 in 40"], ["20×", "1 in 400"], ["100×", "1 in 5,000"], ["1,000×", "1 in 100,000"]];
          rows.forEach(([a, b], i) => { x.textAlign = "left"; x.fillText(a, 30, 80 + i * 30); x.textAlign = "right"; x.fillText(b, c.width - 30, 80 + i * 30); });
          boardMat = k.mat("#ffffff", { map: new CanvasTexture(c) });
        }
      }
      box(w + 0.08, 1.3, 0.04, "#7A4FD6", 0, 0.95, -0.02);
      box(w, 1.22, 0.04, boardMat, 0, 0.99, 0.01);
      return { group: g };
    }
    // ---- v0.14 On Air: Real Clout FM's studio and Clout TV's control room ----
    case "micDesk": {
      // The broadcast desk: a mixing board, two monitors and the host's mic on a boom arm.
      box(w, 0.74, d, "#2A2530");
      box(w + 0.04, 0.04, d + 0.04, "#FF2E88", 0, 0.74);
      box(1.0, 0.06, 0.45, BLACK, 0, 0.78, 0.1);
      for (let i = 0; i < 8; i++) box(0.05, 0.03, 0.18, i % 3 ? METAL : "#FFB23D", -0.4 + i * 0.115, 0.84, 0.12);
      for (const x of [-0.95, 0.95]) {
        box(0.6, 0.38, 0.04, BLACK, x, 0.95, -0.25);
        box(0.54, 0.32, 0.02, glow("#7FC8E8", 0.8), x, 0.98, -0.22);
        box(0.06, 0.2, 0.06, METAL, x, 0.78, -0.27);
      }
      cyl(0.02, 0.02, 0.55, METAL, 0.2, 0.78, -0.15);
      const arm = box(0.03, 0.03, 0.55, METAL, 0.2, 1.3, 0.1);
      arm.rotation.x = -0.35;
      cyl(0.07, 0.06, 0.2, "#3A3540", 0.2, 1.18, 0.38, 12);
      return { group: g };
    }
    case "onAirSign": {
      // ON AIR, lit red-pink: always on (nobody knows where the switch is).
      let face: Material = glow("#FF2E88", 1.4);
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 96;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#FF2E88"; x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#FFF6E0"; x.font = "900 54px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
          x.fillText("ON AIR", c.width / 2, c.height / 2 + 2);
          face = k.mat("#ffffff", { map: new CanvasTexture(c), emissive: "#FF2E88", emissiveIntensity: opts.night ? 0.5 : 0.25 });
        }
      }
      box(w + 0.08, 0.6, 0.06, BLACK, 0, 1.9, -0.03);
      box(w, 0.52, 0.04, face, 0, 1.94, 0.02);
      return { group: g };
    }
    case "soundPanel": {
      // Acoustic foam in a checkerboard, so the jingles don't echo.
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        const tile = box(w / 6 - 0.03, 0.26, 0.08, (r + c) % 2 ? "#1A2B33" : "#24414C", -w / 2 + (c + 0.5) * (w / 6), 0.9 + r * 0.29, 0);
        tile.rotation.z = (r + c) % 2 ? Math.PI / 2 : 0;
      }
      return { group: g };
    }
    case "bigScreen": {
      // The control room's wall screen: Clout TV's ident ("Make it BIG in NY"), like the tower's.
      let face: Material = glow("#FF2E88", 0.9);
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 288;
        const x = c.getContext("2d");
        if (x) {
          const grad = x.createLinearGradient(0, 0, c.width, c.height);
          grad.addColorStop(0, "#FF6A3D"); grad.addColorStop(1, "#FF2E88");
          x.fillStyle = grad; x.fillRect(0, 0, c.width, c.height);
          x.textAlign = "center"; x.textBaseline = "middle";
          x.fillStyle = "#FFFFFF"; x.font = "900 74px system-ui, sans-serif";
          x.fillText("CLOUT", c.width / 2 - 52, 120);
          x.fillRect(c.width / 2 + 92, 82, 104, 78);
          x.fillStyle = "#14111A"; x.fillText("TV", c.width / 2 + 144, 124);
          x.fillStyle = "#FFF6E0"; x.font = "700 30px system-ui, sans-serif";
          x.fillText("Make it BIG in NY", c.width / 2, 210);
          face = k.mat("#ffffff", { map: new CanvasTexture(c), emissive: "#FFFFFF", emissiveIntensity: opts.night ? 0.35 : 0.15 });
        }
      }
      box(w + 0.12, 2.0, 0.08, BLACK, 0, 0.7, -0.04);
      box(w, 1.88, 0.04, face, 0, 0.76, 0.02);
      return { group: g };
    }
    case "tvCamera": {
      // A studio camera on a tripod, red tally light on top.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = box(0.04, 1.2, 0.04, METAL, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
        leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
      }
      box(0.32, 0.3, 0.55, BLACK, 0, 1.18, 0);
      cyl(0.11, 0.13, 0.2, "#3A3540", 0, 1.33, 0.36, 14).rotation.x = Math.PI / 2;
      box(0.06, 0.06, 0.06, glow("#FF2E88", 1.6), 0.1, 1.5, -0.15);
      return { group: g };
    }
    case "ringLight": {
      // The billboard photo spot: a ring light on a stand, glowing warm white.
      cyl(0.03, 0.03, 1.5, METAL, 0, 0, 0);
      const ring = new Mesh(k.geo(new TorusGeometry(0.32, 0.04, 8, 28)), glow("#FFF6E0", 1.4));
      ring.position.set(0, 1.62, 0);
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        box(0.3, 0.03, 0.04, METAL, Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14).rotation.y = -a;
      }
      return { group: g };
    }
    // ---- The Hub's game room ----
    case "arcade": {
      // An arcade cabinet in its own color: a lit screen, a control deck, a marquee on top.
      const body = color ?? "#3BB8C9";
      box(w, 1.7, d, BLACK);
      box(w + 0.02, 1.7, 0.04, body, 0, 0, d / 2 - 0.02);
      const scr = box(w - 0.24, 0.5, 0.04, glow(body, 1.1), 0, 1.0, d / 2);
      scr.rotation.x = -0.2;
      box(w - 0.1, 0.08, 0.3, "#2A2530", 0, 0.82, d / 2 + 0.1);
      cyl(0.04, 0.04, 0.1, "#FF2E88", -0.15, 0.9, d / 2 + 0.12);
      cyl(0.035, 0.035, 0.03, "#FFB23D", 0.1, 0.9, d / 2 + 0.12);
      cyl(0.035, 0.035, 0.03, "#3DDC97", 0.22, 0.9, d / 2 + 0.12);
      box(w, 0.22, 0.12, glow(body, 1.4), 0, 1.72, d / 2 - 0.06);
      return { group: g };
    }
    case "poolTable": {
      // Green felt, a wood rail, two cues and a rack of balls mid-game.
      for (const [x, z] of [[-w / 2 + 0.15, -d / 2 + 0.15], [w / 2 - 0.15, -d / 2 + 0.15], [-w / 2 + 0.15, d / 2 - 0.15], [w / 2 - 0.15, d / 2 - 0.15]]) box(0.14, 0.7, 0.14, WOOD_DARK, x, 0, z);
      box(w, 0.14, d, WOOD_DARK, 0, 0.7);
      box(w - 0.2, 0.03, d - 0.2, "#2E9E6A", 0, 0.84);
      const balls = ["#FFB23D", "#FF2E88", "#3BB8C9", "#14111A", "#FF6A3D", "#FFF6E0"];
      balls.forEach((b, i) => {
        const ball = new Mesh(k.geo(new SphereGeometry(0.045, 10, 8)), k.mat(b));
        ball.position.set(0.4 + (i % 3) * 0.1, 0.92, -0.1 + Math.floor(i / 3) * 0.1);
        g.add(ball);
      });
      const cue = box(1.5, 0.03, 0.03, WOOD, -0.2, 0.9, 0.3);
      cue.rotation.y = 0.3;
      return { group: g };
    }
    case "stairs": {
      // Stairs down (owner, Nov 20: "all stairs look like they're going up"): a stairwell, an opening in the floor with the
      // steps dropping away into the dark, railed on three sides and open where you step in.
      const down = /^(↓|⬇)/.test(item.label ?? "") || /\bdown/i.test(item.name ?? "");
      if (down) {
        const steps = 6;
        const base = new Color(color ?? WOOD_DARK);
        box(w + 0.12, 0.01, d + 0.12, "#14111A", 0, 0, 0);
        for (let i = 0; i < steps; i++) {
          const shade = base.clone().multiplyScalar(1 - (i / steps) * 0.85).getStyle();
          box(w - 0.08, 0.012, d / steps - 0.03, shade, 0, 0.004, d / 2 - (i + 0.5) * (d / steps));
          box(w - 0.08, 0.01, 0.025, new Color("#000000").lerp(base, 0.25 * (1 - i / steps)).getStyle(), 0, 0.006, d / 2 - (i + 1) * (d / steps) + 0.012);
        }
        for (const sx of [-1, 1]) {
          box(0.04, 0.9, d, METAL, sx * (w / 2 + 0.04), 0.02, 0);
          box(0.05, 0.05, d, METAL, sx * (w / 2 + 0.04), 0.92, 0);
        }
        box(w + 0.12, 0.9, 0.04, METAL, 0, 0.02, -d / 2 - 0.04);
        box(w + 0.12, 0.05, 0.05, METAL, 0, 0.92, -d / 2 - 0.04);
        return { group: g };
      }
      // Stairs up (v0.11 the exclusive venue): a short flight rising toward the back, with a rail on one side.
      const steps = 6;
      for (let i = 0; i < steps; i++) box(w, 0.22 * (i + 1), d / steps, color ?? WOOD_DARK, 0, 0, d / 2 - (i + 0.5) * (d / steps));
      box(0.05, 0.9, d, METAL, w / 2 - 0.03, 0.22 * steps * 0.5, 0);
      return { group: g };
    }
    // ---- #19 bigger homes ----
    case "bathtub": {
      const enamel = "#F4F6F8";
      box(w, 0.5, d, enamel);
      box(w - 0.16, 0.04, d - 0.16, k.mat("#8EC9E0", { emissive: "#8EC9E0", emissiveIntensity: 0.15, roughness: 0.1 }), 0, 0.44, 0);
      box(w, 0.06, 0.08, enamel, 0, 0.5, -d / 2 + 0.04);
      box(w, 0.06, 0.08, enamel, 0, 0.5, d / 2 - 0.04);
      cyl(0.025, 0.025, 0.3, METAL, w / 2 - 0.15, 0.5, -d / 2 + 0.1, 6);
      return { group: g };
    }
    case "toilet": {
      const enamel = "#F4F6F8";
      box(0.42, 0.42, 0.5, enamel, 0, 0, 0.06);
      box(0.38, 0.03, 0.44, "#E4E8EC", 0, 0.42, 0.08);
      box(0.44, 0.44, 0.18, enamel, 0, 0.36, -d / 2 + 0.09);
      return { group: g, seatY: 0.45 };
    }
    case "bathSink": {
      box(w, 0.8, d, "#E9E4DA");
      box(w - 0.12, 0.06, d - 0.14, "#F4F6F8", 0, 0.8, 0.02);
      cyl(0.015, 0.015, 0.16, METAL, 0, 0.86, -d / 2 + 0.08, 6);
      // The mirror, on the wall behind.
      box(w - 0.1, 0.6, 0.03, k.mat("#CFE3EC", { roughness: 0.05, metalness: 0.5, emissive: "#CFE3EC", emissiveIntensity: opts.night ? 0.2 : 0.08 }), 0, 1.15, -d / 2 + 0.02);
      return { group: g };
    }
    // ---- Tower offices (owner, Oct 31: "multiple floors, swanky design, cubicles, display glass, robots") ----
    // A cubicle: chest-high fabric partitions on three sides, a desk along the back with a monitor, a chair inside.
    case "cubicle": {
      const panel = color ?? "#8B95A6";
      const h = 1.15;
      for (const sx of [-1, 1]) box(0.05, h, d, panel, sx * (w / 2 - 0.025), 0, 0);
      box(w, h, 0.05, panel, 0, 0, -d / 2 + 0.025);
      for (const sx of [-1, 1]) box(0.06, 0.04, d, METAL, sx * (w / 2 - 0.025), h, 0);
      box(w - 0.12, 0.04, 0.6, "#E8E2D6", 0, 0.72, -d / 2 + 0.36);
      box(0.05, 0.72, 0.5, METAL, -w / 2 + 0.2, 0, -d / 2 + 0.36);
      box(0.05, 0.72, 0.5, METAL, w / 2 - 0.2, 0, -d / 2 + 0.36);
      const screen = box(0.55, 0.34, 0.03, glow("#7FB8FF", opts.night ? 0.8 : 0.45), 0, 0.92, -d / 2 + 0.22);
      box(0.06, 0.18, 0.06, BLACK, 0, 0.76, -d / 2 + 0.25);
      box(0.4, 0.02, 0.14, "#2A2530", 0, 0.76, -d / 2 + 0.5);
      box(0.12, 0.1, 0.08, "#F4F1EA", w / 2 - 0.35, 0.76, -d / 2 + 0.3);
      box(0.46, 0.06, 0.46, "#2A2F3A", 0, 0.44, 0.1);
      box(0.46, 0.5, 0.06, "#2A2F3A", 0, 0.47, 0.33);
      cyl(0.03, 0.03, 0.44, METAL, 0, 0, 0.1, 6);
      return { group: g, seatY: 0.5, tick: (t) => { (screen.material as MeshStandardMaterial).emissiveIntensity = (opts.night ? 0.8 : 0.45) + Math.sin(t * 1.3 + item.x) * 0.08; } };
    }
    // Display glass: a floor-to-ceiling glass panel in a thin steel frame.
    case "glassWall": {
      box(w, 2.4, 0.04, k.mat("#BFE3F2", { opacity: 0.28, roughness: 0.05, metalness: 0.3 }), 0, 0, 0);
      box(w, 0.06, 0.08, METAL, 0, 0, 0);
      box(w, 0.05, 0.08, METAL, 0, 2.38, 0);
      for (const sx of [-1, 0, 1]) box(0.05, 2.4, 0.08, METAL, sx * (w / 2 - 0.025), 0, 0);
      box(w * 0.5, 0.05, 0.05, k.mat("#F4F6F8", { opacity: 0.6 }), 0, 1.3, 0.03);
      return { group: g };
    }
    // A glass display case on a plinth, the company's latest gadget (or trophy) glowing inside.
    case "displayCase": {
      box(w, 0.8, d, "#F4F1EA");
      box(w - 0.04, 0.03, d - 0.04, "#2A2530", 0, 0.8, 0);
      box(w - 0.08, 0.7, d - 0.08, k.mat("#DDEFF6", { opacity: 0.25, roughness: 0.05 }), 0, 0.83, 0);
      const gem = new Mesh(k.geo(new DodecahedronGeometry(0.16)), glow(color ?? "#7FE0FF", 0.8));
      gem.position.set(0, 1.12, 0);
      g.add(gem);
      return { group: g, tick: (t) => { gem.rotation.y = t * 0.8; gem.position.y = 1.12 + Math.sin(t * 1.5) * 0.04; } };
    }
    // A robot: a white body on a wheeled base, a screen face with two glowing eyes, bobbing and turning on the spot.
    case "robot": {
      const bot = new Group();
      const part = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number) => { const m = new Mesh(k.geo(geo), mat); m.position.set(x, y, z); bot.add(m); return m; };
      part(new CylinderGeometry(0.24, 0.26, 0.12, 14), k.mat("#2A2F3A"), 0, 0.06, 0);
      part(new CylinderGeometry(0.2, 0.24, 0.62, 14), k.mat("#F4F6F8", { roughness: 0.3 }), 0, 0.43, 0);
      part(new SphereGeometry(0.2, 14, 10), k.mat("#F4F6F8", { roughness: 0.3 }), 0, 0.88, 0);
      part(new BoxGeometry(0.26, 0.14, 0.04), k.mat("#14111A", { roughness: 0.2 }), 0, 0.9, 0.17);
      const eye = glow(color ?? "#3DDC97", 1.2);
      part(new SphereGeometry(0.025, 8, 6), eye, -0.06, 0.91, 0.195);
      part(new SphereGeometry(0.025, 8, 6), eye, 0.06, 0.91, 0.195);
      part(new CylinderGeometry(0.01, 0.01, 0.14, 6), k.mat(METAL), 0, 1.12, 0);
      const tip = part(new SphereGeometry(0.035, 8, 6), glow("#FF6A3D", 1.2), 0, 1.2, 0);
      part(new BoxGeometry(0.3, 0.04, 0.24), k.mat(METAL), 0, 0.62, 0.18);
      g.add(bot);
      return { group: g, tick: (t) => {
        bot.position.y = Math.abs(Math.sin(t * 2 + item.x)) * 0.03;
        bot.rotation.y = Math.sin(t * 0.5 + item.z) * 0.9;
        (tip.material as MeshStandardMaterial).emissiveIntensity = 0.6 + (Math.sin(t * 5) > 0 ? 0.8 : 0);
      } };
    }
    // A server rack: a black cabinet with rows of blinking lights.
    case "serverRack": {
      box(w, 2.0, d, "#1C1F26");
      box(w - 0.08, 1.85, 0.02, "#2A2F3A", 0, 0.08, d / 2 + 0.005);
      const leds: Mesh[] = [];
      for (let r = 0; r < 9; r++) {
        box(w - 0.16, 0.03, 0.01, "#3A3F4A", 0, 0.2 + r * 0.19, d / 2 + 0.02);
        for (let c = 0; c < 3; c++) leds.push(box(0.04, 0.04, 0.01, glow(c === 2 ? "#FF6A3D" : "#3DDC97", 1), -w / 2 + 0.16 + c * 0.08, 0.26 + r * 0.19, d / 2 + 0.02));
      }
      return { group: g, tick: (t) => leds.forEach((m, i) => { m.visible = Math.sin(t * (3 + (i % 5)) + i * 1.7) > -0.3; }) };
    }
    // The elevator bank's doors: brushed steel, a floor indicator above that glows.
    case "elevator": {
      box(w, 2.5, d, "#C9CDD4", 0, 0, 0);
      box(w * 0.82, 2.15, 0.04, k.mat("#D8DCE2", { metalness: 0.6, roughness: 0.3 }), 0, 0, d / 2 + 0.01);
      box(0.02, 2.15, 0.05, "#9AA0A8", 0, 0, d / 2 + 0.02);
      box(0.36, 0.14, 0.03, glow("#FF6A3D", 0.9), 0, 2.25, d / 2 + 0.02);
      box(0.08, 0.16, 0.03, BLACK, w / 2 - 0.12, 1.1, d / 2 + 0.02);
      box(0.04, 0.04, 0.02, glow("#F4F1EA", 0.8), w / 2 - 0.12, 1.15, d / 2 + 0.035);
      return { group: g };
    }
    // #19 clubs: a restroom stall, side panels and a door left ajar, with legs showing underneath.
    case "stall": {
      const panel = color ?? "#3A2C5E";
      for (const sx of [-1, 1]) box(0.04, 1.75, d, panel, sx * (w / 2 - 0.02), 0.15, 0);
      box(w, 1.75, 0.04, panel, 0, 0.15, -d / 2 + 0.02);
      const door = box(w * 0.62, 1.6, 0.04, panel, -w * 0.12, 0.2, d / 2 - 0.02);
      door.rotation.y = 0.35;
      box(w * 0.3, 1.6, 0.04, panel, w / 2 - w * 0.15, 0.2, d / 2 - 0.02);
      box(0.3, 0.38, 0.4, "#F4F6F8", 0, 0, -d / 2 + 0.3);
      box(0.08, 0.04, 0.02, glow("#40B589", 0.8), w / 2 - 0.12, 1.2, d / 2 + 0.01);
      return { group: g };
    }
    case "kitchenIsland": {
      box(w, 0.88, d - 0.2, "#F4F1EA", 0, 0, -0.1);
      box(w + 0.06, 0.05, d, "#2A2530", 0, 0.88, 0);
      for (const x of [-w / 4, w / 4]) {
        cyl(0.16, 0.16, 0.05, BLACK, x, 0.62, d / 2 + 0.12, 10);
        cyl(0.025, 0.025, 0.62, METAL, x, 0, d / 2 + 0.12, 6);
      }
      return { group: g };
    }
    case "painting": {
      // Wall art (migration 0120): a gilt frame hung against the wall behind the piece's spot, the picture drawn onto a
      // canvas once it loads (tests have no canvas, so they keep the plain cream board).
      const fw = 1.0, fh = 0.75, y0 = 1.15, back = -d / 2;
      box(fw + 0.1, fh + 0.1, 0.05, item.color ?? "#B08D57", 0, y0 - 0.05, back + 0.025);
      let face: Material = k.mat("#ECE6DC");
      if (typeof document !== "undefined" && item.art) {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 384;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#ECE6DC"; x.fillRect(0, 0, c.width, c.height);
          const tex = new CanvasTexture(c);
          tex.colorSpace = SRGBColorSpace;
          face = k.mat("#ffffff", { map: tex, roughness: 0.9 });
          const img = new Image();
          img.onload = () => { x.drawImage(img, 0, 0, c.width, c.height); tex.needsUpdate = true; };
          img.src = item.art;
        }
      }
      box(fw, fh, 0.012, face, 0, y0, back + 0.056);
      return { group: g };
    }
    case "nightstand": {
      box(w, 0.5, d, WOOD_DARK);
      box(w - 0.08, 0.02, 0.01, WOOD, 0, 0.3, d / 2 + 0.005);
      cyl(0.03, 0.05, 0.16, "#E8C79A", 0, 0.5, 0, 8);
      cyl(0.1, 0.13, 0.14, glow("#FFE3B0", 0.6), 0, 0.66, 0, 10);
      return { group: g };
    }
    case "hotTub": {
      box(w, 0.6, d, "#8A6A52");
      box(w - 0.24, 0.05, d - 0.24, k.mat("#7FD3E6", { emissive: "#7FD3E6", emissiveIntensity: opts.night ? 0.6 : 0.3, roughness: 0.1 }), 0, 0.56, 0);
      return { group: g, seatY: 0.45 };
    }
    case "railing": {
      box(w, 0.05, 0.05, METAL, 0, 0.95, 0);
      box(w, 0.04, 0.04, METAL, 0, 0.5, 0);
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.8) box(0.05, 1.0, 0.05, METAL, x, 0, 0);
      return { group: g };
    }
    // ---- Campaign HQ (owner, Nov 20) ----
    case "phoneBank": {
      // A long volunteers' table: three desk phones, three laptops, call sheets and a coffee cup each.
      box(w, 0.05, d, "#F4F2EE", 0, 0.72);
      for (const sx of [-1, 1]) box(0.06, 0.72, d - 0.1, METAL, sx * (w / 2 - 0.1), 0, 0);
      box(w - 0.3, 0.3, 0.03, "#D9D3C8", 0, 0.4, -d / 2 + 0.06);
      for (const i of [-1, 0, 1]) {
        const x = i * 0.85;
        box(0.22, 0.06, 0.16, BLACK, x - 0.22, 0.77, -0.12);
        box(0.2, 0.03, 0.05, "#2B2B33", x - 0.22, 0.83, -0.16);
        box(0.34, 0.02, 0.24, "#C9CED6", x + 0.12, 0.77, 0.02);
        const lid = box(0.34, 0.22, 0.015, k.mat("#2B2B33"), x + 0.12, 0.78, -0.1);
        lid.rotation.x = -0.25;
        box(0.3, 0.17, 0.005, glow("#9FD4FF", 0.5), x + 0.12, 0.81, -0.085).rotation.x = -0.25;
        box(0.18, 0.005, 0.24, "#FFFFFF", x - 0.2, 0.775, 0.14);
        cyl(0.035, 0.03, 0.09, "#C62C3B", x + 0.36, 0.77, 0.15, 8);
      }
      return { group: g };
    }
    case "warTable": {
      // The war room's big table with the city's map on it, pins in the swing districts.
      box(w, 0.08, d, WOOD_DARK, 0, 0.72);
      for (const sx of [-1, 1]) box(0.16, 0.72, d - 0.4, WOOD_DARK, sx * (w / 2 - 0.4), 0, 0);
      let face: Material = k.mat("#E8E1CF");
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 256;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#E8E1CF"; x.fillRect(0, 0, 512, 256);
          x.fillStyle = "#9FC7E8"; x.fillRect(150, 0, 60, 256); x.fillRect(0, 180, 512, 30);
          const blobs: [number, number, number, number, string][] = [[60, 60, 80, 90, "#E9A8A0"], [260, 40, 140, 110, "#A8C0E9"], [300, 210, 160, 40, "#E9A8A0"], [40, 210, 90, 40, "#A8C0E9"], [420, 70, 70, 80, "#E9D29A"]];
          for (const [bx, by, bw, bh, col] of blobs) { x.fillStyle = col; x.fillRect(bx, by, bw, bh); }
          x.strokeStyle = "#5A4A3A"; x.lineWidth = 2;
          for (const [bx, by, bw, bh] of blobs) x.strokeRect(bx, by, bw, bh);
          for (const [px, py, col] of [[100, 100, "#C62C3B"], [320, 90, "#2F5BBF"], [360, 120, "#C62C3B"], [450, 100, "#2F5BBF"], [380, 225, "#C62C3B"]] as const) {
            x.fillStyle = col; x.beginPath(); x.arc(px, py, 9, 0, Math.PI * 2); x.fill();
          }
          const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
          face = k.mat("#ffffff", { map: tex, roughness: 0.8 });
        }
      }
      box(w - 0.3, 0.01, d - 0.3, face, 0, 0.8);
      for (const [x, z] of [[-1.2, -0.4], [0.8, 0.3], [1.4, -0.5]]) cyl(0.05, 0.05, 0.1, "#F4F1EA", x, 0.81, z, 8);
      return { group: g };
    }
    case "pressBackdrop": {
      // The step-and-repeat: a wall of VOTE logos in the campaign's red and blue, on two posts.
      let face: Material = k.mat("#F4F2EE");
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 320;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#F4F2EE"; x.fillRect(0, 0, 512, 320);
          x.textAlign = "center"; x.textBaseline = "middle"; x.font = "900 34px system-ui, sans-serif";
          for (let r = 0; r < 5; r++) for (let col = 0; col < 4; col++) {
            x.fillStyle = (r + col) % 2 ? "#2F5BBF" : "#C62C3B";
            x.fillText((r + col) % 2 ? "★ QNS ★" : "VOTE", 64 + col * 128 + (r % 2 ? 32 : 0), 34 + r * 64);
          }
          const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
          face = k.mat("#ffffff", { map: tex, roughness: 0.8 });
        }
      }
      box(w, 2.2, 0.04, face, 0, 0.1, 0);
      for (const sx of [-1, 1]) box(0.06, 2.4, 0.06, METAL, sx * (w / 2), 0, 0.03);
      box(w + 0.3, 0.04, 0.5, METAL, 0, 0, 0.1);
      return { group: g };
    }
    case "campaignBanner": {
      // A long banner on the wall: red, white and blue stripes and a big star.
      const y0 = 1.55;
      box(w, 0.7, 0.03, "#F4F2EE", 0, y0, -d / 2 + 0.02);
      box(w, 0.16, 0.035, "#C62C3B", 0, y0, -d / 2 + 0.025);
      box(w, 0.16, 0.035, "#2F5BBF", 0, y0 + 0.54, -d / 2 + 0.025);
      const star = new Mesh(k.geo(new CylinderGeometry(0.2, 0.2, 0.03, 5)), k.mat("#C62C3B"));
      star.rotation.x = Math.PI / 2;
      star.position.set(0, y0 + 0.35, -d / 2 + 0.05);
      g.add(star);
      for (const sx of [-1, 1]) box(0.36, 0.08, 0.035, "#2F5BBF", sx * 0.7, y0 + 0.31, -d / 2 + 0.03);
      return { group: g };
    }
    case "flagStand": {
      // A flag on a pole with a gold finial, in a heavy round base.
      cyl(0.16, 0.18, 0.06, "#3A3A40");
      cyl(0.018, 0.018, 2.1, "#C9A227", 0, 0.06, 0, 6);
      const ball = new Mesh(k.geo(new SphereGeometry(0.045, 8, 6)), k.mat("#C9A227", { metalness: 0.6, roughness: 0.3 }));
      ball.position.set(0, 2.2, 0); g.add(ball);
      const flag = new Group();
      flag.position.set(0.02, 1.55, 0);
      const stripe = (y: number, c: string) => { const m = new Mesh(k.geo(new BoxGeometry(0.6, 0.11, 0.01)), k.mat(c)); m.position.set(0.3, y, 0); flag.add(m); };
      [0.28, 0.17, 0.06, -0.05].forEach((y, i) => stripe(y, i % 2 ? "#F4F2EE" : "#C62C3B"));
      const canton = new Mesh(k.geo(new BoxGeometry(0.24, 0.2, 0.012)), k.mat("#2F5BBF"));
      canton.position.set(0.13, 0.23, 0.001); flag.add(canton);
      g.add(flag);
      return { group: g, tick: (t) => { flag.rotation.y = Math.sin(t * 1.3 + item.x) * 0.18; } };
    }
    case "pendantLamp": {
      // A pendant lamp hanging from the ceiling: a long cord, a brass dome and a warm glow under it.
      cyl(0.006, 0.006, 0.6, BLACK, 0, 2.1, 0, 4);
      cyl(0.06, 0.26, 0.22, k.mat("#C9A227", { metalness: 0.5, roughness: 0.35 }), 0, 1.9, 0, 14);
      const bulb = new Mesh(k.geo(new SphereGeometry(0.08, 10, 8)), glow("#FFE3B0", 1.6));
      bulb.position.set(0, 1.88, 0); g.add(bulb);
      return { group: g };
    }
    case "waterCooler": {
      cyl(0.17, 0.17, 0.9, "#E8ECEF", 0, 0, 0, 10);
      cyl(0.16, 0.16, 0.42, k.mat("#7FB8E6", { opacity: 0.75, roughness: 0.1 }), 0, 0.9, 0, 12);
      box(0.06, 0.05, 0.06, "#2F5BBF", -0.06, 0.55, 0.17);
      box(0.06, 0.05, 0.06, "#C62C3B", 0.06, 0.55, 0.17);
      return { group: g };
    }
    case "pollBoard": {
      // The war room's wall screen: tonight's poll as bars, citywide and by borough.
      let face: Material = glow("#1F2A44", 0.4);
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 256;
        const x = c.getContext("2d");
        if (x) {
          x.fillStyle = "#14192A"; x.fillRect(0, 0, 512, 256);
          x.fillStyle = "#FFFFFF"; x.font = "800 26px system-ui, sans-serif"; x.fillText("TONIGHT'S POLL", 24, 40);
          const rows: [string, number, number][] = [["CITY", 0.42, 0.45], ["QUEENS", 0.38, 0.47], ["BROOKLYN", 0.4, 0.44], ["BRONX", 0.36, 0.5]];
          rows.forEach(([name, you, mayor], i) => {
            const y = 70 + i * 44;
            x.fillStyle = "#AFC0DA"; x.font = "700 18px system-ui, sans-serif"; x.fillText(name, 24, y + 18);
            x.fillStyle = "#FF5A6A"; x.fillRect(150, y, 330 * you, 14);
            x.fillStyle = "#4F86FF"; x.fillRect(150, y + 18, 330 * mayor, 14);
          });
          const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
          const m = k.mat("#ffffff", { map: tex, emissive: "#ffffff", emissiveIntensity: opts.night ? 0.5 : 0.3 }) as MeshStandardMaterial;
          m.emissiveMap = tex;
          face = m;
        }
      }
      box(w, 1.6, 0.08, BLACK, 0, 0.9, 0);
      box(w - 0.12, 1.48, 0.01, face, 0, 0.96, 0.045);
      return { group: g };
    }
    case "rallyStage": {
      // A raised stage with a skirt of bunting, the podium in the middle and the backdrop behind.
      box(w, 0.4, d, "#2F3A55");
      for (let i = 0; i < 12; i++) box(w / 12 - 0.02, 0.18, 0.02, i % 2 ? "#F4F2EE" : "#C62C3B", -w / 2 + (i + 0.5) * (w / 12), 0.2, d / 2 + 0.01);
      box(w - 0.6, 0.02, d - 0.6, "#C62C3B", 0, 0.4, 0);
      box(0.7, 1.1, 0.5, WOOD_DARK, 0, 0.4, 0.4);
      box(0.6, 0.08, 0.3, "#2F5BBF", 0, 1.32, 0.4);
      cyl(0.012, 0.012, 0.3, METAL, 0.12, 1.5, 0.3, 5);
      box(w * 0.8, 1.9, 0.06, "#2F5BBF", 0, 0.4, -d / 2 + 0.1);
      box(w * 0.8 - 0.3, 0.5, 0.07, "#F4F2EE", 0, 1.3, -d / 2 + 0.1);
      for (let i = -3; i <= 3; i++) {
        const s = new Mesh(k.geo(new CylinderGeometry(0.1, 0.1, 0.02, 5)), k.mat("#C62C3B"));
        s.rotation.x = Math.PI / 2; s.position.set(i * 0.55, 1.55, -d / 2 + 0.14); g.add(s);
      }
      return { group: g, seatY: 0.4 };
    }
    case "stringLights": {
      // Warm bulbs on a sagging wire across the roof, between two poles.
      for (const sx of [-1, 1]) cyl(0.03, 0.03, 2.8, BLACK, sx * w / 2, 0, 0, 6);
      const bulb = glow("#FFD58A", 1.8);
      const n = Math.round(w / 0.6);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = -w / 2 + t * w, y = 2.75 - Math.sin(t * Math.PI) * 0.6;
        const m = new Mesh(k.geo(new SphereGeometry(0.05, 6, 5)), bulb);
        m.position.set(x, y, 0); g.add(m);
      }
      return { group: g };
    }
    case "patioUmbrella": {
      // A round patio table under a striped umbrella, two chairs.
      cyl(0.4, 0.4, 0.04, "#F4F2EE", 0, 0.72, 0, 14);
      cyl(0.03, 0.03, 0.72, METAL, 0, 0, 0, 6);
      cyl(0.02, 0.02, 2.3, METAL, 0, 0.72, 0, 6);
      for (let i = 0; i < 8; i++) {
        const seg = new Mesh(k.geo(new ConeGeometry(0.95, 0.35, 8, 1, true, (i * Math.PI) / 4, Math.PI / 4)), k.mat(i % 2 ? "#F4F2EE" : "#C62C3B"));
        seg.position.set(0, 2.3, 0); g.add(seg);
      }
      for (const sx of [-1, 1]) { box(0.4, 0.05, 0.4, "#F4F2EE", sx * 0.65, 0.45, 0); box(0.4, 0.4, 0.05, "#F4F2EE", sx * 0.65, 0.45, -0.18); legs4(0.4, 0.4, 0.45, METAL, 0.015); }
      return { group: g };
    }
    case "sectional": {
      // An L-shaped sofa (the box-built stand-in for the modeled one): a long seat and a chaise.
      const c = color ?? "#EDE6D6";
      box(w, 0.42, 0.9, c, 0, 0, -d / 2 + 0.45);
      box(w, 0.5, 0.2, c, 0, 0.38, -d / 2 + 0.1);
      box(0.95, 0.42, d - 0.9, c, w / 2 - 0.475, 0, 0.45);
      return { group: g, seatY: 0.5 };
    }
    case "djStage": {
      // The DJ stage (owner, Nov 20, the references): a raised white deck with a lit front edge, the DJ's table of decks in the
      // middle, steps at the sides and a CO2 cannon at each front corner that fires a white plume every few seconds.
      const H = 0.6;
      box(w, H, d, "#EDEAF2");
      const edge = box(w + 0.02, 0.07, 0.06, glow("#FF2E88", 1.6), 0, H - 0.1, d / 2 + 0.01);
      box(w + 0.02, 0.05, 0.05, glow("#8A5CFF", 1.4), 0, 0.06, d / 2 + 0.01);
      box(2.6, 0.95, 0.8, "#14111A", 0, H, -0.35);
      box(2.62, 0.05, 0.82, glow("#3DDC97", 1.0), 0, H + 0.95, -0.35);
      for (const x of [-0.75, 0.75]) cyl(0.24, 0.24, 0.03, "#2A2A33", x, H + 1.0, -0.4, 16);
      box(0.6, 0.04, 0.35, glow("#6CC4FF", 0.9), 0, H + 1.0, -0.4);
      const plumes: Mesh[] = [];
      for (const sx of [-1, 1]) {
        cyl(0.12, 0.14, 0.5, "#2A2A33", sx * (w / 2 - 0.35), H, d / 2 - 0.3, 10);
        const p = new Mesh(k.geo(new ConeGeometry(0.45, 2.4, 10, 1, true)), new MeshStandardMaterial({ color: "#FFFFFF", transparent: true, opacity: 0, emissive: "#FFFFFF", emissiveIntensity: 0.6, depthWrite: false }));
        p.rotation.x = Math.PI; p.position.set(sx * (w / 2 - 0.35), H + 0.5 + 1.2, d / 2 - 0.3); g.add(p); plumes.push(p);
      }
      return {
        group: g,
        tick: (t) => {
          (edge.material as MeshStandardMaterial).emissive.setHSL((t * 0.1) % 1, 0.9, 0.55);
          const c = t % 7, on = c < 1.4 ? Math.sin((c / 1.4) * Math.PI) : 0;
          plumes.forEach((p) => { (p.material as MeshStandardMaterial).opacity = on * 0.75; p.scale.setScalar(0.6 + on * 0.6); p.visible = on > 0.02; });
        },
      };
    }
    case "gogoPodium": {
      // A round lit podium for a go-go dancer: a glowing ring at the base and the top, the column between pulsing with the beat.
      const H = 0.9;
      const col = cyl(0.5, 0.56, H, k.mat("#1B1626", { emissive: "#FF2E88", emissiveIntensity: 0.25 }).clone(), 0, 0, 0, 20);
      const top = cyl(0.56, 0.56, 0.05, glow("#FFFFFF", 1.4), 0, H, 0, 20);
      const ring = new Mesh(k.geo(new TorusGeometry(0.56, 0.03, 6, 28)), glow("#FF2E88", 1.8).clone());
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      return {
        group: g,
        tick: (t) => {
          const hue = (t * 0.12 + item.x * 0.05) % 1;
          (ring.material as MeshStandardMaterial).emissive.setHSL(hue, 0.9, 0.55);
          (col.material as MeshStandardMaterial).emissive.setHSL(hue, 0.9, 0.3);
          (top.material as MeshStandardMaterial).emissiveIntensity = 0.9 + (Math.floor(t * 2.2) % 2) * 0.6;
        },
      };
    }
    case "ledWall": {
      // A video wall high on the wall: moving color bars and a pulsing glow, like the screens in the references.
      const c = document.createElement("canvas");
      c.width = 256; c.height = 64;
      const x2 = c.getContext("2d")!;
      for (let i = 0; i < 16; i++) {
        x2.fillStyle = `hsl(${(i * 47) % 360} 90% ${i % 3 ? 45 : 65}%)`;
        x2.fillRect(i * 16, 0, 16, 64);
      }
      x2.fillStyle = "rgba(0,0,0,0.35)";
      for (let y = 0; y < 64; y += 4) x2.fillRect(0, y, 256, 1);
      const tex = new CanvasTexture(c);
      tex.colorSpace = SRGBColorSpace; tex.wrapS = RepeatWrapping;
      const screenMat = new MeshStandardMaterial({ color: "#000000", map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 1.1 });
      box(w + 0.1, 1.5, 0.08, "#0B0910", 0, 1.15, 0);
      const screen = box(w - 0.1, 1.38, 0.02, screenMat, 0, 1.21, 0.05);
      return {
        group: g,
        tick: (t) => { tex.offset.x = (t * 0.06) % 1; tex.repeat.x = 0.6 + Math.sin(t * 0.4) * 0.15; (screen.material as MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(t * 4.4) * 0.25; },
      };
    }
    case "clubPillar": {
      // A tall dark mirrored column with LED strips up its corners, color cycling.
      box(w, 2.7, d, k.mat("#1A1622", { metalness: 0.6, roughness: 0.25 }));
      const strips: Mesh[] = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strips.push(box(0.04, 2.6, 0.04, glow("#8A5CFF", 1.6).clone(), sx * (w / 2), 0.05, sz * (d / 2)));
      return { group: g, tick: (t) => strips.forEach((m, i) => (m.material as MeshStandardMaterial).emissive.setHSL((t * 0.08 + i * 0.07 + item.z * 0.03) % 1, 0.9, 0.55)) };
    }
    case "velvetRope": {
      // Brass stanchions and a red velvet rope: the VIP section's edge.
      const brass = k.mat("#C9A227", { metalness: 0.6, roughness: 0.3 });
      const n = 3;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.1 + (i * (w - 0.2)) / (n - 1);
        cyl(0.12, 0.14, 0.04, brass, x, 0, 0, 12);
        cyl(0.025, 0.025, 0.9, brass, x, 0.04, 0, 8);
        const knob = new Mesh(k.geo(new SphereGeometry(0.05, 8, 6)), brass); knob.position.set(x, 0.96, 0); g.add(knob);
      }
      const span = (w - 0.2) / (n - 1);
      for (let i = 0; i < n - 1; i++) {
        const x = -w / 2 + 0.1 + span * (i + 0.5);
        const rope = new Mesh(k.geo(new TorusGeometry(span / 2, 0.025, 6, 16, Math.PI)), k.mat(color ?? "#9B1B30"));
        rope.position.set(x, 0.88, 0); rope.rotation.z = Math.PI; rope.scale.y = 0.45; g.add(rope);
      }
      return { group: g };
    }
    case "heatLamp": {
      // A patio heater: a tall steel pole, a reflector hat and a glowing element under it.
      cyl(0.22, 0.25, 0.08, METAL, 0, 0, 0, 12);
      cyl(0.035, 0.035, 2.1, METAL, 0, 0.08, 0, 8);
      const el = cyl(0.12, 0.12, 0.3, glow("#FF7A2E", 1.8), 0, 1.75, 0, 10);
      const hat = new Mesh(k.geo(new ConeGeometry(0.42, 0.22, 14, 1, true)), k.mat("#B8B2A8", { metalness: 0.6, roughness: 0.3 }));
      hat.position.y = 2.25; g.add(hat);
      return { group: g, tick: (t) => { (el.material as MeshStandardMaterial).emissiveIntensity = (opts.night ? 1.8 : 1.0) + Math.sin(t * 2.3 + item.x) * 0.2; } };
    }
    case "roundDining": {
      // A round marble table and four chairs (the box-built stand-in for the modeled dining set).
      cyl(0.5, 0.5, 0.04, "#EDEAE4", 0, 0.72, 0, 18);
      cyl(0.06, 0.18, 0.72, BLACK, 0, 0, 0, 10);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4, cx = Math.cos(a) * 0.75, cz = Math.sin(a) * 0.75;
        box(0.42, 0.06, 0.42, "#CBBFA9", cx, 0.45, cz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.015, 0.015, 0.45, METAL, cx + sx * 0.17, 0, cz + sz * 0.17, 6);
        box(0.42, 0.42, 0.05, "#CBBFA9", cx - Math.cos(a) * 0.19, 0.5, cz - Math.sin(a) * 0.19).lookAt(0, 0.7, 0);
      }
      return { group: g };
    }
    case "planter": {
      // A long timber planter with clipped shrubs.
      box(w, 0.55, d, "#6B4A2B");
      box(w - 0.06, 0.04, d - 0.06, "#3A2A1E", 0, 0.55, 0);
      const n = Math.max(2, Math.round(w / 0.45));
      for (let i = 0; i < n; i++) {
        const b = new Mesh(k.geo(new DodecahedronGeometry(0.24)), k.mat(i % 2 ? "#4E7A3A" : "#5E8C45"));
        b.position.set(-w / 2 + (w * (i + 0.5)) / n, 0.78, 0); b.scale.y = 0.85; g.add(b);
      }
      return { group: g };
    }
    case "subwayTrack": {
      // The elevated tracks behind the platform edge, the room's width (owner, Nov 20: just the place itself), and a three-car
      // train that pulls in, opens its doors, waits and leaves, on a loop (36 s), cut off at the room's edges as it comes and
      // goes (clipping planes; Room3D turns local clipping on). The platform's yellow edge strip is here too.
      const RUN = w;
      box(RUN, 0.25, d, "#3A3632", 0, -0.2, 0);
      for (let x = -RUN / 2; x < RUN / 2; x += 0.7) box(0.18, 0.06, d - 0.4, "#5A4A3A", x, 0.05, 0);
      for (const z of [-0.72, 0.72]) box(RUN, 0.09, 0.07, METAL, 0, 0.11, z);
      box(RUN, 0.06, 0.1, "#8A8478", 0, 0.08, 1.25);
      box(w, 0.03, 0.4, "#FFC21A", 0, 0.0, d / 2 + 0.2);
      const train = new Group();
      const CAR = 7.6, GAP = 0.25, steel = k.mat("#C9CED6", { metalness: 0.55, roughness: 0.35 });
      const doors: Mesh[] = [];
      const lit = glow("#FFF2C8", 0.9);
      for (let c = 0; c < 3; c++) {
        const cx = (c - 1) * (CAR + GAP);
        const body = new Mesh(k.geo(new BoxGeometry(CAR, 2.5, 2.6)), steel); body.position.set(cx, 1.55, 0); train.add(body);
        const roof = new Mesh(k.geo(new BoxGeometry(CAR - 0.1, 0.18, 2.4)), k.mat("#8A8F98")); roof.position.set(cx, 2.88, 0); train.add(roof);
        const stripe = new Mesh(k.geo(new BoxGeometry(CAR + 0.01, 0.12, 2.62)), k.mat("#FFC21A")); stripe.position.set(cx, 1.05, 0); train.add(stripe);
        for (const wx of [-2.9, -0.95, 0.95, 2.9]) {
          const win2 = new Mesh(k.geo(new BoxGeometry(1.2, 0.7, 0.02)), lit); win2.position.set(cx + wx, 2.05, 1.31); train.add(win2);
        }
        for (const dx of [-1.95, 1.95]) for (const half of [-1, 1]) {
          const door = new Mesh(k.geo(new BoxGeometry(0.62, 2.0, 0.04)), k.mat("#AEB4BD", { metalness: 0.5, roughness: 0.35 }));
          door.position.set(cx + dx + half * 0.31, 1.3, 1.32); door.userData.home = door.position.x; door.userData.half = half; train.add(door); doors.push(door);
        }
        for (const wx of [-2.6, 2.6]) for (const wz of [-0.72, 0.72]) {
          const wheel = new Mesh(k.geo(new CylinderGeometry(0.32, 0.32, 0.12, 12)), k.mat("#2B2B2B"));
          wheel.rotation.x = Math.PI / 2; wheel.position.set(cx + wx, 0.42, wz); train.add(wheel);
        }
      }
      const bullet = new Mesh(k.geo(new CylinderGeometry(0.28, 0.28, 0.03, 20)), glow("#FFC21A", 1.2));
      bullet.rotation.x = Math.PI / 2; bullet.position.set(-(CAR + GAP) - CAR / 2 + 0.6, 2.35, 1.32); train.add(bullet);
      g.add(train);
      // Its own copies of the materials (the kit's are shared with every other piece), clipped at the room's sides.
      const clip = [new Plane(new Vector3(1, 0, 0), w / 2 - item.x), new Plane(new Vector3(-1, 0, 0), w / 2 + item.x)];
      train.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const own = (m.material as Material).clone();
        own.clippingPlanes = clip;
        m.material = own;
      });
      const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      return {
        group: g,
        tick: (t) => {
          const c = (t + item.x) % 36;
          // In from the left over 8 s, doors open 9-17 s, out to the right over 8 s, then an empty track.
          const x = c < 8 ? -55 * (1 - ease(c / 8)) : c < 18 ? 0 : c < 26 ? 55 * ease((c - 18) / 8) : 999;
          train.visible = x !== 999;
          train.position.x = x;
          const open = c > 9 && c < 17 ? Math.min(1, (c - 9) / 0.8, (17 - c) / 0.8) : 0;
          for (const dm of doors) dm.position.x = dm.userData.home + dm.userData.half * open * 0.55;
        },
      };
    }
    case "turnstile": {
      // A steel turnstile: the cabinet with its card reader glowing green, and three arms.
      box(0.32, 1.0, d, "#9AA0A8", -0.24, 0, 0);
      box(0.2, 0.06, 0.16, glow("#3DDC97", 1.2), -0.24, 1.0, 0.1);
      for (let i = 0; i < 3; i++) {
        const arm = new Mesh(k.geo(new CylinderGeometry(0.025, 0.025, 0.5, 6)), k.mat(METAL));
        arm.rotation.z = Math.PI / 2; arm.rotation.x = (i * Math.PI * 2) / 3;
        arm.position.set(0.12, 0.85, 0); g.add(arm);
      }
      return { group: g };
    }
    case "fareMachine": {
      // A fare card machine: a steel cabinet, a glowing touch screen and a card slot.
      box(w, 1.6, d, "#2B2D33");
      const scr = box(w - 0.24, 0.5, 0.02, glow("#6CC4FF", 1.0), 0, 0.95, d / 2);
      box(w - 0.3, 0.08, 0.04, "#FFC21A", 0, 0.62, d / 2);
      box(w, 0.12, d, "#FFC21A", 0, 1.6);
      return { group: g, tick: (t) => { (scr.material as MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 1.7 + item.z) * 0.15; } };
    }
    case "ticketBooth": {
      // The station agent's booth: a steel base, glass on every side, a light inside, a little window counter.
      box(w, 1.0, d, "#5A6068");
      const glass = new MeshStandardMaterial({ color: "#BFE3F2", transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
      for (const sx of [-1, 1]) box(0.04, 1.3, d, glass, sx * (w / 2 - 0.02), 1.0, 0);
      for (const sz of [-1, 1]) box(w, 1.3, 0.04, glass, 0, 1.0, sz * (d / 2 - 0.02));
      box(w + 0.1, 0.12, d + 0.1, "#3F6B4A", 0, 2.3);
      box(0.9, 0.05, 0.3, "#C9CED6", 0, 1.0, d / 2 + 0.12);
      box(0.6, 0.06, 0.4, glow("#FFF2C8", 0.8), 0, 2.24);
      return { group: g };
    }
    case "stationColumn": {
      // A green-painted steel column of the elevated structure, with a lamp near the top.
      const green = k.mat("#3F6B4A", { metalness: 0.3, roughness: 0.6 });
      box(0.3, 3.2, 0.3, green);
      box(0.42, 0.08, 0.42, green, 0, 0, 0);
      box(0.42, 0.1, 0.42, green, 0, 3.1, 0);
      const lamp = new Mesh(k.geo(new SphereGeometry(0.14, 10, 8)), glow("#FFE6B0", 1.3));
      lamp.position.set(0, 2.7, 0.24); g.add(lamp);
      return { group: g };
    }
    case "stationEntrance": {
      // The street entrance (the box-built stand-in for the modeled one): green railings round a stairwell going down, two lamps.
      box(w - 0.6, 0.02, d - 0.4, "#2B2B2B", 0, 0.0, 0);
      const rail = k.mat("#2F5A3A");
      for (const sx of [-1, 1]) box(0.05, 1.0, d, rail, sx * (w / 2 - 0.2), 0, 0);
      box(w - 0.4, 1.0, 0.05, rail, 0, 0, -d / 2);
      for (const sx of [-1, 1]) {
        cyl(0.04, 0.04, 2.2, rail, sx * (w / 2 - 0.2), 0, d / 2 - 0.1, 8);
        const globe = new Mesh(k.geo(new SphereGeometry(0.16, 10, 8)), glow("#7FE0A0", 1.2));
        globe.position.set(sx * (w / 2 - 0.2), 2.3, d / 2 - 0.1); g.add(globe);
      }
      return { group: g };
    }
    case "tvSet": {
      // A show's set: a low round-cornered riser with a lit edge (the box-built stand-in under the modeled desk or couch).
      box(w, 0.25, d, "#F2EEF5");
      const edge = box(w + 0.02, 0.05, 0.05, glow("#FF2E88", 1.4).clone(), 0, 0.2, d / 2);
      box(w - 0.6, 0.02, d - 0.6, "#FF6A3D", 0, 0.25, 0);
      return { group: g, tick: (t) => { (edge.material as MeshStandardMaterial).emissive.setHSL((0.92 + Math.sin(t * 0.3) * 0.05 + 1) % 1, 0.9, 0.55); } };
    }
    case "studioLight": {
      // A studio light on a tripod: three legs, a pole and a soft box aimed at the set, glowing.
      for (let i = 0; i < 3; i++) {
        const leg = new Mesh(k.geo(new CylinderGeometry(0.02, 0.02, 1.0, 5)), k.mat(BLACK));
        const a = (i / 3) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22); leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); g.add(leg);
      }
      cyl(0.025, 0.025, 1.5, BLACK, 0, 0.8, 0, 6);
      const head = new Group(); head.position.set(0, 2.3, 0); head.rotation.x = 0.35; g.add(head);
      const boxM = new Mesh(k.geo(new BoxGeometry(0.6, 0.45, 0.25)), k.mat("#1F1B26")); head.add(boxM);
      const face = new Mesh(k.geo(new BoxGeometry(0.52, 0.38, 0.02)), glow("#FFF6E0", 1.8)); face.position.z = 0.13; head.add(face);
      return { group: g };
    }
    case "cellBars": {
      // A holding cell's front: steel rails top and bottom and bars every 15 cm (a door in the middle third).
      const steel = k.mat("#7C8594", { metalness: 0.6, roughness: 0.35 });
      box(w, 0.08, d, steel, 0, 0, 0);
      box(w, 0.08, d, steel, 0, 2.3, 0);
      box(w, 0.06, d, steel, 0, 1.1, 0);
      for (let x = -w / 2 + 0.05; x <= w / 2 - 0.04; x += 0.15) cyl(0.022, 0.022, 2.3, steel, x, 0.04, 0, 6);
      return { group: g };
    }
    case "dog": {
      // A sitting dog (the firehouse's Hydrant, a park's regulars): a white coat with black spots, ears, a wagging tail.
      const coat = k.mat(color ?? "#F4F1EA"), spot = k.mat("#1F1B26");
      box(0.5, 0.28, 0.24, coat, -0.05, 0.18, 0);
      box(0.22, 0.3, 0.22, coat, 0.22, 0.24, 0);
      box(0.2, 0.18, 0.18, coat, 0.32, 0.5, 0);
      box(0.12, 0.08, 0.12, spot, 0.43, 0.52, 0);
      for (const sz of [-1, 1]) box(0.05, 0.1, 0.06, spot, 0.3, 0.68, sz * 0.07);
      for (const [x, z] of [[-0.2, -0.09], [-0.2, 0.09], [0.18, -0.08], [0.18, 0.08]]) box(0.07, 0.18, 0.07, coat, x, 0, z);
      box(0.12, 0.02, 0.1, spot, -0.1, 0.46, 0.06);
      box(0.1, 0.02, 0.08, spot, 0.05, 0.46, -0.05);
      const tail = new Group(); tail.position.set(-0.3, 0.38, 0); g.add(tail);
      const tm = new Mesh(k.geo(new BoxGeometry(0.05, 0.2, 0.05)), coat); tm.position.y = 0.1; tail.add(tm);
      return { group: g, tick: (t) => { tail.rotation.x = Math.sin(t * 6 + item.x) * 0.6; } };
    }
    case "fireTruck": {
      // A red fire engine (the box-built stand-in for the modeled one): the cab, the body with lockers, a ladder on top, chrome.
      const red = k.mat("#D93A2F"), chrome = k.mat("#D9DDE3", { metalness: 0.7, roughness: 0.25 });
      box(w, 1.6, d - 0.2, red, 0, 0.45, 0);
      box(1.6, 1.0, d - 0.2, red, w / 2 - 0.8, 2.05, 0);
      box(0.05, 0.6, d - 0.6, k.mat("#2B3440"), w / 2 + 0.01, 2.2, 0);
      box(w - 2.2, 0.12, 0.5, chrome, -0.9, 2.15, 0);
      box(w, 0.2, d, chrome, 0, 0.4, 0);
      for (const x of [-w / 2 + 1.1, -w / 2 + 2.4, w / 2 - 1.2]) for (const sz of [-1, 1]) {
        const wheel = new Mesh(k.geo(new CylinderGeometry(0.42, 0.42, 0.28, 14)), k.mat("#1F1B26"));
        wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.42, sz * (d / 2 - 0.12)); g.add(wheel);
      }
      box(0.3, 0.12, 0.6, glow("#4FA3FF", 1.4), w / 2 - 0.8, 2.6, 0);
      return { group: g };
    }
    case "gearLocker": {
      // Turnout gear on a hook: the tan coat with yellow reflective bands, boots below, the helmet on the shelf.
      box(w, 0.06, d, METAL, 0, 0, 0);
      box(w, 0.04, d, METAL, 0, 1.95, 0);
      for (const sx of [-1, 1]) box(0.04, 2.0, 0.04, METAL, sx * (w / 2 - 0.02), 0, -d / 2 + 0.02);
      box(0.5, 0.8, 0.22, "#B89A62", 0, 0.85, 0);
      box(0.52, 0.06, 0.24, glow("#E8D24A", 0.6), 0, 1.0, 0);
      box(0.52, 0.06, 0.24, glow("#E8D24A", 0.6), 0, 1.35, 0);
      for (const sx of [-1, 1]) box(0.14, 0.3, 0.22, "#1F1B26", sx * 0.12, 0.06, 0);
      const helmet = new Mesh(k.geo(new SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), k.mat("#D93A2F"));
      helmet.position.set(0, 1.99, 0); g.add(helmet);
      return { group: g };
    }
    case "firePole": {
      // The brass pole, floor to ceiling, through a ring in the ceiling and a round mat at its foot.
      cyl(0.32, 0.32, 0.04, "#2B2B2B", 0, 0, 0, 16);
      cyl(0.04, 0.04, 2.9, k.mat("#C9A227", { metalness: 0.7, roughness: 0.25 }), 0, 0.04, 0, 10);
      const ring = new Mesh(k.geo(new TorusGeometry(0.28, 0.04, 6, 20)), k.mat("#D93A2F"));
      ring.rotation.x = Math.PI / 2; ring.position.y = 2.9; g.add(ring);
      return { group: g };
    }
    case "curtain": {
      // A hospital bay's curtain on a ceiling rail: soft blue pleats.
      box(w, 0.04, 0.04, METAL, 0, 2.3, 0);
      const fab = k.mat(color ?? "#A8D3E8");
      const n = 9;
      for (let i = 0; i < n; i++) box(w / n + 0.02, 1.9, 0.05, fab, -w / 2 + (w * (i + 0.5)) / n, 0.35, i % 2 ? 0.03 : -0.03);
      return { group: g };
    }
    case "runTrack": {
      // A running track: a terracotta loop with white lane lines around an inner lawn, flat on the ground.
      const clay = k.mat("#C9653F"), line = k.mat("#F4F1EA"), grass = k.mat("#8FCB7A");
      box(w - 2.4, 0.015, d - 2.4, grass, 0, 0, 0);
      const lane = 1.0;
      for (const sz of [-1, 1]) {
        box(w - d + 0.2, 0.02, lane, clay, 0, 0, sz * (d / 2 - lane / 2));
        box(w - d + 0.2, 0.025, 0.04, line, 0, 0, sz * (d / 2 - lane / 2));
      }
      for (const sx of [-1, 1]) for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI, r = d / 2 - lane / 2;
        const seg = new Mesh(k.geo(new BoxGeometry(0.34 * r, 0.02, lane)), clay);
        seg.position.set(sx * ((w - d) / 2 + Math.cos(a) * r), 0.01, Math.sin(a) * r); seg.rotation.y = sx > 0 ? -a + Math.PI / 2 : a + Math.PI / 2; g.add(seg);
      }
      return { group: g };
    }
    case "fountain": {
      // A round fountain: a stone basin, the water, a tiered column and a jet that sparkles.
      cyl(w / 2, w / 2 + 0.05, 0.45, "#D9D3C8", 0, 0, 0, 28);
      const water = cyl(w / 2 - 0.15, w / 2 - 0.15, 0.04, k.mat("#7FC8E8", { emissive: "#7FC8E8", emissiveIntensity: 0.25, roughness: 0.15 }).clone(), 0, 0.42, 0, 28);
      cyl(0.25, 0.32, 1.0, "#C9C2B4", 0, 0.45, 0, 12);
      cyl(0.8, 0.7, 0.14, "#D9D3C8", 0, 1.4, 0, 18);
      cyl(0.12, 0.16, 0.5, "#C9C2B4", 0, 1.5, 0, 10);
      const jet = cyl(0.06, 0.14, 0.6, k.mat("#BFE6F7", { emissive: "#BFE6F7", emissiveIntensity: 0.5 }).clone(), 0, 1.95, 0, 10);
      return { group: g, tick: (t) => { jet.scale.y = 0.85 + Math.sin(t * 3.4) * 0.15; (water.material as MeshStandardMaterial).emissiveIntensity = 0.2 + Math.sin(t * 1.3) * 0.08; } };
    }
    case "chandelier": {
      // A brass ring of candle lights on a chain (the box-built stand-in).
      const brass = k.mat("#C9A227", { metalness: 0.5, roughness: 0.35 });
      cyl(0.008, 0.008, 0.5, BLACK, 0, 2.15, 0, 4);
      const ring = new Mesh(k.geo(new TorusGeometry(0.38, 0.025, 6, 24)), brass);
      ring.rotation.x = Math.PI / 2; ring.position.y = 2.1; g.add(ring);
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * Math.PI * 2;
        const b = new Mesh(k.geo(new SphereGeometry(0.045, 8, 6)), glow("#FFE3B0", 1.6));
        b.position.set(Math.cos(a2) * 0.38, 2.18, Math.sin(a2) * 0.38); g.add(b);
      }
      return { group: g };
    }
    case "cat": {
      const fur = "#E8A44A";
      const bodyM = new Mesh(k.geo(new SphereGeometry(0.13, 7, 5)), k.mat(fur));
      bodyM.scale.set(1.5, 0.9, 1);
      bodyM.position.set(0, 0.13, 0);
      g.add(bodyM);
      const head = new Mesh(k.geo(new SphereGeometry(0.09, 7, 5)), k.mat(fur));
      head.position.set(0.18, 0.24, 0.02);
      g.add(head);
      for (const s of [-1, 1]) {
        const ear = new Mesh(k.geo(new ConeGeometry(0.03, 0.06, 4)), k.mat(fur));
        ear.position.set(0.19, 0.33, 0.02 + s * 0.05);
        g.add(ear);
      }
      const tail = new Group();
      tail.position.set(-0.18, 0.15, 0);
      const tailM = new Mesh(k.geo(new CylinderGeometry(0.02, 0.025, 0.25, 5)), k.mat(fur));
      tailM.position.y = 0.12;
      tail.add(tailM);
      g.add(tail);
      return { group: g, tick: (t) => { tail.rotation.x = Math.sin(t * 2.4) * 0.5; } };
    }
  }
}

/** Marks every mesh in a piece with its item id, for tapping. */
export function tagItem(obj: Object3D, id: string) {
  obj.traverse((o) => { o.userData.itemId = id; });
}
