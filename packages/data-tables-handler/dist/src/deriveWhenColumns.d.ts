import { DataTableTemporalConfig, DataTableTemporalSourceColumns, TemporalInfo } from "@seasketch/geostats-types";
import { ClusterColumnHints } from "./clusterParquet";
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
export declare function deriveWhenColumnsOnParquet(parquetPath: string, config: DataTableTemporalConfig, clusterHints?: Omit<ClusterColumnHints, "columns" | "temporalColumns">): Promise<DeriveWhenResult>;
export declare function missingSourceColumns(headers: string[], source: DataTableTemporalSourceColumns): string[];
export declare function configFromStoredTemporal(temporal: unknown): DataTableTemporalConfig | null;
