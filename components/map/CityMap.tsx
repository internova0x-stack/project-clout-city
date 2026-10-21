"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import boroughData from "@/lib/map/boroughs.geo.json";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import type { LatLng } from "@/lib/map/geo";
import { buildMapStyle, type MapTheme } from "@/lib/map/style";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";
import { createTraffic } from "./vehicles";
import { LANDMARK_LAYER_ID, LANDMARK_MIN_ZOOM, createLandmarkLayer } from "./landmarkLayer";
import { LANDMARKS, MAJOR_ROAD_CLASSES, fitBridge, gridFacing, onStreet, placeLandmark, streetsNear, withPositions, type RoadLine, type Spot, type WaterArea } from "@/lib/map/landmarks";
import type { PlacePin } from "@/lib/places";
import { lowGraphics } from "@/lib/graphics";

/**
 * The small map interface the rest of the game talks to (Clarifications section 4):
 * show pins, move the camera, locate the player, set a borough's lock state.
 * Game data stays in lat/lng, so the renderer behind this can change freely.
 */
export interface MapApi {
  moveCamera(at: LatLng, zoom?: number): void;
  locatePlayer(): void;
  setBoroughLock(id: BoroughId, locked: boolean): void;
  /** v0.8 trips: frame both ends from helicopter height (never street level). */
  frameTrip(from: LatLng, to: LatLng): void;
  /** Screen position of a point on the map, for overlays such as the moving taxi. */
  project(at: LatLng): { x: number; y: number } | null;
}

export interface CityMapProps {
  pins: PlacePin[];
  player?: { at: LatLng; emoji: string } | null;
  initialCenter: LatLng;
  initialZoom?: number;
  daytime?: boolean;
  onPinTap?: (pin: PlacePin) => void;
  onLockedTap?: (boroughName: string, id: BoroughId) => void;
  /** Hide the map's own credits control when the screen shows them elsewhere. */
  attributionControl?: boolean;
  /** Camera tilt in degrees (0 = straight down). */
  initialPitch?: number;
  /** Moving cars on the streets when zoomed in (v0.3). */
  vehicles?: boolean;
  /** Owner, Oct 14: px kept clear on the right (the side column); a name pill there slides left so it isn't hidden. */
  rightInset?: number;
  /** Open framed on every pin (the guest screen), leaving room for the screen's top and bottom panels. */
  fitPins?: { top: number; bottom: number };
  /** v0.14 Clout TV: the photo on the Clout Tower's big screen (null: the station's ident). */
  bigScreen?: { url: string | null; handle: string; photo: string } | null;
  /** Tapping the Clout Tower's name opens today's photo. */
  onBigScreen?: () => void;
}

