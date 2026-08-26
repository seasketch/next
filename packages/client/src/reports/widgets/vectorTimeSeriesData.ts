import {
  ColumnValuesMetric,
  CountMetric,
  MetricDependency,
  NumberColumnValueStats,
  OverlayAreaMetric,
  OverlayAreaMetricValue,
  getOverlayAreaClassTotals,
  getOverlayAreaDisplayedClassValue,
} from "overlay-engine";
import {
  applyBufferSettingsToParameters,
  BufferSettings,
} from "./BufferSelector";
import { TimeSeriesDatum } from "./charts/TimeSeriesChart";
import { TemporalCoverage } from "./temporalChart";
import { VectorTimeSeriesMode } from "./vectorTimeSeriesSettings";

export type VectorTimeSeriesOverlappingMap = {
  [stableId: string]: boolean | undefined;
};

/**
 * Builds the MetricDependency fan-out for a set of vector layers.
 * Shared by the slash command and tooltip so mode, column, and layer
 * changes always produce consistent dependencies.
 *
 * Points never emit overlay_area. Column modes require a column name;
 * without one the builder returns no column_values deps.
 */
export function buildVectorTimeSeriesDependencies(args: {
  stableIds: string[];
  mode: VectorTimeSeriesMode;
  column?: string;
  bufferSettings?: BufferSettings;
  overlappingByStableId?: VectorTimeSeriesOverlappingMap;
}): MetricDependency[] {
  const { stableIds, mode, column, bufferSettings, overlappingByStableId } =
    args;
  if (mode === "stats" || mode === "sum_proportion") {
    if (!column) {
      return [];
    }
  }
  const deps: MetricDependency[] = [];
  for (const stableId of stableIds) {
    if (mode === "count") {
      deps.push(
        { type: "count", subjectType: "fragments", stableId },
        { type: "count", subjectType: "geographies", stableId }
      );
      continue;
    }
    if (mode === "geometry") {
      const overlapping = overlappingByStableId?.[stableId] === true;
      const parameters = overlapping
        ? { sourceHasOverlappingFeatures: true }
        : undefined;
      deps.push(
        {
          type: "overlay_area",
          subjectType: "fragments",
          stableId,
          ...(parameters ? { parameters } : {}),
        },
        {
          type: "overlay_area",
          subjectType: "geographies",
          stableId,
          ...(parameters ? { parameters } : {}),
        }
      );
      continue;
    }
    const includedColumns = [column as string];
    deps.push({
      type: "column_values",
      subjectType: "fragments",
      stableId,
      parameters: { includedColumns },
    });
    if (mode === "sum_proportion") {
      deps.push({
        type: "column_values",
        subjectType: "geographies",
        stableId,
        parameters: { includedColumns },
      });
    }
  }
  if (!bufferSettings) {
    return deps;
  }
  return deps.map((dep) => ({
    ...dep,
    parameters: applyBufferSettingsToParameters(dep, bufferSettings),
  }));
}

export function overlappingFlagsFromDependencies(
  deps: MetricDependency[]
): VectorTimeSeriesOverlappingMap {
  const flags: VectorTimeSeriesOverlappingMap = {};
  for (const dep of deps) {
    if (dep.stableId && dep.parameters?.sourceHasOverlappingFeatures === true) {
      flags[dep.stableId] = true;
    }
  }
  return flags;
}

export function expectedVectorTimeSeriesMetricType(
  mode: VectorTimeSeriesMode
): "count" | "overlay_area" | "column_values" {
  if (mode === "count") return "count";
  if (mode === "geometry") return "overlay_area";
  return "column_values";
}

export function countAtStar(
  value: CountMetric["value"] | null | undefined
): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value["*"];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const count = entry.count;
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return null;
  }
  return count;
}

/** Layer-level overlay total. Uses "*" when present; otherwise sums classes. */
export function totalOverlayMeasure(
  value: OverlayAreaMetricValue | null | undefined
): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const totals = getOverlayAreaClassTotals(value);
  if ("*" in totals) {
    const displayed = getOverlayAreaDisplayedClassValue(value, "*");
    return Number.isFinite(displayed) ? displayed : null;
  }
  const keys = Object.keys(totals);
  if (keys.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const key of keys) {
    const displayed = getOverlayAreaDisplayedClassValue(value, key);
    if (Number.isFinite(displayed)) {
      sum += displayed;
    }
  }
  return sum;
}

export function isPlottableNumberColumnStats(
  stats: unknown
): stats is NumberColumnValueStats {
  if (stats == null || typeof stats !== "object") {
    return false;
  }
  if (!("type" in stats) || stats.type !== "number") {
    return false;
  }
  if (
    !("min" in stats) ||
    !("max" in stats) ||
    !("mean" in stats) ||
    !("sum" in stats)
  ) {
    return false;
  }
  return (
    typeof stats.min === "number" &&
    Number.isFinite(stats.min) &&
    typeof stats.max === "number" &&
    Number.isFinite(stats.max) &&
    typeof stats.mean === "number" &&
    Number.isFinite(stats.mean) &&
    typeof stats.sum === "number" &&
    Number.isFinite(stats.sum)
  );
}

export function numberColumnStatsAt(
  value: ColumnValuesMetric["value"] | null | undefined,
  column: string
): NumberColumnValueStats | null {
  if (!column || !value || typeof value !== "object") {
    return null;
  }
  const group = value["*"];
  if (!group || typeof group !== "object") {
    return null;
  }
  const stats = group[column];
  return isPlottableNumberColumnStats(stats) ? stats : null;
}

