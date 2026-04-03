type GeostatsLike = {
  layer?: string;
  count?: number;
  geometry?: string;
  hasZ?: boolean;
  attributeCount?: number;
  attributes?: Array<Record<string, unknown>>;
  bounds?: number[];
  metadata?: Record<string, unknown>;
};

type RasterLike = {
  bands?: Array<Record<string, unknown>>;
  presentation?: unknown;
  representativeColorsForRGB?: unknown[];
  metadata?: Record<string, unknown>;
  byteEncoding?: boolean;
};

const RASTER_PRESENTATION_ENUM_MAP: Record<
  number,
  "categorical" | "continuous" | "rgb"
> = {
  0: "categorical",
  1: "continuous",
  2: "rgb",
};

/** Max entries kept in each non-numeric attribute's `values` map for LLM context. */
const MAX_ATTRIBUTE_VALUE_KEYS = 64;
/** Max entries for numeric attributes when cardinality is below {@link HIGH_CARDINALITY_NUMERIC_THRESHOLD}. */
const MAX_NUMERIC_ATTRIBUTE_VALUE_KEYS = 8;
/** At or above this distinct count, numeric `values` are omitted entirely (use min/max/stats). */
const HIGH_CARDINALITY_NUMERIC_THRESHOLD = 64;
const MAX_BREAK_SETS = 3;
const MAX_BANDS = 4;
const MAX_CATEGORIES = 16;
const MAX_REPRESENTATIVE_COLORS = 8;
const MAX_METADATA_ENTRIES = 12;
const MAX_METADATA_VALUE_LENGTH = 200;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sampleArray<T>(arr: T[], maxItems: number): T[] {
  if (arr.length <= maxItems) {
    return arr;
  }
  if (maxItems <= 1) {
    return [arr[0]];
  }
  const result: T[] = [];
  const last = arr.length - 1;
  for (let i = 0; i < maxItems; i++) {
    const idx = Math.round((i * last) / (maxItems - 1));
    result.push(arr[idx]);
  }
  return result;
}

function trimMetadata(
  metadata: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!isObject(metadata)) {
    return undefined;
  }
  const entries = Object.entries(metadata).slice(0, MAX_METADATA_ENTRIES);
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of entries) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] =
        typeof value === "string"
          ? value.slice(0, MAX_METADATA_VALUE_LENGTH)
          : value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Keeps `values` as a string→count map; limits how many keys are kept (by frequency).
 * Numeric columns use a smaller cap (and drop `values` entirely when cardinality is very high).
 */
function trimValues(
  values: unknown,
  attributeType: unknown,
  countDistinct: unknown,
): {
  values: Record<string, number>;
  valuesTruncated: boolean;
} {
  if (!isObject(values)) {
    return { values: {}, valuesTruncated: false };
  }
  const entries = Object.entries(values).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  entries.sort((a, b) => b[1] - a[1]);

  const distinctCount =
    typeof countDistinct === "number" && Number.isFinite(countDistinct)
      ? countDistinct
      : entries.length;

  let maxKeys: number;
  if (attributeType === "number") {
    maxKeys =
      distinctCount >= HIGH_CARDINALITY_NUMERIC_THRESHOLD
        ? 0
        : MAX_NUMERIC_ATTRIBUTE_VALUE_KEYS;
  } else {
    maxKeys = MAX_ATTRIBUTE_VALUE_KEYS;
  }

  const truncated = entries.length > maxKeys;
  return {
    values: Object.fromEntries(entries.slice(0, maxKeys)),
    valuesTruncated: truncated,
  };
}

