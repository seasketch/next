import {
  Bucket,
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
  isRasterInfo,
} from "@seasketch/geostats-types";
import { Expression, Layer, RasterLayer } from "mapbox-gl";
import * as colorScale from "d3-scale-chromatic";
import { StepsSetting } from "./ContinuousRasterStepsEditor";

export const colorScales = {
  categorical: [
    "schemeObservable10",
    "schemeCategory10",
    "schemeTableau10",
    "schemeAccent",
    "schemeDark2",
    "schemePaired",
    "schemePastel1",
    "schemePastel2",
    "schemeSet1",
    "schemeSet2",
    "schemeSet3",
  ],
  continuous: {
    diverging: [
      "interpolateBrBG",
      "interpolatePRGn",
      "interpolatePiYG",
      "interpolatePuOr",
      "interpolateRdBu",
      "interpolateRdGy",
      "interpolateRdYlBu",
      "interpolateRdYlGn",
      "interpolateSpectral",
    ],
    sequential: [
      "interpolateBlues",
      "interpolateGreens",
      "interpolateGreys",
      "interpolateOranges",
      "interpolatePurples",
      "interpolateReds",
      "interpolateTurbo",
      "interpolateViridis",
      "interpolateInferno",
      "interpolateMagma",
      "interpolatePlasma",
      "interpolateCividis",
      "interpolateWarm",
      "interpolateCool",
      "interpolateCubehelixDefault",
      "interpolateBuGn",
      "interpolateBuPu",
      "interpolateGnBu",
      "interpolateOrRd",
      "interpolatePuBuGn",
      "interpolatePuBu",
      "interpolatePuRd",
      "interpolateRdPu",
      "interpolateYlGnBu",
      "interpolateYlGn",
      "interpolateYlOrBr",
      "interpolateYlOrRd",
    ],
    cyclical: ["interpolateRainbow", "interpolateSinebow"],
  },

  // [
  //   "interpolatePlasma",
  //   "interpolateViridis",
  //   "interpolateInferno",
  //   "interpolateMagma",
  //   "interpolateCividis",
  //   "interpolateWarm",
  //   "interpolateCool",
  //   "interpolateRainbow",
  //   "interpolateSinebow",
  //   "interpolateTurbo",
  //   "interpolateCubehelixDefault",
  //   "interpolateSpectral",
  //   "interpolateRdYlBu",
  //   "interpolateRdYlGn",
  //   "interpolateSpectral",
  //   "interpolateBrBG",
  //   "interpolatePRGn",
  //   "interpolatePiYG",
  //   "interpolatePuOr",
  //   "interpolateRdBu",
  //   "interpolateRdGy",
  //   "interpolateRdYlBu",
  //   "interpolateRdYlGn",
  //   "interpolateBlues",
  //   "interpolateGreens",
  //   "interpolateGreys",
  //   "interpolateOranges",
  //   "interpolatePurples",
  //   "interpolateReds",
  // ],
};

export enum VisualizationType {
  RGB_RASTER = "rgb-raster",
  CATEGORICAL_RASTER = "categorical-raster",
  CONTINUOUS_RASTER = "continuous-raster",
}

export function validVisualizationTypesForGeostats(
  geostats: GeostatsLayer | RasterInfo
) {
  const types: VisualizationType[] = [];
  if (isRasterInfo(geostats)) {
    if (geostats.presentation === SuggestedRasterPresentation.rgb) {
      types.push(VisualizationType.RGB_RASTER);
    } else if (
      geostats.presentation === SuggestedRasterPresentation.categorical &&
      geostats.bands[0].stats.categories &&
      geostats.bands[0].stats.categories.length > 0
    ) {
      types.push(VisualizationType.CATEGORICAL_RASTER);
      types.push(VisualizationType.RGB_RASTER);
    } else if (
      geostats.presentation === SuggestedRasterPresentation.continuous
    ) {
      types.push(VisualizationType.CONTINUOUS_RASTER);
    }
  }
  return types;
}

