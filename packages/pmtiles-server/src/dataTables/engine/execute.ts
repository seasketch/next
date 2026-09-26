import { AsyncBuffer, FileMetaData } from "hyparquet";
import { parquetReadColumn } from "hyparquet/src/read.js";
import {
  Aggregation,
  isHiddenWhenColumn,
  MAX_LIMIT,
  ParsedQuery,
  QueryError,
  TemporalWhenFilter,
  WHEN_END_COLUMN,
  WHEN_START_COLUMN,
} from "../params";
import {
  enumerateWhenSteps,
  stepsOverlappingInterval,
} from "../whenStep";
import { ByteBudgetCache } from "./blockReader";
import {
  ColumnKind,
  CompiledFilter,
  QueryPlan,
  decodeSpans,
  matchesCompiledFilter,
  normalizeValue,
  pruneRowGroups,
} from "./plan";
import type { CoverageIndex } from "@seasketch/geostats-types";
import {
  ExplainedReplicate,
  addReplicateValue,
  contributionExclusion,
  finalizeReplicates,
  isEffortMarkerValue,
  type ReplicateBucket,
} from "./replicates";

/**
 * CONSISTENCY INVARIANT (QA/QC "show rows in calculation")
 * --------------------------------------------------------
 * A raw-row query (no `op`) and an aggregated query with identical `q.*` and
 * `when.*` parameters MUST select exactly the same set of rows. The client's
 * "Show rows in calculation" QA/QC modal relies on this to display the rows
 * behind every map statistic; if the two paths ever diverge, that tool lies
 * to scientists about how their monitoring data was aggregated.
 *
 * Both paths already share `planQuery` (row-group pruning), `compileFilters`
 * (value coercion), `matchIndexesInSpan` (which calls `matchesFilter` and
 * `rowMatchesWhen`). When editing filtering, temporal (`when`) handling, or
 * null semantics here or in plan.ts, keep both paths on those shared
 * functions and run `test/dataTables/rawAggConsistency.test.ts`, which
 * cross-checks aggregate results against independent recomputation from
 * raw-row output.
 */

/**
 * Decoded column arrays for a warm isolate. Parquet decode is CPU-heavy;
 * caching by file version + column + row span lets filter sweeps (changing
 * species/year against the same columns) skip decode on repeat queries.
 * Identical queries should hit HTTP/Workers Cache instead and never reach here.
 *
 * String columns are interned before caching: monitoring tables repeat a few
 * hundred distinct site, species, and observer values across hundreds of
 * thousands of rows, so sharing one string instance per distinct value makes
 * a whole table's working set fit in the budget instead of evicting itself.
 */
const DECODED_COLUMN_BUDGET = 48 * 1024 * 1024;
const decodedColumns = new ByteBudgetCache<unknown[]>(DECODED_COLUMN_BUDGET);

/** Pointer per row plus the distinct strings; numbers as packed doubles. */
function estimateDecodedBytes(data: unknown[], distinctChars: number): number {
  return 8 * data.length + 16 * Math.max(1, distinctChars / 16) + 2 * distinctChars;
}

function internColumn(data: unknown[]): { data: unknown[]; distinctChars: number } {
  let distinctChars = 0;
  let sawString = false;
  const seen = new Map<string, string>();
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (typeof value === "string") {
      sawString = true;
      const shared = seen.get(value);
      if (shared === undefined) {
        seen.set(value, value);
        distinctChars += value.length;
      } else {
        data[i] = shared;
      }
    } else if (value instanceof Uint8Array) {
      const text = new TextDecoder().decode(value);
      sawString = true;
      const shared = seen.get(text);
      if (shared === undefined) {
        seen.set(text, text);
        distinctChars += text.length;
        data[i] = text;
      } else {
        data[i] = shared;
      }
    } else if (typeof value === "bigint") {
      data[i] = Number(value);
    }
  }
  return { data, distinctChars: sawString ? distinctChars : 0 };
}

/**
 * Registered replicates for one (file, survey filters, window, key columns).
 * Independent of subject and detail filters, so a species sweep reuses it.
 */
