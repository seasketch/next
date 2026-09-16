import { OrganismCatalogRow, OrganismSearchDocument, type DataTableOrganismConfig } from "@seasketch/geostats-types";
import { type ResolveOrganismInput, type TaxonomyClients, type TaxonomyResolveProgress } from "./taxonomyApis";
export type DistinctOrganismValue = {
    value: string;
    occurrenceCount: number;
};
export type ClassTableRow = Record<string, unknown>;
export declare function classTableJoinColumn(config: DataTableOrganismConfig, classHeaders: string[]): string | null;
export declare function classRowForValue(value: string, classRows: ClassTableRow[], joinColumn: string | null): ClassTableRow | undefined;
export declare function resolveInputFromValue(value: string, config: DataTableOrganismConfig, classRow?: ClassTableRow): ResolveOrganismInput;
/** Class-table / identity join only. Used for admin draft preview. */
export declare function joinOrganismCatalogRows(options: {
    values: DistinctOrganismValue[];
    classRows?: ClassTableRow[];
    config: DataTableOrganismConfig;
}): OrganismCatalogRow[];
export declare function enrichOrganismValues(options: {
    values: DistinctOrganismValue[];
    classRows?: ClassTableRow[];
    config: DataTableOrganismConfig;
    clients: TaxonomyClients;
    onProgress?: (update: TaxonomyResolveProgress) => Promise<void> | void;
}): Promise<OrganismCatalogRow[]>;
export declare function serializeOrganismSearchIndex(rows: OrganismCatalogRow[], column: string, includeLowConfidenceMatches?: boolean): string;
export declare function previewPayloadFromCatalog(rows: OrganismCatalogRow[], config: DataTableOrganismConfig): {
    rows: OrganismCatalogRow[];
    valueCount: number;
    classifiedCount: number;
    column: string;
    includeLowConfidenceMatches: boolean;
};
export declare function searchDocumentsFromCatalog(rows: OrganismCatalogRow[], column: string, includeLowConfidenceMatches?: boolean): OrganismSearchDocument[];
