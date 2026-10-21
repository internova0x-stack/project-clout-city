// The rigid accessories' shapes (lib/accessories.ts; stage 4, owner Oct 21). Head pieces are made in the head's space
// like the game's caps (buildAvatar: the skull is a 0.19 sphere, +z the face), so baseAvatar fits them with the rest of
// the headwear. Neck, hand and wrist pieces are made in the body's own space from measurements of that body
// (BodyFit, taken by baseAvatar when it loads) and pinned to a bone, so they move with every pose and animation.

import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial,
  SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material, type Object3D,
} from "three";
import type { AccessoryWear } from "@/lib/accessories";

type Opts = Partial<{ roughness: number; metalness: number; opacity: number; side: typeof DoubleSide }>;

/** A small kit that keeps every geometry and material for dispose(). */
function kit() {
  const geos: BufferGeometry[] = [], mats: Material[] = [];
  const group = new Group();
  const mat = (c: string, o: Opts = {}) => {
    const m = new MeshStandardMaterial({ color: c, roughness: o.roughness ?? 0.7, metalness: o.metalness ?? 0, side: o.side, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1 });
    mats.push(m);
    return m;
  };
  const add = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0, parent: Object3D = group) => {
    geos.push(g);
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  return { group, mat, add, dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); } };
}
const metal = (k: ReturnType<typeof kit>, c: string) => k.mat(c, { metalness: 0.75, roughness: 0.28 });

