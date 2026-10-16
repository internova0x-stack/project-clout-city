import { test } from "node:test";
import assert from "node:assert/strict";
import { TV, centerCrop, clampCrop, coverScale, tvError, zoomCrop } from "../lib/cloutTv.ts";

const FW = 320, FH = 400; // the billboard's 4:5 frame as drawn on a phone

test("the billboard frame is 4:5 at 1080 × 1350", () => {
  assert.equal(TV.frame.w / TV.frame.h, 4 / 5);
  assert.deepEqual(TV.frame, { w: 1080, h: 1350 });
});

test("a photo starts centred and covering the frame", () => {
  const c = centerCrop(4000, 3000, FW, FH); // landscape: height decides
  assert.equal(c.scale, FH / 3000);
  assert.equal(c.y, 0);
  assert.ok(c.x < 0 && Math.abs(c.x * 2 + 4000 * c.scale - FW) < 1e-9, "centred across");
});

test("the photo can't leave a gap or zoom past the limit", () => {
  const min = coverScale(4000, 3000, FW, FH);
  assert.deepEqual(clampCrop({ x: 50, y: 30, scale: min / 2 }, 4000, 3000, FW, FH), { x: 0, y: 0, scale: min });
  const far = clampCrop({ x: -99999, y: -99999, scale: min * 10 }, 4000, 3000, FW, FH);
  assert.equal(far.scale, min * TV.maxZoom);
  assert.equal(far.x, FW - 4000 * far.scale);
  assert.equal(far.y, FH - 3000 * far.scale);
});

test("zooming keeps the point under the fingers still", () => {
  const c = { x: -100, y: -50, scale: 0.2 };
  const z = zoomCrop(c, 0.4, 160, 200);
  // The photo pixel under (160, 200) before and after.
  assert.equal((160 - c.x) / c.scale, (160 - z.x) / z.scale);
  assert.equal((200 - c.y) / c.scale, (200 - z.y) / z.scale);
});

test("server errors read as plain copy", () => {
  assert.match(tvError("list_full"), /20 photos/);
  assert.match(tvError("confirm_all"), /all three/);
});
