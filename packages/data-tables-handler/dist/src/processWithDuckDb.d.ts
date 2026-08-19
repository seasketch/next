import { DataTablesColumnStats } from "@seasketch/geostats-types";
import type { DataTableUploadProcessingOptions } from "./types";
export declare function processCsvWithDuckDb(csvPath: string, parquetPath: string, options: DataTableUploadProcessingOptions): Promise<{
    rowCount: number;
    headers: string[];
}>;
export declare function readJoinValues(parquetPath: string, joinColumn: string): Promise<Set<string>>;
/**
 * Counts rows whose join column is (or is not) in `keepValues`. NULL join
 * values count as unmatched.
 */
export declare function countParquetJoinMatches(parquetPath: string, joinColumn: string, keepValues: string[]): Promise<{
    totalRowCount: number;
    matchedRowCount: number;
    unmatchedRowCount: number;
}>;
/**
 * Rewrites `parquetPath` so it only contains rows whose join column is in
 * `keepValues`. Used to drop CSV rows that do not match overlay features.
 */
export declare function filterParquetByJoinValues(parquetPath: string, joinColumn: string, keepValues: string[]): Promise<{
    rowCount: number;
    droppedRowCount: number;
}>;
export declare function computeColumnStatsFromParquet(parquetPath: string, tableName: string, joinInfo: DataTablesColumnStats["join"]): Promise<DataTablesColumnStats>;
