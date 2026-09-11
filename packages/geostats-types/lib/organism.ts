/**
 * Organism identity metadata for Data Tables, per
 * design-docs/data-tables/organism-identity.md. The thin OrganismInfo
 * document lives on overlay_data_tables. Catalog rows, search documents,
 * and MiniSearch options are the shared contract between enrichment
 * (data-tables-handler) and orgQuery (pmtiles-server). Changing fields,
 * storeFields, or tokenize options requires re-enrichment.
 */

export type OrganismColumnRole =
  | "code"
  | "scientificName"
  | "genus"
  | "species"
  | "commonName"
  | "wormsAphiaId"
  | "description";

export const ORGANISM_COLUMN_ROLES: OrganismColumnRole[] = [
  "code",
  "scientificName",
  "genus",
  "species",
  "commonName",
  "wormsAphiaId",
  "description",
];

export type OrganismValueKind =
  | "code"
  | "scientificName"
  | "commonName"
  | "mixed";

export const ORGANISM_VALUE_KINDS: OrganismValueKind[] = [
  "code",
  "scientificName",
  "commonName",
  "mixed",
];

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

export const ORGANISM_SEARCH_FIELDS = [
  "value",
  "common_name",
  "scientific_name",
  "common_names",
  "genus",
  "ancestor_names",
  "description",
] as const;

export const ORGANISM_SEARCH_STORE_FIELDS = [
  "value",
  "common_name",
  "scientific_name",
  "common_names",
  "genus",
  "ancestor_names",
  "description",
  "inat_taxon_id",
  "worms_aphia_id",
  "column",
] as const;

export const ORGANISM_SEARCH_BOOSTS: {
  [K in (typeof ORGANISM_SEARCH_FIELDS)[number]]: number;
} = {
  value: 8,
  common_name: 6,
  scientific_name: 5,
  common_names: 3,
  genus: 3,
  ancestor_names: 2,
  description: 1,
};

/**
 * Options passed to `new MiniSearch` and `MiniSearch.loadJSON`. Keep writer
 * and reader on the same MiniSearch major version.
 */
export const ORGANISM_SEARCH_INDEX_OPTIONS = {
  fields: [...ORGANISM_SEARCH_FIELDS],
  storeFields: [...ORGANISM_SEARCH_STORE_FIELDS],
  idField: "id",
  searchOptions: {
    boost: { ...ORGANISM_SEARCH_BOOSTS },
    prefix: true,
    combineWith: "AND" as const,
    fuzzy: false,
  },
};

export const ORGANISM_SIDECAR_FILES = {
  catalog: "organism-catalog.parquet",
  searchIndex: "organism-search.json",
  preview: "organism-preview.json",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isOrganismColumnRole(
  value: unknown
): value is OrganismColumnRole {
  return (
    typeof value === "string" &&
    (ORGANISM_COLUMN_ROLES as string[]).indexOf(value) !== -1
  );
}

export function isOrganismValueKind(value: unknown): value is OrganismValueKind {
  return (
    typeof value === "string" &&
    (ORGANISM_VALUE_KINDS as string[]).indexOf(value) !== -1
  );
}

export function isOrganismAuthoredBy(
  value: unknown
): value is OrganismAuthoredBy {
  return (
    value === "ingest" || value === "admin" || value === "heuristic"
  );
}

function isOrganismRoleAssignment(
  value: unknown
): value is OrganismColumnRole | OrganismColumnRole[] {
  if (isOrganismColumnRole(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.every(isOrganismColumnRole);
}

export function isOrganismRoles(value: unknown): value is OrganismRoles {
  if (!isRecord(value)) return false;
  for (const key of Object.keys(value)) {
    if (!isNonEmptyString(key)) return false;
    if (!isOrganismRoleAssignment(value[key])) return false;
  }
  return true;
}

export function isOrganismInfo(value: unknown): value is OrganismInfo {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isNonEmptyString(value.column)) return false;
  if (!isOrganismValueKind(value.valueKind)) return false;
  if (!isOrganismRoles(value.roles)) return false;
  if (value.authoredBy !== undefined && !isOrganismAuthoredBy(value.authoredBy)) {
    return false;
  }
  if (!isOptionalBoolean(value.includeLowConfidenceMatches)) return false;
  if (!isOptionalNonNegativeInt(value.valueCount)) return false;
  if (!isOptionalNonNegativeInt(value.classifiedCount)) return false;
  return true;
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalNonNegativeInt(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0)
  );
}

export function includeLowConfidenceMatchesEnabled(
  value: { includeLowConfidenceMatches?: boolean } | null | undefined
): boolean {
  return value?.includeLowConfidenceMatches === true;
}

export function isDataTableOrganismConfig(
  value: unknown
): value is DataTableOrganismConfig {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.column)) return false;
  if (!isOrganismValueKind(value.valueKind)) return false;
  if (!isOptionalBoolean(value.includeLowConfidenceMatches)) return false;
  return isOrganismRoles(value.roles);
}

