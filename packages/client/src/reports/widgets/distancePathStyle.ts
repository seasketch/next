import { FeatureCollection, LineString, Point } from "geojson";
import { AnyLayer, AnySourceData, Expression } from "mapbox-gl";
import { ReportMapStyle } from "../reportUtils";

type DistancePathBasemap = "light" | "streets" | "satellite";

export const DISTANCE_PATH_SOURCE_ID = "distance-path";
export const DISTANCE_PATH_SKETCH_SOURCE_ID = "distance-path-sketch";

const PATH_COLOR = "#2563eb";
export const DEFAULT_SHORELINE_OVERLAP_COLOR = "#f97316";
const ORIGIN_COLOR = "#0f172a";
const DEST_COLOR = "#dc2626";
const SATELLITE_SKETCH_COLOR = "#ffffff";

const PATH_LINE_COLOR: Expression = [
  "match",
  ["get", "rank"],
  1,
  "#7c3aed",
  2,
  "#0f766e",
  3,
  "#b45309",
  PATH_COLOR,
];

/**
 * The same sources and layers the small report map draws, so the project map
 * can show them through `useReportStyleToggle`.
 */
export function shorelineOverlapColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : DEFAULT_SHORELINE_OVERLAP_COLOR;
}

export function distancePathReportStyle(args: {
  collection: FeatureCollection<LineString | Point>;
  sketchGeojsonUrl?: string | null;
  basemap?: DistancePathBasemap;
  shorelineColor?: string;
}): ReportMapStyle {
  const shorelineColor = shorelineOverlapColor(args.shorelineColor);
  const basemap = args.basemap ?? "streets";
  const sketchColor =
    basemap === "satellite" ? SATELLITE_SKETCH_COLOR : ORIGIN_COLOR;
  const sources: { [id: string]: AnySourceData } = {
    [DISTANCE_PATH_SOURCE_ID]: {
      type: "geojson",
      data: args.collection,
    },
  };
  const layers: AnyLayer[] = [];

  if (args.sketchGeojsonUrl) {
    sources[DISTANCE_PATH_SKETCH_SOURCE_ID] = {
      type: "geojson",
      data: args.sketchGeojsonUrl,
    };
    layers.push(
      {
        id: "distance-path-sketch-fill",
        type: "fill",
        source: DISTANCE_PATH_SKETCH_SOURCE_ID,
        filter: [
          "match",
          ["geometry-type"],
          ["Polygon", "MultiPolygon"],
          true,
          false,
        ],
        paint: {
          "fill-color": sketchColor,
          "fill-opacity": basemap === "satellite" ? 0.18 : 0.15,
        },
      },
      {
        id: "distance-path-sketch-line",
        type: "line",
        source: DISTANCE_PATH_SKETCH_SOURCE_ID,
        paint: {
          "line-color": sketchColor,
          "line-width": basemap === "satellite" ? 2 : 1.5,
          "line-opacity": basemap === "satellite" ? 0.95 : 0.85,
        },
      }
    );
  }

  layers.push(
    {
      id: "distance-path-casing",
      type: "line",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "path"],
      paint: {
        "line-color": "#ffffff",
        "line-width": 6,
        "line-opacity": 0.95,
      },
    },
    {
      id: "distance-path",
      type: "line",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "path"],
      paint: {
        "line-color": PATH_LINE_COLOR,
        "line-width": 3,
      },
    },
    {
      id: "distance-path-distance",
      type: "symbol",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: [
        "all",
        ["==", ["get", "kind"], "path"],
        ["!=", ["get", "distance"], ""],
      ],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 220,
        "text-field": ["get", "distance"],
        "text-size": 11,
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "viewport",
        "text-max-angle": 45,
        "text-padding": 2,
        "text-optional": true,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: {
        "text-color": PATH_LINE_COLOR,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
      },
    },
    {
      id: "distance-path-origin",
      type: "circle",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "origin"],
      paint: {
        "circle-radius": 5,
        "circle-color": ORIGIN_COLOR,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    },
    {
      id: "distance-path-dest",
      type: "circle",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "destination"],
      paint: {
        "circle-radius": 5,
        "circle-color": DEST_COLOR,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    },
    {
      id: "distance-path-label",
      type: "symbol",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "destination"],
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, 0.85],
        "text-anchor": "top",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-optional": true,
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    },
    {
      id: "distance-path-shoreline-halo",
      type: "line",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "shoreline"],
      paint: {
        "line-color": "#ffffff",
        "line-width": 9,
        "line-opacity": 1,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    },
    {
      id: "distance-path-shoreline",
      type: "line",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "shoreline"],
      paint: {
        "line-color": shorelineColor,
        "line-width": 5,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    },
    {
      id: "distance-path-shoreline-label",
      type: "symbol",
      source: DISTANCE_PATH_SOURCE_ID,
      filter: ["==", ["get", "kind"], "shoreline-label"],
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-max-width": 16,
        "text-offset": [0, -1.1],
        "text-anchor": "bottom",
        "text-justify": "center",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-optional": false,
      },
      paint: {
        "text-color": shorelineColor,
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    }
  );

  return { sources, layers };
}
