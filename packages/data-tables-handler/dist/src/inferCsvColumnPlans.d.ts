import duckdb from "duckdb";
export declare const CSV_NULL_STRINGS_BASE: string[];
export declare const CSV_NULL_STRINGS_WITH_NA: string[];
export type CsvColumnPlan = {
    name: string;
    duckDbType: string;
    nullifyNa: boolean;
};
export declare function nullstrOption(nullStrings: string[]): string;
export declare function isNumericDuckDbType(type: string): boolean;
/**
 * Compare two typed CSV reads (with vs without treating "NA" as null) to decide
 * per-column whether bare "NA" is missing data or a valid string code.
 */
export declare function decideNaNullHandling(strictType: string, naNullType: string, naLiteralCount: number, naLooksLikeValidCode: boolean): Pick<CsvColumnPlan, "duckDbType" | "nullifyNa">;
export declare function inferCsvColumnPlans(conn: duckdb.Connection, csvPath: string, readCsvOptionsSuffix: string): Promise<CsvColumnPlan[]>;
export declare function buildTypedSelectSql(plans: CsvColumnPlan[]): string;
