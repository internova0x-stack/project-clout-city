// MapLibre styles for the city map: a bright daytime look and a night look
// where the streets glow. Street data is OpenStreetMap, served as vector tiles
// (OpenMapTiles schema) by OpenFreeMap. Shops and other points of interest are
// never drawn: businesses in Clout City are invented (Clarifications section 4).

import type { StyleSpecification } from "maplibre-gl";
import { LANDMARKS, clearOfLandmarks, landmarkSites, type Landmark } from "./landmarks.ts";
import { TWO_LANE_M, roadWidth } from "./scale.ts";

export type MapTheme = "day" | "night";

export const TILE_SOURCE_URL = "https://tiles.openfreemap.org/planet";
export const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

interface Palette {
  land: string; water: string; waterDeep: string; park: string; blocks: string; building: string; buildingTall: string;
  minor: string; minorCasing: string; major: string; majorCasing: string; highway: string; highwayCasing: string;
  roadGlow: string; rail: string; label: string; labelHalo: string; streetLabel: string;
  locked: string; queensEdge: string;
}

export const PALETTES: Record<MapTheme, Palette> = {
  day: {
    land: "#D3EAC8", water: "#8ED3F4", waterDeep: "#6CC4EE", park: "#A7DB9C", blocks: "#DCDCDE", building: "#ECEAF0", buildingTall: "#D6D3DE",
    minor: "#FFFFFF", minorCasing: "#C4C4C8", major: "#FFFFFF", majorCasing: "#B9B9BF", highway: "#F7C744", highwayCasing: "#D9A21B",
    roadGlow: "rgba(0,0,0,0)", rail: "#A9A9B2", label: "#4F4A56", labelHalo: "rgba(255,255,255,.9)", streetLabel: "#6B6570",
    locked: "rgba(60,56,72,.42)", queensEdge: "rgba(242,169,0,.55)",
  },
  night: {
    // #10 (owner, Oct 14): "earth at night". The dark of a satellite photo (near-black land, black
    // water), streets in warm sodium amber (brighter on avenues and highways), dark buildings.
    land: "#06080F", water: "#010309", waterDeep: "rgba(255,190,110,.10)", park: "#070C0C", blocks: "#0A0D17", building: "#141621", buildingTall: "#272436",
    minor: "#B8732A", minorCasing: "rgba(0,0,0,0)", major: "#FFB347", majorCasing: "rgba(255,140,30,.25)",
    highway: "#FFE0A3", highwayCasing: "rgba(255,170,60,.35)", roadGlow: "rgba(255,160,50,.30)", rail: "rgba(120,180,255,.35)",
    label: "#B8C6E0", labelHalo: "rgba(14,26,51,.9)", streetLabel: "#C9D1E0",
    locked: "rgba(8,12,24,.62)", queensEdge: "rgba(255,194,26,.5)",
  },
};

// Service alleys and tracks are left out: in New York many run through building
// passages and parking garages, so with 3D buildings they look like roads going
// under buildings. Tunnels are left out for the same reason.
const MINOR = ["minor"];
const NOT_TUNNEL = ["!=", ["get", "brunnel"], "tunnel"];
const BRIDGE = ["==", ["get", "brunnel"], "bridge"];
const MAJOR = ["primary", "secondary", "tertiary", "trunk"];

/** Line widths in pixels by zoom, so streets thicken as you zoom in like a street map. */
const width = (z12: number, z15: number, z18: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 12, z12, 15, z15, 18, z18] as unknown as number;

/** A wide, blurred amber line under a class of streets: the night map's city glow. */
function haze(id: string, classes: string[], w: [number, number, number], alpha: number): StyleSpecification["layers"][number] {
  const size = ["interpolate", ["exponential", 1.6], ["zoom"], 11, w[0], 14, w[1], 17, w[2]] as unknown as number;
  return {
    id, type: "line", source: "osm", "source-layer": "transportation",
    filter: ["all", ["in", ["get", "class"], ["literal", classes]], NOT_TUNNEL],
    paint: { "line-color": `rgba(255,150,45,${alpha})`, "line-width": size, "line-blur": size },
  } as unknown as StyleSpecification["layers"][number];
}