type RosterEntry = {
  whenStart: number | null;
  whenEnd: number | null;
  groupValues: unknown[];
  replicateValues: unknown[];
  scope: { [column: string]: string };
  rowCount: number;
};
type ReplicateRoster = {
  entries: Map<string, RosterEntry>;
  rowsScanned: number;
  rowsMatched: number;
};
const ROSTER_BUDGET = 24 * 1024 * 1024;
const rosterCache = new ByteBudgetCache<ReplicateRoster>(ROSTER_BUDGET);

export function resetEngineCaches() {
  rosterCache.clear();
}

export interface QuerySeriesStepStat {
  step: string;
  rows: number;
  groups: number;
}

export interface QuerySeries {
  step: string;
  steps: string[];
  min: number;
  max: number;
  scaleMin: number;
  scaleMax: number;
  hasZero: boolean;
  stepStats: QuerySeriesStepStat[];
}

export interface QueryResult {
  /** Present for raw (non-aggregated) queries */
  rows?: Record<string, unknown>[];
  /** Present for aggregated queries */
  groups?: Record<string, unknown>[];
  /** Present when `when.step` is active and `_when_*` columns exist. */
  series?: QuerySeries;
  /** Present when `explain=1` and the query names one feature. */
  replicates?: ExplainedReplicate[];
  rowsScanned: number;
  rowsMatched: number;
}
type Row = Record<string, unknown>;
type Primitive = string | number | boolean | null;

function matchesFilter(raw: unknown, filter: CompiledFilter): boolean {
  return matchesCompiledFilter(raw, filter);
}

export function rowMatchesWhen(
  startRaw: unknown,
  endRaw: unknown,
  when: TemporalWhenFilter
): boolean {
  const start = normalizeValue(startRaw, "number");
  const end = normalizeValue(endRaw, "number");
  if (typeof start !== "number" || typeof end !== "number") return false;
  return start < when.endSec && end > when.startSec;
}

/** Converts values to JSON-serializable output (BigInt, Date handling). */
function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

function jsonRow(row: Row, includeWhen = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!includeWhen && isHiddenWhenColumn(key)) continue;
    out[key] = jsonValue(row[key]);
  }
  return out;
}

interface GroupAccumulator {
  keyValues: unknown[];
  rowCount: number;
  valueCount: number;
  sum: number;
  min: Primitive;
  max: Primitive;
  /** buffered values for median */
  values?: number[];
}

/** Raw parquet values (BigInt, Date, UTF8 bytes) → comparable primitives. */
function comparableValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.getTime();
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return value;
}

