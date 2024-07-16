import cloneDeep from "lodash.clonedeep";
import {
  AnyLayer,
  CircleLayer,
  Expression,
  FillLayer,
  LineLayer,
  SymbolLayer,
} from "mapbox-gl";
import { isExpression } from "../../dataLayers/legends/utils";
import { colord } from "colord";
import { autoStrokeColorForFill } from "./styleEditor/FillStyleEditor";

type HighlightableLayer = FillLayer | LineLayer | SymbolLayer | CircleLayer;
export function isHighlightableLayer(
  layer: AnyLayer
): layer is HighlightableLayer {
  return (
    layer.type === "fill" ||
    layer.type === "line" ||
    layer.type === "symbol" ||
    layer.type === "circle"
  );
}

/**
 * Converts legacy mapbox-gl-style filter expressions to the modern form which
 * uses the `["get", "property"]` syntax.
 *
 * https://docs.mapbox.com/style-spec/reference/other/#other-filter
 *
 * Should be able to run this against even modern filter expressions without
 * any problems.
 *
 * @param expression
 * @returns mapboxgl.Expression
 */
export function upgradeLegacyFilterExpressions(
  expression: Expression
): Expression {
  const [operator] = expression;
  switch (operator) {
    case "==":
    case "!=":
    case ">":
    case ">=":
    case "<":
    case "<=":
      return upgradeComparisonFilter(expression);
    // @ts-ignore
    case "!has":
    case "has":
      return upgradeExistentialFilter(expression as [string, string]);
    //@ts-ignore
    case "!in":
    case "in":
      //@ts-ignore
      return upgradeSetMembershipFilter(expression);
    // @ts-ignore
    case "none":
    case "all":
    case "any":
      return upgradeCombinationFilter(expression);
    default:
      return [...expression];
  }
}

function hasLegacyFilterArgs(expression: Expression): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [operator, left, right] = expression;
  return !Array.isArray(left) && !Array.isArray(right);
}

// https://docs.mapbox.com/style-spec/reference/other/#comparison-filters
function upgradeComparisonFilter(expression: Expression): Expression {
  if (hasLegacyFilterArgs(expression)) {
    return [expression[0], ["get", expression[1]], expression[2]];
  } else {
    return expression;
  }
}

// https://docs.mapbox.com/style-spec/reference/other/#existential-filters
function upgradeExistentialFilter(expression: [string, string]): Expression {
  if (typeof expression[1] === "string") {
    if (expression[0] === "!has") {
      return ["!", ["has", expression[1]]];
    } else {
      return [...expression] as Expression;
    }
  } else {
    return expression as Expression;
  }
}

// https://docs.mapbox.com/style-spec/reference/other/#set-membership-filters
function upgradeSetMembershipFilter(
  expression: ["in" | "!in", string, ...any]
): Expression {
  const [operator, property, ...values] = expression;
  if (Array.isArray(property)) {
    return expression as Expression;
  }
  const propertyExpression =
    property === "$type" ? ["geometry-type"] : ["get", property];
  if (operator === "!in") {
    return ["!", ["in", propertyExpression, values]];
  } else {
    return ["in", propertyExpression, values];
  }
}

// https://docs.mapbox.com/style-spec/reference/other/#combining-filters
function upgradeCombinationFilter(expression: Expression): Expression {
  const [operator, ...args] = expression;
  // @ts-ignore
  if (operator === "none") {
    return ["!", [operator, ...args.map(upgradeLegacyFilterExpressions)]];
  } else {
    return [operator, ...args.map(upgradeLegacyFilterExpressions)];
  }
}

/**
 * Generates appropriate styles for hovering or selecting features within a set
 * of layers. If the layers already contain feature-state expressions which
 * access "selected" or "hovered", this function will not modify the layers.
 *
 * Supports fill, line, circle, and text label layers. All other layer types
 * will be returned unmodified.
 *
 * Unfortunately "marker layers" (symbols with an icon-image) cannot be
 * supported since layout properties cannot be modified by feature-state.
 *
 * @param layers
 * @returns
 */
