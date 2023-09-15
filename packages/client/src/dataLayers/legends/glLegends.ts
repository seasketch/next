import { Feature } from "geojson";
import { Expression as MapboxExpression, StyleFunction } from "mapbox-gl";
import { expression } from "mapbox-gl/dist/style-spec/index.es.js";
import {
  Expression,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  Layer,
  LineLayer,
} from "mapbox-gl";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { Geostats } from "../../admin/data/GLStyleEditor/GeostatsModal";

export interface GLLegendFillSymbol {
  type: "fill";
  color: string;
  extruded?: boolean;
  patternImageId?: string;
  /** 0-1 */
  fillOpacity: number;
  strokeWidth: number;
  strokeOpacity?: number;
  strokeColor?: string;
  dashed?: boolean;
}

export interface GLLegendLineSymbol {
  type: "line";
  color: string;
  strokeWidth: number;
  patternImageId?: string;
  dashed?: boolean;
  opacity?: number;
}

export interface GLLegendCircleSymbol {
  type: "circle";
  color: string;
  strokeWidth: number;
  strokeColor?: string;
  /** 0-1 */
  fillOpacity: number;
  strokeOpacity: number;
  radius: number;
}

export interface GLLegendMarkerSymbol {
  type: "marker";
  imageId: string;
  haloColor?: string;
  haloWidth?: number;
  rotation?: number;
  /** multiple of width & height to display */
  iconSize: number;
}

export interface GLLegendRasterSymbol {
  type: "raster";
}

export interface GLLegendVideoSymbol {
  type: "video";
}

export interface GLLegendTextSymbol {
  type: "text";
  color: string;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  haloColor?: string;
  haloWidth?: number;
}

export type GLLegendSymbol =
  | GLLegendFillSymbol
  | GLLegendCircleSymbol
  | GLLegendMarkerSymbol
  | GLLegendTextSymbol
  | GLLegendRasterSymbol
  | GLLegendLineSymbol
  | GLLegendVideoSymbol;

export type GLLegendListPanel = {
  id: string;
  type: "GLLegendListPanel";
  label?: string;
  items: { id: string; label: string; symbol: GLLegendSymbol }[];
};

/**
 * Display should be stacked if bubbles are big and can nest together, otherwise
 * display as a list.
 *
 * Note that a BubblePanel may be paired with a ListPanel for a common case of
 * a bubble chart with a categorical variable controlling the color of the bubbles.
 */
export type GLLegendBubblePanel = {
  id: string;
  type: "GLLegendBubblePanel";
  label?: string;
  stops: {
    value: number;
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  }[];
};

export type GLLegendHeatmapPanel = {
  id: string;
  type: "GLLegendHeatmapPanel";
  stops: { value: number; color: string }[];
};

export type GLLegendGradientPanel = {
  id: string;
  type: "GLLegendGradientPanel";
  label?: string;
  stops: { value: number; label: string; color: string }[];
};

export type GLLegendPanel =
  | GLLegendListPanel
  | GLLegendBubblePanel
  | GLLegendHeatmapPanel
  | GLLegendGradientPanel;

export type SimpleLegendForGLLayers = {
  type: "SimpleGLLegend";
  symbol: GLLegendSymbol;
};

export type MultipleSymbolLegendForGLLayers = {
  type: "MultipleSymbolGLLegend";
  panels: GLLegendPanel[];
};

export type LegendForGLLayers =
  | SimpleLegendForGLLayers
  | MultipleSymbolLegendForGLLayers;

// ordered by rank of importance
const SIGNIFICANT_PAINT_PROPS = [
  "fill-color",
  "fill-extrusion-color",
  "fill-pattern",
  "fill-opacity",
  "fill-outline-color",
  "fill-extrusion-height",
  "circle-color",
  "line-color",
  "line-pattern",
  "text-color",
  "circle-radius",
  "icon-color",
  "circle-stroke-color",
  "line-width",
  "circle-stroke-width",
  "line-dasharray",
  "line-opacity",
  "text-halo-color",
  "circle-opacity",
];

const SIGNIFICANT_LAYOUT_PROPS = ["icon-image", "icon-size", "text-size"];

/**
 * While building the legend, it is important to keep track of what style props
 * are already represented in symbols. A single dataset with complex styles
 * may for example have one panel which represents circle color as a gradient of
 * interpolated color, but then needs another panel to show how a categorical
 * variable controls circle stroke color. In this case, the categorical panel
 * should have an empty fill, since it is already represented in the gradient.
 *
 * Tracking this is difficult since we need to keep track of what props have
 * been represented and then add to the list when new symbols are created.
 * Instances of this class can be passed down to symbol creation functions so
 * that they can add to the list of represented properties.
 *
 * The pending/commit system ensures that properties are only added to the
 * list of represented properties after a full "panel" has been created.
 */
class RepresentedProperties {
  private committed = new Set<string>();
  private pending = new Set<string>();

  has(prop: string) {
    return this.committed.has(prop);
  }

  add(prop: string, commit?: boolean) {
    this.pending.add(prop);
    if (commit) {
      this.commit();
    }
  }

  commit() {
    this.pending.forEach((p) => this.committed.add(p));
    this.pending.clear();
  }

  reset() {
    this.pending.clear();
    this.committed.clear();
  }

  clearPending() {
    this.pending.clear();
  }
}