function naturalBreakBucketCounts(
  breaks: unknown,
): Record<string, number> | undefined {
  if (!isObject(breaks)) {
    return undefined;
  }
  const breakEntries = Object.entries(breaks).slice(0, MAX_BREAK_SETS);
  const output: Record<string, number> = {};
  for (const [numBreaks, buckets] of breakEntries) {
    if (!Array.isArray(buckets)) {
      continue;
    }
    const validBuckets = buckets.filter(
      (bucket): bucket is [number, number | null] =>
        Array.isArray(bucket) &&
        bucket.length === 2 &&
        typeof bucket[0] === "number" &&
        (typeof bucket[1] === "number" || bucket[1] === null),
    );
    if (validBuckets.length > 0) {
      output[numBreaks] = validBuckets.length;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

/**
 * Attributes with piiRisk at or above this threshold have their values
 * stripped from the LLM payload and replaced with a piiRedacted marker.
 * The threshold can be lowered (e.g. 0.4) for more conservative deployments.
 */
export const PII_REDACTION_THRESHOLD = 0.35;

function pruneGeostatsAttribute(attr: unknown): Record<string, unknown> {
  if (!isObject(attr)) {
    return {};
  }

  // PII-aware: if the geostats-pii-risk-classifier has scored this column
  // above the threshold, strip values and send a piiRedacted marker to the LLM
  // instead.  The raw data (with piiRisk scores) is already persisted in the DB.
  const piiRisk = typeof attr.piiRisk === "number" ? attr.piiRisk : undefined;
  if (piiRisk !== undefined && piiRisk >= PII_REDACTION_THRESHOLD) {
    const categories = Array.isArray(attr.piiRiskCategories)
      ? (attr.piiRiskCategories as string[])
      : [];
    console.log("!! Redacting column due to PII risk", attr.attribute, piiRisk);
    console.log("!! Categories", categories);
    return {
      attribute: attr.attribute,
      type: attr.type,
      count: attr.count,
      countDistinct: attr.countDistinct,
      piiRedacted: true,
      redactionReason: categories[0] ?? "other",
    };
  }

  const trimmed = trimValues(attr.values, attr.type, attr.countDistinct);
  const out: Record<string, unknown> = {
    attribute: attr.attribute,
    type: attr.type,
    count: attr.count,
    countDistinct: attr.countDistinct,
    min: attr.min,
    max: attr.max,
    typeArrayOf: attr.typeArrayOf,
    values: trimmed.values,
  };
  if (trimmed.valuesTruncated) {
    out.valuesTruncated = true;
  }

  if (isObject(attr.stats)) {
    const stats = attr.stats;
    const compactStats = {
      avg: stats.avg,
      naturalBreakBucketCounts: naturalBreakBucketCounts(stats.naturalBreaks),
    };

    if (
      compactStats.avg !== undefined ||
      compactStats.naturalBreakBucketCounts !== undefined
    ) {
      out.stats = compactStats;
    }
  }

  return out;
}

function pruneGeostatsLayer(geostats: GeostatsLike): Record<string, unknown> {
  return {
    layer: geostats.layer,
    count: geostats.count,
    geometry: geostats.geometry,
    hasZ: geostats.hasZ,
    attributeCount: geostats.attributeCount,
    bounds: Array.isArray(geostats.bounds)
      ? sampleArray(geostats.bounds, 6)
      : undefined,
    metadata: trimMetadata(geostats.metadata),
    attributes: Array.isArray(geostats.attributes)
      ? geostats.attributes.map(pruneGeostatsAttribute)
      : [],
  };
}

function pruneRasterBand(band: unknown): Record<string, unknown> {
  if (!isObject(band)) {
    return {};
  }
  const out: Record<string, unknown> = {
    name: band.name,
    colorInterpretation: band.colorInterpretation,
    count: band.count,
    minimum: band.minimum,
    maximum: band.maximum,
    interval: band.interval,
    noDataValue: band.noDataValue,
    scale: band.scale,
    offset: band.offset,
    bounds: Array.isArray(band.bounds)
      ? sampleArray(band.bounds, 6)
      : undefined,
    metadata: trimMetadata(band.metadata),
    colorTable: Array.isArray(band.colorTable)
      ? sampleArray(band.colorTable, MAX_CATEGORIES)
      : undefined,
  };

  if (isObject(band.stats)) {
    const stats = band.stats;
    out.stats = {
      mean: stats.mean,
      stdev: stats.stdev,
      categories: Array.isArray(stats.categories)
        ? sampleArray(stats.categories, MAX_CATEGORIES)
        : undefined,
      naturalBreakBucketCounts: naturalBreakBucketCounts(stats.naturalBreaks),
    };
  }
  return out;
}

function isRasterLike(geostats: unknown): geostats is RasterLike {
  return isObject(geostats) && Array.isArray((geostats as RasterLike).bands);
}

function normalizeRasterPresentation(
  presentation: unknown,
): "categorical" | "continuous" | "rgb" | unknown {
  if (
    typeof presentation === "number" &&
    presentation in RASTER_PRESENTATION_ENUM_MAP
  ) {
    return RASTER_PRESENTATION_ENUM_MAP[presentation];
  }
  return presentation;
}

/**
 * Reduce geostats payload size while preserving fields needed for
 * column-intelligence decisions.
 */
export function pruneGeostats(
  geostats: GeostatsLike | RasterLike | unknown,
): Record<string, unknown> | unknown {
  if (isRasterLike(geostats)) {
    return {
      presentation: normalizeRasterPresentation(geostats.presentation),
      byteEncoding: geostats.byteEncoding,
      metadata: trimMetadata(geostats.metadata),
      representativeColorsForRGB: Array.isArray(
        geostats.representativeColorsForRGB,
      )
        ? sampleArray(
            geostats.representativeColorsForRGB,
            MAX_REPRESENTATIVE_COLORS,
          )
        : undefined,
      bands: (geostats.bands ?? []).slice(0, MAX_BANDS).map(pruneRasterBand),
    };
  }

  if (
    isObject(geostats) &&
    Array.isArray((geostats as GeostatsLike).attributes)
  ) {
    return pruneGeostatsLayer(geostats as GeostatsLike);
  }

  console.error(
    "invalid geostats layer shape",
    Object.keys(geostats as Record<string, unknown>),
  );
  throw new Error("Invalid geostats type");
}