function compareValues(rawA: unknown, rawB: unknown): number {
  const a = comparableValue(rawA);
  const b = comparableValue(rawB);
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Span = { rowStart: number; rowEnd: number; whenSaturated?: boolean };
type ReadColumn = (name: string, span: Span) => Promise<unknown[]>;

function createReadColumn(
  file: AsyncBuffer,
  metadata: FileMetaData,
  cacheKey?: string
): ReadColumn {
  return async (name, span) => {
    const key = cacheKey
      ? `${cacheKey}#${name}#${span.rowStart}-${span.rowEnd}`
      : null;
    if (key) {
      const cached = decodedColumns.get(key);
      if (cached) return cached;
    }
    const raw = (await parquetReadColumn({
      file,
      metadata,
      columns: [name],
      rowStart: span.rowStart,
      rowEnd: span.rowEnd,
    })) as unknown[];
    const { data, distinctChars } = internColumn(raw);
    if (key) {
      decodedColumns.set(key, data, estimateDecodedBytes(data, distinctChars));
    }
    return data;
  };
}

/**
 * Shared row selection for aggregate and raw paths. Equality filters run
 * first so a miss skips `_when_*` / remaining columns. Both callers then
 * decide which extra columns to decode.
 */
async function matchIndexesInSpan(
  span: Span,
  plan: QueryPlan,
  readColumn: ReadColumn
): Promise<{ matched: number[] | null; loaded: Map<string, unknown[]> }> {
  const spanRows = span.rowEnd - span.rowStart;
  const loaded = new Map<string, unknown[]>();
  const equalityFilters = plan.filters.filter(
    (filter) => filter.op === "eq" || filter.op === "in"
  );
  const otherFilters = plan.filters.filter(
    (filter) => filter.op !== "eq" && filter.op !== "in"
  );
  const skipWhen = Boolean(span.whenSaturated);

  if (
    equalityFilters.length === 0 &&
    otherFilters.length === 0 &&
    (skipWhen || !plan.when)
  ) {
    return { matched: null, loaded };
  }

  let matched: number[] | null = null;
  if (equalityFilters.length > 0) {
    await Promise.all(
      [...new Set(equalityFilters.map((filter) => filter.column))].map(
        async (name) => {
          loaded.set(name, await readColumn(name, span));
        }
      )
    );
    matched = [];
    for (let i = 0; i < spanRows; i++) {
      if (
        equalityFilters.every((filter) =>
          matchesFilter(loaded.get(filter.column)![i], filter)
        )
      ) {
        matched.push(i);
      }
    }
  } else {
    matched = null;
  }
  const matchedCount = matched ? matched.length : spanRows;
  if (matchedCount === 0) {
    return { matched: matched ?? [], loaded };
  }

  const remainingNames = new Set(otherFilters.map((filter) => filter.column));
  if (plan.when) {
    remainingNames.add(WHEN_START_COLUMN);
    remainingNames.add(WHEN_END_COLUMN);
  }
  await Promise.all(
    [...remainingNames]
      .filter((name) => !loaded.has(name))
      .map(async (name) => {
        loaded.set(name, await readColumn(name, span));
      })
  );

  if (otherFilters.length > 0) {
    const indexes = matched ?? denseIndexes(spanRows);
    matched = indexes.filter((i) =>
      otherFilters.every((filter) =>
        matchesFilter(loaded.get(filter.column)![i], filter)
      )
    );
  }
  if (plan.when && !skipWhen) {
    const startCol = loaded.get(WHEN_START_COLUMN);
    const endCol = loaded.get(WHEN_END_COLUMN);
    if (startCol && endCol) {
      const indexes = matched ?? denseIndexes(spanRows);
      matched = indexes.filter((i) =>
        rowMatchesWhen(startCol[i], endCol[i], plan.when!)
      );
    }
  }
  return { matched, loaded };
}

function denseIndexes(spanRows: number): number[] {
  const indexes = new Array<number>(spanRows);
  for (let i = 0; i < spanRows; i++) indexes[i] = i;
  return indexes;
}

function sortAndPage<T extends Record<string, unknown>>(
  items: T[],
  orderBy: ParsedQuery["orderBy"],
  offset: number,
  limit: number | null,
  validKeys: (key: string) => boolean
): T[] {
  if (orderBy) {
    if (!validKeys(orderBy.key)) {
      throw new QueryError(
        `orderBy key "${orderBy.key}" is not present in the output.`
      );
    }
    const dir = orderBy.direction === "desc" ? -1 : 1;
    items.sort((a, b) => dir * compareValues(a[orderBy.key], b[orderBy.key]));
  }
  return limit === null
    ? items.slice(offset)
    : items.slice(offset, offset + limit);
}

export async function executeQuery(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  query: ParsedQuery;
  plan: QueryPlan;
  /** Unique per file version (e.g. the object etag). Enables the decoded
   * column cache; omit for one-shot reads. */
  cacheKey?: string;
  /** Survey coverage index. Required when coverageMode is coverage_file. */
  coverage?: CoverageIndex | null;
}): Promise<QueryResult> {
  const { file, metadata, query, plan, cacheKey, coverage } = options;
  const readColumn = createReadColumn(file, metadata, cacheKey);

  if (query.ops.length === 0) {
    return await executeRawQuery(options, readColumn);
  }

  if (query.replicateBy.length > 0 && query.within !== null) {
    return await executeReplicateQuery(options, readColumn);
  }

  const aggColumn = query.column;
  const aggKind: ColumnKind | undefined = aggColumn
    ? plan.columns.get(aggColumn)?.kind
    : undefined;
  const needsMedian = query.ops.includes("median");
  const whenStep =
    query.whenStep && plan.when ? query.whenStep : null;
  const groups = new Map<string, GroupAccumulator>();
  let rowsScanned = 0;
  let rowsMatched = 0;

  for (const span of decodeSpans(plan.spans)) {
    const spanRows = span.rowEnd - span.rowStart;
    rowsScanned += spanRows;

    const { matched, loaded } = await matchIndexesInSpan(
      span,
      plan,
      readColumn
    );
    rowsMatched += matched ? matched.length : spanRows;
    if (matched && matched.length === 0) continue;

    const startCol = plan.when ? loaded.get(WHEN_START_COLUMN) : undefined;
    const endCol = plan.when ? loaded.get(WHEN_END_COLUMN) : undefined;

    const otherColumns = new Set<string>([...query.groupBy]);
    if (aggColumn) otherColumns.add(aggColumn);
    const columnData = new Map<string, unknown[]>(loaded);
    await Promise.all(
      [...otherColumns]
        .filter((name) => !columnData.has(name))
        .map(async (name) => {
          columnData.set(name, await readColumn(name, span));
        })
    );

    const groupByData = query.groupBy.map((col) => columnData.get(col)!);
    const aggData = aggColumn ? columnData.get(aggColumn)! : null;
    const indexCount = matched ? matched.length : spanRows;

    for (let k = 0; k < indexCount; k++) {
      const i = matched ? matched[k] : k;
      const groupValues = groupByData.map((data) => jsonValue(data[i]));
      const stepKeys =
        whenStep && plan.when
          ? (() => {
              const rowStart = normalizeValue(startCol![i], "number");
              const rowEnd = normalizeValue(endCol![i], "number");
              if (typeof rowStart !== "number" || typeof rowEnd !== "number") {
                return [];
              }
              return stepsOverlappingInterval(
                rowStart,
                rowEnd,
                plan.when,
                whenStep
              );
            })()
          : [null];
      for (const stepKey of stepKeys) {
        const keyValues =
          stepKey === null ? [...groupValues] : [stepKey, ...groupValues];
        const key = JSON.stringify(keyValues);
        let group = groups.get(key);
        if (!group) {
          group = {
            keyValues,
            rowCount: 0,
            valueCount: 0,
            sum: 0,
            min: null,
            max: null,
            values: needsMedian ? [] : undefined,
          };
          groups.set(key, group);
        }
        group.rowCount++;

        if (aggData) {
          const value = normalizeValue(aggData[i], aggKind || "string");
          if (value !== null) {
            group.valueCount++;
            if (typeof value === "number") {
              group.sum += value;
              group.values?.push(value);
            }
            if (group.min === null || compareValues(value, group.min) < 0) {
              group.min = value;
            }
            if (group.max === null || compareValues(value, group.max) > 0) {
              group.max = value;
            }
          }
        }
      }
    }
  }

  if (groups.size > MAX_LIMIT) {
    throw new QueryError(
      `when.step produced ${groups.size} groups (max ${MAX_LIMIT}). Use a coarser when.step or add filters.`
    );
  }

  const output: Record<string, unknown>[] = [];
  const primaryOp = query.ops[0];
  const valuesByStep = new Map<
    string,
    { rows: number; groups: number; values: number[] }
  >();
  for (const group of groups.values()) {
    const entry: Record<string, unknown> = {};
    const valueOffset = whenStep ? 1 : 0;
    if (whenStep) {
      entry.step = group.keyValues[0];
    }
    query.groupBy.forEach((col, i) => {
      entry[col] = group.keyValues[i + valueOffset];
    });
    for (const op of query.ops) {
      entry[op] = aggregateValue(op, group, aggColumn !== null);
    }
    output.push(entry);
    if (whenStep && typeof entry.step === "string") {
      let stat = valuesByStep.get(entry.step);
      if (!stat) {
        stat = { rows: 0, groups: 0, values: [] };
        valuesByStep.set(entry.step, stat);
      }
      stat.rows += group.rowCount;
      stat.groups += 1;
      const primary = entry[primaryOp];
      if (typeof primary === "number" && Number.isFinite(primary)) {
        stat.values.push(primary);
      }
    }
  }

  const series =
    whenStep && plan.when
      ? buildQuerySeries(whenStep, plan.when, valuesByStep)
      : undefined;

  const validKeys = (key: string) =>
    key === "step" ||
    query.groupBy.includes(key) ||
    (query.ops as string[]).includes(key);
  const paged = sortAndPage(
    output,
    query.orderBy,
    query.offset,
    query.limit,
    validKeys
  );

  return { groups: paged, series, rowsScanned, rowsMatched };
}

