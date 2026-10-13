// Builds the player's avatar from primitives: stylized human proportions
// (head about a quarter of the height), a face with real eyes, brows, nose and
// lips, and clothing layered over the body. Every Look option and starting
// style is drawn here, so a choice re-dresses the avatar instantly.
// A modeled GLTF character can replace this later behind the same AvatarParts.

import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, LatheGeometry,
  Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector2,
  type BufferGeometry, type Material,
} from "three";
import type { Look } from "@/lib/look";
import { getStyle, type Outfit } from "@/lib/styles";

export interface AvatarParts {
  root: Group;
  body: Group;
  head: Group;
  /** Upper body, scaled gently for breathing. */
  torso: Object3D;
  /** Eye groups, squashed on the y axis to blink. */
  eyes: Object3D[];
  /** Hip-pivoted legs and shoulder-pivoted arms (left, right), swung to walk or bent to sit. */
  legs: Object3D[];
  /** Knee pivots inside each leg (left, right). */
  knees: Object3D[];
  arms: Object3D[];
  dispose(): void;
}

interface Build {
  shoulder: number; chest: number; waist: number; hip: number;
  thigh: number; calf: number; arm: number; forearm: number;
}

const BUILDS: Record<Look["body"], Build> = {
  straight: { shoulder: 0.2, chest: 0.168, waist: 0.145, hip: 0.148, thigh: 0.075, calf: 0.052, arm: 0.047, forearm: 0.038 },
  curvy: { shoulder: 0.185, chest: 0.172, waist: 0.125, hip: 0.172, thigh: 0.083, calf: 0.054, arm: 0.044, forearm: 0.036 },
};

const TORSO_DEPTH = 0.68;
// A head about a sixth of the body height: natural proportions rather than chibi.
const HEAD_Y = 1.705;
const HEAD_SCALE = 0.8;

function shade(hex: string, f: number): string {
  const c = new Color(hex);
  if (f < 0) c.multiplyScalar(1 + f);
  else c.lerp(new Color("#ffffff"), f);
  return `#${c.getHexString()}`;
}