function createStyleValueOrExpressionForContextFn(
  context: LegendContext,
  layers: SeaSketchGlLayer[],
  representedProperties: RepresentedProperties,
  expression: SignificantExpression
) {
  /**
   * Returns the appropriate value for a paint or layout property based on
   * the current legend evaluation context. By context, we mean the current
   * significant expression being evaluated for the creation of a legend
   * panel. This is useful for getting values for related properties.
   *
   * For example, if the current expression is a circle-radius expression
   * and a bubble chart is being built, this function can be used to get the
   * appropriate value for circle-stroke-color, circle-color, and
   * circle-stroke-width. These values each individually may have different
   * behaviors:
   *
   *  1. If they are literal values or those controlled by non-data
   *     expressions, the correct value should be returned.
   *  2. If any of these are controlled by an expression that references a
   *     different data property, the value should be set to something
   *     "blank" or simple so that it can be represented in a separate panel
   *     later.
   *  3. If any of these are controlled by the same data property as the
   *     context's focal expression, the expression itself is returned so
   *     that it can be evaluated for each stop or domain being rendered.
   *
   * If case #3 is encountered, this function will add the style prop
   * to the list of "representedProperties" so that it is not duplicated in
   * another panel.
   *
   *
   * @param stypeProp name of the style property to get the value of
   * @param blankValue value to return if the property is controlled by a
   *                   different data property
   * @param anyLayer use when styling fill layers to get the value from any
   *                 related line layers which can be treated like "fill-stroke"
   */
  const styleValueOrExpressionForContext = (
    styleProp: string,
    blankValue: any,
    anyLayer = false
  ): Expression | string | number => {
    const relatedExpression = context.significantExpressions.find(
      (e) =>
        (anyLayer || e.layerIndex === expression.layerIndex) &&
        e.styleProp === styleProp
      // not sure I need the following:
      // && !representedProperties.includes(e.styleProp)
    );
    if (!relatedExpression) {
      // Case #1: no related expression
      const isPaint = SIGNIFICANT_PAINT_PROPS.includes(styleProp);
      // Usually the prop of interest will be on the layer indicated by the
      // focal expression. For line-color, line-opacity, and line-width it
      // could be that the focal expression is a fill layer and we need
      // to look for a related line layer.
      let layer = layers[expression.layerIndex];
      if (
        layer.type === "fill" &&
        ["line-color", "line-opacity", "line-width"].includes(styleProp)
      ) {
        // need to find a related line layer
        layer = layers.find((l) => l.type === "line") as LineLayer;
      }
      if (isPaint) {
        const paint = layer.paint || {};
        return getPaintProp(paint, styleProp, {});
      } else {
        const layout = layer.layout || {};
        return getLayoutProp(
          layout,
          layer !== layers[expression.layerIndex] ? "fill" : layer.type,
          styleProp,
          {}
        );
      }
    } else if (relatedExpression.getProp === expression.getProp) {
      // Case #3: related expression is controlled by the same data property
      // related expression is controlled by the same data property
      // get the style property value from the related layer
      const isPaint = SIGNIFICANT_PAINT_PROPS.includes(
        relatedExpression.styleProp
      );
      const layer = layers[relatedExpression.layerIndex];
      representedProperties.add(relatedExpression.styleProp, true);
      if (isPaint) {
        const paint = layer.paint!;
        if (relatedExpression.styleProp in paint) {
          return (paint as any)[relatedExpression.styleProp] as Expression;
        } else {
          throw new Error(
            `SignificantExpression returned which references a non-existent paint property. ${relatedExpression.styleProp} ${relatedExpression.usageType}`
          );
        }
      } else {
        const layout = layer.layout!;
        if (relatedExpression.styleProp in layout) {
          return (layout as any)[relatedExpression.styleProp] as Expression;
        } else {
          throw new Error(
            `SignificantExpression returned which references a non-existent layout property. ${relatedExpression.styleProp} ${relatedExpression.usageType}`
          );
        }
      }
    } else {
      // Case #2: related expression is controlled by a different data property
      return blankValue;
    }
  };
  return styleValueOrExpressionForContext;
}

