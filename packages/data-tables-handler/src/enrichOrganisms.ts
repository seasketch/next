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
  const codes = columnsWithRole(config.roles, "code").filter((name) =>
    classHeaders.includes(name)
  );
  if (codes[0]) return codes[0];
  if (classHeaders.includes(config.column)) return config.column;
  const scientific = columnsWithRole(config.roles, "scientificName").filter(
    (name) => classHeaders.includes(name)
  );
  if (scientific[0]) return scientific[0];
  const common = columnsWithRole(config.roles, "commonName").filter((name) =>
    classHeaders.includes(name)
  );
  return common[0] || null;
}

function firstRoleText(
  row: ClassTableRow | undefined,
  config: DataTableOrganismConfig,
  role: Parameters<typeof columnsWithRole>[1]
): string | null {
  if (!row) return null;
  for (const column of columnsWithRole(config.roles, role)) {
    const text = cellText(row[column]);
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
    columnsWithRole(config.roles, role).map((column) => cellText(row[column]))
  );
}

export function classRowForValue(
  value: string,
  classRows: ClassTableRow[],
  joinColumn: string | null
): ClassTableRow | undefined {
  if (!joinColumn) return undefined;
  const needle = value.trim().toLowerCase();
  return classRows.find((row) => cellText(row[joinColumn])?.toLowerCase() === needle);
}

export function resolveInputFromValue(
  value: string,
  config: DataTableOrganismConfig,
  classRow?: ClassTableRow
): ResolveOrganismInput {
  const scientific =
    firstRoleText(classRow, config, "scientificName") ||
    (config.valueKind === "scientificName" ? value : null);
  const genus =
    firstRoleText(classRow, config, "genus") || genusFromOrganismName(scientific);
  const species = firstRoleText(classRow, config, "species");
  const commonName =
    firstRoleText(classRow, config, "commonName") ||
    (config.valueKind === "commonName" ? value : null);
  const wormsAphiaId = (() => {
    if (!classRow) return null;
    for (const column of columnsWithRole(config.roles, "wormsAphiaId")) {
      const id = cellInt(classRow[column]);
      if (id) return id;
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
    extraNames: allRoleTexts(classRow, config, "commonName"),
  };
}

export async function enrichOrganismValues(options: {
  values: DistinctOrganismValue[];
  classRows?: ClassTableRow[];
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
    const input = resolveInputFromValue(item.value, options.config, classRow);
    descriptions[i] =
      allRoleTexts(classRow, options.config, "description").join(" ") || null;
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
      (joinColumn ? ` (class join ${joinColumn})` : " (no class join)")
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
