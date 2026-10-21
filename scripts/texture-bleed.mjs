// Texture padding for the base bodies (scripts/build-base-avatars.mjs): the masters' baked textures are a patchwork of
// small UV islands on white, and the game's mipmaps blend that white into every island's edge, which shows as light
// seams across faces and bodies. Every pixel outside the islands (found by drawing the mesh's UV triangles) takes the
// color of the nearest island, a few dozen pixels out.
import sharp from "sharp";

/** Pads a primitive's base color texture in place. */
export async function bleedTexture(texture, prim, passes = 32) {
  const { data, info } = await sharp(Buffer.from(texture.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const covered = new Uint8Array(W * H);
  // 1. The islands: every UV triangle, drawn a little fat (half a pixel round its edges).
  const uv = prim.getAttribute("TEXCOORD_0"), idx = prim.getIndices().getArray();
  const a = [0, 0], b = [0, 0], c = [0, 0];
  for (let t = 0; t < idx.length; t += 3) {
    uv.getElement(idx[t], a); uv.getElement(idx[t + 1], b); uv.getElement(idx[t + 2], c);
    const P = [a, b, c].map(([u, v]) => [u * W - 0.5, v * H - 0.5]);
    const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])) + 1);
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const s = Math.sign(area);
    const edge = (p, q, x, y) => s * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) / Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (edge(P[0], P[1], x, y) >= -0.7 && edge(P[1], P[2], x, y) >= -0.7 && edge(P[2], P[0], x, y) >= -0.7) covered[y * W + x] = 1;
    }
  }
  // 2. Grow the islands outward, a ring of pixels per pass, each new pixel the average of its covered neighbours.
  let frontier = [];
  for (let i = 0; i < W * H; i++) if (!covered[i]) {
    const x = i % W, y = (i / W) | 0;
    if ((x > 0 && covered[i - 1]) || (x < W - 1 && covered[i + 1]) || (y > 0 && covered[i - W]) || (y < H - 1 && covered[i + W])) frontier.push(i);
  }
  for (let pass = 0; pass < passes && frontier.length; pass++) {
    const fill = frontier.map((i) => {
      const x = i % W, y = (i / W) | 0, sum = [0, 0, 0];
      let n = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && covered[j]) {
        for (let k = 0; k < 3; k++) sum[k] += data[j * C + k];
        n++;
      }
      return sum.map((v) => v / n);
    });
    frontier.forEach((i, f) => { for (let k = 0; k < 3; k++) data[i * C + k] = fill[f][k]; covered[i] = 1; });
    const next = new Set();
    for (const i of frontier) {
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !covered[j]) next.add(j);
    }
    frontier = [...next];
  }
  texture.setImage(new Uint8Array(await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer())).setMimeType("image/png");
}
