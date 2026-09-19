import {
  OrganismCatalogRow,
  OrganismSearchDocument,
  ORGANISM_SEARCH_INDEX_OPTIONS,
  buildOrganismSearchText,
  catalogRowToSearchDocument,
  columnsWithRole,
  genusFromOrganismName,
  includeLowConfidenceMatchesEnabled,
  isDataTableOrganismConfig,
  organismClassificationCounts,
  type DataTableOrganismConfig,
  uniqueStrings,
} from "@seasketch/geostats-types";
import MiniSearch from "minisearch";
import {
  resolveOrganismTaxa,
  type ResolveOrganismInput,
  type TaxonomyClients,
  type TaxonomyResolveProgress,
} from "./taxonomyApis";

export type DistinctOrganismValue = {
  value: string;
  occurrenceCount: number;
};

export type ClassTableRow = Record<string, unknown>;

const EMPTY_TAXON_PART =
  /^(na|n\/a|null|none|unknown|undetermined|spp\.?|sp\.?|-)$/i;

function cellFromRow(
  row: ClassTableRow | undefined,
  column: string
): unknown {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, column)) {
    return row[column];
  }
  const needle = column.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === needle) return row[key];
  }
  return undefined;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value);
}

function taxonPart(value: string | null): string | null {
  if (!value || EMPTY_TAXON_PART.test(value)) return null;
  return value;
}

function cellInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const text = cellText(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const n = parseInt(text, 10);
  return n > 0 ? n : null;
}

export function classTableJoinColumn(
  config: DataTableOrganismConfig,
  classHeaders: string[]
): string | null {
  if (typeof config.classJoinColumn !== "string") return null;
  const needle = config.classJoinColumn.toLowerCase();
  return (
    classHeaders.find((header) => header.toLowerCase() === needle) || null
  );
}

function firstRoleText(
  row: ClassTableRow | undefined,
  config: DataTableOrganismConfig,
  role: Parameters<typeof columnsWithRole>[1]
): string | null {
  if (!row) return null;
  for (const column of columnsWithRole(config.roles, role)) {
    const text = cellText(cellFromRow(row, column));
    if (text) return text;
  }
  return null;
}

function firstRoleTextFromRows(
  config: DataTableOrganismConfig,
  role: Parameters<typeof columnsWithRole>[1],
  ...rows: Array<ClassTableRow | undefined>
): string | null {
  for (const row of rows) {
    const text = firstRoleText(row, config, role);
    if (text) return text;
  }
  return null;
}

function allRoleTexts(
  row: ClassTableRow | undefined,
  config: DataTableOrganismConfig,
  role: Parameters<typeof columnsWithRole>[1]
): string[] {
  if (!row) return [];
  return uniqueStrings(
    columnsWithRole(config.roles, role).map((column) =>
      cellText(cellFromRow(row, column))
    )
  );
}

function allRoleTextsFromRows(
  config: DataTableOrganismConfig,
  role: Parameters<typeof columnsWithRole>[1],
  ...rows: Array<ClassTableRow | undefined>
): string[] {
  return uniqueStrings(
    rows.flatMap((row) => allRoleTexts(row, config, role))
  );
}

export function classRowForValue(
  value: string,
  classRows: ClassTableRow[],
  joinColumn: string | null
): ClassTableRow | undefined {
  if (!joinColumn) return undefined;
  const needle = value.trim().toLowerCase();
  return classRows.find(
    (row) => cellText(cellFromRow(row, joinColumn))?.toLowerCase() === needle
  );
}

export function resolveInputFromValue(
  value: string,
  config: DataTableOrganismConfig,
  classRow?: ClassTableRow,
  sourceRow?: ClassTableRow
): ResolveOrganismInput {
  const genusFromRole = taxonPart(
    firstRoleTextFromRows(config, "genus", classRow, sourceRow)
  );
  const species = taxonPart(
    firstRoleTextFromRows(config, "species", classRow, sourceRow)
  );
  const scientificFromParts = genusFromRole
    ? species
      ? `${genusFromRole} ${species}`
      : genusFromRole
    : null;
  const scientific =
    firstRoleTextFromRows(config, "scientificName", classRow, sourceRow) ||
    scientificFromParts ||
    (config.valueKind === "scientificName" ? value : null);
  const genus = genusFromRole || genusFromOrganismName(scientific);
  const commonName =
    firstRoleTextFromRows(config, "commonName", classRow, sourceRow) ||
    (config.valueKind === "commonName" ? value : null);
  const wormsAphiaId = (() => {
    for (const row of [classRow, sourceRow]) {
      if (!row) continue;
      for (const column of columnsWithRole(config.roles, "wormsAphiaId")) {
        const id = cellInt(cellFromRow(row, column));
        if (id) return id;
      }
    }
    return null;
  })();
  return {
    value,
    scientificName: scientific,
    genus,
    species,
    commonName,
    wormsAphiaId,
    extraNames: allRoleTextsFromRows(config, "commonName", classRow, sourceRow),
  };
}

