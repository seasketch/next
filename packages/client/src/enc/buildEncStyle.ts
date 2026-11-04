/* eslint-disable i18next/no-literal-string */
import { Expression, Style } from "mapbox-gl";

/**
 * Open glyphs so a chart can label soundings without a Mapbox token.
 * Fills and lines still draw if this host is unreachable.
 */
const GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

const WATER = "#c5e8f7";
const LAND = "#efe4c6";
const SHALLOW = "#d7f0c8";
const COAST = "#6b5436";

function depthColor(): Expression {
  const depth = ["to-number", ["coalesce", ["get", "DRVAL1"], 30]];
  return [
    "case",
    ["<", depth, 0],
    SHALLOW,
    ["<", depth, 2],
    "#e7f6fb",
    ["<", depth, 5],
    "#c5e6f6",
    ["<", depth, 10],
    "#9fd4ee",
    ["<", depth, 20],
    "#79c2e4",
    "#4aa3d4",
  ];
}

/**
 * A chart-style Mapbox style for an ENC PMTiles archive. `tileJsonUrl` is the
 * pmtiles-server TileJSON (`…/{uuid}.json`). Not for navigation.
 */
export function buildEncStyle(tileJsonUrl: string): Style {
  const source = "enc";
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      [source]: { type: "vector", url: tileJsonUrl },
    },
    layers: [
      {
        id: "enc-background",
        type: "background",
        paint: { "background-color": WATER },
      },
      {
        id: "enc-depth",
        type: "fill",
        source,
        "source-layer": "depth_area",
        paint: {
          "fill-color": depthColor(),
          "fill-opacity": 0.95,
        },
      },
      {
        id: "enc-land",
        type: "fill",
        source,
        "source-layer": "land",
        paint: { "fill-color": LAND },
      },
      {
        id: "enc-regulated",
        type: "fill",
        source,
        "source-layer": "regulated",
        paint: { "fill-color": "#7b4ea2", "fill-opacity": 0.18 },
      },
      {
        id: "enc-coast-fill",
        type: "fill",
        source,
        "source-layer": "coast",
        paint: { "fill-color": LAND },
      },
      {
        id: "enc-coast",
        type: "line",
        source,
        "source-layer": "coast",
        paint: { "line-color": COAST, "line-width": 1.25 },
      },
      {
        id: "enc-contour",
        type: "line",
        source,
        "source-layer": "depth_contour",
        paint: { "line-color": "#4d6d7a", "line-width": 0.7 },
      },
      {
        id: "enc-route",
        type: "line",
        source,
        "source-layer": "route",
        paint: {
          "line-color": "#c45c26",
          "line-width": 1.2,
          "line-dasharray": [2, 1.5],
        },
      },
      {
        id: "enc-hazard-area",
        type: "fill",
        source,
        "source-layer": "hazard",
        paint: { "fill-color": "#c23b4a", "fill-opacity": 0.35 },
      },
      {
        id: "enc-hazard",
        type: "circle",
        source,
        "source-layer": "hazard",
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#c23b4a",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      },
      {
        id: "enc-aid",
        type: "circle",
        source,
        "source-layer": "aid",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 5],
          "circle-color": "#e6a817",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#16324a",
        },
      },
      {
        id: "enc-sounding",
        type: "circle",
        source,
        "source-layer": "sounding",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.6],
          "circle-color": "#16324a",
        },
      },
      {
        id: "enc-sounding-label",
        type: "symbol",
        source,
        "source-layer": "sounding",
        minzoom: 12,
        layout: {
          "text-field": [
            "to-string",
            [
              "round",
              ["to-number", ["coalesce", ["get", "DEPTH"], ["get", "DRVAL1"], 0]],
            ],
          ],
          "text-font": ["Open Sans Regular"],
          "text-size": 11,
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#16324a" },
      },
      {
        id: "enc-names",
        type: "symbol",
        source,
        "source-layer": "place",
        minzoom: 8,
        layout: {
          "text-field": ["coalesce", ["get", "OBJNAM"], ""],
          "text-font": ["Open Sans Regular"],
          "text-size": 13,
        },
        paint: { "text-color": "#1d4e89", "text-halo-color": "#ffffff", "text-halo-width": 1 },
      },
    ],
  };
}

export function isEncBasemapType(type: string | null | undefined): boolean {
  return type === "ENC";
}

export function encBounds(
  basemap: { encBasemap?: { bounds?: Array<number | null> | null } | null }
): [number, number, number, number] | null {
  const bounds = basemap.encBasemap?.bounds;
  if (!bounds || bounds.length !== 4) return null;
  const numbers = bounds.map((value) =>
    typeof value === "number" ? value : Number(value)
  );
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}
