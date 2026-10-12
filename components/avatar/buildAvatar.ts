// Builds the chibi avatar from primitives (Design System Guide section 11):
// head about 40% of height, matte materials, glossy eyes with a catchlight,
// blush, chunky hair. A placeholder for the GLTF character planned for v1.0;
// the Avatar3D component only depends on the named parts returned here.

import {
  CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshStandardMaterial, SphereGeometry, TorusGeometry, BoxGeometry, type BufferGeometry, type Material,
} from "three";
import { getStyle, type Look } from "@/lib/styles";

export interface AvatarParts {
  root: Group;
  body: Group;
  head: Group;
  torso: Mesh;
  eyes: Mesh[];
  dispose(): void;
}

export function buildAvatar(look: Look, opts: { pedestal?: boolean } = {}): AvatarParts {
  const style = getStyle(look.style);
  const { outfit } = style;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const mat = (color: string, opts: Partial<{ roughness: number; metalness: number; emissive: string; transparent: boolean; opacity: number }> = {}) => {
    const m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: opts.roughness ?? 0.75,
      metalness: opts.metalness ?? 0,
      emissive: opts.emissive ? new Color(opts.emissive) : undefined,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    materials.push(m);
    return m;
  };
  const geo = <T extends BufferGeometry>(g: T) => {
    geometries.push(g);
    return g;
  };
  const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => {
    const me = new Mesh(g, m);
    me.position.set(x, y, z);
    return me;
  };

  const skin = mat(look.skin, { roughness: 0.6 });
  const top = mat(outfit.topColor);
  const accent = mat(outfit.topAccent);
  const bottom = mat(outfit.bottomColor);
  const shoe = mat(outfit.shoeColor, { roughness: 0.5 });
  const hair = mat(style.hairColor, { roughness: 0.55 });
  const acc = mat(outfit.accessoryColor, { roughness: 0.5 });

  const root = new Group();
  const body = new Group();
  root.add(body);

  // ---- Pedestal with a neon rim (the stage) ----
  const pedestal = mesh(geo(new CylinderGeometry(1.05, 1.12, 0.16, 48)), mat("#16121C", { roughness: 0.4 }), 0, -0.08, 0);
  const rim = mesh(geo(new TorusGeometry(1.06, 0.018, 8, 64)), mat("#FF2E88", { emissive: "#FF2E88", roughness: 0.3 }), 0, 0.0, 0);
  rim.rotation.x = Math.PI / 2;
  const shadow = mesh(geo(new CircleGeometry(0.55, 32)), mat("#000000", { transparent: true, opacity: 0.35 }), 0, 0.005, 0);
  shadow.rotation.x = -Math.PI / 2;
  if (opts.pedestal ?? true) root.add(pedestal, rim);
  root.add(shadow);

  // ---- Legs and shoes ----
  const legGeo = geo(new CapsuleGeometry(0.1, 0.42, 4, 12));
  const legsColored = outfit.bottom === "pants" || outfit.bottom === "leggings";
  for (const side of [-1, 1]) {
    const leg = mesh(legGeo, legsColored ? bottom : skin, side * 0.14, 0.38, 0);
    const shoeMesh = mesh(geo(new CapsuleGeometry(0.11, 0.12, 4, 12)), shoe, side * 0.15, 0.1, 0.05);
    shoeMesh.rotation.x = Math.PI / 2;
    shoeMesh.scale.set(1.05, 1, 0.9);
    body.add(leg, shoeMesh);
    if (outfit.bottom === "shorts") {
      body.add(mesh(geo(new CylinderGeometry(0.13, 0.14, 0.22, 16)), bottom, side * 0.14, 0.56, 0));
    }
    if (outfit.bottom === "skirt" || style.id === "night_owl_goth") {
      // Boots for skirt looks.
      body.add(mesh(geo(new CylinderGeometry(0.115, 0.12, 0.28, 16)), shoe, side * 0.14, 0.24, 0));
    }
  }
  if (outfit.bottom === "skirt") {
    body.add(mesh(geo(new CylinderGeometry(0.27, 0.38, 0.34, 24)), bottom, 0, 0.6, 0));
  }

  // ---- Torso ----
  const torsoColor = outfit.top === "vest" ? accent : top;
  const torso = mesh(geo(new CapsuleGeometry(0.29, 0.3, 6, 20)), torsoColor, 0, 0.98, 0);
  torso.scale.set(1, 1, 0.82);
  body.add(torso);
  if (legsColored) body.add(mesh(geo(new CylinderGeometry(0.28, 0.27, 0.18, 20)), bottom, 0, 0.7, 0));

  switch (outfit.top) {
    case "puffer": {
      torso.scale.set(1.18, 1.05, 0.98);
      for (const y of [0.82, 0.98, 1.14]) {
        const band = mesh(geo(new TorusGeometry(0.33, 0.035, 8, 32)), top, 0, y, 0);
        band.rotation.x = Math.PI / 2;
        band.scale.set(1.06, 0.88, 1);
        body.add(band);
      }
      body.add(mesh(geo(new BoxGeometry(0.03, 0.5, 0.02)), accent, 0, 0.98, 0.3));
      break;
    }
    case "cardigan": {
      body.add(mesh(geo(new BoxGeometry(0.14, 0.52, 0.02)), accent, 0, 0.96, 0.24));
      for (const y of [0.84, 0.97, 1.1]) body.add(mesh(geo(new SphereGeometry(0.025, 8, 8)), mat("#F4E7C8"), 0.04, y, 0.26));
      break;
    }
    case "vest": {
      const vest = mesh(geo(new CapsuleGeometry(0.31, 0.22, 6, 20)), top, 0, 0.97, -0.01);
      vest.scale.set(1.02, 1, 0.86);
      body.add(vest);
      body.add(mesh(geo(new BoxGeometry(0.1, 0.36, 0.02)), accent, 0, 1.03, 0.265));
      break;
    }
    case "hoodie": {
      const hood = mesh(geo(new TorusGeometry(0.2, 0.08, 10, 24)), top, 0, 1.28, -0.12);
      hood.rotation.x = Math.PI / 2.4;
      body.add(hood);
      for (const side of [-1, 1]) body.add(mesh(geo(new CylinderGeometry(0.012, 0.012, 0.22, 6)), accent, side * 0.07, 1.06, 0.25));
      body.add(mesh(geo(new BoxGeometry(0.34, 0.14, 0.02)), accent, 0, 0.84, 0.25));
      break;
    }
    case "zip":
      body.add(mesh(geo(new BoxGeometry(0.025, 0.56, 0.02)), accent, 0, 0.97, 0.25));
      break;
    case "blazer": {
      for (const side of [-1, 1]) {
        const lapel = mesh(geo(new BoxGeometry(0.07, 0.3, 0.02)), accent, side * 0.08, 1.08, 0.25);
        lapel.rotation.z = side * 0.35;
        body.add(lapel);
      }
      break;
    }
    case "tee":
      body.add(mesh(geo(new CircleGeometry(0.1, 5)), accent, 0, 1.02, 0.252));
      break;
    case "crop":
      body.add(mesh(geo(new CylinderGeometry(0.27, 0.27, 0.12, 20)), skin, 0, 0.8, 0));
      break;
  }

  // ---- Arms and hands ----
  const sleeve = outfit.top === "vest" ? accent : top;
  const shortSleeves = outfit.top === "tee" || outfit.top === "crop";
  for (const side of [-1, 1]) {
    const arm = new Group();
    arm.position.set(side * 0.36, 1.16, 0);
    arm.rotation.z = side * 0.18;
    const upper = mesh(geo(new CapsuleGeometry(0.085, 0.36, 4, 12)), shortSleeves ? skin : sleeve, 0, -0.24, 0);
    arm.add(upper);
    if (shortSleeves) arm.add(mesh(geo(new CylinderGeometry(0.1, 0.1, 0.14, 12)), top, 0, -0.06, 0));
    arm.add(mesh(geo(new SphereGeometry(0.085, 12, 12)), skin, 0, -0.5, 0));
    body.add(arm);
    if (outfit.accessory === "phone" && side === 1) {
      const phone = mesh(geo(new BoxGeometry(0.1, 0.17, 0.02)), acc, 0, -0.52, 0.08);
      phone.rotation.x = -0.3;
      arm.add(phone);
    }
  }

  // ---- Neck and head ----
  body.add(mesh(geo(new CylinderGeometry(0.09, 0.1, 0.12, 12)), skin, 0, 1.3, 0));
  const head = new Group();
  head.position.set(0, 1.74, 0);
  body.add(head);

  const skull = mesh(geo(new SphereGeometry(0.5, 32, 24)), skin);
  skull.scale.set(1, 0.94, 0.94);
  head.add(skull);
  for (const side of [-1, 1]) head.add(mesh(geo(new SphereGeometry(0.08, 12, 12)), skin, side * 0.48, -0.02, 0));

  const eyeMat = mat("#17121C", { roughness: 0.08, metalness: 0.1 });
  const shine = mat("#FFFFFF", { roughness: 0.2, emissive: "#FFFFFF" });
  const eyes: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = mesh(geo(new SphereGeometry(0.085, 20, 16)), eyeMat, side * 0.17, -0.02, 0.42);
    eye.scale.set(1, 1.2, 0.55);
    eye.add(mesh(geo(new SphereGeometry(0.028, 8, 8)), shine, 0.03, 0.035, 0.07));
    head.add(eye);
    eyes.push(eye);
    const blush = mesh(geo(new CircleGeometry(0.07, 20)), mat("#FF7C9C", { transparent: true, opacity: 0.45, roughness: 1 }), side * 0.28, -0.13, 0.4);
    blush.rotation.y = side * 0.55;
    head.add(blush);
  }
  const mouth = mesh(geo(new TorusGeometry(0.05, 0.012, 6, 16, Math.PI)), mat("#6A2C3A"), 0, -0.17, 0.455);
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  // ---- Hair ----
  const cap = mesh(geo(new SphereGeometry(0.535, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)), hair, 0, 0.03, -0.03);
  cap.rotation.x = -0.32;
  head.add(cap);
  switch (style.hair) {
    case "long": {
      const back = mesh(geo(new CylinderGeometry(0.53, 0.6, 0.85, 28, 1, true, Math.PI * 0.42, Math.PI * 1.16)), hair, 0, -0.32, -0.04);
      (back.material as MeshStandardMaterial).side = DoubleSide;
      head.add(back);
      break;
    }
    case "bun":
      head.add(mesh(geo(new SphereGeometry(0.19, 20, 16)), hair, 0, 0.5, -0.12));
      break;
    case "braids":
      for (const side of [-1, 1]) {
        const braid = mesh(geo(new CapsuleGeometry(0.065, 0.62, 4, 10)), hair, side * 0.36, -0.42, -0.14);
        braid.rotation.z = side * 0.08;
        head.add(braid);
        head.add(mesh(geo(new SphereGeometry(0.05, 10, 10)), mat("#FFC21A", { roughness: 0.3 }), side * 0.38, -0.8, -0.15));
      }
      break;
    case "curly": {
      const curl = geo(new SphereGeometry(0.15, 12, 10));
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2;
        const ring = i % 2 === 0 ? 0.42 : 0.3;
        const y = i % 2 === 0 ? 0.22 : 0.38;
        if (Math.sin(theta) > 0.75 && i % 2 === 0) continue; // keep the face clear
        head.add(mesh(curl, hair, Math.cos(theta) * ring, y, Math.sin(theta) * ring * 0.9 - 0.06));
      }
      break;
    }
    case "short":
      break;
  }

  // ---- Accessories (starter items) ----
  switch (outfit.accessory) {
    case "cap": {
      const crown = mesh(geo(new SphereGeometry(0.55, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.45)), acc, 0, 0.1, -0.02);
      crown.rotation.x = -0.18;
      const brim = mesh(geo(new CylinderGeometry(0.3, 0.3, 0.03, 24)), acc, 0, 0.2, 0.42);
      brim.scale.set(1, 1, 0.75);
      brim.rotation.x = 0.12;
      head.add(crown, brim);
      break;
    }
    case "headphones": {
      const band = mesh(geo(new TorusGeometry(0.56, 0.035, 8, 32, Math.PI)), acc, 0, 0.02, 0);
      head.add(band);
      for (const side of [-1, 1]) {
        const cup = mesh(geo(new CylinderGeometry(0.13, 0.13, 0.1, 20)), acc, side * 0.53, -0.04, 0);
        cup.rotation.z = Math.PI / 2;
        head.add(cup);
      }
      break;
    }
    case "choker": {
      const choker = mesh(geo(new TorusGeometry(0.105, 0.02, 8, 24)), mat("#14111A"), 0, 1.32, 0);
      choker.rotation.x = Math.PI / 2;
      body.add(choker);
      body.add(mesh(geo(new SphereGeometry(0.025, 8, 8)), acc, 0, 1.3, 0.11));
      break;
    }
    case "lanyard": {
      const strap = mesh(geo(new TorusGeometry(0.2, 0.012, 6, 24, Math.PI)), acc, 0, 1.22, 0.16);
      strap.rotation.z = Math.PI;
      strap.rotation.x = -0.35;
      body.add(strap);
      body.add(mesh(geo(new BoxGeometry(0.12, 0.16, 0.02)), mat("#FFFFFF"), 0, 0.98, 0.27));
      break;
    }
    case "tote": {
      const bag = mesh(geo(new BoxGeometry(0.32, 0.34, 0.07)), acc, 0.48, 0.62, 0.05);
      bag.rotation.z = -0.1;
      const strap = mesh(geo(new TorusGeometry(0.2, 0.014, 6, 24)), acc, 0.43, 0.97, 0.05);
      strap.rotation.z = -0.2;
      body.add(bag, strap);
      break;
    }
    case "mat": {
      const roll = mesh(geo(new CylinderGeometry(0.08, 0.08, 0.75, 16)), acc, 0, 1.0, -0.3);
      roll.rotation.z = Math.PI / 3.2;
      body.add(roll);
      break;
    }
    case "phone":
    case "none":
      break;
  }

  return {
    root,
    body,
    head,
    torso,
    eyes,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
