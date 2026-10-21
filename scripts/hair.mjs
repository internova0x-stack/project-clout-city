// Hair for the new base bodies (the owner's bald masters; owner, Oct 21: "The avatars and outfits look a little
// botched"): every hairstyle is grown from the head's own scalp, so it fits the head exactly instead of sitting on it
// like a helmet. Used by scripts/build-base-avatars.mjs, which writes public/avatars/hair/<m|f>[-low].glb: one skinned
// mesh per style ("short") and one for its lengths ("long-lengths"), on the body's skeleton. Under a hat the game shows
// only the lengths.
//
//   scalp    the head's surface above a hairline (forehead, temples, around the ears, the nape), clipped exactly,
//            standing off the skull by the style's thickness (more at the crown), with a rim back to the skin
//   lengths  a layered curtain (long), a ponytail, a bun, two braids or locs, kept off the body
//
// _PAT (for the game's shader): x the angle around the head (-1..1, 0 at the front), y the height (0 chin, 1 crown)
// or the distance along a strand, z the part (0 scalp, 0.25 curtain, 0.5 strand, 0.75 bun), w the style (index / 8).

import { add, cross, cutShell, dot, hoodieFit, len, mul, norm, sub } from "./garments.mjs";

export const HAIR_STYLES = ["short", "buzz", "long", "ponytail", "bun", "braids", "curls", "locs"];

/** The head's measurements: chin, crown, height, its vertical axis, the skull's half-width above the ears. */
export function headFit(body) {
  const fit = hoodieFit(body);
  const head = body.pos.filter((p) => p[1] > fit.chinY - 0.02);
  const top = Math.max(...head.map((p) => p[1]));
  const chin = fit.chinY, H = top - chin;
  const band = (lo, hi) => head.filter((p) => p[1] > chin + lo * H && p[1] < chin + hi * H && Math.abs(p[0] - fit.center[0]) < 0.2);
  const mid = band(0.45, 0.55), zs = mid.map((p) => p[2]);
  const cx = fit.center[0], cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const skull = Math.max(...band(0.68, 0.74).map((p) => Math.abs(p[0] - cx)));
  return { ...fit, top, chin, H, axis: [cx, cz], skull };
}

/** Angle around the head's axis: 0 in front, ±π at the back (+ to the body's left, +x). */
const angleOf = (f, p) => Math.atan2(p[0] - f.axis[0], (p[2] - f.axis[1]) * f.front);

/** The hairline's height at an angle around the head: high at the forehead, above the ears, low at the nape. */
function hairline(f, a, style) {
  const c = Math.cos(a);
  const forehead = style === "curls" ? 0.77 : 0.8, side = 0.6, nape = style === "buzz" ? 0.2 : 0.13;
  const h = c >= 0 ? side + (forehead - side) * c * c : side + (nape - side) * Math.pow(-c, 0.7);
  return f.chin + h * f.H;
}

/** The keep function for the scalp: above the hairline, never the ears or below the chin. */
function scalpKeep(body, f, style) {
  return Array.from({ length: body.count }, (_, i) => {
    const p = body.pos[i];
    let s = p[1] - hairline(f, angleOf(f, p), style);
    // The ears stick out past the skull: leave them (and a little room round them) bare.
    if (p[1] < f.chin + 0.66 * f.H) s = Math.min(s, f.skull * 1.06 - Math.abs(p[0] - f.axis[0]));
    s = Math.min(s, p[1] - (f.chin + 0.03));
    return { s, edge: "hairline" };
  });
}

/** Each style's thickness off the skull at a point (meters): a base, more at the crown, curls bumpy. */
function thickness(f, style, p) {
  const crown = Math.max(0, Math.min(1, (p[1] - (f.chin + 0.62 * f.H)) / (0.38 * f.H)));
  const front = Math.max(0, Math.cos(angleOf(f, p))) * crown;
  switch (style) {
    case "buzz": return 0.0025;
    case "short": return 0.008 + 0.024 * crown + 0.008 * front;
    case "curls": return 0.03 + 0.04 * crown + 0.012 * Math.sin(p[0] * 70) * Math.sin(p[1] * 64) * Math.sin(p[2] * 75);
    case "long": return 0.007 + 0.008 * crown;
    case "locs": return 0.009 + 0.01 * crown;
    default: return 0.004 + 0.004 * crown; // pulled back: ponytail, bun, braids
  }
}

