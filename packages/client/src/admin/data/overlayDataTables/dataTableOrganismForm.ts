import {
  DataTableOrganismConfig,
  DataTablesColumnStats,
  GeostatsAttribute,
  ORGANISM_COLUMN_ROLES,
  OrganismCatalogRow,
  OrganismColumnRole,
  OrganismInfo,
  OrganismResolveConfidence,
  OrganismRoles,
  OrganismValueKind,
  columnsWithRole,
  includeLowConfidenceMatchesEnabled,
  isOrganismCatalogRow,
  isOrganismInfo,
  isOrganismRoles,
  isOrganismValueKind,
  rolesForColumn,
  suggestOrganismColumnRoles,
  suggestOrganismIdentityColumn,
} from "@seasketch/geostats-types";

export type OrganismEditorStep =
  | "identity"
  | "classTable"
  | "roles"
  | "review";

export const ORGANISM_EDITOR_STEPS: OrganismEditorStep[] = [
  "identity",
  "classTable",
  "roles",
  "review",
];

export type OrganismEditorFormState = {
  column: string;
  valueKind: OrganismValueKind;
  roles: OrganismRoles;
  includeLowConfidenceMatches: boolean;
};

export type OrganismPreviewPayload = {
  column: string;
  includeLowConfidenceMatches: boolean;
  valueCount: number;
  classifiedCount: number;
  rows: OrganismCatalogRow[];
};

export type OrganismPreviewConfidenceFilter =
  | "all"
  | OrganismResolveConfidence;

export function emptyOrganismForm(): OrganismEditorFormState {
  return {
    column: "",
    valueKind: "code",
    roles: {},
    includeLowConfidenceMatches: false,
  };
}

export function formStateFromOrganism(
  organism: unknown
): OrganismEditorFormState {
  if (!isOrganismInfo(organism)) {
    return emptyOrganismForm();
  }
  return {
    column: organism.column,
    valueKind: organism.valueKind,
    roles: { ...organism.roles },
    includeLowConfidenceMatches: includeLowConfidenceMatchesEnabled(organism),
  };
}

export function configFromForm(
  form: OrganismEditorFormState
): DataTableOrganismConfig | null {
  if (!form.column.trim() || !isOrganismValueKind(form.valueKind)) {
    return null;
  }
  if (!isOrganismRoles(form.roles)) {
    return null;
  }
  const config: DataTableOrganismConfig = {
    column: form.column.trim(),
    valueKind: form.valueKind,
    roles: form.roles,
  };
  if (form.includeLowConfidenceMatches) {
    config.includeLowConfidenceMatches = true;
  }
  return config;
}

export function suggestValueKindForColumn(
  column: string
): OrganismValueKind {
  const hint = suggestOrganismIdentityColumn([column]);
  return hint?.valueKind || "mixed";
}

export function rolesForEnrichment(
  columnNames: unknown,
  identityColumn: string,
  valueKind: OrganismValueKind,
  existing?: OrganismRoles
): OrganismRoles {
  const names = Array.isArray(columnNames)
    ? columnNames.filter((name): name is string => typeof name === "string")
    : [];
  const roles: OrganismRoles = { ...suggestOrganismColumnRoles(names) };
  if (existing) {
    for (const key of Object.keys(existing)) {
      if (names.indexOf(key) !== -1) {
        roles[key] = existing[key];
      }
    }
  }
  if (
    names.indexOf(identityColumn) !== -1 &&
    valueKind !== "mixed" &&
    rolesForColumn(roles, identityColumn).length === 0
  ) {
    roles[identityColumn] = valueKind;
  }
  return roles;
}

export function toggleOrganismRole(
  roles: OrganismRoles,
  columnName: string,
  role: OrganismColumnRole
): OrganismRoles {
  const current = rolesForColumn(roles, columnName);
  const next = current.includes(role)
    ? current.filter((item) => item !== role)
    : ORGANISM_COLUMN_ROLES.filter(
        (item) => item === role || current.includes(item)
      );
  const copy: OrganismRoles = { ...roles };
  if (next.length === 0) {
    delete copy[columnName];
  } else if (next.length === 1) {
    copy[columnName] = next[0];
  } else {
    copy[columnName] = next;
  }
  return copy;
}

