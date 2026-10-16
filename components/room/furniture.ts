// Low-poly, flat-shaded furniture and props for the walkable rooms, built from
// primitives (after the Lagos Life look). Every piece faces +z and sits on y = 0;
// the room rotates and places it from lib/rooms.ts. Modeled assets can replace
// a builder later without touching the layouts.

import {
  BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh,
  MeshStandardMaterial, SphereGeometry, TorusGeometry, type BufferGeometry, type Material, type Object3D,
} from "three";
import { FURNITURE, type RoomItem } from "@/lib/rooms";

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

const WOOD = "#9A6B45";
const WOOD_DARK = "#5A3E2B";
const METAL = "#B9BEC6";
const BLACK = "#1F1B26";

export function buildFurniture(item: RoomItem, k: Kit, opts: { night: boolean }): Built {
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
      // v0.11 the exclusive venue: a short flight rising toward the back, with a rail on one side.
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
