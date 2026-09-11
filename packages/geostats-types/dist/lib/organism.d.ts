/**
 * Organism identity metadata for Data Tables, per
 * design-docs/data-tables/organism-identity.md. The thin OrganismInfo
 * document lives on overlay_data_tables. Catalog rows, search documents,
 * and MiniSearch options are the shared contract between enrichment
 * (data-tables-handler) and orgQuery (pmtiles-server). Changing fields,
 * storeFields, or tokenize options requires re-enrichment.
 */
export type OrganismColumnRole = "code" | "scientificName" | "genus" | "species" | "commonName" | "wormsAphiaId" | "description";
export declare const ORGANISM_COLUMN_ROLES: OrganismColumnRole[];
export type OrganismValueKind = "code" | "scientificName" | "commonName" | "mixed";
export declare const ORGANISM_VALUE_KINDS: OrganismValueKind[];
export type OrganismAuthoredBy = "ingest" | "admin" | "heuristic";
export type OrganismRoles = {
    [columnName: string]: OrganismColumnRole | OrganismColumnRole[];
};
/**
 * Persisted jsonb on overlay_data_tables. Filter values are always the raw
 * strings in `column`.
 */
export type OrganismInfo = {
    version: 1;
    /** Observation parquet column used as q.{column}. */
    column: string;
    valueKind: OrganismValueKind;
    roles: OrganismRoles;
    authoredBy?: OrganismAuthoredBy;
    /**
     * When true, low-confidence common-name iNaturalist matches are treated as
     * classified and their taxon ids are stored on the search index. Preview
     * rows always include the guess and its confidence. Default false.
     */
    includeLowConfidenceMatches?: boolean;
    /** Distinct values in `column` at last enrichment. */
    valueCount?: number;
    /** Values counted as classified at last enrichment (see includeLowConfidenceMatches). */
    classifiedCount?: number;
};
/**
 * Ephemeral enrichment job argument. Same shape as OrganismInfo without
 * authoredBy or enrichment counts (those are written on complete).
 */
export type DataTableOrganismConfig = {
    column: string;
    valueKind: OrganismValueKind;
    roles: OrganismRoles;
    includeLowConfidenceMatches?: boolean;
};
export type OrganismResolveConfidence = "high" | "low" | "unresolved";
/** One catalog / preview row per distinct observation-column value. */
export type OrganismCatalogRow = {
    value: string;
    scientific_name: string | null;
    common_name: string | null;
    common_names: string[];
    genus: string | null;
    family: string | null;
    ancestor_names: string[];
    description: string | null;
    inat_taxon_id: number | null;
    worms_aphia_id: number | null;
    search_text: string;
    occurrence_count: number | null;
    confidence: OrganismResolveConfidence;
};
/** MiniSearch document stored in organism-search.json. */
export type OrganismSearchDocument = {
    id: string;
    value: string;
    common_name: string;
    scientific_name: string;
    common_names: string;
    genus: string;
    ancestor_names: string;
    description: string;
    inat_taxon_id: number | null;
    worms_aphia_id: number | null;
    column: string;
};
export declare const ORGANISM_SEARCH_FIELDS: readonly ["value", "common_name", "scientific_name", "common_names", "genus", "ancestor_names", "description"];
export declare const ORGANISM_SEARCH_STORE_FIELDS: readonly ["value", "common_name", "scientific_name", "common_names", "genus", "ancestor_names", "description", "inat_taxon_id", "worms_aphia_id", "column"];
export declare const ORGANISM_SEARCH_BOOSTS: {
    [K in (typeof ORGANISM_SEARCH_FIELDS)[number]]: number;
};
/**
 * Options passed to `new MiniSearch` and `MiniSearch.loadJSON`. Keep writer
 * and reader on the same MiniSearch major version.
 */
export declare const ORGANISM_SEARCH_INDEX_OPTIONS: {
    fields: ("genus" | "description" | "value" | "common_name" | "scientific_name" | "common_names" | "ancestor_names")[];
    storeFields: ("column" | "genus" | "description" | "value" | "common_name" | "scientific_name" | "common_names" | "ancestor_names" | "inat_taxon_id" | "worms_aphia_id")[];
    idField: string;
    searchOptions: {
        boost: {
            genus: number;
            description: number;
            value: number;
            common_name: number;
            scientific_name: number;
            common_names: number;
            ancestor_names: number;
        };
        prefix: boolean;
        combineWith: "AND";
        fuzzy: boolean;
    };
};
export declare const ORGANISM_SIDECAR_FILES: {
    readonly catalog: "organism-catalog.parquet";
    readonly searchIndex: "organism-search.json";
    readonly preview: "organism-preview.json";
};
export declare function isOrganismColumnRole(value: unknown): value is OrganismColumnRole;
export declare function isOrganismValueKind(value: unknown): value is OrganismValueKind;
export declare function isOrganismAuthoredBy(value: unknown): value is OrganismAuthoredBy;
export declare function isOrganismRoles(value: unknown): value is OrganismRoles;
export declare function isOrganismInfo(value: unknown): value is OrganismInfo;
export declare function includeLowConfidenceMatchesEnabled(value: {
    includeLowConfidenceMatches?: boolean;
} | null | undefined): boolean;
export declare function isDataTableOrganismConfig(value: unknown): value is DataTableOrganismConfig;
export declare function isOrganismResolveConfidence(value: unknown): value is OrganismResolveConfidence;
export declare function isOrganismCatalogRow(value: unknown): value is OrganismCatalogRow;
/**
 * Suggest roles from column names. Admin UI must confirm; do not persist
 * without confirmation.
 */
export declare function suggestOrganismColumnRoles(columnNames: unknown): OrganismRoles;
export declare function suggestOrganismIdentityColumn(columnNames: unknown): {
    column: string;
    valueKind: OrganismValueKind;
} | null;
export declare function rolesForColumn(roles: OrganismRoles, columnName: string): OrganismColumnRole[];
export declare function columnsWithRole(roles: OrganismRoles, role: OrganismColumnRole): string[];
export declare function uniqueStrings(values: Array<string | null | undefined>): string[];
export declare function buildOrganismSearchText(row: {
    value: string;
    scientific_name?: string | null;
    common_name?: string | null;
    common_names?: string[];
    genus?: string | null;
    family?: string | null;
    ancestor_names?: string[];
    description?: string | null;
}): string;
export declare function organismIsClassified(row: {
    confidence: OrganismResolveConfidence;
}, includeLowConfidenceMatches?: boolean): boolean;
export declare function organismClassificationCounts(rows: Array<{
    confidence: OrganismResolveConfidence;
}>, includeLowConfidenceMatches?: boolean): {
    valueCount: number;
    classifiedCount: number;
};
export declare function catalogRowToSearchDocument(row: OrganismCatalogRow, column: string, includeLowConfidenceMatches?: boolean): OrganismSearchDocument;
export declare function organismInfoFromConfig(config: DataTableOrganismConfig, authoredBy?: OrganismAuthoredBy, counts?: {
    valueCount: number;
    classifiedCount: number;
}): OrganismInfo;
export declare function isLumpedOrganismValue(value: unknown): boolean;
/** Best-effort genus from a lump (`Sebastes spp.`) or binomial. */
export declare function genusFromOrganismName(value: unknown): string | null;
//# sourceMappingURL=organism.d.ts.map