"use client";

// The compact map (owner, Oct 29; lib/compactMap.ts): the same props and MapApi as CityMap, drawn as New York in
// miniature. Drag to scroll, pinch or scroll to zoom; pins and the locked boroughs' cards are HTML on top. Game data
// stays in lat/lng: a place's lat/lng lands on its own block, anything else between its nearest places.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import type { LatLng } from "@/lib/map/geo";
import { PLACES } from "@/lib/city";
import { DISTRICTS, ISLAND_CARD_AT, labelPriority, pickLabels, SPOTS, STREET_NAMES, WORLD_SIZE, COMPACT_GRID, gridToWorld, makeProjector } from "@/lib/compactMap";
import { renderQuality } from "@/lib/graphics";
import type { PlacePin } from "@/lib/places";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";
import type { CityMapProps, MapApi } from "./CityMap";
import { createCompactScene, type CompactScene } from "./compactScene";

/** The camera looks north, tilted (degrees from straight down). */
const PITCH = 50;
/** ...and turned a little, so the street grid runs on the diagonal like the mockups (degrees). */
const YAW = -32;
/** Camera distance from what it looks at, in meters: close in, the default, zoomed all the way out. */
const DIST = { min: 240, start: 640, max: 1700 } as const;
/** Closer than this, pins show their names; farther, just their icon. */
const NAMES_DIST = 520;
/** Farther than this, the city is a picture: neighborhood names and the locked boroughs' cards, no pins. */
const PINS_DIST = 1400;
/** Neighborhood names show from this far out. */
const DISTRICT_DIST = 1100;
const project = makeProjector(PLACES.map((p) => ({ at: p.at, spot: SPOTS[p.id] ?? [9, 9] })));
const CELL = COMPACT_GRID.cell;

interface View { x: number; z: number; dist: number }
const clampView = (v: View): View => ({
  x: Math.min(WORLD_SIZE.w, Math.max(0, v.x)),
  z: Math.min(WORLD_SIZE.h, Math.max(0, v.z)),
  dist: Math.min(DIST.max, Math.max(DIST.min, v.dist)),
});

