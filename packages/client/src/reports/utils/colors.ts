import { GeostatsAttribute } from "@seasketch/geostats-types";
import { AnyLayer } from "mapbox-gl";

const paintPropertiesByPriority = ["fill-color", "circle-color", "line-color"];

export function extractColorsForCategories(
  values: string[],
  categoryField: GeostatsAttribute,
  style: AnyLayer[]
): { [category: string]: string } {
  const colors: { [category: string]: string } = {};
  const attribute = categoryField.attribute;
  // Find a get expression for this attribute within the layers, proceeding
  // through a prioritized list of paint properties
  for (const paintProp of paintPropertiesByPriority) {
    for (const layer of style) {
      if (
        layer.type === "fill" ||
        layer.type === "circle" ||
        layer.type === "line"
      ) {
        if (
          layer.paint &&
          paintProp in layer.paint &&
          Array.isArray((layer.paint as any)[paintProp])
        ) {
          const expression = (layer.paint as any)[paintProp];
          if (expression[0] === "match") {
            let [fname, getExpr, ...cases] = expression;
            cases = cases.slice(0, -1);
            const defaultColor = expression.slice(-1)[0];
            // First, populate colors with the default color
            if (defaultColor) {
              for (const value of values) {
                colors[value] = defaultColor;
              }
            }
            if (getExpr[1] === attribute) {
              for (let i = 0; i < cases.length; i += 2) {
                const caseValue = cases[i];
                const colorValue = cases[i + 1];
                if (values.includes(caseValue)) {
                  colors[caseValue] = colorValue;
                }
              }
            }
          }
        }
      }
    }
  }
  return colors;
}

export function extractColorForLayers(style: AnyLayer[]): string {
  for (const layer of style) {
    if (
      layer.type === "fill" ||
      layer.type === "circle" ||
      layer.type === "line"
    ) {
      if (
        layer.paint &&
        "fill-color" in layer.paint &&
        typeof layer.paint["fill-color"] === "string"
      ) {
        return layer.paint["fill-color"];
      }
      if (
        layer.paint &&
        "circle-color" in layer.paint &&
        typeof layer.paint["circle-color"] === "string"
      ) {
        return layer.paint["circle-color"];
      }
      if (
        layer.paint &&
        "line-color" in layer.paint &&
        typeof layer.paint["line-color"] === "string"
      ) {
        return layer.paint["line-color"];
      }
    }
  }
  return "#00000000";
}
