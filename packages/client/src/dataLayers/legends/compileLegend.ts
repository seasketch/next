import { Feature } from "geojson";
import {
  CircleLayer,
  Expression,
  FillExtrusionLayer,
  FillLayer,
  HeatmapLayer,
  Layer,
  LineLayer,
} from "mapbox-gl";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { Geostats } from "../../admin/data/GLStyleEditor/GeostatsModal";
import { ExpressionEvaluator, RGBA } from "./ExpressionEvaluator";
import {
  GLLegendBubblePanel,
  GLLegendCircleSymbol,
  GLLegendFillSymbol,
  GLLegendGradientPanel,
  GLLegendHeatmapPanel,
  GLLegendLineSymbol,
  GLLegendListPanel,
  GLLegendMarkerSymbol,
  GLLegendPanel,
  GLLegendSimpleSymbolPanel,
  GLLegendStepPanel,
  GLLegendSymbol,
  GLLegendTextSymbol,
  GLMarkerSizePanel,
  LegendForGLLayers,
  MultipleSymbolLegendForGLLayers,
} from "./LegendDataModel";
import cloneDeep from "lodash.clonedeep";
import {
  pluckGetExpressionsOfType,
  isExpression,
  hasGetExpression,
  findGetExpression,
  hasGetExpressionForProperty,
  NULLIFIED_EXPRESSION_OUTPUT_NUMBER,
  NULLIFIED_EXPRESSION_OUTPUT_STRING,
} from "./utils";
import isEqual from "lodash.isequal";

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
  "circle-opacity",
];

const SIGNIFICANT_LAYOUT_PROPS = ["icon-image", "icon-size"];

export function compileLegendFromGLStyleLayers2(
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
  let legendItems: { panel: GLLegendPanel; filters: Expression[] }[] = [];

  // Iterate through each of the possible complex panel types, creating them
  // as found. When creating these panels, layers and style properties are
  // "plucked" from the list so that they aren't repeated.
  // If panels require additional data conditions to be met, those are added
  // to the filters array.
  const clonedLayers = cloneDeep(layers);
  const context = { layers: clonedLayers };

  legendItems.push(...pluckHeatmapPanels(context));
  legendItems.push(...pluckBubblePanels(context));
  // TODO: marker size panel. basically the same as bubble panel
  legendItems.push(...pluckGradientPanels(context));
  legendItems.push(...pluckStepPanels(context));
  legendItems.push(...pluckListPanels(context));

  legendItems.push(...pluckFilterPanels(context));
  // TODO: consolidate filters and nest into filter panels
  let panels = consolidatePanels(legendItems);

  // TODO: cull any empty panels with no items
  const culled: GLLegendPanel[] = [];
  for (const panel of panels) {
    switch (panel.type) {
      case "GLLegendListPanel":
      case "GLLegendSimpleSymbolPanel":
        if (panel.items.length === 0) {
          culled.push(panel);
        }
        break;
      case "GLLegendStepPanel":
        if (panel.steps.length === 0) {
          culled.push(panel);
        }
        break;
    }
  }
  panels = panels.filter((p) => !culled.includes(p));

  if (legendItems.length === 0) {
    return {
      type: "SimpleGLLegend",
      symbol: getSingleSymbolForVectorLayers(layers),
    };
  } else {
    return {
      type: "MultipleSymbolGLLegend",
      panels,
    };
  }
}

function consolidatePanels(
  items: {
    panel: GLLegendPanel;
    filters: Expression[];
  }[]
): GLLegendPanel[] {
  const unfilteredPanels: { panel: GLLegendPanel; filters: Expression[] }[] =
    [];
  for (const item of items) {
    // first, look to see if there are any existing panels that it can be
    // merged into.
    if (
      item.panel.type === "GLLegendSimpleSymbolPanel" &&
      item.panel.items[0].label &&
      item.panel.items.length === 1
    ) {
      // look for existing list panels with matching filters and label
      const existing = unfilteredPanels.find(
        (i) =>
          i.panel.type === "GLLegendListPanel" &&
          isEqual(i.filters, item.filters) &&
          i.panel.label === (item.panel as GLLegendListPanel).label
      );
      if (existing) {
        (existing.panel as GLLegendListPanel).items.push({
          id:
            item.panel.id +
            "-" +
            (existing.panel as GLLegendListPanel).items.length,
          label: item.panel.label!,
          symbol: item.panel.items[0].symbol,
        });
        continue;
      }
    } else if (
      item.panel.type === "GLLegendSimpleSymbolPanel" &&
      item.panel.label &&
      items.find(
        (i) =>
          i.panel.type === "GLLegendSimpleSymbolPanel" &&
          isEqual(i.filters, item.filters)
      )
    ) {
      // There are other simple symbol panels with the same filters, so
      // start a new list panel
      unfilteredPanels.push({
        filters: item.filters,
        panel: {
          id: item.panel.id + "-list",
          type: "GLLegendListPanel",
          label: item.panel.label,
          items: [
            {
              id: item.panel.id + "-0",
              label: item.panel.label,
              symbol: item.panel.items[0].symbol,
            },
          ],
        },
      });
      continue;
    }
    unfilteredPanels.push({ panel: item.panel, filters: item.filters });
  }
  return unfilteredPanels.map((i) => i.panel);
}

/**
 * For a given facet, reads the filter expressions and produces
 * a GeoJSON properties object that would pass all those filters
 * @param facet
 */
export function propsForFilterExpressions(filters: Expression[]) {
  const featureProps: { [prop: string]: any } = {};
  // Read filters and create props that would pass them all
  for (const filter of filters) {
    if (filter[0] === "any") {
      const filterProps = propsForSimpleFilter(filter[1][0]);
      for (const prop in filterProps) {
        featureProps[prop] = filterProps[prop];
      }
      throw new Error("Not supported");
    } else if (filter[0] === "all") {
      throw new Error("Not supported");
    } else {
      const filterProps = propsForSimpleFilter(filter);
      for (const prop in filterProps) {
        featureProps[prop] = filterProps[prop];
      }
    }
  }
  return featureProps;
}

function propsForSimpleFilter(filter: Expression) {
  if (filter[0] === "all" || filter[0] === "any") {
    throw new Error(
      "propsForSimpleFilter should not be called with all or any expressions"
    );
  }
  const featureProps: { [prop: string]: any } = {};
  let getInfo = {
    position: 0,
    prop: "",
  };
  if (filter[0] === "has") {
    featureProps[filter[1]] = "__has";
    return featureProps;
  }
  if (isExpression(filter[1]) && filter[1][0] === "get") {
    getInfo.position = 0;
    getInfo.prop = filter[1][1];
  } else if (isExpression(filter[2]) && filter[2][0] === "get") {
    getInfo.position = 1;
    getInfo.prop = filter[2][1];
  } else {
    throw new Error("Could not find get expression in filter");
  }
  let propType = typeof filter[getInfo.position === 0 ? 2 : 1];
  switch (filter[0]) {
    case "==":
      featureProps[getInfo.prop] = filter[getInfo.position === 0 ? 2 : 1];
      break;
    case "!=":
      featureProps[getInfo.prop] =
        propType === "number" ? -38574326900913 : "___ne";
      break;
    // @ts-ignore
    case "!has":
      delete featureProps[getInfo.prop];
      break;
    case ">":
    case ">=":
      featureProps[getInfo.prop] =
        filter[getInfo.position === 0 ? 2 : 1] + 0.00001;
      break;
    case "<":
    case "<=":
      featureProps[getInfo.prop] =
        filter[getInfo.position === 0 ? 2 : 1] - 0.00001;
      break;
    case "!":
      featureProps[getInfo.prop] = false;
      break;
    case "in":
      featureProps[getInfo.prop] = filter[getInfo.position === 0 ? 2 : 1];
      break;
    default:
      throw new Error(`Unsupported filter operator "${filter[0]}"`);
  }
  return featureProps;
}