function buildQuerySeries(
  step: NonNullable<ParsedQuery["whenStep"]>,
  window: TemporalWhenFilter,
  valuesByStep: Map<string, { rows: number; groups: number; values: number[] }>
): QuerySeries {
  const steps = enumerateWhenSteps(window, step);
  const allValues: number[] = [];
  for (const stat of valuesByStep.values()) {
    allValues.push(...stat.values);
  }
  const positives = allValues.filter((value) => value > 0);
  return {
    step,
    steps,
    min: allValues.length ? Math.min(...allValues) : 0,
    max: allValues.length ? Math.max(...allValues) : 0,
    scaleMin: positives.length ? Math.min(...positives) : 0,
    scaleMax: positives.length ? Math.max(...positives) : 0,
    hasZero: allValues.some((value) => value === 0),
    stepStats: steps
      .map((iso) => {
        const stat = valuesByStep.get(iso);
        return {
          step: iso,
          rows: stat?.rows ?? 0,
          groups: stat?.groups ?? 0,
        };
      })
      .filter((stat) => stat.rows > 0),
  };
}

/**
 * Replicate mode, two passes.
 *
 * Pass 1 (registration) decides which replicates exist: rows passing the
 * survey filters and the clock window, keyed by survey time, feature, and
 * replicate columns. It never depends on subject or detail filters, so the
 * roster is cached per file version and reused across a species sweep.
 *
 * Pass 2 (values) adds the value column for rows that also pass the subject
 * and detail filters. Their equality clauses are used to prune row groups,
 * so a single-species query on a clustered or bloom-filtered file touches a
 * fraction of the table. Rows in pass 2 are a subset of pass 1 by
 * construction, so every value lands in a registered replicate.
 */
