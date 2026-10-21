// Garment templates for the new base bodies (stage 3 of the avatar upgrade, docs/shop-manager.md): each template is cut
// from the body's own surface in its bind pose, so it shares the body's skeleton and skin weights and bends with every
// pose, animation and body type. Used by scripts/build-base-avatars.mjs, which also writes each body vertex's cover
// bits (_COVER) so the game can skip the skin a garment hides.
//
// A template is a "keep" function over the bind pose (positive inside the garment, negative outside, zero on its
// edges: hem, cuffs, neckline), a fit (how far the cloth stands off the skin) and its extra parts (the hoodie's hood
// and drawstrings). The cut is clipped exactly on the zero line, smoothed into fabric (Taubin smoothing, which keeps
// the size), pushed off the skin, and given a pattern attribute (_PAT) for the details the game's shader draws:
//   x  distance to the hem or a cuff (meters, capped at 1): the ribbed bands
//   y  across the front (meters from the middle; 1 on the back): the kangaroo pocket
//   z  height above the hem (meters)
//   w  part: 0 body of the garment, 0.5 hood, 1 drawstring

/** Cover groups (bits in each body vertex's _COVER): skin hidden under a garment. Stage 4 adds more. */
export const COVER = { hoodie: 1 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Reads a body primitive into plain arrays, welded by position (the masters split vertices along UV seams). */
export function readBody(prim, skin) {
  const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), J = prim.getAttribute("JOINTS_0"), W = prim.getAttribute("WEIGHTS_0");
  const count = P.getCount();
  const pos = [], nrm = [], joints = [], weights = [];
  for (let i = 0; i < count; i++) {
    pos.push(P.getElement(i, [])); nrm.push(N.getElement(i, [])); joints.push(J.getElement(i, [])); weights.push(W.getElement(i, []));
  }
  const idx = Array.from(prim.getIndices().getArray());
  // Weld: one id per position.
  const key = (p) => p.map((x) => Math.round(x * 1e5)).join(",");
  const ids = new Map(), wid = new Int32Array(count);
  for (let i = 0; i < count; i++) { const k = key(pos[i]); if (!ids.has(k)) ids.set(k, ids.size); wid[i] = ids.get(k); }
  // Smooth normals per welded id.
  const sn = Array.from({ length: ids.size }, () => [0, 0, 0]);
  for (let i = 0; i < count; i++) sn[wid[i]] = add(sn[wid[i]], nrm[i]);
  const smooth = sn.map(norm);
  const names = skin.listJoints().map((j) => j.getName());
  const bone = Object.fromEntries(skin.listJoints().map((j) => [j.getName(), j.getWorldTranslation()]));
  return { count, pos, nrm: Array.from({ length: count }, (_, i) => smooth[wid[i]]), joints, weights, idx, wid, names, bone };
}

/** How much of a vertex's weight sits on bones matching a pattern. */
function weightOn(body, i, re) {
  let w = 0;
  for (let k = 0; k < 4; k++) if (re.test(body.names[body.joints[i][k]] ?? "")) w += body.weights[i][k];
  return w;
}

/** The hoodie's measurements on one body: hem, neckline, wrists, the front. */
export function hoodieFit(body) {
  const B = body.bone;
  const front = Math.sign(B.LeftToeBase[2] - B.LeftFoot[2]) || 1;
  const hemY = B.LeftUpLeg[1] - 0.005;
  // The neck, by shape (the masters weight its skin differently): slices from the neck bone up to the head bone. Its
  // half-width is the narrowest slice's; its base is where the shoulders have narrowed to 1.6 times that; the chin is
  // the first slice reaching well in front of it.
  const slice = (y) => body.pos.filter((p) => Math.abs(p[1] - y) < 0.004 && Math.abs(p[0] - B.neck[0]) < 0.3 && Math.abs(p[2] - B.neck[2]) < 0.25);
  const ys = [];
  for (let y = B.neck[1]; y <= B.Head[1]; y += 0.005) ys.push(y);
  const half = ys.map((y) => { const sl = slice(y); return sl.length ? Math.max(...sl.map((p) => Math.abs(p[0] - B.neck[0]))) : Infinity; });
  const neckHW = Math.min(...half);
  const neckY = ys[half.findIndex((h) => h < neckHW * 1.6)];
  const at = slice(neckY + 0.012).filter((p) => Math.abs(p[0] - B.neck[0]) < neckHW * 1.3);
  if (neckY === undefined || at.length < 6) throw new Error("hoodie: no neck found");
  const cx = at.reduce((s, p) => s + p[0], 0) / at.length;
  const zs = at.map((p) => p[2]), cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rNeck = Math.max(neckHW, (Math.max(...zs) - Math.min(...zs)) / 2);
  let chinY = neckY + 0.07;
  for (let y = neckY; y < neckY + 0.1; y += 0.005) if (slice(y).some((p) => (p[2] - cz) * front > rNeck + 0.02)) { chinY = y; break; }
  const wrist = (side) => {
    const h = B[`${side}Hand`], f = B[`${side}ForeArm`], dir = norm(sub(h, f));
    return { at: sub(h, mul(dir, 0.012)), dir };
  };
  return { front, hemY, neckY, center: [cx, neckY, cz], rNeck, rCut: rNeck + 0.012, ceiling: Math.max(neckY + 0.008, chinY - 0.01), wrists: { Left: wrist("Left"), Right: wrist("Right") } };
}

