// The everyday wardrobe's garment templates (stage 4 of the avatar upgrade, docs/shop-manager.md): every top, bottom
// and boot players can own today, cut from the bald masters the same way as the hoodie (scripts/garments.mjs), so
// they bend with every pose and body type. A template is a short description over shared measurements (wardrobeFit):
//
//   top     hem (meters below the top of the legs; the legs themselves stay out), sleeves (long, short or none), neckline (crew, scoop, V, open front, collar), fit
//   bottom  waist, leg end (ankle, above the knee), fit
//   skirt   a skirt hangs from the hips over both legs, so it is its own surface (a flared cone), not a cut; a gown's
//           runs to the ankle
//   overalls  trousers to the ankle with a bib up to the chest and straps over the shoulders
//   boots   the foot and the shin up to mid-calf; sneakers, the foot to just above the ankle
//
// _PAT, read by the game's garment shader (components/avatar/baseAvatar.ts) with the template's own details:
//   x  distance to a hem, cuff or waistband (meters, capped at 1)
//   y  across the front, from the middle (meters; 1 on the back and on sleeves and legs)
//   z  height (meters above the hoodie's hem line, the top of the legs; boots: above the ground)
//   w  part: 0 the garment, 0.25 collar, 1 accent (a blazer's lapels are its band along the open neck, up high)

import { add, COVER, cross, cutShell, dot, hoodieFit, len, lerp, mul, norm, smoothEdges, smoothSkin, sub, weightOn } from "./garments.mjs";

/** Each template: its kind, its cover bit (the skin it hides) and its shape. The game reads the same names. */
export const WARDROBE = {
  tee: { kind: "top", bit: 2, hem: 0, sleeve: "short", neck: "crew", gap: 0.014, collar: "rib" },
  crop: { kind: "top", bit: 4, hem: "crop", sleeve: "short", neck: "scoop", gap: 0.011 },
  vest: { kind: "top", bit: 8, hem: -0.02, sleeve: "none", neck: "v", gap: 0.014 },
  zip: { kind: "top", bit: 16, hem: -0.02, sleeve: "long", neck: "crew", gap: 0.016, collar: "stand" },
  cardigan: { kind: "top", bit: 32, hem: 0, sleeve: "long", neck: "open", gap: 0.014 },
  blazer: { kind: "top", bit: 64, hem: 0, sleeve: "long", neck: "lapel", gap: 0.016 },
  puffer: { kind: "top", bit: 128, hem: -0.01, sleeve: "long", neck: "crew", gap: 0.034, collar: "high" },
  pants: { kind: "bottom", bit: 256, end: "ankle", gap: 0.007 },
  shorts: { kind: "bottom", bit: 512, end: "thigh", gap: 0.008 },
  leggings: { kind: "bottom", bit: 1024, end: "ankle", gap: 0.0035 },
  skirt: { kind: "skirt", bit: 2048 },
  boots: { kind: "boots", bit: 4096, gap: 0.006 },
  // The default shoes on the barefoot bodies: the foot and the ankle, a low top just above the ankle bone.
  sneakers: { kind: "boots", bit: 8192, gap: 0.008, end: "ankle" },
  // The whole Shop outfits' own pieces (lib/avatarCatalog.ts SET_LOOKS): a gown or robe's skirt to the ankle, and
  // overalls (trousers with a bib and two straps over the shoulders, outside the top worn under them).
  gown: { kind: "skirt", bit: 16384, long: true },
  overalls: { kind: "overalls", bit: 32768, gap: 0.021 },
};
if (Object.values(WARDROBE).some((t) => t.bit & COVER.hoodie)) throw new Error("cover bit clash");

