/**
 * Survey coverage. Code name: coverage file (`coverage.json`).
 *
 * A coverage file lists the periods during which a subject was actually
 * looked for. Inside a listed period a missing row is zero. Outside it the
 * replicate is not surveyed and is left out of the calculation.
 *
 * The JSON Schema lives beside this module at `dataTableCoverage.schema.json`.
 */

export type DataTableCoverageRecord = {
  scope: { [column: string]: string };
  subject: { [column: string]: string };
  start: string;
  end?: string | null;
};

export type DataTableCoverage = DataTableCoverageRecord[];

export type DataTableCoverageIssue = {
  index: number;
  message: string;
};

export type DataTableCoverageValidation = {
  records: DataTableCoverageRecord[];
  errors: DataTableCoverageIssue[];
  warnings: DataTableCoverageIssue[];
};

export const DATA_TABLE_COVERAGE_PROMPT = `You are writing a SeaSketch survey-coverage file for a data table.

The file is a JSON array. Each record is one continuous period during which one subject was surveyed:
- scope: an object of survey-column names to values. Use an empty object when the period applies everywhere. Use only column names and values that appear in the column summary.
- subject: an object with exactly one key, the subject column, and the subject value that was looked for.
- start: first surveyed day, inclusive, YYYY-MM-DD.
- end: last surveyed day, inclusive, YYYY-MM-DD, or null when the period is still ongoing.

Write one record per continuous surveyed interval. Do not invent column names or values that are not in the column summary. Do not overlap intervals for the same scope and subject. Return only the JSON array.`;

/** Same document as `dataTableCoverage.schema.json`, for the copy button. */
export const DATA_TABLE_COVERAGE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://seasketch.org/schemas/data-table-coverage.json",
  title: "Data table survey coverage",
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["scope", "subject", "start"],
    properties: {
      scope: { type: "object", additionalProperties: { type: "string" } },
      subject: {
        type: "object",
        minProperties: 1,
        maxProperties: 1,
        additionalProperties: { type: "string" },
      },
      start: { type: "string", format: "date" },
      end: { type: ["string", "null"], format: "date" },
    },
  },
} as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringMap(value: unknown): value is { [column: string]: string } {
  if (!isRecord(value)) return false;
  for (const key of Object.keys(value)) {
    if (typeof value[key] !== "string") return false;
  }
  return true;
}

/** True when `value` is an array of coverage records. Does not check column names. */
export function isDataTableCoverage(
  value: unknown
): value is DataTableCoverage {
  if (!Array.isArray(value)) return false;
  return value.every((record) => {
    if (!isRecord(record)) return false;
    if (!isStringMap(record.scope)) return false;
    if (!isStringMap(record.subject)) return false;
    if (Object.keys(record.subject).length !== 1) return false;
    if (typeof record.start !== "string" || !isCalendarDate(record.start)) {
      return false;
    }
    if (
      record.end !== undefined &&
      record.end !== null &&
      (typeof record.end !== "string" || !isCalendarDate(record.end))
    ) {
      return false;
    }
    if (typeof record.end === "string" && record.end < record.start) {
      return false;
    }
    return true;
  });
}

export function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** Inclusive start midnight UTC, as epoch seconds. */
export function coverageStartSec(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 1000;
}

/** Exclusive end: midnight UTC after the inclusive end date. Null means ongoing. */
export function coverageEndSec(isoDate: string | null | undefined): number | null {
  if (isoDate == null) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day + 1) / 1000;
}

function canonicalScope(scope: { [column: string]: string }): string {
  const keys = Object.keys(scope).sort();
  return JSON.stringify(keys.map((key) => [key, scope[key]]));
}

type IndexedInterval = {
  startSec: number;
  endSec: number | null;
  start: string;
  end: string | null;
};

export type CoverageInterval = {
  start: string;
  end: string | null;
};

export type CoverageIndex = {
  scopeColumns: string[];
  subjectColumn: string;
  lookup: (
    scope: { [column: string]: string },
    subjectValue: string,
    startSec: number,
    endSec: number
  ) => { surveyed: boolean; interval: CoverageInterval | null };
};

function intervalsOverlap(
  interval: IndexedInterval,
  startSec: number,
  endSec: number
): boolean {
  if (!(interval.startSec < endSec)) return false;
  if (interval.endSec !== null && !(interval.endSec > startSec)) return false;
  return true;
}