export function isOrganismResolveConfidence(
  value: unknown
): value is OrganismResolveConfidence {
  return value === "high" || value === "low" || value === "unresolved";
}

export function isOrganismCatalogRow(
  value: unknown
): value is OrganismCatalogRow {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.value)) return false;
  if (value.scientific_name !== null && typeof value.scientific_name !== "string") {
    return false;
  }
  if (value.common_name !== null && typeof value.common_name !== "string") {
    return false;
  }
  if (
    !Array.isArray(value.common_names) ||
    !value.common_names.every((item) => typeof item === "string")
  ) {
    return false;
  }
  if (value.genus !== null && typeof value.genus !== "string") return false;
  if (value.family !== null && typeof value.family !== "string") return false;
  if (
    !Array.isArray(value.ancestor_names) ||
    !value.ancestor_names.every((item) => typeof item === "string")
  ) {
    return false;
  }
  if (value.description !== null && typeof value.description !== "string") {
    return false;
  }
  if (
    value.inat_taxon_id !== null &&
    (typeof value.inat_taxon_id !== "number" ||
      !Number.isInteger(value.inat_taxon_id) ||
      value.inat_taxon_id <= 0)
  ) {
    return false;
  }
  if (
    value.worms_aphia_id !== null &&
    (typeof value.worms_aphia_id !== "number" ||
      !Number.isInteger(value.worms_aphia_id) ||
      value.worms_aphia_id <= 0)
  ) {
    return false;
  }
  if (typeof value.search_text !== "string") return false;
  if (
    value.occurrence_count !== null &&
    (typeof value.occurrence_count !== "number" ||
      !Number.isFinite(value.occurrence_count) ||
      value.occurrence_count < 0)
  ) {
    return false;
  }
  return isOrganismResolveConfidence(value.confidence);
}

const ROLE_HEURISTICS: Array<{ role: OrganismColumnRole; pattern: RegExp }> = [
  { role: "wormsAphiaId", pattern: /(aphia|worms|taxanomic_id|taxonomic_id)/i },
  { role: "scientificName", pattern: /(scientific[_\s]?name|scientificname|binomial)/i },
  { role: "commonName", pattern: /(common[_\s]?name|commonname|vernacular)/i },
  { role: "description", pattern: /(definition|description|notes|comment)/i },
  { role: "genus", pattern: /^genus$/i },
  { role: "species", pattern: /^species$/i },
  { role: "code", pattern: /(classcode|species[_\s]?code|^code$)/i },
];

const IDENTITY_COLUMN_HEURISTICS: Array<{
  kind: OrganismValueKind;
  pattern: RegExp;
}> = [
  { kind: "code", pattern: /(classcode|species[_\s]?code|^code$)/i },
  { kind: "scientificName", pattern: /(scientific[_\s]?name|scientificname|binomial)/i },
  { kind: "commonName", pattern: /(common[_\s]?name|commonname)/i },
];

/**
 * Suggest roles from column names. Admin UI must confirm; do not persist
 * without confirmation.
 */
export function suggestOrganismColumnRoles(
  columnNames: unknown
): OrganismRoles {
  if (!Array.isArray(columnNames)) return {};
  const roles: OrganismRoles = {};
  for (const raw of columnNames) {
    if (!isNonEmptyString(raw)) continue;
    const matched: OrganismColumnRole[] = [];
    for (const heuristic of ROLE_HEURISTICS) {
      if (heuristic.pattern.test(raw)) {
        matched.push(heuristic.role);
      }
    }
    if (matched.length === 1) {
      roles[raw] = matched[0];
    } else if (matched.length > 1) {
      roles[raw] = matched;
    }
  }
  return roles;
}