const MIN_ZOOM = 9;
// v0.8 (owner, Oct 13): the camera stays at helicopter height. Close zooms render at low quality.
const MAX_ZOOM = 17;
const HELICOPTER_ZOOM = 15.5;
const PIN_HEIGHT_PX = 30;
// Wide enough that, tilted and zoomed out, the whole city fits (MapLibre won't zoom out past the bounds).
const NYC_BOUNDS: [[number, number], [number, number]] = [[-75.2, 40.1], [-72.8, 41.4]];
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** Where landmarks were stood on this device (placeLandmark), so they don't jump on the next visit. */
const SPOTS_KEY = "cc-landmark-spots-v6"; // v6: Brooklyn moved into one cluster, St. Johnsons to Jamaica. v5: placed only once its streets have loaded (v4: clear of water, the station on its street)
function loadSpots(): Record<string, Spot> {
  try {
    return typeof window === "undefined" ? {} : JSON.parse(window.localStorage.getItem(SPOTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
/** Landmarks that aren't places show their name from this zoom (owner, Oct 16: "the screen looks chaotic"). */
const LABEL_ZOOM = 15.8;
/** Placement needs every street, which the tiles carry from zoom 14. */
const PLACE_ZOOM = 14;

const pinWidth = (pin: PlacePin) => Math.min(180, 34 + pin.name.length * 6.6);
/**
 * Below this zoom, pins show just their icon: the 3D buildings already say where things are, and
 * names only come in close up (owner, Oct 16: "the screen looks chaotic").
 */
const COMPACT_ZOOM = 15.8;
const ICON_PX = 30;
const lngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat];

interface Placed { key: string; x: number; y: number; pins: PlacePin[] }

export const CityMap = forwardRef<MapApi, CityMapProps>(function CityMap(
  { pins, player, initialCenter, initialZoom = 15.5, daytime = false, onPinTap, onLockedTap, attributionControl = true, vehicles = false, initialPitch = 45, fitPins, rightInset = 0, bigScreen = null, onBigScreen },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(0); // bumps on every camera move to re-place overlays
  const [locked, setLocked] = useState<Set<BoroughId>>(() => new Set(BOROUGHS.filter((b) => b.id !== "queens").map((b) => b.id)));
  const theme: MapTheme = daytime ? "day" : "night";
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // Landmarks stand off main roads, inside blocks (lib/map/landmarks.ts placeLandmark).
  const [spots, setSpots] = useState<Record<string, Spot>>(loadSpots);
  const sites = useMemo(() => withPositions(spots), [spots]);
  const sitesRef = useRef(sites);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  sitesRef.current = sites;
  const siteOf = useMemo(() => new Map(sites.filter((l) => l.placeId).map((l) => [l.placeId!, l.at])), [sites]);

  const styleFor = (t: MapTheme, lockedSet: Set<BoroughId>) => {
    const fc = boroughData as GeoJSON.FeatureCollection;
    return buildMapStyle(t, {
      ...fc,
      features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, locked: lockedSet.has(f.properties?.id as BoroughId) } })),
    }, sitesRef.current);
  };

  // ---- Create the map (again after iOS drops its WebGL context: a black map with only the pins) ----
  const [generation, setGeneration] = useState(0);
  const lostRef = useRef(false);
  const viewRef = useRef<{ center: [number, number]; zoom: number; pitch: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !hostRef.current) return;
        maplibre.setWorkerUrl(WORKER_URL);
        instance = new maplibre.Map({
          container: hostRef.current,
          style: styleFor(themeRef.current, lockedRef.current),
          center: viewRef.current?.center ?? lngLat(initialCenter),
          zoom: viewRef.current?.zoom ?? initialZoom,
          minZoom: MIN_ZOOM,
          // Tilted so the 3D buildings read; two-finger drag changes the tilt.
          pitch: viewRef.current?.pitch ?? initialPitch,
          maxPitch: 60,
          maxZoom: MAX_ZOOM,
          maxBounds: NYC_BOUNDS,
          // Phones render at 3x; 2x looks the same on a map and is far lighter (owner, Oct 16: heat). Low graphics: 1x.
          pixelRatio: Math.min(lowGraphics() ? 1 : 2, window.devicePixelRatio || 1),
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: true,
          attributionControl: attributionControl ? { compact: true } : false,
          fadeDuration: 150,
        });
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        // Pins follow the camera at most once per animation frame (moves can fire more often).
        let pending = 0;
        const bump = () => {
          if (pending) return;
          pending = requestAnimationFrame(() => { pending = 0; setFrame((f) => f + 1); });
        };
        instance.on("move", bump);
        instance.on("resize", bump);
        instance.on("error", (e) => console.warn("map:", e.error?.message ?? e));
        lostRef.current = false;
        instance.on("webglcontextlost", () => { lostRef.current = true; });
        instance.on("webglcontextrestored", () => { lostRef.current = false; instance?.triggerRepaint(); });
        // Start with the credits collapsed to the small (i) button.
        instance.once("load", () => hostRef.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
        if (fitPins && pins.length > 1 && !viewRef.current) {
          const lats = pins.map((p) => p.at[0]);
          const lngs = pins.map((p) => p.at[1]);
          instance.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
            padding: { top: fitPins.top, bottom: fitPins.bottom, left: 36, right: 36 }, maxZoom: 13.5, duration: 0, pitch: initialPitch,
          });
        }
        mapRef.current = instance;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __cityMap?: MapLibreMap }).__cityMap = instance;
        setMap(instance);
      } catch (err) {
        console.error("map failed to start", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      instance?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  // Back from the background: repaint, and rebuild the map if the browser took its WebGL context
  // and didn't give it back (iOS, after a while in the background or with many tabs open).
  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      map.resize();
      map.triggerRepaint();
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!lostRef.current) return;
        const c = map.getCenter();
        viewRef.current = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch() };
        setMap(null);
        setGeneration((g) => g + 1);
      }, 1200);
    };
    const onLost = () => check();
    map.on("webglcontextlost", onLost);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      clearTimeout(timer);
      map.off("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [map]);

  // ---- Landmark models and 3D traffic (three.js), put back after every restyle ----
  const landmarksRef = useRef<ReturnType<typeof createLandmarkLayer> | null>(null);
  useEffect(() => {
    if (!map) return;
    const traffic = vehicles ? createTraffic(map, () => sitesRef.current) : undefined;
    const t0 = performance.now();
    // Only the landmarks around where the map opens are built now; the rest follow while the phone is idle.
    const c = map.getCenter();
    const lm = createLandmarkLayer(undefined, traffic, [c.lat, c.lng]);
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __launch?: Record<string, number> };
      w.__launch = { ...w.__launch, landmarksBuildMs: performance.now() - t0, landmarksBuiltAt: performance.now(), landmarksNear: lm.built().done };
      map.once("idle", () => { w.__launch = { ...w.__launch, firstIdleAt: performance.now() }; });
      map.once("render", () => { w.__launch = { ...w.__launch, firstRenderAt: performance.now() }; });
    }
    landmarksRef.current = lm;
    lm.setPositions(sitesRef.current);
    lm.setNight(themeRef.current === "night");
    const ensure = () => {
      if (!map.isStyleLoaded() || map.getLayer(LANDMARK_LAYER_ID)) return;
      // Above the locked boroughs' dark veil (owner, Oct 16: the bridge's Manhattan end was covered
      // at night), under the street names and pins; level with the 3D blocks by depth.
      map.addLayer(lm.layer, map.getLayer("street-names") ? "street-names" : undefined);
    };
    ensure();
    map.on("styledata", ensure);
    map.on("load", ensure);
    return () => {
      map.off("styledata", ensure);
      map.off("load", ensure);
      if (map.getLayer(LANDMARK_LAYER_ID)) map.removeLayer(LANDMARK_LAYER_ID);
      lm.dispose();
      traffic?.dispose();
      landmarksRef.current = null;
    };
  }, [map, vehicles]);
  useEffect(() => landmarksRef.current?.setNight(theme === "night"), [theme, map]);
  // v0.14 Clout TV: the featured photo on the Clout Tower's screen (a signed link that allows the GPU to read it).
  const screenUrl = bigScreen?.url ?? null;
  const screenHandle = bigScreen?.handle;
  // Signed links change on every check; redraw only when the photo itself changes.
  const screenKey = bigScreen?.photo ?? null;
  const urlRef = useRef(screenUrl);
  urlRef.current = screenUrl;
  useEffect(() => {
    const lm = landmarksRef.current;
    if (!lm) return;
    const url = urlRef.current;
    if (!screenKey || !url) return lm.setBigScreen(null);
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (live) lm.setBigScreen(img, screenHandle); };
    img.onerror = () => { if (live) lm.setBigScreen(null); };
    img.src = url;
    return () => { live = false; };
  }, [screenKey, screenHandle, map, vehicles]);
  useEffect(() => landmarksRef.current?.setPositions(sites), [sites, map]);

  // Once a landmark's streets have loaded, stand it where no main road crosses its site.
  useEffect(() => {
    if (!map) return;
    const done = new Set<string>();
    const place = () => {
      if (map.getZoom() < PLACE_ZOOM) return;
      const bounds = map.getBounds();
      // Each landmark is placed once per device: later visits use the remembered spot.
      const todo = LANDMARKS.filter((l) => !done.has(l.id) && !spotsRef.current[l.id] && bounds.contains([l.at[1], l.at[0]]));
      if (!todo.length) return;
      const roads: RoadLine[] = [];
      for (const f of map.querySourceFeatures("osm", { sourceLayer: "transportation" })) {
        const cls = String(f.properties?.class);
        if (f.properties?.brunnel === "tunnel" || !(MAJOR_ROAD_CLASSES.has(cls) || cls === "minor")) continue;
        const g = f.geometry;
        const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
        for (const line of lines) roads.push({ major: MAJOR_ROAD_CLASSES.has(cls), bridge: f.properties?.brunnel === "bridge", pts: line as [number, number][] });
      }
      if (!roads.length) return;
      const water: WaterArea[] = [];
      for (const f of map.querySourceFeatures("osm", { sourceLayer: "water" })) {
        const g = f.geometry;
        if (g.type === "Polygon") water.push(g.coordinates as [number, number][][]);
        else if (g.type === "MultiPolygon") for (const p of g.coordinates) water.push(p as [number, number][][]);
      }
      const found: Record<string, Spot> = {};
      for (const l of todo) {
        // Its streets haven't loaded yet: try again on a later idle, or it would stand off the grid for good.
        if (l.kind !== "bridge" && !streetsNear(l, roads)) continue;
        done.add(l.id);
        // A bridge fits itself to its road; anything else steps off main roads.
        if (l.kind === "bridge") {
          const fit = fitBridge(l, roads);
          if (fit) found[l.id] = fit;
        } else if (l.ground === "none") {
          // Over the street (an elevated station): set on its street, running along it.
          found[l.id] = onStreet(l, roads) ?? { at: l.at, facing: gridFacing(l, roads) };
        } else {
          const at = placeLandmark(l, roads, withPositions({ ...spotsRef.current, ...found }), water);
          // Turned to line up with the streets around where it stands; a pier faces the water.
          found[l.id] = { at, facing: gridFacing({ ...l, at }, roads, 250, l.kind === "pier-park" ? water : []) };
        }
      }
      setSpots((prev) => {
        const next = { ...prev, ...found };
        if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
        try { window.localStorage.setItem(SPOTS_KEY, JSON.stringify(next)); } catch { /* private mode: placed again next visit */ }
        return next;
      });
    };
    map.on("idle", place);
    return () => { map.off("idle", place); };
  }, [map]);

  // ---- Day/night and lock changes restyle in place (2 s crossfade) ----
  useEffect(() => {
    map?.setStyle(styleFor(theme, locked), { diff: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, theme, locked, sites]);

  useImperativeHandle(
    ref,
    () => ({
      moveCamera(at, zoom) {
        const m = mapRef.current;
        m?.easeTo({ center: lngLat(at), zoom: zoom ?? m.getZoom(), duration: 600 });
      },
      locatePlayer() {
        const m = mapRef.current;
        if (!player || !m) return;
        m.easeTo({ center: lngLat(player.at), zoom: HELICOPTER_ZOOM, duration: 700 });
      },
      frameTrip(from, to) {
        const m = mapRef.current;
        if (!m) return;
        const [w, s2, e, n] = [Math.min(from[1], to[1]), Math.min(from[0], to[0]), Math.max(from[1], to[1]), Math.max(from[0], to[0])];
        m.fitBounds([[w, s2], [e, n]], { padding: { top: 150, bottom: 140, left: 60, right: 60 }, maxZoom: HELICOPTER_ZOOM, pitch: 45, duration: 700 });
      },
      project(at) {
        const m = mapRef.current;
        if (!m) return null;
        const pt = m.project(lngLat(at));
        return { x: pt.x, y: pt.y };
      },
      setBoroughLock(id, isLocked) {
        setLocked((prev) => {
          const next = new Set(prev);
          if (isLocked) next.add(id);
          else next.delete(id);
          return next;
        });
      },
    }),
    [player],
  );

  // ---- Screen-space overlays: pins (merged when they'd overlap), lock pills, player ----
  const project = (at: LatLng) => {
    const p = map!.project(lngLat(at));
    return { x: p.x, y: p.y };
  };
  const size = map ? { w: map.getContainer().clientWidth, h: map.getContainer().clientHeight } : { w: 0, h: 0 };
  const visible = (s: { x: number; y: number }, pad = 120) => s.x > -pad && s.y > -pad && s.x < size.w + pad && s.y < size.h + pad;

  // A place drawn as a landmark model has its pin on the model's top, not hidden behind it:
  // its height in meters times the screen scale there, foreshortened by the tilt.
  const lift = (id: string, at: LatLng) => {
    const h = landmarksRef.current?.heights.get(id);
    if (!h || map!.getZoom() < LANDMARK_MIN_ZOOM) return 0;
    const a = map!.project(lngLat(at));
    const b = map!.project([at[1] + 10 / (111_320 * Math.cos((at[0] * Math.PI) / 180)), at[0]]);
    return (h * Math.hypot(b.x - a.x, b.y - a.y) / 10) * Math.sin((map!.getPitch() * Math.PI) / 180);
  };
  // Owner, Oct 17: a place in a borough that hasn't opened opens that borough's sheet instead.
  const tapPin = (pin: PlacePin) => {
    if (pin.locked && pin.borough) return onLockedTap?.(BOROUGHS.find((b) => b.id === pin.borough)?.name ?? "", pin.borough);
    onPinTap?.(pin);
  };
  const placed = useMemo<Placed[]>(() => {
    if (!map) return [];
    const out: (Placed & { spots: { x: number; y: number; w: number }[] })[] = [];
    const compact = map.getZoom() < COMPACT_ZOOM;
    for (const pin of pins) {
      // A landmark's pin follows its model when placement moved it off a road.
      const at = siteOf.get(pin.id) ?? pin.at;
      const ground = project(at);
      const s = { x: ground.x, y: ground.y - lift(pin.id, at) };
      const w = compact ? ICON_PX : pinWidth(pin);
      // Icons closer than about one icon apart group into a count, so the map stays calm.
      const near = compact ? 30 : (w: number, ow: number) => (ow + w) / 2 + 4;
      const hit = out.find((c) => c.spots.some((o) => Math.abs(o.x - s.x) < (typeof near === "number" ? near : near(w, o.w)) && Math.abs(o.y - s.y) < (compact ? 30 : PIN_HEIGHT_PX)));
      if (hit) {
        hit.pins.push(pin);
        hit.spots.push({ x: s.x, y: s.y, w });
        hit.x = (hit.x * (hit.pins.length - 1) + s.x) / hit.pins.length;
        hit.y = (hit.y * (hit.pins.length - 1) + s.y) / hit.pins.length;
      } else {
        out.push({ key: pin.id, x: s.x, y: s.y, pins: [pin], spots: [{ x: s.x, y: s.y, w }] });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, frame, map, siteOf]);

  // A name pill that would run under the right-hand side column slides left (its stem stays on the place).
  const nudge = (x: number, w: number): React.CSSProperties | undefined => {
    const width = hostRef.current?.clientWidth ?? 0;
    if (!rightInset || !width) return undefined;
    const over = x + w / 2 - (width - rightInset);
    return over > 0 ? { transform: `translateX(${-Math.min(over, w - 28)}px)` } : undefined;
  };
  return (
    <div className="map-root" aria-label="Map of Queens. Drag to pan, pinch or scroll to zoom." role="application">
      <div className="layer"><div ref={hostRef} className="map-canvas" style={{ width: "100%", height: "100%" }} /></div>
      {failed && (
        <div className="layer" style={{ display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
          <p className="subtext" style={{ color: "rgba(255,246,224,.7)" }}>The map needs WebGL, which this browser has switched off.</p>
        </div>
      )}
      {map && (
        <div className="map-overlay">
          {BOROUGHS.filter((b) => b.id !== "queens" && locked.has(b.id) && b.labelAt).map((b) => {
            const s = project(b.labelAt!);
            if (!visible(s, 200)) return null;
            return (
              <button
                key={b.id}
                className="map-lock glass-hud"
                style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
                onClick={() => onLockedTap?.(b.name, b.id)}
                aria-label={`${b.name}: Locked, coming soon`}
              >
                <span aria-hidden="true">🔒</span> {b.name}
              </button>
            );
          })}

          {/* Owner, Oct 17: the Clout TV Tower's body opens who's on the Big Screen; its pin label opens the tower's card. */}
          {onBigScreen && sites.filter((l) => l.kind === "clout-tower").map((l) => {
            const h = lift(l.id, l.at);
            if (h < 24) return null;
            const g = project(l.at);
            if (!visible(g)) return null;
            const e = project([l.at[0], l.at[1] + 20 / (111_320 * Math.cos((l.at[0] * Math.PI) / 180))]);
            const w = Math.max(44, 2 * Math.hypot(e.x - g.x, e.y - g.y));
            // From just under the pin down past the ground point (the base's front edge sits lower on screen).
            return (
              <button key={`${l.id}-body`} className="map-tower-body" onClick={onBigScreen}
                style={{ left: g.x - w / 2, top: g.y - h, width: w, height: h + w * 0.35 }}
                aria-label="Clout TV Tower: see who's on the Big Screen" />
            );
          })}

          {placed.map((c) => {
            if (!visible(c)) return null;
            if (c.pins.length > 1) {
              return (
                <button
                  key={c.key}
                  className="map-pin"
                  style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)` }}
                  onClick={() => {
                    const lat = c.pins.reduce((a, p) => a + p.at[0], 0) / c.pins.length;
                    const lng = c.pins.reduce((a, p) => a + p.at[1], 0) / c.pins.length;
                    map.easeTo({ center: [lng, lat], zoom: Math.min(MAX_ZOOM, map.getZoom() + 1.5), duration: 500 });
                  }}
                  aria-label={`${c.pins.length} places. Tap to zoom in.`}
                >
                  <span className="map-cluster glass-hud hud-number" aria-hidden="true">{c.pins.length}</span>
                </button>
              );
            }
            const pin = c.pins[0];
            if (map.getZoom() < COMPACT_ZOOM) {
              return (
                <button
                  key={pin.id}
                  className={`map-pin compact${pin.locked ? " locked" : ""}`}
                  style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, calc(-100% + 3px))` }}
                  onClick={() => tapPin(pin)}
                  aria-label={`${pin.name}, ${pin.neighborhood}`}
                >
                  <span className="map-pin-tile icon-only" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={14} /></span>
                  <span className="map-pin-stem" />
                  <span className="map-pin-dot" />
                </button>
              );
            }
            return (
              <button
                key={pin.id}
                className={`map-pin${pin.locked ? " locked" : ""}`}
                style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, calc(-100% + 3px))` }}
                onClick={() => tapPin(pin)}
                aria-label={pin.locked ? `${pin.name}, ${pin.neighborhood}: locked until the borough opens` : `${pin.name}, ${pin.neighborhood}`}
              >
                <span className="map-pin-pill glass-hud" style={nudge(c.x, pinWidth(pin))}>
                  <span className="map-pin-tile" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={14} /></span>
                  <span className="name">{pin.locked && <span aria-hidden="true">🔒 </span>}{pin.name}</span>
                </span>
                <span className="map-pin-stem" />
                <span className="map-pin-dot" />
              </button>
            );
          })}

          {/* Landmarks that aren't game places (a bridge, a ballpark): a name on top, no pin. */}
          {map.getZoom() >= LABEL_ZOOM && sites.filter((l) => !l.placeId).map((l) => {
            const ground = project(l.at);
            const s = { x: ground.x, y: ground.y - lift(l.id, l.at) };
            if (!visible(s)) return null;
            // A place's pin wins over a landmark's name where they'd overlap.
            if (placed.some((c) => Math.abs(c.x - s.x) < 90 && Math.abs(c.y - s.y) < PIN_HEIGHT_PX + 8)) return null;
            return (
              l.kind === "clout-tower" && onBigScreen ? (
                <button key={l.id} className="map-landmark-label glass-hud tappable" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)` }}
                  onClick={onBigScreen} aria-label="Clout TV Tower: see who's on the big screen">
                  📺 {l.name}
                </button>
              ) : (
              <span key={l.id} className="map-landmark-label glass-hud" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)` }}>
                {l.name}
              </span>
              )
            );
          })}

          {player && (() => {
            const s = project(player.at);
            if (!visible(s)) return null;
            return (
              <span className="player-marker" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }} aria-label="You are here">
                {player.emoji}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
});