export function getLegendForGLStyleLayers(
  layers: SeaSketchGlLayer[],
  sourceType:
    | "vector"
    | "raster"
    | "geojson"
    | "image"
    | "video"
    | "raster-dem",
  geostats?: Geostats
): LegendForGLLayers {
  if (
    sourceType === "raster" ||
    sourceType === "raster-dem" ||
    sourceType === "image"
  ) {
    return {
      type: "SimpleGLLegend",
      symbol: {
        type: "raster",
      },
    };
  } else if (sourceType === "video") {
    return {
      type: "SimpleGLLegend",
      symbol: {
        type: "video",
      },
    };
  }
  const context = extractLegendContext(layers);
  console.log("context", context);
  if (context.significantExpressions.length === 0 && !context.includesHeatmap) {
    // is simple
    return {
      type: "SimpleGLLegend",
      symbol: getSingleSymbolForVectorLayers(layers),
    };
  } else {
    const legend: MultipleSymbolLegendForGLLayers = {
      type: "MultipleSymbolGLLegend",
      panels: [],
    };
    // Keep track of properties (by layer) that have already been represented in
    // an existing panel so that they are not duplicated. When building symbols
    // this should be passed down so that if, for example, you had one panel
    // representing circle fills and then another breaking down circle stroke by
    // a different data property, that second panel would not include fill.
    const representedProperties = new RepresentedProperties();

    if (context.includesHeatmap) {
      const heatmapLayer = layers.find(
        (l) => l.type === "heatmap"
      ) as HeatmapLayer;
      const paint = heatmapLayer.paint || {};
      legend.panels.push({
        id: "heatmap",
        type: "GLLegendHeatmapPanel",
        stops: interpolationExpressionToStops(paint["heatmap-color"]),
      });
    }

    for (const expression of context.significantExpressions) {
      const styleValueOrExpressionForContext =
        createStyleValueOrExpressionForContextFn(
          context,
          layers,
          representedProperties,
          expression
        );

      // Skip expression if it has already been represented in another panel
      if (representedProperties.has(expression.styleProp)) {
        continue;
      }
      // Skip opacity expressions unless they are the only interesting thing
      // about a set of layers
      if (
        /opacity/.test(expression.styleProp) &&
        context.significantExpressions.length !== 1
      ) {
        continue;
      }
      const layerType = layers[expression.layerIndex].type;
      switch (expression.usageType) {
        case "rampScaleOrCurve":
          const propType = getPropType(expression.styleProp, layerType);
          // # Detect Color Gradients
          if (propType === "color" && /interpolate/.test(expression.fnName)) {
            // gradient
            legend.panels.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `${expression.layerIndex}-${expression.styleProp}-gradient`,
              label: expression.getProp,
              type: "GLLegendGradientPanel",
              stops: interpolationExpressionToStops(
                (layers[expression.layerIndex].paint as any)[
                  expression.styleProp
                ]
              ),
            });
            representedProperties.add(expression.styleProp, true);
            // identify other colors set by the same stops and exclude them from
            // rendering redundant panels
            const otherColors = context.significantExpressions.filter((e) => {
              return (
                e !== expression &&
                e.getProp === expression.getProp &&
                e.usageType === "rampScaleOrCurve" &&
                /interpolate/.test(e.fnName) &&
                hasMatchingStops(e.stops, expression.stops)
              );
            });
            for (const otherColor of otherColors) {
              representedProperties.add(otherColor.styleProp, true);
            }
          } else if (
            propType === "number" &&
            expression.fnName === "interpolate"
          ) {
            // Potential props here:
            // - circle-radius
            // - line-width
            // - circle-stroke-width
            // - fill-extrusion-height
            // Opacity props, if they get here, are the only significant
            // expression in this set of layers
            // - line-opacity
            // - fill-opacity
            // - circle-opacity
            // Don't just rely on this comment. Check SIGNIFICANT_PAINT_PROPS
            // in case of any additions.
            if (
              layerType === "circle" &&
              expression.styleProp === "circle-radius"
            ) {
              // # Bubble Chart
              const stops = expression.stops;
              if (
                stops.length === 2 &&
                expression.interpolationType === "linear" &&
                "input" in stops[0] &&
                "input" in stops[1] &&
                typeof stops[0].output === "number" &&
                typeof stops[1].output === "number"
              ) {
                // add intermediate
                stops.splice(1, 0, {
                  input: (stops[0].input + stops[1].input) / 2,
                  output: (stops[0].output + stops[1].output) / 2,
                });
              }

              const stroke = styleValueOrExpressionForContext(
                "circle-stroke-color",
                "rgba(0, 0, 0, 0.25)"
              );

              const circleColor = styleValueOrExpressionForContext(
                "circle-color",
                "rgba(175, 175, 175)"
              );

              const strokeWidth = styleValueOrExpressionForContext(
                "circle-stroke-width",
                1
              );

              legend.panels.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `${expression.layerIndex}-${expression.styleProp}-bubble`,
                type: "GLLegendBubblePanel",
                label: expression.getProp,
                stops: expression.stops.map((s) => {
                  const value = "input" in s ? s.input : 0;
                  return {
                    value,
                    radius: s.output as number,
                    fill: evaluate(circleColor, {
                      [expression.getProp]: value,
                    }),
                    stroke: evaluate(stroke, { [expression.getProp]: value }),
                    strokeWidth: evaluate(strokeWidth, {
                      [expression.getProp]: value,
                    }),
                  };
                }),
              });
            } else if (/opacity/.test(expression.styleProp)) {
              // Only create a panel just for opacity if there are no other
              // interesting things to represent.
              // TODO:
            } else {
              // test for
            }
          } else if (expression.fnName === "step") {
            // Create a step panel
          }
          break;
        case "decision":
          let layer = layers[expression.layerIndex];
          const fillLayer = layers.find((l) => l.type === "fill");
          if (layer.type === "line" && fillLayer) {
            layer = fillLayer;
          }
          const domains = [...expression.domains];
          // Merge domains from other expressions which have the same getProp
          for (const otherExpression of context.significantExpressions) {
            if (otherExpression === expression) {
              continue;
            }
            if (
              otherExpression.getProp === expression.getProp &&
              otherExpression.usageType === "decision"
            ) {
              for (const entry of otherExpression.domains) {
                const key = entry.comparators.join(",");
                const existing = domains.find(
                  (d) => d.comparators.join(",") === key
                );
                if (!existing) {
                  domains.push(entry);
                }
              }
            }
          }

          // Create a List panel
          legend.panels.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `${expression.layerIndex}-${expression.styleProp}-list`,
            type: "GLLegendListPanel",
            label: expression.getProp,
            items: domains.map((d) => {
              let symbol: GLLegendSymbol;

              switch (layer.type) {
                case "fill":
                  symbol = createFillSymbol(
                    layer as FillLayer,
                    layers.filter((l) => l !== layer),
                    {
                      [expression.getProp]: d.comparators[0],
                    },
                    representedProperties
                  );
                  break;
                case "circle":
                  symbol = createCircleSymbol(
                    layers[expression.layerIndex],
                    [],
                    {
                      [expression.getProp]: d.comparators[0],
                    },
                    representedProperties
                  );
                  break;
                case "line":
                  symbol = createLineSymbol(
                    layers[expression.layerIndex],
                    [],
                    {
                      [expression.getProp]: d.comparators[0],
                    },
                    representedProperties
                  );
                  break;
              }
              return {
                id: d.operator + d.comparators.join(","),
                label: d.isFallback
                  ? "Default"
                  : (((d.operator === "==" ? "" : d.operator) +
                      d.comparators.join(", ")) as string),
                symbol: symbol!,
              };
            }),
          });
          representedProperties.commit();
          break;
        case "literal":
          {
            console.log("literal");
          }
          break;
        case "filter":
          {
            console.log("filter");
          }
          break;
      }
    }

    // TODO: if no panels have been added yet, try inserting a single symbol
    // legend as a fallback
    return legend;
  }
}

