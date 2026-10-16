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
import { LANDMARKS, MAJOR_ROAD_CLASSES, fitBridge, placeLandmark, withPositions, type RoadLine, type Spot } from "@/lib/map/landmarks";
import type { PlacePin } from "@/lib/places";

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
const SPOTS_KEY = "cc-landmark-spots-v2";
function loadSpots(): Record<string, Spot> {
  try {
    return typeof window === "undefined" ? {} : JSON.parse(window.localStorage.getItem(SPOTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
/** Landmarks that aren't places show their name from this zoom. */
const LABEL_ZOOM = 13.5;
/** Placement needs every street, which the tiles carry from zoom 14. */
const PLACE_ZOOM = 14;

const pinWidth = (pin: PlacePin) => Math.min(180, 34 + pin.name.length * 6.6);
/** Below this zoom, pins show just their icon so every place stays visible across the city. */
const COMPACT_ZOOM = 13;
const ICON_PX = 30;
const lngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat];

interface Placed { key: string; x: number; y: number; pins: PlacePin[] }

export const CityMap = forwardRef<MapApi, CityMapProps>(function CityMap(
  { pins, player, initialCenter, initialZoom = 15.5, daytime = false, onPinTap, onLockedTap, attributionControl = true, vehicles = false, initialPitch = 45, fitPins, rightInset = 0 },
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
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: true,
          attributionControl: attributionControl ? { compact: true } : false,
          fadeDuration: 150,
        });
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        instance.on("move", () => setFrame((f) => f + 1));
        instance.on("resize", () => setFrame((f) => f + 1));
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
    const lm = createLandmarkLayer(undefined, traffic);
    landmarksRef.current = lm;
    lm.setPositions(sitesRef.current);
    lm.setNight(themeRef.current === "night");
    const ensure = () => {
      if (!map.isStyleLoaded() || map.getLayer(LANDMARK_LAYER_ID)) return;
      // Under the bridges, street names and pins; level with the 3D blocks.
      map.addLayer(lm.layer, map.getLayer("bridge-casing") ? "bridge-casing" : undefined);
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
  useEffect(() => landmarksRef.current?.setPositions(sites), [sites, map]);

  // Once a landmark's streets have loaded, stand it where no main road crosses its site.
  useEffect(() => {
    if (!map) return;
    const done = new Set<string>();
    const place = () => {
      if (map.getZoom() < PLACE_ZOOM) return;
      const bounds = map.getBounds();
      const todo = LANDMARKS.filter((l) => !done.has(l.id) && bounds.contains([l.at[1], l.at[0]]));
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
      const found: Record<string, Spot> = {};
      for (const l of todo) {
        done.add(l.id);
        // A bridge fits itself to its road; anything else steps off main roads.
        if (l.ground === "none") {
          const fit = fitBridge(l, roads);
          if (fit) found[l.id] = fit;
        } else {
          found[l.id] = { at: placeLandmark(l, roads, withPositions({ ...spotsRef.current, ...found })) };
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
      // Zoomed out, icons may overlap a little before they group, so more places stay visible.
      const near = compact ? 18 : (w: number, ow: number) => (ow + w) / 2 + 4;
      const hit = out.find((c) => c.spots.some((o) => Math.abs(o.x - s.x) < (typeof near === "number" ? near : near(w, o.w)) && Math.abs(o.y - s.y) < (compact ? 18 : PIN_HEIGHT_PX)));
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
                  <span className="map-stack" aria-hidden="true">
                    {c.pins.slice(0, 3).map((p, i) => (
                      <span key={p.id} className="map-pin-tile icon-only" style={{ background: tileBackground(glyphFor(p)), zIndex: 3 - i }}><Glyph name={glyphFor(p)} size={14} /></span>
                    ))}
                    <span className="map-stack-count hud-number">{c.pins.length}</span>
                  </span>
                </button>
              );
            }
            const pin = c.pins[0];
            if (map.getZoom() < COMPACT_ZOOM) {
              return (
                <button
                  key={pin.id}
                  className="map-pin compact"
                  style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, calc(-100% + 3px))` }}
                  onClick={() => onPinTap?.(pin)}
                  aria-label={`${pin.name}, ${pin.neighborhood}`}
                >
                  <span className="map-pin-tile icon-only" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={16} /></span>
                  <span className="map-pin-stem" />
                  <span className="map-pin-dot" />
                </button>
              );
            }
            return (
              <button
                key={pin.id}
                className="map-pin"
                style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, calc(-100% + 3px))` }}
                onClick={() => onPinTap?.(pin)}
                aria-label={`${pin.name}, ${pin.neighborhood}`}
              >
                <span className="map-pin-pill glass-hud" style={nudge(c.x, pinWidth(pin))}>
                  <span className="map-pin-tile" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={14} /></span>
                  <span className="name">{pin.name}</span>
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
            return (
              <span key={l.id} className="map-landmark-label glass-hud" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)` }}>
                {l.name}
              </span>
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