async function executeReplicateQuery(
  options: {
    file: AsyncBuffer;
    metadata: FileMetaData;
    query: ParsedQuery;
    plan: QueryPlan;
    cacheKey?: string;
    coverage?: CoverageIndex | null;
  },
  readColumn: ReadColumn
): Promise<QueryResult> {
  const { file, metadata, query, plan, cacheKey, coverage } = options;
  const within = query.within!;
  const aggColumn = query.column;
  const aggKind: ColumnKind | undefined = aggColumn
    ? plan.columns.get(aggColumn)?.kind
    : undefined;
  const whenStep = query.whenStep && plan.when ? query.whenStep : null;
  const hasWhenColumns =
    plan.columns.has(WHEN_START_COLUMN) && plan.columns.has(WHEN_END_COLUMN);
  const scopeColumns = coverage?.scopeColumns ?? [];

  if (query.coverageMode === "coverage_file" && !coverage) {
    throw new QueryError(
      "coverageMode=coverage_file requires a coverage file.",
      400
    );
  }

  const keyColumns = [...query.groupBy, ...query.replicateBy];
  const rosterKey = cacheKey
    ? [
        cacheKey,
        keyColumns.join(","),
        scopeColumns.join(","),
        JSON.stringify(plan.filters),
        plan.when ? `${plan.when.startSec}-${plan.when.endSec}` : "",
      ].join("|")
    : null;

  let roster = rosterKey ? rosterCache.get(rosterKey) : undefined;
  let rowsScanned = 0;
  if (!roster) {
    roster = await registerReplicates({
      plan,
      readColumn,
      keyColumns,
      groupByCount: query.groupBy.length,
      scopeColumns,
      hasWhenColumns,
    });
    rowsScanned += roster.rowsScanned;
    if (roster.entries.size > MAX_LIMIT) {
      throw new QueryError(
        `replicateBy produced ${roster.entries.size} replicates (max ${MAX_LIMIT}). Add filters or fewer replicate columns.`
      );
    }
    if (rosterKey) {
      rosterCache.set(rosterKey, roster, estimateRosterBytes(roster));
    }
  }

  const buckets = new Map<string, ReplicateBucket>();
  for (const [key, entry] of roster.entries) {
    buckets.set(key, {
      whenStart: entry.whenStart,
      whenEnd: entry.whenEnd,
      groupValues: entry.groupValues,
      replicateValues: entry.replicateValues,
      scope: entry.scope,
      rowCount: entry.rowCount,
      valueCount: 0,
      sum: 0,
      min: null,
      max: null,
    });
  }

  // Value pass. Equality subject/detail filters join the survey filters so
  // the planner can skip row groups; the rest are checked per row.
  const equalityContribution = plan.contributionFilters.filter(
    (filter) => filter.op === "eq" || filter.op === "in"
  );
  const perRowContribution = plan.contributionFilters.filter(
    (filter) => filter.op !== "eq" && filter.op !== "in"
  );
  const valueFilters = [...plan.filters, ...equalityContribution];
  const pruned =
    equalityContribution.length > 0
      ? await pruneRowGroups(metadata, valueFilters, plan.when, file)
      : { spans: plan.spans, scanned: plan.rowGroupsScanned };
  const valuePlan: QueryPlan = {
    ...plan,
    filters: valueFilters,
    spans: pruned.spans,
  };
  const markers = new Set(query.effortMarkers);
  const checkEffort = markers.size > 0;
  // A nothing-seen value names a subject placeholder such as NO_ORG. The
  // same word in a detail column ("Not recorded" as a shell type) describes
  // a real observation, so only the subject column is checked.
  const effortColumns = checkEffort
    ? [query.subjectColumn].filter(
        (name): name is string => Boolean(name) && plan.columns.has(name!)
      )
    : [];

  if (aggColumn) {
    for (const span of decodeSpans(valuePlan.spans)) {
      const spanRows = span.rowEnd - span.rowStart;
      rowsScanned += spanRows;
      const { matched, loaded } = await matchIndexesInSpan(
        span,
        valuePlan,
        readColumn
      );
      if (matched && matched.length === 0) continue;

      const needed = new Set<string>([...keyColumns, aggColumn]);
      for (const filter of perRowContribution) needed.add(filter.column);
      for (const name of effortColumns) needed.add(name);
      if (hasWhenColumns) {
        needed.add(WHEN_START_COLUMN);
        needed.add(WHEN_END_COLUMN);
      }
      const columnData = new Map<string, unknown[]>(loaded);
      await Promise.all(
        [...needed]
          .filter((name) => !columnData.has(name))
          .map(async (name) => {
            columnData.set(name, await readColumn(name, span));
          })
      );
      const keyData = keyColumns.map((name) => columnData.get(name)!);
      const aggData = columnData.get(aggColumn)!;
      const whenStartData = hasWhenColumns
        ? columnData.get(WHEN_START_COLUMN)!
        : null;
      const whenEndData = hasWhenColumns
        ? columnData.get(WHEN_END_COLUMN)!
        : null;
      const perRowData = perRowContribution.map(
        (filter) => [filter, columnData.get(filter.column)!] as const
      );
      const effortData = effortColumns.map((name) => columnData.get(name)!);
      const indexCount = matched ? matched.length : spanRows;
      const parts: string[] = [];

      for (let k = 0; k < indexCount; k++) {
        const i = matched ? matched[k] : k;
        let excluded = false;
        for (const [filter, data] of perRowData) {
          if (!matchesCompiledFilter(data[i], filter)) {
            excluded = true;
            break;
          }
        }
        if (!excluded && checkEffort) {
          for (const data of effortData) {
            if (isEffortMarkerValue(data[i], markers)) {
              excluded = true;
              break;
            }
          }
        }
        if (excluded) continue;
        const value = normalizeValue(aggData[i], aggKind || "string");
        if (typeof value !== "number") continue;
        const key = replicateRowKey(
          parts,
          whenStartData,
          whenEndData,
          keyData,
          i
        );
        const bucket = buckets.get(key);
        if (bucket) addReplicateValue(bucket, value);
      }
    }
  }

  const finalized = finalizeReplicates({
    replicates: buckets,
    within,
    ops: query.ops,
    hasColumn: aggColumn !== null,
    groupBy: query.groupBy,
    replicateBy: query.replicateBy,
    coverageMode: query.coverageMode ?? "all_surveyed",
    subjectColumn: query.subjectColumn,
    contributionFilters: plan.contributionFilters,
    coverage: coverage ?? null,
    whenStep,
    when: plan.when,
    explain: query.explain,
  });
  const validKeys = (key: string) =>
    key === "step" ||
    query.groupBy.includes(key) ||
    (query.ops as string[]).includes(key) ||
    key === "replicatesSurveyed" ||
    key === "replicatesZero" ||
    key === "replicatesNoValue" ||
    key === "replicatesNotSurveyed";
  const paged = sortAndPage(
    finalized.groups,
    query.orderBy,
    query.offset,
    query.limit,
    validKeys
  );
  const series =
    whenStep && plan.when
      ? buildQuerySeries(whenStep, plan.when, finalized.valuesByStep)
      : undefined;
  return {
    groups: paged,
    series,
    replicates: finalized.replicates,
    rowsScanned,
    rowsMatched: roster.rowsMatched,
  };
}

