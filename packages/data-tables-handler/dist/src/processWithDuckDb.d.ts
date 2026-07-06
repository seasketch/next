import { DataTablesColumnStats } from "@seasketch/geostats-types";
import type { DataTableUploadProcessingOptions } from "./types";
export declare function processCsvWithDuckDb(csvPath: string, parquetPath: string, options: DataTableUploadProcessingOptions): Promise<{
    rowCount: number;
    headers: string[];
    joinValues: Set<string>;
}>;
export declare function readJoinValues(parquetPath: string, joinColumn: string): Promise<Set<string>>;
export declare function computeColumnStatsFromParquet(parquetPath: string, tableName: string, joinInfo: DataTablesColumnStats["join"]): Promise<DataTablesColumnStats>;
