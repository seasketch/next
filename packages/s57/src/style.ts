/**
 * S-52 DAY_BRIGHT colours from the OpenCPN chart symbol library.
 * Shallow water is the saturated blue. Deep water is the pale wash.
 * Marks are original drawings of the IALA-B shapes, served as a sprite.
 */
const DEPDW = "#d4eaee";
const DEPMD = "#bad5e1";
const DEPMS = "#98c5f2";
const DEPVS = "#73b6ef";
const DEPIT = "#83b295";
const NODTA = "#a3b4b7";
const LANDA = "#c9b97a";
const CSTLN = "#3e4749";
const CHBLK = "#121212";
const CHGRD = "#5c686b";
const DEPSC = "#3e4749";
const CHMGD = "#c545c3";
const PAPER = "#f4f7f4";

const GLYPHS = "/s57/font/{fontstack}/{range}.pbf";
const ITALIC = ["Open Sans Italic"];
const ROMAN = ["Open Sans Regular"];

type Expr = unknown[];

function depthMetres(): Expr {
  return ["to-number", ["coalesce", ["get", "DRVAL1"], 30]];
}

/**
 * Harbour charts step at 2, 5 and 10 m. Coastal charts step at the fathom
 * lines (about 18, 37, 55, 91 m), so those shelves have to stay visible or
 * the zoomed-out coast is the same colour as empty water.
 */
function depthColor(): Expr {
  const depth = depthMetres();
  return [
    "case",
    ["==", ["get", "obj"], "UNSARE"],
    NODTA,
    ["<", depth, 0],
    DEPIT,
    ["<", depth, 2],
    DEPVS,
    ["<", depth, 5],
    DEPMS,
    ["<", depth, 10],
    DEPMD,
    ["<", depth, 20],
    "#b4d3e3",
    ["<", depth, 50],
    "#c3dce6",
    ["<", depth, 100],
    "#cde4eb",
    DEPDW,
  ];
}

function soundingMetres(): Expr {
  return ["to-number", ["coalesce", ["get", "DEPTH"], ["get", "DRVAL1"], 0]];
}

function soundingColour(): Expr {
  return ["case", ["<", soundingMetres(), 5], CHBLK, CHGRD];
}

/** Whole metres, with the tenth as a smaller figure on the baseline. */
function soundingText(): Expr {
  const depth = soundingMetres();
  const abs = ["abs", depth];
  const whole = ["to-string", ["floor", abs]];
  const tenth = ["to-string", ["round", ["*", ["-", abs, ["floor", abs]], 10]]];
  const showTenth = ["all", ["<", abs, 31], ["!=", tenth, "0"]];
  return [
    "format",
    whole,
    {},
    ["case", showTenth, tenth, ""],
    { "font-scale": 0.62, "vertical-align": "bottom" },
  ];
}

function lightText(): Expr {
  const characteristic = [
    "match",
    ["to-number", ["coalesce", ["get", "LITCHR"], 0]],
    1, "F",
    2, "Fl",
    3, "LFl",
    4, "Q",
    5, "VQ",
    6, "UQ",
    7, "Iso",
    8, "Oc",
    9, "IQ",
    12, "Mo",
    13, "FFl",
    25, "Al",
    "Lt",
  ];
  const colour = [
    "match",
    ["to-number", ["coalesce", ["get", "colour"], 0]],
    1, " W",
    3, " R",
    4, " G",
    5, " Bu",
    6, " Y",
    11, " Y",
    "",
  ];
  const group = [
    "case",
    ["==", ["to-string", ["coalesce", ["get", "SIGGRP"], ""]], ""],
    "",
    ["concat", " ", ["to-string", ["get", "SIGGRP"]]],
  ];
  const period = ["to-number", ["coalesce", ["get", "SIGPER"], 0]];
  const timing = [
    "case",
    [">", period, 0],
    ["concat", " ", ["to-string", ["round", period]], "s"],
    "",
  ];
  return ["concat", characteristic, group, colour, timing];
}

function contourText(): Expr {
  const value = ["to-number", ["coalesce", ["get", "VALDCO"], 0]];
  const rounded = ["round", value];
  return [
    "case",
    ["<", ["abs", ["-", value, rounded]], 0.05],
    ["to-string", rounded],
    ["to-string", value],
  ];
}

