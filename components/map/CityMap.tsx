"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import boroughData from "@/lib/map/boroughs.geo.json";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import type { LatLng } from "@/lib/map/geo";
import { buildMapStyle, type MapTheme } from "@/lib/map/style";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";
import { startVehicles } from "./vehicles";
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

const pinWidth = (pin: PlacePin) => Math.min(180, 34 + pin.name.length * 6.6);
/** Below this zoom, pins show just their icon so every place stays visible across the city. */
const COMPACT_ZOOM = 13;
const ICON_PX = 30;
const lngLat = ([lat, lng]: LatLng): [number, number] => [lng, lat];

interface Placed { key: string; x: number; y: number; pins: PlacePin[] }

export const CityMap = forwardRef<MapApi, CityMapProps>(function CityMap(
  { pins, player, initialCenter, initialZoom = 15.5, daytime = false, onPinTap, onLockedTap, attributionControl = true, vehicles = false, initialPitch = 45, fitPins },
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

  const styleFor = (t: MapTheme, lockedSet: Set<BoroughId>) => {
    const fc = boroughData as GeoJSON.FeatureCollection;
    return buildMapStyle(t, {
      ...fc,
      features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, locked: lockedSet.has(f.properties?.id as BoroughId) } })),
    });
  };

  // ---- Create the map once ----
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
          center: lngLat(initialCenter),
          zoom: initialZoom,
          minZoom: MIN_ZOOM,
          // Tilted so the 3D buildings read; two-finger drag changes the tilt.
          pitch: initialPitch,
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
        // Start with the credits collapsed to the small (i) button.
        instance.once("load", () => hostRef.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
        if (fitPins && pins.length > 1) {
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
  }, []);

  // ---- Moving vehicles when zoomed in ----
  useEffect(() => {
    if (!map || !vehicles) return;
    return startVehicles(map);
  }, [map, vehicles]);

  // ---- Day/night and lock changes restyle in place (2 s crossfade) ----
  useEffect(() => {
    map?.setStyle(styleFor(theme, locked), { diff: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, theme, locked]);

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

  const placed = useMemo<Placed[]>(() => {
    if (!map) return [];
    const out: (Placed & { spots: { x: number; y: number; w: number }[] })[] = [];
    const compact = map.getZoom() < COMPACT_ZOOM;
    for (const pin of pins) {
      const s = project(pin.at);
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
  }, [pins, frame, map]);

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
                <span className="map-pin-pill glass-hud">
                  <span className="map-pin-tile" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={14} /></span>
                  <span className="name">{pin.name}</span>
                </span>
                <span className="map-pin-stem" />
                <span className="map-pin-dot" />
              </button>
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
