import { GeostatsAttribute } from "@seasketch/geostats-types";
import { AnyLayer } from "mapbox-gl";

const paintPropertiesByPriority = ["fill-color", "circle-color", "line-color"];

/**
 * True if the color string is considered transparent (keyword, rgba(,,,0), or hex with alpha 0).
 */
export function isTransparentColor(c: string): boolean {
  const s = c.trim().toLowerCase();
  if (s === "transparent") return true;
  if (s.startsWith("rgba(") && s.endsWith(")")) {
    const lastComma = s.lastIndexOf(",");
    if (lastComma !== -1) {
      const alpha = s.slice(lastComma + 1, s.length - 1).trim();
      if (alpha === "0" || alpha === "0.0" || /^0\.0+$/.test(alpha)) return true;
    }
  }
  if (/^#[0-9a-f]{8}$/i.test(s) && s.slice(-2).toLowerCase() === "00")
    return true;
  if (/^#[0-9a-f]{4}$/i.test(s) && s.slice(-1).toLowerCase() === "0")
    return true;
  return false;
}

function pushOpaqueColorStops(
  out: string[],
  expr: unknown[]
): void {
  const pushIfOpaque = (c: unknown) => {
    if (typeof c === "string" && !isTransparentColor(c)) out.push(c);
  };

  if (expr.length < 2) return;
  const fn = expr[0];
  if (typeof fn !== "string") return;

  if (/^interpolate(-hcl|-lab)?$/.test(fn)) {
    for (let i = 4; i < expr.length; i += 2) {
      pushIfOpaque(expr[i]);
    }
  } else if (fn === "step") {
    for (let i = 2; i < expr.length; i += 2) {
      pushIfOpaque(expr[i]);
    }
  } else if (fn === "match") {
    let i = 2;
    while (i < expr.length) {
      if (i === expr.length - 1) {
        pushIfOpaque(expr[i]);
        break;
      }
      pushIfOpaque(expr[i + 1]);
      i += 2;
    }
  }
}

/**
 * Collects opaque color stops from vector paint expressions (fill/circle/line-color)
 * when the style is data-driven (match, step, interpolate). Used to show a multi-color
 * swatch when a single category color cannot be resolved for a table row.
 */
export function extractPaletteColorsFromVectorStyle(
  style: AnyLayer[]
): string[] | undefined {
  const collected: string[] = [];

  for (const layer of style) {
    if (
      layer.type !== "fill" &&
      layer.type !== "circle" &&
      layer.type !== "line"
    ) {
      continue;
    }
    if (!layer.paint) continue;
    for (const paintProp of paintPropertiesByPriority) {
      const raw = (layer.paint as Record<string, unknown>)[paintProp];
      if (!Array.isArray(raw) || raw.length < 2) continue;
      pushOpaqueColorStops(collected, raw);
    }
  }

  const seen = new Set<string>();
  const unique = collected.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
  return unique.length > 0 ? unique : undefined;
}

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