const obj = ["coalesce", ["get", "obj"], ""] as Expr;
const beacon = ["==", ["slice", obj, 0, 3], "BCN"] as Expr;

/** IALA-B mark: cans to port, cones to starboard, cardinals by CATCAM. */
function aidIcon(): Expr {
  const cardinal = [
    "match",
    ["to-number", ["coalesce", ["get", "CATCAM"], 0]],
    1, "buoy-north",
    2, "buoy-east",
    3, "buoy-south",
    4, "buoy-west",
    "buoy-north",
  ];
  const daymark = [
    "match",
    ["to-number", ["coalesce", ["get", "colour"], 0]],
    3, "daymark-red",
    4, "daymark-green",
    6, "daymark-yellow",
    1, "daymark",
    "daymark",
  ];
  return [
    "case",
    ["==", ["get", "mark"], "port"],
    ["case", beacon, "beacon-port", "buoy-port"],
    ["==", ["get", "mark"], "starboard"],
    ["case", beacon, "beacon-stbd", "buoy-stbd"],
    ["==", ["get", "mark"], "special"],
    ["case", beacon, "beacon-special", "buoy-special"],
    ["==", ["get", "mark"], "safe"],
    "buoy-safe",
    ["==", ["get", "mark"], "isolated"],
    "buoy-isolated",
    ["==", ["get", "mark"], "cardinal"],
    cardinal,
    ["==", ["get", "mark"], "daymark"],
    daymark,
    "light",
  ];
}

function hazardIcon(): Expr {
  const awash = [
    "any",
    ["==", ["to-number", ["get", "WATLEV"], -1], 4],
    ["==", ["to-number", ["get", "WATLEV"], -1], 5],
    ["==", ["to-number", ["coalesce", ["get", "VALSOU"], 99]], 0],
  ];
  return [
    "match",
    obj,
    "WRECKS", "wreck",
    "OBSTRN", "obstruction",
    ["case", awash, "rock-awash", "rock"],
  ];
}

export type S57VectorSource =
  | string
  | {
      tiles: string[];
      bounds?: number[];
      minzoom?: number;
      maxzoom?: number;
    };

export type S57StyleOptions = {
  /** Sprite URL without an extension. Defaults to the sheet shipped with the package. */
  sprite?: string;
};

/**
 * Mapbox GL style for an S-57 chart. Pass a TileJSON url, or a vector-tile
 * template such as the demo's `/tiles/{z}/{x}/{y}.mvt`. Not for navigation.
 */
