// Solid shoes (owner, Nov 19: "the clothes and shoes don't render well. They often look chopped or distorted"). The old
// shoes were cut from the bare foot's own skin, so they showed the toes, bent with them and tore at the ankle. These are
// real 3D shoes: measured from this body's foot at build time, then fixed to the foot bone (and a boot's shaft to the
// shin bone), so they keep their shape in every pose. The skin under them isn't drawn (the garment's cover bits).
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Bone, type SkinnedMesh } from "three";
import type { Finish } from "@/lib/avatarCatalog";

/** What kind of shoe a worn shoe piece is. */
export type ShoeStyle = "sneaker" | "dress" | "heel" | "sandal" | "boot" | "kneeboot";

/** The garment kinds (lib/avatarCatalog.ts GARMENT_TEMPLATES / GARMENT_DETAILS): 13 boots, 14 sneakers, 17 dress shoes. */
export function shoeStyle(file: string, kind: number, pattern = 0, cover?: number): ShoeStyle {
  if (file === "kneeboots") return "kneeboot";
  if (file === "boots" || kind === 13) return "boot";
  if (pattern & 16384) return "sandal";
  // The catalog's heels are the dress shoes that showed the foot (cover 0).
  if (kind === 17) return cover === 0 ? "heel" : "dress";
  return "sneaker";
}

interface Pt { x: number; y: number; z: number }

/** The foot's vertices in a frame on the ground: x across, y up from the sole, z from the heel toward the toes. */
function measureFoot(mesh: SkinnedMesh, side: "Left" | "Right") {
  const names = mesh.skeleton.bones.map((b) => b.name);
  const want = new Set([`${side}Foot`, `${side}ToeBase`, `${side}Toe_End`, `${side}ToeEnd`].map((n) => names.indexOf(n)).filter((i) => i >= 0));
  const si = mesh.geometry.getAttribute("skinIndex"), sw = mesh.geometry.getAttribute("skinWeight"), pos = mesh.geometry.getAttribute("position");
  const pts: Vector3[] = [];
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = -1, bw = 0;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    if (!want.has(best)) continue;
    mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
    pts.push(v.clone());
  }
  return pts;
}

/** Shin vertices between two heights on the leg, for a boot's shaft. */
function measureShin(mesh: SkinnedMesh, side: "Left" | "Right") {
  const names = mesh.skeleton.bones.map((b) => b.name);
  const want = names.indexOf(`${side}Leg`);
  const si = mesh.geometry.getAttribute("skinIndex"), sw = mesh.geometry.getAttribute("skinWeight"), pos = mesh.geometry.getAttribute("position");
  const pts: Vector3[] = [];
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = -1, bw = 0;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    if (best !== want) continue;
    mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
    pts.push(v.clone());
  }
  return pts;
}

/** A closed loft: rings of points (each the same count) joined into a tube, with caps at both ends. */
function loft(rings: Pt[][], colors: Color[], caps: [boolean, boolean] = [true, true]): BufferGeometry {
  const n = rings[0].length;
  const P: number[] = [], C: number[] = [], I: number[] = [];
  rings.forEach((r, k) => r.forEach((p) => { P.push(p.x, p.y, p.z); C.push(colors[k].r, colors[k].g, colors[k].b); }));
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < n; j++) {
    const a = k * n + j, b = k * n + ((j + 1) % n), c = (k + 1) * n + j, d = (k + 1) * n + ((j + 1) % n);
    I.push(a, c, b, b, c, d);
  }
  // Caps: a fan from each end ring's middle.
  for (const [k, flip] of [[0, true], [rings.length - 1, false]] as const) {
    if (!caps[k === 0 ? 0 : 1]) continue;
    const r = rings[k];
    const m = r.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n, z: s.z + p.z / n }), { x: 0, y: 0, z: 0 });
    const ci = P.length / 3;
    P.push(m.x, m.y, m.z); C.push(colors[k].r, colors[k].g, colors[k].b);
    for (let j = 0; j < n; j++) { const a = k * n + j, b = k * n + ((j + 1) % n); if (flip) I.push(ci, a, b); else I.push(ci, b, a); }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(P, 3));
  g.setAttribute("color", new Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** A rounded cross-section: flat underneath, a soft dome on top (superellipse), `n` points around. */
function section(w: number, h: number, base: number, n: number, z: number, sq = 2.6): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq) * w;
    const yy = s >= 0 ? Math.pow(s, 2 / sq) * h : Math.sign(s) * Math.pow(Math.abs(s), 2 / 6) * 0.004;
    out.push({ x, y: base + Math.max(0, yy), z });
  }
  return out;
}

