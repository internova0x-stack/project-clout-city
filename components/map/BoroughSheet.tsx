"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import boroughData from "@/lib/map/boroughs.geo.json";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import { buildMapStyle, LOCKED_RED } from "@/lib/map/style";
import { Sheet } from "../Sheet";

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
export function BoroughSheet({ id, onClose }: { id: BoroughId | null; onClose: () => void }) {
  const b = BOROUGHS.find((x) => x.id === id);
  return (
    <Sheet open={!!b} onClose={onClose} label={b ? `${b.name} is locked` : "Locked borough"}>
      {b && (
        <div className="stack-16">
          <BoroughMiniMap key={b.id} id={b.id} />
          <div>
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>{b.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>🔒 Opens in a later update. Queens first.</p>
          </div>
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