/** The dashed outline on locked boroughs (and the borough sheet's mini-map). */
export const LOCKED_RED = "#E5283F";

export function buildMapStyle(theme: MapTheme, boroughs: GeoJSON.FeatureCollection, landmarks: readonly Landmark[] = LANDMARKS): StyleSpecification {
  const p = PALETTES[theme];
  const night = theme === "night";
  return {
    version: 8,
    name: `clout-city-${theme}`,
    glyphs: GLYPHS_URL,
    transition: { duration: 2000, delay: 0 },
    light: { anchor: "viewport", color: night ? "#C9D6FF" : "#FFFFFF", intensity: night ? 0.25 : 0.4, position: [1.2, 200, 35] },
    sources: {
      osm: { type: "vector", url: TILE_SOURCE_URL, attribution: MAP_ATTRIBUTION },
      boroughs: { type: "geojson", data: boroughs },
      "landmark-sites": { type: "geojson", data: landmarkSites(landmarks) },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": p.land } },
      {
        id: "landuse-blocks", type: "fill", source: "osm", "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "industrial", "retail", "railway", "school", "hospital", "university", "college"]]],
        paint: { "fill-color": p.blocks },
      },
      {
        id: "parks", type: "fill", source: "osm", "source-layer": "park",
        paint: { "fill-color": p.park },
      },
      {
        id: "landcover-green", type: "fill", source: "osm", "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland", "wetland"]]],
        paint: { "fill-color": p.park, "fill-opacity": 0.85 },
      },
      {
        id: "water", type: "fill", source: "osm", "source-layer": "water",
        paint: { "fill-color": p.water },
      },
      {
        id: "water-edge", type: "line", source: "osm", "source-layer": "water",
        paint: { "line-color": p.waterDeep, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0, 14, 2], "line-blur": 2 },
      },
      // Road glow (night only): a soft, wide halo under the main streets.
      {
        id: "road-glow", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", ["motorway", ...MAJOR]]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.roadGlow, "line-width": roadWidth([[12, 4], [14, 12]], TWO_LANE_M * 2.2), "line-blur": width(3, 10, 24) },
      },
      // City haze (night only): every street adds a wide, faint glow, so dense blocks add up to a
      // bright core, like a city photographed from orbit.
      ...(night ? [haze("city-haze-minor", ["minor", "service"], [8, 30, 100], 0.07), haze("city-haze-major", ["motorway", ...MAJOR], [16, 60, 200], 0.18)] : []),
      {
        id: "road-minor-casing", type: "line", source: "osm", "source-layer": "transportation", minzoom: 14,
        filter: ["all", ["in", ["get", "class"], ["literal", MINOR]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.minorCasing, "line-width": roadWidth([[12, 0.5], [14, 3.6]], TWO_LANE_M + 1.2) },
      },
      {
        id: "road-major-casing", type: "line", source: "osm", "source-layer": "transportation", minzoom: 11,
        filter: ["all", ["in", ["get", "class"], ["literal", MAJOR]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.majorCasing, "line-width": roadWidth([[11, 1.5], [14, 5.6]], TWO_LANE_M * 1.3 + 1.2) },
      },
      {
        id: "road-minor", type: "line", source: "osm", "source-layer": "transportation", minzoom: 12,
        filter: ["all", ["in", ["get", "class"], ["literal", MINOR]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: night
          ? { "line-color": p.minor, "line-width": width(0.3, 1.6, 6), "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.35, 15, 0.45, 17, 0.6] as unknown as number }
          : { "line-color": p.minor, "line-width": roadWidth([[12, 0.4], [14, 2.8]], TWO_LANE_M) },
      },
      {
        id: "road-major", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", MAJOR]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.major, "line-width": night ? (["interpolate", ["exponential", 1.6], ["zoom"], 11, 0.8, 15, 3, 18, 12] as unknown as number) : roadWidth([[11, 1], [14, 4.6]], TWO_LANE_M * 1.3) },
      },
      {
        id: "rail", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
        paint: { "line-color": p.rail, "line-width": width(0.8, 1.6, 3), "line-dasharray": [2, 2] },
      },
      {
        id: "highway-casing", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["all", ["==", ["get", "class"], "motorway"], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.highwayCasing, "line-width": roadWidth([[10, 2], [14, 8]], TWO_LANE_M * 1.6 + 1.2) },
      },
      {
        id: "highway", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["all", ["==", ["get", "class"], "motorway"], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.highway, "line-width": roadWidth([[10, 1.4], [14, 6.5]], TWO_LANE_M * 1.6) },
      },
      // Landmark sites cover the streets under a landmark, merging the blocks (lib/map/landmarks.ts).
      {
        id: "landmark-sites", type: "fill", source: "landmark-sites",
        paint: { "fill-color": ["match", ["get", "ground"], "park", p.park, p.blocks] as unknown as string },
      },
      {
        id: "landmark-sites-edge", type: "line", source: "landmark-sites",
        paint: { "line-color": night ? "rgba(255,179,71,.18)" : "rgba(255,255,255,.85)", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 17, 3] as unknown as number },
      },
      {
        // 3D buildings from OpenStreetMap heights; they rise in as you zoom to street level.
        id: "buildings-3d", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 13,
        // Landmark models (components/map/landmarkLayer.ts) replace the blocks they stand on.
        filter: ["all", ["!=", ["get", "hide_3d"], true], clearOfLandmarks(landmarks)],
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 10], 0, p.building, 80, p.buildingTall,
          ] as unknown as string,
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 9],
          ] as unknown as number,
          "fill-extrusion-base": [
            "interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_min_height"], 0],
          ] as unknown as number,
          "fill-extrusion-opacity": night ? 0.92 : 0.96,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      // Bridges and elevated highways are drawn again above the 3D buildings, so
      // nothing appears to pass under a building.
      {
        id: "bridge-casing", type: "line", source: "osm", "source-layer": "transportation", minzoom: 13,
        filter: ["all", ["in", ["get", "class"], ["literal", ["motorway", ...MAJOR]]], BRIDGE],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": p.highwayCasing, "line-width": roadWidth([[13, 3], [14, 8]], TWO_LANE_M * 1.6 + 1.2) },
      },
      {
        id: "bridge", type: "line", source: "osm", "source-layer": "transportation", minzoom: 13,
        filter: ["all", ["in", ["get", "class"], ["literal", ["motorway", ...MAJOR]]], BRIDGE],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": ["case", ["==", ["get", "class"], "motorway"], p.highway, p.major] as unknown as string,
          "line-width": roadWidth([[13, 2], [14, 6.5]], TWO_LANE_M * 1.6),
        },
      },
      // Locked boroughs: dimmed under a dashed red outline (v0.7, #7). Hazard stripes are only for closures.
      {
        id: "borough-locked", type: "fill", source: "boroughs",
        filter: ["==", ["get", "locked"], true],
        paint: { "fill-color": p.locked },
      },
      {
        id: "borough-locked-edge", type: "line", source: "boroughs",
        filter: ["==", ["get", "locked"], true],
        layout: { "line-join": "round" },
        paint: { "line-color": LOCKED_RED, "line-width": 2.5, "line-dasharray": [3, 2], "line-opacity": 0.95 },
      },
      {
        id: "queens-edge", type: "line", source: "boroughs",
        filter: ["==", ["get", "id"], "queens"],
        paint: { "line-color": p.queensEdge, "line-width": 2, "line-blur": 1 },
      },
      {
        id: "street-names", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 15,
        layout: {
          "symbol-placement": "line", "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 15, 10, 18, 13],
        },
        paint: { "text-color": p.streetLabel, "text-halo-color": p.labelHalo, "text-halo-width": 1.2 },
      },
      {
        id: "neighborhoods", type: "symbol", source: "osm", "source-layer": "place", minzoom: 11.5, maxzoom: 16.5,
        filter: ["in", ["get", "class"], ["literal", ["neighbourhood", "suburb", "quarter"]]],
        layout: {
          "text-field": ["upcase", ["coalesce", ["get", "name:en"], ["get", "name"]]],
          "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 15, 13],
          "text-letter-spacing": 0.12, "text-max-width": 8,
        },
        paint: { "text-color": p.label, "text-halo-color": p.labelHalo, "text-halo-width": 1.4 },
      },
    ],
  } as StyleSpecification;
}
