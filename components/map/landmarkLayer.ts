// The landmark models (lib/map/landmarks.ts) as a three.js layer inside MapLibre. It shares the
// map's WebGL context and depth buffer, so models sit among the OpenStreetMap blocks and the pins
// stay on top. One scene for every landmark, placed in meters around a shared origin.

import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import {
  Box3, Camera, DirectionalLight, Frustum, Group, HemisphereLight, Matrix4, type Material, type Mesh, type MeshStandardMaterial, type Object3D, Scene, Sphere, Vector3, WebGLRenderer,
} from "three";
import { BRIDGE_BUILT_M, LANDMARKS, type Landmark } from "@/lib/map/landmarks";
import { exaggeration, metersPerPx } from "@/lib/map/scale";
import { animate, applyTheme, buildLandmark, newThemed, paintBigScreen, type Themed } from "./landmarkModels";
import { mergeStatic } from "./mergeModel";
import { buildVehicle, setVehiclesNight } from "./vehicleModels";
import type { Traffic } from "./vehicles";
import { buildJet, buildMansion, buildPlazaPedestal, buildYacht, PEDESTAL_TOP } from "./coutureModels";
import { goldStatue } from "../avatar/goldStatue";
import type { AvatarParts } from "../avatar/buildAvatar";
import { jetLoop, mooring, plotLocal, PLAZA_STATUE_AT, type CoutureMap, type MansionOwner } from "@/lib/coutureMap";
import { normalizeLook } from "@/lib/look";
import { getStyle, starterOutfit } from "@/lib/styles";
import { outfitFromSkus } from "@/lib/wearing";

export const LANDMARK_LAYER_ID = "landmarks";
/** Below this zoom the whole city is in view and the models would be specks. */
export const LANDMARK_MIN_ZOOM = 11.5;
/** Searchlights sweep only from this zoom; below it they hold still (no redraws). */
const ANIMATE_MIN_ZOOM = 13.5;
/** Moving things redraw the map at most this often (owner, Oct 16: the phone heated up). */
const ANIMATION_FPS = 30;
/**
 * Launch (owner, Oct 16: "loading should be under two seconds"): landmarks this close to where the map
 * opens are built at once; the rest are built a few at a time while the phone is idle.
 */
export const LANDMARK_NEAR_M = 700;
/** Background building stops for the frame after this many milliseconds. */
const BUILD_BUDGET_MS = 8;

export interface LandmarkLayer {
  layer: CustomLayerInterface;
  /** Each model's height in meters (as drawn), by place id: pins stand on top of it. */
  heights: ReadonlyMap<string, number>;
  /** Moves models to where placement stood them (lib/map/landmarks.ts placeLandmark). */
  setPositions(list: readonly Landmark[]): void;
  setNight(night: boolean): void;
  /** v0.14 Clout TV: the Clout Tower's screen shows this photo and @handle (null: the station's ident). */
  setBigScreen(img: (CanvasImageSource & { width: number; height: number }) | null, handle?: string): void;
  /** Clout Couture on the map (migration 0104): moored yachts, jets in the air and this week's plaza statue. */
  setCouture(state: CoutureMap): void;
  /** How many landmarks are built so far, of how many (the rest are on their way). */
  built(): { done: number; total: number };
  dispose(): void;
}

/** The top of a model's solid parts, in meters: searchlight beams and light pools don't count. */
function buildingTop(model: Group, skip: Set<Object3D>): number {
  const box = new Box3();
  const visit = (o: Object3D) => {
    if (skip.has(o)) return;
    if ((o as Mesh).isMesh) box.expandByObject(o, false);
    else o.children.forEach(visit);
  };
  model.children.forEach(visit);
  return box.isEmpty() ? 0 : box.max.y;
}

/** Web Mercator in MapLibre's units (the world is 0 to 1), so this file needn't load maplibre-gl. */
function mercator(lat: number, lng: number) {
  const r = Math.PI / 180;
  return {
    x: (lng + 180) / 360,
    y: (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * r) / 2))) / 360,
    perMeter: 1 / (40075016.686 * Math.cos(lat * r)),
  };
}

/** Meters between two points (near enough for a city). */
function meters(a: readonly [number, number], b: readonly [number, number]) {
  const k = 111_320;
  return Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * k * Math.cos((a[0] * Math.PI) / 180));
}

/** Runs a little work when the phone is idle (a short timeout where requestIdleCallback is missing). */
function whenIdle(fn: () => void): () => void {
  const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 500 });
    return () => w.cancelIdleCallback!(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
}

/**
 * near: where the map opens. Landmarks within LANDMARK_NEAR_M of it are built now, the rest in the
 * background, nearest first. Without it every landmark is built now.
 */