/** The shared measurements on one body. */
export function wardrobeFit(body) {
  const f = hoodieFit(body);
  const B = body.bone;
  const at = (a, b, t) => lerp(B[a], B[b], t);
  const plane = (p, dir) => ({ at: p, dir: norm(dir) });
  const sides = ["Left", "Right"];
  return {
    ...f,
    // The crop top stops between the chest and the navel; the waistband sits a little above the hip bone.
    cropY: lerp(B.Spine02, B.Spine01, 0.55)[1],
    waistY: B.Hips[1] + 0.035,
    // Overalls: the bib's top edge on the chest; each strap 7.5 cm either side of the middle.
    bibY: lerp(B.Spine01, B.Spine02, 0.75)[1],
    strapX: 0.075,
    hipsY: B.Hips[1],
    shortSleeve: Object.fromEntries(sides.map((s) => [s, plane(at(`${s}Arm`, `${s}ForeArm`, 0.45), sub(B[`${s}ForeArm`], B[`${s}Arm`]))])),
    // Sleeveless: the armhole, square to the line from the neck to the shoulder joint, just inside the joint.
    armhole: Object.fromEntries(sides.map((s) => {
      const out = norm([B[`${s}Arm`][0] - f.center[0], 0, 0]);
      return [s, plane(sub(B[`${s}Arm`], mul(out, 0.03)), out)];
    })),
    ankle: Object.fromEntries(sides.map((s) => [s, plane(at(`${s}Leg`, `${s}Foot`, 0.86), sub(B[`${s}Foot`], B[`${s}Leg`]))])),
    thigh: Object.fromEntries(sides.map((s) => [s, plane(at(`${s}UpLeg`, `${s}Leg`, 0.62), sub(B[`${s}Leg`], B[`${s}UpLeg`]))])),
    ankleTop: Object.fromEntries(sides.map((s) => [s, plane(at(`${s}Leg`, `${s}Foot`, 0.93), sub(B[`${s}Foot`], B[`${s}Leg`]))])),
    calf: Object.fromEntries(sides.map((s) => [s, plane(at(`${s}Leg`, `${s}Foot`, 0.5), sub(B[`${s}Foot`], B[`${s}Leg`]))])),
  };
}

/** Which limb a vertex belongs to: "LeftArm", "RightLeg"... or "torso". Feet count as legs; hands as arms. */
function limbOf(body, i) {
  for (const s of ["Left", "Right"]) {
    if (weightOn(body, i, new RegExp(`^${s}(Arm|ForeArm|Hand)$`)) >= 0.5) return `${s}Arm`;
    if (weightOn(body, i, new RegExp(`^${s}(UpLeg|Leg|Foot|ToeBase)$`)) >= 0.5) return `${s}Leg`;
  }
  return "torso";
}
const before = (pl, p) => dot(sub(pl.at, p), pl.dir); // positive on the near (body) side of a cut

/** A top's neckline: positive inside the garment. */
function neckline(f, t, p) {
  const r = Math.hypot(p[0] - f.center[0], p[2] - f.center[2]);
  let s = Math.min(Math.max(f.neckY - p[1], r - f.rCut), f.ceiling - p[1]);
  const front = (p[2] - f.center[2]) * f.front, dx = Math.abs(p[0] - f.center[0]);
  const cut = (depth, slope, curve = 0) => {
    // Remove the front above a V (or a curve) that starts `depth` below the neck base.
    if (front <= 0) return;
    const line = f.neckY - depth + dx * slope + dx * dx * curve;
    s = Math.min(s, Math.max(line - p[1], -front + 0.015));
  };
  if (t.neck === "scoop") cut(0.07, 0, 9);
  if (t.neck === "v") cut(0.11, 1.4);
  if (t.neck === "open") cut(0.2, 2.4);
  if (t.neck === "lapel") cut(0.22, 2.0);
  return s;
}

/** How much of a vertex hangs on each limb: arm chains and legs (with the feet), by side. */
function limbWeights(body, i) {
  const w = (re) => weightOn(body, i, re);
  return { LeftArm: w(/^Left(Arm|ForeArm|Hand)$/), RightArm: w(/^Right(Arm|ForeArm|Hand)$/), LeftLeg: w(/^Left(UpLeg|Leg|Foot|ToeBase)$/), RightLeg: w(/^Right(UpLeg|Leg|Foot|ToeBase)$/) };
}

/**
 * A template's keep function over the body: { s, edge } per vertex. The body's rule (hem, neckline, waist) and each
 * limb's (a cuff, an armhole, a leg's end) are blended by the vertex's skin weights, so the cut is smooth where the
 * arms and legs join the body instead of following the weights' ragged boundary.
 */
