"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  BOROUGHS, ELEVATED_TRAIN, MAJOR_ROADS, NEIGHBORHOOD_LABELS, OUTSIDE_LAND, PARKS, type BoroughId,
} from "@/lib/map/boroughs";
import { type Camera, type CameraLimits, type Viewport, clampCamera, mapToScreen, panBy, zoomAt } from "@/lib/map/camera";
import { MAP_HEIGHT, MAP_WIDTH, type LatLng, centroid, project, toPath, toPolyline } from "@/lib/map/geo";
import type { PlacePin } from "@/lib/places";

/**
 * The small map interface the rest of the game talks to (Clarifications section 4):
 * show pins, move the camera, locate the player, set a borough's lock state.
 * A 3D map can implement the same handle later without touching game logic.
 */
export interface MapApi {
  moveCamera(at: LatLng, zoom?: number): void;
  locatePlayer(): void;
  setBoroughLock(id: BoroughId, locked: boolean): void;
}

export interface CityMapProps {
  pins: PlacePin[];
  player?: { at: LatLng; emoji: string } | null;
  initialCenter: LatLng;
  daytime?: boolean;
  onPinTap?: (pin: PlacePin) => void;
  onLockedTap?: (boroughName: string) => void;
}

const TAP_SLOP = 6;
const PIN_HEIGHT_PX = 30;
const LABEL_MIN_ZOOM = 1.3;
const STREETS_MIN_ZOOM = 1.4;

/** Rough on-screen width of a pin pill, for overlap checks. */
const pinWidth = (pin: PlacePin) => Math.min(180, 34 + pin.name.length * 6.6);

interface Cluster { key: string; x: number; y: number; pins: PlacePin[]; spots: { x: number; y: number; w: number }[] }