export function determineVisualizationType(
  geostats: GeostatsLayer | RasterInfo,
  validTypes: VisualizationType[],
  layers: Layer[]
): VisualizationType | null {
  if (isRasterInfo(geostats)) {
    if (layers.length === 1 && layers[0].type === "raster") {
      const paint = layers[0].paint;
      if (paint && !("raster-color-mix" in paint)) {
        if (validTypes.includes(VisualizationType.RGB_RASTER)) {
          return VisualizationType.RGB_RASTER;
        }
      } else if (paint && "raster-color-mix" in paint) {
        if ("raster-color" in paint && Array.isArray(paint["raster-color"])) {
          const expression = paint["raster-color"][0];
          if (expression === "step" || expression === "match") {
            if (validTypes.includes(VisualizationType.CATEGORICAL_RASTER)) {
              return VisualizationType.CATEGORICAL_RASTER;
            } else if (expression === "step") {
              if (validTypes.includes(VisualizationType.CONTINUOUS_RASTER)) {
                return VisualizationType.CONTINUOUS_RASTER;
              }
            }
          } else if (/interpolate/.test(expression)) {
            if (validTypes.includes(VisualizationType.CONTINUOUS_RASTER)) {
              return VisualizationType.CONTINUOUS_RASTER;
            }
          }
        }
      }
    }
  }
  return null;
}

export function convertToVisualizationType(
  geostats: GeostatsLayer | RasterInfo,
  type: VisualizationType,
  oldLayers: Layer[]
): Omit<Layer, "source" | "id">[] {
  const layers: Omit<Layer, "source" | "id">[] = [];
  switch (type) {
    case VisualizationType.RGB_RASTER:
      const oldLayer = oldLayers.find((l) => l.type === "raster") as
        | RasterLayer
        | undefined;
      layers.push({
        type: "raster",
        paint: {
          ...defaultsOrUndefined(oldLayer?.paint, [
            "raster-resampling",
            "raster-opacity",
          ]),
        },
        layout: {
          visibility: "visible",
        },
        metadata: {
          ...(oldLayer?.metadata || {}),
          "s:type": VisualizationType.RGB_RASTER,
        },
      });
      break;
    case VisualizationType.CATEGORICAL_RASTER:
      if (isRasterInfo(geostats)) {
        const stats = geostats.bands[0].stats;
        const { minimum, maximum } = geostats.bands[0];
        let colors: [number, string][] = [];
        const oldLayer = oldLayers.find((l) => l.type === "raster");
        let colorScaleKey =
          oldLayer?.metadata?.["s:palette"] || "schemeObservable10";
        // @ts-ignore
        let scale = colorScale[colorScaleKey];
        if (!scale) {
          colorScaleKey = "schemeTableau10";
          // @ts-ignore
          scale = colorScale["schemeTableau10"];
        }
        if (geostats.bands[0].colorTable) {
          colors = geostats.bands[0].colorTable;
        } else if (geostats.bands[0].stats.categories) {
          const categories = geostats.bands[0].stats.categories;
          for (const category of categories) {
            colors.push([
              category[0],
              scale[categories.indexOf(category) % scale.length],
            ]);
          }
        }
        if (stats.categories && stats.categories.length) {
          layers.push({
            type: "raster",
            paint: {
              ...defaultsOrUndefined(oldLayer?.paint, ["raster-opacity"]),
              "raster-resampling": "nearest",
              "raster-color-mix": [0, 0, 258, geostats.bands[0].base],
              "raster-color": [
                "step",
                ["round", ["raster-value"]],
                "transparent",
                ...colors.flat(),
              ],
              "raster-color-range": [minimum, maximum],
              "raster-fade-duration": 0,
            },
            metadata: {
              ...(oldLayer?.metadata || {}),
              "s:type": VisualizationType.CATEGORICAL_RASTER,
              "s:palette": colorScaleKey,
            },
          });
        }
      }
      break;
    case VisualizationType.CONTINUOUS_RASTER:
      break;
    default:
      layers.push(...oldLayers);
  }
  return layers;
}

