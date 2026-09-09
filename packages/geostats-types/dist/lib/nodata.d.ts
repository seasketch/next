/**
 * Data Table no-data sentinels. Empty / SQL NULL cells are always treated as
 * missing. Admins can add extra values (for example -88 or "NA") that ingest
 * rewrites to NULL in parquet so the query engine stays simple.
 */
export type DataTableNodataValue = string | number;
export type DataTableNodataConfig = {
    values: DataTableNodataValue[];
};
export declare const MAX_DATA_TABLE_NODATA_VALUES = 20;
export declare function isDataTableNodataValue(value: unknown): value is DataTableNodataValue;
export declare function isDataTableNodataConfig(value: unknown): value is DataTableNodataConfig;
/**
 * Normalize a stored jsonb array or config object into unique sentinels.
 * Numbers win when the same token appears as both -88 and "-88".
 */
export declare function normalizeNodataValues(value: unknown): DataTableNodataValue[];
export declare function nodataValuesEqual(a: unknown, b: unknown): boolean;
/** True when a non-null cell matches a configured sentinel. */
export declare function nodataValueMatches(cell: unknown, values: DataTableNodataValue[]): boolean;
//# sourceMappingURL=nodata.d.ts.map