export function pluckBubblePanels(context: { layers: SeaSketchGlLayer[] }) {
  const panels: { panel: GLLegendBubblePanel; filters: Expression[] }[] = [];
  // Look for circle layers with a circle-radius expression
  const circleLayers = context.layers.filter(
    (l) => l.type === "circle" && l.layout?.visibility !== "none"
  ) as CircleLayer[];
  for (const layer of circleLayers) {
    // TODO: merge filter with facet
    if (layer.paint) {
      const radius = layer.paint["circle-radius"];
      if (radius) {
        const exprData = pluckGetExpressionsOfType(
          radius,
          "interpolate",
          "number"
        );
        if (exprData.facets.length) {
          const representedProperties = new RepresentedProperties();
          // the "plucking" part, removes bubble chart related values from layer
          layer.paint["circle-radius"] = exprData.remainingValues;
          representedProperties.add("circle-radius");
          representedProperties.commit();
          for (const facet of exprData.facets) {
            const featureProps = propsForFilterExpressions(facet.filters);
            const facetFilters = isExpression(layer.filter)
              ? [layer.filter, ...facet.filters]
              : facet.filters;
            const interpolate = facet.expression;
            let stops = stopsFromInterpolation(interpolate);
            // limit stops to 3 in bubble charts
            if (stops.length > 3) {
              stops = [
                stops[0],
                stops[Math.floor(stops.length / 2)],
                stops[stops.length - 1],
              ];
            } else if (stops.length === 2) {
              // add a midpoint stop
              stops = [
                stops[0],
                {
                  // @ts-ignore
                  input: (stops[0].input + stops[1].input) / 2,
                  // @ts-ignore
                  output: (stops[0].output + stops[1].output) / 2,
                },
                stops[1],
              ];
            }
            // construct a bubble panel
            panels.push({
              panel: {
                // eslint-disable-next-line i18next/no-literal-string
                id: `bubble-${circleLayers.indexOf(
                  layer
                )}-${exprData.facets.indexOf(facet)}`,
                type: "GLLegendBubblePanel",
                label: interpolate[2][1],
                stops: stops
                  .filter((s) => "input" in s)
                  .map((s) => {
                    if (!("input" in s)) {
                      throw new Error("Stop lacks input");
                    }
                    const featureData = {
                      ...featureProps,
                      [interpolate[2][1]]: s.input,
                    };
                    return {
                      fill: evaluateLayerProperty(
                        layer,
                        "paint",
                        "circle-color",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      radius: s.output as number,
                      stroke: evaluateLayerProperty(
                        layer,
                        "paint",
                        "circle-stroke-color",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      strokeWidth: evaluateLayerProperty(
                        layer,
                        "paint",
                        "circle-stroke-width",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      value: s.input,
                      fillOpacity: evaluateLayerProperty(
                        layer,
                        "paint",
                        "circle-opacity",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                    };
                  }),
              },
              filters: facetFilters,
            });
          }
          representedProperties.commit();
          // remove the layer if it's been fully represented by the bubble chart
          let hasRemainingGetExpressions = false;
          const paint: any = layer.paint || {};
          for (const prop of [
            "circle-color",
            "circle-stroke-width",
            "circle-stroke-color",
            "circle-opacity",
          ]) {
            if (
              prop in paint &&
              hasGetExpression(paint[prop]) &&
              !representedProperties.has(prop)
            ) {
              hasRemainingGetExpressions = true;
            }
          }
          if (!hasRemainingGetExpressions) {
            context.layers = context.layers.filter((l) => l !== layer);
          }
        }
      }
    }
  }
  return panels;
}

export function pluckHeatmapPanels(context: { layers: SeaSketchGlLayer[] }) {
  const panels: { panel: GLLegendHeatmapPanel; filters: Expression[] }[] = [];
  let newLayers = [...context.layers];
  for (const layer of context.layers) {
    if (layer.type === "heatmap") {
      newLayers = newLayers.filter((l) => l !== layer);
      const paint = layer.paint || ({} as any);
      const exprData = pluckGetExpressionsOfType(
        paint["heatmap-color"],
        "interpolate",
        // @ts-ignore
        ["interpolate"],
        { targetExpressionMustIncludeGet: false }
      );
      if (exprData.facets.length === 0) {
        const filters =
          layer.filter && isExpression(layer.filter) ? [layer.filter] : [];
        panels.push({
          panel: {
            id: "heatmap",
            type: "GLLegendHeatmapPanel",
            stops: interpolationExpressionToStops(paint["heatmap-color"]),
          },
          filters,
        });
      } else {
        for (const facet of exprData.facets) {
          const facetFilters = isExpression(layer.filter)
            ? [layer.filter, ...facet.filters]
            : facet.filters;
          panels.push({
            panel: {
              id: "heatmap",
              type: "GLLegendHeatmapPanel",
              stops: interpolationExpressionToStops(facet.expression),
            },
            filters: facetFilters,
          });
        }
      }
    }
  }
  context.layers = newLayers;
  return panels;
}

export function pluckGradientPanels(context: { layers: SeaSketchGlLayer[] }) {
  const panels: { panel: GLLegendGradientPanel; filters: Expression[] }[] = [];
  let remainingLayers = [...context.layers];
  for (const layer of context.layers) {
    if (
      ["fill", "line", "fill-extrusion", "circle", "symbol"].includes(
        layer.type
      )
    ) {
      // look for gradient expressions, ordered by priority
      const paint = layer.paint || ({} as any);
      for (const paintProp of [
        "fill-color",
        "fill-extrusion-color",
        "circle-color",
        "line-color",
        "icon-color",
        // fill outline color is so faint I can't see anyone using it
        // as the primary means of communicating data, so I'm ommiting it
        // "fill-outline-color",
      ]) {
        if (paintProp in paint && isExpression(paint[paintProp])) {
          const exprData = pluckGetExpressionsOfType(
            paint[paintProp],
            /interpolate/,
            "color"
          );
          if (exprData.facets.length) {
            for (const facet of exprData.facets) {
              // @ts-ignore
              layer.paint[paintProp] = exprData.remainingValues;
              panels.push({
                panel: {
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `${context.layers.indexOf(
                    layer
                  )}-${paintProp}-${exprData.facets.indexOf(facet)}-gradient`,
                  type: "GLLegendGradientPanel",
                  label: paintProp,
                  stops: interpolationExpressionToStops(facet.expression),
                },
                filters:
                  layer.filter && isExpression(layer.filter)
                    ? [layer.filter, ...facet.filters]
                    : facet.filters,
              });
            }
            // Look for unrelated get expressions in the remaining style props
            // if none are present, remove the layer
            let hasRemainingGetExpressions = false;
            for (const prop of SIGNIFICANT_PAINT_PROPS) {
              if (
                prop in paint &&
                hasGetExpression(paint[prop]) &&
                prop !== paintProp
              ) {
                hasRemainingGetExpressions = true;
              }
            }
            if (!hasRemainingGetExpressions) {
              remainingLayers = remainingLayers.filter((l) => l !== layer);
            }
            break;
          }
        }
      }
    }
  }
  context.layers = remainingLayers;
  return panels;
}

function pluckLayersWithExpression<T extends GLLegendPanel>(
  context: { layers: SeaSketchGlLayer[] },
  expressionFnName: "step" | "match" | "case",
  fn: (
    paintProp: string,
    expression: Expression,
    layer: SeaSketchGlLayer,
    representedProperties: RepresentedProperties,
    id: string,
    featureProps: {
      [prop: string]: any;
    },
    sortedLayers: SeaSketchGlLayer[]
  ) => null | T
) {
  const panels: { panel: T; filters: Expression[] }[] = [];
  const pluckedLayers: SeaSketchGlLayer[] = [];
  const representedProperties = new RepresentedProperties();
  // order layers so that fills come before lines
  const layers = [...context.layers].sort((a, b) => {
    if (a.type === "fill" && b.type === "line") {
      return -1;
    } else if (a.type === "line" && b.type === "fill") {
      return 1;
    } else {
      return 0;
    }
  });
  for (const layer of layers) {
    // Line layers related to fills could be "plucked" before this point
    if (!pluckedLayers.includes(layer)) {
      representedProperties.reset();
      const paint = layer.paint || ({} as any);
      for (const paintProp of SIGNIFICANT_PAINT_PROPS) {
        if (
          paintProp in paint &&
          isExpression(paint[paintProp]) &&
          !representedProperties.has(paintProp)
        ) {
          const exprData = pluckGetExpressionsOfType(
            paint[paintProp],
            expressionFnName,
            // @ts-ignore
            styleSpec["paint_" + layer.type][paintProp].type
          );
          if (exprData.facets.length) {
            for (const facet of exprData.facets) {
              const prop = facet.expression[1][1];
              representedProperties.addUsedFeatureProperty(prop);
              for (const expression of facet.filters) {
                findGetExpressionProperties(expression, (prop) => {
                  representedProperties.addUsedFeatureProperty(prop);
                });
              }
              const id = `${layers.indexOf(
                layer
              )}-${paintProp}-${exprData.facets.indexOf(
                facet
              )}-${expressionFnName}`;
              // TODO: need to set featureProps to match the facet filters
              const featureProps = propsForFilterExpressions(facet.filters);
              const result = fn(
                paintProp,
                facet.expression,
                layer,
                representedProperties,
                id,
                featureProps,
                layers
              );
              if (result) {
                panels.push({
                  panel: result,
                  filters:
                    layer.filter && isExpression(layer.filter)
                      ? [layer.filter, ...facet.filters]
                      : facet.filters,
                });
              }
            }
            if (exprData.remainingValues === null) {
              pluckedLayers.push(layer);
            }
            representedProperties.commit();
            // pluck line layers with matching expressions that have been used
            if (layer.type === "line" || layer.type === "fill") {
              const relatedLayers = layers.filter((l) =>
                layer.type === "fill" ? l.type === "line" : l.type === "fill"
              );
              for (const layer of relatedLayers) {
                if (!pluckedLayers.includes(layer)) {
                  const paint = layer.paint || ({} as any);
                  for (const styleProp of layer.type === "line"
                    ? [
                        "line-color",
                        "line-width",
                        "line-opacity",
                        "line-dasharray",
                      ]
                    : ["fill-color", "fill-opacity"]) {
                    for (const getProp of representedProperties.featurePropertiesUsed) {
                      if (
                        hasGetExpressionForProperty(paint[styleProp], getProp)
                      ) {
                        pluckedLayers.push(layer);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
          // @ts-ignore
          layer.paint[paintProp] = exprData.remainingValues;
        }
      }
    }
  }
  // Look for unrelated get expressions in the plucked layers
  // if none are present, remove the layer
  for (const layer of pluckedLayers) {
    let hasRemainingGetExpressions = false;
    const paint = layer.paint || ({} as any);
    for (const prop of SIGNIFICANT_PAINT_PROPS) {
      if (prop in paint) {
        const get = findGetExpression(paint[prop]);
        if (
          get &&
          !representedProperties.featurePropertyWasUsed(get.property)
        ) {
          hasRemainingGetExpressions = true;
        }
      }
    }
    if (!hasRemainingGetExpressions) {
      context.layers = context.layers.filter((l) => l !== layer);
    }
  }
  return panels;
}

export function pluckStepPanels(context: { layers: SeaSketchGlLayer[] }) {
  return pluckLayersWithExpression(
    context,
    "step",
    (
      paintProp,
      expression,
      layer,
      representedProperties,
      id,
      featureProps,
      sortedLayers
    ) => {
      const inputOutputPairs = expression.slice(3);
      // TODO: need to set featureProps to match the facet filters
      const prop = expression[1][1];
      const panel: GLLegendStepPanel = {
        // eslint-disable-next-line i18next/no-literal-string
        id,
        type: "GLLegendStepPanel",
        label: prop,
        steps: [
          {
            id: id + "-first",
            label: "",
            symbol: createSymbol(
              sortedLayers.indexOf(layer),
              sortedLayers,
              {
                ...featureProps,
                [prop]: inputOutputPairs[0] - 1,
              },
              representedProperties
            ),
          },
          ...inputOutputPairs.reduce((steps, current, i) => {
            if (i % 2 === 0) {
              const input = current;
              const output = inputOutputPairs[i + 1];
              if (
                output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
                output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
              ) {
                steps.push({
                  id: id + "-" + i,
                  label: `${input}`,
                  symbol: createSymbol(
                    sortedLayers.indexOf(layer),
                    sortedLayers,
                    {
                      ...featureProps,
                      [prop]: input,
                    },
                    representedProperties
                  ),
                });
              }
            }
            return steps;
          }, [] as { id: string; label: string; symbol: GLLegendSymbol }[]),
        ],
      };
      return panel;
    }
  );
}

export function pluckFilterPanels(context: { layers: SeaSketchGlLayer[] }) {
  const panels: { panel: GLLegendSimpleSymbolPanel; filters: Expression[] }[] =
    [];
  const pluckedLayers: SeaSketchGlLayer[] = [];
  const layers = [...context.layers].sort((a, b) => {
    if (a.type === "fill" && b.type === "line") {
      return -1;
    } else if (a.type === "line" && b.type === "fill") {
      return 1;
    } else {
      return 0;
    }
  });

  for (const layer of context.layers) {
    if (!pluckedLayers.includes(layer)) {
      if (layer.filter && isExpression(layer.filter)) {
        const labels = new Set<string>();
        findGetExpressionProperties(
          normalizeLegacyFilterExpression(layer.filter),
          (prop) => {
            labels.add(prop);
          }
        );
        const label = labels.size === 1 ? [...labels][0] : undefined;
        const panel: GLLegendSimpleSymbolPanel = {
          // eslint-disable-next-line i18next/no-literal-string
          id: `${layers.indexOf(layer)}-filter`,
          type: "GLLegendSimpleSymbolPanel",
          items: [],
          label,
        };
        const symbol = getSingleSymbolForVectorLayers([layer]);
        if (symbol) {
          panel.items.push({
            id: panel.id + "-only",
            label:
              layer.metadata?.label ||
              labelForExpression(normalizeLegacyFilterExpression(layer.filter)),
            symbol,
          });
          panels.push({
            panel,
            filters: [layer.filter],
          });
          pluckedLayers.push(layer);
        }
      }
    }
  }
  context.layers = context.layers.filter((l) => !pluckedLayers.includes(l));
  return panels;
}

export function pluckListPanels(context: { layers: SeaSketchGlLayer[] }) {
  // First handle match expressions. These are easiest to turn into lists
  const results = pluckLayersWithExpression(
    context,
    "match",
    (
      paintProp,
      expression,
      layer,
      representedProperties,
      id,
      featureProps,
      sortedLayers
    ) => {
      // TODO: need to set featureProps to match the facet filters
      const prop = expression[1][1];
      const defaultValue = expression[expression.length - 1];
      const inputOutputPairs = expression.slice(2, -1);

      const panel: GLLegendListPanel = {
        id,
        type: "GLLegendListPanel",
        label: expression[1][1],
        items: [],
      };
      const valuesUsed: any = [];
      for (var i = 0; i < inputOutputPairs.length; i += 2) {
        const input = inputOutputPairs[i];
        const output = inputOutputPairs[i + 1];
        if (
          output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
          output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
        ) {
          valuesUsed.push(input);
          panel.items.push({
            id: id + "-" + i,
            label: `${input}`,
            symbol: createSymbol(
              sortedLayers.indexOf(layer),
              sortedLayers,
              {
                ...featureProps,
                [prop]: input,
              },
              representedProperties
            ),
          });
        }
      }
      // TODO: add related domain values so that if different
      // comparison values are referenced in matching fill/line layers
      // they can be represented.
      // It's important that these values are found within the same
      // "facet" however with matching filters
      if (layer.type === "fill" || layer.type === "line") {
        const valuesForFeatureProperty = collectValuesForFeatureProperty(
          prop,
          context.layers.filter(
            (l) => (l !== layer && l.type === "fill") || l.type === "line"
          )
        );
        for (const value of valuesForFeatureProperty) {
          if (!valuesUsed.includes(value)) {
            panel.items.push({
              id: id + "-" + value,
              label: `${value}`,
              symbol: createSymbol(
                sortedLayers.indexOf(layer),
                sortedLayers,
                {
                  ...featureProps,
                  [prop]: value,
                },
                representedProperties
              ),
            });
            valuesUsed.push(value);
          }
        }
      }
      if (
        defaultValue !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
        defaultValue !== NULLIFIED_EXPRESSION_OUTPUT_STRING
      ) {
        panel.items.push({
          id: id + "-default",
          label: "default",
          symbol: createSymbol(
            sortedLayers.indexOf(layer),
            sortedLayers,
            {
              ...featureProps,
            },
            representedProperties
          ),
        });
      }
      return panel;
    }
  );
  // then handle case expressions, since these can be used to achieve the same
  // type of results
  const caseResults: { panel: GLLegendListPanel; filters: Expression[] }[] = [];
  const representedProperties = new RepresentedProperties();
  const pluckedLayers: SeaSketchGlLayer[] = [];
  const layers = [...context.layers].sort((a, b) => {
    if (a.type === "fill" && b.type === "line") {
      return -1;
    } else if (a.type === "line" && b.type === "fill") {
      return 1;
    } else {
      return 0;
    }
  });
  for (const layer of layers) {
    if (!pluckedLayers.includes(layer)) {
      representedProperties.reset();
      const paint = layer.paint || ({} as any);
      for (const paintProp of SIGNIFICANT_PAINT_PROPS) {
        if (
          paintProp in paint &&
          isExpression(paint[paintProp]) &&
          !representedProperties.has(paintProp) &&
          hasGetExpression(paint[paintProp]) &&
          paint[paintProp][0] === "case"
        ) {
          const expression = paint[paintProp];

          findGetExpressionProperties(expression, (prop) => {
            representedProperties.addUsedFeatureProperty(prop);
          });
          const fallback = expression[expression.length - 1];
          const inputOutputPairs = expression.slice(1, -1);
          let isSimple =
            [...representedProperties.featurePropertiesUsed].length === 1;
          if (isSimple) {
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
              const input = inputOutputPairs[i];
              const output = inputOutputPairs[i + 1];
              if (isExpression(output)) {
                isSimple = false;
                break;
              }
            }
          }
          if ([...representedProperties.featurePropertiesUsed].length === 0) {
            // probably zoom-based case expression. Let the layer fall
            // through to individual symbol handling
          } else {
            if (isSimple) {
              const prop = [...representedProperties.featurePropertiesUsed][0];
              const panel: GLLegendListPanel = {
                // eslint-disable-next-line i18next/no-literal-string
                id: `${layers.indexOf(layer)}-${paintProp}-case`,
                type: "GLLegendListPanel",
                label: prop,
                items: [],
              };
              const featureProps = propsForFilterExpressions(
                layer.filter && isExpression(layer.filter) ? [layer.filter] : []
              );
              const valuesUsed: any = [];
              for (var i = 0; i < inputOutputPairs.length; i += 2) {
                const input = inputOutputPairs[i];
                const output = inputOutputPairs[i + 1];
                if (
                  output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
                  output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
                ) {
                  const featureData = {
                    ...featureProps,
                    ...propsForFilterExpressions([input]),
                  };
                  valuesUsed.push(featureData[prop]);
                  panel.items.push({
                    id: panel.id + "-" + i,
                    label: labelForExpression(input),
                    symbol: createSymbol(
                      layers.indexOf(layer),
                      layers,
                      featureData,
                      representedProperties
                    ),
                  });
                }
              }

              // TODO: add related domain values so that if different
              // comparison values are referenced in matching fill/line layers
              // they can be represented.
              // It's important that these values are found within the same
              // "facet" however with matching filters
              if (layer.type === "fill" || layer.type === "line") {
                const valuesForFeatureProperty =
                  collectValuesForFeatureProperty(
                    prop,
                    context.layers.filter(
                      (l) =>
                        (l !== layer && l.type === "fill") || l.type === "line"
                    )
                  );
                for (const value of valuesForFeatureProperty) {
                  if (!valuesUsed.includes(value)) {
                    panel.items.push({
                      id: panel.id + "-" + panel.items.length,
                      label: `${value}`,
                      symbol: createSymbol(
                        layers.indexOf(layer),
                        layers,
                        {
                          ...featureProps,
                          [prop]: value,
                        },
                        representedProperties
                      ),
                    });
                    valuesUsed.push(value);
                  }
                }
              }

              if (
                fallback !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
                fallback !== NULLIFIED_EXPRESSION_OUTPUT_STRING
              ) {
                panel.items.push({
                  id: panel.id + "-default",
                  label: "default",
                  symbol: createSymbol(
                    layers.indexOf(layer),
                    layers,
                    {
                      ...featureProps,
                      [prop[0]]: fallback,
                    },
                    representedProperties
                  ),
                });
              }
              caseResults.push({
                panel,
                filters:
                  layer.filter && isExpression(layer.filter)
                    ? [layer.filter]
                    : [],
              });
              // Remove related line or fill layers
              if (layer.type === "line" || layer.type === "fill") {
                const relatedLayers = layers.filter((l) =>
                  layer.type === "fill" ? l.type === "line" : l.type === "fill"
                );
                for (const layer of relatedLayers) {
                  if (!pluckedLayers.includes(layer)) {
                    const paint = layer.paint || ({} as any);
                    for (const styleProp of layer.type === "line"
                      ? [
                          "line-color",
                          "line-width",
                          "line-opacity",
                          "line-dasharray",
                        ]
                      : ["fill-color", "fill-opacity"]) {
                      for (const getProp of representedProperties.featurePropertiesUsed) {
                        if (
                          hasGetExpressionForProperty(paint[styleProp], getProp)
                        ) {
                          pluckedLayers.push(layer);
                          break;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              // TODO: do we want/need to support this?
              console.warn("not simple", expression);
            }
          }
          context.layers = context.layers.filter((l) => l !== layer);
        }
      }
    }
  }
  if (caseResults.length) {
    results.push(...caseResults);
  }
  return results;
}

function labelForExpression(expression: Expression) {
  const fnName = expression[0];
  let comparisonPosition = 1;
  if (expression[1][0] === "get") {
    comparisonPosition = 2;
  } else if (expression[2][0] === "get") {
    comparisonPosition = 1;
  } else {
    throw new Error("Could not find get expression in filter");
  }
  switch (fnName) {
    case "==":
      return expression[comparisonPosition];
    case "!=":
      return `!= ${expression[comparisonPosition]}`;
    case "!":
      return `!${expression[comparisonPosition]}`;
    default:
      return `${fnName} ${expression[comparisonPosition]}`;
  }
}

export function compileLegendFromGLStyleLayers(
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
  const context = parseLegend(layers);
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
      // TODO: consider if you need to do something here for filter expressions
      if (expression.usageType === "filter") {
        continue;
      }
      // Commit representedProperties so they aren't duplicated in other panels
      representedProperties.commit();
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
          const panelId = `${expression.layerIndex}-${expression.styleProp}`;
          const propType = getPropType(expression.styleProp, layerType);
          // # Detect Color Gradients
          if (propType === "color" && /interpolate/.test(expression.fnName)) {
            legend.panels.push(
              createGradientPanel(
                expression,
                layers,
                representedProperties,
                context
              )
            );
          } else if (
            propType === "number" &&
            (expression.fnName === "interpolate" ||
              (expression.fnName === "step" &&
                (expression.styleProp === "circle-radius" ||
                  expression.styleProp === "icon-size")))
          ) {
            // Any numeric interpolation can benefit from a mid-point if it's
            // possible to add one.
            let stops = normalizeStops(expression);
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

              // limit stops to 3 for bubble charts
              if (stops.length > 3) {
                stops = [
                  stops[0],
                  stops[Math.floor(stops.length / 2)],
                  stops[stops.length - 1],
                ];
              }
              legend.panels.push({
                id: panelId,
                type: "GLLegendBubblePanel",
                label: expression.getProp,
                stops: stops.map((s) => {
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
                    fillOpacity: evaluate(
                      styleValueOrExpressionForContext("circle-opacity", 1),
                      {
                        [expression.getProp]: value,
                      }
                    ),
                  };
                }),
              });
            } else if (expression.styleProp === "icon-size") {
              legend.panels.push(
                createMarkerSizePanel(expression, layers, representedProperties)
              );
            } else {
              // for any other prop, create a list panel
              legend.panels.push({
                id: panelId,
                type: "GLLegendListPanel",
                label: expression.getProp,
                items: stops.map((s) => {
                  if ("input" in s) {
                    return {
                      // eslint-disable-next-line i18next/no-literal-string
                      id: `stop-${s.input.toString()}`,
                      label: s.input.toLocaleString(),
                      symbol: createSymbol(
                        expression.layerIndex,
                        layers,
                        {
                          [expression.getProp]: s.input,
                        },
                        representedProperties
                      ),
                    };
                  } else {
                    throw new Error("no input on stop");
                  }
                }),
              });
            }
          } else if (expression.fnName === "step") {
            legend.panels.push(
              createLegendStepPanel(expression, layers, representedProperties)
            );
          }
          break;
        case "decision":
          // TODO: bring back support for filters
          // case "filter":
          switch (expression.fnName) {
            case "case": {
              break;
              // const domains = [...expression.domains];
              // // Merge domains from other expressions which have the same getProp
              // for (const otherExpression of context.significantExpressions) {
              //   if (otherExpression === expression) {
              //     continue;
              //   }
              //   if (
              //     otherExpression.getProp === expression.getProp &&
              //     (otherExpression.usageType === "decision" ||
              //       otherExpression.usageType === "filter")
              //   ) {
              //     for (const entry of otherExpression.domains) {
              //       const key = entry.comparators.join(",");
              //       const existing = domains.find(
              //         (d) => d.comparators.join(",") === key
              //       );
              //       if (!existing) {
              //         domains.push(entry);
              //       }
              //     }
              //   }
              // }

              // // Create a List panel
              // legend.panels.push({
              //   // eslint-disable-next-line i18next/no-literal-string
              //   id: `${expression.layerIndex}-${expression.styleProp}-list`,
              //   type: "GLLegendListPanel",
              //   label: expression.getProp,
              //   items: domains.map((d) => {
              //     return {
              //       id: d.operator + d.comparators.join(","),
              //       label: d.isFallback
              //         ? "Default"
              //         : (((d.operator === "==" ? "" : d.operator) +
              //             " " +
              //             d.comparators
              //               .map((c) => c.toLocaleString())
              //               .join(", ")) as string),
              //       symbol: createSymbol(
              //         expression.layerIndex,
              //         layers,
              //         {
              //           [expression.getProp]: valueForDomain(
              //             d,
              //             domains.filter((domain) => domain !== d)
              //           ),
              //         },
              //         representedProperties
              //       ),
              //     };
              //   }),
              // });
              break;
            }
            case "match": {
              const matches = [...expression.matches];
              // Merge domains from other expressions which have the same getProp
              for (const otherExpression of context.significantExpressions) {
                if (otherExpression === expression) {
                  continue;
                }
                if (otherExpression.usageType === "filter") {
                  continue;
                }
                if (otherExpression.usageType === "decision") {
                  if (
                    otherExpression.fnName === "match" &&
                    otherExpression.getProp === expression.getProp
                  ) {
                    // add more matches to domain
                    for (const entry of otherExpression.matches) {
                      const existing = matches.find(
                        (m) => m.value === entry.value
                      );
                      if (!existing && !entry.isFallback) {
                        matches.push(entry);
                      }
                    }
                  } else if (otherExpression.fnName === "case") {
                    for (const domain of otherExpression.domains) {
                      if (
                        domain.type === "simple" &&
                        domain.operator === "=="
                      ) {
                        const existing = matches.find(
                          (m) =>
                            m.value === domain.comparisonValue &&
                            !domain.isFallback
                        );
                        if (!existing) {
                          matches.push({
                            value: domain.comparisonValue,
                            isFallback: false,
                          });
                        }
                      }
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
                items: matches.map((d) => {
                  return {
                    // eslint-disable-next-line i18next/no-literal-string
                    id: `match-${d.value}`,
                    label: d.isFallback ? "Default" : d.value.toLocaleString(),
                    symbol: createSymbol(
                      expression.layerIndex,
                      layers,
                      {
                        [expression.getProp]: d.value,
                      },
                      representedProperties
                    ),
                  };
                }),
              });
              break;
            }
          }
          break;
        case "literal":
          // With literal values our options are limited. If geostats are
          // available for the layer, we can use those to create useful panels.
          // Otherwise, it may depend on default values being present in the
          // expression
          const dataType = getPropType(expression.styleProp, layerType);
          const info = geostatsLayerForSource(geostats);
          const attr = info?.attributes.find(
            (a) => a.attribute === expression.getProp
          );
          const geostatsValues = attr?.values;
          switch (dataType) {
            case "color":
            case "enum":
              // if geostats values are present, create a list from those.
              // otherwise, create a simple symbol and rely on default values
              if (attr && attr.values) {
                let values = attr.values;
                if (values.length > 6) {
                  values = values.slice(0, 6);
                }
                legend.panels.push({
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `${expression.layerIndex}-${expression.styleProp}-list`,
                  type: "GLLegendListPanel",
                  label: expression.getProp,
                  items: values.map((v) => {
                    return {
                      id: v?.toString() || "null",
                      label: v?.toLocaleString() || "",
                      symbol: createSymbol(
                        expression.layerIndex,
                        layers,
                        {
                          [expression.getProp]: v,
                        },
                        representedProperties
                      ),
                    };
                  }),
                });
              } else {
                // Do nothing and expect SimpleGLLegend to be generated when
                // panel list is empty
              }
              break;
            case "number":
              // if geostats values are present, create a list from min/max
              // otherwise, create a simple symbol and rely on default values
              if (attr && attr.min !== undefined && attr.max !== undefined) {
                legend.panels.push({
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `${expression.layerIndex}-${expression.styleProp}-list`,
                  type: "GLLegendListPanel",
                  label: expression.getProp,
                  items: [
                    {
                      id: "min",
                      label: attr.min.toLocaleString(),
                      symbol: createSymbol(
                        expression.layerIndex,
                        layers,
                        {
                          [expression.getProp]: attr.min,
                        },
                        representedProperties
                      ),
                    },
                    {
                      id: "max",
                      label: attr.max.toLocaleString(),
                      symbol: createSymbol(
                        expression.layerIndex,
                        layers,
                        {
                          [expression.getProp]: attr.max,
                        },
                        representedProperties
                      ),
                    },
                  ],
                });
              }
              break;
          }
          break;
      }
    }

    // TODO: if no panels have been added yet, try inserting a single symbol
    // legend as a fallback
    if (legend.panels.length === 0) {
      return {
        type: "SimpleGLLegend",
        symbol: getSingleSymbolForVectorLayers(layers),
      };
    } else {
      return legend;
    }
  }
}

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
  private usedFeatureProperties = new Set<string>();

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
    this.usedFeatureProperties.clear();
  }

  clearPending() {
    this.pending.clear();
  }

  /** Always "committed" immediately */
  addUsedFeatureProperty(featurePropertyName: string) {
    this.usedFeatureProperties.add(featurePropertyName);
  }

  featurePropertyWasUsed(featurePropertyName: string) {
    return this.usedFeatureProperties.has(featurePropertyName);
  }

  get featurePropertiesUsed() {
    return this.usedFeatureProperties.values();
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
        // TODO: skipping filters here, but is that necessary?
        !("styleProps" in e) &&
        "getProp" in e &&
        (anyLayer || e.layerIndex === expression.layerIndex) &&
        e.styleProp === styleProp
      // not sure I need the following:
      // && !representedProperties.includes(e.styleProp)
    ) as Exclude<SignificantExpression, SignificantFilterExpression>;
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
    } else if (
      // TODO: this is pretty janky?
      "getProp" in relatedExpression &&
      "getProp" in expression &&
      relatedExpression.getProp === expression.getProp
    ) {
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

function valueForDomain(
  domain: SignificantExpressionSimpleDomain,
  relatedDomains: SignificantExpressionSimpleDomain[] = []
) {
  if (domain.isFallback) {
    // Need to find a value that doesn't fall within any of the other domains
    if (relatedDomains.length === 1) {
      return 0;
    }
  }
  switch (domain.operator) {
    case "==":
      return domain.comparisonValue;
    // For >=, <=, change the comparator a tiny, tiny amount in case there is a
    // mistake in the expressions that allows for a little overlay in domains
    case ">=":
      return (domain.comparisonValue as number) + 0.0000001;
    case "<=":
      return (domain.comparisonValue as number) - 0.0000001;
    case "!=":
      return typeof domain.comparisonValue === "number"
        ? domain.comparisonValue + 1
        : "__legend_placeholder_other__";
    case ">":
      return (domain.comparisonValue as number) + 0.001;
    case "<":
      return (domain.comparisonValue as number) - 0.001;
    case "!":
      return false;
    default:
      return domain.comparisonValue;
  }
}

// TODO: update to handle multiple source layers in the same tableOfContentsItem
// some day.
function geostatsLayerForSource(geostats?: Geostats, sourceId?: string) {
  if (geostats) {
    if (sourceId) {
      return geostats.layers.find((l) => l.layer === sourceId);
    } else {
      return geostats.layers[0];
    }
  }
  return undefined;
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

function evaluateLayerProperty(
  layer: SeaSketchGlLayer,
  type: "layout" | "paint",
  propName: string,
  featureProps: any,
  geometryType?: "Point" | "Polygon" | "LineString",
  representedProperties?: RepresentedProperties
) {
  const expression =
    layer[type] && propName in layer[type]!
      ? // @ts-ignore
        (layer[type][propName] as number | Expression | string)
      : undefined;
  const defaultForProp =
    // @ts-ignore
    styleSpec[`${type}_${layer.type}`][propName]["default"];
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
    const value = ExpressionEvaluator.parse(expression).evaluate(feature);
    if (representedProperties) {
      const getProperties = findGetProperties(expression);
      const anyMissing = getProperties.some((prop) => !(prop in featureProps));
      if (!anyMissing) {
        representedProperties.add(propName);
      }
    }
    if (isRGBA(value)) {
      // eslint-disable-next-line i18next/no-literal-string
      return `rgba(${value.r * 255},${value.g * 255},${value.b * 255},${
        value.a
      })`;
    } else {
      return value;
    }
  } else {
    representedProperties?.add(propName);
    return expression || defaultForProp;
  }
}

function findGetProperties(expression: any, properties: string[] = []) {
  if (isExpression(expression)) {
    if (expression[0] === "get") {
      const prop = expression[1];
      if (!properties.includes(prop)) {
        properties.push(prop);
      }
    } else {
      for (const arg of expression.slice(1)) {
        findGetProperties(arg, properties);
      }
    }
  }
  return properties;
}

function isRGBA(value: any): value is RGBA {
  return typeof value === "object" && "r" in value;
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
          label: stopPairs[i].toLocaleString(),
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
  let type = propName.split("-")[0];
  if (type === "text" || type === "icon") {
    type = "symbol";
  }
  if (propName in paint) {
    const value = paint[propName];
    if (isExpression(value)) {
      if (
        representedProperties &&
        hasGetExpression(value, propName === "filter")
      ) {
        representedProperties.add(propName);
      }
      const fnName = value[0];
      featureData = featureData || {};
      // ExpressionEvaluator will complain over console-log if a number is
      // not provided to step functions
      if (fnName === "step") {
        const prop = value[1][1];
        if (typeof prop === "string" && !(prop in featureData)) {
          featureData[prop] = 0;
        }
      }
      // evaluate expression using featureData
      return ExpressionEvaluator.parse(value).evaluate({
        type: "Feature",
        properties: featureData,
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

interface SignificantExpressionSimpleDomain {
  type: "simple";
  operator: Operator;
  getProp: string;
  comparisonValue: number | boolean | string;
  isFallback?: boolean;
}

interface SignificantExpressionComplexDomain {
  type: "complex";
  operator: "all" | "any";
  domains: SignificantExpressionSimpleDomain[];
}

type SignificantExpressionDomain =
  | SignificantExpressionSimpleDomain
  | SignificantExpressionComplexDomain;

// @deprecated
// interface SignificantDecisionExpression {
//   layerIndex: number;
//   styleProp: string;
//   getProp: string;
//   usageType: "decision";
//   fnName: "case" | "match";
//   domains: SignificantExpressionSimpleDomain[];
//   rank: number;
// }

interface SignificantMatchExpression {
  layerIndex: number;
  styleProp: string;
  getProp: string;
  usageType: "decision";
  fnName: "match";
  matches: { value: number | boolean | string; isFallback: boolean }[];
  rank: number;
}

interface SignificantCaseExpression {
  layerIndex: number;
  styleProp: string;
  usageType: "decision";
  fnName: "case";
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
  styleProps: string[];
  getProp: string;
  usageType: "filter";
  domains: SignificantExpressionDomain;
  rank: number;
  /*
   * Assigned if the related layer has a `label` property in its metadata
   * property. Used by @seasketch/mapbox-gl-esri-sources
   */
  metadataDerivedLabel?: string;
}

type SignificantExpression =
  | SignificantLiteralExpression
  | SignificantMatchExpression
  | SignificantCaseExpression
  | SignificantRampScaleOrCurveExpression
  | SignificantFilterExpression;

export type SeaSketchGlLayer = Omit<Layer, "id" | "source">;

interface LegendContext {
  globalContext: {
    zoomRanges: { layerIndex: number; zoomRange: [number, number] }[];
  };
  significantExpressions: SignificantExpression[];
  includesHeatmap: boolean;
}

function parseLegend(
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
    // TODO: support legacy filters as well
    const filterDetails = parseFilter(layer.filter);
    // if (filterDetails) {
    //   results.significantExpressions.push({
    //     layerIndex: layers.indexOf(layer),
    //     styleProps: [
    //       ...SIGNIFICANT_PAINT_PROPS.filter((p) => {
    //         return p in (layer.paint || {});
    //       }),
    //       ...SIGNIFICANT_LAYOUT_PROPS.filter((p) => {
    //         return p in (layer.layout || {});
    //       }),
    //     ],
    //     getProp: filterDetails.getProp,
    //     usageType: "filter",
    //     domains: filterDetails.domains,
    //     rank: 0,
    //   });
    // }
    if (layer.paint) {
      for (const prop of SIGNIFICANT_PAINT_PROPS) {
        if (prop in layer.paint) {
          const value = (layer.paint as any)[prop];
          if (isExpression(value)) {
            const expressionDetails = parseExpression(
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
            const expressionDetails = parseExpression(
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

function parseFilter(
  filter: any
): { domains: SignificantExpressionDomain[]; getProp: string } | null {
  if (isExpression(filter) && hasGetExpression(filter, true)) {
    const getExpression = findGetExpression(filter, true);
    if (getExpression) {
      const domains: SignificantExpressionSimpleDomain[] = [];
      const getProp = getExpression.property;
      const operator = filter[0];
      if (operator === "all" || operator === "any") {
        // TODO: complex domain
      } else {
        domains.push({
          operator: operator as Operator,
          comparisonValue: filter[2],
          getProp,
          type: "simple",
        });
      }
      const fallback = findFallbackForDomain(domains);
      if (fallback) {
        domains.push(fallback);
      }
      return { domains, getProp };
    }
  }
  return null;
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
    const [fnName, input, ...inputOutputPairs] = expression;
    const stops: Stop[] = [];
    stops.push({ output: inputOutputPairs[0], isDefault: true });
    for (var i = 1; i < inputOutputPairs.length; i += 2) {
      stops.push({
        input: inputOutputPairs[i],
        output: inputOutputPairs[i + 1],
      });
    }
    return stops;
  } else {
    throw new Error(`Expected step expression. Got ${expression[0]}`);
  }
}

function parseExpression(
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
          const matches: {
            value: string | boolean | number;
            isFallback: boolean;
          }[] = [];
          for (let i = 0; i < inputOutputPairs.length; i++) {
            if (i % 2 === 0) {
              matches.push({ value: inputOutputPairs[i], isFallback: false });
            }
          }
          // Add default fallback value
          const lastValueInDomain = matches[matches.length - 1];
          matches.push({
            value:
              typeof lastValueInDomain.value === "number"
                ? lastValueInDomain.value + 99999
                : "__glLegendDefaultValue",
            isFallback: true,
          });
          return {
            ...knownProps,
            usageType: context.usageType,
            getProp,
            fnName: "match",
            matches,
          };
        } else if (context.parentExpression[0] === "case") {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_case, ...args] = context.parentExpression;
          const conditionsAndOutputs = args.slice(0, args.length - 1);
          const domains: SignificantExpressionSimpleDomain[] = [];
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
                    type: "simple",
                    getProp,
                    operator: conditionFnName as Operator,
                    comparisonValue:
                      comparatorIndex !== undefined && comparatorIndex > -1
                        ? conditionArgs[comparatorIndex!]
                        : null,
                  });
                } else {
                  // TODO: complex expression could be any or all. Support these.
                  // Note, all or any expressions could refer to more than one
                  // data property...
                }
              }
            }
          }

          const fallback = findFallbackForDomain(domains);
          if (fallback) {
            domains.push(fallback);
          }
          return {
            ...knownProps,
            usageType: context.usageType,
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
      const details = parseExpression(
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

function findFallbackForDomain(
  domains: SignificantExpressionSimpleDomain[]
): SignificantExpressionSimpleDomain | null {
  if (domains.length === 0) {
    return null;
  }
  const isNumeric = typeof domains[0].comparisonValue === "number";
  const isBoolean = typeof domains[0].comparisonValue === "boolean";
  if (!isNumeric && !isBoolean) {
    // String value, easy
    return {
      operator: "==",
      comparisonValue: "__glLegendDefaultValue",
      isFallback: true,
      getProp: domains[0].getProp,
      type: "simple",
    };
  }

  const possibleFallbacks: {
    domain: SignificantExpressionSimpleDomain;
    value: number;
  }[] = [];
  const excludedValues: (string | number | boolean)[] = [];
  const includedValues: (string | number | boolean)[] = [];
  for (const domain of domains) {
    // This shouldn't be encountered, but just in case
    if (domain.isFallback) {
      return domain;
    } else {
      if (isNumeric) {
        // numeric domain
        if (domain.operator === "!=") {
          excludedValues.push(domain.comparisonValue);
        } else if (domain.operator === "==") {
          includedValues.push(domain.comparisonValue);
        } else if (domain.operator === "<") {
          possibleFallbacks.push({
            domain,
            value: domain.comparisonValue as number,
          });
        } else if (domain.operator === "<=") {
          possibleFallbacks.push({
            domain,
            value: (domain.comparisonValue as number) + 0.001,
          });
        } else if (domain.operator === ">") {
          possibleFallbacks.push({
            domain,
            value: domain.comparisonValue as number,
          });
        } else if (domain.operator === ">=") {
          possibleFallbacks.push({
            domain,
            value: (domain.comparisonValue as number) - 0.001,
          });
        }
      } else if (isBoolean) {
        // boolean domain
        if (domain.operator === "!=") {
          excludedValues.push(domain.comparisonValue);
        } else if (domain.operator === "==") {
          includedValues.push(domain.comparisonValue);
        } else if (domain.operator === "!") {
          includedValues.push(!domain.comparisonValue);
        }
      }
    }
  }
  if (isBoolean) {
    const allValues = [...excludedValues, ...includedValues];
    if (!allValues.includes(false)) {
      return {
        type: "simple",
        operator: "==",
        comparisonValue: false,
        isFallback: true,
        getProp: domains[0].getProp,
      };
    } else if (!allValues.includes(true)) {
      return {
        type: "simple",
        operator: "==",
        comparisonValue: true,
        isFallback: true,
        getProp: domains[0].getProp,
      };
    } else {
      return null;
    }
  } else if (isNumeric) {
    // First, see if any of the possible fallbacks are not in the included in
    // any of the existing domains.
    if (possibleFallbacks.length === 1 && domains.length === 1) {
      return {
        type: "simple",
        operator: "==",
        comparisonValue: possibleFallbacks[0].value,
        isFallback: true,
        getProp: domains[0].getProp,
      };
    }
    for (const fallback of possibleFallbacks) {
      if (includedValues.includes(fallback.value)) {
        break;
      }
      for (const domain of domains) {
        if (domain === fallback.domain) {
          // skip
          continue;
        } else {
          if (
            domain.operator === "==" &&
            fallback.value === domain.comparisonValue
          ) {
            continue;
          } else if (
            domain.operator === "<" &&
            fallback.value < (domain.comparisonValue as number)
          ) {
            continue;
          } else if (
            domain.operator === "<=" &&
            fallback.value <= (domain.comparisonValue as number)
          ) {
            continue;
          } else if (
            domain.operator === ">" &&
            fallback.value > (domain.comparisonValue as number)
          ) {
            continue;
          } else if (
            domain.operator === ">=" &&
            fallback.value >= (domain.comparisonValue as number)
          ) {
            continue;
          } else if (
            domain.operator === "!=" &&
            fallback.value !== (domain.comparisonValue as number)
          ) {
            continue;
          }
        }
        // if you get to this point, the fallback is a good choice
        return {
          type: "simple",
          operator: "==",
          comparisonValue: fallback.value,
          isFallback: true,
          getProp: domains[0].getProp,
        };
      }
    }
    // If none of those work, find the max of included and excluded values
    // and add 1
    const allValues = [...includedValues, ...excludedValues] as number[];
    if (allValues.length) {
      const max = Math.max(...allValues);
      return {
        type: "simple",
        operator: "==",
        comparisonValue: max + 1,
        isFallback: true,
        getProp: domains[0].getProp,
      };
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
    return createLineSymbol(
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
        layers.filter((l) => l !== symbolLayer),
        {}
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

function layerIsVisible(layer: SeaSketchGlLayer) {
  return !layer.layout?.visibility || layer.layout.visibility !== "none";
}

function createMarkerSymbol(
  symbolLayer: SeaSketchGlLayer,
  otherLayers: SeaSketchGlLayer[],
  featureData: { [propName: string]: any },
  representedProperties?: RepresentedProperties
): GLLegendMarkerSymbol {
  const paint = (symbolLayer.paint || {}) as any;
  const layout = (symbolLayer.layout || {}) as any;
  const iconImage = getLayoutProp(
    layout,
    "symbol",
    "icon-image",
    featureData,
    representedProperties
  );
  const iconSize = getLayoutProp(
    layout,
    "symbol",
    "icon-size",
    featureData,
    representedProperties,
    1
  );
  const rotation = getLayoutProp(
    layout,
    "symbol",
    "icon-rotate",
    featureData,
    representedProperties,
    0
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

function idForPanel(expression: SignificantExpression) {
  return `${expression.layerIndex}-${
    "styleProp" in expression
      ? expression.styleProp
      : expression.styleProps.join("-")
  }`;
}

function normalizeStops(expression: SignificantRampScaleOrCurveExpression) {
  let stops = expression.stops;
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
  return stops;
}

function createGradientPanel(
  expression: SignificantRampScaleOrCurveExpression,
  layers: SeaSketchGlLayer[],
  representedProperties: RepresentedProperties,
  context: LegendContext
): GLLegendGradientPanel {
  // gradient
  const panel: GLLegendGradientPanel = {
    id: idForPanel(expression),
    label: expression.getProp,
    type: "GLLegendGradientPanel",
    stops: interpolationExpressionToStops(
      (layers[expression.layerIndex].paint as any)[expression.styleProp]
    ),
  };
  representedProperties.add(expression.styleProp, true);
  // identify other colors set by the same stops and exclude them from
  // rendering redundant panels
  const otherColors = context.significantExpressions.filter((e) => {
    return (
      e !== expression &&
      e.usageType === "rampScaleOrCurve" &&
      e.getProp === expression.getProp &&
      /interpolate/.test(e.fnName) &&
      hasMatchingStops(e.stops, expression.stops)
    );
  }) as SignificantRampScaleOrCurveExpression[];
  for (const otherColor of otherColors) {
    representedProperties.add(otherColor.styleProp, true);
  }
  return panel;
}

function createMarkerSizePanel(
  expression: SignificantRampScaleOrCurveExpression,
  layers: SeaSketchGlLayer[],
  representedProperties: RepresentedProperties
): GLMarkerSizePanel {
  const layer = layers[expression.layerIndex];
  return {
    id: idForPanel(expression),
    type: "GLMarkerSizePanel",
    label: expression.getProp,
    stops: expression.stops.map((s) => {
      const value = "input" in s ? s.input : 0;
      return {
        // eslint-disable-next-line i18next/no-literal-string
        id: `stop-${value}`,
        value,
        iconSize: s.output as number,
        imageId: getLayoutProp(
          layer.layout || {},
          layer.type,
          "icon-image",
          {
            [expression.getProp]: value,
          },
          representedProperties
        ),
        color: getPaintProp(
          layer.paint || {},
          "icon-color",
          {
            [expression.getProp]: value,
          },
          representedProperties,
          "#000"
        ),
        haloColor: getPaintProp(
          layer.paint || {},
          "icon-halo-color",
          {
            [expression.getProp]: value,
          },
          representedProperties
        ),
        haloWidth: getPaintProp(
          layer.paint || {},
          "icon-halo-width",
          {
            [expression.getProp]: value,
          },
          representedProperties
        ),
        rotation: getLayoutProp(
          layer.layout || {},
          layer.type,
          "icon-rotate",
          {
            [expression.getProp]: value,
          },
          representedProperties
        ),
      };
    }),
  };
}

function createLegendStepPanel(
  expression: SignificantRampScaleOrCurveExpression,
  layers: SeaSketchGlLayer[],
  representedProperties: RepresentedProperties
): GLLegendStepPanel {
  const firstInput = expression.stops.find((s) => "input" in s);
  // Previous code will handle step functions if for circle-radius or
  // icon-size. This is for any other step function.
  // These will behave very similarly to a list panel
  // Create a step panel
  return {
    id: idForPanel(expression),
    type: "GLLegendStepPanel",
    label: expression.getProp,
    steps: expression.stops.map((s) => {
      if ("input" in s) {
        return {
          id: s.input.toString(),
          label: s.input.toLocaleString(),
          symbol: createSymbol(
            expression.layerIndex,
            layers,
            {
              [expression.getProp]: s.input,
            },
            representedProperties
          ),
        };
      } else {
        return {
          id: s.isDefault ? "Default" : "other",
          label:
            s.isDefault && firstInput && "input" in firstInput
              ? `< ${firstInput.input}`
              : "other",
          symbol: createSymbol(
            expression.layerIndex,
            layers,
            {
              [expression.getProp]:
                firstInput && "input" in firstInput
                  ? firstInput.input - 99999
                  : -99999999999,
            },
            representedProperties
          ),
        };
      }
    }),
  };
}

function createSymbol(
  layerIndex: number,
  layers: SeaSketchGlLayer[],
  featureProps: { [key: string]: any },
  representedProperties: RepresentedProperties
) {
  const primaryLayer = layers[layerIndex];
  if (!primaryLayer) {
    throw new Error("No primary layer: " + layerIndex);
  }
  const otherLayers = layers.filter((l) => l !== primaryLayer);
  switch (primaryLayer.type) {
    case "fill":
    case "fill-extrusion":
      return createFillSymbol(
        primaryLayer,
        otherLayers,
        featureProps,
        representedProperties
      );
    case "line":
      // TODO: evaluate filters?
      const visibleFillLayer = otherLayers.find(
        (l) => l.type === "fill" && layerIsVisible(l)
      );
      if (visibleFillLayer) {
        return createFillSymbol(
          visibleFillLayer,
          layers.filter((l) => l !== visibleFillLayer),
          featureProps,
          representedProperties
        );
      } else {
        return createLineSymbol(
          primaryLayer,
          otherLayers,
          featureProps,
          representedProperties
        );
      }
    case "circle":
      return createCircleSymbol(
        primaryLayer,
        otherLayers,
        featureProps,
        representedProperties
      );
    case "symbol":
      const layout = (primaryLayer.layout || {}) as any;
      const iconImage = layout["icon-image"];
      if (iconImage) {
        return createMarkerSymbol(primaryLayer, otherLayers, featureProps);
      }
      const textField = layout["text-field"];
      if (textField) {
        return createTextSymbol(
          primaryLayer,
          otherLayers,
          featureProps,
          representedProperties
        );
      }
      throw new Error("Not implemented");
    default:
      throw new Error("Not implemented");
  }
}

function createFillSymbol(
  fillLayer: SeaSketchGlLayer,
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

function findGetExpressionProperties(
  expression: any,
  callback: (propName: string) => void
) {
  if (isExpression(expression)) {
    const [fnName, ...args] = expression;
    if (fnName === "get") {
      callback(args[0]);
    } else {
      for (const arg of args) {
        findGetExpressionProperties(arg, callback);
      }
    }
  }
}

function normalizeLegacyFilterExpression(expression: any) {
  if (isExpression(expression) && !hasGetExpression(expression)) {
    if (typeof expression[1] === "string" && expression[1][0] !== "$") {
      const newExpression = [...expression];
      newExpression[1] = ["get", expression[1]];
      return newExpression;
    } else if (expression[0] === "all" || expression[0] === "any") {
      const newExpression = [...expression];
      var i = 1;
      while (expression[i]) {
        newExpression[i] = normalizeLegacyFilterExpression(expression[i]);
        i++;
      }
      return newExpression;
    }
  }
  return expression;
}

function collectValuesForFeatureProperty(
  propName: string,
  layers: SeaSketchGlLayer[]
) {
  const values: (string | number | boolean)[] = [];
  for (const layer of layers) {
    const paint = layer.paint as any;
    for (const prop of SIGNIFICANT_PAINT_PROPS) {
      if (hasGetExpressionForProperty(paint[prop], propName)) {
        forEachMatch(paint[prop] as Expression, (match, filters) => {
          if (match[1][1] === propName) {
            const inputOutputPairs = match.slice(2, match.length - 1);
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
              values.push(inputOutputPairs[0]);
            }
          }
        });
        forEachStep(paint[prop] as Expression, (step, filters) => {
          if (step[1][1] === propName) {
            const inputOutputPairs = step.slice(3);
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
              values.push(inputOutputPairs[0]);
            }
          }
        });
        forEachTerminatingCaseBranch(
          paint[prop] as Expression,
          (condition, output, filters) => {
            // find the get prop in the condition
            if (hasGetExpressionForProperty(condition, propName)) {
              const value = propsForFilterExpressions([condition])[propName];
              if (values.indexOf(value) === -1) {
                values.push(value);
              }
            }
          }
        );
      }
    }
  }
  return values;
}

function forEachMatch(
  expression: Expression,
  fn: (match: Expression, filters: Expression[]) => void,
  filters = [] as Expression[]
) {
  if (expression[0] === "match") {
    fn(expression, filters);
  } else if (expression[0] === "case") {
    const fallback = expression[expression.length - 1];
    const conditionsAndOutputs = expression.slice(1, expression.length - 1);
    for (var i = 0; i < conditionsAndOutputs.length; i += 2) {
      const condition = conditionsAndOutputs[i];
      const output = conditionsAndOutputs[i + 1];
      forEachMatch(output, fn, [...filters, condition]);
    }
    forEachMatch(fallback, fn, filters);
  }
}

function forEachStep(
  expression: Expression,
  fn: (step: Expression, filters: Expression[]) => void,
  filters = [] as Expression[]
) {
  if (expression[0] === "step") {
    fn(expression, filters);
  } else if (expression[0] === "case") {
    const fallback = expression[expression.length - 1];
    const conditionsAndOutputs = expression.slice(1, expression.length - 1);
    for (var i = 0; i < conditionsAndOutputs.length; i += 2) {
      const condition = conditionsAndOutputs[i];
      const output = conditionsAndOutputs[i + 1];
      forEachStep(output, fn, [...filters, condition]);
    }
    forEachStep(fallback, fn, filters);
  }
}

function forEachTerminatingCaseBranch(
  expression: Expression,
  fn: (condition: Expression, output: any, filters: Expression[]) => void,
  filters = [] as Expression[]
) {
  if (expression[0] === "case") {
    const fallback = expression[expression.length - 1];
    const conditionsAndOutputs = expression.slice(1, expression.length - 1);
    for (var i = 0; i < conditionsAndOutputs.length; i += 2) {
      const condition = conditionsAndOutputs[i];
      const output = conditionsAndOutputs[i + 1];
      if (isExpression(output) && !/^to-/.test(output[0])) {
        if (output[0] === "case") {
          forEachTerminatingCaseBranch(output, fn, [...filters, condition]);
        }
      } else {
        fn(condition, output, filters);
      }
    }
  }
}
