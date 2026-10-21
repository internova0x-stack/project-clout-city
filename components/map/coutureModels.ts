// Clout Couture's map pieces (migration 0104; lib/coutureMap.ts): the Astoria Yacht with its owner's name on the hull,
// the Clout One Jet trailing a banner with its owner's name, and the Plaza Statue's pedestal and plaque (the gold avatar
// on top comes from components/avatar/goldStatue.ts). Meters, x east, y up, z south; drawn bigger than life like the
// landmarks so they read from helicopter height. Each returns its group and a dispose for what it made.

import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial,
  PlaneGeometry, Shape, SRGBColorSpace, type BufferGeometry, type Material, type Texture,
} from "three";

interface Kit { group: Group; geo<T extends BufferGeometry>(g: T): T; mat(c: string, o?: Partial<{ metal: number; rough: number; emissive: string }>): MeshStandardMaterial; dispose(): void }

function kit(): Kit {
  const geos: BufferGeometry[] = [], mats: Material[] = [], texs: Texture[] = [];
  const group = new Group();
  return {
    group,
    geo: (g) => { geos.push(g); return g; },
    mat: (c, o = {}) => {
      const m = new MeshStandardMaterial({ color: c, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6, flatShading: true });
      if (o.emissive) { m.emissive.set(o.emissive); m.emissiveIntensity = 0.8; }
      mats.push(m);
      return m;
    },
    dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose()); },
  };
}

/** A name painted on a panel (canvas text), both sides. */
function namePanel(k: Kit, text: string, w: number, h: number, ink: string, paper: string | null, font = "800"): Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext("2d")!;
  if (paper) { g.fillStyle = paper; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = c.height * 0.62;
  g.font = `${font} ${size}px system-ui, sans-serif`;
  while (g.measureText(text).width > c.width * 0.9 && size > 10) g.font = `${font} ${(size -= 2)}px system-ui, sans-serif`;
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new MeshStandardMaterial({ map: tex, transparent: !paper, side: DoubleSide, roughness: 0.7 });
  const mesh = new Mesh(k.geo(new PlaneGeometry(w, h)), m);
  const dispose = k.dispose;
  k.dispose = () => { dispose(); tex.dispose(); m.dispose(); };
  return mesh;
}

const at = <T extends Mesh | Group>(o: T, x: number, y: number, z: number, parent: Group): T => {
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};

