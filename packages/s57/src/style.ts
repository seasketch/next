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
const CHBRN = "#a39480";
const LANDF = "#8c7a55";
const LITRD = "#e8505b";
const LITGN = "#3cb44b";
const LITYW = "#f2c230";
const LAND_HALO = "#ece2c0";

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
  // Lateral marks take colour from COLOUR and shape from BOYSHP, as S-52
  // does, so one rule serves IALA-A and the red-right-returning IALA-B.
  const colour = ["to-number", ["coalesce", ["get", "colour"], 0]];
  const red = ["==", colour, 3];
  const lateralBuoy = [
    "concat",
    "buoy-",
    ["case", red, "red", "green"],
    "-",
    ["match", ["to-number", ["coalesce", ["get", "BOYSHP"], 0]], 1, "cone", 4, "pillar", 5, "pillar", "can"],
  ];
  return [
    "case",
    ["in", ["get", "mark"], ["literal", ["port", "starboard", "lateral"]]],
    ["case", beacon, ["case", red, "beacon-red", "beacon-green"], lateralBuoy],
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

function lightIcon(): Expr {
  return [
    "case",
    // A sector light is drawn by its arcs; a flare would sit on top of them.
    ["has", "SECTR1"],
    "",
    [
      "match",
      ["to-number", ["coalesce", ["get", "colour"], 0]],
      3, "light-red",
      4, "light-green",
      1, "light-yellow",
      6, "light-yellow",
      11, "light-yellow",
      "light",
    ],
  ];
}

/** A lighthouse has a name of its own. Lights on buoys and beacons do not. */
const majorLight = [
  "all",
  ["has", "label"],
  ["!=", ["slice", ["get", "label"], 0, 1], '"'],
] as Expr;

/**
 * Lighthouses carry name and description from the approach scale. Every other
 * light gets its description in harbour view, where there is room.
 */
function lightText(): Expr {
  const description = ["coalesce", ["get", "litdsn"], ""];
  const named = [
    "format",
    ["get", "label"],
    { "font-scale": 1.05 },
    "\n",
    {},
    description,
    { "font-scale": 0.92 },
  ];
  return [
    "step",
    ["zoom"],
    ["case", majorLight, named, ""],
    13,
    ["case", majorLight, named, description],
  ];
}

function sectorColour(): Expr {
  return [
    "match",
    ["get", "colour"],
    "red", LITRD,
    "green", LITGN,
    "yellow", LITYW,
    CHMGD,
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
  const polygon = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
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
        filter: ["all", ["==", obj, "BUAARE"], ["!=", ["geometry-type"], "Point"]],
        paint: { "fill-color": CHBRN, "fill-opacity": 0.45 },
      },
      {
        id: "s57-building-area",
        type: "fill",
        source: id,
        "source-layer": "land_detail",
        minzoom: 12,
        filter: ["all", ["in", obj, ["literal", ["BUISGL", "SILTNK"]]], polygon],
        paint: { "fill-color": "#8f7f5c", "fill-outline-color": CHBLK },
      },
      {
        id: "s57-land-contour",
        type: "line",
        source: id,
        "source-layer": "land_detail",
        minzoom: 11,
        filter: ["all", ["==", obj, "LNDELV"], ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]]],
        paint: { "line-color": LANDF, "line-width": 0.6, "line-opacity": 0.8 },
      },
      {
        id: "s57-land-line",
        type: "line",
        source: id,
        "source-layer": "land_detail",
        minzoom: 13,
        filter: ["all", ["in", obj, ["literal", ["DYKCON", "FNCLNE"]]], ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]]],
        paint: { "line-color": CHBLK, "line-width": 0.9 },
      },
      {
        id: "s57-inland",
        type: "fill",
        source: id,
        "source-layer": "inland_water",
        filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
        paint: { "fill-color": DEPMS },
      },
      {
        // River and canal centerlines. A fill layer never draws a line.
        id: "s57-river",
        type: "line",
        source: id,
        "source-layer": "inland_water",
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#5aa3d6",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 14, 1.6],
        },
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
        id: "s57-kelp",
        type: "fill",
        source: id,
        "source-layer": "seabed",
        minzoom: 11,
        filter: ["all", ["==", obj, "WEDKLP"], polygon],
        paint: { "fill-pattern": "kelp-pattern" },
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
        id: "s57-light-sector-leg",
        type: "line",
        source: id,
        "source-layer": "light_sector",
        filter: ["==", ["get", "part"], "leg"],
        paint: { "line-color": CHBLK, "line-width": 0.8, "line-dasharray": [4, 3] },
      },
      {
        id: "s57-light-sector-casing",
        type: "line",
        source: id,
        "source-layer": "light_sector",
        filter: ["==", ["get", "part"], "arc"],
        layout: { "line-cap": "butt" },
        paint: { "line-color": CHBLK, "line-width": 4.6 },
      },
      {
        id: "s57-light-sector",
        type: "line",
        source: id,
        "source-layer": "light_sector",
        filter: ["==", ["get", "part"], "arc"],
        layout: { "line-cap": "butt" },
        paint: { "line-color": sectorColour(), "line-width": 2.8 },
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
        filter: ["all", point, named, ["in", obj, ["literal", ["SEAARE", "LNDRGN"]]]],
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
        id: "s57-town-name",
        type: "symbol",
        source: id,
        "source-layer": "land",
        minzoom: 10,
        filter: ["all", point, named, ["==", obj, "BUAARE"]],
        layout: {
          "text-field": ["get", "OBJNAM"],
          "text-font": ROMAN,
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 14, 14],
          "text-max-width": 8,
          "text-padding": 10,
        },
        paint: { "text-color": CHBLK, "text-halo-color": LAND_HALO, "text-halo-width": 1.3 },
      },
      {
        // Soundings sit under every other label, so a light description or a
        // buoy number is never the one that gives way.
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
        id: "s57-seabed",
        type: "symbol",
        source: id,
        "source-layer": "seabed",
        minzoom: 12,
        filter: ["all", point, ["has", "seabed"]],
        layout: {
          "text-field": ["get", "seabed"],
          "text-font": ITALIC,
          "text-size": 10,
          "text-padding": 6,
        },
        paint: { "text-color": CHGRD, "text-halo-color": "#e7f3f5", "text-halo-width": 0.7 },
      },
      {
        id: "s57-kelp-point",
        type: "symbol",
        source: id,
        "source-layer": "seabed",
        minzoom: 12,
        filter: ["all", point, ["==", obj, "WEDKLP"]],
        layout: { "icon-image": "kelp", "icon-size": 0.4, "icon-padding": 2 },
      },
      {
        id: "s57-regulated-name",
        type: "symbol",
        source: id,
        "source-layer": "regulated",
        minzoom: 12,
        filter: [
          "all",
          point,
          named,
          ["in", obj, ["literal", ["RESARE", "MIPARE", "DMPGRD", "PRCARE", "MARCUL"]]],
        ],
        layout: {
          "text-field": ["get", "OBJNAM"],
          "text-font": ITALIC,
          "text-size": 11,
          "text-max-width": 9,
          "text-padding": 12,
        },
        paint: { "text-color": CHMGD, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      },
      {
        id: "s57-anchorage",
        type: "symbol",
        source: id,
        "source-layer": "regulated",
        minzoom: 11,
        filter: ["all", point, ["==", obj, "ACHARE"]],
        layout: {
          "icon-image": "anchor",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.32, 15, 0.5],
          "icon-padding": 20,
          "text-field": ["step", ["zoom"], "", 13, ["coalesce", ["get", "OBJNAM"], ""]],
          "text-font": ITALIC,
          "text-size": 11,
          "text-max-width": 9,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: { "text-color": CHMGD, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      },
      {
        id: "s57-pilot",
        type: "symbol",
        source: id,
        "source-layer": "regulated",
        minzoom: 12,
        filter: ["all", point, ["==", obj, "PILBOP"]],
        layout: {
          "text-field": "Pilots",
          "text-font": ITALIC,
          "text-size": 11,
        },
        paint: { "text-color": CHMGD, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      },
      {
        id: "s57-elevation",
        type: "symbol",
        source: id,
        "source-layer": "land_detail",
        minzoom: 12,
        filter: ["all", point, ["==", obj, "LNDELV"], ["has", "ELEVAT"]],
        layout: {
          "icon-image": "spot-height",
          "icon-size": 0.28,
          "text-field": ["concat", ["to-string", ["round", ["to-number", ["get", "ELEVAT"]]]], "m"],
          "text-font": ROMAN,
          "text-size": 10,
          "text-anchor": "left",
          "text-offset": [0.5, 0],
          "text-padding": 6,
        },
        paint: { "text-color": CHBLK, "text-halo-color": LAND_HALO, "text-halo-width": 1 },
      },
      {
        id: "s57-elevation-contour",
        type: "symbol",
        source: id,
        "source-layer": "land_detail",
        minzoom: 13,
        filter: ["all", ["==", obj, "LNDELV"], ["!=", ["geometry-type"], "Point"], ["has", "ELEVAT"]],
        layout: {
          "symbol-placement": "line",
          "text-field": ["to-string", ["round", ["to-number", ["get", "ELEVAT"]]]],
          "text-font": ROMAN,
          "text-size": 9,
          "symbol-spacing": 320,
        },
        paint: { "text-color": LANDF, "text-halo-color": LAND_HALO, "text-halo-width": 1 },
      },
      {
        id: "s57-landmark",
        type: "symbol",
        source: id,
        "source-layer": "land_detail",
        minzoom: 11,
        filter: ["all", point, ["has", "symbol"]],
        layout: {
          "icon-image": ["get", "symbol"],
          // Conspicuous landmarks are the ones a chart is read by from sea.
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            ["case", ["==", ["get", "CONVIS"], 1], 0.42, 0.3],
            15,
            ["case", ["==", ["get", "CONVIS"], 1], 0.62, 0.44],
          ],
          "icon-padding": 1,
          "text-field": ["step", ["zoom"], "", 14, ["coalesce", ["get", "OBJNAM"], ""]],
          "text-font": ROMAN,
          "text-size": 10,
          "text-max-width": 8,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: { "text-color": CHBLK, "text-halo-color": LAND_HALO, "text-halo-width": 1.1 },
      },
      {
        id: "s57-coastguard",
        type: "symbol",
        source: id,
        "source-layer": "land_detail",
        minzoom: 13,
        filter: ["==", obj, "CGUSTA"],
        layout: {
          "text-field": "CG",
          "text-font": ROMAN,
          "text-size": 11,
        },
        paint: { "text-color": CHBLK, "text-halo-color": LAND_HALO, "text-halo-width": 1.1 },
      },
      {
        id: "s57-islet",
        type: "circle",
        source: id,
        "source-layer": "land",
        filter: ["all", point, ["==", obj, "LNDARE"]],
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
        minzoom: 11,
        filter: point,
        layout: {
          "icon-image": hazardIcon(),
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.32, 15, 0.62],
          "icon-allow-overlap": false,
          "icon-padding": 1,
        },
      },
      {
        id: "s57-pile",
        type: "circle",
        source: id,
        "source-layer": "pile",
        minzoom: 12,
        filter: point,
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 1.1, 15, 1.8], "circle-color": CHBLK },
      },
      {
        id: "s57-mooring",
        type: "symbol",
        source: id,
        "source-layer": "mooring",
        minzoom: 12,
        filter: ["all", point, ["==", obj, "MORFAC"]],
        layout: {
          "icon-image": "mooring",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 15, 0.55],
          "icon-allow-overlap": true,
        },
      },
      {
        id: "s57-berth",
        type: "symbol",
        source: id,
        "source-layer": "mooring",
        minzoom: 15,
        filter: ["all", named, ["==", obj, "BERTHS"]],
        layout: {
          "text-field": ["get", "OBJNAM"],
          "text-font": ROMAN,
          "text-size": 10,
          "symbol-placement": "point",
        },
        paint: { "text-color": CHBLK, "text-halo-color": PAPER, "text-halo-width": 1 },
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
        id: "s57-fog",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        minzoom: 12,
        filter: ["all", point, ["==", ["get", "mark"], "fog"]],
        layout: {
          "icon-image": "fog",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 15, 0.6],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      },
      {
        id: "s57-racon",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        minzoom: 12,
        filter: ["all", point, ["==", obj, "RTPBCN"]],
        layout: {
          "text-field": "Racon",
          "text-font": ITALIC,
          "text-size": 10,
          "text-anchor": "right",
          "text-offset": [-1, 0.6],
          "text-optional": true,
        },
        paint: { "text-color": CHMGD, "text-halo-color": PAPER, "text-halo-width": 1 },
      },
      {
        id: "s57-aid",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        filter: [
          "all",
          point,
          ["has", "mark"],
          ["!", ["in", ["get", "mark"], ["literal", ["light", "fog"]]]],
        ],
        layout: {
          "icon-image": aidIcon(),
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.42, 13, 0.7, 16, 0.86],
          "icon-allow-overlap": true,
          "text-field": ["step", ["zoom"], "", 13, ["coalesce", ["get", "label"], ""]],
          "text-font": ROMAN,
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.9, 0.5],
          "text-optional": true,
        },
        paint: { "text-color": CHBLK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      },
      {
        id: "s57-light",
        type: "symbol",
        source: id,
        "source-layer": "aid",
        filter: ["all", point, ["==", ["get", "mark"], "light"]],
        layout: {
          "icon-image": lightIcon(),
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 0.62],
          "icon-allow-overlap": true,
          // The flare shares its position with a buoy or beacon whose number
          // has to fit beside it.
          "icon-ignore-placement": true,
          "text-field": lightText(),
          "text-font": ROMAN,
          "text-size": 11,
          "text-offset": [1.1, -1.1],
          "text-anchor": "left",
          "text-justify": "left",
          "text-max-width": 14,
          "text-optional": true,
        },
        paint: {
          "text-color": CHBLK,
          "text-halo-color": PAPER,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}
