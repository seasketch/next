import { AsyncBuffer, FileMetaData, parquetReadObjects } from "hyparquet";
import {
  coverageFromDerivedIntervals,
  DataTableTemporalConfig,
  DataTableTemporalSourceColumns,
  DerivedWhenInterval,
  deriveWhenIntervalFromRow,
  expandTemporalIso,
  formatTemporalIsoFromMs,
  isDataTableTemporalConfig,
  nativeResolutionFromDerived,
  sourceColumnNames,
  TemporalAvailability,
  TemporalPrecision,
} from "../../../geostats-types/lib/temporal";
import {
  columnsFromMetadata,
  rowGroupReadSpans,
} from "./engine/plan";
import { QueryError } from "./params";

export const PREVIEW_SAMPLE_LIMIT = 20;

/** Enough rows for sample cells. Never a full-table decode. */
const PREVIEW_ROW_SCAN = 512;

export type TemporalPreviewSample = {
  raw: Record<string, unknown>;
  parsed: {
    startSec: number;
    endSec: number;
    startIso: string;
    endIso: string;
    precision: TemporalPrecision;
  } | null;
};

export type TemporalPreviewResult = {
  totalRows: number;
  parseableCount: number;
  unparseableCount: number;
  nativeResolution: TemporalPrecision;
  coverage: ReturnType<typeof coverageFromDerivedIntervals>;
  availability: TemporalAvailability | null;
  samples: TemporalPreviewSample[];
};

/** Subset of column-stats.json used to avoid scanning parquet. */
export type TemporalPreviewColumnStats = {
  rowCount?: number;
  columns?: Array<{
    attribute: string;
    count?: number;
    countDistinct?: number;
    values?: Record<string, number>;
  }>;
};

function cellJson(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (value === undefined) return null;
  return value;
}

function rawFromRow(
  row: Record<string, unknown>,
  columns: string[]
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const name of columns) {
    raw[name] = cellJson(row[name]);
  }
  return raw;
}

function intervalKey(interval: DerivedWhenInterval): string {
  return `${interval.startSec}:${interval.endSec}:${interval.precision}`;
}

function addInterval(
  unique: Map<string, { interval: DerivedWhenInterval; count: number }>,
  interval: DerivedWhenInterval,
  count: number
): void {
  const key = intervalKey(interval);
  const existing = unique.get(key);
  if (existing) {
    existing.count += count;
  } else {
    unique.set(key, { interval, count });
  }
}

function coverageIntervalsFromChunkStats(
  metadata: FileMetaData,
  config: DataTableTemporalConfig,
  column: string
): DerivedWhenInterval[] {
  const intervals: DerivedWhenInterval[] = [];
  for (const rowGroup of metadata.row_groups) {
    const stats = chunkStats(rowGroup, column);
    if (!stats) continue;
    if (stats.min_value != null) {
      const parsed = deriveWhenIntervalFromRow(
        { [column]: stats.min_value },
        config.sourceColumns
      );
      if (parsed) intervals.push(parsed);
    }
    if (stats.max_value != null) {
      const parsed = deriveWhenIntervalFromRow(
        { [column]: stats.max_value },
        config.sourceColumns
      );
      if (parsed) intervals.push(parsed);
    }
  }
  return intervals;
}

function resultFromCounts(
  totalRows: number,
  unique: Map<string, { interval: DerivedWhenInterval; count: number }>,
  parseableCount: number,
  config: DataTableTemporalConfig,
  samples: TemporalPreviewSample[],
  extraCoverage: DerivedWhenInterval[] = []
): TemporalPreviewResult {
  const derived = [
    ...[...unique.values()].map((entry) => entry.interval),
    ...extraCoverage,
  ];
  const nativeResolution = nativeResolutionFromDerived(
    config.sourceColumns,
    derived
  );
  const histogramResolution: TemporalPrecision =
    nativeResolution === "hour" ||
    nativeResolution === "minute" ||
    nativeResolution === "second"
      ? "day"
      : nativeResolution;
  return {
    totalRows,
    parseableCount,
    unparseableCount: Math.max(0, totalRows - parseableCount),
    nativeResolution,
    coverage: coverageFromDerivedIntervals(derived),
    availability: availabilityFromIntervalCounts(
      [...unique.values()],
      histogramResolution
    ),
    samples,
  };
}