/** The Astoria Yacht: a white-and-gold superyacht, bow toward +x, its owner's name on both sides of the hull. */
export function buildYacht(name: string): { group: Group; dispose(): void } {
  const k = kit();
  const white = k.mat("#FAF7F0", { rough: 0.45 }), gold = k.mat("#EBC657", { metal: 0.2, rough: 0.4 });
  const glass = k.mat("#1F2A3A", { metal: 0.3, rough: 0.2 }), teak = k.mat("#C08A55", { rough: 0.8 });
  // The hull: a pointed outline extruded upward.
  const outline = (s: number) => {
    const sh = new Shape();
    sh.moveTo(-20 * s, -5 * s); sh.lineTo(12 * s, -5 * s); sh.quadraticCurveTo(22 * s, -3 * s, 26 * s, 0);
    sh.quadraticCurveTo(22 * s, 3 * s, 12 * s, 5 * s); sh.lineTo(-20 * s, 5 * s); sh.closePath();
    return sh;
  };
  const extrude = (s: number, depth: number, m: Material, y: number) => {
    const mesh = new Mesh(k.geo(new ExtrudeGeometry(outline(s), { depth, bevelEnabled: false })), m);
    mesh.rotation.x = -Math.PI / 2;
    return at(mesh, 0, y, 0, k.group);
  };
  extrude(1, 5, white, 0);
  extrude(1.01, 0.5, gold, 3.6);
  extrude(0.98, 0.3, white, 5);
  // Teak on the foredeck only.
  at(new Mesh(k.geo(new BoxGeometry(8, 0.1, 7)), teak), 13, 5.35, 0, k.group);
  // Decks, each with a band of dark glass and gold rails.
  const deck = (w: number, d: number, x: number, y: number) => {
    at(new Mesh(k.geo(new BoxGeometry(w, 2.6, d)), white), x, y + 1.3, 0, k.group);
    at(new Mesh(k.geo(new BoxGeometry(w + 0.1, 1.1, d + 0.1)), glass), x, y + 1.4, 0, k.group);
    at(new Mesh(k.geo(new BoxGeometry(w + 0.6, 0.25, d + 0.6)), gold), x, y + 2.7, 0, k.group);
  };
  deck(24, 8, -4, 5.3);
  deck(16, 6.6, -6, 8.1);
  deck(8, 5, -7, 10.9);
  // A mast with a gold radar dish.
  at(new Mesh(k.geo(new CylinderGeometry(0.25, 0.3, 5, 6)), white), -7, 16, 0, k.group);
  at(new Mesh(k.geo(new CylinderGeometry(1.4, 1.4, 0.3, 12)), gold), -7, 18.4, 0, k.group);
  // The owner's name on both sides, near the stern.
  const plate = (side: 1 | -1) => {
    const p = namePanel(k, name, 16, 2.4, "#C9A227", null);
    p.position.set(-9, 2.3, side * 5.02);
    if (side < 0) p.rotation.y = Math.PI;
    k.group.add(p);
  };
  plate(1);
  plate(-1);
  return { group: k.group, dispose: () => k.dispose() };
}

/** The Clout One Jet: black with a gold stripe, nose toward +x, trailing a banner with its owner's name. */
export function buildJet(name: string): { group: Group; banner: Group; dispose(): void } {
  const k = kit();
  // Black and gold (content/shop/clout-couture.json).
  const white = k.mat("#17141C", { rough: 0.35, metal: 0.2 }), gold = k.mat("#EBC657", { metal: 0.2, rough: 0.4 }), dark = k.mat("#3A4A5E", { metal: 0.3, rough: 0.2 });
  const body = new Mesh(k.geo(new CylinderGeometry(1.8, 1.8, 26, 12)), white);
  body.rotation.z = Math.PI / 2;
  at(body, 0, 0, 0, k.group);
  const nose = new Mesh(k.geo(new ConeGeometry(1.8, 6, 12)), white);
  nose.rotation.z = -Math.PI / 2;
  at(nose, 16, 0, 0, k.group);
  const tail = new Mesh(k.geo(new ConeGeometry(1.8, 5, 12)), white);
  tail.rotation.z = Math.PI / 2;
  at(tail, -15.5, 0.4, 0, k.group);
  const stripe = new Mesh(k.geo(new CylinderGeometry(1.83, 1.83, 24, 12, 1, true, Math.PI * 0.42, Math.PI * 0.16)), gold);
  stripe.rotation.z = Math.PI / 2;
  at(stripe, 0, 0, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(2.4, 0.6, 2.6)), dark), 14.6, 0.9, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(7, 0.5, 30)), white), 0, -0.6, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(3, 0.4, 10)), white), -14, 0.4, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(4, 6, 0.4)), gold), -15, 3.6, 0, k.group);
  // The banner on a tow line behind the tail.
  const banner = new Group();
  banner.position.set(-20, 0, 0);
  k.group.add(banner);
  at(new Mesh(k.geo(new BoxGeometry(14, 0.12, 0.12)), dark), -7, 0, 0, banner);
  const flag = namePanel(k, `@${name}`, 34, 6, "#17141C", "#FFF6E0");
  flag.rotation.x = 0;
  at(flag, -31, -1, 0, banner);
  return { group: k.group, banner, dispose: () => k.dispose() };
}

