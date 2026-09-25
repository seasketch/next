/**
 * Replicate calculation. Code name: replicateBy + within.
 *
 * A replicate is one survey of one feature: rows that share survey time
 * (`_when_start`, `_when_end`), the group-by columns, and the replicate
 * columns. Survey filters (`q.*`) decide which rows register a replicate.
 * Subject and detail filters (`v.*`) only decide which rows contribute a
 * value. An empty replicate is zero, left out, or not surveyed according
 * to survey coverage.
 */
import type { CoverageIndex } from "@seasketch/geostats-types";
import type { Aggregation, WithinAggregation } from "../params";
import type { TemporalWhenFilter, WhenStepPrecision } from "../params";
import { stepsOverlappingInterval } from "../whenStep";
import {
  CompiledFilter,
  matchesCompiledFilter,
  normalizeValue,
} from "./plan";

export type ReplicateStatus = "counted" | "zero" | "noValue" | "notSurveyed";

export type ExplainedReplicate = {
  key: { [column: string]: unknown };
  status: ReplicateStatus;
  reason: string | null;
  coverageInterval?: { start: string; end: string | null } | null;
  scope: { [column: string]: string };
  /** Within-replicate result that entered the across calculation. Null when left out. */
  value: number | null;
  /** Rows that registered this replicate (passed the survey filters). */
  rowCount: number;
  /** Rows that passed the subject and detail filters and carried a number. */
  contributingRows: number;
};

export interface ReplicateBucket {
  whenStart: number | null;
  whenEnd: number | null;
  groupValues: unknown[];
  replicateValues: unknown[];
  scope: { [column: string]: string };
  rowCount: number;
  valueCount: number;
  sum: number;
  min: number | null;
  max: number | null;
}

export function replicateMapKey(
  whenStart: number | null,
  whenEnd: number | null,
  groupValues: unknown[],
  replicateValues: unknown[]
): string {
  return JSON.stringify([
    whenStart,
    whenEnd,
    ...groupValues,
    ...replicateValues,
  ]);
}

export function ensureReplicate(
  replicates: Map<string, ReplicateBucket>,
  whenStart: number | null,
  whenEnd: number | null,
  groupValues: unknown[],
  replicateValues: unknown[],
  scope: { [column: string]: string }
): ReplicateBucket {
  const key = replicateMapKey(
    whenStart,
    whenEnd,
    groupValues,
    replicateValues
  );
  let bucket = replicates.get(key);
  if (!bucket) {
    bucket = {
      whenStart,
      whenEnd,
      groupValues,
      replicateValues,
      scope,
      rowCount: 0,
      valueCount: 0,
      sum: 0,
      min: null,
      max: null,
    };
    replicates.set(key, bucket);
  }
  bucket.rowCount++;
  return bucket;
}

export function addReplicateValue(bucket: ReplicateBucket, value: number) {
  bucket.valueCount++;
  bucket.sum += value;
  if (bucket.min === null || value < bucket.min) bucket.min = value;
  if (bucket.max === null || value > bucket.max) bucket.max = value;
}

export type ExcludedBy = "subject" | "detail" | "effort" | null;

/** First failing contribution stage. Effort wins over subject and detail. */
export function contributionExclusion(options: {
  effort: boolean;
  subjectFilters: CompiledFilter[];
  detailFilters: CompiledFilter[];
  /** Column name → raw cell, for the filters' columns. */
  cells: Map<string, unknown>;
}): ExcludedBy {
  if (options.effort) return "effort";
  for (const filter of options.subjectFilters) {
    const raw = options.cells.get(filter.column);
    if (!matchesCompiledFilter(raw, filter)) return "subject";
  }
  for (const filter of options.detailFilters) {
    const raw = options.cells.get(filter.column);
    if (!matchesCompiledFilter(raw, filter)) return "detail";
  }
  return null;
}

export function isEffortMarkerValue(
  value: unknown,
  markers: ReadonlySet<string>
): boolean {
  if (markers.size === 0 || value === null || value === undefined) return false;
  return markers.has(String(normalizeValue(value, "string") ?? value));
}

function reduced(
  within: WithinAggregation,
  bucket: ReplicateBucket
): number | null {
  if (bucket.valueCount === 0) return null;
  switch (within) {
    case "sum":
      return bucket.sum;
    case "mean":
      return bucket.sum / bucket.valueCount;
    case "min":
      return bucket.min;
    case "max":
      return bucket.max;
  }
}

