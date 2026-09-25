export type ClusterColumnHints = {
    columns: string[];
    joinColumn?: string | null;
    organismColumn?: string | null;
    /** Subject column. Falls back to organismColumn. Bloom-filtered with the join column. */
    subjectColumn?: string | null;
    requiredFilterColumns?: string[] | null;
    temporalColumns?: string[] | null;
    /** Replicate columns, clustered immediately after `_when_start`. */
    replicateColumns?: string[] | null;
};
export declare function quoteIdent(name: string): string;
export declare function escapePath(path: string): string;
export declare function clusterColumns(hints: ClusterColumnHints): string[];
/** COPY observations, optionally clustered so filters can prune row groups. */
export declare function copyObservationsParquetSql(parquetPath: string, cluster: string[], bloomColumns?: string[]): string;
export declare function bloomColumnsFor(hints: ClusterColumnHints): string[];
/** Rewrite an existing observations parquet using configured cluster columns. */
export declare function rewriteParquetClustered(parquetPath: string, hints: Omit<ClusterColumnHints, "columns">): Promise<string[]>;
