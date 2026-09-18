import { type DataTableNodataValue } from "@seasketch/geostats-types";
export declare function nodataMatchSql(quotedColumn: string, values: DataTableNodataValue[]): string | null;
export declare function configFromStoredNodata(value: unknown): {
    values: DataTableNodataValue[];
} | null;
export declare function parseNodataConfig(value: unknown): {
    values: DataTableNodataValue[];
} | null;
export type ApplyNodataResult = {
    rowCount: number;
    values: DataTableNodataValue[];
};
export declare function applyNodataValuesOnParquet(parquetPath: string, values: DataTableNodataValue[], excludeColumns?: string[]): Promise<ApplyNodataResult>;