/** The hoodie's keep function: positive inside it. Also says which edge is nearest (hem, cuff or neck). */
function hoodieKeep(body, fit, i) {
  const p = body.pos[i];
  for (const side of ["Left", "Right"]) {
    if (weightOn(body, i, new RegExp(`^${side}(Arm|ForeArm|Hand)$`)) >= 0.5) {
      const w = fit.wrists[side];
      return { s: dot(sub(w.at, p), w.dir), edge: "cuff" };
    }
  }
  const hem = p[1] - fit.hemY;
  const r = Math.hypot(p[0] - fit.center[0], p[2] - fit.center[2]);
  // The neckline: a collar cylinder around the neck, up to just under the chin.
  const neck = Math.min(Math.max(fit.neckY - p[1], r - fit.rCut), fit.ceiling - p[1]);
  return hem < neck ? { s: hem, edge: "hem" } : { s: neck, edge: "neck" };
}

/** The body's cover bits: the vertices well inside each garment (4 cm from its edges). */
export function coverBits(body) {
  const fit = hoodieFit(body);
  const bits = new Uint16Array(body.count);
  for (let i = 0; i < body.count; i++) if (hoodieKeep(body, fit, i).s > 0.04) bits[i] |= COVER.hoodie;
  return bits;
}

/** Merges two vertices' skin influences (weighted), keeping the four biggest. */
function mixSkin(ja, wa, jb, wb, t) {
  const m = new Map();
  for (let k = 0; k < 4; k++) { m.set(ja[k], (m.get(ja[k]) ?? 0) + wa[k] * (1 - t)); m.set(jb[k], (m.get(jb[k]) ?? 0) + wb[k] * t); }
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  while (top.length < 4) top.push([0, 0]);
  const sum = top.reduce((s, x) => s + x[1], 0) || 1;
  return { j: top.map((x) => x[0]), w: top.map((x) => x[1] / sum) };
}