export const CityMap = forwardRef<MapApi, CityMapProps>(function CityMap(
  { pins, player, initialCenter, daytime = false, onPinTap, onLockedTap },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ width: 390, height: 844 });
  const [locked, setLocked] = useState<Set<BoroughId>>(
    () => new Set(BOROUGHS.filter((b) => b.id !== "queens").map((b) => b.id)),
  );

  const limits = useMemo<CameraLimits>(
    () => ({ minZoom: Math.max(0.3, vp.width / MAP_WIDTH), maxZoom: 7, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT }),
    [vp.width],
  );

  const [cam, setCam] = useState<Camera>(() => {
    const c = project(initialCenter);
    return { x: c.x, y: c.y, zoom: 0.9 };
  });
  const camRef = useRef(cam);
  camRef.current = cam;

  // Fit Queens to the viewport on first measure.
  const fitted = useRef(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setVp(next);
      if (!fitted.current && next.width > 0) {
        fitted.current = true;
        const c = project(initialCenter);
        setCam({ x: c.x, y: c.y, zoom: Math.min(2, next.width / 500) });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [initialCenter]);

  // ---- Camera animation ----
  const anim = useRef<number | null>(null);
  const animateTo = useCallback(
    (target: Camera) => {
      if (anim.current) cancelAnimationFrame(anim.current);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const from = camRef.current;
      const to = clampCamera(target, limits);
      if (reduce) return setCam(to);
      const start = performance.now();
      const dur = 450;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        setCam({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          zoom: from.zoom * Math.pow(to.zoom / from.zoom, e),
        });
        if (t < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [limits],
  );
  useEffect(() => () => { if (anim.current) cancelAnimationFrame(anim.current); }, []);

  useImperativeHandle(
    ref,
    () => ({
      moveCamera(at, zoom) {
        const p = project(at);
        animateTo({ x: p.x, y: p.y, zoom: zoom ?? camRef.current.zoom });
      },
      locatePlayer() {
        if (!player) return;
        const p = project(player.at);
        animateTo({ x: p.x, y: p.y, zoom: Math.max(camRef.current.zoom, 3) });
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
    [animateTo, player],
  );

  // ---- Gestures: one finger pans, two fingers pinch, wheel zooms ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const [dragging, setDragging] = useState(false);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev || !rootRef.current) return;
      const cur = local(e);
      pointers.current.set(e.pointerId, cur);
      if (pointers.current.size === 1) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        moved.current += Math.abs(dx) + Math.abs(dy);
        if (moved.current > TAP_SLOP) setDragging(true);
        setCam((c) => clampCamera(panBy(c, dx, dy), limits));
      } else if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const factor = dist / (pinch.current.dist || dist);
        const pdx = mid.x - pinch.current.mid.x;
        const pdy = mid.y - pinch.current.mid.y;
        moved.current += TAP_SLOP + 1;
        setDragging(true);
        setCam((c) => zoomAt(clampCamera(panBy(c, pdx, pdy), limits), vpRef.current, mid, factor, limits));
        pinch.current = { dist, mid };
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.current.delete(e.pointerId)) return;
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) setTimeout(() => setDragging(false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [limits]);

  const vpRef = useRef(vp);
  vpRef.current = vp;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const r = el.getBoundingClientRect();
      setCam((c) => zoomAt(c, vpRef.current, { x: e.clientX - r.left, y: e.clientY - r.top }, factor, limits));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [limits]);

  /** Taps only count when the finger didn't travel (so panning never opens things). */
  const tapGuard = (fn: () => void) => () => {
    if (moved.current <= TAP_SLOP) fn();
  };

  // ---- Static geometry (memoized: it never changes) ----
  const geometry = useMemo(
    () => ({
      outside: OUTSIDE_LAND.map((s) => toPath(s)),
      boroughs: BOROUGHS.map((b) => ({ ...b, d: b.shapes.map((s) => toPath(s)).join(" ") })),
      parks: PARKS.map((p) => toPath(p.shape)),
      roads: MAJOR_ROADS.map((r) => toPolyline(r)),
      train: toPolyline(ELEVATED_TRAIN),
    }),
    [],
  );
  const queensPath = geometry.boroughs.find((b) => b.id === "queens")!.d;

  // ---- Screen-space overlays ----
  const toScreen = (at: LatLng) => mapToScreen(cam, vp, project(at));

  const clusters = useMemo<Cluster[]>(() => {
    // Pins whose pills would overlap on screen merge into one cluster.
    const out: Cluster[] = [];
    for (const pin of pins) {
      const s = mapToScreen(cam, vp, project(pin.at));
      const w = pinWidth(pin);
      const hit = out.find((c) =>
        c.spots.some((o) => Math.abs(o.x - s.x) < (o.w + w) / 2 + 4 && Math.abs(o.y - s.y) < PIN_HEIGHT_PX),
      );
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
  }, [pins, cam, vp]);

  const half = { w: vp.width / 2 / cam.zoom, h: vp.height / 2 / cam.zoom };
  // Map units per screen pixel: keeps edges and stripes the same size at every zoom.
  const px = 1 / cam.zoom;
  const roadWidth = 2.2 / Math.sqrt(cam.zoom);
  const viewBox = `${cam.x - half.w} ${cam.y - half.h} ${half.w * 2} ${half.h * 2}`;
  const visible = (s: { x: number; y: number }, pad = 120) =>
    s.x > -pad && s.y > -pad && s.x < vp.width + pad && s.y < vp.height + pad;

  return (
    <div
      ref={rootRef}
      className={`map-root${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      aria-label="Map of Queens. Drag to pan, pinch or scroll to zoom."
      role="application"
    >
      <svg className="layer" width={vp.width} height={vp.height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id="street-grid" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
            <path d="M0 0H6M0 0V6" stroke="var(--map-street)" strokeWidth="0.35" fill="none" />
          </pattern>
          <pattern id="hazard" width={16 * px} height={16 * px} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * px} height={16 * px} fill="#FFC21A" />
            <rect x={8 * px} width={8 * px} height={16 * px} fill="#14111A" />
          </pattern>
          <clipPath id="queens-clip"><path d={queensPath} /></clipPath>
        </defs>

        <rect x={-500} y={-500} width={MAP_WIDTH + 1000} height={MAP_HEIGHT + 1000} fill="var(--map-water)" />
        {geometry.outside.map((d, i) => (
          <path key={i} d={d} fill="#17141D" />
        ))}

        {/* Locked boroughs: dark silhouettes with a hazard edge. */}
        {geometry.boroughs
          .filter((b) => b.id !== "queens")
          .map((b) => (
            <g key={b.id}>
              <path d={b.d} fill={locked.has(b.id) ? "var(--map-locked)" : "var(--map-land)"} stroke={locked.has(b.id) ? "url(#hazard)" : "none"} strokeWidth={6 * px} strokeLinejoin="round" opacity={0.85} />
            </g>
          ))}

        {/* Queens, drawn in full. */}
        <path d={queensPath} fill="var(--map-land)" stroke="rgba(255,246,224,.38)" strokeWidth={1.5 * px} />
        <g clipPath="url(#queens-clip)">
          <rect
            x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#street-grid)"
            style={{ opacity: cam.zoom >= STREETS_MIN_ZOOM ? 0.9 : 0, transition: "opacity .3s ease-out" }}
          />
          {geometry.parks.map((d, i) => (
            <path key={i} d={d} fill="var(--map-park)" stroke="rgba(64,181,137,.25)" strokeWidth={0.5} />
          ))}
        </g>
        {geometry.roads.map((pts, i) => (
          <g key={i}>
            <polyline points={pts} fill="none" stroke="rgba(255,194,26,.22)" strokeWidth={roadWidth * 2.6} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts} fill="none" stroke="var(--map-road)" strokeWidth={roadWidth} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        <polyline points={geometry.train} fill="none" stroke="rgba(255,46,136,.75)" strokeWidth={roadWidth * 0.8} strokeDasharray={`${6 * px} ${4 * px}`} strokeLinecap="round" />
      </svg>

      <div className="map-day" style={{ opacity: daytime ? 1 : 0 }} />

      <div className="map-overlay">
        {cam.zoom >= LABEL_MIN_ZOOM &&
          NEIGHBORHOOD_LABELS.map((l) => {
            const s = toScreen(l.at);
            if (!visible(s)) return null;
            return (
              <span key={l.name} className="map-label" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}>
                {l.name}
              </span>
            );
          })}

        {BOROUGHS.filter((b) => b.id !== "queens" && locked.has(b.id)).map((b) => {
          const c = b.labelAt ? project(b.labelAt) : centroid(b.shapes[0]);
          const s = mapToScreen(cam, vp, c);
          if (!visible(s, 200)) return null;
          return (
            <button
              key={b.id}
              className="map-lock glass-dark"
              style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
              onClick={tapGuard(() => onLockedTap?.(b.name))}
              aria-label={`${b.name}: Locked, coming soon`}
            >
              <span aria-hidden="true">🔒</span> {b.name} <span className="meta">Locked: Coming soon</span>
            </button>
          );
        })}

        {clusters.map((c) => {
          if (!visible(c)) return null;
          if (c.pins.length > 1) {
            return (
              <button
                key={c.key}
                className="map-pin"
                style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)` }}
                onClick={tapGuard(() => {
                  const avg = c.pins.reduce(
                    (acc, p) => [acc[0] + p.at[0] / c.pins.length, acc[1] + p.at[1] / c.pins.length] as const,
                    [0, 0] as readonly [number, number],
                  );
                  const p = project(avg);
                  animateTo({ x: p.x, y: p.y, zoom: Math.min(limits.maxZoom, camRef.current.zoom * 2.2) });
                })}
                aria-label={`${c.pins.length} places. Tap to zoom in.`}
              >
                <span
                  className="hud-number"
                  style={{
                    width: 32, height: 32, borderRadius: "50%", background: "var(--night-900)", color: "var(--text-on-dark)",
                    border: "2px solid var(--taxi-400)", display: "grid", placeItems: "center", fontSize: 16, boxShadow: "var(--elev-2)",
                  }}
                >
                  {c.pins.length}
                </span>
              </button>
            );
          }
          const pin = c.pins[0];
          return (
            <button
              key={pin.id}
              className="map-pin"
              style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, calc(-100% + 3px))` }}
              onClick={tapGuard(() => onPinTap?.(pin))}
              aria-label={`${pin.name}, ${pin.neighborhood}`}
            >
              <span className="map-pin-pill glass-dark">
                <span className={`map-pin-tile tile-${pin.category}`} aria-hidden="true">{pin.emoji}</span>
                <span className="name">{pin.name}</span>
              </span>
              <span className="map-pin-stem" />
              <span className="map-pin-dot" />
            </button>
          );
        })}

        {player && (() => {
          const s = toScreen(player.at);
          if (!visible(s)) return null;
          return (
            <span className="player-marker" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }} aria-label="You are here">
              {player.emoji}
            </span>
          );
        })()}
      </div>
    </div>
  );
});
