// MapLibre styles for the city map: a bright daytime look and a night look
// where the streets glow. Street data is OpenStreetMap, served as vector tiles
// (OpenMapTiles schema) by OpenFreeMap. Shops and other points of interest are
// never drawn: businesses in Clout City are invented (Clarifications section 4).

import type { StyleSpecification } from "maplibre-gl";

export type MapTheme = "day" | "night";

export const TILE_SOURCE_URL = "https://tiles.openfreemap.org/planet";
export const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

interface Palette {
  land: string; water: string; waterDeep: string; park: string; blocks: string; building: string;
  minor: string; minorCasing: string; major: string; majorCasing: string; highway: string; highwayCasing: string;
  roadGlow: string; rail: string; label: string; labelHalo: string; streetLabel: string;
  locked: string; queensEdge: string;
}

export const PALETTES: Record<MapTheme, Palette> = {
  day: {
    land: "#D3EAC8", water: "#8ED3F4", waterDeep: "#6CC4EE", park: "#A7DB9C", blocks: "#DCDCDE", building: "#C9C9CF",
    minor: "#FFFFFF", minorCasing: "#C4C4C8", major: "#FFFFFF", majorCasing: "#B9B9BF", highway: "#F7C744", highwayCasing: "#D9A21B",
    roadGlow: "rgba(0,0,0,0)", rail: "#A9A9B2", label: "#4F4A56", labelHalo: "rgba(255,255,255,.9)", streetLabel: "#6B6570",
    locked: "rgba(60,56,72,.42)", queensEdge: "rgba(242,169,0,.55)",
  },
  night: {
    land: "#1C1824", water: "#0E1020", waterDeep: "#0A0C18", park: "#1F2A24", blocks: "#221E2B", building: "#2B2535",
    minor: "rgba(255,194,26,.38)", minorCasing: "rgba(0,0,0,0)", major: "rgba(255,194,26,.75)", majorCasing: "rgba(0,0,0,0)",
    highway: "#FFC21A", highwayCasing: "rgba(0,0,0,0)", roadGlow: "rgba(255,170,40,.35)", rail: "rgba(255,46,136,.6)",
    label: "rgba(255,246,224,.72)", labelHalo: "rgba(20,17,26,.85)", streetLabel: "rgba(255,246,224,.55)",
    locked: "rgba(10,8,14,.62)", queensEdge: "rgba(255,194,26,.5)",
  },
};

const MINOR = ["minor", "service", "track"];
const MAJOR = ["primary", "secondary", "tertiary", "trunk"];

/** Line widths in pixels by zoom, so streets thicken as you zoom in like a street map. */
const width = (z12: number, z15: number, z18: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 12, z12, 15, z15, 18, z18] as unknown as number;

export function buildMapStyle(theme: MapTheme, boroughs: GeoJSON.FeatureCollection): StyleSpecification {
  const p = PALETTES[theme];
  const night = theme === "night";
  return {
    version: 8,
    name: `clout-city-${theme}`,
    glyphs: GLYPHS_URL,
    transition: { duration: 2000, delay: 0 },
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
      {
        id: "buildings", type: "fill", source: "osm", "source-layer": "building", minzoom: 14,
        paint: {
          "fill-color": p.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 1],
          "fill-outline-color": night ? "rgba(255,194,26,.12)" : "#B4B4BA",
        },
      },
      // Road glow (night only): a soft, wide halo under the main streets.
      {
        id: "road-glow", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", ...MAJOR]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.roadGlow, "line-width": width(4, 14, 40), "line-blur": width(3, 10, 24) },
      },
      {
        id: "road-minor-casing", type: "line", source: "osm", "source-layer": "transportation", minzoom: 14,
        filter: ["in", ["get", "class"], ["literal", MINOR]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.minorCasing, "line-width": width(0.5, 4, 22) },
      },
      {
        id: "road-major-casing", type: "line", source: "osm", "source-layer": "transportation", minzoom: 11,
        filter: ["in", ["get", "class"], ["literal", MAJOR]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.majorCasing, "line-width": width(1.5, 7, 30) },
      },
      {
        id: "road-minor", type: "line", source: "osm", "source-layer": "transportation", minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", MINOR]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.minor, "line-width": width(0.4, 2.8, 18) },
      },
      {
        id: "road-major", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", MAJOR]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.major, "line-width": width(1, 5, 26) },
      },
      {
        id: "rail", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
        paint: { "line-color": p.rail, "line-width": width(0.8, 1.6, 3), "line-dasharray": [2, 2] },
      },
      {
        id: "highway-casing", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["==", ["get", "class"], "motorway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.highwayCasing, "line-width": width(3, 9, 34) },
      },
      {
        id: "highway", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["==", ["get", "class"], "motorway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.highway, "line-width": width(2, 6.5, 28) },
      },
      // Locked boroughs: dimmed, with a hazard-striped edge (C19).
      {
        id: "borough-locked", type: "fill", source: "boroughs",
        filter: ["==", ["get", "locked"], true],
        paint: { "fill-color": p.locked },
      },
      {
        id: "borough-hazard-yellow", type: "line", source: "boroughs",
        filter: ["==", ["get", "locked"], true],
        paint: { "line-color": "#FFC21A", "line-width": 5, "line-opacity": 0.9 },
      },
      {
        id: "borough-hazard-black", type: "line", source: "boroughs",
        filter: ["==", ["get", "locked"], true],
        paint: { "line-color": "#14111A", "line-width": 5, "line-dasharray": [1, 1], "line-opacity": 0.9 },
      },
      {
        id: "queens-edge", type: "line", source: "boroughs",
        filter: ["==", ["get", "id"], "queens"],
        paint: { "line-color": p.queensEdge, "line-width": 2, "line-blur": 1 },
      },
      ...(night
        ? [
            {
              id: "vehicle-glow", type: "circle", source: "vehicles", minzoom: 15,
              paint: { "circle-color": "#FFE9A8", "circle-radius": width(4, 6, 12), "circle-blur": 1, "circle-opacity": 0.45 },
            },
            {
              id: "vehicles", type: "circle", source: "vehicles", minzoom: 15,
              paint: { "circle-color": "#FFF8E1", "circle-radius": width(1.5, 2.2, 4), "circle-stroke-width": 0 },
            },
          ]
        : [
            {
              id: "vehicles", type: "circle", source: "vehicles", minzoom: 15,
              paint: {
                "circle-color": ["get", "color"], "circle-radius": width(2, 3, 6),
                "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 1,
              },
            },
          ]),
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
