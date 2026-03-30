/**
 * Mirrors Postgres `get_geostats_attribute_column_names(geostats jsonb)` so Lambda
 * prefetch uses the same allowed-attribute list as the generated `data_sources.columns` column.
 */
export declare function geostatsAttributeColumnNames(geostats: unknown): string[];
//# sourceMappingURL=geostatsColumnNames.d.ts.map