function evaluate(
  expression: number | string | Expression,
  featureProps: any,
  geometryType?: "Point" | "Polygon" | "LineString"
) {
  if (isExpression(expression)) {
    geometryType = geometryType || "Point";
    const feature = {
      type: "Feature",
      properties: featureProps,
      geometry: {
        type: geometryType,
        coordinates: [0, 0],
      },
    } as Feature;
    return ExpressionEvaluator.parse(expression).evaluate(feature);
  } else {
    return expression;
  }
}

function hasMatchingStops(a: Stop[], b: Stop[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    // @ts-ignore
    if (a[i].output !== b[i].output || a[i].input !== b[i].input) {
      return false;
    }
  }
  return true;
}

function getPropType(styleProp: string, layerType: string) {
  const isPaintProp = SIGNIFICANT_PAINT_PROPS.includes(styleProp);
  const propDetails =
    // @ts-ignore
    styleSpec[isPaintProp ? "paint_" + layerType : "layout_" + layerType][
      styleProp
    ];
  if (propDetails) {
    return propDetails.type as "enum" | "color" | "number" | "string";
  } else {
    throw new Error("no prop details");
  }
}

/**
 * Converts a mapbox-gl-style interpolation expression to a list of stops that can be used to create a legend.
 * @param expression Mapbox gl style interpolation expression
 * @returns Array<{value: number, color: string}>
 */
function interpolationExpressionToStops(expression?: any) {
  expression =
    expression && isExpression(expression)
      ? expression
      : [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0, 0, 255, 0)",
          0.1,
          "royalblue",
          0.3,
          "cyan",
          0.5,
          "lime",
          0.7,
          "yellow",
          1,
          "red",
        ];
  const stops: { value: number; color: string; label: string }[] = [];
  if (expression[0] === "interpolate") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [interpolationType, property, ...args] = expression;
    if (interpolationType === "interpolate") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [input, ...stopPairs] = args;
      for (let i = 0; i < stopPairs.length; i += 2) {
        stops.push({
          value: stopPairs[i],
          color: stopPairs[i + 1],
          label: stopPairs[i],
        });
      }
    }
  }
  return stops;
}

function getPaintProp(
  paint: any,
  propName: string,
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties,
  defaultIfAlreadyRepresented?: number | string | boolean
) {
  if (representedProperties && representedProperties.has(propName)) {
    return defaultIfAlreadyRepresented;
  }
  const type = propName.split("-")[0];
  if (propName in paint) {
    const value = paint[propName];
    if (isExpression(value)) {
      if (representedProperties && hasGetExpression(value)) {
        representedProperties.add(propName);
      }
      // evaluate expression using featureData
      return ExpressionEvaluator.parse(value).evaluate({
        type: "Feature",
        properties: featureData || {},
        geometry: {
          type: "Point",
          coordinates: [1, 2],
        },
      });
    } else {
      return value;
    }
  }
  // @ts-ignore
  const defaultForProp = styleSpec["paint_" + type][propName]["default"];
  return defaultForProp || undefined;
}

function getLayoutProp(
  layout: any,
  type: string,
  propName: string,
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties,
  defaultIfAlreadyRepresented?: number | string
) {
  if (representedProperties && isRepresented(propName, representedProperties)) {
    return defaultIfAlreadyRepresented;
  }
  if (propName in layout) {
    const value = layout[propName];
    if (isExpression(value)) {
      // evaluate expression using featureData
      return ExpressionEvaluator.parse(value).evaluate({
        type: "Feature",
        properties: featureData || {},
        geometry: {
          type: "Point",
          coordinates: [1, 2],
        },
      });
    } else {
      return value;
    }
  }
  // @ts-ignore
  const defaultForProp = styleSpec["layout_" + type][propName]["default"];
  return defaultForProp || undefined;
}

interface SignificantLiteralExpression {
  layerIndex: number;
  styleProp: string;
  getProp: string;
  usageType: "literal";
  rank: number;
}

type Operator = "<" | "<=" | ">" | ">=" | "==" | "!=" | "!";

interface SignificantExpressionDomain {
  operator: Operator;
  comparators: any[];
  isFallback?: boolean;
}

interface SignificantDecisionExpression {
  layerIndex: number;
  styleProp: string;
  getProp: string;
  usageType: "decision";
  fnName: "case" | "match";
  domains: SignificantExpressionDomain[];
  rank: number;
}

type Stop =
  | { input: number; output: string | number }
  | { output: string | number; isDefault: true };

interface SignificantRampScaleOrCurveExpression {
  layerIndex: number;
  styleProp: string;
  getProp: string;
  usageType: "rampScaleOrCurve";
  fnName: "interpolate" | "interpolate-hcl" | "interpolate-lab" | "step";
  stops: Stop[];
  rank: number;
  interpolationType?: "linear" | "exponential" | "log";
}

