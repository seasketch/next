type Buckets = Record<string, Array<[number, number | null]>>;

type StatsLike = {
  naturalBreaks?: Buckets;
  quantiles?: Buckets;
  equalInterval?: Buckets;
  histogram?: Array<[number, number | null]>;
};

type RasterBandLike = { stats?: StatsLike };
type RasterInfoLike = { bands?: RasterBandLike[] };

type AttributeLike = { attribute?: string; type?: string; stats?: StatsLike };
type GeostatsLayerLike = { attributes?: AttributeLike[] };

/**
 * Matches Postgres `value_steps` on `ai_data_analyst_notes` (and GraphQL `ValueSteps`).
 * Consumers map these to geostats raster `stats` keys (`naturalBreaks`, etc.).
 */
export type RasterValueSteps =
  | "CONTINUOUS"
  | "EQUAL_INTERVALS"
  | "NATURAL_BREAKS"
  | "QUANTILES";

export type ValueSteps = {
  value_steps: RasterValueSteps;
  value_steps_n?: number;
};

const TARGET_CLASS_COUNT = 8;
const CONTINUOUS_HISTOGRAM_CV_THRESHOLD = 0.45;

function availableClassCounts(buckets?: Buckets): number[] {
  if (!buckets) return [];
  return Object.keys(buckets)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

function closestCountToTarget(counts: number[], target: number): number | undefined {
  if (counts.length === 0) return undefined;
  return counts.reduce((best, c) =>
    Math.abs(c - target) < Math.abs(best - target) ? c : best,
  );
}

function histogramCv(histogram?: Array<[number, number | null]>): number | null {
  if (!histogram || histogram.length < 4) return null;
  const counts = histogram
    .map((b) => b[1])
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  if (counts.length < 4) return null;
  const mean = counts.reduce((acc, v) => acc + v, 0) / counts.length;
  if (mean <= 0) return null;
  const variance =
    counts.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / counts.length;
  return Math.sqrt(variance) / mean;
}

function findStatsForContinuous(geostats: unknown, preferredColumn?: string): StatsLike | undefined {
  const raster = geostats as RasterInfoLike;
  if (Array.isArray(raster?.bands) && raster.bands[0]?.stats) {
    return raster.bands[0].stats;
  }

  const layer = geostats as GeostatsLayerLike;
  if (!Array.isArray(layer?.attributes)) return undefined;

  if (preferredColumn) {
    const match = layer.attributes.find(
      (a) => a.attribute === preferredColumn && a.stats,
    );
    if (match?.stats) return match.stats;
  }

  const firstNumeric = layer.attributes.find(
    (a) => a.type === "number" && a.stats,
  );
  return firstNumeric?.stats;
}

export function deriveValueSteps(
  geostats: unknown,
  preferredColumn?: string,
): ValueSteps {
  const stats = findStatsForContinuous(geostats, preferredColumn);
  if (!stats) return { value_steps: "CONTINUOUS" };

  const naturalCounts = availableClassCounts(stats.naturalBreaks);
  const quantileCounts = availableClassCounts(stats.quantiles);
  const equalCounts = availableClassCounts(stats.equalInterval);
  const cv = histogramCv(stats.histogram);

  if (cv !== null && cv <= CONTINUOUS_HISTOGRAM_CV_THRESHOLD) {
    return { value_steps: "CONTINUOUS" };
  }

  if (naturalCounts.includes(TARGET_CLASS_COUNT)) {
    return {
      value_steps: "NATURAL_BREAKS",
      value_steps_n: TARGET_CLASS_COUNT,
    };
  }

  const preferredMethod: "naturalBreaks" | "quantiles" | "equalInterval" =
    cv === null
      ? "naturalBreaks"
      : cv > 1.1
        ? "naturalBreaks"
        : cv > 0.6
          ? "quantiles"
          : "equalInterval";

  const methods = {
    naturalBreaks: naturalCounts,
    quantiles: quantileCounts,
    equalInterval: equalCounts,
  } as const;

  const toRasterValueSteps = (
    m: "naturalBreaks" | "quantiles" | "equalInterval",
  ): RasterValueSteps =>
    m === "naturalBreaks"
      ? "NATURAL_BREAKS"
      : m === "quantiles"
        ? "QUANTILES"
        : "EQUAL_INTERVALS";

  for (const method of [
    preferredMethod,
    "naturalBreaks",
    "quantiles",
    "equalInterval",
  ] as const) {
    const n = closestCountToTarget(methods[method], TARGET_CLASS_COUNT);
    if (n !== undefined) {
      return { value_steps: toRasterValueSteps(method), value_steps_n: n };
    }
  }

  return { value_steps: "CONTINUOUS" };
}