export function suggestOrganismIdentityColumn(
  columnNames: unknown
): { column: string; valueKind: OrganismValueKind } | null {
  if (!Array.isArray(columnNames)) return null;
  for (const heuristic of IDENTITY_COLUMN_HEURISTICS) {
    for (const raw of columnNames) {
      if (!isNonEmptyString(raw)) continue;
      if (heuristic.pattern.test(raw)) {
        return { column: raw, valueKind: heuristic.kind };
      }
    }
  }
  return null;
}

export function rolesForColumn(
  roles: OrganismRoles,
  columnName: string
): OrganismColumnRole[] {
  const assigned = roles[columnName];
  if (!assigned) return [];
  return Array.isArray(assigned) ? assigned : [assigned];
}

export function columnsWithRole(
  roles: OrganismRoles,
  role: OrganismColumnRole
): string[] {
  return Object.keys(roles).filter((column) =>
    rolesForColumn(roles, column).includes(role)
  );
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function buildOrganismSearchText(row: {
  value: string;
  scientific_name?: string | null;
  common_name?: string | null;
  common_names?: string[];
  genus?: string | null;
  family?: string | null;
  ancestor_names?: string[];
  description?: string | null;
}): string {
  return uniqueStrings([
    row.value,
    row.scientific_name,
    row.common_name,
    ...(row.common_names || []),
    row.genus,
    row.family,
    ...(row.ancestor_names || []),
    row.description,
  ]).join(" ");
}

export function organismIsClassified(
  row: { confidence: OrganismResolveConfidence },
  includeLowConfidenceMatches = false
): boolean {
  if (row.confidence === "high") return true;
  return row.confidence === "low" && includeLowConfidenceMatches;
}

export function organismClassificationCounts(
  rows: Array<{ confidence: OrganismResolveConfidence }>,
  includeLowConfidenceMatches = false
): { valueCount: number; classifiedCount: number } {
  let classifiedCount = 0;
  for (const row of rows) {
    if (organismIsClassified(row, includeLowConfidenceMatches)) {
      classifiedCount += 1;
    }
  }
  return { valueCount: rows.length, classifiedCount };
}

export function catalogRowToSearchDocument(
  row: OrganismCatalogRow,
  column: string,
  includeLowConfidenceMatches = false
): OrganismSearchDocument {
  const useInatId =
    row.confidence === "high" ||
    (row.confidence === "low" && includeLowConfidenceMatches);
  return {
    id: row.value,
    value: row.value,
    common_name: row.common_name || "",
    scientific_name: row.scientific_name || "",
    common_names: (row.common_names || []).join(" "),
    genus: row.genus || "",
    ancestor_names: (row.ancestor_names || []).join(" "),
    description: row.description || "",
    inat_taxon_id: useInatId ? row.inat_taxon_id : null,
    worms_aphia_id: row.worms_aphia_id,
    column,
  };
}

export function organismInfoFromConfig(
  config: DataTableOrganismConfig,
  authoredBy: OrganismAuthoredBy = "admin",
  counts?: { valueCount: number; classifiedCount: number }
): OrganismInfo {
  return {
    version: 1,
    column: config.column,
    valueKind: config.valueKind,
    roles: config.roles,
    authoredBy,
    includeLowConfidenceMatches: includeLowConfidenceMatchesEnabled(config),
    ...(counts
      ? {
          valueCount: counts.valueCount,
          classifiedCount: counts.classifiedCount,
        }
      : {}),
  };
}

const LUMP_RE = /\bspp\.?$/i;

export function isLumpedOrganismValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return LUMP_RE.test(value.trim());
}

/** Best-effort genus from a lump (`Sebastes spp.`) or binomial. */
export function genusFromOrganismName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutSpp = trimmed.replace(LUMP_RE, "").trim();
  const first = withoutSpp.split(/\s+/)[0];
  if (!first || !/^[A-Z][a-z]+$/.test(first)) return null;
  return first;
}