export function wardrobeKeep(body, f, t) {
  return Array.from({ length: body.count }, (_, i) => {
    const p = body.pos[i], lw = limbWeights(body, i);
    const blend = (base, limbs) => {
      // base: { s, edge }; limbs: { LeftArm: { s, edge } | undefined, ... } — weighted toward the heaviest limb.
      let best = null, bw = 0;
      for (const k of Object.keys(limbs)) if (limbs[k] && lw[k] > bw) { bw = lw[k]; best = limbs[k]; }
      if (!best) return base;
      const k = Math.min(1, Math.max(0, (bw - 0.25) / 0.5));
      const s = base.s * (1 - k) + best.s * k;
      return { s, edge: k > 0.5 ? best.edge : base.edge };
    };
    if (t.kind === "top") {
      const hemY = t.hem === "crop" ? f.cropY : f.hemY - t.hem;
      let base = { s: p[1] - hemY, edge: "hem" };
      const n = neckline(f, t, p);
      if (n < base.s) base = { s: n, edge: "neck" };
      if (t.sleeve === "none") for (const side of ["Left", "Right"]) {
        const a = before(f.armhole[side], p);
        if (a < base.s) base = { s: a, edge: "armhole" };
      }
      const arm = (side) => {
        if (t.sleeve === "none") return { s: Math.min(-0.02, before(f.armhole[side], p)), edge: "armhole" };
        return { s: before(t.sleeve === "short" ? f.shortSleeve[side] : f.wrists[side], p), edge: "cuff" };
      };
      // The legs follow the hem like the body (the hem cuts across the hips).
      return blend(base, { LeftArm: arm("Left"), RightArm: arm("Right") });
    }
    if (t.kind === "bottom") {
      const base = { s: f.waistY - p[1], edge: "waist" };
      const leg = (side) => {
        const e = before(t.end === "ankle" ? f.ankle[side] : f.thigh[side], p);
        return e < base.s ? { s: e, edge: "cuff" } : base;
      };
      const arm = { s: -0.05, edge: "waist" };
      return blend(base, { LeftLeg: leg("Left"), RightLeg: leg("Right"), LeftArm: arm, RightArm: arm });
    }
    if (t.kind === "overalls") {
      // Below the bib's top edge everything but the arms (the legs to the ankle); above it, the two straps, up and
      // over the shoulders to the back.
      const dx = Math.abs(Math.abs(p[0] - f.center[0]) - f.strapX);
      const strap = p[1] < f.neckY - 0.01 ? 0.022 - dx : -1;
      const base = { s: Math.max(f.bibY - p[1], strap), edge: f.bibY - p[1] > strap ? "waist" : "strap" };
      const leg = (side) => {
        const e = before(f.ankle[side], p);
        return e < base.s ? { s: e, edge: "cuff" } : base;
      };
      const arm = { s: -0.05, edge: "waist" };
      return blend(base, { LeftLeg: leg("Left"), RightLeg: leg("Right"), LeftArm: arm, RightArm: arm });
    }
    if (t.kind === "boots") {
      // The foot's side of the cut (below it), so the shoe holds the foot and stops on the shin.
      const leg = (side) => ({ s: -before(t.end === "ankle" ? f.ankleTop[side] : f.calf[side], p), edge: "cuff" });
      const r = blend({ s: -0.05, edge: "cuff" }, { LeftLeg: leg("Left"), RightLeg: leg("Right") });
      return r;
    }
    return { s: -1, edge: null };
  });
}

/**
 * The masters' baked T-shirt collar is a raised ring round the neck; under the game's own necklines it would show as
 * a ring, so it's pressed into the neck: between the neckline and the chin, nothing stands further from the neck's
 * axis than the neck itself. Changes body.pos in place (call before anything reads it).
 */
export function flattenCollar(body) {
  const f = wardrobeFit(body);
  const lim = f.rNeck + 0.004;
  for (let i = 0; i < body.count; i++) {
    const p = body.pos[i];
    if (p[1] < f.neckY + 0.002 || p[1] > f.chinY - 0.012) continue;
    const dx = p[0] - f.center[0], dz = p[2] - f.center[2], r = Math.hypot(dx, dz);
    if (r > lim && r < lim + 0.04) body.pos[i] = [f.center[0] + (dx / r) * lim, p[1], f.center[2] + (dz / r) * lim];
  }
}

/**
 * The masters' baked basics are modelled, not just painted: the male tee's folds, collar and sleeve edges are in the
 * body's shape, so a V-neck, a crop top or a vest would show them in the light. The top region (chest, back,
 * shoulders, upper arms, below the chin and above the hands) is smoothed like skin (Taubin, so it keeps its size),
 * with its edges pinned, and the normals there are worked out again. Changes body.pos and body.nrm in place.
 */