/** Builds the hoodie for one body: plain arrays the build script writes as a skinned primitive. */
export function buildHoodie(body) {
  const fit = hoodieFit(body);
  const keep = Array.from({ length: body.count }, (_, i) => hoodieKeep(body, fit, i));

  // 1. Cut: welded vertices inside, plus new ones exactly on the edges (shared by neighbours, so no cracks).
  const V = [], at = new Map();
  const vert = (k, make) => { if (!at.has(k)) { at.set(k, V.length); V.push(make()); } return at.get(k); };
  const orig = (i) => vert(`v${body.wid[i]}`, () => ({ p: body.pos[i], n: body.nrm[i], j: body.joints[i], w: body.weights[i], edge: null }));
  const onEdge = (a, b) => {
    const [i, j] = body.wid[a] < body.wid[b] ? [a, b] : [b, a];
    return vert(`e${body.wid[i]}-${body.wid[j]}`, () => {
      const si = keep[i].s, sj = keep[j].s, t = si / (si - sj);
      const sk = mixSkin(body.joints[i], body.weights[i], body.joints[j], body.weights[j], t);
      return { p: lerp(body.pos[i], body.pos[j], t), n: norm(lerp(body.nrm[i], body.nrm[j], t)), j: sk.j, w: sk.w, edge: (si >= 0 ? keep[i] : keep[j]).edge };
    });
  };
  const tris = [];
  for (let f = 0; f < body.idx.length; f += 3) {
    const c = [body.idx[f], body.idx[f + 1], body.idx[f + 2]];
    const inside = c.map((i) => keep[i].s >= 0);
    if (!inside.some(Boolean)) continue;
    const poly = [];
    for (let k = 0; k < 3; k++) {
      const a = c[k], b = c[(k + 1) % 3];
      if (inside[k]) poly.push(orig(a));
      if (inside[k] !== inside[(k + 1) % 3]) poly.push(onEdge(a, b));
    }
    for (let k = 1; k + 1 < poly.length; k++) if (poly[0] !== poly[k] && poly[k] !== poly[k + 1] && poly[0] !== poly[k + 1]) tris.push(poly[0], poly[k], poly[k + 1]);
  }

  // 2. Edges of the cut (each edge used by one triangle): pinned while smoothing.
  const edgeUse = new Map();
  for (let f = 0; f < tris.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = tris[f + k], b = tris[f + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
  }
  const border = new Uint8Array(V.length);
  for (const [key, n] of edgeUse) if (n === 1) for (const v of key.split(",")) border[+v] = 1;
  const nbrs = Array.from({ length: V.length }, () => new Set());
  for (let f = 0; f < tris.length; f += 3) for (let k = 0; k < 3; k++) { nbrs[tris[f + k]].add(tris[f + (k + 1) % 3]); nbrs[tris[f + k]].add(tris[f + (k + 2) % 3]); }

  // 3. Fabric: Taubin smoothing (shrink, then grow back) drapes over the navel, ribs and muscles, then the cloth
  //    stands off the skin: looser on the body than on the sleeves.
  let P = V.map((v) => v.p);
  for (let it = 0; it < 24; it++) {
    for (const k of [0.5, -0.53]) {
      P = P.map((p, i) => {
        if (border[i] || !nbrs[i].size) return p;
        let c = [0, 0, 0];
        for (const n of nbrs[i]) c = add(c, P[n]);
        c = mul(c, 1 / nbrs[i].size);
        return add(p, mul(sub(c, p), k));
      });
    }
  }
  const isArm = (v) => v.j.some((j, k) => v.w[k] > 0.5 && /Arm|Hand/.test(body.names[j] ?? ""));
  P = P.map((p, i) => {
    const v = V[i], gap = isArm(v) ? 0.012 : 0.017;
    const d = dot(sub(p, v.p), v.n);
    return d < gap ? add(p, mul(v.n, gap - d)) : p;
  });

  // 4. Pattern: distance to the hem or a cuff, the front's coordinates, the part.
  const rib = V.map((v, i) => (border[i] && v.edge !== "neck" ? P[i] : null)).filter(Boolean);
  const pat = V.map((v, i) => {
    let d = 1;
    for (const b of rib) { const e = len(sub(P[i], b)); if (e < d) d = e; }
    const onFront = (v.p[2] - fit.center[2]) * fit.front > 0.02 && !isArm(v);
    return [d, onFront ? v.p[0] - fit.center[0] : 1, v.p[1] - fit.hemY, 0];
  });
  const out = { pos: P, joints: V.map((v) => v.j), weights: V.map((v) => v.w), pat, idx: tris };

  // 5. The hood, down: a thick roll around the neckline, bunched and drooping at the back, open at the front.
  //    6. Two drawstrings from its front ends down the chest.
  const shellNear = (q) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < V.length; i++) { const e = len(sub(P[i], q)); if (e < bd) { bd = e; best = i; } }
    return best;
  };
  const push = (q) => {
    const s = shellNear(q), n = V[s].n, d = dot(sub(q, P[s]), n);
    return d < 0.006 ? add(q, mul(n, 0.006 - d)) : q;
  };
  const fz = fit.front, [cx, , cz] = fit.center;
  const segs = 28, sides = 12, open = 0.5;
  const hoodStart = out.pos.length, firstExtraTri = out.idx.length;
  const hint = [];
  const skinNear = (q) => { const s = shellNear(q); return { j: V[s].j, w: V[s].w }; };
  const ringAt = (a) => {
    const back = (1 - Math.cos(a)) / 2;
    const radial = [Math.sin(a), 0, Math.cos(a) * fz];
    const ra = 0.022 + 0.018 * back, rv = 0.024 + 0.05 * back * back;
    const c = [cx + radial[0] * (fit.rCut + ra * 0.85), fit.neckY + 0.012 - 0.045 * back * back, cz + radial[2] * (fit.rCut + ra * 0.85)];
    return { c, radial, ra, rv };
  };
  for (let s = 0; s <= segs; s++) {
    const a = open + (2 * Math.PI - 2 * open) * (s / segs);
    const { c, radial, ra, rv } = ringAt(a);
    for (let k = 0; k < sides; k++) {
      const phi = (k / sides) * 2 * Math.PI;
      const q = push(add(c, add(mul(radial, Math.cos(phi) * ra), [0, Math.sin(phi) * rv, 0])));
      const sk = skinNear(q);
      hint[out.pos.length] = sub(q, c);
      out.pos.push(q); out.joints.push(sk.j); out.weights.push(sk.w); out.pat.push([1, 1, q[1] - fit.hemY, 0.5]);
    }
  }
  for (let s = 0; s < segs; s++) for (let k = 0; k < sides; k++) {
    const a = hoodStart + s * sides + k, b = hoodStart + s * sides + (k + 1) % sides, c = a + sides, d = b + sides;
    out.idx.push(a, c, b, b, c, d);
  }
  // Caps on the two open ends.
  for (const s of [0, segs]) {
    const ring = Array.from({ length: sides }, (_, k) => hoodStart + s * sides + k);
    const mid = ring.reduce((m, i) => add(m, out.pos[i]), [0, 0, 0]).map((x) => x / sides);
    const ci = out.pos.length, sk = skinNear(mid);
    hint[ci] = mul(norm(sub(out.pos[ring[0] + (s === 0 ? sides : -sides)], out.pos[ring[0]])), -1);
    out.pos.push(mid); out.joints.push(sk.j); out.weights.push(sk.w); out.pat.push([1, 1, mid[1] - fit.hemY, 0.5]);
    for (let k = 0; k < sides; k++) s === 0 ? out.idx.push(ci, ring[k], ring[(k + 1) % sides]) : out.idx.push(ci, ring[(k + 1) % sides], ring[k]);
  }
  for (const end of [0, segs]) {
    const a = open + (2 * Math.PI - 2 * open) * (end / segs);
    const { c, radial } = ringAt(a);
    let q = add(c, mul(radial, -0.004));
    const path = [];
    for (let step = 0; step < 8; step++) {
      path.push(push(q));
      q = add(path[path.length - 1], [0, -0.019, 0]);
    }
    const tubeStart = out.pos.length, n = 6;
    path.forEach((pt, si) => {
      const fwd = norm(si < path.length - 1 ? sub(path[si + 1], pt) : sub(pt, path[si - 1]));
      const u = norm(cross(fwd, [0, 0, 1])), w = cross(fwd, u);
      const r = si === path.length - 1 ? 0.0065 : 0.0042;
      const sk = skinNear(pt);
      for (let k = 0; k < n; k++) {
        const phi = (k / n) * 2 * Math.PI;
        hint[out.pos.length] = add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi)));
        out.pos.push(add(pt, add(mul(u, Math.cos(phi) * r), mul(w, Math.sin(phi) * r))));
        out.joints.push(sk.j); out.weights.push(sk.w); out.pat.push([1, 1, pt[1] - fit.hemY, 1]);
      }
    });
    for (let s = 0; s < path.length - 1; s++) for (let k = 0; k < n; k++) {
      const a = tubeStart + s * n + k, b = tubeStart + s * n + (k + 1) % n;
      out.idx.push(a, a + n, b, b, a + n, b + n);
    }
  }
  // The extra parts face outward (the garment is drawn two-sided, its inside darker).
  for (let f = firstExtraTri; f < out.idx.length; f += 3) {
    const [a, b, c] = [out.idx[f], out.idx[f + 1], out.idx[f + 2]];
    const fn = cross(sub(out.pos[b], out.pos[a]), sub(out.pos[c], out.pos[a]));
    const h = add(add(hint[a] ?? [0, 0, 0], hint[b] ?? [0, 0, 0]), hint[c] ?? [0, 0, 0]);
    if (dot(fn, h) < 0) { out.idx[f + 1] = c; out.idx[f + 2] = b; }
  }
  return out;
}