export interface ShoeOpts {
  style: ShoeStyle; color: string; accent: string; finish?: Finish; glowSole?: boolean; low?: boolean;
  /** The cover bit of the skin these shoes hide: a boot's shaft, or a low shoe's sock, reaches just past where it ends. */
  coverBit?: number;
}

/** The highest point (world y) of the skin a cover bit hides on one leg, at the rest pose. */
function coverTop(mesh: SkinnedMesh, bit: number, side: "Left" | "Right"): number | null {
  const c = mesh.geometry.getAttribute("cover");
  if (!c || !bit) return null;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const legs = new Set([`${side}Foot`, `${side}ToeBase`, `${side}Leg`].map((n) => names.indexOf(n)));
  const si = mesh.geometry.getAttribute("skinIndex"), sw = mesh.geometry.getAttribute("skinWeight"), pos = mesh.geometry.getAttribute("position");
  let top = -Infinity;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (!(Math.round(c.getX(i)) & bit)) continue;
    let best = -1, bw = 0;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    if (!legs.has(best)) continue;
    mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
    top = Math.max(top, v.y);
  }
  return Number.isFinite(top) ? top : null;
}

/**
 * Builds one pair and fixes it to the feet (and a boot's shafts to the shins). The body must stand in its rest pose and
 * have its world matrices up to date. Returns the materials (for dispose) and the meshes.
 */
