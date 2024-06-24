import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
  isRasterInfo,
} from "@seasketch/geostats-types";
import { Expression, Layer, RasterLayer } from "mapbox-gl";
import * as colorScale from "d3-scale-chromatic";

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
              "raster-color-mix": [0, 0, 256, geostats.bands[0].base],
              "raster-color": [
                "step",
                ["ceil", ["raster-value"]],
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
  reverse = false,
  excludedValues: (string | number)[] = []
) {
  // @ts-ignore
  const colors = colorScale[palette];
  if (!colors?.length) {
    throw new Error("Invalid palette: " + palette);
  }
  const colorCount = colors.length;
  switch (expression[0]) {
    case "step":
    case "match":
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

    default:
      throw new Error("Unsupported expression type. " + expression[0]);
  }
}

/**
 * Checks all colors in an expression to see if they match a palette. Ignores
 * transparent colors.
 */
export function expressionMatchesPalette(
  expression: Expression,
  palette: keyof typeof colorScale
) {
  const paletteColors = colorScale[palette] as string[];
  if (!paletteColors?.length) {
    return false;
  }
  const expressionColors = extractColorsFromExpression(expression);
  for (const color of expressionColors) {
    if (!paletteColors.includes(color)) {
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
  let colors = palette ? getScale(palette) : [];
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
  if (palette in colorScale) {
    const scale = colorScale[palette as keyof typeof colorScale];
    if (scale.length) {
      return scale as string[];
    }
  }
  return null;
}

function extractColorsFromExpression(expression: Expression) {
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