export function buildAvatar(look: Look, opts: { pedestal?: boolean; outfit?: Outfit } = {}): AvatarParts {
  const style = getStyle(look.style);
  const outfit = opts.outfit ?? style.outfit;
  const b = BUILDS[look.body];
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const mat = (color: string, o: Partial<{ roughness: number; metalness: number; emissive: string; opacity: number; side: typeof DoubleSide }> = {}) => {
    const m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: o.roughness ?? 0.72,
      metalness: o.metalness ?? 0,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      // Low-poly, faceted look (after the Lagos Life reference).
      flatShading: true,
    });
    if (o.emissive) m.emissive = new Color(o.emissive);
    if (o.side !== undefined) m.side = o.side;
    materials.push(m);
    return m;
  };
  const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => {
    const me = new Mesh(g, m);
    me.position.set(x, y, z);
    return me;
  };
  /** A capsule spanning two points in the parent's space. */
  const limb = (r: number, a: [number, number, number], c: [number, number, number], m: Material) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const me = mesh(geo(new CapsuleGeometry(r, Math.max(0.001, len), 2, 6)), m, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
    me.rotation.z = Math.atan2(-dx, dy);
    me.rotation.x = Math.atan2(dz, dy);
    return me;
  };

  /** A tapered limb (wide at a, narrow at c) with rounded ends. */
  const taper = (rA: number, rC: number, a: [number, number, number], c: [number, number, number], m: Material) => {
    const g = new Group();
    const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const cyl = mesh(geo(new CylinderGeometry(rC, rA, len, 8, 1, true)), m, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
    cyl.rotation.z = Math.atan2(-dx, dy);
    cyl.rotation.x = Math.atan2(dz, dy);
    g.add(cyl, mesh(geo(new SphereGeometry(rA, 8, 6)), m, ...a), mesh(geo(new SphereGeometry(rC, 8, 6)), m, ...c));
    return g;
  };

  // ---- Materials ----
  const skin = mat(look.skin, { roughness: 0.55 });
  const skinShade = mat(shade(look.skin, -0.12), { roughness: 0.55 });
  const lips = mat(shade(new Color(look.skin).lerp(new Color("#B0465A"), 0.45).getStyle(), -0.05), { roughness: 0.45 });
  const top = mat(outfit.topColor);
  const accent = mat(outfit.topAccent);
  const bottom = mat(outfit.bottomColor);
  const shoe = mat(outfit.shoeColor, { roughness: 0.45 });
  const hair = mat(look.hairColor, { roughness: 0.5, side: DoubleSide });
  const acc = mat(outfit.accessoryColor, { roughness: 0.45 });
  const fabric = mat(outfit.top === "vest" || outfit.top === "crop" ? outfit.topAccent : outfit.topColor, { roughness: 0.8, side: DoubleSide });
  const frame = mat("#17121C", { roughness: 0.3, metalness: 0.3 });

  const root = new Group();
  const body = new Group();
  root.add(body);

  // ---- Stage: pedestal with a neon rim, and a soft contact shadow ----
  if (opts.pedestal ?? true) {
    root.add(mesh(geo(new CylinderGeometry(0.95, 1.02, 0.14, 22)), mat("#16121C", { roughness: 0.4 }), 0, -0.07, 0));
    const rim = mesh(geo(new TorusGeometry(0.96, 0.016, 5, 29)), mat("#FF2E88", { emissive: "#FF2E88", roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
  }
  const shadow = mesh(geo(new CircleGeometry(0.36, 32)), mat("#000000", { opacity: 0.32 }), 0, 0.004, 0);
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);

  // ---- Torso profile (radius by height), shared by body and clothing ----
  const profile: [number, number][] = [
    [0.001, 0.87], [b.hip * 0.8, 0.88], [b.hip * 0.96, 0.92], [b.hip, 0.98], [b.waist * 1.04, 1.06],
    [b.waist, 1.13], [b.chest * 0.95, 1.22], [b.chest, 1.3], [b.chest * 0.98, 1.36], [b.shoulder * 0.95, 1.42],
    [b.shoulder * 0.62, 1.47], [0.062, 1.5], [0.001, 1.5],
  ];
  const radiusAt = (y: number) => {
    for (let i = 1; i < profile.length; i++) {
      const [r0, y0] = profile[i - 1];
      const [r1, y1] = profile[i];
      if (y >= y0 && y <= y1) return y1 === y0 ? r1 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return 0.001;
  };
  const lathe = (y0: number, y1: number, grow: number, m: Material) => {
    const pts: Vector2[] = [];
    const steps = Math.max(4, Math.round((y1 - y0) / 0.015));
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps;
      pts.push(new Vector2(Math.max(0.001, radiusAt(y) * grow), y));
    }
    const me = mesh(geo(new LatheGeometry(pts, 12)), m);
    me.scale.z = TORSO_DEPTH;
    return me;
  };
  const frontZ = (y: number, grow: number) => radiusAt(y) * grow * TORSO_DEPTH + 0.004;

  // Upper body pivots at the waist so breathing reads naturally.
  const torso = new Group();
  torso.position.y = 1.1;
  const upper = new Group();
  upper.position.y = -1.1;
  torso.add(upper);
  body.add(torso);

  upper.add(lathe(1.08, 1.5, 1, skin));
  body.add(lathe(0.87, 1.1, 1, skin));

  // ---- Legs, shoes ----
  const legsCovered = outfit.bottom === "pants" || outfit.bottom === "leggings";
  const legMat = legsCovered ? bottom : skin;
  const thighR = outfit.bottom === "leggings" ? b.thigh * 0.97 : outfit.bottom === "pants" ? b.thigh * 1.06 : b.thigh;
  const calfR = outfit.bottom === "pants" ? b.calf * 1.18 : b.calf;
  const boots = outfit.bottom === "skirt";
  const legs: Object3D[] = [];
  const knees: Object3D[] = [];
  for (const s of [-1, 1]) {
    const hipX = s * (b.hip * 0.5);
    const ankleX = s * 0.1;
    // Pivot at the hip so the whole leg swings; parts keep their body-space positions.
    const leg = new Group();
    leg.position.set(0, 0.9, 0);
    const inner = new Group();
    inner.position.set(0, -0.9, 0);
    leg.add(inner);
    inner.add(taper(thighR, calfR * 1.05, [hipX, 0.9, 0], [s * 0.092, 0.5, 0.008], legMat));
    if (outfit.bottom === "shorts") inner.add(taper(thighR * 1.18, thighR * 1.02, [hipX, 0.92, 0], [s * 0.096, 0.68, 0.005], bottom));
    // Knee pivot for the lower leg.
    const knee = new Group();
    knee.position.set(0, 0.5, 0.008);
    const lower = new Group();
    lower.position.set(0, -0.5, -0.008);
    knee.add(lower);
    inner.add(knee);
    knees.push(knee);
    lower.add(taper(calfR * 1.05, calfR * 0.72, [s * 0.092, 0.5, 0.008], [ankleX, 0.1, 0], legMat));
    if (boots) lower.add(mesh(geo(new CylinderGeometry(b.calf * 1.2, b.calf * 1.25, 0.3, 7)), shoe, ankleX, 0.22, 0));
    const foot = mesh(geo(new CapsuleGeometry(0.05, 0.12, 2, 6)), shoe, ankleX * 1.05, 0.05, 0.045);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1.15, 1, 0.95);
    lower.add(foot);
    body.add(leg);
    legs.push(leg);
  }

  // ---- Bottoms ----
  if (legsCovered || outfit.bottom === "shorts") body.add(lathe(0.87, 1.08, 1.03, bottom));
  if (outfit.bottom === "skirt") {
    body.add(lathe(0.98, 1.1, 1.03, bottom));
    const skirt = mesh(geo(new CylinderGeometry(b.hip * 1.06, b.hip * 1.55, 0.36, 13, 1, true)), mat(outfit.bottomColor, { side: DoubleSide }), 0, 0.82, 0);
    skirt.scale.z = 0.82;
    body.add(skirt);
  }

  // ---- Tops ----
  const shirtGrow = outfit.top === "puffer" ? 1.17 : 1.075;
  const topStart = outfit.top === "crop" ? 1.19 : outfit.top === "tee" || outfit.top === "hoodie" ? 1.0 : 1.02;
  const shirtMat = outfit.top === "vest" ? accent : top;
  upper.add(lathe(topStart, 1.5, shirtGrow, shirtMat));
  switch (outfit.top) {
    case "puffer":
      for (const y of [1.08, 1.2, 1.32]) {
        const band = mesh(geo(new TorusGeometry(radiusAt(y) * 1.19, 0.022, 5, 14)), top, 0, y, 0);
        band.rotation.x = Math.PI / 2;
        band.scale.y = TORSO_DEPTH;
        upper.add(band);
      }
      upper.add(mesh(geo(new BoxGeometry(0.018, 0.45, 0.01)), accent, 0, 1.25, frontZ(1.25, 1.17)));
      break;
    case "cardigan":
      upper.add(mesh(geo(new BoxGeometry(0.08, 0.42, 0.01)), accent, 0, 1.24, frontZ(1.24, 1.075)));
      for (const y of [1.12, 1.22, 1.32]) upper.add(mesh(geo(new SphereGeometry(0.012, 6, 4)), mat("#F4E7C8"), 0.03, y, frontZ(y, 1.075) + 0.004));
      break;
    case "vest":
      upper.add(lathe(1.02, 1.45, 1.1, top));
      upper.add(mesh(geo(new BoxGeometry(0.06, 0.18, 0.01)), accent, 0, 1.38, frontZ(1.38, 1.1)));
      break;
    case "hoodie": {
      const hood = mesh(geo(new TorusGeometry(0.1, 0.045, 5, 11)), top, 0, 1.5, -0.07);
      hood.rotation.x = Math.PI / 2.3;
      upper.add(hood);
      upper.add(mesh(geo(new BoxGeometry(0.2, 0.09, 0.012)), accent, 0, 1.1, frontZ(1.1, 1.075)));
      for (const s of [-1, 1]) upper.add(mesh(geo(new CylinderGeometry(0.005, 0.005, 0.12, 6)), accent, s * 0.035, 1.38, frontZ(1.38, 1.075) + 0.004));
      break;
    }
    case "zip":
      upper.add(mesh(geo(new BoxGeometry(0.012, 0.46, 0.01)), accent, 0, 1.25, frontZ(1.25, 1.075)));
      break;
    case "blazer":
      for (const s of [-1, 1]) {
        const lapel = mesh(geo(new BoxGeometry(0.035, 0.17, 0.012)), accent, s * 0.045, 1.36, frontZ(1.36, 1.075));
        lapel.rotation.z = s * 0.4;
        upper.add(lapel);
      }
      break;
    case "tee":
      upper.add(mesh(geo(new CircleGeometry(0.05, 5)), accent, 0, 1.28, frontZ(1.28, 1.075)));
      break;
    case "crop":
      break;
  }

  // ---- Arms and hands ----
  const shortSleeves = outfit.top === "tee" || outfit.top === "crop";
  const sleeveMat = outfit.top === "vest" ? accent : top;
  const armScale = outfit.top === "puffer" ? 1.35 : 1;
  const arms: Object3D[] = [];
  for (const s of [-1, 1]) {
    const arm = new Group();
    arms.push(arm);
    arm.position.set(s * (b.shoulder - 0.005), 1.42, 0);
    arm.rotation.z = s * 0.13;
    arm.add(taper(b.arm * 1.12 * armScale, b.forearm * 1.08 * armScale, [0, 0, 0], [0, -0.28, -0.01], shortSleeves ? skin : sleeveMat));
    if (shortSleeves) arm.add(taper(b.arm * 1.3, b.arm * 1.15, [0, 0, 0], [0, -0.11, 0], sleeveMat));
    arm.add(taper(b.forearm * 1.08 * armScale, b.forearm * 0.8 * armScale, [0, -0.28, -0.01], [s * -0.01, -0.54, 0.02], shortSleeves ? skin : sleeveMat));
    const hand = mesh(geo(new SphereGeometry(0.042, 6, 5)), skin, s * -0.012, -0.6, 0.02);
    hand.scale.set(0.85, 1.35, 0.6);
    arm.add(hand);
    const thumb = mesh(geo(new CapsuleGeometry(0.012, 0.03, 2, 6)), skin, s * -0.035, -0.58, 0.035);
    thumb.rotation.z = s * 0.5;
    arm.add(thumb);
    if (outfit.accessory === "phone" && s === 1) {
      const phone = mesh(geo(new BoxGeometry(0.05, 0.095, 0.01)), acc, -0.015, -0.62, 0.05);
      phone.rotation.x = -0.3;
      arm.add(phone);
    }
    upper.add(arm);
  }

  // ---- Neck and head ----
  upper.add(mesh(geo(new CylinderGeometry(0.052, 0.058, 0.16, 7)), skin, 0, 1.53, 0));
  const head = new Group();
  head.position.set(0, HEAD_Y, 0.005);
  head.scale.setScalar(HEAD_SCALE);
  upper.add(head);

  // One sphere, narrowed toward the chin, so the face has a jawline without seams.
  const skullGeo = geo(new SphereGeometry(0.19, 18, 14));
  const pos = skullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) {
      const t = -y / 0.19;
      const k = 1 - 0.3 * t * t;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * (1 - 0.12 * t * t) + 0.02 * t);
    }
  }
  skullGeo.computeVertexNormals();
  const skull = mesh(skullGeo, skin);
  skull.scale.set(0.92, 1.12, 0.98);
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = mesh(geo(new SphereGeometry(0.036, 6, 4)), skinShade, s * 0.168, -0.01, -0.005);
    ear.scale.set(0.45, 1, 0.75);
    head.add(ear);
  }

  // Eyes: white, colored iris, pupil and a catchlight.
  const white = mat("#FBF8F2", { roughness: 0.25 });
  const iris = mat(look.eyes, { roughness: 0.2 });
  const pupil = mat("#0B0910", { roughness: 0.1 });
  const shine = mat("#FFFFFF", { emissive: "#FFFFFF" });
  const eyes: Object3D[] = [];
  for (const s of [-1, 1]) {
    const eye = new Group();
    eye.position.set(s * 0.064, 0.005, 0.155);
    eye.rotation.y = s * 0.22;
    const ball = mesh(geo(new SphereGeometry(0.033, 8, 6)), white);
    ball.scale.set(1.15, 0.85, 0.55);
    eye.add(ball);
    eye.add(mesh(geo(new CircleGeometry(0.02, 20)), iris, 0, -0.002, 0.0185));
    eye.add(mesh(geo(new CircleGeometry(0.0095, 16)), pupil, 0, -0.002, 0.0192));
    eye.add(mesh(geo(new CircleGeometry(0.005, 10)), shine, 0.007, 0.006, 0.02));
    head.add(eye);
    eyes.push(eye);
    const brow = mesh(geo(new CapsuleGeometry(0.007, 0.042, 2, 6)), mat(shade(look.hairColor, -0.1)), s * 0.066, 0.05, 0.168);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
    brow.rotation.y = s * 0.22;
    head.add(brow);
  }
  const nose = mesh(geo(new SphereGeometry(0.02, 6, 4)), skinShade, 0, -0.045, 0.188);
  nose.scale.set(0.9, 1, 1.05);
  head.add(nose);
  const mouth = mesh(geo(new TorusGeometry(0.025, 0.008, 5, 8, Math.PI)), lips, 0, -0.088, 0.168);
  mouth.rotation.z = Math.PI;
  mouth.scale.set(1, 0.55, 1);
  head.add(mouth);

  // ---- Hair (hidden under full coverings) ----
  const covering = look.covering;
  const hairHidden = covering === "hijab" || covering === "turban" || covering === "headwrap" || covering === "durag";
  const capMesh = (r: number, thetaLen: number, tilt: number, y = 0.012) => {
    const c = mesh(geo(new SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI * thetaLen)), hair, 0, y, -0.008);
    c.scale.set(0.93, 1.1, 1.02);
    c.rotation.x = tilt;
    return c;
  };
  if (!hairHidden && look.hair !== "bald") {
    head.add(capMesh(look.hair === "buzz" ? 0.193 : 0.2, look.hair === "buzz" ? 0.47 : 0.55, look.hair === "buzz" ? -0.5 : -0.38));
    switch (look.hair) {
      case "long": {
        const back = mesh(geo(new CylinderGeometry(0.19, 0.23, 0.42, 13, 1, true, Math.PI * 0.42, Math.PI * 1.16)), hair, 0, -0.2, -0.02);
        head.add(back);
        for (const s of [-1, 1]) head.add(limb(0.03, [s * 0.165, 0.02, 0.05], [s * 0.19, -0.3, 0.02], hair));
        break;
      }
      case "ponytail":
        head.add(limb(0.04, [0, 0.06, -0.19], [0, -0.26, -0.26], hair));
        head.add(mesh(geo(new TorusGeometry(0.035, 0.012, 5, 8)), acc, 0, 0.045, -0.2));
        break;
      case "bun":
        head.add(mesh(geo(new SphereGeometry(0.075, 8, 6)), hair, 0, 0.22, -0.05));
        break;
      case "braids":
        for (const s of [-1, 1]) {
          for (let i = 0; i < 7; i++) {
            head.add(mesh(geo(new SphereGeometry(0.027 - i * 0.0012, 6, 4)), hair, s * (0.13 + i * 0.006), -0.06 - i * 0.055, -0.1 + i * 0.012));
          }
          head.add(mesh(geo(new SphereGeometry(0.018, 6, 4)), mat("#FFC21A", { roughness: 0.3 }), s * 0.172, -0.46, -0.016));
        }
        break;
      case "curls": {
        const curl = geo(new SphereGeometry(0.058, 6, 4));
        for (let i = 0; i < 26; i++) {
          const t = (i / 26) * Math.PI * 2;
          const elev = i % 3 === 0 ? 0.95 : i % 3 === 1 ? 0.55 : 0.2;
          const x = Math.cos(t) * Math.cos(elev) * 0.2;
          const z = Math.sin(t) * Math.cos(elev) * 0.2 - 0.02;
          const y = Math.sin(elev) * 0.22 + 0.03;
          if (z > 0.08 && y < 0.12) continue; // keep the face clear
          head.add(mesh(curl, hair, x, y, z));
        }
        break;
      }
      case "locs":
        for (let i = 0; i < 11; i++) {
          const t = Math.PI * (0.05 + (i / 10) * 0.9);
          const x = Math.cos(t) * 0.17;
          const z = -Math.sin(t) * 0.15;
          head.add(limb(0.018, [x, 0.02, z], [x * 1.25, -0.34, z * 1.2], hair));
        }
        break;
      case "short":
      case "buzz":
        break;
    }
  }

  // ---- Coverings (free for every style) ----
  switch (covering) {
    case "hijab": {
      const opening = 1.5;
      const wrap = mesh(geo(new SphereGeometry(0.215, 16, 11, Math.PI / 2 + opening / 2, Math.PI * 2 - opening, 0, Math.PI)), fabric, 0, -0.01, -0.005);
      wrap.scale.set(0.95, 1.12, 1.04);
      head.add(wrap);
      const brow = mesh(geo(new SphereGeometry(0.217, 16, 5, 0, Math.PI * 2, 0, Math.PI * 0.3)), fabric, 0, -0.005, -0.005);
      brow.scale.set(0.95, 1.12, 1.04);
      head.add(brow);
      const chin = mesh(geo(new SphereGeometry(0.217, 16, 5, 0, Math.PI * 2, Math.PI * 0.8, Math.PI * 0.2)), fabric, 0, -0.01, -0.005);
      chin.scale.set(0.95, 1.12, 1.04);
      head.add(chin);
      head.add(mesh(geo(new CylinderGeometry(0.12, 0.25, 0.24, 13, 1, true)), fabric, 0, -0.3, -0.01));
      break;
    }
    case "turban": {
      const dome = mesh(geo(new SphereGeometry(0.215, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55)), fabric, 0, 0.02, -0.01);
      dome.scale.set(0.98, 1.3, 1.05);
      dome.rotation.x = -0.18;
      head.add(dome);
      for (const [y, r] of [[0.04, 0.2], [0.1, 0.19]] as const) {
        const ring = mesh(geo(new TorusGeometry(r, 0.03, 5, 14)), fabric, 0, y, -0.012);
        ring.rotation.x = Math.PI / 2 - 0.18;
        ring.scale.set(0.95, 1.05, 1);
        head.add(ring);
      }
      break;
    }
    case "headwrap": {
      const wrapTop = mesh(geo(new SphereGeometry(0.225, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55)), fabric, 0, 0.03, -0.03);
      wrapTop.scale.set(1.0, 1.45, 1.12);
      wrapTop.rotation.x = -0.32;
      head.add(wrapTop);
      head.add(mesh(geo(new SphereGeometry(0.055, 6, 5)), fabric, 0.02, 0.27, 0.06));
      break;
    }
    case "durag": {
      const cap = mesh(geo(new SphereGeometry(0.198, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52)), fabric, 0, 0.012, -0.008);
      cap.scale.set(0.93, 1.1, 1.02);
      cap.rotation.x = -0.4;
      head.add(cap);
      for (const s of [-1, 1]) {
        const tail = mesh(geo(new BoxGeometry(0.045, 0.26, 0.008)), fabric, s * 0.03, -0.14, -0.2);
        tail.rotation.x = 0.25;
        head.add(tail);
      }
      break;
    }
    case "kippah": {
      const k = mesh(geo(new SphereGeometry(0.1, 9, 4, 0, Math.PI * 2, 0, Math.PI * 0.28)), fabric, 0, 0.13, -0.05);
      k.rotation.x = -0.55;
      head.add(k);
      break;
    }
    case "none":
      break;
  }

  // ---- Glasses ----
  if (look.glasses !== "none") {
    const square = look.glasses === "square";
    for (const s of [-1, 1]) {
      const rim = mesh(geo(new TorusGeometry(0.034, 0.005, 8, square ? 4 : 28)), frame, s * 0.066, 0.002, 0.19);
      if (square) {
        rim.rotation.z = Math.PI / 4;
        rim.scale.set(1.25, 1.0, 1);
      }
      rim.rotation.y = s * 0.2;
      head.add(rim);
      if (look.glasses === "shades") {
        const lens = mesh(geo(new CircleGeometry(0.034, 24)), mat("#0E0B12", { roughness: 0.1, metalness: 0.5, opacity: 0.9 }), s * 0.066, 0.002, 0.191);
        lens.rotation.y = s * 0.2;
        head.add(lens);
      }
      const temple = mesh(geo(new BoxGeometry(0.006, 0.006, 0.17)), frame, s * 0.158, 0.008, 0.1);
      head.add(temple);
    }
    head.add(mesh(geo(new BoxGeometry(0.03, 0.006, 0.006)), frame, 0, 0.01, 0.2));
  }

  // ---- Starter accessories ----
  switch (outfit.accessory) {
    case "cap":
      if (covering === "none") {
        const crown = mesh(geo(new SphereGeometry(0.212, 14, 5, 0, Math.PI * 2, 0, Math.PI * 0.46)), acc, 0, 0.04, -0.01);
        crown.scale.set(0.95, 1.08, 1.04);
        crown.rotation.x = -0.12;
        const brim = mesh(geo(new CylinderGeometry(0.13, 0.13, 0.012, 11)), acc, 0, 0.085, 0.19);
        brim.scale.set(1, 1, 0.8);
        brim.rotation.x = 0.16;
        head.add(crown, brim);
      }
      break;
    case "headphones": {
      head.add(mesh(geo(new TorusGeometry(0.215, 0.014, 5, 14, Math.PI)), acc, 0, 0.02, -0.01));
      for (const s of [-1, 1]) {
        const cup = mesh(geo(new CylinderGeometry(0.055, 0.055, 0.04, 9)), acc, s * 0.2, -0.01, -0.005);
        cup.rotation.z = Math.PI / 2;
        head.add(cup);
      }
      break;
    }
    case "choker": {
      const choker = mesh(geo(new TorusGeometry(0.056, 0.008, 5, 11)), mat("#14111A"), 0, 1.565, 0.004);
      choker.rotation.x = Math.PI / 2;
      upper.add(choker);
      upper.add(mesh(geo(new SphereGeometry(0.01, 6, 4)), acc, 0, 1.55, 0.06));
      break;
    }
    case "lanyard": {
      for (const s of [-1, 1]) upper.add(limb(0.005, [s * 0.05, 1.5, 0.04], [s * 0.012, 1.27, frontZ(1.27, 1.075)], acc));
      upper.add(mesh(geo(new BoxGeometry(0.06, 0.08, 0.006)), mat("#FFFFFF"), 0, 1.22, frontZ(1.22, 1.075) + 0.004));
      break;
    }
    case "tote": {
      const bag = mesh(geo(new BoxGeometry(0.2, 0.22, 0.05)), acc, b.shoulder + 0.07, 1.02, 0.02);
      bag.rotation.z = -0.08;
      upper.add(bag);
      upper.add(limb(0.008, [b.shoulder - 0.02, 1.43, 0.0], [b.shoulder + 0.05, 1.13, 0.02], acc));
      break;
    }
    case "mat": {
      const roll = mesh(geo(new CylinderGeometry(0.05, 0.05, 0.55, 7)), acc, 0, 1.2, -radiusAt(1.2) * TORSO_DEPTH - 0.06);
      roll.rotation.z = Math.PI / 3.4;
      upper.add(roll);
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
    legs,
    knees,
    arms,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
