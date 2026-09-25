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
    scope: {
        [column: string]: string;
    };
    subject: {
        [column: string]: string;
    };
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
export declare const DATA_TABLE_COVERAGE_PROMPT = "You are writing a SeaSketch survey-coverage file for a data table.\n\nThe file is a JSON array. Each record is one continuous period during which one subject was surveyed:\n- scope: an object of survey-column names to values. Use an empty object when the period applies everywhere. Use only column names and values that appear in the column summary.\n- subject: an object with exactly one key, the subject column, and the subject value that was looked for.\n- start: first surveyed day, inclusive, YYYY-MM-DD.\n- end: last surveyed day, inclusive, YYYY-MM-DD, or null when the period is still ongoing.\n\nWrite one record per continuous surveyed interval. Do not invent column names or values that are not in the column summary. Do not overlap intervals for the same scope and subject. Return only the JSON array.";
/** Same document as `dataTableCoverage.schema.json`, for the copy button. */
export declare const DATA_TABLE_COVERAGE_SCHEMA: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly $id: "https://seasketch.org/schemas/data-table-coverage.json";
    readonly title: "Data table survey coverage";
    readonly type: "array";
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["scope", "subject", "start"];
        readonly properties: {
            readonly scope: {
                readonly type: "object";
                readonly additionalProperties: {
                    readonly type: "string";
                };
            };
            readonly subject: {
                readonly type: "object";
                readonly minProperties: 1;
                readonly maxProperties: 1;
                readonly additionalProperties: {
                    readonly type: "string";
                };
            };
            readonly start: {
                readonly type: "string";
                readonly format: "date";
            };
            readonly end: {
                readonly type: readonly ["string", "null"];
                readonly format: "date";
            };
        };
    };
};
/** True when `value` is an array of coverage records. Does not check column names. */
export declare function isDataTableCoverage(value: unknown): value is DataTableCoverage;
export declare function isCalendarDate(value: string): boolean;
/** Inclusive start midnight UTC, as epoch seconds. */
export declare function coverageStartSec(isoDate: string): number;
/** Exclusive end: midnight UTC after the inclusive end date. Null means ongoing. */
export declare function coverageEndSec(isoDate: string | null | undefined): number | null;
export type CoverageInterval = {
    start: string;
    end: string | null;
};
export type CoverageIndex = {
    scopeColumns: string[];
    subjectColumn: string;
    lookup: (scope: {
        [column: string]: string;
    }, subjectValue: string, startSec: number, endSec: number) => {
        surveyed: boolean;
        interval: CoverageInterval | null;
    };
};
/** Index a validated coverage file for replicate lookup. */
export declare function buildCoverageIndex(records: DataTableCoverageRecord[], subjectColumn: string): CoverageIndex;
/**
 * Post-parse validation for an uploaded coverage file.
 * `errors` block the upload. `warnings` do not.
 */
export declare function validateDataTableCoverage(value: unknown, options: {
    subjectColumn: string;
    surveyColumns: string[];
    observedSubjects?: string[];
    timeStart?: string | null;
    timeEnd?: string | null;
}): DataTableCoverageValidation;
//# sourceMappingURL=dataTableCoverage.d.ts.map