interface SignificantFilterExpression {
  layerIndex: number;
  styleProp: string;
  getProp: string;
  usageType: "filter";
  domains: SignificantExpressionDomain[];
  rank: 0;
}

type SignificantExpression =
  | SignificantLiteralExpression
  | SignificantDecisionExpression
  | SignificantRampScaleOrCurveExpression
  | SignificantFilterExpression;

type SeaSketchGlLayer = Omit<Layer, "id" | "source">;

interface LegendContext {
  globalContext: {
    zoomRanges: { layerIndex: number; zoomRange: [number, number] }[];
  };
  significantExpressions: SignificantExpression[];
  includesHeatmap: boolean;
}

function extractLegendContext(
  layers: SeaSketchGlLayer[],
  geostats?: Geostats
): LegendContext {
  const results: LegendContext = {
    globalContext: {
      zoomRanges: [],
    },
    significantExpressions: [],
    includesHeatmap: false,
  };
  for (const layer of layers) {
    if (layer.type === "heatmap") {
      results.includesHeatmap = true;
    }
    // First, find all the filter expressions since they are easy
    // TODO: implement
    if (layer.filter && isExpression(layer.filter)) {
    }
    if (layer.paint) {
      for (const prop of SIGNIFICANT_PAINT_PROPS) {
        if (prop in layer.paint) {
          const value = (layer.paint as any)[prop];
          if (isExpression(value)) {
            const expressionDetails = extractExpressionDetails(
              prop,
              value,
              layers.indexOf(layer)
            );
            if (expressionDetails) {
              results.significantExpressions.push(expressionDetails);
            }
          }
        }
      }
    }
    if (layer.layout) {
      for (const prop of SIGNIFICANT_LAYOUT_PROPS) {
        if (prop in layer.layout) {
          const value = (layer.layout as any)[prop];
          if (isExpression(value)) {
            const expressionDetails = extractExpressionDetails(
              prop,
              value,
              layers.indexOf(layer)
            );
            if (expressionDetails) {
              results.significantExpressions.push(expressionDetails);
            }
          }
        }
      }
    }
  }
  results.significantExpressions.sort((a, b) => a.rank - b.rank);
  return results;
}

interface ParentExpressionContext {
  fnName: string;
  expression: Expression;
  parent?: ParentExpressionContext;
}

function getUsageContextFromContext(parent?: ParentExpressionContext):
  | {
      usageType: "decision" | "rampScaleOrCurve" | "filter";
      parentExpression: Expression;
    }
  | { usageType: "literal" } {
  if (!parent) {
    return { usageType: "literal" };
  } else {
    switch (parent.fnName) {
      case "case":
      case "match":
        return { usageType: "decision", parentExpression: parent.expression };
      case "interpolate":
      case "interpolate-hcl":
      case "interpolate-lab":
      case "step":
        return {
          usageType: "rampScaleOrCurve",
          parentExpression: parent.expression,
        };
      default:
        return getUsageContextFromContext(parent.parent);
    }
  }
}

function stopsFromInterpolation(expression: Expression) {
  if (/interpolate/.test(expression[0])) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fnName, interpolationType, input, ...inputOutputPairs] = expression;
    const stops: Stop[] = [];
    for (let i = 0; i < inputOutputPairs.length; i++) {
      if (i % 2 === 0) {
        stops.push({
          input: inputOutputPairs[i],
          output: inputOutputPairs[i + 1],
        });
      }
    }
    return stops;
  } else {
    throw new Error(`Expected interpolation expression. Got ${expression[0]}`);
  }
}

function stopsFromStepExpression(expression: Expression) {
  if (expression[0] === "step") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fnName, input, firstOutput, ...inputOutputPairs] = expression;
    const stops: Stop[] = [];
    stops.push({ output: firstOutput, isDefault: true });
    for (const pair of inputOutputPairs) {
      stops.push({ input: pair[0], output: pair[1] });
    }
    return stops;
  } else {
    throw new Error(`Expected step expression. Got ${expression[0]}`);
  }
}

