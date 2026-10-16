// The landmark models (lib/map/landmarks.ts) as a three.js layer inside MapLibre. It shares the
// map's WebGL context and depth buffer, so models sit among the OpenStreetMap blocks and the pins
// stay on top. One scene for every landmark, placed in meters around a shared origin.

import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import {
  Box3, Camera, DirectionalLight, Frustum, Group, HemisphereLight, Matrix4, type Material, type Mesh, type Object3D, Scene, Sphere, Vector3, WebGLRenderer,
} from "three";
import { BRIDGE_BUILT_M, LANDMARKS, type Landmark } from "@/lib/map/landmarks";
import { exaggeration } from "@/lib/map/scale";
import { animate, applyTheme, buildLandmark, newThemed, type Themed } from "./landmarkModels";
import { mergeStatic } from "./mergeModel";
import { buildVehicle, setVehiclesNight } from "./vehicleModels";
import type { Traffic } from "./vehicles";

export const LANDMARK_LAYER_ID = "landmarks";
/** Below this zoom the whole city is in view and the models would be specks. */
export const LANDMARK_MIN_ZOOM = 11.5;
/** Searchlights sweep only from this zoom; below it they hold still (no redraws). */
const ANIMATE_MIN_ZOOM = 13.5;
/** Moving things redraw the map at most this often (owner, Oct 16: the phone heated up). */
const ANIMATION_FPS = 30;

export interface LandmarkLayer {
  layer: CustomLayerInterface;
  /** Each model's height in meters (as drawn), by place id: pins stand on top of it. */
  heights: ReadonlyMap<string, number>;
  /** Moves models to where placement stood them (lib/map/landmarks.ts placeLandmark). */
  setPositions(list: readonly Landmark[]): void;
  setNight(night: boolean): void;
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

export function createLandmarkLayer(list: readonly Landmark[] = LANDMARKS, traffic?: Traffic): LandmarkLayer {
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
  for (const l of list) {
    const m = mercator(l.at[0], l.at[1]);
    const model = buildLandmark(l.kind, themed);
    model.position.set((m.x - origin.x) / s, 0, (m.y - origin.y) / s);
    models.set(l.id, model);
    model.rotation.y = ((180 - l.facing) * Math.PI) / 180;
    model.scale.setScalar(l.scale);
    model.name = l.id;
    model.updateMatrixWorld(true);
    for (const o of themed.nightOnly) nightOnly.add(o);
    heights.set(l.placeId ?? l.id, buildingTop(model, nightOnly));
    // Bake the still parts into a few meshes: hundreds of draw calls become a handful.
    mergeStatic(model, new Set([...nightOnly, ...themed.sweep.map((w) => w.o)]), new Set<Material>(themed.glows.map((g) => g.mat)));
    root.add(model);
  }
  // Each landmark's bounds, so ones off screen are skipped (and their searchlights stay still).
  const bounds = new Map<Group, Sphere>();
  const measure = () => {
    root.updateMatrixWorld(true);
    for (const model of models.values()) bounds.set(model, new Box3().setFromObject(model).getBoundingSphere(new Sphere()));
  };
  measure();
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

  const setNight = (n: boolean) => {
    night = n;
    applyTheme(themed, n);
    setVehiclesNight(n);
    hemi.intensity = n ? 0.8 : 1.6;
    hemi.color.set(n ? "#8EA2D8" : "#FFF6E8");
    sun.intensity = n ? 0.35 : 1.8;
    sun.color.set(n ? "#AFC3FF" : "#FFFFFF");
    map?.triggerRepaint();
  };
  setNight(false);

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
    setPositions(next) {
      for (const l of next) {
        const model = models.get(l.id);
        if (!model) continue;
        const m = mercator(l.at[0], l.at[1]);
        model.position.set((m.x - origin.x) / s, 0, (m.y - origin.y) / s);
        model.rotation.y = ((180 - l.facing) * Math.PI) / 180;
        // A bridge stretches along its length to reach both shores.
        if (l.kind === "bridge") model.scale.x = l.scale * (l.length ?? BRIDGE_BUILT_M) / BRIDGE_BUILT_M;
      }
      measure();
      map?.triggerRepaint();
    },
    dispose() {
      if (repaintSoon) clearTimeout(repaintSoon);
      renderer?.dispose();
      renderer = null;
      scene.traverse((o) => {
        const mesh = o as unknown as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
    },
  };
}