export function subjectFilterValues(
  filters: CompiledFilter[],
  subjectColumn: string | null
): { active: boolean; values: string[] | null } {
  if (!subjectColumn) return { active: false, values: null };
  const relevant = filters.filter((filter) => filter.column === subjectColumn);
  if (relevant.length === 0) return { active: false, values: null };
  const values: string[] = [];
  for (const filter of relevant) {
    if (filter.op === "eq" && filter.value !== undefined) {
      values.push(String(filter.value));
    } else if (filter.op === "in" && filter.values) {
      values.push(...filter.values.map((value) => String(value)));
    } else {
      return { active: true, values: null };
    }
  }
  return { active: true, values };
}

export function resolveEmptyReplicate(options: {
  within: WithinAggregation;
  coverageMode: "all_surveyed" | "rows_only" | "coverage_file";
  subject: { active: boolean; values: string[] | null };
  scope: { [column: string]: string };
  whenStart: number | null;
  whenEnd: number | null;
  coverage: CoverageIndex | null;
}): {
  status: ReplicateStatus;
  value: number | null;
  reason: string | null;
  coverageInterval: { start: string; end: string | null } | null;
} {
  if (options.within !== "sum") {
    return {
      status: "noValue",
      value: null,
      reason: "noValue",
      coverageInterval: null,
    };
  }
  if (
    options.coverageMode !== "coverage_file" ||
    !options.subject.active
  ) {
    return {
      status: "zero",
      value: 0,
      reason: "noMatchingObservations",
      coverageInterval: null,
    };
  }
  if (!options.coverage || options.subject.values === null) {
    return {
      status: "notSurveyed",
      value: null,
      reason: "notSurveyed",
      coverageInterval: null,
    };
  }
  if (
    options.whenStart === null ||
    options.whenEnd === null ||
    !(options.whenStart < options.whenEnd)
  ) {
    return {
      status: "notSurveyed",
      value: null,
      reason: "notSurveyed",
      coverageInterval: null,
    };
  }
  let interval: { start: string; end: string | null } | null = null;
  for (const subjectValue of options.subject.values) {
    const hit = options.coverage.lookup(
      options.scope,
      subjectValue,
      options.whenStart,
      options.whenEnd
    );
    if (!hit.surveyed) {
      return {
        status: "notSurveyed",
        value: null,
        reason: "notSurveyed",
        coverageInterval: null,
      };
    }
    interval = hit.interval;
  }
  return {
    status: "zero",
    value: 0,
    reason: "noMatchingObservations",
    coverageInterval: interval,
  };
}

interface OutputBucket {
  keyValues: unknown[];
  rowCount: number;
  valueCount: number;
  sum: number;
  min: number | null;
  max: number | null;
  values: number[];
  replicatesSurveyed: number;
  replicatesZero: number;
  replicatesNoValue: number;
  replicatesNotSurveyed: number;
}

function addResolved(
  outputs: Map<string, OutputBucket>,
  keyValues: unknown[],
  rowCount: number,
  status: ReplicateStatus,
  value: number | null
) {
  const key = JSON.stringify(keyValues);
  let acc = outputs.get(key);
  if (!acc) {
    acc = {
      keyValues,
      rowCount: 0,
      valueCount: 0,
      sum: 0,
      min: null,
      max: null,
      values: [],
      replicatesSurveyed: 0,
      replicatesZero: 0,
      replicatesNoValue: 0,
      replicatesNotSurveyed: 0,
    };
    outputs.set(key, acc);
  }
  acc.rowCount += rowCount;
  if (status === "notSurveyed") {
    acc.replicatesNotSurveyed++;
    return;
  }
  acc.replicatesSurveyed++;
  if (status === "noValue" || value === null) {
    acc.replicatesNoValue++;
    return;
  }
  acc.valueCount++;
  acc.sum += value;
  acc.values.push(value);
  if (acc.min === null || value < acc.min) acc.min = value;
  if (acc.max === null || value > acc.max) acc.max = value;
  if (value === 0) acc.replicatesZero++;
}

