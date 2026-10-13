// Low-poly, flat-shaded furniture and props for the walkable rooms, built from
// primitives (after the Lagos Life look). Every piece faces +z and sits on y = 0;
// the room rotates and places it from lib/rooms.ts. Modeled assets can replace
// a builder later without touching the layouts.

import {
  BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh,
  MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Material, type Object3D,
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