export function attachShoes(mesh: SkinnedMesh, bones: Map<string, Bone>, o: ShoeOpts) {
  const meshes: Mesh[] = [];
  const upper = new MeshStandardMaterial({
    vertexColors: true,
    roughness: o.finish === "patent" ? 0.18 : o.finish === "leather" ? 0.42 : o.finish === "matte" ? 0.95 : o.style === "sneaker" ? 0.7 : 0.5,
    metalness: o.finish === "patent" ? 0.08 : 0,
    emissive: o.glowSole ? new Color(o.accent) : new Color(0),
    emissiveIntensity: o.glowSole ? 0.0 : 0,
    side: DoubleSide,
  });
  const n = o.low ? 12 : 20;
  const steps = o.low ? 9 : 14;
  for (const side of ["Left", "Right"] as const) {
    const foot = bones.get(`${side}Foot`), toe = bones.get(`${side}ToeBase`), shin = bones.get(`${side}Leg`);
    if (!foot) continue;
    const pts = measureFoot(mesh, side);
    if (pts.length < 20) continue;
    // The frame: on the ground under the foot, z along the foot (heel to toe), y up.
    const fw = foot.getWorldPosition(new Vector3()), tw = (toe ?? foot).getWorldPosition(new Vector3());
    const fwd = new Vector3(tw.x - fw.x, 0, tw.z - fw.z);
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
    fwd.normalize();
    const up = new Vector3(0, 1, 0), across = new Vector3().crossVectors(up, fwd).normalize();
    // The sole sits on the floor (the body's own origin, at build time the rig stands at 0): in the idle pose the toes dip
    // a few centimetres below it, and a sole cut from the lowest toe sank out of sight on a solid floor.
    const lowest = Math.min(...pts.map((p) => p.y));
    const minY = Math.max(lowest, Math.min(0, fw.y - 0.02));
    const local = pts.map((p) => { const d = p.clone().sub(fw); return { x: d.dot(across), y: p.y - minY, z: d.dot(fwd) }; });
    const z0 = Math.min(...local.map((p) => p.z)), z1 = Math.max(...local.map((p) => p.z));
    const L = z1 - z0;
    const cx = local.reduce((s, p) => s + p.x, 0) / local.length;
    // The ankle's height: the highest heel-end point, and never lower than the ankle bone itself (low-detail bodies have
    // few points there).
    const ankleY = Math.max(fw.y - minY + 0.015, ...local.filter((p) => p.z < z0 + L * 0.35).map((p) => p.y));
    // How tall the upper rises at each point along the foot, and how wide the foot is there (with room for the shoe).
    const pad = o.style === "boot" || o.style === "kneeboot" ? 0.009 : o.style === "sneaker" ? 0.011 : 0.008;
    const sole = o.style === "sneaker" ? 0.022 : o.style === "boot" || o.style === "kneeboot" ? 0.026 : o.style === "heel" ? 0.006 : 0.01;
    const band = L / steps;
    // The foot's width and height along its length, from the points near each slice. Low-detail bodies have few points on
    // the foot, so the window widens until it finds some, and the profile never dips below a smooth foot shape.
    const slice = (z: number) => {
      for (const k of [0.9, 1.6, 2.6, 4]) {
        const near = local.filter((p) => Math.abs(p.z - z) < band * k);
        if (near.length >= 3) return { w: Math.max(...near.map((p) => Math.abs(p.x - cx))), h: Math.max(...near.map((p) => p.y)) };
      }
      return { w: 0, h: 0 };
    };
    const maxW = Math.max(0.042, ...local.map((p) => Math.abs(p.x - cx)));
    const at = (z: number) => {
      const m = slice(z);
      const t = (z - z0) / L;
      // A plain foot: tallest at the instep, lowest at the toes; widest at the ball.
      const shapeH = ankleY * (t < 0.35 ? 0.85 : 0.85 - (t - 0.35) * 1.0);
      const shapeW = maxW * (t < 0.2 ? 0.7 + t : t < 0.75 ? 0.9 + (t - 0.2) * 0.18 : 1 - (t - 0.75) * 0.9);
      return { w: Math.max(0.012, m.w, shapeW * 0.9), h: Math.max(0.015, m.h, shapeH * 0.9) };
    };
    const rings: Pt[][] = [], cols: Color[] = [];
    const solePts: Pt[][] = [], soleCols: Color[] = [];
    const upperC = new Color(o.color), accentC = new Color(o.accent), white = new Color("#F2F0EA");
    const soleC = o.style === "sneaker" ? white : accentC;
    const heelLift = o.style === "heel" ? 0.055 : o.style === "dress" ? 0.012 : 0;
    // A collar height: sneakers and dress shoes stop below the ankle bone, boots cover it.
    const collar = o.style === "sneaker" ? ankleY * 0.72 : o.style === "dress" || o.style === "heel" ? ankleY * 0.45 : ankleY * 1.02;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      // Round the heel and toe in: the ends taper.
      const z = z0 - pad + t * (L + pad * 3);
      const m = at(Math.min(z1, Math.max(z0, z)));
      const endTaper = Math.sin(Math.PI * Math.min(1, Math.max(0.04, t))) ** 0.35;
      const toeLow = t > 0.55 ? 1 - (t - 0.55) * 0.9 : 1;
      const lift = heelLift * Math.max(0, 1 - t / 0.6); // the heel raised, the ball on the ground
      const w = (m.w + pad) * endTaper;
      const top = Math.min(o.style === "sandal" ? sole + 0.004 : collar, m.h + pad) * toeLow;
      const h = Math.max(0.01, (o.style === "sandal" ? 0.004 : top - sole) * (0.6 + 0.4 * endTaper));
      rings.push(section(w, h, sole + lift, n, z, 3.2).map((p) => ({ x: p.x + cx, y: p.y, z: p.z })));
      const capped = o.style === "sneaker" && t < 0.14; // the heel tab in the accent
      cols.push(capped ? accentC : upperC);
      // The sole: a slab a little wider than the upper, flat on the ground (a heel's sole follows the arch).
      const sw2 = (m.w + pad * 1.6) * Math.max(0.35, endTaper);
      const soleRing: Pt[] = [];
      const soleTop = sole + lift;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        soleRing.push({ x: cx + Math.sign(c) * Math.pow(Math.abs(c), 0.5) * sw2, y: s >= 0 ? soleTop : (o.style === "heel" && t < 0.25 ? 0 : o.style === "heel" ? lift * 0.9 : 0), z });
      }
      solePts.push(soleRing);
      soleCols.push(o.style === "sneaker" && Math.abs(t - 0.5) < 0.42 && k % 2 === 0 ? soleC : soleC);
    }
    const toLocal = new Matrix4().copy(foot.matrixWorld).invert();
    const frame = new Matrix4().makeBasis(across, up, fwd).setPosition(fw.x, minY, fw.z);
    const place = (g: BufferGeometry) => { g.applyMatrix4(frame); g.applyMatrix4(toLocal); g.computeVertexNormals(); return g; };
    // The shoe bends at the ball of the foot like a real one: the back half rides the foot bone, the toe the toe bone
    // (rigid parts on their bones; a SkinnedMesh drifted when the avatar turned far round).
    const ballT = toe ? Math.min(0.85, Math.max(0.5, (tw.clone().sub(fw).dot(fwd) - z0) / L)) : 2;
    const split = Math.min(steps, Math.max(1, Math.round(ballT * steps)));
    const soleMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide, emissive: o.glowSole ? accentC : new Color(0), emissiveIntensity: o.glowSole ? 1.2 : 0 });
    const halves = (rs: Pt[][], cs: Color[], mat: MeshStandardMaterial) => {
      const parts: [Pt[][], Color[], Bone, [boolean, boolean]][] = toe && split < steps
        ? [[rs.slice(0, split + 1), cs.slice(0, split + 1), foot, [true, false]], [rs.slice(split), cs.slice(split), toe, [false, true]]]
        : [[rs, cs, foot, [true, true]]];
      for (const [r2, c2, bone, caps] of parts) {
        const g = loft(r2, c2, caps);
        g.applyMatrix4(frame);
        g.applyMatrix4(new Matrix4().copy(bone.matrixWorld).invert());
        g.computeVertexNormals();
        const m = new Mesh(g, mat);
        m.castShadow = true; bone.add(m); meshes.push(m);
      }
    };
    halves(rings, cols, upper);
    halves(solePts, soleCols, soleMat);
    // A heel's stiletto block under the heel.
    if (o.style === "heel") {
      const hz = z0 + L * 0.06, hw = 0.011;
      const block: Pt[][] = [0, 1].map((k) => [0, 1, 2, 3].map((j) => ({ x: cx + (j === 0 || j === 3 ? -hw : hw), y: k ? heelLift : 0, z: hz + (j < 2 ? -hw : hw) * (k ? 1.6 : 1) })));
      const b = new Mesh(place(loft(block, [accentC, accentC])), soleMat);
      b.castShadow = true; foot.add(b); meshes.push(b);
    }
    // Sandal straps: two bands over the foot.
    if (o.style === "sandal") {
      for (const t of [0.42, 0.7]) {
        const z = z0 + L * t, m = at(z);
        const r1 = section(m.w + 0.004, Math.max(0.012, m.h - sole), sole, n, z - 0.006).map((p) => ({ ...p, x: p.x + cx }));
        const r2 = r1.map((p) => ({ ...p, z: p.z + 0.012 }));
        const s = new Mesh(place(loft([r1, r2], [upperC, upperC])), upper);
        s.castShadow = true; foot.add(s); meshes.push(s);
      }
    }
    // A boot's shaft, or a low shoe's sock, on the shin bone: rings round the leg from below the ankle up to just past the
    // hidden skin's edge (so no cut shows), else to mid-shin or the knee.
    const boot = o.style === "boot" || o.style === "kneeboot";
    const cut = o.style === "sandal" || o.style === "heel" ? null : coverTop(mesh, o.coverBit ?? 0, side);
    if ((boot || cut !== null) && shin) {
      const shinPts = measureShin(mesh, side);
      const kw = shin.getWorldPosition(new Vector3());
      const axis = new Vector3().subVectors(fw, kw);
      const legLen = axis.length();
      axis.normalize();
      const vertical = Math.max(0.3, -axis.y);
      const reach = cut !== null ? Math.max(0.06, (cut - fw.y) / (legLen * vertical) + (boot ? 0.04 : 0.025)) : o.style === "kneeboot" ? 0.9 : 0.6; // of the shin, from the ankle up
      const sockC = new Color(o.style === "sneaker" ? "#EEEDE8" : "#26232B");
      const shaftC = boot ? upperC : sockC;
      const ringsS: Pt[][] = [], colsS: Color[] = [];
      const ax2 = new Vector3().crossVectors(axis, fwd).normalize(), ax3 = new Vector3().crossVectors(ax2, axis).normalize();
      const ringN = o.low ? 6 : 9;
      for (let k = 0; k <= ringN; k++) {
        const s = -0.1 + (k / ringN) * (reach + 0.1); // 0 the ankle, 1 the knee (it starts inside the shoe)
        const c = new Vector3().copy(fw).addScaledVector(axis, -s * legLen);
        const near = shinPts.filter((p) => Math.abs(new Vector3().subVectors(p, c).dot(axis)) < legLen / ringN * 0.8);
        let rx = 0.035, rz = 0.035, ox = 0, oz = 0;
        if (near.length > 4) {
          const xs = near.map((p) => new Vector3().subVectors(p, c).dot(ax2)), zs = near.map((p) => new Vector3().subVectors(p, c).dot(ax3));
          const [xa, xb, za, zb] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
          rx = (xb - xa) / 2 + (boot ? 0.008 : 0.004); rz = (zb - za) / 2 + (boot ? 0.008 : 0.004); ox = (xa + xb) / 2; oz = (za + zb) / 2;
        } else if (ringsS.length) {
          const prev = ringsS[ringsS.length - 1];
          rx = Math.max(...prev.map((p) => Math.abs(p.x))) ; rz = rx;
        }
        // Rings in the shin frame (x across, z forward, y along the leg), centred on the leg.
        const ring: Pt[] = [];
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2;
          const p = new Vector3().copy(c).addScaledVector(ax2, ox + Math.cos(a) * rx).addScaledVector(ax3, oz + Math.sin(a) * rz);
          ring.push({ x: p.x, y: p.y, z: p.z });
        }
        ringsS.push(ring);
        colsS.push(k === ringN && boot ? shaftC.clone().multiplyScalar(0.8) : shaftC);
      }
      const g = loft(ringsS, colsS);
      // Open at the top: drop the top cap's triangles (the last n) so the shaft reads as a boot.
      const idx = g.getIndex()!.array as ArrayLike<number>;
      g.setIndex(Array.from(idx).slice(0, idx.length - n * 3));
      g.applyMatrix4(new Matrix4().copy(shin.matrixWorld).invert());
      g.computeVertexNormals();
      const shaft = new Mesh(g, boot ? upper : new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide }));
      shaft.castShadow = true; shin.add(shaft); meshes.push(shaft);
      void legLen;
    }
    void ankleY;
  }
  return { meshes, materials: [upper, ...meshes.map((m) => m.material as MeshStandardMaterial)] };
}