function extractExpressionDetails(
  styleProp: string,
  propertyValue: any,
  layerIndex: number,
  parent?: ParentExpressionContext
): SignificantExpression | null {
  if (!isExpression(propertyValue)) {
    return null;
  } else if (propertyValue[0] === "get") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_get, getProp, defaultFallbackValue] = propertyValue;
    // found get expression!
    // first find the usage type
    const context = getUsageContextFromContext(parent);
    const rank =
      SIGNIFICANT_PAINT_PROPS.indexOf(styleProp) > -1
        ? SIGNIFICANT_PAINT_PROPS.indexOf(styleProp)
        : SIGNIFICANT_LAYOUT_PROPS.indexOf(styleProp);
    const knownProps = { styleProp, rank, layerIndex };
    switch (context.usageType) {
      case "literal":
        return {
          ...knownProps,
          getProp,
          usageType: context.usageType,
        };
      case "rampScaleOrCurve":
        const { usageType, parentExpression } = context;
        const [fnName, ...args] = parentExpression;
        switch (fnName) {
          case "interpolate":
          case "interpolate-hcl":
          case "interpolate-lab": {
            return {
              ...knownProps,
              usageType,
              getProp,
              fnName,
              stops: stopsFromInterpolation(parentExpression),
              interpolationType:
                args.length > 0 && args[0].length > 0 ? args[0][0] : undefined,
            };
          }
          case "step": {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [input, firstOutput, ...inputOutputPairs] = args;
            return {
              ...knownProps,
              usageType,
              getProp,
              fnName,
              stops: stopsFromStepExpression(parentExpression),
            };
          }
          default:
            throw new Error(
              `Unknown ramp, scale or curve expression "${fnName}"`
            );
        }
      case "decision":
        if (context.parentExpression[0] === "match") {
          // Simpler of the two, enumerates entire domain
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_match, input, ...inputOutputPairsAndFallback] =
            context.parentExpression;
          const inputOutputPairs = inputOutputPairsAndFallback.slice(
            0,
            inputOutputPairsAndFallback.length - 1
          );
          const domains: SignificantExpressionDomain[] = [];
          for (let i = 0; i < inputOutputPairs.length; i++) {
            if (i % 2 === 0) {
              domains.push({
                operator: "==",
                comparators: [inputOutputPairs[i]],
              });
            }
          }
          // Add default fallback value
          const lastValueInDomain = domains[domains.length - 1].comparators[0];
          domains.push({
            // Add a default. Every match function has a default
            operator: "==",
            comparators: [
              typeof lastValueInDomain === "number"
                ? lastValueInDomain + 99999
                : "__glLegendDefaultValue",
            ],
            isFallback: true,
          });

          return {
            ...knownProps,
            usageType: context.usageType,
            getProp,
            fnName: "match",
            domains,
          };
        } else if (context.parentExpression[0] === "case") {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_case, ...args] = context.parentExpression;
          const conditionsAndOutputs = args.slice(0, args.length - 1);
          const domains: SignificantExpressionDomain[] = [];
          for (let i = 0; i < conditionsAndOutputs.length; i++) {
            if (i % 2 === 0) {
              const condition = conditionsAndOutputs[i];
              if (isExpression(condition)) {
                const { isSimple, comparatorIndex } = isSimpleCondition(
                  condition,
                  getProp
                );
                const [conditionFnName, ...conditionArgs] = condition;
                if (isSimple) {
                  domains.push({
                    operator: conditionFnName as Operator,
                    comparators:
                      comparatorIndex !== undefined && comparatorIndex > -1
                        ? [conditionArgs[comparatorIndex!]]
                        : [],
                  });
                }
              }
            }
          }
          // Add fallback
          const lastValueInDomain = domains[domains.length - 1].comparators[0];

          domains.push({
            operator: "==",
            comparators: [
              typeof lastValueInDomain === "number"
                ? lastValueInDomain + 99999
                : "__glLegendDefaultValue",
            ],
            isFallback: true,
          });
          return {
            ...knownProps,
            usageType: context.usageType,
            getProp,
            fnName: "case",
            domains,
          };
        }
    }
  } else {
    // it's an expression, but we don't know what kind. Drill down into args
    // looking for a get expression
    const currentContext: ParentExpressionContext = {
      fnName: propertyValue[0],
      expression: propertyValue,
      parent,
    };
    for (const arg of propertyValue.slice(1)) {
      const details = extractExpressionDetails(
        styleProp,
        arg,
        layerIndex,
        currentContext
      );
      if (details !== null) {
        return details;
      }
    }
  }
  return null;
}

/**
 * Returns whether the given condition is a simple condition that directly
 * compares the named feature property to a literal value. Simple type
 * conversion like to-number can wrap property access but nothing else.
 * @param condition
 * @param featurePropertyName
 */
function isSimpleCondition(condition: Expression, featurePropertyName: string) {
  const [fnName, ...args] = condition;
  if (["==", "!=", "<", "<=", ">", ">=", "!"].includes(fnName)) {
    const getArgIndex = args.findIndex((arg) => isSimpleGetArg(arg));
    if (getArgIndex === -1) {
      return { isSimple: false };
    } else {
      // Special case with no comparator
      if (fnName === "!") {
        return { isSimple: true, comparatorIndex: -1 };
      }
      const comparatorIndex = getArgIndex === 0 ? 1 : 0;
      if (isExpression(args[comparatorIndex])) {
        // Unexpected situation.
        return { isSimple: false };
      } else {
        return { isSimple: true, comparatorIndex };
      }
    }
  } else {
    return { isSimple: false };
  }
}

function isSimpleGetArg(arg: any): boolean {
  if (isExpression(arg)) {
    const [fnName, ...args] = arg;
    if (fnName === "get") {
      return true;
    } else if (/to-/.test(fnName)) {
      return isSimpleGetArg(args[0]);
    }
  }
  return false;
}

export function isExpression(e: any): e is Expression {
  return Array.isArray(e) && typeof e[0] === "string";
}

export function findGetExpression(
  expression: any
): null | { type: "legacy" | "get"; property: string } {
  if (!isExpression(expression)) {
    return null;
  }
  if (expression[0] === "get") {
    return { type: "get", property: expression[1] };
  } else {
    for (const arg of expression.slice(1)) {
      if (isExpression(arg)) {
        const found = findGetExpression(arg);
        if (found !== null) {
          return found;
        }
      }
    }
  }
  return null;
}

export function hasGetExpression(expression: any): boolean {
  const get = findGetExpression(expression);
  return get ? true : false;
}