/** Survey time and key column values joined into one lookup key. */
function replicateRowKey(
  parts: string[],
  whenStartData: unknown[] | null,
  whenEndData: unknown[] | null,
  keyData: unknown[][],
  i: number
): string {
  parts.length = 0;
  const start = whenStartData
    ? normalizeValue(whenStartData[i], "number")
    : null;
  const end = whenEndData ? normalizeValue(whenEndData[i], "number") : null;
  parts.push(
    typeof start === "number" ? String(start) : "",
    typeof end === "number" ? String(end) : ""
  );
  for (const data of keyData) {
    const value = data[i];
    parts.push(value == null ? "" : String(jsonValue(value)));
  }
  return parts.join("\0");
}

async function registerReplicates(options: {
  plan: QueryPlan;
  readColumn: ReadColumn;
  keyColumns: string[];
  groupByCount: number;
  scopeColumns: string[];
  hasWhenColumns: boolean;
}): Promise<ReplicateRoster> {
  const { plan, readColumn, keyColumns, groupByCount, scopeColumns, hasWhenColumns } =
    options;
  const entries = new Map<string, RosterEntry>();
  let rowsScanned = 0;
  let rowsMatched = 0;
  const parts: string[] = [];

  for (const span of decodeSpans(plan.spans)) {
    const spanRows = span.rowEnd - span.rowStart;
    rowsScanned += spanRows;
    const { matched, loaded } = await matchIndexesInSpan(
      span,
      plan,
      readColumn
    );
    rowsMatched += matched ? matched.length : spanRows;
    if (matched && matched.length === 0) continue;

    const needed = new Set<string>([...keyColumns, ...scopeColumns]);
    if (hasWhenColumns) {
      needed.add(WHEN_START_COLUMN);
      needed.add(WHEN_END_COLUMN);
    }
    const columnData = new Map<string, unknown[]>(loaded);
    await Promise.all(
      [...needed]
        .filter((name) => !columnData.has(name))
        .map(async (name) => {
          columnData.set(name, await readColumn(name, span));
        })
    );
    const keyData = keyColumns.map((name) => columnData.get(name)!);
    const scopeData = scopeColumns.map((name) => columnData.get(name)!);
    const whenStartData = hasWhenColumns
      ? columnData.get(WHEN_START_COLUMN)!
      : null;
    const whenEndData = hasWhenColumns
      ? columnData.get(WHEN_END_COLUMN)!
      : null;
    const indexCount = matched ? matched.length : spanRows;

    for (let k = 0; k < indexCount; k++) {
      const i = matched ? matched[k] : k;
      const key = replicateRowKey(parts, whenStartData, whenEndData, keyData, i);
      let entry = entries.get(key);
      if (!entry) {
        const start = whenStartData
          ? normalizeValue(whenStartData[i], "number")
          : null;
        const end = whenEndData
          ? normalizeValue(whenEndData[i], "number")
          : null;
        const values = keyData.map((data) => jsonValue(data[i]));
        const scope: { [column: string]: string } = {};
        scopeColumns.forEach((name, index) => {
          const value = normalizeValue(scopeData[index][i], "string");
          if (value !== null && value !== undefined) scope[name] = String(value);
        });
        entry = {
          whenStart: typeof start === "number" ? start : null,
          whenEnd: typeof end === "number" ? end : null,
          groupValues: values.slice(0, groupByCount),
          replicateValues: values.slice(groupByCount),
          scope,
          rowCount: 0,
        };
        entries.set(key, entry);
      }
      entry.rowCount++;
    }
  }
  return { entries, rowsScanned, rowsMatched };
}

