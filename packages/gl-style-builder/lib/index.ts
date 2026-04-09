import { AnyLayer, Expression } from "mapbox-gl";

export { buildGlStyle, type BuildGlStyleInput } from "./buildGlStyle";
export { effectiveReverseNamedPalette } from "ai-data-analyst";

/**
 * Attempts to find a group by column name from a set of Mapbox GL style layers.
 * Useful for determining if the map layer presented to users is categorical,
 * indicating a feature class breakdown that may be useful for reporting.
 * @param mapboxGlStyles
 * @param geometryType
 * @param columnNames
 * @returns
 */
export function groupByFromStyle(
  mapboxGlStyles: AnyLayer[] | null | undefined,
  geometryType: string,
  columnNames: Set<string>,
): string | undefined {
  if (!mapboxGlStyles?.length) {
    return undefined;
  }

  const paintProps =
    geometryType === "Polygon" || geometryType === "MultiPolygon"
      ? ["fill-color"]
      : geometryType === "LineString" || geometryType === "MultiLineString"
        ? ["line-color"]
        : ["circle-color", "icon-image"];

  for (const layer of mapboxGlStyles) {
    if (!("paint" in layer)) continue;
    const paint = (layer as { paint?: Record<string, any> }).paint;
    if (!paint) continue;
    for (const prop of paintProps) {
      const value = paint[prop];
      if (!value || !isExpression(value)) continue;
      // skip interpolate expressions. we want categorical styles only
      if (/interpolate/.test(value[0])) continue;
      // same for step expressions
      if (/step/.test(value[0])) continue;

      const getExpr = findGetExpression(value);
      if (
        getExpr?.property &&
        (!columnNames.size || columnNames.has(getExpr.property))
      ) {
        return getExpr.property;
      }
    }
  }

  return undefined;
}

export function isExpression(e: any): e is Expression {
  return Array.isArray(e) && typeof e[0] === "string";
}

export function findGetExpression(
  expression: any,
  isFilter?: boolean,
  parent?: Expression,
): null | { type: "legacy" | "get"; property: string } {
  if (!isExpression(expression)) {
    return null;
  }
  if (expression[0] === "get") {
    return { type: "get", property: expression[1] };
  } else {
    if (isFilter) {
      // check for legacy filter type
      if (
        typeof expression[1] === "string" &&
        !/\$/.test(expression[1]) &&
        expression[1] !== "zoom"
      ) {
        return {
          type: "legacy",
          property: expression[1],
        };
      }
    }
  }

  for (const arg of expression.slice(1)) {
    if (isExpression(arg)) {
      const found = findGetExpression(arg, isFilter, expression);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}