export function buildS57Style(
  source: S57VectorSource,
  options?: S57StyleOptions
): Record<string, unknown> {
  const vector =
    typeof source === "string"
      ? { type: "vector", url: source }
      : {
          type: "vector",
          tiles: source.tiles,
          minzoom: source.minzoom == null ? 0 : source.minzoom,
          maxzoom: source.maxzoom == null ? 16 : source.maxzoom,
          ...(source.bounds ? { bounds: source.bounds } : {}),
        };
  const id = "s57";
  const point = ["==", ["geometry-type"], "Point"];
  const contour = ["to-number", ["coalesce", ["get", "VALDCO"], -1]];
  const named = ["!=", ["coalesce", ["get", "OBJNAM"], ""], ""];
  return {
    version: 8,
    glyphs: GLYPHS,
    // Must be an absolute URL. Mapbox's sprite loader rejects a root-relative path.
    sprite: options?.sprite || "/s57/sprite",
    sources: { [id]: vector },
    layers: [
      { id: "s57-background", type: "background", paint: { "background-color": DEPDW } },
      {
        id: "s57-depth",
        type: "fill",
        source: id,
        "source-layer": "depth_area",
        paint: { "fill-color": depthColor() },
      },
      {
        id: "s57-land",
        type: "fill",
        source: id,
        "source-layer": "land",
        filter: ["!=", ["geometry-type"], "Point"],
        paint: { "fill-color": LANDA },
      },
      {
        id: "s57-built",
        type: "fill",
        source: id,
        "source-layer": "land",
        filter: ["==", obj, "BUAARE"],
        paint: { "fill-color": "#b7a56a" },
      },
      {
        id: "s57-inland",
        type: "fill",
        source: id,
        "source-layer": "inland_water",
        paint: { "fill-color": DEPMS },
      },
      {
        id: "s57-coast-fill",
        type: "fill",
        source: id,
        "source-layer": "coast",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": LANDA },
      },
      {
        id: "s57-separation-fill",
        type: "fill",
        source: id,
        "source-layer": "separation",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": CHMGD, "fill-opacity": 0.1 },
      },
      {
        id: "s57-dredged",
        type: "line",
        source: id,
        "source-layer": "depth_area",
        filter: ["==", obj, "DRGARE"],
        paint: { "line-color": CHBLK, "line-width": 0.7, "line-dasharray": [2, 1] },
      },
      {
        id: "s57-contour",
        type: "line",
        source: id,
        "source-layer": "depth_contour",
        filter: ["!=", contour, 0],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": [
            "case",
            ["any", ["==", contour, 2], ["==", contour, 5], ["==", contour, 10], ["==", contour, 20]],
            DEPSC,
            CHGRD,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            ["case", ["==", contour, 5], 1.15, ["any", ["==", contour, 2], ["==", contour, 10], ["==", contour, 20]], 0.8, 0.35],
            14,
            ["case", ["==", contour, 5], 1.8, ["any", ["==", contour, 2], ["==", contour, 10], ["==", contour, 20]], 1.25, 0.6],
          ],
        },
      },
      {
        id: "s57-contour-label",
        type: "symbol",
        source: id,
        "source-layer": "depth_contour",
        minzoom: 10,
        filter: ["all", ["!=", contour, 0], ["!=", ["geometry-type"], "Point"]],
        layout: {
          "symbol-placement": "line",
          "text-field": contourText(),
          "text-font": ITALIC,
          "text-size": 12,
          "symbol-spacing": 280,
          "text-max-angle": 35,
        },
        paint: {
          "text-color": DEPSC,
          "text-halo-color": PAPER,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "s57-structure",
        type: "line",
        source: id,
        "source-layer": "structure",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": CHBLK, "line-width": 1.3 },
      },
      {
        id: "s57-coast",
        type: "line",
        source: id,
        "source-layer": "coast",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["case", ["==", obj, "SLCONS"], CHBLK, CSTLN],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["case", ["==", obj, "SLCONS"], 0.8, 0.7],
            13,
            ["case", ["==", obj, "SLCONS"], 1.7, 1.35],
          ],
        },
      },
      {
        id: "s57-separation",
        type: "line",
        source: id,
        "source-layer": "separation",
        layout: { "line-join": "round", "line-cap": "butt" },
        paint: { "line-color": CHMGD, "line-width": 1.35, "line-dasharray": [5, 2] },
      },
      {
        id: "s57-regulated",
        type: "line",
        source: id,
        "source-layer": "regulated",
        minzoom: 9,
        paint: { "line-color": CHMGD, "line-width": 1.25, "line-dasharray": [3, 2] },
      },
      {
        id: "s57-cable",
        type: "line",
        source: id,
        "source-layer": "cable",
        minzoom: 11,
        paint: { "line-color": CHMGD, "line-width": 1.15, "line-dasharray": [8, 3] },
      },
      {
        id: "s57-mooring-line",
        type: "line",
        source: id,
        "source-layer": "mooring",
        filter: ["!=", ["geometry-type"], "Point"],
        minzoom: 13,
        paint: { "line-color": CHBLK, "line-width": 1, "line-dasharray": [1, 1] },
      },
      {
        id: "s57-route",
        type: "line",
        source: id,
        "source-layer": "route",
        minzoom: 11,
        paint: { "line-color": CHBLK, "line-width": 1.05, "line-dasharray": [6, 3] },
      },
      {
        id: "s57-hazard-area",
        type: "line",
        source: id,
        "source-layer": "hazard",
        filter: ["!=", ["geometry-type"], "Point"],
        minzoom: 11,
        paint: { "line-color": CHMGD, "line-width": 1.15, "line-dasharray": [1, 1] },
      },
      {
        id: "s57-sea-name",
        type: "symbol",
        source: id,
        "source-layer": "place",
        minzoom: 7,
        filter: ["all", named, ["in", obj, ["literal", ["SEAARE", "LNDRGN"]]]],
        layout: {
          "text-field": ["get", "OBJNAM"],
          "text-font": ITALIC,
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 12, 12, 18],
          "text-max-width": 8,
          "text-padding": 8,
        },
        paint: {
          "text-color": ["case", ["==", obj, "LNDRGN"], CHBLK, "#2c3d44"],
          "text-halo-color": ["case", ["==", obj, "LNDRGN"], "#f3ecd4", PAPER],
          "text-halo-width": 1.4,
        },
      },
      {
        id: "s57-islet",
        type: "circle",
        source: id,
        "source-layer": "land",
        filter: point,
        minzoom: 11,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 1.6, 15, 3.2],
          "circle-color": LANDA,
          "circle-stroke-width": 1,
          "circle-stroke-color": CSTLN,
        },
      },
      {
        id: "s57-hazard",
        type: "symbol",
        source: id,
        "source-layer": "hazard",
        minzoom: 12,
        filter: point,
        layout: {
          "icon-image": hazardIcon(),
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.38, 15, 0.62],
          "icon-allow-overlap": false,
          "icon-padding": 1,
        },
      },
      {
        id: "s57-pile",
        type: "circle",
        source: id,
        "source-layer": "pile",
        minzoom: 14,
        filter: point,
        paint: { "circle-radius": 1.7, "circle-color": CHBLK },
      },
      {
        id: "s57-mooring",
        type: "symbol",
        source: id,
        "source-layer": "mooring",
        minzoom: 13,
        filter: point,
        layout: {
          "icon-image": "mooring",
          "icon-size": 0.55,
          "icon-allow-overlap": true,
        },
      },
      {
        id: "s57-platform",
        type: "symbol",
        source: id,
        "source-layer": "platform",
        minzoom: 8,
        filter: point,
        layout: {
          "icon-image": "platform",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.42, 13, 0.72],
          "icon-allow-overlap": true,
          "text-field": ["step", ["zoom"], "", 11, ["coalesce", ["get", "OBJNAM"], ""]],
          "text-font": ROMAN,
          "text-size": 11,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": CHBLK,
          "text-halo-color": PAPER,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "s57-platform-area",
        type: "fill",
        source: id,
        "source-layer": "platform",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#4a4030", "fill-outline-color": CHBLK },
      },
      {
        id: "s57-aid",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        filter: ["all", point, ["!=", ["get", "mark"], "light"], ["!=", ["get", "mark"], "fog"]],
        layout: {
          "icon-image": aidIcon(),
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.42, 13, 0.7, 16, 0.86],
          "icon-allow-overlap": true,
        },
      },
      {
        id: "s57-light",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        filter: ["all", point, ["==", ["get", "mark"], "light"]],
        layout: {
          "icon-image": "light",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 0.62],
          "icon-allow-overlap": true,
          "text-field": ["step", ["zoom"], "", 13, lightText()],
          "text-font": ROMAN,
          "text-size": 11,
          "text-offset": [0.9, -0.85],
          "text-anchor": "left",
          "text-optional": true,
        },
        paint: {
          "text-color": CHBLK,
          "text-halo-color": PAPER,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "s57-fog",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        minzoom: 14,
        filter: ["all", point, ["==", ["get", "mark"], "fog"]],
        layout: {
          "text-field": "Fog Sig",
          "text-font": ROMAN,
          "text-size": 10,
          "text-offset": [0, 0.8],
        },
        paint: {
          "text-color": CHGRD,
          "text-halo-color": PAPER,
          "text-halo-width": 1,
        },
      },
      {
        id: "s57-sounding",
        type: "symbol",
        source: id,
        "source-layer": "sounding",
        minzoom: 11,
        filter: point,
        layout: {
          "text-field": soundingText(),
          "text-font": ITALIC,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 14, 14, 16, 16],
          "text-padding": 4,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": soundingColour(),
          "text-halo-color": "#e7f3f5",
          "text-halo-width": 0.7,
        },
      },
      {
        id: "s57-landmark",
        type: "symbol",
        source: id,
        "source-layer": "place",
        minzoom: 13,
        filter: ["all", named, ["==", obj, "LNDMRK"]],
        layout: {
          "text-field": ["get", "OBJNAM"],
          "text-font": ROMAN,
          "text-size": 11,
          "text-offset": [0, 0.6],
          "text-optional": true,
        },
        paint: {
          "text-color": CHBLK,
          "text-halo-color": "#f3ecd4",
          "text-halo-width": 1.1,
        },
      },
    ],
  };
}