export const CompactMap = forwardRef<MapApi, CityMapProps>(function CompactMap(
  { pins, player, initialCenter, daytime = false, onPinTap, onLockedTap, rightInset = 0, bigScreen = null },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CompactScene | null>(null);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [locked, setLocked] = useState<Set<BoroughId>>(() => new Set(BOROUGHS.filter((b) => b.id !== "queens").map((b) => b.id)));
  const viewRef = useRef<View>((() => { const [x, z] = project(initialCenter); return { x, z, dist: DIST.start }; })());
  const animRef = useRef<{ from: View; to: View; start: number; ms: number } | null>(null);
  const dirtyRef = useRef(true);
  // The building whose details are open (owner, Oct 29: taps reveal building details).
  const [selected, setSelected] = useState<string | null>(null);
  const tapRef = useRef<(id: string | null) => void>(() => {});
  const [failed, setFailed] = useState(false);

  // ---- Scene, render loop ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: CompactScene;
    try {
      scene = createCompactScene(renderQuality());
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    scene.canvas.style.width = "100%";
    scene.canvas.style.height = "100%";
    scene.canvas.style.display = "block";
    host.appendChild(scene.canvas);
    const fit = () => { scene.resize(host.clientWidth, host.clientHeight); dirtyRef.current = true; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    setReady(true);

    let raf = 0;
    let building = true;
    let lastAnim = 0;
    const started = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const a = animRef.current;
      if (a) {
        const t = Math.min(1, (now - a.start) / a.ms), e = 1 - (1 - t) ** 3;
        viewRef.current = { x: a.from.x + (a.to.x - a.from.x) * e, z: a.from.z + (a.to.z - a.from.z) * e, dist: a.from.dist + (a.to.dist - a.from.dist) * e };
        if (t >= 1) animRef.current = null;
        dirtyRef.current = true;
      }
      if (building) {
        building = scene.buildMore([viewRef.current.x, viewRef.current.z], 8);
        dirtyRef.current = true;
      }
      // Searchlights at night, at most 30 frames a second.
      if (now - lastAnim > 33 && scene.tick((now - started) / 1000)) { lastAnim = now; dirtyRef.current = true; }
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const v = viewRef.current, p = (PITCH * Math.PI) / 180, yaw = (YAW * Math.PI) / 180;
      const h = v.dist * Math.sin(p);
      scene.camera.position.set(v.x + Math.sin(yaw) * h, v.dist * Math.cos(p), v.z + Math.cos(yaw) * h);
      scene.camera.lookAt(v.x, 0, v.z);
      scene.camera.updateMatrixWorld();
      scene.render();
      setFrame((f) => f + 1);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.dispose();
      scene.canvas.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.setNight(!daytime); dirtyRef.current = true; }, [daytime, ready]);
  useEffect(() => { sceneRef.current?.setLocked(locked); dirtyRef.current = true; }, [locked, ready]);
  const shownKey = pins.map((p) => p.id).join(",");
  useEffect(() => { sceneRef.current?.setShown(new Set(shownKey.split(","))); dirtyRef.current = true; }, [shownKey, ready]);

  // v0.14 Clout TV: the photo on the Clout Tower's big screen.
  const screenUrl = bigScreen?.url ?? null, screenHandle = bigScreen?.handle ?? "";
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    if (!screenUrl) { s.setBigScreen(null); dirtyRef.current = true; return; }
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (live) { s.setBigScreen(img, screenHandle); dirtyRef.current = true; } };
    img.onerror = () => { if (live) s.setBigScreen(null); };
    img.src = screenUrl;
    return () => { live = false; };
  }, [screenUrl, screenHandle, ready]);

  const flyTo = (to: Partial<View>, ms = 600) => {
    animRef.current = { from: viewRef.current, to: clampView({ ...viewRef.current, ...to }), start: performance.now(), ms };
  };

  // ---- Gestures: drag to scroll, pinch or wheel to zoom ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const pts = new Map<number, { x: number; y: number }>();
    // A tap (no drag) on a building opens its details; on empty ground it closes them.
    let tap: { x: number; y: number; moved: boolean } | null = null;
    let pinch: { d: number; dist: number } | null = null;
    const perPx = () => {
      const h = host.clientHeight || 1;
      return (2 * viewRef.current.dist * Math.tan((40 * Math.PI) / 360)) / h;
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      host.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : null;
      animRef.current = null;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: viewRef.current.dist };
      }
      host.classList.add("dragging");
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const next = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, next);
      if (tap && Math.hypot(next.x - tap.x, next.y - tap.y) > 6) tap.moved = true;
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        viewRef.current = clampView({ ...viewRef.current, dist: pinch.dist * (pinch.d / Math.max(1, d)) });
      } else if (pts.size === 1) {
        const k = perPx(), p = (PITCH * Math.PI) / 180, yaw = (YAW * Math.PI) / 180;
        const dx = (next.x - prev.x) * k, dy = ((next.y - prev.y) * k) / Math.cos(p);
        // Screen right is (cos, -sin) on the ground; screen up is (-sin, -cos).
        viewRef.current = clampView({
          ...viewRef.current,
          x: viewRef.current.x - dx * Math.cos(yaw) - dy * Math.sin(yaw),
          z: viewRef.current.z + dx * Math.sin(yaw) - dy * Math.cos(yaw),
        });
      }
      dirtyRef.current = true;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (tap && !tap.moved && !pts.size && e.type === "pointerup") {
        const r = host.getBoundingClientRect();
        const id = sceneRef.current?.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1) ?? null;
        tapRef.current(id);
      }
      tap = null;
      if (pts.size < 2) pinch = null;
      if (!pts.size) host.classList.remove("dragging");
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      viewRef.current = clampView({ ...viewRef.current, dist: viewRef.current.dist * Math.exp(e.deltaY * 0.0015) });
      dirtyRef.current = true;
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", wheel, { passive: false });
    return () => {
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("wheel", wheel);
    };
  }, []);

  // ---- Screen positions for overlays ----
  const v3 = useMemo(() => new Vector3(), []);
  const screenAt = (x: number, y: number, z: number) => {
    const s = sceneRef.current, host = hostRef.current;
    if (!s || !host) return null;
    v3.set(x, y, z).project(s.camera);
    if (v3.z > 1) return null;
    return { x: ((v3.x + 1) / 2) * host.clientWidth, y: ((1 - v3.y) / 2) * host.clientHeight };
  };
  const toScreen = (at: LatLng, up = 0) => { const [x, z] = project(at); return screenAt(x, up, z); };

  useImperativeHandle(ref, () => ({
    moveCamera(at, zoom) {
      const [x, z] = project(at);
      flyTo({ x, z, ...(zoom !== undefined ? { dist: zoom >= 15 ? DIST.start * 0.7 : DIST.start } : {}) });
    },
    locatePlayer() {
      if (!player) return;
      const [x, z] = project(player.at);
      flyTo({ x, z, dist: DIST.start }, 700);
    },
    frameTrip(from, to) {
      const [ax, az] = project(from), [bx, bz] = project(to);
      flyTo({ x: (ax + bx) / 2, z: (az + bz) / 2, dist: Math.min(DIST.max, Math.max(DIST.start * 0.8, Math.hypot(ax - bx, az - bz) * 2.4)) }, 700);
    },
    project(at) { return toScreen(at); },
    setBoroughLock(id, isLocked) {
      setLocked((prev) => {
        if (prev.has(id) === isLocked) return prev;
        const next = new Set(prev);
        if (isLocked) next.add(id); else next.delete(id);
        return next;
      });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [player]);

  const size = { w: hostRef.current?.clientWidth ?? 0, h: hostRef.current?.clientHeight ?? 0 };
  const visible = (s: { x: number; y: number } | null, pad = 80): s is { x: number; y: number } =>
    !!s && s.x > -pad && s.y > -pad && s.x < size.w + pad && s.y < size.h + pad;
  const dist = viewRef.current.dist;
  const names = dist < NAMES_DIST;
  const heights = sceneRef.current?.heights;
  const tapPin = (pin: PlacePin) => {
    if (pin.locked && pin.borough) return onLockedTap?.(BOROUGHS.find((b) => b.id === pin.borough)?.name ?? "", pin.borough);
    onPinTap?.(pin);
  };
  // Where the player is: the place nearest their position, if they're standing at one.
  const hereId = useMemo(() => {
    if (!player) return null;
    const [px, pz] = project(player.at);
    let best: string | null = null, bd = 12;
    for (const pin of pins) { const [x, z] = project(pin.at); const d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = pin.id; } }
    return best;
  }, [player, pins]);
  const select = (id: string | null) => {
    setSelected(id);
    if (id) { const pin = pins.find((p) => p.id === id); if (pin) { const [x, z] = project(pin.at); flyTo({ x, z }, 450); } }
  };
  tapRef.current = (id) => select(id && pins.some((p) => p.id === id) ? id : null);
  const selectedPin = selected ? pins.find((p) => p.id === selected) ?? null : null;
  const nudge = (x: number, w: number): React.CSSProperties | undefined => {
    if (!rightInset || !size.w) return undefined;
    const over = x + w / 2 - (size.w - rightInset);
    return over > 0 ? { transform: `translateX(${-Math.min(over, w - 28)}px)` } : undefined;
  };
  void frame;

  return (
    <div ref={hostRef} className="map-root compact-map" aria-label="Map of the city. Drag to scroll, pinch or scroll to zoom." role="application">
      {failed && (
        <div className="layer" style={{ display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
          <p className="subtext" style={{ color: "rgba(255,246,224,.7)" }}>The map needs WebGL, which this browser has switched off.</p>
        </div>
      )}
      {ready && (
        <div className="map-overlay">
          {/* Neighborhood names, zoomed out */}
          {dist > DISTRICT_DIST && DISTRICTS.filter((d) => d.borough === "queens" || !locked.has(d.borough)).map((d) => {
            const s = screenAt(((d.rect.x0 + d.rect.x1 + 1) / 2) * CELL, 30, ((d.rect.y0 + d.rect.y1 + 1) / 2) * CELL);
            if (!visible(s)) return null;
            return (
              <button key={d.id} className="compact-district" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
                onClick={() => flyTo({ x: ((d.rect.x0 + d.rect.x1 + 1) / 2) * CELL, z: ((d.rect.y0 + d.rect.y1 + 1) / 2) * CELL, dist: DIST.start }, 700)}
                aria-label={`${d.name}: zoom in`}>{d.name}</button>
            );
          })}
          {/* Street names, closer in */}
          {names && STREET_NAMES.map((st) => {
            const [x, z] = st.dir === "ew" ? [(st.from + 0.5) * CELL, st.at * CELL] : [st.at * CELL, (st.from + 0.5) * CELL];
            const s = screenAt(x, 0.5, z);
            const e = st.dir === "ew" ? screenAt(x + 20, 0.5, z) : screenAt(x, 0.5, z + 20);
            if (!visible(s) || !e) return null;
            let deg = (Math.atan2(e.y - s.y, e.x - s.x) * 180) / Math.PI;
            if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
            return <span key={st.name} className="compact-street" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) rotate(${deg}deg)` }}>{st.name}</span>;
          })}
          {/* Locked boroughs: a card on the island; tapping opens the borough's sheet (gate count, Lola's teaser) */}
          {BOROUGHS.filter((b) => b.id !== "queens" && locked.has(b.id)).map((b) => {
            const at = ISLAND_CARD_AT[b.id as Exclude<BoroughId, "queens">];
            const [x, z] = gridToWorld([at[0] - 0.5, at[1] - 0.5]);
            const s = screenAt(x, 4, z);
            if (!visible(s, 160)) return null;
            return (
              <button key={b.id} className="compact-island" style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
                onClick={() => onLockedTap?.(b.name, b.id)} aria-label={`${b.name}: locked, coming soon`}>
                <span className="title">🔒 {b.name}</span>
                <span className="meta">Coming soon · tap for when it opens</span>
              </button>
            );
          })}
          {/* Places: names for the few that matter now, small dots for the rest; a tap opens the details card */}
          {dist < PINS_DIST && (() => {
            const shown = pins.filter((pin) => !(pin.borough && pin.borough !== "queens" && locked.has(pin.borough)));
            const spots = shown.map((pin) => {
              const [x, z] = project(pin.at);
              const s = screenAt(x, heights?.get(pin.id) ?? 6, z);
              return { pin, s, id: pin.id, x: s?.x ?? -9999, y: s?.y ?? -9999, w: Math.min(170, 40 + Math.min(pin.name.length, 22) * 6.6),
                priority: labelPriority(pin.id, { selected, glow: pin.glow, here: hereId }) };
            }).filter((p) => visible(p.s));
            const named = pickLabels(spots, names ? 6 : 3);
            return spots.map(({ pin, s }) => {
              if (!s) return null;
              const label = named.has(pin.id);
              if (!label) {
                return (
                  <button key={pin.id} className={`compact-dot${pin.glow ? " glow" : ""}${selected === pin.id ? " on" : ""}`}
                    style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` }}
                    onClick={() => select(pin.id)} aria-label={`${pin.name}, ${pin.neighborhood}`}>
                    <span style={{ background: tileBackground(glyphFor(pin)) }} />
                  </button>
                );
              }
              return (
                <button key={pin.id} className={`map-pin${pin.glow ? " glow" : ""}`}
                  style={{ transform: `translate(${s.x}px, ${s.y}px) translate(-50%, calc(-100% + 3px))` }}
                  onClick={() => select(pin.id)} aria-label={`${pin.name}, ${pin.neighborhood}`}>
                  <span className="map-pin-pill glass-hud" style={nudge(s.x, 170)}>
                    <span className="map-pin-tile" aria-hidden="true" style={{ background: tileBackground(glyphFor(pin)) }}><Glyph name={glyphFor(pin)} size={14} /></span>
                    <span className="name">{pin.name}</span>
                    {pin.glow && <span className="map-pin-star" aria-hidden="true">⭐</span>}
                  </span>
                  <span className="map-pin-stem" />
                  <span className="map-pin-dot" />
                </button>
              );
            });
          })()}
          {player && (() => {
            const s = toScreen(player.at, 2);
            if (!visible(s)) return null;
            return <span className="player-marker" style={{ transform: `translate(${s.x}px, ${s.y + 14}px) translate(-50%, -50%)` }} aria-label="You are here">{player.emoji}</span>;
          })()}
        </div>
      )}
      {selectedPin && (() => {
        const place = PLACES.find((p) => p.id === selectedPin.id);
        return (
          <div className="compact-detail" role="dialog" aria-label={selectedPin.name}>
            <button className="compact-detail-x" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <span className="map-pin-tile" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: tileBackground(glyphFor(selectedPin)) }}><Glyph name={glyphFor(selectedPin)} size={20} /></span>
              <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{selectedPin.name}</span>
                <span className="meta">{selectedPin.neighborhood}{place?.tier ? ` · ${place.tier}` : ""}</span>
              </span>
            </div>
            {place?.lore && <p className="subtext clamp-2" style={{ margin: 0 }}>{place.lore}</p>}
            <button className="btn btn-taxi btn-sm" onClick={() => { setSelected(null); tapPin(selectedPin); }}>Open ›</button>
          </div>
        );
      })()}
    </div>
  );
});
