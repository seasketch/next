import { organismInfoFromConfig, type DataTableOrganismConfig } from "@seasketch/geostats-types";
import { type ClassTableRow } from "./enrichOrganisms";
export declare function readDistinctOrganismValues(parquetPath: string, column: string): Promise<Array<{
    value: string;
    occurrenceCount: number;
}>>;
export declare function readClassTableRows(csvPath: string): Promise<ClassTableRow[]>;
export declare function writeOrganismCatalogParquet(rows: unknown[], parquetPath: string): Promise<void>;
export declare function copyOrganismSidecars(fromParquetRemote: string, toParquetRemote: string): Promise<void>;
export declare function runOrganismEnrichment(options: {
    parquetPath: string;
    parquetRemote: string;
    config: DataTableOrganismConfig;
    classCsvPath?: string;
    slug: string;
    sourceUuid: string;
    uploadId: string;
    tmpDir: string;
    updateProgress: (state: "running", message: string, progress?: number) => Promise<void>;
    fetchImpl?: typeof fetch;
}): Promise<{
    organism: ReturnType<typeof organismInfoFromConfig>;
}>;