/** Builds every hairstyle for one body: { [name]: { pos, joints, weights, pat, idx } }. */
export function buildHair(body) {
  const f = headFit(body);
  const headJ = body.names.indexOf("Head"), spineJ = body.names.indexOf("Spine"), neckJ = body.names.indexOf("neck");
  // The body's surface (welded), to keep lengths off it.
  const seen = new Set(), surf = [];
  for (let i = 0; i < body.count; i++) if (!seen.has(body.wid[i])) { seen.add(body.wid[i]); surf.push({ p: body.pos[i], n: body.nrm[i] }); }
  const offBody = (q, gap) => {
    for (let pass = 0; pass < 3; pass++) {
      let best = null, bd = Infinity;
      for (const s of surf) { const e = len(sub(q, s.p)); if (e < bd) { bd = e; best = s; } }
      const d = dot(sub(q, best.p), best.n);
      if (d >= gap) break;
      q = add(q, mul(best.n, gap - d));
    }
    return q;
  };
  // Lengths hang from the head and settle on the shoulders and back: weights by height.
  const lengthSkin = (y) => {
    const h = Math.max(0, Math.min(1, (y - (f.neckY - 0.01)) / 0.09));
    return { j: [headJ, spineJ, neckJ, 0], w: [h, (1 - h) * 0.8, (1 - h) * 0.2, 0] };
  };
  const around = (a) => [Math.sin(a), 0, Math.cos(a) * f.front];

  const styles = {};
  HAIR_STYLES.forEach((style, si) => {
    const code = si / 8;
    // 1. The scalp: cut, lightly smoothed (the skull is smooth already), thickened, with a rim back to the skin.
    const { V, P: sm, tris, border } = cutShell(body, scalpKeep(body, f, style), 4);
    const shell = sm.map((p, i) => add(p, mul(V[i].n, thickness(f, style, V[i].p))));
    const out = { pos: [...shell], joints: V.map(() => [headJ, 0, 0, 0]), weights: V.map(() => [1, 0, 0, 0]), idx: [...tris] };
    out.pat = V.map((v) => [angleOf(f, v.p) / Math.PI, (v.p[1] - f.chin) / f.H, 0, code]);
    const edgeUse = new Map();
    for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = tris[t + k], b = tris[t + (k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edgeUse.set(key, edgeUse.has(key) ? null : [a, b]);
    }
    const rimAt = new Map();
    const rim = (i) => {
      if (!rimAt.has(i)) {
        rimAt.set(i, out.pos.length);
        out.pos.push(add(V[i].p, mul(V[i].n, 0.0008))); out.joints.push([headJ, 0, 0, 0]); out.weights.push([1, 0, 0, 0]);
        out.pat.push([...out.pat[i].slice(0, 2), 0, code]);
      }
      return rimAt.get(i);
    };
    for (const e of edgeUse.values()) if (e && border[e[0]] && border[e[1]]) {
      const [a, b] = e;
      out.idx.push(b, a, rim(a), b, rim(a), rim(b));
    }
    styles[style] = out;

    // 2. The lengths.
    const L = { pos: [], joints: [], weights: [], pat: [], idx: [] };
    const shellR = (a, y) => {
      // The scalp's (or the head's) distance from the axis at an angle and height.
      let r = 0;
      const pts = shell.length ? shell : [];
      for (const p of pts) if (Math.abs(p[1] - y) < 0.012 && Math.abs(angleOf(f, p) - a) < 0.2) r = Math.max(r, Math.hypot(p[0] - f.axis[0], p[2] - f.axis[1]));
      return r;
    };
    // Lengths at the sides stop above the shoulders; down the back they reach the shoulder blades.
    const endAt = (a, longest) => {
      const back = Math.max(0, Math.min(1, (Math.abs(a) - 0.55 * Math.PI) / (0.25 * Math.PI)));
      return f.neckY + 0.02 - longest * back;
    };
    const at = (a, y, r) => { const d = around(a); return [f.axis[0] + d[0] * r, y, f.axis[1] + d[2] * r]; };
    const vtx = (q, pat) => {
      const sk = lengthSkin(q[1]);
      L.pos.push(q); L.joints.push(sk.j); L.weights.push(sk.w); L.pat.push([...pat, code]);
      return L.pos.length - 1;
    };
    // A tube along a path: radius per point, closed at the far end.
    const tube = (path, radius, sides = 7) => {
      const start = L.pos.length;
      let along = 0;
      path.forEach((pt, i) => {
        if (i) along += len(sub(pt, path[i - 1]));
        const fwd = norm(i < path.length - 1 ? sub(path[i + 1], pt) : sub(pt, path[i - 1]));
        const u = norm(cross(fwd, Math.abs(fwd[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), w = cross(fwd, u);
        for (let k = 0; k < sides; k++) {
          const t = (k / sides) * 2 * Math.PI, r = radius(i, path.length);
          vtx(add(pt, add(mul(u, Math.cos(t) * r), mul(w, Math.sin(t) * r))), [angleOf(f, pt) / Math.PI, along, 0.5]);
        }
      });
      for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < sides; k++) {
        const a = start + i * sides + k, b = start + i * sides + (k + 1) % sides;
        L.idx.push(a, b, a + sides, b, b + sides, a + sides);
      }
      const end = path[path.length - 1], tip = vtx(end, [angleOf(f, end) / Math.PI, along, 0.5]);
      for (let k = 0; k < sides; k++) L.idx.push(start + (path.length - 1) * sides + k, start + (path.length - 1) * sides + (k + 1) % sides, tip);
    };
    // A strand from a point on the scalp, hanging down to `endY`, off the body by `gap`.
    const strand = (a, y0, endY, gap, out0 = 0.01) => {
      let r = shellR(a, y0) + out0;
      const path = [at(a, y0, r)];
      const steps = Math.max(3, Math.round((y0 - endY) / 0.025));
      for (let k = 1; k <= steps; k++) {
        const y = y0 - ((y0 - endY) * k) / steps;
        r = Math.max(r, shellR(a, y) + gap);
        path.push(offBody(at(a, y, r), gap));
      }
      return path;
    };

    if (style === "long") {
      // A layered curtain round the back and sides: to the shoulder blades at the back, the collarbones at the sides.
      const cols = 26, rows = 12, thick = 0.011;
      const outer = [], inner = [];
      for (let c = 0; c <= cols; c++) {
        const a = 0.4 * Math.PI + (1.2 * Math.PI * c) / cols; // from the left temple, round the back, to the right
        const ang = Math.atan2(Math.sin(a), Math.cos(a));
        const y0 = f.chin + 0.62 * f.H, endY = endAt(ang, 0.15);
        const path = strand(ang, y0, endY, 0.013, 0.002);
        const pick = (k) => path[Math.min(path.length - 1, Math.round((k * (path.length - 1)) / rows))];
        outer.push([]); inner.push([]);
        for (let k = 0; k <= rows; k++) {
          const q = pick(k), radial = around(ang);
          outer[c].push(vtx(q, [ang / Math.PI, k / rows, 0.25]));
          inner[c].push(vtx(sub(q, mul(radial, thick)), [ang / Math.PI, k / rows, 0.25]));
        }
      }
      for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
        const o = [outer[c][k], outer[c + 1][k], outer[c][k + 1], outer[c + 1][k + 1]];
        const n = [inner[c][k], inner[c + 1][k], inner[c][k + 1], inner[c + 1][k + 1]];
        L.idx.push(o[0], o[2], o[1], o[1], o[2], o[3]);
        L.idx.push(n[0], n[1], n[2], n[1], n[3], n[2]);
      }
      // Close the bottom and the two sides.
      for (let c = 0; c < cols; c++) { const a = outer[c][rows], b = outer[c + 1][rows], d = inner[c][rows], e = inner[c + 1][rows]; L.idx.push(a, b, d, b, e, d); }
      for (const c of [0, cols]) for (let k = 0; k < rows; k++) { const a = outer[c][k], b = outer[c][k + 1], d = inner[c][k], e = inner[c][k + 1]; L.idx.push(a, d, b, b, d, e); }
    }
    if (style === "ponytail") {
      // From the back of the crown, out and down between the shoulder blades, tapering, with a tie.
      const a = Math.PI, y0 = f.chin + 0.68 * f.H;
      const path = strand(a, y0, f.neckY - 0.11, 0.022, 0.012);
      tube(path, (i, n) => (i === 0 ? 0.03 : i === 1 ? 0.024 : 0.026 * (1 - (0.55 * i) / n)), 9);
    }
    if (style === "bun") {
      // A round bun high on the back of the head.
      const a = Math.PI, y = f.chin + 0.9 * f.H, r = shellR(a, y) + 0.035;
      const c = at(a, y + 0.015, r), rx = 0.058, ry = 0.048, start = L.pos.length, seg = 14, ring = 9;
      for (let i = 0; i <= ring; i++) for (let k = 0; k < seg; k++) {
        const th = (i / ring) * Math.PI, ph = (k / seg) * 2 * Math.PI;
        const q = [c[0] + Math.sin(th) * Math.cos(ph) * rx, c[1] + Math.cos(th) * ry, c[2] + Math.sin(th) * Math.sin(ph) * rx];
        L.pos.push(q); L.joints.push([headJ, 0, 0, 0]); L.weights.push([1, 0, 0, 0]); L.pat.push([ph / Math.PI - 1, i / ring, 0.75, code]);
      }
      for (let i = 0; i < ring; i++) for (let k = 0; k < seg; k++) {
        const a0 = start + i * seg + k, b0 = start + i * seg + (k + 1) % seg;
        L.idx.push(a0, a0 + seg, b0, b0, a0 + seg, b0 + seg);
      }
    }
    if (style === "braids") {
      // Two long braids from behind the ears, over the shoulders.
      for (const side of [-1, 1]) {
        const path = strand(side * 0.8 * Math.PI, f.chin + 0.45 * f.H, f.neckY - 0.16, 0.02, 0.006);
        tube(path, (i, n) => (i === n - 1 ? 0.012 : 0.017 * (0.82 + 0.18 * Math.abs(Math.sin(i * 1.7)))), 8);
      }
    }
    if (style === "locs") {
      // Locs all round the back and sides, to the shoulders.
      for (let k = 0; k < 20; k++) {
        const a = -0.7 * Math.PI + (k / 19) * 1.4 * Math.PI;
        const ang = Math.atan2(Math.sin(a + Math.PI), Math.cos(a + Math.PI));
        const y0 = Math.max(hairline(f, ang, style) + 0.02, f.chin + 0.5 * f.H);
        tube(strand(ang, y0, endAt(ang, 0.11) - 0.015 * (k % 3), 0.012, 0.006), () => 0.0085, 6);
      }
    }
    if (L.pos.length) styles[`${style}-lengths`] = L;
  });
  return styles;
}
