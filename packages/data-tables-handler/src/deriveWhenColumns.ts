import {
  coverageFromDerivedIntervals,
  DataTableTemporalConfig,
  DataTableTemporalSourceColumns,
  formatTemporalIsoFromMs,
  isDataTableTemporalConfig,
  nativePrecisionFromSourceColumns,
  sourceColumnNames,
  TemporalDateFormat,
  TemporalInfo,
  TemporalPrecision,
  toDataTableTemporalSourceColumns,
  WHEN_END_COLUMN,
  WHEN_START_COLUMN,
} from "@seasketch/geostats-types";
import { all, run, withDuckDb } from "./duckDb";

function escapePath(path: string): string {
  return path.replace(/'/g, "''");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function yearExpr(col: string): string {
  return `TRY_CAST(regexp_replace(trim(CAST(${col} AS VARCHAR)), '\\.0+$', '') AS INTEGER)`;
}

function instantExprs(
  col: string,
  format: TemporalDateFormat
): { start: string; end: string } {
  if (format === "year") {
    const y = yearExpr(col);
    return {
      start: `CASE WHEN ${y} BETWEEN 1000 AND 9999 THEN epoch(make_timestamp(${y}, 1, 1, 0, 0, 0)) END`,
      end: `CASE WHEN ${y} BETWEEN 1000 AND 9999 THEN epoch(make_timestamp(${y} + 1, 1, 1, 0, 0, 0)) END`,
    };
  }
  if (format === "mdy" || format === "dmy") {
    const fmt = format === "mdy" ? "%m/%d/%Y" : "%d/%m/%Y";
    const ts = `try_strptime(trim(CAST(${col} AS VARCHAR)), '${fmt}')`;
    return {
      start: `epoch(${ts})`,
      end: `epoch(${ts} + INTERVAL 1 DAY)`,
    };
  }
  const s = `trim(CAST(${col} AS VARCHAR))`;
  const ts = `COALESCE(
    try_strptime(${s}, '%Y-%m-%dT%H:%M:%SZ'),
    try_strptime(${s}, '%Y-%m-%dT%H:%M:%S'),
    try_strptime(${s}, '%Y-%m-%dT%H:%MZ'),
    try_strptime(${s}, '%Y-%m-%dT%H:%M'),
    try_strptime(${s}, '%Y-%m-%dT%HZ'),
    try_strptime(${s}, '%Y-%m-%dT%H'),
    try_strptime(${s}, '%Y-%m-%d %H:%M:%S'),
    try_strptime(${s}, '%Y-%m-%d'),
    try_strptime(${s}, '%Y-%m'),
    try_strptime(${s}, '%Y')
  )`;
  // Match geostats-types precisionFromIsoText: year/month/day by length,
  // then T-time tokens for second / minute / hour, else day.
  const endInterval = `CASE
    WHEN length(${s}) = 4 THEN INTERVAL 1 YEAR
    WHEN length(${s}) = 7 THEN INTERVAL 1 MONTH
    WHEN length(${s}) = 10 THEN INTERVAL 1 DAY
    WHEN regexp_matches(${s}, 'T[0-9]{2}:[0-9]{2}:[0-9]{2}') THEN INTERVAL 1 SECOND
    WHEN regexp_matches(${s}, 'T[0-9]{2}:[0-9]{2}') THEN INTERVAL 1 MINUTE
    WHEN regexp_matches(${s}, 'T[0-9]{2}') THEN INTERVAL 1 HOUR
    ELSE INTERVAL 1 DAY
  END`;
  return {
    start: `epoch(${ts})`,
    end: `epoch(${ts} + ${endInterval})`,
  };
}

export function whenSelectSql(
  source: DataTableTemporalSourceColumns
): { start: string; end: string } {
  if (source.kind === "instant") {
    return instantExprs(quoteIdent(source.column), source.format);
  }
  if (source.kind === "span") {
    const start = instantExprs(quoteIdent(source.start), source.format);
    const end = instantExprs(quoteIdent(source.end), source.format);
    return { start: start.start, end: end.end };
  }
  const year = yearExpr(quoteIdent(source.year));
  const month = source.month
    ? `TRY_CAST(regexp_replace(trim(CAST(${quoteIdent(source.month)} AS VARCHAR)), '\\.0+$', '') AS INTEGER)`
    : "1";
  const day = source.day
    ? `TRY_CAST(regexp_replace(trim(CAST(${quoteIdent(source.day)} AS VARCHAR)), '\\.0+$', '') AS INTEGER)`
    : "1";
  const dateExpr = `try_strptime(
    printf('%04d-%02d-%02d', ${year}, coalesce(${month}, 1), coalesce(${day}, 1)),
    '%Y-%m-%d'
  )`;
  const endInterval = source.day
    ? "INTERVAL 1 DAY"
    : source.month
      ? "INTERVAL 1 MONTH"
      : "INTERVAL 1 YEAR";
  const validYear = `${year} BETWEEN 1000 AND 9999`;
  const validMonth = source.month
    ? `${month} BETWEEN 1 AND 12`
    : "true";
  const validDay = source.day ? `${day} BETWEEN 1 AND 31` : "true";
  return {
    start: `CASE WHEN ${validYear} AND ${validMonth} AND ${validDay} THEN epoch(${dateExpr}) END`,
    end: `CASE WHEN ${validYear} AND ${validMonth} AND ${validDay} THEN epoch(${dateExpr} + ${endInterval}) END`,
  };
}

function histogramUnit(resolution: TemporalPrecision): string {
  switch (resolution) {
    case "year":
      return "year";
    case "month":
      return "month";
    case "hour":
      return "hour";
    case "minute":
      return "minute";
    case "second":
      return "second";
    default:
      return "day";
  }
}

export type DeriveWhenResult = {
  rowCount: number;
  parseableCount: number;
  unparseableCount: number;
  temporal: TemporalInfo;
};

export async function deriveWhenColumnsOnParquet(
  parquetPath: string,
  config: DataTableTemporalConfig
): Promise<DeriveWhenResult> {
  if (!isDataTableTemporalConfig(config)) {
    throw new Error("Invalid DataTableTemporalConfig");
  }
  const exprs = whenSelectSql(config.sourceColumns);
  const startCol = quoteIdent(WHEN_START_COLUMN);
  const endCol = quoteIdent(WHEN_END_COLUMN);

  return withDuckDb(async (conn) => {
    await run(
      conn,
      `CREATE OR REPLACE TABLE observations AS
       SELECT
         * EXCLUDE (${startCol}, ${endCol}),
         CAST(${exprs.start} AS BIGINT) AS ${startCol},
         CAST(${exprs.end} AS BIGINT) AS ${endCol}
       FROM read_parquet('${escapePath(parquetPath)}')`,
    ).catch(async () => {
      // First write: _when_* do not exist yet.
      await run(
        conn,
        `CREATE OR REPLACE TABLE observations AS
         SELECT
           *,
           CAST(${exprs.start} AS BIGINT) AS ${startCol},
           CAST(${exprs.end} AS BIGINT) AS ${endCol}
         FROM read_parquet('${escapePath(parquetPath)}')`,
      );
    });

    const counts = await all<{
      total: number;
      parseable: number;
    }>(
      conn,
      `SELECT
         COUNT(*)::INTEGER as total,
         COUNT(${startCol})::INTEGER as parseable
       FROM observations`,
    );
    const rowCount = counts[0]?.total ?? 0;
    const parseableCount = counts[0]?.parseable ?? 0;
    const unparseableCount = rowCount - parseableCount;
    if (parseableCount === 0) {
      throw new Error(
        "No rows could be parsed with the selected temporal columns",
      );
    }

    const range = await all<{ min_start: number; max_end: number }>(
      conn,
      `SELECT MIN(${startCol}) as min_start, MAX(${endCol}) as max_end
       FROM observations WHERE ${startCol} IS NOT NULL`,
    );
    const minStart = Number(range[0]?.min_start);
    const maxEnd = Number(range[0]?.max_end);
    const nativeResolution = nativePrecisionFromSourceColumns(
      config.sourceColumns
    );
    const histogramResolution: TemporalPrecision =
      nativeResolution === "hour" ||
      nativeResolution === "minute" ||
      nativeResolution === "second"
        ? "day"
        : nativeResolution;

    const unit = histogramUnit(histogramResolution);
    // A row increments every native bin it intersects (same rule as
    // when.step / availabilityFromDerivedIntervals), not only the bin of
    // `_when_start`.
    const binRows = await all<{ bin_sec: number; count: number }>(
      conn,
      `WITH bounds AS (
         SELECT
           date_trunc('${unit}', timezone('UTC', to_timestamp(MIN(${startCol})))) AS first_ts,
           timezone('UTC', to_timestamp(MAX(${endCol}))) AS end_ts
         FROM observations
         WHERE ${startCol} IS NOT NULL
       ),
       bin_starts AS (
         SELECT first_ts + (INTERVAL 1 ${unit}) * i AS bin_ts
         FROM bounds, generate_series(0, 40000) AS g(i)
         WHERE first_ts + (INTERVAL 1 ${unit}) * i < end_ts
       )
       SELECT
         epoch(bin_ts)::BIGINT AS bin_sec,
         COUNT(o.${startCol})::INTEGER AS count
       FROM bin_starts
       INNER JOIN observations o
         ON o.${startCol} IS NOT NULL
        AND o.${startCol} < epoch(bin_ts + INTERVAL 1 ${unit})
        AND o.${endCol} > epoch(bin_ts)
       GROUP BY 1
       ORDER BY 1`,
    );
    const coverage = coverageFromDerivedIntervals([
      {
        startSec: minStart,
        endSec: maxEnd,
        startIso: formatTemporalIsoFromMs(minStart * 1000, nativeResolution),
        endIso: formatTemporalIsoFromMs(maxEnd * 1000, nativeResolution),
        precision: nativeResolution,
      },
    ]);
    const compactAvailability = {
      type: "histogram" as const,
      resolution: histogramResolution,
      start: coverage?.start ?? formatTemporalIsoFromMs(minStart * 1000, histogramResolution),
      end: coverage?.end ?? formatTemporalIsoFromMs(maxEnd * 1000, histogramResolution),
      bins: binRows.map((row) => ({
        start: formatTemporalIsoFromMs(
          Number(row.bin_sec) * 1000,
          histogramResolution
        ),
        count: row.count,
      })),
    };

    await run(
      conn,
      `COPY observations TO '${escapePath(parquetPath)}' (FORMAT PARQUET)`,
    );

    const defaultView =
      config.defaultViewResolution || nativeResolution;
    const temporal: TemporalInfo = {
      version: 1,
      granularity: "row",
      coverage: coverage || {
        kind: "interval",
        start: formatTemporalIsoFromMs(minStart * 1000, nativeResolution),
        end: formatTemporalIsoFromMs(maxEnd * 1000, nativeResolution),
        precision: nativeResolution,
      },
      nativeResolution,
      defaultViewResolution: defaultView,
      ...(config.supportedViewResolutions
        ? { supportedViewResolutions: config.supportedViewResolutions }
        : {}),
      mapping: {
        type: "row",
        startColumn: "_when_start",
        endColumn: "_when_end",
        sourceColumns: config.sourceColumns,
      },
      availability: compactAvailability,
      providesSliderStats: true,
      authoredBy: "admin",
    };

    return {
      rowCount,
      parseableCount,
      unparseableCount,
      temporal,
    };
  });
}

export function missingSourceColumns(
  headers: string[],
  source: DataTableTemporalSourceColumns
): string[] {
  const headerSet = new Set(headers);
  return sourceColumnNames(source).filter((name) => !headerSet.has(name));
}

export function configFromStoredTemporal(
  temporal: unknown
): DataTableTemporalConfig | null {
  if (!temporal || typeof temporal !== "object") return null;
  const mapping = (temporal as { mapping?: { sourceColumns?: unknown } })
    .mapping;
  if (!mapping?.sourceColumns) return null;
  const sourceColumns = toDataTableTemporalSourceColumns(
    mapping.sourceColumns as any
  );
  if (!sourceColumns) return null;
  const info = temporal as {
    defaultViewResolution?: TemporalPrecision;
    supportedViewResolutions?: TemporalPrecision[];
  };
  return {
    sourceColumns,
    defaultViewResolution: info.defaultViewResolution,
    supportedViewResolutions: info.supportedViewResolutions,
  };
}
