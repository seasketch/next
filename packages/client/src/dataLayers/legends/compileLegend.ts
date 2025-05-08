import { Feature } from "geojson";
import {
  CircleLayer,
  Expression,
  FillExtrusionLayer,
  FillLayer,
  Layer,
  LineLayer,
} from "mapbox-gl";
import styleSpec from "@mapbox/mapbox-gl-style-spec/reference/v8.json";
import { ExpressionEvaluator, RGBA } from "./ExpressionEvaluator";
import {
  GLLegendBubblePanel,
  GLLegendCircleSymbol,
  GLLegendFillSymbol,
  GLLegendFilterPanel,
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
import { SeaSketchLayerMetadata } from "../../admin/data/styleEditor/Editors";
import { expression } from "mapbox-gl/dist/style-spec/index.es.js";

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

const SIGNIFICANT_STYLE_PROPS = [
  ...(SIGNIFICANT_PAINT_PROPS.map((p) => ({
    type: "paint",
    prop: p,
  })) as StyleProp[]),
  ...(SIGNIFICANT_LAYOUT_PROPS.map((p) => ({
    type: "layout",
    prop: p,
  })) as StyleProp[]),
];

export function compileLegendFromGLStyleLayers(
  layers: SeaSketchGlLayer[],
  sourceType:
    | "vector"
    | "raster"
    | "geojson"
    | "image"
    | "video"
    | "raster-dem",
  representativeColors?: number[][],
  scale?: number,
  offset?: number
): LegendForGLLayers {
  if (
    sourceType === "raster" &&
    layers.length === 1 &&
    "paint" in layers[0] &&
    "raster-color" in layers[0].paint! &&
    isExpression(layers[0].paint!["raster-color"]) &&
    ["interpolate", "match", "step"].includes(
      layers[0].paint!["raster-color"][0]
    )
  ) {
    let legendItems: { panel: GLLegendPanel; filters: Expression[] }[] = [];
    const layer = cloneDeep(layers[0]);
    // @ts-ignore
    const rasterColor = layer.paint!["raster-color"];
    switch (rasterColor[0]) {
      case "match":
        legendItems.push({
          panel: pluckRasterMatchPanel(
            "layer-0-raster-color-legend",
            rasterColor,
            layer.metadata,
            // @ts-ignore
            layer.paint!["raster-color-range"] as [number, number] | undefined
          ),
          filters: [],
        });
        break;
      case "step":
        legendItems.push({
          panel: pluckRasterStepPanel(
            "layer-0-raster-color-legend",
            rasterColor,
            layer.metadata,
            // @ts-ignore
            layer.paint!["raster-color-range"] as [number, number] | undefined
          ),
          filters: [],
        });
        if (
          (layer.metadata as SeaSketchLayerMetadata)?.[
            "s:respect-scale-and-offset"
          ] &&
          ((scale && scale !== 1) || (offset && offset !== 0))
        ) {
          for (const item of (legendItems[0].panel as GLLegendStepPanel)
            .steps) {
            let value = item.value as number;
            if (layer.metadata && layer.metadata["s:round-numbers"]) {
              value = Math.round(value);
            }
            value = value * scale! + offset!;
            if (layer.metadata && layer.metadata["s:round-numbers"]) {
              value = Math.round(value);
            }
            item.label = value.toLocaleString();
            if (layer.metadata?.["s:value-suffix"]?.length) {
              item.label += layer.metadata["s:value-suffix"];
            }
          }
        }
        break;
      case "interpolate":
      case "interpolate-hcl":
      case "interpolate-lab":
        legendItems.push({
          panel: {
            // eslint-disable-next-line i18next/no-literal-string
            id: `layer-0-raster-color-legend`,
            type: "GLLegendGradientPanel",
            stops: interpolationExpressionToStops(rasterColor, layer.metadata),
          },
          filters: [],
        });
        if ((scale && scale !== 1) || (offset && offset !== 0)) {
          scale = scale === null || scale === undefined ? 1 : scale;
          offset = offset === null || offset === undefined ? 0 : offset;
          const panel = legendItems[0].panel as GLLegendGradientPanel;
          panel.stops = panel.stops.map((stop) => {
            let value = stop.value * scale! + offset!;
            if (layer.metadata && layer.metadata["s:round-numbers"]) {
              value = Math.round(value);
            }
            return {
              ...stop,
              value,
              ...(layer.metadata?.["s:value-suffix"]?.length
                ? {
                    label: `${value.toLocaleString()}${
                      layer.metadata?.["s:value-suffix"]
                    }`,
                  }
                : { label: value.toLocaleString() }),
            };
          });
        }
        break;
    }

    // TODO: pluck list items from match expressions or get interpolation
    // return {
    //   type: "SimpleGLLegend",
    //   symbol: {
    //     type: "rgb-raster",
    //     representativeColors,
    //   },
    // };
    const panels = consolidatePanels(legendItems);
    if (layers.find((l) => l.metadata && l.metadata["s:legend-labels"])) {
      const allLabels: { [key: string]: string } = {};
      // TODO: this means labels could be set in multiple places and be
      // different...
      for (const layer of layers) {
        const labels = layer.metadata["s:legend-labels"];
        for (const key in labels) {
          allLabels[key] = labels[key];
        }
      }
      for (const panel of panels) {
        if (panel.type === "GLLegendListPanel") {
          for (const item of panel.items) {
            if (item.label.toString() in allLabels) {
              item.label = allLabels[item.label];
            }
          }
        } else if (panel.type === "GLLegendStepPanel") {
          for (const step of panel.steps) {
            if (step.label.toString() in allLabels) {
              step.label = allLabels[step.label];
            }
          }
        }
      }
    }
    return {
      type: "MultipleSymbolGLLegend",
      panels,
    };
  } else if (
    sourceType === "raster" ||
    sourceType === "raster-dem" ||
    sourceType === "image"
  ) {
    return {
      type: "SimpleGLLegend",
      symbol: {
        type: "rgb-raster",
        representativeColors,
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

  try {
    // Iterate through each of the possible complex panel types, creating them
    // as found. When creating these panels, layers and style properties are
    // "plucked" from the list so that they aren't repeated.
    // If panels require additional data conditions to be met, those are added
    // to the filters array.
    const clonedLayers = cloneDeep(layers);
    const context = { layers: clonedLayers };
    try {
      legendItems.push(...pluckHeatmapPanels(context));
    } catch (e) {
      console.warn(e);
    }
    try {
      legendItems.push(...pluckBubblePanels(context));
    } catch (e) {
      console.warn(e);
    }
    try {
      legendItems.push(...pluckMarkerSizePanels(context));
    } catch (e) {
      console.warn(e);
    }
    try {
      legendItems.push(...pluckGradientPanels(context));
    } catch (e) {
      console.warn(e);
    }
    try {
      legendItems.push(...pluckStepPanels(context));
    } catch (e) {
      console.warn("problem plucking step panels");
      console.warn(e);
    }
    try {
      legendItems.push(...pluckListPanelsFromMatchExpressions(context));
    } catch (e) {
      console.warn(e);
    }
    try {
      legendItems.push(...pluckListPanelsForCaseAndFilterExpressions(context));
    } catch (e) {
      // do nothing
      console.warn(e);
    }

    try {
      legendItems.push(...pluckFilterPanels(context));
    } catch (e) {
      console.warn(e);
    }

    try {
      // render any remaining layers as simple symbols
      if (legendItems.length > 0) {
        for (const layer of context.layers) {
          if (
            layer.type !== "symbol" ||
            (layer.paint || ({} as any))["icon-image"]
          ) {
            legendItems.push({
              filters: [],
              panel: {
                // eslint-disable-next-line i18next/no-literal-string
                id: `remaining-layer-${context.layers.indexOf(layer)}`,
                type: "GLLegendSimpleSymbolPanel",
                items: [
                  {
                    id: "remaining-layer-single-child",
                    symbol: getSingleSymbolForVectorLayers([layer]),
                  },
                ],
              },
            });
          }
        }
      }
    } catch (e) {
      if (legendItems.length === 0) {
        throw e;
        // else skip and just render what you have
      }
    }

    let panels = consolidatePanels(legendItems);

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

    // Where fill layers exist, convert all line layers to fill layers with a
    // transparent fill
    if (layers.find((l) => l.type === "fill")) {
      transformLineSymbolsToFill(panels);
    }

    eliminateDuplicatesAndRenameDefaults(panels);

    // sort panels. filter panels should go last
    panels.sort((a, b) => {
      if (a.type === "GLLegendFilterPanel") {
        return 1;
      } else if (b.type === "GLLegendFilterPanel") {
        return -1;
      } else {
        return 0;
      }
    });
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
  } catch (e) {
    console.warn(e);
    return {
      type: "SimpleGLLegend",
      symbol: getSingleSymbolForVectorLayers(layers),
    };
  }
}

function eliminateDuplicatesAndRenameDefaults(panels: GLLegendPanel[]) {
  for (const panel of panels) {
    if (panel.type === "GLLegendFilterPanel") {
      eliminateDuplicatesAndRenameDefaults(panel.children);
    } else if (panel.type === "GLLegendListPanel") {
      const existingKeys = new Set<string>();
      const plucked: any = [];
      for (const item of panel.items) {
        if (
          (item.label === "" || item.label === " ") &&
          panel.items.length > 1
        ) {
          item.label = "default";
        }
        const key = `${item.label}-${item.symbol.type}`;
        if (existingKeys.has(key)) {
          plucked.push(item);
        } else {
          existingKeys.add(key);
        }
      }
      panel.items = panel.items.filter((item) => !plucked.includes(item));
      // find any item labelled "default", and put it at the buttom of the list
      const defaultItem = panel.items.find((item) => item.label === "default");
      if (defaultItem) {
        panel.items = panel.items.filter((item) => item !== defaultItem);
        panel.items.push(defaultItem);
      }
    }
  }
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
    } else if (filter[0] === "all") {
      for (const arg of filter.slice(1)) {
        const filterProps = propsForSimpleFilter(arg);
        for (const prop in filterProps) {
          featureProps[prop] = filterProps[prop];
        }
      }
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
    // throw new Error("Could not find get expression in filter");
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
            const metadata = (layer.metadata || {}) as SeaSketchLayerMetadata;
            // construct a bubble panel
            panels.push({
              panel: {
                // eslint-disable-next-line i18next/no-literal-string
                id: `bubble-${circleLayers.indexOf(
                  layer
                )}-${exprData.facets.indexOf(facet)}`,
                type: "GLLegendBubblePanel",
                label:
                  metadata["s:legend-labels"] &&
                  interpolate[2][1] in metadata["s:legend-labels"]
                    ? metadata["s:legend-labels"][interpolate[2][1]]
                    : interpolate[2][1],
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

export function pluckMarkerSizePanels(context: { layers: SeaSketchGlLayer[] }) {
  const panels: { panel: GLMarkerSizePanel; filters: Expression[] }[] = [];
  // Look for symbol layers with an icon-size expression
  const symbolLayers = context.layers.filter(
    (l) => l.type === "symbol" && l.layout?.visibility !== "none"
  ) as CircleLayer[];
  for (const layer of symbolLayers) {
    const layout = layer.layout || ({} as any);
    if (layout["icon-size"]) {
      const size = layout["icon-size"];
      if (size) {
        const exprData = pluckGetExpressionsOfType(
          size,
          "interpolate",
          "number"
        );
        if (exprData.facets.length) {
          const representedProperties = new RepresentedProperties();
          // the "plucking" part, removes bubble chart related values from layer
          // @ts-ignore
          layer.layout["icon-size"] = exprData.remainingValues;
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
                id: `marker-size-${symbolLayers.indexOf(
                  layer
                )}-${exprData.facets.indexOf(facet)}`,
                type: "GLMarkerSizePanel",
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
                      // eslint-disable-next-line i18next/no-literal-string
                      id: `stop-${stops.indexOf(s)}`,
                      imageId: evaluateLayerProperty(
                        layer,
                        "layout",
                        "icon-image",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      value: s.input,
                      iconSize: s.output as number,
                      color: evaluateLayerProperty(
                        layer,
                        "paint",
                        "icon-color",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      haloColor: evaluateLayerProperty(
                        layer,
                        "paint",
                        "icon-halo-color",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      haloWidth: evaluateLayerProperty(
                        layer,
                        "paint",
                        "icon-halo-width",
                        featureData,
                        "Point",
                        representedProperties
                      ),
                      rotation: evaluateLayerProperty(
                        layer,
                        "layout",
                        "icon-rotate",
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
      const metadata: SeaSketchLayerMetadata = layer.metadata || {};
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
              const getProp = findGetExpression(facet.expression)?.property;
              let label = getProp || paintProp;
              if (getProp && metadata["s:legend-labels"]?.[getProp]) {
                label = metadata["s:legend-labels"][getProp];
              }
              panels.push({
                panel: {
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `${context.layers.indexOf(
                    layer
                  )}-${paintProp}-${exprData.facets.indexOf(facet)}-gradient`,
                  type: "GLLegendGradientPanel",
                  label,
                  stops: interpolationExpressionToStops(
                    facet.expression,
                    metadata
                  ),
                },
                filters:
                  layer.filter &&
                  isExpression(layer.filter) &&
                  layer.metadata?.["s:exclude-outside-range"] !== true
                    ? [layer.filter, ...facet.filters]
                    : facet.filters,
              });
            }
            // Look for unrelated get expressions in the remaining style props
            // if none are present, remove the layer
            let hasRemainingGetExpressions = false;
            for (const styleProp of SIGNIFICANT_STYLE_PROPS) {
              const paint = layer.paint || ({} as any);
              const layout = layer.layout || ({} as any);
              const styleValue =
                styleProp.type === "paint"
                  ? paint[styleProp.prop]
                  : layout[styleProp.prop];
              if (
                styleValue &&
                hasGetExpression(styleValue) &&
                styleProp.prop !== paintProp
              ) {
                if (
                  styleProp.prop === "circle-stroke-color" &&
                  /interpolate|step/.test(styleValue[0])
                ) {
                  hasRemainingGetExpressions = false;
                } else {
                  hasRemainingGetExpressions = true;
                }
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

interface StyleProp {
  type: "paint" | "layout";
  prop: string;
}

function pluckLayersWithExpression<T extends GLLegendPanel>(
  context: { layers: SeaSketchGlLayer[] },
  expressionFnName: "step" | "match" | "case",
  fn: (
    prop: StyleProp,
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
      const layout = layer.layout || ({} as any);
      for (const styleProp of SIGNIFICANT_STYLE_PROPS) {
        const styleValue =
          styleProp.type === "paint"
            ? paint[styleProp.prop]
            : layout[styleProp.prop];
        if (
          styleValue !== undefined &&
          isExpression(styleValue) &&
          !representedProperties.has(styleProp.prop)
        ) {
          const exprData = pluckGetExpressionsOfType(
            styleValue,
            expressionFnName,
            // @ts-ignore
            styleSpec[
              (styleProp.type === "paint" ? "paint_" : "layout_") + layer.type
            ][styleProp.prop].type
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
              const id = `${layers.indexOf(layer)}-${
                styleProp.prop
              }-${exprData.facets.indexOf(facet)}-${expressionFnName}`;
              // TODO: need to set featureProps to match the facet filters
              const featureProps = propsForFilterExpressions(facet.filters);
              const result = fn(
                styleProp,
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
          if (styleProp.type === "paint") {
            // @ts-ignore
            layer.paint[styleProp.prop] = exprData.remainingValues;
          } else {
            // @ts-ignore
            layer.layout[styleProp.prop] = exprData.remainingValues;
          }
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

export function pluckRasterStepPanel(
  id: string,
  expression: Expression,
  metadata?: SeaSketchLayerMetadata,
  rasterColorRange?: [number, number]
) {
  const round = Boolean(metadata?.["s:round-numbers"]);
  const scale = Boolean(metadata?.["s:respect-scale-and-offset"]);
  const inputOutputPairs = expression.slice(2);

  const panel: GLLegendStepPanel = {
    id,
    type: "GLLegendStepPanel",
    steps: [
      ...(rasterColorRange && inputOutputPairs[1] === rasterColorRange[0]
        ? []
        : [
            {
              id: id + "-first",
              label: "< " + inputOutputPairs[1],
              value: "< " + inputOutputPairs[1],
              symbol: {
                type: "fill",
                color: inputOutputPairs[0],
              } as GLLegendFillSymbol,
            },
          ]),
      ...inputOutputPairs.reduce((steps, current, i) => {
        if (i % 2 !== 0) {
          const input = current;
          const output = inputOutputPairs[i + 1];
          let displayValue = input;
          if (scale) {
          }
          if (round) {
            displayValue = Math.round(input);
          }
          if (
            output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
            output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
          ) {
            steps.push({
              id: id + "-" + i,
              label: `${displayValue.toLocaleString()}`,
              value: input,
              symbol: {
                type: "fill",
                color: output,
              } as GLLegendFillSymbol,
            });
          }
        }
        return steps;
      }, [] as { id: string; label: string; symbol: GLLegendSymbol }[]),
    ],
  };
  // filter out transparent pixels from legend
  panel.steps = panel.steps.filter(
    (step) => "color" in step.symbol && step.symbol.color !== "transparent"
  );
  const sortedCategories = metadata?.["s:sorted-categories"];
  if (sortedCategories && panel.steps.find((s) => Boolean(s.value))) {
    panel.steps = panel.steps.sort((a, b) => {
      return (
        sortedCategories.indexOf(a.value) - sortedCategories.indexOf(b.value)
      );
    });
  }
  return panel;
}

export function pluckRasterMatchPanel(
  id: string,
  expression: Expression,
  metadata?: SeaSketchLayerMetadata,
  rasterColorRange?: [number, number]
) {
  const defaultValue = expression[expression.length - 1];
  const inputOutputPairs = expression.slice(2, -1);

  const panel: GLLegendListPanel = {
    id,
    type: "GLLegendListPanel",
    items: [],
  };

  for (var i = 0; i < inputOutputPairs.length; i += 2) {
    const input = inputOutputPairs[i];
    const output = inputOutputPairs[i + 1];
    if (
      output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
      output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
    ) {
      // valuesUsed.push(input);
      panel.items.push({
        id: id + "-" + i,
        label: `${input}`,
        value: input,
        symbol: {
          type: "fill",
          color: output,
        } as GLLegendFillSymbol,
      });
    }
  }

  if (defaultValue !== "transparent") {
    panel.items.push({
      id: id + "-default",
      label: "default",
      symbol: {
        type: "fill",
        color: defaultValue,
      } as GLLegendFillSymbol,
    });
  }
  const sortedCategories = metadata?.["s:sorted-categories"];
  if (sortedCategories && panel.items.find((i) => Boolean(i.value))) {
    panel.items = panel.items.sort((a, b) => {
      return (
        sortedCategories.indexOf(a.value) - sortedCategories.indexOf(b.value)
      );
    });
  }

  return panel;
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
      const prop = expression[1][1];
      const metadata = (layer.metadata || {}) as SeaSketchLayerMetadata;
      const panel: GLLegendStepPanel = {
        id,
        type: "GLLegendStepPanel",
        label:
          metadata["s:legend-labels"] && prop in metadata["s:legend-labels"]
            ? metadata["s:legend-labels"][prop]
            : prop,
        steps: [
          ...("s:steps" in metadata
            ? []
            : [
                {
                  id: id + "-first",
                  label: "< " + inputOutputPairs[0],
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
              ]),
          ...inputOutputPairs.reduce((steps, current, i) => {
            if (i % 2 === 0) {
              const input = current;
              const output = inputOutputPairs[i + 1];
              if (
                output !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
                output !== NULLIFIED_EXPRESSION_OUTPUT_STRING
              ) {
                let label = input.toLocaleString();
                if (metadata["s:round-numbers"]) {
                  label = Math.round(input).toLocaleString();
                }
                if (metadata["s:value-suffix"]) {
                  label += metadata["s:value-suffix"];
                }
                steps.push({
                  id: id + "-" + i,
                  label,
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

  for (const layer of layers) {
    if (!pluckedLayers.includes(layer)) {
      if (layer.filter && isExpression(layer.filter)) {
        const labels = new Set<string>();
        findGetExpressionProperties(
          normalizeLegacyFilterExpression(layer.filter),
          (prop) => {
            labels.add(prop);
          }
        );
        let label = labels.size === 1 ? [...labels][0] : undefined;
        const metadata: SeaSketchLayerMetadata = layer.metadata || {};
        if (
          label &&
          metadata["s:legend-labels"] &&
          label in metadata["s:legend-labels"]
        ) {
          label = metadata["s:legend-labels"][label];
        }
        // Special case to consider here when plucking line layers. If there are one
        // or more filtered fill layers remaining, there is a state where none of
        // those filters pass and the line will be rendered without fill. We need
        // to detect those situations and include the default
        if (
          context.layers.find((l) => l.type === "fill") &&
          context.layers.find(
            (l) => l.type === "line" && l.filter === undefined
          )
        ) {
          // add the line as a default
          panels.push({
            filters: [],
            panel: {
              type: "GLLegendSimpleSymbolPanel",
              id: "default-line",
              label,
              items: [
                {
                  id: "default-line",
                  symbol: getSingleSymbolForVectorLayers(
                    context.layers.filter((l) => l.type === "line")
                  ),
                  label: "default",
                },
              ],
            },
          });
        }

        const panel: GLLegendSimpleSymbolPanel = {
          // eslint-disable-next-line i18next/no-literal-string
          id: `${layers.indexOf(layer)}-filter`,
          type: "GLLegendSimpleSymbolPanel",
          items: [],
          label,
        };
        let relatedLayers: SeaSketchGlLayer[] = [];
        const featureProps = propsForFilterExpressions([
          normalizeLegacyFilterExpression(layer.filter),
        ]);
        if ((layer.type === "fill" || layer.type === "line") && layer.filter) {
          for (const lyr of layers) {
            if (layer !== lyr && (lyr.type === "line" || lyr.type === "fill")) {
              if (lyr.filter) {
                const filter = normalizeLegacyFilterExpression(lyr.filter);
                // next see if the values which would satisfy fill layer's filters
                // would also satisfy the line layer's filters
                const featureProps = propsForFilterExpressions([
                  normalizeLegacyFilterExpression(layer.filter),
                ]);
                if (evaluateFilter(filter, featureProps)) {
                  relatedLayers.push(lyr);
                }
              } else {
                // if the line layer has no filter, it will be rendered
                // when the fill layer is rendered, so we can include it
                // in the legend
                relatedLayers.push(lyr);
              }
            }
          }
        }
        const symbol = getSingleSymbolForVectorLayers(
          [layer, ...relatedLayers],
          featureProps
        );
        if (symbol) {
          panel.items.push({
            id: panel.id + "-only",
            label:
              layer.metadata?.label ||
              labelForExpression(
                normalizeLegacyFilterExpression(layer.filter),
                false
              ),
            symbol,
          });
          panels.push({
            panel,
            // Can clear filters here, since this is the last step and there
            // should be no sub-expressions
            filters: [layer.filter],
          });
          pluckedLayers.push(layer);
          pluckedLayers.push(...relatedLayers);
        }
      }
    }
  }
  context.layers = context.layers.filter((l) => !pluckedLayers.includes(l));
  return panels;
}

export function pluckListPanelsFromMatchExpressions(context: {
  layers: SeaSketchGlLayer[];
}) {
  return pluckLayersWithExpression(
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
      const prop = expression[1][1];
      const defaultValue = expression[expression.length - 1];
      const inputOutputPairs = expression.slice(2, -1);
      const metadata: SeaSketchLayerMetadata = layer.metadata || {};
      let panelLabel = expression[1][1].toString();
      if (metadata["s:legend-labels"]?.[panelLabel]) {
        panelLabel = metadata["s:legend-labels"][panelLabel];
      }
      const panel: GLLegendListPanel = {
        id,
        type: "GLLegendListPanel",
        label: panelLabel,
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
          let label = input.toString();
          if (input && metadata["s:legend-labels"]?.[input]) {
            label = metadata["s:legend-labels"][input];
          }

          if (
            !metadata["s:excluded"] ||
            !metadata["s:excluded"].includes(input)
          ) {
            panel.items.push({
              id: id + "-" + i,
              label,
              value: input,
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
      }
      if (layer.type === "fill" || layer.type === "line") {
        const valuesForFeatureProperty = collectValuesForFeatureProperty(
          prop,
          context.layers.filter(
            (l) => (l !== layer && l.type === "fill") || l.type === "line"
          )
        );
        for (const value of valuesForFeatureProperty) {
          if (!valuesUsed.includes(value)) {
            let label = value.toString();
            if (value && metadata["s:legend-labels"]?.[value.toString()]) {
              label = metadata["s:legend-labels"][value.toString()];
            }
            if (
              !metadata["s:excluded"] ||
              !metadata["s:excluded"].includes(value)
            ) {
              panel.items.push({
                id: id + "-" + value,
                label,
                value: value,
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
            }
            valuesUsed.push(value);
          }
        }
      }
      if (
        defaultValue !== NULLIFIED_EXPRESSION_OUTPUT_NUMBER &&
        defaultValue !== NULLIFIED_EXPRESSION_OUTPUT_STRING
      ) {
        const symbol = createSymbol(
          sortedLayers.indexOf(layer),
          sortedLayers,
          {
            ...featureProps,
          },
          representedProperties
        );
        if (
          (symbol.type === "fill" && symbol.color === "transparent") ||
          (symbol.type === "line" && symbol.color === "transparent") ||
          (symbol.type === "circle" && symbol.color === "transparent")
        ) {
        } else {
          panel.items.push({
            id: id + "-default",
            label: "default",
            symbol,
          });
        }
      }
      const sortedCategories = metadata?.["s:sorted-categories"];
      if (sortedCategories && panel.items.find((s) => Boolean(s.value))) {
        panel.items = panel.items.sort((a, b) => {
          return (
            sortedCategories.indexOf(a.value) -
            sortedCategories.indexOf(b.value)
          );
        });
      }
      return panel;
    }
  );
}

export function pluckListPanelsForCaseAndFilterExpressions(context: {
  layers: SeaSketchGlLayer[];
}) {
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
      const layout = layer.layout || ({} as any);
      for (const styleProp of SIGNIFICANT_STYLE_PROPS) {
        const styleValue =
          styleProp.type === "paint"
            ? paint[styleProp.prop]
            : layout[styleProp.prop];
        if (
          styleValue &&
          isExpression(styleValue) &&
          !representedProperties.has(styleProp.prop) &&
          hasGetExpression(styleValue) &&
          styleValue[0] === "case"
        ) {
          const expression = styleValue;

          findGetExpressionProperties(expression, (prop) => {
            representedProperties.addUsedFeatureProperty(prop);
          });
          const fallback = expression[expression.length - 1];
          const inputOutputPairs = expression.slice(1, -1);
          let isSimple =
            [...representedProperties.featurePropertiesUsed].length === 1;
          if (isSimple) {
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
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
                id: `${layers.indexOf(layer)}-${styleProp.prop}-case`,
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
                      [prop]: fallback,
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
                    // pluckedLayers.push(layer);
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
              // console.warn("not simple", expression);
            }
          }
          context.layers = context.layers.filter((l) => l !== layer);
        }
      }
    }
  }
  context.layers = context.layers.filter((l) => !pluckedLayers.includes(l));
  return caseResults;
}

function labelForExpression(
  expression: Expression,
  includePropertyName = false,
  forFilterPanel = false
) {
  const fnName = expression[0];
  if (fnName === "any" || fnName === "all") {
    let isSimplish = true;
    for (const e of expression[1] as Expression[]) {
      if (e[0] === "any" || e[0] === "all") {
        isSimplish = false;
        break;
      }
    }
    if (!isSimplish) {
      return JSON.stringify(expression);
    }

    const conditions = expression.slice(1);
    const conditionFnNames = conditions.map((e: Expression) => e[0]);

    if (
      fnName === "all" &&
      conditionFnNames.length === 2 &&
      (conditionFnNames.includes("<") || conditionFnNames.includes("<=")) &&
      (conditionFnNames.includes(">") || conditionFnNames.includes(">="))
    ) {
      // format as min - max
      const minConditionIdx = conditionFnNames.findIndex(
        (c) => c === ">" || c === ">="
      );
      const maxConditionIdx = conditionFnNames.findIndex(
        (c) => c === "<" || c === "<="
      );
      const min = extractComparisonFromExpression(conditions[minConditionIdx]);
      const max = extractComparisonFromExpression(conditions[maxConditionIdx]);
      return `${min.toLocaleString()} - ${max.toLocaleString()}`;
    }

    return conditions
      .map((e: Expression) => stringifySimpleExpression(e, includePropertyName))
      .join(fnName === "all" ? ", " : " or ");
  } else {
    return stringifySimpleExpression(expression, includePropertyName);
  }
}

function extractComparisonFromExpression(expression: Expression) {
  const [fnName, ...args] = expression;
  if (fnName === "all" || fnName === "any") {
    throw new Error(
      `Can't extractComparisonFromExpression on all or any expressions`
    );
  }
  for (const arg of args) {
    if (!isExpression(arg)) {
      return arg;
    }
  }
  throw new Error(`No comparison found in expression ${expression}`);
}

function stringifySimpleExpression(
  expression: Expression,
  includePropertyName = false
) {
  const getInfo = findGetExpression(expression);
  let comparison: string | number = "";
  const fnName = expression[0];
  if (fnName === "all" || fnName === "any") {
    throw new Error(
      `all and any expressions are not supported by stringifySimpleExpression`
    );
  }
  if (isExpression(expression[1])) {
    comparison = expression[2];
  } else {
    comparison = expression[1];
  }
  if (typeof comparison === "number") {
    comparison = comparison.toLocaleString();
  }
  const propLabel = includePropertyName ? getInfo?.property + " " || "" : "";
  switch (fnName) {
    case "==":
      return propLabel + comparison;
    case "!=":
      return `${propLabel}!= ${comparison}`;
    case "!":
      return `!${comparison}`;
    default:
      return `${propLabel}${fnName} ${comparison}`;
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

// TODO: update to handle multiple source layers in the same tableOfContentsItem
// some day.

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

/**
 * Converts a mapbox-gl-style interpolation expression to a list of stops that can be used to create a legend.
 * @param expression Mapbox gl style interpolation expression
 * @returns Array<{value: number, color: string}>
 */
function interpolationExpressionToStops(
  expression?: any,
  metadata?: SeaSketchLayerMetadata
) {
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
  const excludeOutsideRange =
    Boolean(metadata?.["s:exclude-outside-range"]) &&
    expression[2][0] === "raster-value";
  const stops: { value: number; color: string; label: string }[] = [];
  if (/interpolate/.test(expression[0])) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [interpolationType, property, ...args] = expression;
    if (/interpolate/.test(interpolationType)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [input, ...stopPairs] = args;
      for (let i = 0; i < stopPairs.length; i += 2) {
        if (excludeOutsideRange && (i === 0 || i === stopPairs.length - 2)) {
          continue;
        }
        let label = stopPairs[i].toLocaleString();
        if (metadata && metadata["s:round-numbers"]) {
          label = Math.round(stopPairs[i]).toLocaleString();
        }
        if (metadata && metadata["s:value-suffix"]) {
          label += metadata["s:value-suffix"];
        }
        stops.push({
          value: stopPairs[i],
          color: stopPairs[i + 1],
          label,
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
  defaultIfAlreadyRepresented?: number | string | boolean,
  expectedType?: expression.StylePropertyType
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
      const parsed = ExpressionEvaluator.parse(value, expectedType);
      return parsed.evaluate({
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

export type SeaSketchGlLayer<T = Layer> = Omit<T, "id" | "source">;

interface LegendContext {
  globalContext: {
    zoomRanges: { layerIndex: number; zoomRange: [number, number] }[];
  };
  significantExpressions: SignificantExpression[];
  includesHeatmap: boolean;
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
        input: inputOutputPairs[i].toLocaleString(),
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
  layers: SeaSketchGlLayer[],
  featureProps = {} as { [propName: string]: any }
): GLLegendSymbol {
  // Last layer in the array is the top-most layer, so it should be the primary
  layers = [...layers].reverse();
  // determine primary symbol type
  const fillLayer = layers.find(
    (layer) =>
      (layer.type === "fill" || layer.type === "fill-extrusion") &&
      layerIsVisible(layer, featureProps)
  ) as FillLayer | FillExtrusionLayer | undefined;
  if (fillLayer && layerIsVisible(fillLayer)) {
    return createFillSymbol(
      fillLayer,
      layers.filter((l) => l !== fillLayer),
      featureProps
    );
  }
  const lineLayer = layers.find((layer) => layer.type === "line") as LineLayer;
  if (lineLayer && layerIsVisible(lineLayer)) {
    return createLineSymbol(
      lineLayer,
      layers.filter((l) => l !== lineLayer),
      featureProps
    );
  }
  const circleLayer = layers.find((layer) => layer.type === "circle");
  if (circleLayer && layerIsVisible(circleLayer)) {
    return createCircleSymbol(
      circleLayer,
      layers.filter((l) => l !== circleLayer),
      featureProps
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
        featureProps
      );
    } else if (layout["text-field"]) {
      return createTextSymbol(
        symbolLayer,
        layers.filter((l) => l !== symbolLayer),
        featureProps
      );
    }
  }
  throw new Error("Not implemented");
}

function layerIsVisible(
  layer: SeaSketchGlLayer,
  featureData?: { [propName: string]: any }
) {
  const isVisible =
    !layer.layout?.visibility || layer.layout.visibility !== "none";
  const filterPasses =
    !layer.filter ||
    featureData === undefined ||
    passesFilter(layer.filter, featureData);
  return isVisible && filterPasses;
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
  const strokeWidth =
    getPaintProp(
      paint,
      "circle-stroke-width",
      featureData,
      representedProperties,
      1
    ) || 0;
  const strokeColor = getPaintProp(
    paint,
    "circle-stroke-color",
    featureData,
    representedProperties,
    "#000",
    "color"
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
    "transparent",
    Array.isArray(paint["circle-color"]) &&
      /interpolate/.test(paint["circle-color"][0])
      ? "color"
      : undefined
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
      const visibleFillLayer = otherLayers.find(
        (l) => l.type === "fill" && layerIsVisible(l, featureProps)
      );
      if (visibleFillLayer) {
        return createFillSymbol(
          visibleFillLayer,
          layers.filter((l) => l !== visibleFillLayer),
          featureProps,
          representedProperties,
          false
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
  representedProperties?: RepresentedProperties,
  skipFill = false
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
  const lineLayers = otherLayers.filter(
    (layer) => layer.type === "line" && passesFilter(layer.filter, featureData)
  ) as Layer[];
  let dashedLine = false;
  let strokeOpacity: number | undefined;
  for (const layer of lineLayers) {
    const linePaint = (layer.paint || {}) as any;
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

  const fillPattern = getPaintProp(
    paint,
    "fill-pattern",
    featureData,
    representedProperties,
    undefined
  );

  let color = extruded
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

  if (fillPattern && !paint.hasOwnProperty("fill-color")) {
    color = "transparent";
  }
  return {
    type: "fill",
    color: skipFill ? "transparent" : color,
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
      : fillPattern,
  };
}

function passesFilter(filter: any, featureData: { [propName: string]: any }) {
  if (!filter) {
    return true;
  } else {
    return evaluateFilter(filter, featureData);
  }
}

function evaluateFilter(
  filter: Expression,
  featureData: { [propName: string]: any }
) {
  filter = normalizeLegacyFilterExpression(filter);
  return (
    ExpressionEvaluator.parse(filter).evaluate({
      type: "Feature",
      properties: featureData,
      geometry: {
        type: "Point",
        coordinates: [1, 2],
      },
    }) === true
  );
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
    const paint = layer.paint || ({} as any);
    const layout = layer.layout || ({} as any);
    for (const styleProp of SIGNIFICANT_STYLE_PROPS) {
      const styleValue = (
        styleProp.type === "paint"
          ? paint[styleProp.prop]
          : layout[styleProp.prop]
      ) as any;
      if (hasGetExpressionForProperty(styleValue, propName)) {
        forEachMatch(styleValue as Expression, (match) => {
          if (match[1][1] === propName) {
            const inputOutputPairs = match.slice(2, match.length - 1);
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
              values.push(inputOutputPairs[0]);
            }
          }
        });
        forEachStep(styleValue as Expression, (step) => {
          if (step[1][1] === propName) {
            const inputOutputPairs = step.slice(3);
            for (var i = 0; i < inputOutputPairs.length; i += 2) {
              values.push(inputOutputPairs[0]);
            }
          }
        });
        forEachTerminatingCaseBranch(styleValue as Expression, (condition) => {
          // find the get prop in the condition
          if (hasGetExpressionForProperty(condition, propName)) {
            const value = propsForFilterExpressions([condition])[propName];
            if (values.indexOf(value) === -1) {
              values.push(value);
            }
          }
        });
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

function transformLineSymbolsToFill(panels: GLLegendPanel[]) {
  for (const panel of panels) {
    switch (panel.type) {
      case "GLLegendListPanel":
      case "GLLegendStepPanel":
      case "GLLegendSimpleSymbolPanel":
        const items =
          panel.type === "GLLegendStepPanel" ? panel.steps : panel.items;
        const replacements = items.map((item) => {
          let original = item.symbol;
          return {
            ...item,
            symbol:
              original.type === "line"
                ? {
                    type: "fill",
                    color: "transparent",
                    fillOpacity: 0,
                    strokeWidth: original.strokeWidth,
                    strokeColor: original.color,
                    dashed: original.dashed,
                    extruded: false,
                    strokeOpacity: original.opacity,
                  }
                : original,
          };
        });
        if (
          panel.type === "GLLegendListPanel" ||
          panel.type === "GLLegendSimpleSymbolPanel"
        ) {
          panel.items = replacements as any;
        } else {
          panel.steps = replacements as any;
        }
        break;
    }
  }
}

export interface GroupByFilterNode {
  filters: Expression[];
  children: (GroupByFilterNode | GLLegendPanel)[];
}

export function isGroupByFilterNode(
  node: GroupByFilterNode | GLLegendPanel
): node is GroupByFilterNode {
  return "filters" in node && "children" in node;
}

export interface PanelItem {
  panel: GLLegendPanel;
  filters: Expression[];
}

/**
 * Groups the given panels by the filters that are applied to them.
 * Common filters are grouped together, and panels that have no filters
 * are attached to the root node.
 *
 */
export function groupByFilters(items: PanelItem[]): GroupByFilterNode {
  const root: GroupByFilterNode = {
    filters: [],
    children: [],
  };
  // explode ALL expressions
  items = [...items].map((item) => {
    const filters: Expression[] = [];
    for (const filter of item.filters) {
      if (filter[0] === "all") {
        filters.push(...filter.slice(1));
      } else {
        filters.push(filter);
      }
    }
    return {
      ...item,
      filters,
    };
  });

  populateNode(root, items);
  // some branches might be something like
  // filterNode(filter=a) -> filterNode(filter=b) -> panels
  // consolidate into filterNode(filter=a,b) -> panels
  consolidateFilterNodesWithNoPanels(root);
  return root;
}

function consolidateFilterNodesWithNoPanels(node: GroupByFilterNode) {
  const newChildren: (GLLegendPanel | GroupByFilterNode)[] = [];
  for (const child of node.children) {
    if (isGroupByFilterNode(child)) {
      if (
        child.children.length === 1 &&
        isGroupByFilterNode(child.children[0])
      ) {
        // promote the child's children to this node
        newChildren.push(child.children[0]);
        child.children[0].filters = [
          ...child.filters,
          ...child.children[0].filters,
        ];
        consolidateFilterNodesWithNoPanels(child.children[0]);
      } else {
        newChildren.push(child);
        consolidateFilterNodesWithNoPanels(child);
      }
    } else {
      newChildren.push(child);
    }
    node.children = newChildren;
  }
}

function populateNode(node: GroupByFilterNode, items: PanelItem[]) {
  const groupByExpression: { [expression: string]: PanelItem[] } = {};
  // add items that match the filter of the above node (exactly)
  for (const item of items) {
    let matches = true;
    for (const filter of item.filters) {
      if (
        !node.filters.find((f) => JSON.stringify(f) === JSON.stringify(filter))
      ) {
        matches = false;
        break;
      }
    }
    if (matches) {
      node.children.push(item.panel);
    }
  }
  items = items.filter((i) => !node.children.includes(i.panel));
  if (items.length === 0) {
    return;
  }
  // cull "represented" filters from remaining items since they are nested under
  // a filtered node
  for (const item of items) {
    item.filters = item.filters.filter(
      (f) =>
        !node.filters.find((f2) => JSON.stringify(f2) === JSON.stringify(f))
    );
  }
  let iterationLimit = 999;
  for (const item of items) {
    for (const filter of item.filters) {
      const stringified = JSON.stringify(filter);
      if (!groupByExpression[stringified]) {
        groupByExpression[stringified] = [];
      }
      groupByExpression[stringified].push(item);
    }
  }
  while (Object.keys(groupByExpression).length) {
    iterationLimit--;
    if (iterationLimit < 0) {
      throw new Error("Iteration limit exceeded");
    }
    // find the most common expression
    let mostCommonExpression: string | undefined;
    for (const key in groupByExpression) {
      if (
        !mostCommonExpression ||
        groupByExpression[key].length >
          groupByExpression[mostCommonExpression].length
      ) {
        mostCommonExpression = key;
      }
    }
    if (!mostCommonExpression) {
      throw new Error("No most common expression");
    }
    const child: GroupByFilterNode = {
      filters: [JSON.parse(mostCommonExpression)],
      children: [],
    };
    node.children.push(child);
    populateNode(child, groupByExpression[mostCommonExpression]);
    for (const item of groupByExpression[mostCommonExpression]) {
      for (const key in groupByExpression) {
        groupByExpression[key] = groupByExpression[key].filter(
          (i) => i !== item
        );
        if (groupByExpression[key].length === 0) {
          delete groupByExpression[key];
        }
      }
    }
    delete groupByExpression[mostCommonExpression];
  }
}

function consolidatePanels(
  items: {
    panel: GLLegendPanel;
    filters: Expression[];
  }[]
): GLLegendPanel[] {
  // first, ensure all legacy filters are converted to get expressions so that
  // related filters match
  for (const item of items) {
    item.filters = item.filters.map((filter) =>
      normalizeLegacyFilterExpression(filter)
    );
  }
  // Merge list panels with matching filters and labels
  const grouped = groupByFilters(items);
  consolidateNode(grouped);
  const rootFilterPanel = consolidateFilterPanel(grouped);

  // At each "level", perform a consolidation of panels
  return rootFilterPanel.children;
}

function consolidateNode(node: GroupByFilterNode) {
  // repeat recursively for all sub-nodes
  // promote subNodes with single simple symbol panels which have matching
  // get expression target properties into a single list panel
  const listPanels: { [key: string]: GLLegendListPanel } = {};
  for (const subNode of node.children.filter(isGroupByFilterNode)) {
    if (
      subNode.children.length === 1 &&
      !isGroupByFilterNode(subNode.children[0]) &&
      subNode.children[0].type === "GLLegendSimpleSymbolPanel"
    ) {
      const getProps = new Set<string>();
      subNode.filters.forEach((f) => {
        findGetExpressionProperties(f, (propName) => {
          getProps.add(propName);
        });
      });
      if (getProps.size === 1) {
        const propName = getProps.values().next().value;
        const panel = subNode.children[0] as GLLegendSimpleSymbolPanel;
        const key = `${propName}%%${panel.items[0].symbol.type}`;
        if (!listPanels[key]) {
          listPanels[key] = {
            id: key,
            type: "GLLegendListPanel",
            label: subNode.filters.length === 1 ? " " : propName,
            items: [],
          };
        }
        const list = listPanels[key];
        let filterPropNames = new Set<string>();
        for (const filter of subNode.filters) {
          findGetExpressionProperties(filter, (propName) => {
            filterPropNames.add(propName);
          });
        }
        const filterPropRepresentedInPanelLabel =
          filterPropNames.size === 1 && filterPropNames.has(panel.label || "");
        list.items.push({
          id: panel.items[0].id,
          label:
            panel.items[0].label ||
            subNode.filters
              .map((f) =>
                labelForExpression(f, !filterPropRepresentedInPanelLabel)
              )
              .join(" && "),
          symbol: panel.items[0].symbol,
        });
        node.children = node.children.filter((c) => c !== subNode);
      }
    }
  }
  node.children.push(...Object.values(listPanels));

  // Do another pass, looking for nodes with a single get filter prop that
  // matches their child panel labels. If they match, delete the filter and
  // promote the node
  for (const child of node.children.filter(isGroupByFilterNode)) {
    const filterProps = new Set<string>();
    child.filters.forEach((f) => {
      findGetExpressionProperties(f, (propName) => {
        filterProps.add(propName);
      });
    });
    if (filterProps.size === 1) {
      const propName = filterProps.values().next().value;
      for (const panel of child.children) {
        if (!isGroupByFilterNode(panel)) {
          if (
            (panel.type === "GLLegendListPanel" ||
              panel.type === "GLLegendSimpleSymbolPanel") &&
            panel.label === propName
          ) {
            // promote to node
            node.children.push(panel);
            child.children = child.children.filter((c) => c !== panel);
          }
        }
      }
      if (child.children.length === 0) {
        node.children = node.children.filter((c) => c !== child);
      }
    }
  }

  // Finally, merge all list and simple panels with matching labels and symbol
  // types
  const merged: { [key: string]: GLLegendListPanel } = {};
  const plucked: GLLegendPanel[] = [];
  for (const panel of node.children) {
    if (!isGroupByFilterNode(panel)) {
      if (
        (panel.type === "GLLegendListPanel" ||
          panel.type === "GLLegendSimpleSymbolPanel") &&
        panel.items.length > 0
      ) {
        const key = `${panel.label}`;
        if (!merged[key]) {
          merged[key] = {
            id: panel.id,
            type: "GLLegendListPanel",
            label: panel.label,
            items: [],
          };
        }
        const list = merged[key];
        list.items.push(
          ...panel.items.map((item) => ({
            ...item,
            label: item.label || panel.label || "",
          }))
        );
        plucked.push(panel);
      }
    }
  }

  node.children = node.children.filter(
    (n) => isGroupByFilterNode(n) || !plucked.includes(n)
  );
  for (const item of Object.values(merged)) {
    node.children.push(item);
  }

  for (const subNode of node.children.filter(isGroupByFilterNode)) {
    consolidateNode(subNode);
  }
}

function consolidateFilterPanel(node: GroupByFilterNode) {
  const filterPanel: GLLegendFilterPanel = {
    id: node.filters.length === 0 ? "root" : JSON.stringify(node.filters),
    type: "GLLegendFilterPanel",
    label: node.filters
      .map((f) => labelForExpression(f, true, true))
      .join(", "),
    children: [],
  };
  const panels: GLLegendPanel[] = [];
  for (const nodeOrPanel of node.children) {
    if (isGroupByFilterNode(nodeOrPanel)) {
      filterPanel.children.push(consolidateFilterPanel(nodeOrPanel));
    } else {
      panels.push(nodeOrPanel);
    }
  }

  filterPanel.children.push(...panels);
  return filterPanel;
}
