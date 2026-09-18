import { DataTableTemporalConfig, DataTableTemporalSourceColumns, TemporalInfo } from "@seasketch/geostats-types";
export declare function whenSelectSql(source: DataTableTemporalSourceColumns): {
    start: string;
    end: string;
};
export type DeriveWhenResult = {
    rowCount: number;
    parseableCount: number;
    unparseableCount: number;
    temporal: TemporalInfo;
};
export declare function deriveWhenColumnsOnParquet(parquetPath: string, config: DataTableTemporalConfig): Promise<DeriveWhenResult>;
export declare function missingSourceColumns(headers: string[], source: DataTableTemporalSourceColumns): string[];
export declare function configFromStoredTemporal(temporal: unknown): DataTableTemporalConfig | null;
