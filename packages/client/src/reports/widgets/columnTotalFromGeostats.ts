import {
  GeostatsLayer,
  isGeostatsLayer,
  isNumericGeostatsAttribute,
} from "@seasketch/geostats-types";

/**
 * Columns whose names suggest a whole-feature quantity (population, households,
 * etc.) rather than a continuous score. Preferred as the default for
 * "% of Column Total".
 */
const TOTAL_LIKE_COLUMN_RE =
  /pop|popul|people|inhab|hh|household|dwelling|housing|resident|count|total|sum|popula/i;

function geostatsLayerFromUnknown(geostats: unknown): GeostatsLayer | undefined {
  if (!geostats || typeof geostats !== "object") {
    return undefined;
  }
  const layers = (geostats as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || !layers[0]) {
    return undefined;
  }
  const layer = layers[0];
  return isGeostatsLayer(layer) ? layer : undefined;
}

/**
 * Full-dataset feature count from geostats (`layers[0].count`).
 */
export function getFeatureCountFromGeostats(geostats: unknown): number | null {
  const layer = geostatsLayerFromUnknown(geostats);
  if (!layer) {
    return null;
  }
  const count = layer.count;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return count;
}

/**
 * Full-dataset sum of a numeric column from geostats: avg × count.
 * Geostats stores avg as sum/count at upload time, so this recovers the
 * layer-wide total without a geography-scoped metric.
 */
export function getColumnTotalFromGeostats(
  geostats: unknown,
  column: string
): number | null {
  if (!column) {
    return null;
  }
  const layer = geostatsLayerFromUnknown(geostats);
  if (!layer?.attributes?.length) {
    return null;
  }
  const attr = layer.attributes.find((a) => a.attribute === column);
  if (!attr || !isNumericGeostatsAttribute(attr)) {
    return null;
  }
  const avg = attr.stats?.avg;
  const count = attr.count;
  if (typeof avg !== "number" || !Number.isFinite(avg)) {
    return null;
  }
  if (typeof count !== "number" || count <= 0 || !Number.isFinite(count)) {
    return null;
  }
  const total = avg * count;
  return Number.isFinite(total) ? total : null;
}

/**
 * Numeric attribute names that have a recoverable full-dataset total in
 * geostats (finite avg and positive count).
 */
export function listColumnsWithGeostatsTotals(geostats: unknown): string[] {
  const layer = geostatsLayerFromUnknown(geostats);
  if (!layer?.attributes?.length) {
    return [];
  }
  const columns: string[] = [];
  for (const attr of layer.attributes) {
    if (!isNumericGeostatsAttribute(attr)) {
      continue;
    }
    if (getColumnTotalFromGeostats(geostats, attr.attribute) !== null) {
      columns.push(attr.attribute);
    }
  }
  return columns;
}

/**
 * Choose a default column for "% of Column Total".
 * Prefers total-like names (Population, etc.) among columns with a geostats
 * total; falls back to `preferred` (e.g. bestContinuousColumn) when it has a
 * total, otherwise the first column with a total.
 */
export function pickBestColumnForPercentOfColumnTotal(options: {
  geostats?: unknown;
  preferred?: string | null;
}): string | undefined {
  const { geostats, preferred } = options;
  const withTotals = listColumnsWithGeostatsTotals(geostats);

  if (withTotals.length > 0) {
    const totalLike = withTotals.find((name) => TOTAL_LIKE_COLUMN_RE.test(name));
    if (totalLike) {
      return totalLike;
    }
    if (preferred && withTotals.includes(preferred)) {
      return preferred;
    }
    return withTotals[0];
  }

  // Slash-command list sources omit geostats; bestContinuousColumn is still a
  // reliable signal that a numeric column exists (and thus has avg×count).
  if (preferred) {
    return preferred;
  }
  return undefined;
}