function getSingleSymbolForVectorLayers(
  layers: SeaSketchGlLayer[]
): GLLegendSymbol {
  // Last layer in the array is the top-most layer, so it should be the primary
  layers = [...layers].reverse();
  // determine primary symbol type
  const fillLayer = layers.find(
    (layer) => layer.type === "fill" || layer.type === "fill-extrusion"
  ) as FillLayer | FillExtrusionLayer | undefined;
  if (fillLayer && layerIsVisible(fillLayer)) {
    return createFillSymbol(
      fillLayer,
      layers.filter((l) => l !== fillLayer),
      {}
    );
  }
  const lineLayer = layers.find((layer) => layer.type === "line") as LineLayer;
  if (lineLayer && layerIsVisible(lineLayer)) {
    return createLineLayer(
      lineLayer,
      layers.filter((l) => l !== lineLayer),
      {}
    );
  }
  const circleLayer = layers.find((layer) => layer.type === "circle");
  if (circleLayer && layerIsVisible(circleLayer)) {
    return createCircleSymbol(
      circleLayer,
      layers.filter((l) => l !== circleLayer),
      {}
    );
  }
  const symbolLayer = layers.find((layer) => layer.type === "symbol");
  if (symbolLayer && layerIsVisible(symbolLayer)) {
    const layout = (symbolLayer.layout || {}) as any;
    const iconImage = layout["icon-image"];
    if (iconImage) {
      return createMarkerSymbol(
        symbolLayer,
        layers.filter((l) => l !== symbolLayer)
      );
    } else if (layout["text-field"]) {
      return createTextSymbol(
        symbolLayer,
        layers.filter((l) => l !== symbolLayer),
        {}
      );
    }
  }
  throw new Error("Not implemented");
}

function createMarkerSymbol(
  symbolLayer: SeaSketchGlLayer,
  otherLayers: SeaSketchGlLayer[]
): GLLegendMarkerSymbol {
  const paint = (symbolLayer.paint || {}) as any;
  const layout = (symbolLayer.layout || {}) as any;
  const iconImage = layout["icon-image"];
  const iconSize = layout["icon-size"] || 1;
  const rotation = layout["icon-rotate"];
  const haloColor = paint["text-halo-color"];
  const haloWidth = paint["text-halo-width"];
  return {
    type: "marker",
    imageId: iconImage,
    haloColor,
    haloWidth,
    rotation,
    iconSize,
  };
}

function createTextSymbol(
  symbolLayer: SeaSketchGlLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties
): GLLegendTextSymbol {
  const paint = (symbolLayer.paint || {}) as any;
  const layout = (symbolLayer.layout || {}) as any;
  const color = getPaintProp(
    paint,
    "text-color",
    featureData,
    representedProperties,
    "#000"
  );
  const fontFamily = getLayoutProp(
    layout,
    "symbol",
    "text-font",
    featureData,
    representedProperties,
    "Open Sans Regular"
  );
  const haloColor = getPaintProp(
    paint,
    "text-halo-color",
    featureData,
    representedProperties,
    "transparent"
  );
  const haloWidth = getPaintProp(
    paint,
    "text-halo-width",
    featureData,
    representedProperties,
    0
  );
  return {
    type: "text",
    color,
    fontFamily: Array.isArray(fontFamily) ? fontFamily[0] : fontFamily,
    fontWeight: /bold/.test(fontFamily) ? "bold" : "normal",
    fontStyle: /italic/.test(fontFamily) ? "italic" : "normal",
    haloColor,
    haloWidth,
  };
}
function createLineSymbol(
  lineLayer: SeaSketchGlLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties
): GLLegendLineSymbol {
  const paint = (lineLayer.paint || {}) as any;
  const color = getPaintProp(
    paint,
    "line-color",
    featureData,
    representedProperties,
    "#000"
  );
  const opacity = getPaintProp(
    paint,
    "line-opacity",
    featureData,
    representedProperties,
    1
  );
  const width = getPaintProp(
    paint,
    "line-width",
    featureData,
    representedProperties,
    1
  );
  const dasharray = getPaintProp(
    paint,
    "line-dasharray",
    featureData,
    representedProperties,
    false
  );
  return {
    type: "line",
    color,
    opacity,
    strokeWidth: width,
    dashed: dasharray,
  };
}

function createCircleSymbol(
  circleLayer: SeaSketchGlLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties
): GLLegendCircleSymbol {
  const paint = (circleLayer.paint || {}) as any;
  const fillOpacity = getPaintProp(
    paint,
    "circle-opacity",
    featureData,
    representedProperties,
    1
  );
  const strokeWidth = getPaintProp(
    paint,
    "circle-stroke-width",
    featureData,
    representedProperties,
    1
  );
  const strokeColor = getPaintProp(
    paint,
    "circle-stroke-color",
    featureData,
    representedProperties,
    "#000"
  );
  const strokeOpacity = getPaintProp(
    paint,
    "circle-stroke-opacity",
    featureData,
    representedProperties,
    1
  );
  const color = getPaintProp(
    paint,
    "circle-color",
    featureData,
    representedProperties,
    "transparent"
  );

  const radius = getPaintProp(
    paint,
    "circle-radius",
    featureData,
    representedProperties,
    5
  );
  return {
    radius,
    type: "circle",
    color,
    fillOpacity,
    strokeWidth,
    strokeColor,
    strokeOpacity,
  };
}

function isRepresented(
  styleProp: string,
  representedProperties?: RepresentedProperties
) {
  if (!representedProperties) {
    return false;
  } else {
    return representedProperties.has(styleProp);
  }
}