export function smoothBasics(body, iterations = 25) {
  const f = wardrobeFit(body), region = bodyRegions(body);
  const ids = body.wid, n = Math.max(...ids) + 1;
  const pos = Array.from({ length: n }), free = new Uint8Array(n).fill(1), seen = new Uint8Array(n);
  for (let i = 0; i < body.count; i++) {
    const w = ids[i];
    pos[w] = body.pos[i];
    const hand = weightOn(body, i, /Hand/) > 0.2;
    if (region[i] !== 1 || hand || body.pos[i][1] > f.chinY - 0.015) free[w] = 0;
    seen[w] = 1;
  }
  const nbrs = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < body.idx.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = ids[body.idx[t + k]], b = ids[body.idx[t + (k + 1) % 3]];
    nbrs[a].add(b); nbrs[b].add(a);
  }
  // Pinned: anything next to a vertex that isn't smoothed.
  const move = Uint8Array.from({ length: n }, (_, w) => (free[w] && [...nbrs[w]].every((m) => free[m]) ? 1 : 0));
  let P = pos;
  for (let it = 0; it < iterations; it++) for (const k of [0.5, -0.53]) {
    P = P.map((p, w) => {
      if (!move[w] || !nbrs[w].size) return p;
      let c = [0, 0, 0];
      for (const m of nbrs[w]) c = add(c, P[m]);
      return add(p, mul(sub(mul(c, 1 / nbrs[w].size), p), k));
    });
  }
  // Normals again, by welded vertex (area-weighted), wherever the shape moved.
  const fn = Array.from({ length: n }, () => [0, 0, 0]);
  for (let t = 0; t < body.idx.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => ids[body.idx[t + k]]);
    const nn = cross(sub(P[b], P[a]), sub(P[c], P[a]));
    for (const w of [a, b, c]) fn[w] = add(fn[w], nn);
  }
  for (let i = 0; i < body.count; i++) {
    const w = ids[i];
    if (!free[w]) continue;
    body.pos[i] = P[w];
    body.nrm[i] = norm(fn[w]);
  }
}

/** The body's regions for the game's paint (1 top, 2 bottom, 2.75 shins, 3 shoes, 4 head): by bone, except the head,
 *  which is everything above the chin near the neck's axis (the masters weight the baked collar to the head). */
export function bodyRegions(body) {
  const f = wardrobeFit(body);
  return Float32Array.from({ length: body.count }, (_, i) => {
    const p = body.pos[i];
    if (p[1] > f.chinY - 0.005 && Math.hypot(p[0] - f.center[0], p[2] - f.center[2]) < 0.2) return 4;
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) if (body.weights[i][k] > bw) { bw = body.weights[i][k]; best = body.joints[i][k]; }
    const n = body.names[best] ?? "";
    return /Foot|Toe/.test(n) ? 3 : /(Left|Right)Leg$/.test(n) ? 2.75 : /UpLeg/.test(n) || n === "Hips" ? 2 : /^Head$|head_end|headfront/.test(n) ? 1 : 1;
  });
}

/** The body's cover bits for every template (and the hoodie's, from garments.mjs): skin well inside each garment. */
export function wardrobeCover(body, bits) {
  const f = wardrobeFit(body);
  for (const t of Object.values(WARDROBE)) {
    if (t.kind === "skirt") {
      // Under a skirt: the hips down to the top of the thighs.
      for (let i = 0; i < body.count; i++) if (body.pos[i][1] < f.waistY - 0.04 && body.pos[i][1] > f.hemY + 0.02 && limbOf(body, i) !== "LeftArm" && limbOf(body, i) !== "RightArm") bits[i] |= t.bit;
      continue;
    }
    const keep = wardrobeKeep(body, f, t);
    // Skin more than 1.5 cm inside a garment is hidden (the cloth stands at least 0.35 cm off it).
    for (let i = 0; i < body.count; i++) if (keep[i].s > 0.015) bits[i] |= t.bit;
  }
  return bits;
}

