// Hats and helmets for the whole Shop outfits on the new bodies (lib/avatarCatalog.ts SET_LOOKS; stage 4, owner Oct 21).
// Built in the same head space as the game's own caps and coverings (buildAvatar: the skull is a 0.19 sphere, +z is the
// face), so components/avatar/baseAvatar.ts fits them to each body's measured head with the rest of the headwear.

import {
  BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry,
  type BufferGeometry, type Material,
} from "three";
import type { SetHat } from "@/lib/avatarCatalog";

/** Hats that hide the hair entirely (the rest show only the hair's lengths, as under a cap). */
export const SET_HAT_HIDES_HAIR: ReadonlySet<SetHat> = new Set(["hood"]);

/** The hat, and a dispose for its geometry and materials. */
export function buildSetHat(kind: SetHat, color: string, accent: string): { group: Group; dispose(): void } {
  const group = new Group();
  const geos: BufferGeometry[] = [], mats: Material[] = [];
  const mat = (c: string, o: Partial<{ roughness: number; metalness: number; opacity: number; side: typeof DoubleSide }> = {}) => {
    const m = new MeshStandardMaterial({ color: c, roughness: o.roughness ?? 0.7, metalness: o.metalness ?? 0, side: o.side, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1 });
    mats.push(m);
    return m;
  };
  const add = (g: BufferGeometry, m: Material, x: number, y: number, z: number) => {
    geos.push(g);
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const main = mat(color), trim = mat(accent);
  switch (kind) {
    case "hardhat": {
      // A glossy shell with a raised ridge front to back and a short brim all round.
      const shell = mat(color, { roughness: 0.35 });
      add(new SphereGeometry(0.228, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), shell, 0, 0.05, -0.005).scale.set(0.95, 0.98, 1.06);
      add(new CylinderGeometry(0.255, 0.26, 0.014, 26), shell, 0, 0.055, 0.012).scale.set(0.95, 1, 1.08);
      // The ridge: a raised band over the top, front to back, on the shell itself.
      const ridge = add(new TorusGeometry(0.226, 0.018, 6, 26, Math.PI), mat(accent, { roughness: 0.35 }), 0, 0.05, -0.005);
      ridge.rotation.y = Math.PI / 2;
      ridge.scale.set(1.06, 0.98, 0.95);
      break;
    }
    case "cowboy": {
      const brim = add(new CylinderGeometry(0.34, 0.34, 0.012, 28), main, 0, 0.1, -0.01);
      brim.scale.set(1, 1, 0.86);
      // The sides of the brim curl up.
      for (const s of [-1, 1]) add(new TorusGeometry(0.06, 0.009, 6, 10, Math.PI), main, s * 0.3, 0.14, -0.01).rotation.set(0, Math.PI / 2, s * 0.6);
      add(new CylinderGeometry(0.15, 0.185, 0.17, 18), main, 0, 0.2, -0.015).scale.set(1, 1, 0.9);
      add(new BoxGeometry(0.035, 0.03, 0.22), mat(color, { roughness: 0.85 }), 0, 0.283, -0.015).material = mat(shade(color, -0.2));
      add(new CylinderGeometry(0.188, 0.19, 0.035, 18), trim, 0, 0.135, -0.015).scale.set(1, 1, 0.9);
      break;
    }
    case "explorer": {
      add(new CylinderGeometry(0.29, 0.3, 0.014, 24), main, 0, 0.115, -0.01).rotation.x = -0.05;
      add(new CylinderGeometry(0.16, 0.19, 0.15, 16), main, 0, 0.195, -0.015).scale.set(1, 1, 0.92);
      add(new BoxGeometry(0.03, 0.02, 0.2), mat(shade(color, -0.25)), 0, 0.272, -0.015);
      add(new CylinderGeometry(0.192, 0.194, 0.035, 16), trim, 0, 0.14, -0.015).scale.set(1, 1, 0.92);
      break;
    }
    case "helmet": {
      // A tactical helmet: a deep matte shell with a rim and a mount on the front.
      add(new SphereGeometry(0.238, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.56), mat(color, { roughness: 0.85 }), 0, 0.035, -0.01).scale.set(0.96, 1, 1.06);
      add(new TorusGeometry(0.228, 0.014, 6, 28), trim, 0, 0.02, -0.01).rotation.x = Math.PI / 2;
      add(new BoxGeometry(0.06, 0.035, 0.02), trim, 0, 0.17, 0.215);
      break;
    }
    case "witch": {
      const brim = add(new CylinderGeometry(0.37, 0.37, 0.012, 32), main, 0, 0.11, -0.01);
      brim.scale.set(1, 1, 0.95);
      const cone = add(new ConeGeometry(0.175, 0.44, 22), main, 0, 0.33, -0.04);
      cone.rotation.x = -0.22;
      add(new CylinderGeometry(0.176, 0.184, 0.045, 22), trim, 0, 0.14, -0.012);
      // A buckle on the band.
      add(new BoxGeometry(0.05, 0.04, 0.012), mat(accent, { metalness: 0.6, roughness: 0.3 }), 0, 0.14, 0.18);
      break;
    }
    case "hood": {
      // A deep hood, open at the face, falling to the shoulders at the back.
      const cloth = mat(color, { roughness: 0.95, side: DoubleSide });
      const open = 1.05;
      const hood = add(new SphereGeometry(0.25, 22, 12, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.74), cloth, 0, 0.02, -0.015);
      hood.scale.set(1, 1.12, 1.1);
      const drape = add(new CylinderGeometry(0.22, 0.3, 0.22, 22, 1, true, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8), cloth, 0, -0.23, -0.05);
      drape.scale.set(1, 1, 0.9);
      add(new TorusGeometry(0.2, 0.012, 6, 24, Math.PI * 2 - open * 2.4), trim, 0, 0.03, 0.03).rotation.set(0, 0, Math.PI / 2 + open * 1.2);
      break;
    }
    case "space": {
      // A clear bubble over the whole head on a padded collar.
      add(new SphereGeometry(0.31, 26, 16), mat("#CFE6FF", { roughness: 0.05, metalness: 0.2, opacity: 0.22 }), 0, 0.02, 0.01);
      add(new TorusGeometry(0.235, 0.045, 10, 30), main, 0, -0.27, 0).rotation.x = Math.PI / 2;
      add(new TorusGeometry(0.24, 0.012, 6, 30), trim, 0, -0.23, 0).rotation.x = Math.PI / 2;
      break;
    }
    case "crown": {
      const gold = mat(color, { metalness: 0.75, roughness: 0.28, side: DoubleSide });
      add(new CylinderGeometry(0.175, 0.165, 0.075, 28, 1, true), gold, 0, 0.21, -0.01);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(new ConeGeometry(0.026, 0.08, 6), gold, Math.sin(a) * 0.172, 0.285, -0.01 + Math.cos(a) * 0.172);
        add(new SphereGeometry(0.014, 8, 6), mat(accent, { roughness: 0.2, metalness: 0.3 }), Math.sin(a + 0.39) * 0.176, 0.21, -0.01 + Math.cos(a + 0.39) * 0.176);
      }
      break;
    }
  }
  return {
    group,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

/** A color lighter (amount > 0) or darker (< 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