/** A head piece, in the head's space. */
export function buildHeadAccessory(a: AccessoryWear): { group: Group; dispose(): void } {
  const k = kit();
  const { add, mat } = k;
  const main = mat(a.color), trim = mat(a.accent);
  switch (a.kind) {
    case "bucket": {
      // Denim squares: the crown in two blues, a stitched brim.
      add(new CylinderGeometry(0.16, 0.205, 0.15, 16), main, 0, 0.16, -0.01);
      add(new SphereGeometry(0.16, 16, 4, 0, Math.PI * 2, 0, Math.PI * 0.18), trim, 0, 0.21, -0.01);
      for (let i = 0; i < 4; i++) {
        const p = add(new CylinderGeometry(0.168, 0.2, 0.072, 4, 1, true, i * (Math.PI / 2), Math.PI / 4), i % 2 ? trim : mat("#7E9CC0", { side: DoubleSide }), 0, i < 2 ? 0.2 : 0.125, -0.01);
        p.scale.set(1.01, 1, 1.01);
      }
      add(new CylinderGeometry(0.21, 0.28, 0.06, 18, 1, true), mat(a.color, { side: DoubleSide }), 0, 0.065, -0.01);
      break;
    }
    case "beanie": {
      // Ribbed knit over the crown with a folded cuff.
      const knit = add(new SphereGeometry(0.218, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), main, 0, 0.03, -0.01);
      knit.scale.set(0.95, 1.12, 1.04);
      for (let i = 0; i < 24; i++) {
        const a2 = (i / 24) * Math.PI * 2;
        add(new BoxGeometry(0.006, 0.17, 0.004), trim, Math.sin(a2) * 0.2, 0.1, -0.01 + Math.cos(a2) * 0.212).rotation.y = a2;
      }
      add(new TorusGeometry(0.205, 0.028, 8, 30), main, 0, 0.035, -0.01).rotation.x = Math.PI / 2;
      break;
    }
    case "fedora": {
      add(new CylinderGeometry(0.3, 0.3, 0.014, 22), main, 0, 0.12, -0.01).rotation.x = -0.06;
      add(new CylinderGeometry(0.15, 0.19, 0.16, 16), main, 0, 0.2, -0.015).scale.set(1, 1, 0.92);
      add(new BoxGeometry(0.03, 0.02, 0.2), mat(a.accent), 0, 0.282, -0.015);
      add(new CylinderGeometry(0.192, 0.194, 0.035, 16), trim, 0, 0.14, -0.015).scale.set(1, 1, 0.92);
      break;
    }
    case "wide-brim": {
      add(new CylinderGeometry(0.4, 0.4, 0.012, 32), main, 0, 0.12, -0.01).rotation.x = -0.05;
      add(new CylinderGeometry(0.16, 0.19, 0.15, 18), main, 0, 0.195, -0.015).scale.set(1, 1, 0.94);
      add(new CylinderGeometry(0.192, 0.194, 0.03, 18), metal(k, a.accent), 0, 0.14, -0.015).scale.set(1, 1, 0.94);
      break;
    }
    case "balaclava": {
      // Chunky knit over the whole head and neck, open at the eyes and nose.
      const knit = mat(a.color, { roughness: 0.95, side: DoubleSide });
      const open = 0.55;
      const hood = add(new SphereGeometry(0.228, 22, 12, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI), knit, 0, 0.01, -0.005);
      hood.scale.set(0.97, 1.16, 1.06);
      // The face opening's lower half is closed (over the mouth and chin).
      const chin = add(new SphereGeometry(0.228, 14, 6, Math.PI / 2 - open, open * 2, Math.PI * 0.62, Math.PI * 0.38), knit, 0, 0.01, -0.005);
      chin.scale.set(0.98, 1.16, 1.07);
      add(new CylinderGeometry(0.12, 0.14, 0.16, 18, 1, true), knit, 0, -0.27, -0.02);
      break;
    }
    case "oversized-shades": {
      const frame = mat(a.color, { roughness: 0.35 });
      for (const s of [-1, 1]) {
        const rim = add(new TorusGeometry(0.045, 0.008, 8, 28), frame, s * 0.07, 0.0, 0.192);
        rim.scale.set(1.12, 0.92, 1);
        rim.rotation.y = s * 0.2;
        const lens = add(new CircleGeometry(0.045, 24), mat(a.accent, { roughness: 0.1, metalness: 0.4, opacity: 0.92 }), s * 0.07, 0.0, 0.193);
        lens.scale.set(1.12, 0.92, 1);
        lens.rotation.y = s * 0.2;
        add(new BoxGeometry(0.007, 0.008, 0.17), frame, s * 0.162, 0.01, 0.1);
      }
      add(new BoxGeometry(0.03, 0.008, 0.008), frame, 0, 0.012, 0.2);
      break;
    }
    case "visor": {
      // One chrome shield wrapping round the eyes.
      const shield = add(new CylinderGeometry(0.205, 0.205, 0.065, 28, 1, true, -1.15, 2.3), mat(a.color, { metalness: 0.9, roughness: 0.12, side: DoubleSide }), 0, 0.005, 0.0);
      shield.scale.set(0.95, 1, 1.0);
      for (const s of [-1, 1]) add(new BoxGeometry(0.006, 0.008, 0.15), mat(a.accent, { metalness: 0.6 }), s * 0.17, 0.01, 0.06);
      break;
    }
    case "square-frames": {
      const frame = metal(k, a.color);
      for (const s of [-1, 1]) {
        const rim = add(new TorusGeometry(0.036, 0.004, 6, 4), frame, s * 0.066, 0.002, 0.191);
        rim.rotation.set(0, s * 0.2, Math.PI / 4);
        rim.scale.set(1.25, 1, 1);
        const lens = add(new CircleGeometry(0.036, 4), mat(a.accent, { roughness: 0.15, opacity: 0.6 }), s * 0.066, 0.002, 0.192);
        lens.rotation.set(0, s * 0.2, Math.PI / 4);
        lens.scale.set(1.25, 1, 1);
        add(new BoxGeometry(0.005, 0.005, 0.17), frame, s * 0.158, 0.008, 0.1);
      }
      add(new BoxGeometry(0.03, 0.005, 0.005), frame, 0, 0.012, 0.2);
      break;
    }
    case "hoops": {
      for (const s of [-1, 1]) add(new TorusGeometry(0.03, 0.004, 8, 24), metal(k, a.color), s * 0.178, -0.08, 0.0).rotation.y = Math.PI / 2;
      break;
    }
    case "drops": {
      for (const s of [-1, 1]) {
        add(new SphereGeometry(0.01, 10, 8), metal(k, a.color), s * 0.178, -0.055, 0.0);
        const drop = add(new SphereGeometry(0.022, 12, 10), metal(k, a.color), s * 0.18, -0.1, 0.0);
        drop.scale.set(0.7, 1.4, 0.5);
      }
      break;
    }
  }
  return { group: k.group, dispose: k.dispose };
}