export function addInteractivityExpressions(layers: AnyLayer[]) {
  // First check to see if the author of the styles for this layer already
  // added interactivity expressions. If so, we don't want to add generated
  // styles.
  if (
    layers.find(
      (layer) => isHighlightableLayer(layer) && hasFeatureStateExpression(layer)
    )
  ) {
    return layers;
  }
  if (!layers.find((l) => isHighlightableLayer(l))) {
    return layers;
  }
  const lineLayers = layers.filter(
    (layer) => layer.type === "line"
  ) as LineLayer[];
  const fillLayers = layers.filter(
    (layer) => layer.type === "fill"
  ) as FillLayer[];
  const circleLayers = layers.filter(
    (layer) => layer.type === "circle"
  ) as CircleLayer[];
  const markerLayers = layers.filter(
    (layer) => layer.type === "symbol" && layer.layout?.["icon-image"]
  ) as SymbolLayer[];
  const labelLayers = layers.filter(
    (layer) =>
      layer.type === "symbol" &&
      layer.layout?.["text-field"] &&
      !layer.layout?.["icon-image"]
  ) as SymbolLayer[];
  const newLayers: AnyLayer[] = [];
  if (lineLayers.length > 0) {
    // this is the easiest. just increase widths of existing lines
    for (const l of layers) {
      if (l.type !== "line") {
        newLayers.push(l);
        continue;
      }
      const layer = cloneDeep(l);
      if (layer.paint) {
        const lineWidthValue = layer.paint["line-width"];
        const lineOpacity = layer.paint["line-opacity"];
        const lineColor = layer.paint["line-color"];
        layer.paint = {
          ...layer.paint,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            ["max", ["*", lineWidthValue || 1, 1.5], 3],
            ["boolean", ["feature-state", "hovered"], false],
            ["max", ["*", lineWidthValue || 1, 1.25], 2],
            lineWidthValue || 1,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1,
            ["boolean", ["feature-state", "hovered"], false],
            1,
            lineOpacity || 1,
          ],
          "line-color": [
            "let",
            "c",
            ["to-rgba", lineColor || "#000"],
            [
              "rgba",
              ["at", 0, ["var", "c"]],
              ["at", 1, ["var", "c"]],
              ["at", 2, ["var", "c"]],
              [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                1,
                ["boolean", ["feature-state", "hovered"], false],
                1,
                ["at", 3, ["var", "c"]],
              ],
            ],
          ],
        };
      }
      newLayers.push(layer);
    }
  } else if (fillLayers.length > 0) {
    // uh oh. There are fill layers but no line layers. We'll need to create
    // line layers for each fill layer. If there are multiple fill layers,
    // it's likely they are using filters to show different colors for
    // different feature classes. We'll need to create a line layer for each
    // fill layer.
    for (const l of layers) {
      if (l.type !== "fill") {
        newLayers.push(l);
        continue;
      }
      newLayers.push(l);
      if (l.paint) {
        let fillColorValue = l.paint["fill-color"];
        if (!isExpression(fillColorValue)) {
          fillColorValue = colord(fillColorValue as string)
            .alpha(1)
            .toHex();
        }
        let fillOutlineColorValue = l.paint["fill-outline-color"];
        if (fillOutlineColorValue && !isExpression(fillOutlineColorValue)) {
          fillOutlineColorValue = colord(fillOutlineColorValue as string)
            .alpha(1)
            .toHex();
        }
        newLayers.push({
          type: "line",
          // eslint-disable-next-line i18next/no-literal-string
          id: `${l.id}-outline`,
          source: l.source,
          ...(l["source-layer"] ? { "source-layer": l["source-layer"] } : {}),
          ...(l.filter ? { filter: l.filter } : {}),
          layout: {
            visibility: "visible",
          },
          paint: {
            "line-color": [
              "let",
              "c",
              [
                "to-rgba",
                fillOutlineColorValue ||
                  fillColorValue ||
                  // "#000000" ||
                  autoStrokeColorForFill(l),
              ],
              [
                "rgba",
                ["at", 0, ["var", "c"]],
                ["at", 1, ["var", "c"]],
                ["at", 2, ["var", "c"]],
                [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  1,
                  ["boolean", ["feature-state", "hovered"], false],
                  1,
                  0,
                ],
              ],
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              2,
              ["boolean", ["feature-state", "hovered"], false],
              1.5,
              0,
            ],
          },
        } as LineLayer);
      }
    }
  } else if (circleLayers.length > 0) {
    for (const l of layers) {
      if (l.type !== "circle") {
        newLayers.push(l);
        continue;
      }
      const layer = cloneDeep(l);
      // Slightly increase the size of the circle if hovered or selected
      if (layer.paint) {
        const circleRadius = layer.paint["circle-radius"];
        const circleStrokeWidth = layer.paint["circle-stroke-width"];
        const circleStrokeOpacity = layer.paint["circle-stroke-opacity"];
        layer.paint = {
          ...layer.paint,
          ...(circleStrokeWidth
            ? {
                "circle-stroke-width": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  ["*", circleStrokeWidth, 2],
                  ["boolean", ["feature-state", "hovered"], false],
                  ["*", circleStrokeWidth, 1.5],
                  circleStrokeWidth,
                ],
              }
            : {}),
          ...(isExpression(circleRadius) && /interpolate/.test(circleRadius[0])
            ? {}
            : {
                "circle-radius": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  ["*", circleRadius || 1, 1.5],
                  ["boolean", ["feature-state", "hovered"], false],
                  ["*", circleRadius || 1, 1.25],
                  circleRadius || 1,
                ],
              }),
          ...(circleStrokeOpacity
            ? {
                "circle-stroke-opacity": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  1,
                  ["boolean", ["feature-state", "hovered"], false],
                  1,
                  circleStrokeOpacity,
                ],
              }
            : {}),
        };
        newLayers.push(layer);
      }
    }
  } else if (markerLayers.length > 0) {
    return layers;
    // Can't really do anything useful here since we can't alter layout
    // properties. :(
  } else if (labelLayers.length > 0) {
    // Increase the size of the halo. Can't do much else because feature-state
    // can only change paint properties, not layout properties.
    for (const l of layers) {
      if (l.type !== "symbol" || !("text-field" in (l.layout || {}))) {
        newLayers.push(l);
        continue;
      }
      const layer = cloneDeep(l);
      if (layer.layout) {
        const textHaloWidth = (layer.paint || { "text-halo-width": 0 })[
          "text-halo-width"
        ];
        layer.paint = {
          ...layer.paint,
          "text-halo-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            ["*", textHaloWidth || 1, 2],
            ["boolean", ["feature-state", "hovered"], false],
            ["*", textHaloWidth || 1, 1.5],
            textHaloWidth || 0,
          ],
        };
      }
      newLayers.push(layer);
    }
  } else {
    return layers;
  }
  return newLayers;
}

/**
 * Determines if the given layer uses feature-state expressions to highlight
 * hovered or selected features.
 *
 * @param layer
 * @returns
 */
function hasFeatureStateExpression(layer: HighlightableLayer): boolean {
  for (const value of [
    ...Object.values(layer.paint || {}),
    Object.values(layer.layout || {}),
  ]) {
    if (isExpression(value)) {
      if (usesFeatureState(value, ["hovered", "selected"])) {
        return true;
      }
    }
  }
  return false;
}

function usesFeatureState(expression: Expression, states: string[]): boolean {
  if (expression[0] === "feature-state") {
    return states.includes(expression[1]);
  }
  for (const arg of expression.slice(1)) {
    if (isExpression(arg)) {
      if (usesFeatureState(arg, states)) {
        return true;
      }
    }
  }
  return false;
}