function defaultsOrUndefined(paintOrLayout: any, keys: string[]) {
  const results = {} as any;
  for (const key of keys) {
    if (key in paintOrLayout) {
      results[key] = paintOrLayout[key];
    }
  }
  return results;
}

export function replaceColors(
  expression: Expression,
  palette: string,
  reverse: boolean,
  excludedValues: (string | number)[],
  steps?: StepsSetting
) {
  // @ts-ignore
  let colors = Array.isArray(palette) ? palette : colorScale[palette];
  if (!colors?.length) {
    throw new Error("Invalid palette: " + palette);
  }
  if (typeof colors === "function" && steps && steps.steps !== "continuous") {
    const nStops = steps.n;
    const interval = 1 / (nStops - 1);
    colors = Array.from({ length: nStops }, (_, i) => {
      return colors(i * interval);
    });
  }
  if (palette in colorScale && reverse && Array.isArray(colors)) {
    colors = [...colors].reverse();
  }
  const colorCount = colors.length;
  if (expression[0] === "step" || expression[0] === "match") {
    let c = 0;
    for (
      let i = expression[0] === "step" ? 2 : 3;
      i < expression.length;
      i += 2
    ) {
      if (
        typeof expression[i] === "string" &&
        expression[i] !== "transparent"
      ) {
        if (excludedValues.includes(expression[i - 1])) {
          expression[i] = "transparent";
        } else {
          expression[i] = colors[c % colorCount];
        }
        c++;
      }
    }
    return [...expression] as Expression;
  } else if (/interpolate/.test(expression[0])) {
    const fnName = expression[0];
    const iType = expression[1];
    const arg = expression[2];
    const stops = expression.slice(3);
    const nStops = stops.length / 2;
    for (var i = 0; i < nStops; i++) {
      const fraction = reverse ? 1 - i / (nStops - 1) : i / (nStops - 1);
      stops[i * 2 + 1] = colors(fraction);
    }
    return [fnName, iType, arg, ...stops];
  } else {
    throw new Error("Unsupported expression type. " + expression[0]);
  }
}

export function buildContinuousRasterColorExpression(
  expression: Expression | undefined,
  palette: string | string[],
  reverse: boolean,
  range: [number, number]
) {
  // TODO: support string[] palettes
  const colors = Array.isArray(palette)
    ? palette
    : colorScale[palette as keyof typeof colorScale];
  const fnName =
    expression && /interpolate/.test(expression[0])
      ? expression[0]
      : "interpolate";
  const iType =
    expression && /interpolate/.test(expression[0])
      ? expression?.[1]
      : ["linear"];
  const arg = ["raster-value"];
  const stops = [];
  const nStops = typeof colors === "function" ? 10 : colors.length;
  const interval = (range[1] - range[0]) / (nStops - 1);
  for (var i = 0; i < nStops; i++) {
    const fraction = reverse ? 1 - i / (nStops - 1) : i / (nStops - 1);
    stops.push(
      range[0] + interval * i,
      typeof colors === "function" ? colors(fraction) : colors[i]
    );
  }
  return [fnName, iType, arg, ...stops];
}

/**
 * Checks all colors in an expression to see if they match a palette. Ignores
 * transparent colors.
 */
export function expressionMatchesPalette(
  expression: Expression,
  palette: keyof typeof colorScale,
  reversed: boolean,
  steps: StepsSetting
) {
  let paletteColors = (
    Array.isArray(palette) ? [] : (colorScale[palette] as string[])
  ) as ((i: number) => string) | string[];
  if (typeof paletteColors === "function" && steps) {
    const nStops = steps?.steps === "continuous" ? 10 : steps.n;
    // @ts-ignore
    paletteColors = getColorStops(palette, nStops, reversed);
  }
  const expressionColors = extractColorsFromExpression(expression);
  for (const color of expressionColors) {
    if (!(paletteColors as string[]).includes(color)) {
      return false;
    }
  }
  return true;
}

function colorsMatch(colorsA: string[], colorsB: string[]) {
  for (const color of colorsA) {
    if (!colorsB.includes(color)) {
      return false;
    }
  }
  return true;
}

