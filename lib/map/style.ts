// MapLibre styles for the city map: a bright daytime look and a night look
// where the streets glow. Street data is OpenStreetMap, served as vector tiles
// (OpenMapTiles schema) by OpenFreeMap. Shops and other points of interest are
// never drawn: businesses in Clout City are invented (Clarifications section 4).

import type { StyleSpecification } from "maplibre-gl";
import { TWO_LANE_M, roadWidth, vehicleSizeExpr } from "./scale.ts";

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
    // Google Maps-style night: navy land, deep blue water, light grey roads.
    land: "#1D2C4D", water: "#0E1A33", waterDeep: "#0A1328", park: "#1E3B44", blocks: "#22345A", building: "#2A3D66", buildingTall: "#3A5287",
    minor: "#8C96AB", minorCasing: "#1A2742", major: "#B3BBCB", majorCasing: "#1A2742",
    highway: "#D7DCE5", highwayCasing: "#5E6C88", roadGlow: "rgba(0,0,0,0)", rail: "rgba(180,190,210,.45)",
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

/** The dashed outline on locked boroughs (and the borough sheet's mini-map). */
export const LOCKED_RED = "#E5283F";

export function buildMapStyle(theme: MapTheme, boroughs: GeoJSON.FeatureCollection): StyleSpecification {
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
      // Moving cars, fed by components/map/vehicles.ts when zoomed in.
      vehicles: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
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
        paint: { "line-color": p.minor, "line-width": roadWidth([[12, 0.4], [14, 2.8]], TWO_LANE_M) },
      },
      {
        id: "road-major", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", MAJOR]], NOT_TUNNEL],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.major, "line-width": roadWidth([[11, 1], [14, 4.6]], TWO_LANE_M * 1.3) },
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
      {
        // Top-down cars, SUVs, buses and motorcycles (sprites from components/map/vehicleIcons.ts).
        id: "vehicles", type: "symbol", source: "vehicles", minzoom: 15,
        layout: {
          "icon-image": ["concat", "veh-", ["get", "kind"], "-", ["to-string", ["get", "color"]], night ? "-n" : "-d"],
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-pitch-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          // Bigger than life so they read on a phone, at the same scale as the road widths.
          "icon-size": vehicleSizeExpr(),
        },
      },
      {
        // 3D buildings from OpenStreetMap heights; they rise in as you zoom to street level.
        id: "buildings-3d", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
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