/** Builds one template for one body: { pos, joints, weights, pat, idx }. */
export function buildWardrobe(body, name) {
  const t = WARDROBE[name], f = wardrobeFit(body);
  if (t.kind === "skirt") return buildSkirt(body, f, t.long);
  const keep = wardrobeKeep(body, f, t);
  const { V, P: smoothed, tris, border, nbrs, along } = cutShell(body, keep, t.kind === "boots" ? (t.end ? 50 : 20) : 60);
  smoothSkin(V, nbrs, t.kind === "top" ? 6 : 4);
  const limbW = (v, re) => v.j.reduce((w, j, k) => w + (re.test(body.names[j] ?? "") ? v.w[k] : 0), 0);
  const shoulders = ["LeftArm", "RightArm"].map((n) => body.bone[n]);
  const nearShoulder = (p) => Math.max(...shoulders.map((j) => 1 - Math.min(1, Math.max(0, (len(sub(p, j)) - 0.06) / 0.07))));
  const P = smoothed.map((p, i) => {
    const v = V[i];
    let gap = t.gap;
    if (t.kind === "top") gap = t.gap - Math.min(t.gap * 0.3, 0.005) * Math.min(1, limbW(v, /Arm|Hand/)) - Math.min(t.gap * 0.4, 0.007) * nearShoulder(v.p);
    const d = dot(sub(p, v.p), v.n);
    // Where a top can hang over them (from the hem up), bottoms hug the body, so a top always lies outside.
    if (t.kind === "bottom" && v.p[1] > f.hemY - 0.06 && d > gap + 0.003) return add(p, mul(v.n, gap + 0.003 - d));
    return d < gap ? add(p, mul(v.n, gap - d)) : p;
  });
  smoothEdges(P, along);
  // Hems, cuffs and waistbands get bands; so does a neckline without a collar ring (scoop, V, the open front).
  const bands = V.map((v, i) => (border[i] && (v.edge !== "neck" || t.neck !== "crew") ? P[i] : null)).filter(Boolean);
  const out = {
    pos: P, joints: V.map((v) => v.j), weights: V.map((v) => v.w), idx: tris,
    pat: V.map((v, i) => {
      let d = 1;
      for (const b of bands) { const e = len(sub(P[i], b)); if (e < d) d = e; }
      const onFront = (P[i][2] - f.center[2]) * f.front > 0.02 && limbW(v, /Arm|Hand|Leg|Foot|Toe/) < 0.5;
      return [d, onFront ? P[i][0] - f.center[0] : 1, t.kind === "boots" ? P[i][1] : P[i][1] - f.hemY, 0];
    }),
  };
  addRim(out, V, P, tris);
  if (t.collar) addCollar(out, f, t, V, P);
  return out;
}

/** The cloth's thickness at its edges: a strip from every open edge back down to the skin, so nobody looks between
 *  a sleeve or a hem and the body into the garment. */
function addRim(out, V, P, tris) {
  const use = new Map();
  for (let f = 0; f < tris.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = tris[f + k], b = tris[f + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    use.set(key, use.has(key) ? null : [a, b]);
  }
  const inner = new Map();
  const at = (i) => {
    if (!inner.has(i)) {
      inner.set(i, out.pos.length);
      out.pos.push(add(V[i].p, mul(V[i].n, 0.0015))); out.joints.push(V[i].j); out.weights.push(V[i].w);
      out.pat.push([0, out.pat[i][1], out.pat[i][2], 0]);
    }
    return inner.get(i);
  };
  for (const e of use.values()) if (e) { const [a, b] = e; out.idx.push(b, a, at(a), b, at(a), at(b)); }
}

/** A collar ring on the neckline: ribbed (tee), a stand-up collar (zip jacket) or a tall padded one (puffer). */
function addCollar(out, f, t, V, P) {
  const [cx, , cz] = f.center, segs = 32, rows = 4;
  const h = t.collar === "rib" ? 0.012 : t.collar === "stand" ? 0.03 : 0.045;
  const thick = t.collar === "high" ? 0.02 : t.collar === "stand" ? 0.008 : 0.005;
  const nearest = (q) => { let b = 0, bd = Infinity; for (let i = 0; i < V.length; i++) { const e = len(sub(P[i], q)); if (e < bd) { bd = e; b = i; } } return b; };
  const start = out.pos.length;
  for (let r = 0; r <= rows; r++) for (let k = 0; k < segs; k++) {
    const a = (k / segs) * 2 * Math.PI;
    const radial = [Math.sin(a), 0, Math.cos(a) * f.front];
    // Outer face going up, then the inner face coming down.
    const up = r <= rows / 2 ? r / (rows / 2) : (rows - r) / (rows / 2);
    const rad = f.rCut + (r <= rows / 2 ? thick : 0.002) + (t.collar === "high" ? 0.006 * (1 - up) : 0);
    const q = [cx + radial[0] * rad, f.neckY - 0.004 + h * up, cz + radial[2] * rad];
    const s = nearest(q);
    out.pos.push(q); out.joints.push(V[s].j); out.weights.push(V[s].w); out.pat.push([1, 1, q[1] - f.hemY, 0.25]);
  }
  for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) {
    const a = start + r * segs + k, b = start + r * segs + (k + 1) % segs;
    out.idx.push(a, b, a + segs, b, b + segs, a + segs);
  }
}