function isColor(str: string) {
  return (
    /^#/.test(str) ||
    /^rgb/.test(str) ||
    /^hsl/.test(str) ||
    /^transparent$/.test(str) ||
    /^rgba/.test(str)
  );
}

export function applyExcludedValuesToCategoryExpression(
  expression: Expression,
  excludedValues: (string | number)[],
  palette: string | undefined | null
) {
  let colors = palette
    ? Array.isArray(palette)
      ? palette
      : getScale(palette)
    : [];
  const expressionColors = extractColorsFromExpression(expression);
  if (!colors || !colorsMatch(expressionColors, colors)) {
    colors = expressionColors;
  }
  let c = 0;
  switch (expression[0]) {
    case "step":
    case "match":
      let i = expression[0] === "step" ? 3 : 2;
      while (i < expression.length) {
        if (excludedValues.includes(expression[i])) {
          expression[i + 1] = "transparent";
        } else {
          expression[i + 1] = colors[c % colors.length];
        }
        c++;
        i += 2;
      }
      return [...expression] as Expression;
    default:
      throw new Error("Unsupported expression type. " + expression[0]);
  }
}

function getScale(palette: string) {
  if (!Array.isArray(palette) && palette in colorScale) {
    const scale = colorScale[palette as keyof typeof colorScale];
    if (scale.length) {
      return scale as string[];
    }
  }
  return null;
}

export function extractColorsFromExpression(expression: Expression) {
  return expression.filter(
    (e) => typeof e === "string" && isColor(e) && e !== "transparent"
  );
}

export function replaceColorForValueInExpression(
  expression: Expression,
  value: string | number,
  color: string
) {
  switch (expression[0]) {
    case "step":
    case "match":
      let i = expression[0] === "step" ? 3 : 2;
      while (i < expression.length) {
        if (expression[i] === value) {
          expression[i + 1] = color;
        }
        i += 2;
      }
      return [...expression] as Expression;
    default:
      throw new Error("Unsupported expression type. " + expression[0]);
  }
}

export function extractValueRange(expression: Expression) {
  const values = [] as number[];
  const fName = expression[0];
  if (/interpolate/.test(fName)) {
    const stops = expression.slice(3);
    for (let i = 0; i < stops.length; i += 2) {
      values.push(stops[i]);
    }
    return [Math.min(...values), Math.max(...values)];
  } else {
    const stops = expression.slice(3);
    for (let i = 0; i < stops.length; i += 2) {
      values.push(stops[i]);
    }
    return [Math.min(...values), Math.max(...values)];
    // throw new Error("Unsupported expression type. " + fName);
  }
}

export function buildStepExpression(
  buckets: Bucket[],
  palette: string | string[],
  reverse: boolean
) {
  const expression: Expression = ["step", ["raster-value"], "transparent"];
  const nStops = buckets.length - 1;
  const colors = getColorStops(palette, nStops, reverse);
  for (let i = 0; i < nStops; i++) {
    const bucket = buckets[i];
    if (buckets[1] !== null && (i === 0 || bucket[0] !== buckets[i - 1][0])) {
      expression.push(bucket[0], colors[i]);
    }
  }
  return expression;
}

function getColorStops(
  palette: string | string[],
  n: number,
  reverse: boolean
) {
  let colors = Array.isArray(palette)
    ? palette
    : colorScale[palette as keyof typeof colorScale];
  if (!colors?.length) {
    throw new Error("Invalid palette: " + palette);
  }
  if (
    !Array.isArray(palette) &&
    palette in colorScale &&
    reverse &&
    Array.isArray(colors)
  ) {
    colors = [...colors].reverse();
  }
  const colorCount = colors.length;
  const stops = [];
  for (let i = 0; i < n; i++) {
    if (typeof colors === "function") {
      const fraction = reverse ? 1 - i / (n - 1) : i / (n - 1);
      stops.push(colors(fraction));
    } else {
      if (i > colors.length) {
        stops.push(colors[colors.length - 1]);
      } else {
        stops.push(colors[i % colorCount]);
      }
    }
  }
  return stops;
}
