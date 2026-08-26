import {
  isGeostatsLayer,
  isNumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import { AreaUnit, isAreaUnit, isLengthUnit, LengthUnit } from "../utils/units";
import {
  RasterTimeSeriesPresentation,
  getRasterTimeSeriesPresentation,
} from "./rasterTimeSeriesSettings";
import { VectorGeometryFamily, vectorGeometryFamily } from "./temporalChart";

export type VectorTimeSeriesMode =
  | "count"
  | "geometry"
  | "stats"
  | "sum_proportion";

export type VectorTimeSeriesSettings = {
  mode?: VectorTimeSeriesMode;
  /** Numeric column for stats and sum_proportion. */
  column?: string;
  presentation?: RasterTimeSeriesPresentation;
  defaultPresentation?: "absolute" | "percent";
  geographyId?: number | "auto";
  /** Geometry-mode display unit. Metrics stay in km / km². */
  unit?: AreaUnit | LengthUnit;
  valueLabel?: string;
  absoluteLabel?: string;
  percentLabel?: string;
  minimumFractionDigits?: number;
  /** Stats mode only. "domain" uses the column's geostats range. */
  yScale?: "domain" | "results";
  xTickDensity?: "less" | "auto" | "more";
};

export function defaultVectorTimeSeriesMode(
  geometryType: string | null | undefined
): VectorTimeSeriesMode {
  return vectorGeometryFamily(geometryType) === "point" ? "count" : "geometry";
}

export function getVectorTimeSeriesMode(
  settings: Pick<VectorTimeSeriesSettings, "mode">,
  family: VectorGeometryFamily | null
): VectorTimeSeriesMode {
  const mode = settings.mode;
  if (mode === "geometry" && family === "point") {
    return "count";
  }
  if (
    mode === "count" ||
    mode === "geometry" ||
    mode === "stats" ||
    mode === "sum_proportion"
  ) {
    return mode;
  }
  return family === "point" ? "count" : "geometry";
}

export function vectorTimeSeriesSupportsPercent(
  mode: VectorTimeSeriesMode
): boolean {
  return mode !== "stats";
}

const SHORT_AREA_UNITS: Record<string, AreaUnit> = {
  km: "kilometer",
  mi: "mile",
  acres: "acre",
  ha: "hectare",
};

const SHORT_LENGTH_UNITS: Record<string, LengthUnit> = {
  km: "kilometer",
  mi: "mile",
  m: "meter",
  ft: "foot",
  nm: "nautical-mile",
};

export function getVectorTimeSeriesUnit(
  settings: Pick<VectorTimeSeriesSettings, "unit">,
  family: VectorGeometryFamily | null
): AreaUnit | LengthUnit {
  const unit = settings.unit;
  if (family === "line") {
    if (typeof unit === "string") {
      if (isLengthUnit(unit)) return unit;
      return SHORT_LENGTH_UNITS[unit] ?? "kilometer";
    }
    return "kilometer";
  }
  if (typeof unit === "string") {
    if (isAreaUnit(unit)) return unit;
    return SHORT_AREA_UNITS[unit] ?? "kilometer";
  }
  return "kilometer";
}

function geostatsLayerFromUnknown(geostats: unknown) {
  if (!geostats || typeof geostats !== "object") {
    return undefined;
  }
  if (isGeostatsLayer(geostats)) {
    return geostats;
  }
  const layers = (geostats as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || !layers[0] || !isGeostatsLayer(layers[0])) {
    return undefined;
  }
  return layers[0];
}

/** Numeric attribute names from geostats. Empty for junk / missing input. */
export function numericColumnsFromGeostats(geostats: unknown): string[] {
  const layer = geostatsLayerFromUnknown(geostats);
  if (!layer?.attributes?.length) {
    return [];
  }
  const columns: string[] = [];
  for (const attr of layer.attributes) {
    if (!isNumericGeostatsAttribute(attr) && attr.type !== "number") {
      continue;
    }
    if (typeof attr.attribute === "string" && attr.attribute.length > 0) {
      columns.push(attr.attribute);
    }
  }
  return columns.sort((a, b) => a.localeCompare(b));
}

/**
 * Intersection of numeric columns across sources that already have geostats.
 * Sources without geostats are ignored so a still-loading sibling does not
 * hide the column picker.
 */
export function intersectNumericColumns(
  sources: Array<{ geostats?: unknown }>
): string[] {
  let intersection: Set<string> | null = null;
  for (const source of sources) {
    const columns = numericColumnsFromGeostats(source.geostats);
    if (columns.length === 0 && !source.geostats) {
      continue;
    }
    const next = new Set(columns);
    if (intersection === null) {
      intersection = next;
      continue;
    }
    for (const name of intersection) {
      if (!next.has(name)) {
        intersection.delete(name);
      }
    }
  }
  return intersection ? Array.from(intersection).sort() : [];
}

export function defaultNumericColumn(
  columns: string[],
  preferred?: string | null
): string | undefined {
  if (preferred && columns.includes(preferred)) {
    return preferred;
  }
  return columns[0];
}

export function unionColumnValueDomain(
  sources: Array<{ geostats?: unknown }>,
  column: string
): [number, number] | null {
  if (!column) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const source of sources) {
    const layer = geostatsLayerFromUnknown(source.geostats);
    const attr = layer?.attributes?.find((a) => a.attribute === column);
    if (!attr) continue;
    const min = attr.min;
    const max = attr.max;
    if (typeof min !== "number" || typeof max !== "number") continue;
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    lo = Math.min(lo, min);
    hi = Math.max(hi, max);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return [lo, hi];
}

export function pickerGeometryTypesForFamily(
  family: VectorGeometryFamily | null
): Array<
  | "Polygon"
  | "MultiPolygon"
  | "LineString"
  | "MultiLineString"
  | "Point"
  | "MultiPoint"
> {
  switch (family) {
    case "polygon":
      return ["Polygon", "MultiPolygon"];
    case "line":
      return ["LineString", "MultiLineString"];
    case "point":
      return ["Point", "MultiPoint"];
    default:
      return [
        "Polygon",
        "MultiPolygon",
        "LineString",
        "MultiLineString",
        "Point",
        "MultiPoint",
      ];
  }
}

export { getRasterTimeSeriesPresentation };