export type VectorTimeSeriesSample = {
  stableId: string;
  title: string;
  coverage: TemporalCoverage | null;
  count: number | null;
  geographyCount: number | null;
  geometry: number | null;
  geographyGeometry: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  sum: number | null;
  geographySum: number | null;
  fraction: number | null;
  columnStats: NumberColumnValueStats | null;
};

function fractionOf(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }
  return numerator / denominator;
}

export function extractVectorTimeSeriesSample(args: {
  stableId: string;
  title: string;
  coverage: TemporalCoverage | null;
  mode: VectorTimeSeriesMode;
  column?: string;
  fragments: unknown;
  geographies: unknown;
}): VectorTimeSeriesSample {
  const { stableId, title, coverage, mode, column, fragments, geographies } =
    args;
  const sample: VectorTimeSeriesSample = {
    stableId,
    title,
    coverage,
    count: null,
    geographyCount: null,
    geometry: null,
    geographyGeometry: null,
    min: null,
    max: null,
    mean: null,
    sum: null,
    geographySum: null,
    fraction: null,
    columnStats: null,
  };
  if (mode === "count") {
    sample.count = countAtStar((fragments as CountMetric | undefined)?.value);
    sample.geographyCount = countAtStar(
      (geographies as CountMetric | undefined)?.value
    );
    sample.fraction = fractionOf(sample.count, sample.geographyCount);
    return sample;
  }
  if (mode === "geometry") {
    sample.geometry = totalOverlayMeasure(
      (fragments as OverlayAreaMetric | undefined)?.value
    );
    sample.geographyGeometry = totalOverlayMeasure(
      (geographies as OverlayAreaMetric | undefined)?.value
    );
    sample.fraction = fractionOf(sample.geometry, sample.geographyGeometry);
    return sample;
  }
  const fragmentStats = numberColumnStatsAt(
    (fragments as ColumnValuesMetric | undefined)?.value,
    column || ""
  );
  sample.columnStats = fragmentStats;
  if (fragmentStats) {
    sample.min = fragmentStats.min;
    sample.max = fragmentStats.max;
    sample.mean = fragmentStats.mean;
    sample.sum = fragmentStats.sum;
  }
  if (mode === "sum_proportion") {
    const geographyStats = numberColumnStatsAt(
      (geographies as ColumnValuesMetric | undefined)?.value,
      column || ""
    );
    sample.geographySum = geographyStats?.sum ?? null;
    sample.fraction = fractionOf(sample.sum, sample.geographySum);
  }
  return sample;
}

export function samplesToChartData(args: {
  samples: VectorTimeSeriesSample[];
  mode: VectorTimeSeriesMode;
  formatAbsolute: (value: number) => string;
  formatEnvelope: (value: number) => string;
  formatPercent: (value: number) => string;
}): {
  absoluteData: TimeSeriesDatum[];
  percentData: TimeSeriesDatum[];
  missingTemporal: string[];
  missingColumn: string[];
  percentUnavailable: boolean;
} {
  const { samples, mode, formatAbsolute, formatEnvelope, formatPercent } = args;
  const absoluteData: TimeSeriesDatum[] = [];
  const percentData: TimeSeriesDatum[] = [];
  const missingTemporal: string[] = [];
  const missingColumn: string[] = [];
  let percentUnavailable = false;

  for (const sample of samples) {
    if (!sample.coverage) {
      missingTemporal.push(sample.title);
      continue;
    }
    const base = {
      x: sample.coverage.start,
      xEnd: sample.coverage.end,
      span: sample.coverage.span,
      formattedX: sample.coverage.label,
    };
    if (mode === "count") {
      if (sample.count === null) continue;
      absoluteData.push({
        ...base,
        value: sample.count,
        formattedValue: formatAbsolute(sample.count),
      });
      if (sample.fraction === null) {
        percentUnavailable = true;
      } else {
        percentData.push({
          ...base,
          value: sample.fraction,
          formattedValue: formatPercent(sample.fraction),
        });
      }
      continue;
    }
    if (mode === "geometry") {
      if (sample.geometry === null) continue;
      absoluteData.push({
        ...base,
        value: sample.geometry,
        formattedValue: formatAbsolute(sample.geometry),
      });
      if (sample.fraction === null) {
        percentUnavailable = true;
      } else {
        percentData.push({
          ...base,
          value: sample.fraction,
          formattedValue: formatPercent(sample.fraction),
        });
      }
      continue;
    }
    if (mode === "stats") {
      if (!sample.columnStats) {
        missingColumn.push(sample.title);
        continue;
      }
      absoluteData.push({
        ...base,
        value: sample.mean as number,
        min: sample.min as number,
        max: sample.max as number,
        formattedValue: formatEnvelope(sample.mean as number),
        formattedMin: formatEnvelope(sample.min as number),
        formattedMax: formatEnvelope(sample.max as number),
      });
      continue;
    }
    if (sample.sum === null) {
      missingColumn.push(sample.title);
      continue;
    }
    absoluteData.push({
      ...base,
      value: sample.sum,
      formattedValue: formatAbsolute(sample.sum),
    });
    if (sample.fraction === null) {
      percentUnavailable = true;
    } else {
      percentData.push({
        ...base,
        value: sample.fraction,
        formattedValue: formatPercent(sample.fraction),
      });
    }
  }

  return {
    absoluteData,
    percentData,
    missingTemporal,
    missingColumn,
    percentUnavailable,
  };
}