function estimateRosterBytes(roster: ReplicateRoster): number {
  let bytes = 64;
  for (const [key, entry] of roster.entries) {
    bytes += 2 * key.length + 96;
    bytes += 16 * (entry.groupValues.length + entry.replicateValues.length);
    bytes += 32 * Object.keys(entry.scope).length;
  }
  return bytes;
}

function aggregateValue(
  op: Aggregation,
  group: GroupAccumulator,
  hasColumn: boolean
): unknown {
  switch (op) {
    case "count":
      // With an aggregation column, count non-null values (like SQL
      // COUNT(col)); otherwise count matching rows (COUNT(*)).
      return hasColumn ? group.valueCount : group.rowCount;
    case "sum":
      return group.valueCount > 0 ? group.sum : null;
    case "mean":
      return group.valueCount > 0 ? group.sum / group.valueCount : null;
    case "min":
      return group.min;
    case "max":
      return group.max;
    case "median":
      return median(group.values || []);
  }
}

/**
 * Raw-row output. Shares `matchIndexesInSpan` with the aggregate path — see
 * the CONSISTENCY INVARIANT at the top of this module — then decodes the
 * remaining columns only for spans that actually matched. The previous
 * `parquetReadObjects` path decoded every column of every surviving row
 * group, which is what 503'd the QA/QC modal on a cold isolate.
 */
