// Shop images (docs/shop-manager.md section 2; owner, Oct 21): a Higgsfield master PNG becomes the Shop's two WebPs.
// The flat cream background and its floor shadow are keyed out the same way on every item (a flood fill from the
// edges, so cream inside an item stays), the item is trimmed and centered on a square, then resized to 256 px (cards)
// and 768 px (detail) at about 80% WebP quality. Server only (sharp).

import sharp from "sharp";

export const SHOP_IMAGE_SIZES = { card: 256, detail: 768 } as const;

/** How far (RGB distance) a pixel may be from the background and still be background; the edge blends past it. */
const KEY = 30;
const EDGE = 26;

/** Removes the flat background (and the soft floor shadow on it) by flood fill from the image's edges. */
export function keyOutBackground(px: Uint8ClampedArray | Buffer, w: number, h: number): void {
  // The background: the median of the border pixels.
  const border: number[][] = [];
  const at = (x: number, y: number) => (y * w + x) * 4;
  for (let x = 0; x < w; x += 4) { border.push([...px.subarray(at(x, 0), at(x, 0) + 3)], [...px.subarray(at(x, h - 1), at(x, h - 1) + 3)]); }
  for (let y = 0; y < h; y += 4) { border.push([...px.subarray(at(0, y), at(0, y) + 3)], [...px.subarray(at(w - 1, y), at(w - 1, y) + 3)]); }
  const med = [0, 1, 2].map((c) => border.map((b) => b[c]).sort((a, b) => a - b)[border.length >> 1]);
  const bgLum = (med[0] + med[1] + med[2]) / 3;
  // A pixel is background if it's near the cream, or a shadow of it: the same hue, a little darker, little color.
  const dist = (i: number) => {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const d = Math.hypot(r - med[0], g - med[1], b - med[2]);
    const lum = (r + g + b) / 3;
    const k = lum / Math.max(1, bgLum);
    const shade = Math.hypot(r - med[0] * k, g - med[1] * k, b - med[2] * k);
    return k > 0.55 && k < 1.02 ? Math.min(d, shade * 1.6) : d;
  };
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => { const p = y * w + x; if (!seen[p] && dist(p * 4) < KEY) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p - x) / w;
    px[p * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Soften the edge: pixels next to the background fade by how close they are to it.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (seen[p]) continue;
      if (!(seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w])) continue;
      const d = dist(p * 4);
      const a = Math.max(0, Math.min(1, (d - KEY) / EDGE));
      px[p * 4 + 3] = Math.round(px[p * 4 + 3] * a);
    }
  }
}

/** A master PNG to the two Shop WebPs (and a trimmed transparent PNG master). */
export async function processShopImage(input: Buffer, transparent: boolean): Promise<{ card: Buffer; detail: Buffer; master: Buffer }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!transparent) keyOutBackground(data, info.width, info.height);
  const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
  // Trim to the item, then center it on a square with a little air around it.
  const trimmed = await sharp(await keyed.toBuffer()).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.08);
  const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed.data, gravity: "centre" }]).png().toBuffer();
  const webp = (size: number) => sharp(square).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90, effort: 4 }).toBuffer();
  return { card: await webp(SHOP_IMAGE_SIZES.card), detail: await webp(SHOP_IMAGE_SIZES.detail), master: square };
}

/** Downloads a source image (Higgsfield's CDN), refusing anything that isn't an image or is too big. */
export async function fetchSourceImage(url: string): Promise<Buffer> {
  if (!/^https:\/\//.test(url)) throw new Error("the source must be an https link");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  if (!/^image\//.test(res.headers.get("content-type") ?? "image/png")) throw new Error("not an image");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) throw new Error("image over 20 MB");
  return buf;
}