/** Index a validated coverage file for replicate lookup. */
export function buildCoverageIndex(
  records: DataTableCoverageRecord[],
  subjectColumn: string
): CoverageIndex {
  const scopeColumns = new Set<string>();
  const byKey = new Map<string, IndexedInterval[]>();
  for (const record of records) {
    for (const key of Object.keys(record.scope)) scopeColumns.add(key);
    const subjectValue = record.subject[subjectColumn];
    if (subjectValue === undefined) continue;
    const key =
      Object.keys(record.scope).length === 0
        ? `${subjectValue}\0*`
        : `${subjectValue}\0${canonicalScope(record.scope)}`;
    const list = byKey.get(key) || [];
    list.push({
      startSec: coverageStartSec(record.start),
      endSec: coverageEndSec(record.end),
      start: record.start,
      end: record.end ?? null,
    });
    byKey.set(key, list);
  }
  return {
    scopeColumns: [...scopeColumns],
    subjectColumn,
    lookup(scope, subjectValue, startSec, endSec) {
      const keys = [
        `${subjectValue}\0${canonicalScope(scope)}`,
        `${subjectValue}\0*`,
      ];
      for (const key of keys) {
        const intervals = byKey.get(key);
        if (!intervals) continue;
        for (const interval of intervals) {
          if (intervalsOverlap(interval, startSec, endSec)) {
            return {
              surveyed: true,
              interval: { start: interval.start, end: interval.end },
            };
          }
        }
      }
      return { surveyed: false, interval: null };
    },
  };
}

function pushIssue(
  issues: DataTableCoverageIssue[],
  index: number,
  message: string
) {
  issues.push({ index, message });
}

/**
 * Post-parse validation for an uploaded coverage file.
 * `errors` block the upload. `warnings` do not.
 */
export function validateDataTableCoverage(
  value: unknown,
  options: {
    subjectColumn: string;
    surveyColumns: string[];
    observedSubjects?: string[];
    timeStart?: string | null;
    timeEnd?: string | null;
  }
): DataTableCoverageValidation {
  const errors: DataTableCoverageIssue[] = [];
  const warnings: DataTableCoverageIssue[] = [];
  if (!Array.isArray(value)) {
    return {
      records: [],
      errors: [{ index: -1, message: "Coverage file must be a JSON array." }],
      warnings,
    };
  }
  const survey = new Set(options.surveyColumns);
  const observed = options.observedSubjects
    ? new Set(options.observedSubjects)
    : null;
  const records: DataTableCoverageRecord[] = [];
  const occupied = new Map<string, IndexedInterval[]>();

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      pushIssue(errors, index, "Record must be an object.");
      return;
    }
    if (!isStringMap(item.scope)) {
      pushIssue(errors, index, "scope must be an object of strings.");
      return;
    }
    if (!isStringMap(item.subject) || Object.keys(item.subject).length !== 1) {
      pushIssue(
        errors,
        index,
        "subject must be an object with exactly one column."
      );
      return;
    }
    const subjectKey = Object.keys(item.subject)[0];
    if (subjectKey !== options.subjectColumn) {
      pushIssue(
        errors,
        index,
        `subject column must be ${options.subjectColumn}.`
      );
      return;
    }
    for (const key of Object.keys(item.scope)) {
      if (!survey.has(key)) {
        pushIssue(errors, index, `${key} is not a survey column.`);
        return;
      }
    }
    if (typeof item.start !== "string" || !isCalendarDate(item.start)) {
      pushIssue(errors, index, "start must be a YYYY-MM-DD date.");
      return;
    }
    if (
      item.end !== undefined &&
      item.end !== null &&
      (typeof item.end !== "string" || !isCalendarDate(item.end))
    ) {
      pushIssue(errors, index, "end must be a YYYY-MM-DD date or null.");
      return;
    }
    const end = item.end === undefined ? null : item.end;
    if (typeof end === "string" && end < item.start) {
      pushIssue(errors, index, "end must be on or after start.");
      return;
    }
    const subjectValue = item.subject[subjectKey];
    const interval: IndexedInterval = {
      startSec: coverageStartSec(item.start),
      endSec: coverageEndSec(end),
      start: item.start,
      end,
    };
    const slot = `${subjectValue}\0${canonicalScope(item.scope)}`;
    const prior = occupied.get(slot) || [];
    for (const existing of prior) {
      const existingEnd = existing.endSec ?? Number.POSITIVE_INFINITY;
      const nextEnd = interval.endSec ?? Number.POSITIVE_INFINITY;
      if (interval.startSec < existingEnd && existing.startSec < nextEnd) {
        pushIssue(
          errors,
          index,
          "Overlaps another period for the same scope and subject."
        );
        return;
      }
    }
    prior.push(interval);
    occupied.set(slot, prior);
    if (observed && !observed.has(subjectValue)) {
      pushIssue(
        warnings,
        index,
        `${subjectValue} is never observed in the table.`
      );
    }
    if (
      options.timeEnd &&
      isCalendarDate(options.timeEnd) &&
      item.start > options.timeEnd
    ) {
      pushIssue(warnings, index, "start is outside the table's time range.");
    }
    if (
      options.timeStart &&
      isCalendarDate(options.timeStart) &&
      typeof end === "string" &&
      end < options.timeStart
    ) {
      pushIssue(warnings, index, "end is outside the table's time range.");
    }
    records.push({
      scope: item.scope,
      subject: item.subject,
      start: item.start,
      end,
    });
  });

  if (errors.length > 0) {
    return { records: [], errors, warnings };
  }
  return { records, errors, warnings };
}