function histogramColumn(
  source: DataTableTemporalSourceColumns
): string | null {
  if (source.kind === "instant") return source.column;
  if (source.kind === "components" && !source.month && !source.day) {
    return source.year;
  }
  return null;
}

function completeValueCounts(
  stats: TemporalPreviewColumnStats | undefined,
  column: string
): { values: Record<string, number>; rowCount: number } | null {
  if (!stats?.columns) return null;
  const col = stats.columns.find((entry) => entry.attribute === column);
  if (!col?.values) return null;
  const keys = Object.keys(col.values);
  if (keys.length === 0) return null;
  if (
    typeof col.countDistinct === "number" &&
    col.countDistinct > keys.length
  ) {
    return null;
  }
  const rowCount =
    typeof stats.rowCount === "number" ? stats.rowCount : 0;
  return { values: col.values, rowCount };
}

function previewFromValueCounts(
  config: DataTableTemporalConfig,
  column: string,
  values: Record<string, number>,
  totalRows: number,
  samples: TemporalPreviewSample[]
): TemporalPreviewResult {
  const unique = new Map<
    string,
    { interval: DerivedWhenInterval; count: number }
  >();
  let parseableCount = 0;
  for (const [value, count] of Object.entries(values)) {
    const parsed = deriveWhenIntervalFromRow(
      { [column]: value },
      config.sourceColumns
    );
    if (!parsed || !(count > 0)) continue;
    parseableCount += count;
    addInterval(unique, parsed, count);
  }
  return resultFromCounts(totalRows, unique, parseableCount, config, samples);
}

function chunkStats(
  rowGroup: FileMetaData["row_groups"][number],
  name: string
) {
  return rowGroup.columns.find(
    (column) => column.meta_data?.path_in_schema.join(".") === name
  )?.meta_data?.statistics;
}

/**
 * Exact histogram when every row group's min/max parse to the same interval
 * (typical for a year column written in year order).
 */
function previewFromRowGroupStats(
  metadata: FileMetaData,
  config: DataTableTemporalConfig,
  column: string,
  samples: TemporalPreviewSample[]
): TemporalPreviewResult | null {
  const unique = new Map<
    string,
    { interval: DerivedWhenInterval; count: number }
  >();
  let parseableCount = 0;
  const totalRows = Number(metadata.num_rows);

  for (const rowGroup of metadata.row_groups) {
    const numRows = Number(rowGroup.num_rows);
    if (numRows <= 0) continue;
    const stats = chunkStats(rowGroup, column);
    const nullCount =
      stats?.null_count === undefined ? 0 : Number(stats.null_count);
    const present = numRows - nullCount;
    if (present <= 0) continue;
    if (!stats || stats.min_value == null || stats.max_value == null) {
      return null;
    }
    const minParsed = deriveWhenIntervalFromRow(
      { [column]: stats.min_value },
      config.sourceColumns
    );
    const maxParsed = deriveWhenIntervalFromRow(
      { [column]: stats.max_value },
      config.sourceColumns
    );
    if (
      !minParsed ||
      !maxParsed ||
      intervalKey(minParsed) !== intervalKey(maxParsed)
    ) {
      return null;
    }
    parseableCount += present;
    addInterval(unique, minParsed, present);
  }

  if (unique.size === 0) return null;
  return resultFromCounts(totalRows, unique, parseableCount, config, samples);
}

async function readPreviewRows(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  columns: string[];
}): Promise<Record<string, unknown>[]> {
  const spans = rowGroupReadSpans(options.metadata);
  if (spans.length === 0) return [];
  const first = spans[0];
  const rowEnd = Math.min(first.rowStart + PREVIEW_ROW_SCAN, first.rowEnd);
  return (await parquetReadObjects({
    file: options.file,
    metadata: options.metadata,
    columns: options.columns,
    rowStart: first.rowStart,
    rowEnd,
  })) as Record<string, unknown>[];
}

