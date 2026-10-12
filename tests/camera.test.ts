import { test } from "node:test";
import assert from "node:assert/strict";
import { clampCamera, mapToScreen, panBy, screenToMap, zoomAt } from "../lib/map/camera.ts";

const vp = { width: 400, height: 800 };
const limits = { minZoom: 0.5, maxZoom: 4, mapWidth: 1000, mapHeight: 1000 };

test("map and screen conversions are inverses", () => {
  const cam = { x: 300, y: 400, zoom: 2 };
  const s = mapToScreen(cam, vp, { x: 310, y: 390 });
  assert.deepEqual(screenToMap(cam, vp, s), { x: 310, y: 390 });
});

test("panning moves content with the finger", () => {
  const cam = panBy({ x: 500, y: 500, zoom: 2 }, 20, -10);
  assert.deepEqual(cam, { x: 490, y: 505, zoom: 2 });
});

test("zooming keeps the anchor point fixed", () => {
  const cam = { x: 500, y: 500, zoom: 1 };
  const anchor = { x: 100, y: 200 };
  const before = screenToMap(cam, vp, anchor);
  const next = zoomAt(cam, vp, anchor, 2, limits);
  const after = screenToMap(next, vp, anchor);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(next.zoom, 2);
});

test("camera is clamped to zoom limits and map bounds", () => {
  assert.deepEqual(clampCamera({ x: -5, y: 2000, zoom: 10 }, limits), { x: 0, y: 1000, zoom: 4 });
});