function aggregateOp(
  op: Aggregation,
  bucket: OutputBucket,
  hasColumn: boolean
): unknown {
  switch (op) {
    case "count":
      return hasColumn ? bucket.valueCount : bucket.rowCount;
    case "sum":
      return bucket.valueCount > 0 ? bucket.sum : null;
    case "mean":
      return bucket.valueCount > 0 ? bucket.sum / bucket.valueCount : null;
    case "min":
      return bucket.min;
    case "max":
      return bucket.max;
    case "median": {
      if (bucket.values.length === 0) return null;
      const sorted = [...bucket.values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  }
}

export function finalizeReplicates(options: {
  replicates: Map<string, ReplicateBucket>;
  within: WithinAggregation;
  ops: Aggregation[];
  hasColumn: boolean;
  groupBy: string[];
  replicateBy: string[];
  coverageMode: "all_surveyed" | "rows_only" | "coverage_file";
  subjectColumn: string | null;
  contributionFilters: CompiledFilter[];
  coverage: CoverageIndex | null;
  whenStep: WhenStepPrecision | null;
  when: TemporalWhenFilter | null;
  explain: boolean;
}): {
  groups: Record<string, unknown>[];
  replicates?: ExplainedReplicate[];
  valuesByStep: Map<string, { rows: number; groups: number; values: number[] }>;
} {
  const subject = subjectFilterValues(
    options.contributionFilters,
    options.subjectColumn
  );
  const explained: ExplainedReplicate[] = [];
  const outputs = new Map<string, OutputBucket>();

  for (const bucket of options.replicates.values()) {
    const reducedValue = reduced(options.within, bucket);
    const resolved =
      reducedValue === null
        ? resolveEmptyReplicate({
            within: options.within,
            coverageMode: options.coverageMode,
            subject,
            scope: bucket.scope,
            whenStart: bucket.whenStart,
            whenEnd: bucket.whenEnd,
            coverage: options.coverage,
          })
        : {
            status: "counted" as const,
            value: reducedValue,
            reason: null,
            coverageInterval:
              options.coverageMode === "coverage_file" &&
              subject.active &&
              subject.values &&
              options.coverage &&
              bucket.whenStart !== null &&
              bucket.whenEnd !== null
                ? options.coverage.lookup(
                    bucket.scope,
                    subject.values[0],
                    bucket.whenStart,
                    bucket.whenEnd
                  ).interval
                : null,
          };

    if (options.explain) {
      const key: { [column: string]: unknown } = {};
      if (bucket.whenStart !== null) key._when_start = bucket.whenStart;
      if (bucket.whenEnd !== null) key._when_end = bucket.whenEnd;
      options.groupBy.forEach((column, index) => {
        key[column] = bucket.groupValues[index];
      });
      options.replicateBy.forEach((column, index) => {
        key[column] = bucket.replicateValues[index];
      });
      explained.push({
        key,
        status: resolved.status,
        reason: resolved.reason,
        coverageInterval: resolved.coverageInterval,
        scope: bucket.scope,
        value: resolved.value,
        rowCount: bucket.rowCount,
        contributingRows: bucket.valueCount,
      });
    }

    const targets: unknown[][] = [];
    if (options.whenStep && options.when) {
      if (bucket.whenStart !== null && bucket.whenEnd !== null) {
        const steps = stepsOverlappingInterval(
          bucket.whenStart,
          bucket.whenEnd,
          options.when,
          options.whenStep
        );
        for (const step of steps) {
          targets.push([step, ...bucket.groupValues]);
        }
      }
    } else {
      targets.push(bucket.groupValues);
    }
    for (const keyValues of targets) {
      addResolved(
        outputs,
        keyValues,
        bucket.rowCount,
        resolved.status,
        resolved.value
      );
    }
  }

  const primaryOp = options.ops[0];
  const valuesByStep = new Map<
    string,
    { rows: number; groups: number; values: number[] }
  >();
  const groups: Record<string, unknown>[] = [];
  for (const bucket of outputs.values()) {
    if (
      bucket.valueCount === 0 &&
      bucket.replicatesSurveyed === 0 &&
      bucket.replicatesNotSurveyed === 0
    ) {
      continue;
    }
    const entry: Record<string, unknown> = {};
    const valueOffset = options.whenStep ? 1 : 0;
    if (options.whenStep) entry.step = bucket.keyValues[0];
    options.groupBy.forEach((column, index) => {
      entry[column] = bucket.keyValues[index + valueOffset];
    });
    for (const op of options.ops) {
      entry[op] = aggregateOp(op, bucket, options.hasColumn);
    }
    entry.replicatesSurveyed = bucket.replicatesSurveyed;
    entry.replicatesZero = bucket.replicatesZero;
    entry.replicatesNoValue = bucket.replicatesNoValue;
    entry.replicatesNotSurveyed = bucket.replicatesNotSurveyed;
    groups.push(entry);
    if (options.whenStep && typeof entry.step === "string") {
      let stat = valuesByStep.get(entry.step);
      if (!stat) {
        stat = { rows: 0, groups: 0, values: [] };
        valuesByStep.set(entry.step, stat);
      }
      stat.rows += bucket.rowCount;
      stat.groups += 1;
      const primary = entry[primaryOp];
      if (typeof primary === "number" && Number.isFinite(primary)) {
        stat.values.push(primary);
      }
    }
  }

  return {
    groups,
    replicates: options.explain ? explained : undefined,
    valuesByStep,
  };
}