/** The Plaza Statue's black marble pedestal and gold plaque (the statue stands on top, PEDESTAL_TOP meters up). */
export const PEDESTAL_TOP = 7;
export function buildPlazaPedestal(name: string): { group: Group; dispose(): void } {
  const k = kit();
  const marble = k.mat("#1F1B26", { rough: 0.25, metal: 0.1 }), gold = k.mat("#EBC657", { metal: 0.2, rough: 0.4 });
  at(new Mesh(k.geo(new BoxGeometry(12, 1, 12)), marble), 0, 0.5, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(9, PEDESTAL_TOP - 2, 9)), marble), 0, (PEDESTAL_TOP - 2) / 2 + 1, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(10.5, 1, 10.5)), marble), 0, PEDESTAL_TOP - 0.5, 0, k.group);
  at(new Mesh(k.geo(new BoxGeometry(7, 2.2, 0.2)), gold), 0, PEDESTAL_TOP / 2, 4.6, k.group);
  at(namePanel(k, `@${name} · this week`, 6.4, 1.6, "#17141C", null, "700"), 0, PEDESTAL_TOP / 2, 4.72, k.group);
  return { group: k.group, dispose: () => k.dispose() };
}

/**
 * The Waterfront Mansion (migration 0105): glass and stone on its plot, front toward +z (the promenade), its windows
 * lit at night (`windows`, the layer turns them up), and a gold gate with the owner's name at the front of the lawn.
 */
export function buildMansion(name: string): { group: Group; windows: MeshStandardMaterial; dispose(): void } {
  const k = kit();
  const stone = k.mat("#E4DCCB", { rough: 0.7 }), dark = k.mat("#2B2F36", { rough: 0.4, metal: 0.2 });
  const gold = k.mat("#EBC657", { metal: 0.2, rough: 0.4 }), water = k.mat("#5FB6D9", { rough: 0.15, metal: 0.1 });
  const windows = k.mat("#9FC4D8", { rough: 0.15, metal: 0.3, emissive: "#FFD98A" });
  windows.emissiveIntensity = 0.15;
  // A stone base, two glass floors set back from each other, a flat roof with a gold edge.
  at(new Mesh(k.geo(new BoxGeometry(28, 5, 18)), stone), 0, 2.5, -2, k.group);
  at(new Mesh(k.geo(new BoxGeometry(26, 4.6, 16)), windows), 1, 7.3, -2.6, k.group);
  at(new Mesh(k.geo(new BoxGeometry(27, 0.6, 17)), stone), 1, 9.9, -2.6, k.group);
  at(new Mesh(k.geo(new BoxGeometry(18, 4.4, 12)), windows), -3, 12.4, -4, k.group);
  at(new Mesh(k.geo(new BoxGeometry(19, 0.6, 13)), dark), -3, 14.9, -4, k.group);
  at(new Mesh(k.geo(new BoxGeometry(19.2, 0.25, 13.2)), gold), -3, 15.3, -4, k.group);
  // Stone fins across the glass, a pool on the lawn.
  for (const x of [-11, -5, 1, 7, 13]) at(new Mesh(k.geo(new BoxGeometry(0.8, 4.6, 0.8)), stone), x, 7.3, 5.6, k.group);
  at(new Mesh(k.geo(new BoxGeometry(12, 0.3, 5)), water), 6, 0.5, 11, k.group);
  // The gate: two stone posts, a gold bar and the owner's name.
  for (const sx of [-1, 1]) at(new Mesh(k.geo(new BoxGeometry(1.4, 4.5, 1.4)), stone), sx * 6, 2.25, 16, k.group);
  at(new Mesh(k.geo(new BoxGeometry(12, 0.5, 0.4)), gold), 0, 4.2, 16, k.group);
  const plate = namePanel(k, name, 10, 1.6, "#17141C", "#EBC657", "800");
  at(plate, 0, 3.1, 16.25, k.group);
  return { group: k.group, windows, dispose: () => k.dispose() };
}