export function createLandmarkLayer(list: readonly Landmark[] = LANDMARKS, traffic?: Traffic, near?: readonly [number, number]): LandmarkLayer {
  const lat = list.reduce((a, l) => a + l.at[0], 0) / list.length;
  const lng = list.reduce((a, l) => a + l.at[1], 0) / list.length;
  const origin = mercator(lat, lng);
  const s = origin.perMeter;
  // Meters (x east, y up, z south) to MapLibre's mercator units.
  const toMercator = new Matrix4()
    .makeTranslation(origin.x, origin.y, 0)
    .scale(new Vector3(s, -s, s))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2));

  const scene = new Scene();
  const themed: Themed = newThemed();
  const root = new Group();
  const heights = new Map<string, number>();
  const nightOnly = new Set(themed.nightOnly);
  const models = new Map<string, Group>();
  // Clout Couture's mansions by owner, and the ones couture_map() says stand now (attachMansions, below).
  const mansions = new Map<string, { key: string; group: Group; windows: MeshStandardMaterial; dispose(): void }>();
  let wantMansions: MansionOwner[] = [];
  // Where placement last stood each landmark (setPositions), for the ones built after it was called.
  const placedAt = new Map<string, Landmark>();
  // Each landmark's bounds, so ones off screen are skipped (and their searchlights stay still).
  const bounds = new Map<Group, Sphere>();
  const measureOne = (model: Group) => bounds.set(model, new Box3().setFromObject(model).getBoundingSphere(new Sphere()));
  const measure = () => {
    root.updateMatrixWorld(true);
    for (const model of models.values()) measureOne(model);
  };
  const stand = (model: Group, l: Landmark) => {
    const m = mercator(l.at[0], l.at[1]);
    model.position.set((m.x - origin.x) / s, 0, (m.y - origin.y) / s);
    model.rotation.y = ((180 - l.facing) * Math.PI) / 180;
    // A bridge stretches along its length to reach both shores.
    if (l.kind === "bridge") model.scale.x = l.scale * (l.length ?? BRIDGE_BUILT_M) / BRIDGE_BUILT_M;
  };
  const build = (l: Landmark) => {
    const model = buildLandmark(l.kind, themed);
    model.scale.setScalar(l.scale);
    stand(model, l);
    models.set(l.id, model);
    model.name = l.id;
    model.updateMatrixWorld(true);
    for (const o of themed.nightOnly) nightOnly.add(o);
    heights.set(l.placeId ?? l.id, buildingTop(model, nightOnly));
    // Bake the still parts into a few meshes: hundreds of draw calls become a handful.
    mergeStatic(model, new Set([...nightOnly, ...themed.sweep.map((w) => w.o)]), new Set<Material>(themed.glows.map((g) => g.mat)));
    const moved = placedAt.get(l.id);
    if (moved) stand(model, moved);
    root.add(model);
    model.updateMatrixWorld(true);
    measureOne(model);
    if (l.kind === "clout-tower") paintBigScreen(screen.img, screen.handle);
    if (l.kind === "billionaires-row") attachMansions();
  };
  let screen: { img: Parameters<LandmarkLayer["setBigScreen"]>[0]; handle?: string } = { img: null };
  const queue = near ? [...list].sort((a, b) => meters(a.at, near) - meters(b.at, near)) : [...list];
  while (queue.length && (!near || meters(queue[0].at, near) <= LANDMARK_NEAR_M)) build(queue.shift()!);
  // The rest, nearest first, a few at a time while the phone is idle.
  let cancelBuild: (() => void) | null = null;
  const buildMore = () => {
    cancelBuild = null;
    const until = performance.now() + BUILD_BUDGET_MS;
    do build(queue.shift()!); while (queue.length && performance.now() < until);
    applyTheme(themed, night);
    map?.triggerRepaint();
    if (queue.length) cancelBuild = whenIdle(buildMore);
  };
  const frustum = new Frustum();
  scene.add(root);
  // 3D traffic (components/map/vehicles.ts drives it), one model per vehicle while it's on the map.
  const cars = new Group();
  const carById = new Map<number, Group>();
  scene.add(cars);
  const hemi = new HemisphereLight("#FFF6E8", "#B9C6CF", 1.6);
  const sun = new DirectionalLight("#FFFFFF", 1.8);
  sun.position.set(-0.6, 1, 0.8);
  scene.add(hemi, sun);

  const camera = new Camera();
  let renderer: WebGLRenderer | null = null;
  let rendererGl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let map: MapLibreMap | null = null;
  let night = false;
  const started = performance.now();
  const mvp = new Matrix4();
  const stats = { frames: 0 };
  let repaintSoon: ReturnType<typeof setTimeout> | null = null;

  if (queue.length) cancelBuild = whenIdle(buildMore);

  const setNight = (n: boolean) => {
    night = n;
    for (const m of mansions.values()) m.windows.emissiveIntensity = n ? 1.3 : 0.15;
    applyTheme(themed, n);
    setVehiclesNight(n);
    hemi.intensity = n ? 0.8 : 1.6;
    hemi.color.set(n ? "#8EA2D8" : "#FFF6E8");
    sun.intensity = n ? 0.35 : 1.8;
    sun.color.set(n ? "#AFC3FF" : "#FFFFFF");
    map?.triggerRepaint();
  };
  setNight(false);

  // ---- Clout Couture (lib/coutureMap.ts): yachts by their owner, jets by their owner, one statue ----
  const couture = new Group();
  scene.add(couture);
  const local = (ll: readonly [number, number]) => { const m = mercator(ll[0], ll[1]); return [(m.x - origin.x) / s, (m.y - origin.y) / s] as const; };
  const yachts = new Map<string, { key: string; group: Group; dispose(): void }>();
  const jets = new Map<string, { key: string; i: number; group: Group; banner: Group; dispose(): void }>();
  let statue: { key: string; group: Group; parts: AvatarParts; dispose(): void } | null = null;
  const setCouture = (state: CoutureMap) => {
    const sync = <T extends { key: string; group: Group; dispose(): void }>(have: Map<string, T>, want: { player: string; name: string }[], make: (o: { player: string; name: string }, i: number) => T) => {
      for (const [id, y] of have) {
        if (want.some((w) => w.player === id && `${w.name}` === y.key)) continue;
        couture.remove(y.group); y.dispose(); have.delete(id);
      }
      want.forEach((w, i) => { if (!have.has(w.player)) { const made = make(w, i); have.set(w.player, made); couture.add(made.group); } });
    };
    wantMansions = state.mansions ?? [];
    attachMansions();
    sync(yachts, state.yachts, (o) => ({ key: o.name, ...buildYacht(o.name) }));
    state.yachts.forEach((o, i) => {
      const y = yachts.get(o.player)!, spot = mooring(i, state.marinaShift ?? 0), [x, z] = local(spot.at);
      y.group.position.set(x, 0.3, z);
      y.group.rotation.y = ((90 - spot.bow) * Math.PI) / 180;
      y.group.scale.setScalar(1.25);
    });
    sync(jets, state.jets, (o, i) => ({ key: o.name, i, ...buildJet(o.name) }));
    state.jets.forEach((o, i) => { jets.get(o.player)!.i = i; });
    const key = state.statue ? `${state.statue.player}:${state.statue.week}:${state.statue.name}` : "";
    if ((statue?.key ?? "") !== key) {
      if (statue) { couture.remove(statue.group); statue.dispose(); statue = null; }
      if (state.statue) {
        const st = state.statue;
        const look = normalizeLook(st.look, st.style);
        const outfit = outfitFromSkus(starterOutfit(getStyle(look.style), look.body, look.fit), st.outfit);
        const pedestal = buildPlazaPedestal(st.name);
        const parts = goldStatue(look, outfit);
        parts.root.scale.multiplyScalar(6);
        parts.root.position.y = PEDESTAL_TOP;
        pedestal.group.add(parts.root);
        const [x, z] = local(PLAZA_STATUE_AT);
        pedestal.group.position.set(x, 0, z);
        // Bigger than life, like the Unisphere it stands in front of.
        pedestal.group.scale.setScalar(2.5);
        void (parts.ready ?? Promise.resolve()).then(() => map?.triggerRepaint());
        statue = { key, group: pedestal.group, parts, dispose: () => { parts.dispose(); pedestal.dispose(); } };
        couture.add(pedestal.group);
      }
    }
    map?.triggerRepaint();
  };
  // The Waterfront Mansions stand on Billionaire's Row's plots, inside its model (so they move with it when it's placed).
  // A function declaration: build() calls it for the row, possibly before this line runs.
  function attachMansions() {
    const row = models.get("billionaires-row");
    if (!row) return;
    for (const [id, m] of mansions) {
      if (wantMansions.some((w) => w.player === id && `${w.plot}:${w.name}` === m.key)) continue;
      m.group.removeFromParent(); m.dispose(); mansions.delete(id);
    }
    for (const w of wantMansions) {
      if (mansions.has(w.player)) continue;
      const built = buildMansion(w.name);
      const [x, z] = plotLocal(w.plot);
      built.group.position.set(x, 0.4, z < 0 ? z - 4 : z + 4);
      // Front (+z) toward the promenade.
      built.group.rotation.y = z < 0 ? 0 : Math.PI;
      built.windows.emissiveIntensity = night ? 1.3 : 0.15;
      row.add(built.group);
      mansions.set(w.player, { key: `${w.plot}:${w.name}`, ...built });
    }
    measure();
  }
  const flyJets = (now: number, zoom: number): boolean => {
    // Readable from any height: about 90 px nose to tail, never smaller than 2.4× life.
    const size = Math.max(2.4, (90 * metersPerPx(zoom)) / 36);
    const t = (now - started) / 1000;
    for (const j of jets.values()) {
      const loop = jetLoop(j.i);
      const a = (t / loop.lap) * Math.PI * 2 + loop.phase;
      const [cx, cz] = local(loop.center);
      j.group.position.set(cx + Math.cos(a) * loop.radius, loop.height, cz + Math.sin(a) * loop.radius);
      // Nose along the circle (the model's nose is +x), banked into the turn.
      j.group.rotation.set(0, -a - Math.PI / 2, 0);
      j.group.rotateX(-0.25);
      j.group.scale.setScalar(size);
      j.banner.rotation.x = Math.sin(t * 4 + j.i) * 0.18;
    }
    return jets.size > 0;
  };

  const placeTraffic = (now: number, zoom: number): boolean => {
    const states = traffic!.step(now);
    const seen = new Set<number>();
    const size = exaggeration(zoom);
    for (const v of states) {
      let g = carById.get(v.id);
      if (!g) {
        g = buildVehicle(v.kind, v.color);
        carById.set(v.id, g);
        cars.add(g);
      }
      const m = mercator(v.at[1], v.at[0]);
      g.position.set((m.x - origin.x) / s, 0, (m.y - origin.y) / s);
      g.rotation.y = (-v.bearing * Math.PI) / 180;
      g.scale.setScalar(size);
      const beam = g.getObjectByName("beam");
      if (beam) beam.visible = night;
      seen.add(v.id);
    }
    for (const [id, g] of carById) {
      if (seen.has(id)) continue;
      cars.remove(g);
      carById.delete(id);
    }
    return states.length > 0;
  };

  const layer: CustomLayerInterface = {
    id: LANDMARK_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(m, gl) {
      map = m;
      // The same context comes back when the layer is re-added after a restyle: keep the renderer.
      if (!renderer || rendererGl !== gl) {
        renderer?.dispose();
        renderer = new WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        rendererGl = gl;
      }
    },
    render(_gl, opts) {
      if (!renderer || !map) return;
      if (map.getZoom() < LANDMARK_MIN_ZOOM) return;
      mvp.fromArray(opts.defaultProjectionData.mainMatrix as unknown as number[]);
      camera.projectionMatrix.copy(mvp).multiply(toMercator);
      frustum.setFromProjectionMatrix(camera.projectionMatrix);
      for (const [model, sphere] of bounds) model.visible = frustum.intersectsSphere(sphere);
      const now = performance.now();
      const zoom = map.getZoom();
      let moving = zoom >= ANIMATE_MIN_ZOOM && animate(themed, (now - started) / 1000, night);
      if (traffic) moving = placeTraffic(now, zoom) || moving;
      moving = flyJets(now, zoom) || moving;
      renderer.resetState();
      renderer.render(scene, camera);
      if (process.env.NODE_ENV !== "production") (window as unknown as { __landmarkStats?: unknown }).__landmarkStats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames: (stats.frames += 1) };
      // Moving things ask for the next frame, but no more than ANIMATION_FPS a second.
      if (moving && !repaintSoon) {
        repaintSoon = setTimeout(() => {
          repaintSoon = null;
          map?.triggerRepaint();
        }, 1000 / ANIMATION_FPS);
      }
    },
  };

  return {
    layer,
    heights,
    setNight,
    built: () => ({ done: models.size, total: list.length }),
    setCouture,
    setBigScreen(img, handle) {
      screen = { img, handle };
      paintBigScreen(img, handle);
      map?.triggerRepaint();
    },
    setPositions(next) {
      for (const l of next) {
        placedAt.set(l.id, l);
        const model = models.get(l.id);
        if (model) stand(model, l);
      }
      measure();
      map?.triggerRepaint();
    },
    dispose() {
      cancelBuild?.();
      queue.length = 0;
      if (repaintSoon) clearTimeout(repaintSoon);
      for (const y of yachts.values()) y.dispose();
      for (const m of mansions.values()) m.dispose();
      for (const j of jets.values()) j.dispose();
      statue?.dispose();
      renderer?.dispose();
      renderer = null;
      scene.traverse((o) => {
        const mesh = o as unknown as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
    },
  };
}