async function executeRawQuery(
  options: {
    file: AsyncBuffer;
    metadata: FileMetaData;
    query: ParsedQuery;
    plan: QueryPlan;
  },
  readColumn: ReadColumn
): Promise<QueryResult> {
  const { query, plan } = options;
  const matchedRows: Row[] = [];
  let rowsScanned = 0;
  let rowsMatched = 0;
  // Without an orderBy we can stop reading as soon as the page is filled.
  const target = query.orderBy
    ? Infinity
    : query.offset + (query.limit ?? Infinity);

  const outputNames = [...plan.columns.keys()].filter((name) => {
    if (!isHiddenWhenColumn(name)) return true;
    if (query.includeWhen) return true;
    return query.orderBy?.key === name;
  });

  for (const span of decodeSpans(plan.spans)) {
    const spanRows = span.rowEnd - span.rowStart;
    rowsScanned += spanRows;
    const { matched, loaded } = await matchIndexesInSpan(
      span,
      plan,
      readColumn
    );
    rowsMatched += matched ? matched.length : spanRows;
    if (matched && matched.length === 0) continue;

    await Promise.all(
      outputNames
        .filter((name) => !loaded.has(name))
        .map(async (name) => {
          loaded.set(name, await readColumn(name, span));
        })
    );

    const indexCount = matched ? matched.length : spanRows;
    for (let k = 0; k < indexCount; k++) {
      const i = matched ? matched[k] : k;
      if (matchedRows.length < target) {
        const row: Row = {};
        for (const name of outputNames) {
          row[name] = loaded.get(name)![i];
        }
        if (
          query.contributionFilters.length > 0 ||
          query.effortMarkers.length > 0
        ) {
          const markers = new Set(query.effortMarkers);
          const subjectFilters = plan.contributionFilters.filter(
            (filter) => filter.column === query.subjectColumn
          );
          const detailFilters = plan.contributionFilters.filter(
            (filter) => filter.column !== query.subjectColumn
          );
          const cells = new Map<string, unknown>();
          for (const filter of plan.contributionFilters) {
            cells.set(filter.column, row[filter.column]);
          }
          const effort = query.subjectColumn
            ? isEffortMarkerValue(row[query.subjectColumn], markers)
            : false;
          const excludedBy = contributionExclusion({
            effort,
            subjectFilters,
            detailFilters,
            cells,
          });
          row._contributes = excludedBy === null;
          row._excludedBy = excludedBy;
        }
        matchedRows.push(row);
      }
    }
    if (matchedRows.length >= target) break;
  }

  // Sort before stripping hidden _when_* columns so orderBy=_when_start
  // orders rows by the same derived temporal mapping the engine buckets by.
  const columnNames = new Set(plan.columns.keys());
  const paged = sortAndPage(
    matchedRows,
    query.orderBy,
    query.offset,
    query.limit,
    (key) => columnNames.has(key)
  );
  return {
    rows: paged.map((row) => jsonRow(row, query.includeWhen)),
    rowsScanned,
    rowsMatched,
  };
}