function createFillSymbol(
  fillLayer: FillLayer | FillExtrusionLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties
): GLLegendFillSymbol {
  const paint = (fillLayer.paint || {}) as any;
  const extruded = fillLayer.type === "fill-extrusion";
  const opacity = extruded
    ? getPaintProp(
        paint,
        "fill-extrusion-opacity",
        featureData,
        representedProperties,
        1
      )
    : getPaintProp(
        paint,
        "fill-opacity",
        featureData,
        representedProperties,
        1
      );
  let strokeWidth = paint["fill-outline-color"] ? 1 : 0;
  let strokeColor = getPaintProp(
    paint,
    "fill-outline-color",
    featureData,
    representedProperties,
    "transparent"
  );
  const lineLayer = otherLayers.find((layer) => layer.type === "line") as
    | Layer
    | undefined;
  let dashedLine = false;
  let strokeOpacity: number | undefined;
  if (lineLayer) {
    const linePaint = (lineLayer.paint || {}) as any;
    strokeWidth = getPaintProp(
      linePaint,
      "line-width",
      featureData,
      representedProperties,
      1
    );
    strokeColor = getPaintProp(
      linePaint,
      "line-color",
      featureData,
      representedProperties,
      "#000"
    );
    dashedLine = getPaintProp(
      linePaint,
      "line-dasharray",
      featureData,
      representedProperties,
      false
    );
    strokeOpacity = getPaintProp(
      linePaint,
      "line-opacity",
      featureData,
      representedProperties,
      1
    );
  }
  const color = extruded
    ? getPaintProp(
        paint,
        "fill-extrusion-color",
        featureData,
        representedProperties,
        "rgba(0,0,0,0.2)"
      )
    : getPaintProp(
        paint,
        "fill-color",
        featureData,
        representedProperties,
        "rgba(0,0,0,0.2)"
      );
  return {
    type: "fill",
    color,
    extruded: fillLayer.type === "fill-extrusion" ? true : false,
    fillOpacity: opacity,
    strokeWidth,
    dashed: dashedLine,
    strokeColor,
    strokeOpacity,
    patternImageId: extruded
      ? getPaintProp(
          paint,
          "fill-extrusion-pattern",
          featureData,
          representedProperties,
          undefined
        )
      : getPaintProp(
          paint,
          "fill-pattern",
          featureData,
          representedProperties,
          undefined
        ),
  };
}

function createLineLayer(
  lineLayer: LineLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any }
): GLLegendLineSymbol {
  const paint = (lineLayer.paint || {}) as any;
  const opacity = getPaintProp(paint, "line-opacity", featureData);
  const strokeWidth = getPaintProp(paint, "line-width", featureData);
  const strokeColor = getPaintProp(paint, "line-color", featureData);
  const dashedLine = paint["line-dasharray"] || false;

  return {
    type: "line",
    color: strokeColor,
    strokeWidth,
    dashed: dashedLine,
    opacity,
    patternImageId: getPaintProp(paint, "line-pattern", featureData),
  };
}

function layerIsVisible(layer: Pick<Layer, "layout">) {
  if ("layout" in layer && layer.layout?.visibility) {
    return layer.layout.visibility !== "none";
  } else {
    return true;
  }
}

// type can be "woodland", "scrub", or "desert"
// What's important to get right here?
// * habitat fill color by type
// * Ideally the stroke for all these as well, though that filter is a problem
// * The extra thick red stroke for the protected area is important. It would
//   probably make sense as a seperate panel, but is that generalizable? How
//   would you handle the stroke interpolation as well?
const FillStyledWithCaseExpression = [
  {
    id: "fill-styled-with-case-expression",
    type: "fill",
    source: "land-parcels",
    paint: {
      "fill-color": [
        "match",
        ["get", "habitat"],
        "woodland",
        "green",
        "scrub",
        "yellow",
        "blue",
      ],
      "fill-opacity": 0.5,
    },
  },
  {
    id: "fill-styled-with-case-expression-stroke",
    type: "line",
    source: "land-parcels",
    paint: {
      "line-color": [
        "case",
        ["==", ["get", "habitat"], "woodland"],
        "darkgreen",
        "black",
      ],
      "line-width": 1,
    },
    filter: ["!=", ["get", "habitat"], "scrub"],
  },
  {
    id: "fill-styled-with-case-expression-thick-stroke",
    type: "line",
    source: "land-parcels",
    paint: {
      "line-color": ["case", ["get", "protected_area"], "red", "white"],
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "size_sq_km"],
        1,
        3,
        5,
        5,
      ],
    },
  },
];

const expressionGlobals = {
  zoom: 14,
};

/** A color as returned by a Mapbox style expression. All values are in [0, 1] */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface TypeMap {
  string: string;
  number: number;
  color: RGBA;
  boolean: boolean;
  [other: string]: any;
}

// Copied from https://gist.github.com/danvk/4378b6936f9cd634fc8c9f69c4f18b81
/**
 * Class for working with Mapbox style expressions.
 *
 * See https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions
 */
export class ExpressionEvaluator<T> {
  /**
   * Parse a Mapbox style expression.
   *
   * Pass an expected type to get tigher error checking and more precise types.
   */
  static parse<T extends expression.StylePropertyType>(
    expr:
      | number
      | string
      | Readonly<StyleFunction>
      | Readonly<MapboxExpression>
      | undefined,
    expectedType?: T
  ): ExpressionEvaluator<TypeMap[T]> {
    // For details on use of this private API and plans to publicize it, see
    // https://github.com/mapbox/mapbox-gl-js/issues/7670
    let parseResult: expression.ParseResult;
    if (expectedType) {
      parseResult = expression.createExpression(expr, { type: expectedType });
      if (parseResult.result === "success") {
        return new ExpressionEvaluator<TypeMap[T]>(parseResult.value);
      }
    } else {
      parseResult = expression.createExpression(expr);
      if (parseResult.result === "success") {
        return new ExpressionEvaluator<any>(parseResult.value);
      }
    }

    throw parseResult.value[0];
  }

  constructor(public parsedExpression: expression.StyleExpression) {}

  evaluate(feature: Feature): T {
    return this.parsedExpression.evaluate(expressionGlobals, feature);
  }
}
