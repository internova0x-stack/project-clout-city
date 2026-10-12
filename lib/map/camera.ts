// Pure camera math for the 2D map: pan, pinch and wheel zoom, clamped to the map.

export interface Camera {
  /** Map-unit point at the center of the viewport. */
  x: number;
  y: number;
  /** Screen pixels per map unit. */
  zoom: number;
}

export interface Viewport { width: number; height: number }

export interface CameraLimits {
  minZoom: number;
  maxZoom: number;
  mapWidth: number;
  mapHeight: number;
}

export function clampCamera(cam: Camera, limits: CameraLimits): Camera {
  const zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, cam.zoom));
  return {
    zoom,
    x: Math.min(limits.mapWidth, Math.max(0, cam.x)),
    y: Math.min(limits.mapHeight, Math.max(0, cam.y)),
  };
}

export function mapToScreen(cam: Camera, vp: Viewport, p: { x: number; y: number }) {
  return {
    x: (p.x - cam.x) * cam.zoom + vp.width / 2,
    y: (p.y - cam.y) * cam.zoom + vp.height / 2,
  };
}

export function screenToMap(cam: Camera, vp: Viewport, s: { x: number; y: number }) {
  return {
    x: (s.x - vp.width / 2) / cam.zoom + cam.x,
    y: (s.y - vp.height / 2) / cam.zoom + cam.y,
  };
}

/** Moves the camera so the content follows a drag of (dx, dy) screen pixels. */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom };
}

/** Zooms by `factor` while keeping the map point under `anchor` (screen) fixed. */
export function zoomAt(
  cam: Camera,
  vp: Viewport,
  anchor: { x: number; y: number },
  factor: number,
  limits: CameraLimits,
): Camera {
  const zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, cam.zoom * factor));
  const before = screenToMap(cam, vp, anchor);
  const next = { ...cam, zoom };
  const after = screenToMap(next, vp, anchor);
  return clampCamera({ zoom, x: next.x + (before.x - after.x), y: next.y + (before.y - after.y) }, limits);
}

/** CSS transform that places map units on screen for this camera. */
export function cameraTransform(cam: Camera, vp: Viewport): string {
  const tx = vp.width / 2 - cam.x * cam.zoom;
  const ty = vp.height / 2 - cam.y * cam.zoom;
  return `translate3d(${tx}px, ${ty}px, 0) scale(${cam.zoom})`;
}