/** Class-table / identity join only. Used for admin draft preview. */
export function joinOrganismCatalogRows(options: {
  values: DistinctOrganismValue[];
  classRows?: ClassTableRow[];
  sourceRows?: Map<string, ClassTableRow>;
  config: DataTableOrganismConfig;
}): OrganismCatalogRow[] {
  if (!isDataTableOrganismConfig(options.config)) {
    throw new Error("Invalid organism_config");
  }
  const classRows = options.classRows || [];
  const headers = classRows[0] ? Object.keys(classRows[0]) : [];
  const joinColumn = classTableJoinColumn(options.config, headers);
  return options.values.map((item) => {
    const classRow = classRowForValue(item.value, classRows, joinColumn);
    const sourceRow = options.sourceRows?.get(item.value);
    const input = resolveInputFromValue(
      item.value,
      options.config,
      classRow,
      sourceRow
    );
    const description =
      allRoleTextsFromRows(
        options.config,
        "description",
        classRow,
        sourceRow
      ).join(" ") || null;
    const row: OrganismCatalogRow = {
      value: item.value,
      scientific_name: input.scientificName ?? null,
      common_name: input.commonName ?? null,
      common_names: uniqueStrings([
        input.commonName,
        ...(input.extraNames || []),
      ]),
      genus: input.genus ?? null,
      family: null,
      ancestor_names: [],
      description,
      inat_taxon_id: null,
      worms_aphia_id: input.wormsAphiaId ?? null,
      search_text: "",
      occurrence_count: item.occurrenceCount,
      confidence: "unresolved",
    };
    row.search_text = buildOrganismSearchText(row);
    return row;
  });
}

export async function enrichOrganismValues(options: {
  values: DistinctOrganismValue[];
  classRows?: ClassTableRow[];
  sourceRows?: Map<string, ClassTableRow>;
  config: DataTableOrganismConfig;
  clients: TaxonomyClients;
  onProgress?: (update: TaxonomyResolveProgress) => Promise<void> | void;
}): Promise<OrganismCatalogRow[]> {
  if (!isDataTableOrganismConfig(options.config)) {
    throw new Error("Invalid organism_config");
  }
  const classRows = options.classRows || [];
  const headers = classRows[0] ? Object.keys(classRows[0]) : [];
  const joinColumn = classTableJoinColumn(options.config, headers);
  const inputs: ResolveOrganismInput[] = [];
  const descriptions: Array<string | null> = [];
  const resolveIndexes: number[] = [];
  const resolvedByIndex = new Array(options.values.length).fill(null) as Array<
    Awaited<ReturnType<typeof resolveOrganismTaxa>>[number] | null
  >;

  for (let i = 0; i < options.values.length; i++) {
    const item = options.values[i];
    const classRow = classRowForValue(item.value, classRows, joinColumn);
    const sourceRow = options.sourceRows?.get(item.value);
    const input = resolveInputFromValue(
      item.value,
      options.config,
      classRow,
      sourceRow
    );
    descriptions[i] =
      allRoleTextsFromRows(
        options.config,
        "description",
        classRow,
        sourceRow
      ).join(" ") || null;
    const hasTaxonSignal = Boolean(
      input.wormsAphiaId ||
        input.scientificName ||
        (input.genus && input.species) ||
        input.commonName
    );
    if (hasTaxonSignal) {
      resolveIndexes.push(i);
      inputs.push(input);
    } else {
      resolvedByIndex[i] = {
        scientificName: input.scientificName || null,
        commonName: input.commonName || null,
        commonNames: uniqueStrings([input.commonName, ...(input.extraNames || [])]),
        genus: input.genus || null,
        family: null,
        ancestorNames: [],
        inatTaxonId: null,
        wormsAphiaId: null,
        confidence: "unresolved",
      };
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[data-tables-handler] organism resolve ${inputs.length}/${options.values.length} values` +
      (joinColumn ? ` (class join ${joinColumn})` : " (no class join)"),
    {
      withAphiaId: inputs.filter((input) => input.wormsAphiaId).length,
      withScientificName: inputs.filter((input) => input.scientificName).length,
      withGenusSpecies: inputs.filter((input) => input.genus && input.species)
        .length,
    }
  );

  if (inputs.length > 0) {
    const resolved = await resolveOrganismTaxa(
      options.clients,
      inputs,
      options.onProgress
    );
    for (let r = 0; r < resolved.length; r++) {
      resolvedByIndex[resolveIndexes[r]] = resolved[r];
    }
  } else if (options.onProgress) {
    await options.onProgress({ phase: "wikidata", done: 1, total: 1 });
  }

  const rows: OrganismCatalogRow[] = options.values.map((item, i) => {
    const resolved = resolvedByIndex[i]!;
    const row: OrganismCatalogRow = {
      value: item.value,
      scientific_name: resolved.scientificName,
      common_name: resolved.commonName,
      common_names: resolved.commonNames,
      genus: resolved.genus,
      family: resolved.family,
      ancestor_names: resolved.ancestorNames,
      description: descriptions[i],
      inat_taxon_id: resolved.inatTaxonId,
      worms_aphia_id: resolved.wormsAphiaId,
      search_text: "",
      occurrence_count: item.occurrenceCount,
      confidence: resolved.confidence,
    };
    row.search_text = buildOrganismSearchText(row);
    return row;
  });
  return rows;
}

export function serializeOrganismSearchIndex(
  rows: OrganismCatalogRow[],
  column: string,
  includeLowConfidenceMatches = false
): string {
  const mini = new MiniSearch(ORGANISM_SEARCH_INDEX_OPTIONS);
  mini.addAll(
    rows.map((row) =>
      catalogRowToSearchDocument(row, column, includeLowConfidenceMatches)
    )
  );
  return JSON.stringify(mini);
}

export function previewPayloadFromCatalog(
  rows: OrganismCatalogRow[],
  config: DataTableOrganismConfig
) {
  const includeLow = includeLowConfidenceMatchesEnabled(config);
  return {
    column: config.column,
    includeLowConfidenceMatches: includeLow,
    ...organismClassificationCounts(rows, includeLow),
    rows,
  };
}

export function searchDocumentsFromCatalog(
  rows: OrganismCatalogRow[],
  column: string,
  includeLowConfidenceMatches = false
): OrganismSearchDocument[] {
  return rows.map((row) =>
    catalogRowToSearchDocument(row, column, includeLowConfidenceMatches)
  );
}
