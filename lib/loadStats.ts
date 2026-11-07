// How long the 3D scenes take on real phones, and when 3D fails (owner, Nov 7: "the map doesn't load, the avatars
// don't load… the room doesn't load"). Session replays can't show WebGL, so these events are the evidence: once per
// scene per page load, through PostHog (nothing is sent before the player accepts analytics).
import { track } from "./analytics";
import { lowGraphics } from "./graphics";

export type Scene = "map" | "room";
const sent = new Set<string>();
const base = () => ({
  ms: Math.round(performance.now()),
  graphics: lowGraphics() ? "low" : "high",
  page: location.pathname,
  net: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
});

/** The scene is drawn (the map's nearest blocks; the room with the player's avatar in it). */
export function sceneReady(scene: Scene): void {
  if (sent.has(scene)) return;
  sent.add(scene);
  track("scene_ready", { scene, ...base() });
}

/** 3D didn't start ("no_webgl") or the phone took it away ("context_lost", usually low memory). */
export function sceneFailed(scene: Scene, reason: "no_webgl" | "context_lost"): void {
  const key = `${scene}:${reason}`;
  if (sent.has(key)) return;
  sent.add(key);
  track("scene_failed", { scene, reason, ...base() });
}

export function watchContext(canvas: HTMLCanvasElement, scene: Scene): void {
  canvas.addEventListener("webglcontextlost", () => sceneFailed(scene, "context_lost"), { once: true });
}