export function classTableJoinColumnName(
  identityColumn: string,
  roles: OrganismRoles,
  headers: string[]
): string | null {
  const codes = columnsWithRole(roles, "code").filter((name) =>
    headers.includes(name)
  );
  if (codes[0]) return codes[0];
  if (headers.includes(identityColumn)) return identityColumn;
  const scientific = columnsWithRole(roles, "scientificName").filter((name) =>
    headers.includes(name)
  );
  if (scientific[0]) return scientific[0];
  const common = columnsWithRole(roles, "commonName").filter((name) =>
    headers.includes(name)
  );
  return common[0] || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOrganismPreviewPayload(
  value: unknown
): value is OrganismPreviewPayload {
  if (!isRecord(value)) return false;
  if (typeof value.column !== "string" || value.column.length === 0) {
    return false;
  }
  if (typeof value.includeLowConfidenceMatches !== "boolean") return false;
  if (
    typeof value.valueCount !== "number" ||
    !Number.isInteger(value.valueCount) ||
    value.valueCount < 0
  ) {
    return false;
  }
  if (
    typeof value.classifiedCount !== "number" ||
    !Number.isInteger(value.classifiedCount) ||
    value.classifiedCount < 0
  ) {
    return false;
  }
  if (!Array.isArray(value.rows)) return false;
  return value.rows.every(isOrganismCatalogRow);
}

export function parseCsvHeaderLine(text: unknown): string[] {
  if (typeof text !== "string") return [];
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  if (!first.trim()) return [];
  const delimiter = first.includes("\t") && !first.includes(",") ? "\t" : ",";
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (ch === '"') {
      if (inQuotes && first[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) out.push(last);
  return out;
}

export async function readCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 64 * 1024).text();
  return parseCsvHeaderLine(text);
}

export function organismPreviewSearchText(row: OrganismCatalogRow): string {
  return [
    row.search_text,
    row.value,
    row.scientific_name,
    row.common_name,
    ...(row.common_names || []),
    row.genus,
    row.family,
    ...(row.ancestor_names || []),
    row.description,
    row.worms_aphia_id != null ? String(row.worms_aphia_id) : "",
    row.inat_taxon_id != null ? String(row.inat_taxon_id) : "",
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

export function filterOrganismPreviewRows(
  rows: OrganismCatalogRow[],
  query: unknown,
  confidence: OrganismPreviewConfidenceFilter = "all"
): OrganismCatalogRow[] {
  const needle =
    typeof query === "string" ? query.trim().toLowerCase() : "";
  return rows.filter((row) => {
    if (confidence !== "all" && row.confidence !== confidence) {
      return false;
    }
    if (!needle) return true;
    return organismPreviewSearchText(row).includes(needle);
  });
}

export function observationColumnNames(
  columnStats?: DataTablesColumnStats | null
): string[] {
  if (!columnStats || !Array.isArray(columnStats.columns)) return [];
  return columnStats.columns
    .map((column) => column.attribute)
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name.length > 0 &&
        !name.startsWith("_when_")
    )
    .slice()
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function observationAttributes(
  columnStats?: DataTablesColumnStats | null
): GeostatsAttribute[] {
  if (!columnStats || !Array.isArray(columnStats.columns)) return [];
  return columnStats.columns
    .filter(
      (column) =>
        column.attribute && !column.attribute.startsWith("_when_")
    )
    .slice()
    .sort((a, b) =>
      a.attribute.localeCompare(b.attribute, undefined, { sensitivity: "base" })
    );
}

export function sampleValuesForColumn(
  columnStats: DataTablesColumnStats | undefined,
  column: string,
  limit = 8
): string[] {
  if (!columnStats || !column) return [];
  const attr = columnStats.columns.find((item) => item.attribute === column);
  if (!attr || !attr.values) return [];
  return Object.entries(attr.values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function histogramDistinctCount(
  columnStats: DataTablesColumnStats | undefined,
  column: string
): number {
  if (!columnStats || !column) return 0;
  const attr = columnStats.columns.find((item) => item.attribute === column);
  if (!attr) return 0;
  if (
    typeof attr.countDistinct === "number" &&
    Number.isFinite(attr.countDistinct)
  ) {
    return attr.countDistinct;
  }
  return attr.values ? Object.keys(attr.values).length : 0;
}

export function organismInfoOrNull(value: unknown): OrganismInfo | null {
  return isOrganismInfo(value) ? value : null;
}

export function organismJobProgressMessage(
  message: string | null | undefined
):
  | { kind: "lookup"; phase: string; done: string; total: string }
  | { kind: "key"; key: string }
  | null {
  if (!message) return null;
  if (message === "downloading parquet" || message === "downloading") {
    return { kind: "key", key: "reading-table" };
  }
  if (message === "reading class table") {
    return { kind: "key", key: "reading-class" };
  }
  if (message === "resolving taxa") {
    return { kind: "key", key: "resolving" };
  }
  const match = /^resolving (.+?) (\d+)\/(\d+)$/.exec(message);
  if (match) {
    return {
      kind: "lookup",
      phase: match[1],
      done: match[2],
      total: match[3],
    };
  }
  if (message === "writing catalog") {
    return { kind: "key", key: "writing" };
  }
  return null;
}

export function formatOrganismLookupProgress(
  phase: string,
  done: string,
  total: string,
  t: (key: string, vars?: Record<string, string>) => string
) {
  const vars = { done, total, phase };
  if (phase === "taxa") {
    return t("Looking up taxa ({{done}}/{{total}})…", vars);
  }
  if (phase === "worms ids") {
    return t("Looking up WoRMS ids ({{done}}/{{total}})…", vars);
  }
  if (phase === "worms names") {
    return t("Matching scientific names ({{done}}/{{total}})…", vars);
  }
  if (phase === "worms details") {
    return t("Loading WoRMS classification ({{done}}/{{total}})…", vars);
  }
  if (phase === "wikidata") {
    return t("Matching iNaturalist ids ({{done}}/{{total}})…", vars);
  }
  return t("Looking up {{phase}} ({{done}}/{{total}})…", vars);
}