/** Measurements of one body in its own space (meters, +y up, +z the front), taken at load. */
export interface BodyFit {
  /** The neck's base: its middle, its radius, and the chest's front surface 12 cm below it. */
  neck: { at: Vector3; r: number; chestFront: number };
  /** The torso round the middle of the chest (its middle and half width and depth), for a crossbody strap. */
  chest: { at: Vector3; rx: number; rz: number };
  /** The hips' front-side, where a crossbody bag sits. */
  hip: Vector3;
  /** The left wrist: where it is, the forearm's direction toward the hand, the wrist's radius. */
  wrist: { at: Vector3; dir: Vector3; r: number };
  /** The right hand standing (idle), where a bag is held. */
  hand: Vector3;
  /** How far clothes stand off the body at the neck and chest (0 without a top). */
  gap: number;
}

/** A body piece: its shape in the body's space, and the bone it rides. */
export function buildBodyAccessory(a: AccessoryWear, f: BodyFit): { group: Group; bone: string; dispose(): void } {
  const k = kit();
  const { add, mat, group } = k;
  // Round the neck's base, tilted down at the front; `drop` lowers its front (meters) for longer chains.
  const ring = (r: number, tube: number, m: Material, drop = 0, seg = 40) => {
    const t = add(new TorusGeometry(r, tube, 8, seg), m, f.neck.at.x, f.neck.at.y - drop * 0.5, f.neck.at.z + drop * 0.35);
    t.rotation.x = Math.PI / 2 - (0.42 + drop * 2.2);
    t.scale.set(1, 1.1 + drop * 2, 1);
    return t;
  };
  const neckR = f.neck.r + f.gap + 0.006;
  // The lowest point of a ring at the front (for pendants).
  const front = (drop: number) => new Vector3(f.neck.at.x, f.neck.at.y - 0.045 - drop * 1.2, Math.max(f.neck.chestFront + f.gap, f.neck.at.z + neckR) + 0.006);
  let bone = "Spine02";
  switch (a.kind) {
    case "rope-chains": {
      const gold = metal(k, a.color);
      ring(neckR, 0.0045, gold);
      ring(neckR + 0.012, 0.005, gold, 0.035);
      break;
    }
    case "flame-chain": {
      const gold = metal(k, a.color);
      ring(neckR + 0.004, 0.006, gold, 0.03);
      // The flame: a gem-crusted teardrop with a point.
      const p = front(0.03);
      const flame = add(new SphereGeometry(0.022, 12, 10), mat(a.accent, { metalness: 0.3, roughness: 0.08 }), p.x, p.y - 0.02, p.z + 0.006);
      flame.scale.set(0.8, 1, 0.45);
      add(new ConeGeometry(0.016, 0.04, 10), mat(a.accent, { metalness: 0.3, roughness: 0.08 }), p.x, p.y + 0.01, p.z + 0.006).scale.set(1, 1, 0.5);
      break;
    }
    case "pearls": {
      // Two strands of pearls, one below the other, and a gold clasp at the back.
      const pearl = mat(a.color, { roughness: 0.25, metalness: 0.1 });
      for (const [r, drop, n] of [[neckR + 0.002, 0.0, 30], [neckR + 0.014, 0.03, 36]] as const) {
        const holder = new Group();
        holder.position.set(f.neck.at.x, f.neck.at.y - drop * 0.5, f.neck.at.z + drop * 0.35);
        holder.rotation.x = -(0.42 + drop * 2.2);
        holder.scale.set(1, 1, 1.1 + drop * 2);
        group.add(holder);
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2;
          add(new SphereGeometry(0.0085, 8, 6), pearl, Math.sin(t) * r, 0, Math.cos(t) * r, holder);
        }
      }
      add(new BoxGeometry(0.012, 0.008, 0.006), metal(k, a.accent), f.neck.at.x, f.neck.at.y + 0.01, f.neck.at.z - neckR - 0.004);
      break;
    }
    case "ring-choker": {
      // Velvet high on the neck, with a silver ring hanging at the front.
      bone = "neck";
      const at = f.neck.at.clone().add(new Vector3(0, 0.035, 0));
      const band = add(new TorusGeometry(f.neck.r * 0.94 + 0.004, 0.007, 8, 40), mat(a.color, { roughness: 0.95 }), at.x, at.y, at.z);
      band.rotation.x = Math.PI / 2 - 0.12;
      band.scale.set(1, 1.08, 2.4);
      add(new TorusGeometry(0.011, 0.0028, 6, 18), metal(k, a.accent), at.x, at.y - 0.02, at.z + f.neck.r + 0.01);
      break;
    }
    case "scarf": {
      // A soft wrap round the neck and two ends down the front, patterned in the accent.
      const silk = mat(a.color, { roughness: 0.6, side: DoubleSide });
      // Silk is thin: a flat band loosely round the neck, a gold edge on it.
      const wrap = ring(neckR + 0.01, 0.011, silk);
      wrap.scale.set(1, 1.12, 2.2);
      ring(neckR + 0.018, 0.0035, mat(a.accent, { metalness: 0.4, roughness: 0.4 }), 0.012);
      const p = front(0);
      for (const s of [-1, 1]) {
        // Each end falls from the wrap in two soft pieces: out over the chest, then down, narrowing a little.
        const end = new Group();
        end.position.set(p.x + s * 0.028, p.y + 0.005, p.z + 0.008);
        end.rotation.set(-0.5, 0, s * 0.08);
        group.add(end);
        add(new BoxGeometry(0.05, 0.09, 0.004), silk, 0, -0.045, 0, end);
        const lower = new Group();
        lower.position.set(0, -0.088, 0);
        lower.rotation.x = 0.38;
        end.add(lower);
        add(new BoxGeometry(0.044, 0.1, 0.004), silk, 0, -0.05, 0, lower);
        add(new BoxGeometry(0.045, 0.01, 0.005), mat(a.accent), 0, -0.098, 0.0005, lower);
      }
      break;
    }
    case "sling": {
      // A strap across the chest from shoulder to hip, the bag at the front of the hip.
      // The strap's ring lies level in a holder tipped sideways, so it runs from one shoulder across to the other hip;
      // tipped, it has to be longer across to clear the torso.
      const tilt = 0.75;
      const holder = new Group();
      holder.position.set(f.chest.at.x, f.chest.at.y - 0.1, f.chest.at.z);
      holder.rotation.z = tilt;
      group.add(holder);
      const strap = add(new TorusGeometry(1, 0.011, 6, 64), mat(a.accent, { roughness: 0.8 }), 0, 0, 0, holder);
      strap.rotation.x = Math.PI / 2;
      strap.scale.set((f.chest.rx + f.gap + 0.03) / Math.cos(tilt), f.chest.rz + f.gap + 0.035, 1);
      const bag = add(new CapsuleGeometry(0.05, 0.1, 4, 10), mat(a.color, { roughness: 0.55 }), f.hip.x, f.hip.y + 0.04, f.hip.z + f.gap + 0.03);
      bag.rotation.z = Math.PI / 2;
      bag.scale.set(1, 1, 0.5);
      bone = "Spine01";
      break;
    }
    case "iced-watch": {
      // A gold band round the wrist, a face on the back of it, and stones round the face.
      bone = "LeftForeArm";
      const holder = new Group();
      holder.position.copy(f.wrist.at).addScaledVector(f.wrist.dir, -0.03);
      holder.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), f.wrist.dir);
      group.add(holder);
      const gold = metal(k, a.color);
      add(new TorusGeometry(f.wrist.r + 0.006, 0.006, 8, 28), gold, 0, 0, 0, holder).scale.set(1, 1, 2);
      add(new CylinderGeometry(0.019, 0.019, 0.008, 20), gold, 0, f.wrist.r + 0.011, 0, holder);
      add(new CylinderGeometry(0.014, 0.014, 0.009, 20), mat("#14111A", { roughness: 0.2 }), 0, f.wrist.r + 0.012, 0, holder);
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2;
        add(new SphereGeometry(0.003, 6, 4), mat(a.accent, { roughness: 0.05, metalness: 0.2 }), Math.sin(t) * 0.017, f.wrist.r + 0.015, Math.cos(t) * 0.017, holder);
      }
      break;
    }
    default: {
      // Bags in the right hand: held by the handle at the hand, hanging below it, the broad side outward.
      bone = "RightHand";
      const h = f.hand;
      const leather = mat(a.color, { roughness: a.kind === "clutch" ? 0.25 : 0.55, metalness: a.kind === "clutch" ? 0.5 : 0 });
      const hw = metal(k, a.accent);
      const size: Record<string, [number, number, number]> = {
        tote: [0.34, 0.38, 0.06], "doctor-bag": [0.3, 0.22, 0.13], "mini-bag": [0.18, 0.14, 0.07], "shoulder-bag": [0.24, 0.15, 0.06], clutch: [0.22, 0.11, 0.035],
      };
      const [w, ht, d] = size[a.kind] ?? [0.24, 0.16, 0.07];
      const handle = a.kind === "clutch" ? 0 : a.kind === "tote" ? 0.17 : 0.07;
      // The bag's top sits `handle` below the hand (a clutch is held at its middle).
      const top = h.y - (a.kind === "clutch" ? -ht / 2 + 0.02 : handle);
      const body = add(new BoxGeometry(d, ht, w), leather, h.x + Math.sign(h.x || 1) * 0.02, top - ht / 2, h.z);
      // A doctor bag's top is rounded.
      if (a.kind === "doctor-bag") add(new CylinderGeometry(d / 2, d / 2, w, 14, 1, false, 0, Math.PI), leather, body.position.x, top, h.z).rotation.set(Math.PI / 2, 0, Math.PI / 2);
      if (handle) {
        const strap = add(new TorusGeometry(handle * (a.kind === "tote" ? 0.6 : 0.8), a.kind === "tote" ? 0.008 : 0.006, 6, 20, Math.PI), a.kind === "tote" ? mat(a.accent, { roughness: 0.9 }) : hw, h.x + Math.sign(h.x || 1) * 0.02, top, h.z);
        strap.rotation.y = Math.PI / 2;
      }
      if (a.kind !== "tote") add(new BoxGeometry(d + 0.004, 0.02, 0.03), hw, h.x + Math.sign(h.x || 1) * 0.02, top - 0.03, h.z);
      if (a.kind === "clutch") for (let i = 0; i < 18; i++) add(new SphereGeometry(0.004, 5, 4), mat(a.accent, { roughness: 0.05, metalness: 0.3 }), h.x + Math.sign(h.x || 1) * (0.02 + d / 2 + 0.002), top - 0.02 - (i % 3) * 0.03, h.z - w / 2 + 0.02 + Math.floor(i / 3) * 0.036);
      break;
    }
  }
  return { group, bone, dispose: k.dispose };
}
