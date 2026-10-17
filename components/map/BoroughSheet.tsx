"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import boroughData from "@/lib/map/boroughs.geo.json";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import { buildMapStyle, LOCKED_RED } from "@/lib/map/style";
import { Sheet } from "../Sheet";
import { PLACES, boroughOf } from "@/lib/city";
import { gateProgress, gateRule, ruleFor, type BoroughGate } from "@/lib/boroughGates";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** The borough's bounding box as [[west, south], [east, north]]. */
function bounds(id: BoroughId): [[number, number], [number, number]] | null {
  const f = (boroughData as GeoJSON.FeatureCollection).features.find((x) => x.properties?.id === id);
  if (!f || f.geometry.type !== "MultiPolygon") return null;
  const pts = f.geometry.coordinates.flat(2);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

/**
 * A small, still daytime map of one borough: real land, parks and water, the borough itself
 * undimmed inside a dashed red outline, its neighbours dimmed (v0.7, #7 and #11).
 */
function BoroughMiniMap({ id }: { id: BoroughId }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      const box = bounds(id);
      if (cancelled || !host.current || !box) return;
      maplibre.setWorkerUrl(WORKER_URL);
      const fc = boroughData as GeoJSON.FeatureCollection;
      const style = buildMapStyle("day", {
        ...fc,
        // Everything but this borough (and Queens, which is open) is dimmed, as on the main map.
        features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, locked: f.properties?.id !== id && f.properties?.id !== "queens" } })),
      });
      style.layers.push({
        id: "focus-edge", type: "line", source: "boroughs",
        filter: ["==", ["get", "id"], id],
        layout: { "line-join": "round" },
        paint: { "line-color": LOCKED_RED, "line-width": 3, "line-dasharray": [3, 2] },
      });
      map = new maplibre.Map({
        container: host.current, style, bounds: box, fitBoundsOptions: { padding: 18 },
        interactive: false, attributionControl: false, pitch: 0, fadeDuration: 0,
      });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [id]);
  return <div ref={host} className="borough-mini" role="img" aria-label={`Map of ${BOROUGHS.find((b) => b.id === id)?.name}`} />;
}

/** Tapping a locked borough: where it is, that it opens later, and Lola's teaser. */
export function BoroughSheet({ id, onClose, gate = null }: { id: BoroughId | null; onClose: () => void; gate?: BoroughGate | null }) {
  const b = BOROUGHS.find((x) => x.id === id);
  // Owner, Oct 17: the places waiting there, and how close the city is to opening it.
  const waiting = b ? PLACES.filter((p) => boroughOf(p) === b.id && !p.story) : [];
  // Owner, Oct 17: every locked borough shows its own target; progress only for the one being counted now.
  const rule = b ? ruleFor(b.id, gate ? [gate] : null) : null;
  const before = b ? BOROUGHS[BOROUGHS.findIndex((x) => x.id === b.id) - 1]?.name : undefined;
  return (
    <Sheet open={!!b} onClose={onClose} label={b ? `${b.name} is locked` : "Locked borough"}>
      {b && (
        <div className="stack-16">
          <BoroughMiniMap key={b.id} id={b.id} />
          <div>
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>{b.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>🔒 {rule ? gateRule(rule) : "Opens in a later update. Queens first."}{gate && !gate.open && gate.counting === false && before ? ` Counting starts once ${before} opens.` : ""}</p>
          </div>
          {gate && !gate.open && gate.counting !== false && (
            <div className="borough-gate">
              <div className="borough-gate-bar" role="meter" aria-label="People out right now" aria-valuemin={0} aria-valuemax={gate.target} aria-valuenow={gate.online}>
                <i style={{ width: `${Math.min(100, Math.round((gate.peakToday / gate.target) * 100))}%` }} />
              </div>
              <p className="borough-gate-line">{gateProgress(gate)}</p>
              <p className="meta" style={{ margin: 0 }}>Bring your crew out. Every player online counts.</p>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="stack-8">
              <p className="overline" style={{ margin: 0 }}>{waiting.length} places waiting</p>
              <div className="borough-places">
                {waiting.map((p) => (
                  <span key={p.id} className="borough-place">
                    <span className="map-pin-tile" aria-hidden="true" style={{ background: tileBackground(glyphFor(p)) }}><Glyph name={glyphFor(p)} size={14} /></span>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {b.teaser && (
            <div className="lola">
              <span className="lola-avatar" aria-hidden="true">💋</span>
              <p className="body" style={{ margin: 0 }}>&ldquo;{b.teaser}&rdquo;<span className="meta" style={{ display: "block", marginTop: 4 }}>Lola Lowdown</span></p>
            </div>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Back to Queens</button>
        </div>
      )}
    </Sheet>
  );
}