/** A skirt: a flared cone from the waist over both legs, to mid-thigh, pleated by the shader. */
function buildSkirt(body, f, long = false) {
  const B = body.bone, names = body.names;
  const hipsJ = names.indexOf("Hips"), lJ = names.indexOf("LeftUpLeg"), rJ = names.indexOf("RightUpLeg"), sJ = names.indexOf("Spine02");
  const lK = names.indexOf("LeftLeg"), rK = names.indexOf("RightLeg"), kneeY = (B.LeftLeg[1] + B.RightLeg[1]) / 2;
  const cx = B.Hips[0], cz = B.Hips[2];
  // A skirt stops at mid-thigh; a gown just above the ankles, flaring wider so the legs stay inside as they move.
  const top = f.waistY, bottom = long ? lerp(B.LeftLeg, B.LeftFoot, 0.8)[1] : lerp(B.LeftUpLeg, B.LeftLeg, 0.42)[1];
  const segs = 40, rows = long ? 22 : 10;
  const angle = (p) => Math.atan2(p[0] - cx, (p[2] - cz) * f.front);
  // The body's outline round the hips and thighs, by height and angle.
  const near = body.pos.filter((p, i) => p[1] > bottom - 0.02 && p[1] < top + 0.02 && !/Arm/.test(limbOf(body, i)));
  const outline = (a, y) => {
    let r = 0.05;
    for (const p of near) if (Math.abs(p[1] - y) < 0.02) {
      const pa = angle(p), d = Math.atan2(Math.sin(pa - a), Math.cos(pa - a));
      if (Math.abs(d) < 0.2) r = Math.max(r, Math.hypot(p[0] - cx, p[2] - cz));
    }
    return r;
  };
  const out = { pos: [], joints: [], weights: [], pat: [], idx: [] };
  const radii = Array.from({ length: segs }, () => 0);
  const ring = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, y = top + (bottom - top) * t;
    ring.push([]);
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * 2 * Math.PI - Math.PI;
      // Never narrower lower down, plus a flare.
      radii[k] = Math.max(radii[k], outline(a, y) + 0.012) + (r ? (long ? 0.006 + 0.01 * t : 0.006) : 0);
      const q = [cx + Math.sin(a) * radii[k], y, cz + Math.cos(a) * f.front * radii[k]];
      // Lower down, the front follows the thighs (sitting lifts it) and each side its own leg.
      const front = Math.max(0, Math.cos(a)), left = (1 + Math.sin(a)) / 2;
      let top4;
      if (!long) {
        const leg = t * (0.25 + 0.3 * front);
        top4 = [[hipsJ, (1 - leg) * (t < 0.15 ? 0.7 : 1)], [lJ, leg * left], [rJ, leg * (1 - left)], [sJ, t < 0.15 ? (1 - leg) * 0.3 : 0]];
      } else {
        // A gown: down to the knees its front follows the thighs (a lap when sitting), below them the shins (it falls
        // to the floor from the knees, and swings with the steps); the back hangs from the hips.
        const legW = (0.25 + 0.6 * front) * Math.min(1, (top - y) / (top - kneeY));
        const [jl, jr] = y > kneeY ? [lJ, rJ] : [lK, rK];
        top4 = [[hipsJ, (1 - legW) * (t < 0.15 ? 0.7 : 1)], [jl, legW * left], [jr, legW * (1 - left)], [sJ, t < 0.15 ? (1 - legW) * 0.3 : 0]];
      }
      const sum = top4.reduce((s, x) => s + x[1], 0);
      out.joints.push(top4.map((x) => x[0])); out.weights.push(top4.map((x) => x[1] / sum));
      out.pos.push(q);
      out.pat.push([Math.min(1, Math.min(top - y, y - bottom) + 0.0001), a / Math.PI, y - f.hemY, 0]);
      ring[r].push(out.pos.length - 1);
    }
  }
  for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) {
    const a = ring[r][k], b = ring[r][(k + 1) % segs], c = ring[r + 1][k], d = ring[r + 1][(k + 1) % segs];
    out.idx.push(a, c, b, b, c, d);
  }
  return out;
}