function collectSamples(
  rows: Record<string, unknown>[],
  config: DataTableTemporalConfig,
  columns: string[]
): TemporalPreviewSample[] {
  const samples: TemporalPreviewSample[] = [];
  let successSamples = 0;
  let failureSamples = 0;
  const successBudget = Math.ceil(PREVIEW_SAMPLE_LIMIT / 2);
  const failureBudget = Math.floor(PREVIEW_SAMPLE_LIMIT / 2);
  for (const row of rows) {
    const parsed = deriveWhenIntervalFromRow(row, config.sourceColumns);
    if (parsed) {
      if (successSamples < successBudget) {
        samples.push({ raw: rawFromRow(row, columns), parsed });
        successSamples++;
      }
    } else if (failureSamples < failureBudget) {
      samples.push({ raw: rawFromRow(row, columns), parsed: null });
      failureSamples++;
    }
    if (
      successSamples >= successBudget &&
      failureSamples >= failureBudget
    ) {
      break;
    }
  }
  return samples;
}

export function parseTemporalPreviewConfig(
  raw: string | null
): DataTableTemporalConfig {
  if (!raw || raw.trim() === "") {
    throw new QueryError(
      'Missing "config" query parameter (JSON DataTableTemporalConfig).'
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QueryError(
      'Invalid "config" query parameter. Expected JSON DataTableTemporalConfig.'
    );
  }
  if (!isDataTableTemporalConfig(parsed)) {
    throw new QueryError(
      "Invalid DataTableTemporalConfig. See @seasketch/geostats-types isDataTableTemporalConfig."
    );
  }
  return parsed;
}

export async function previewTemporalMapping(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  config: DataTableTemporalConfig;
  columnStats?: TemporalPreviewColumnStats;
}): Promise<TemporalPreviewResult> {
  const { file, metadata, config } = options;
  const columns = sourceColumnNames(config.sourceColumns);
  const schema = columnsFromMetadata(metadata);
  for (const name of columns) {
    if (!schema.has(name)) {
      throw new QueryError(`Unknown column "${name}".`, 400, {
        validColumns: [...schema.values()].map((c) => ({
          name: c.name,
          type: c.kind,
        })),
      });
    }
  }

  const totalRows = Number(metadata.num_rows);
  const sampleRows = await readPreviewRows({ file, metadata, columns });
  const samples = collectSamples(sampleRows, config, columns);
  const histColumn = histogramColumn(config.sourceColumns);

  if (histColumn) {
    const counts = completeValueCounts(options.columnStats, histColumn);
    if (counts) {
      return previewFromValueCounts(
        config,
        histColumn,
        counts.values,
        counts.rowCount > 0 ? counts.rowCount : totalRows,
        samples
      );
    }
    const fromGroups = previewFromRowGroupStats(
      metadata,
      config,
      histColumn,
      samples
    );
    if (fromGroups) return fromGroups;
  }

  const unique = new Map<
    string,
    { interval: DerivedWhenInterval; count: number }
  >();
  let sampledParseable = 0;
  for (const row of sampleRows) {
    const parsed = deriveWhenIntervalFromRow(row, config.sourceColumns);
    if (!parsed) continue;
    sampledParseable++;
    addInterval(unique, parsed, 1);
  }
  const parseableCount =
    sampleRows.length === 0
      ? 0
      : Math.round((sampledParseable / sampleRows.length) * totalRows);
  const extraCoverage = histColumn
    ? coverageIntervalsFromChunkStats(metadata, config, histColumn)
    : [];
  return resultFromCounts(
    totalRows,
    unique,
    parseableCount,
    config,
    samples,
    extraCoverage
  );
}

function availabilityFromIntervalCounts(
  entries: Array<{ interval: DerivedWhenInterval; count: number }>,
  resolution: TemporalPrecision
): TemporalAvailability | null {
  const coverage = coverageFromDerivedIntervals(
    entries.map((entry) => entry.interval)
  );
  if (!coverage) return null;
  const binCounts = new Map<string, number>();
  for (const { interval, count } of entries) {
    let t = interval.startSec * 1000;
    const end = interval.endSec * 1000;
    while (t < end) {
      const iso = formatTemporalIsoFromMs(t, resolution);
      binCounts.set(iso, (binCounts.get(iso) || 0) + count);
      const next = expandTemporalIso(iso, resolution);
      if (!next || next.end <= t) break;
      t = next.end;
    }
  }
  const bins = Array.from(binCounts.entries())
    .map(([start, count]) => ({ start, count }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    type: "histogram",
    resolution,
    start: coverage.start,
    end: coverage.end,
    bins,
  };
}
