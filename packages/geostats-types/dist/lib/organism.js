"use strict";
/**
 * Organism identity metadata for Data Tables, per
 * design-docs/data-tables/organism-identity.md. The thin OrganismInfo
 * document lives on overlay_data_tables. Catalog rows, search documents,
 * and MiniSearch options are the shared contract between enrichment
 * (data-tables-handler) and orgQuery (pmtiles-server). Changing fields,
 * storeFields, or tokenize options requires re-enrichment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORGANISM_SIDECAR_FILES = exports.ORGANISM_SEARCH_INDEX_OPTIONS = exports.ORGANISM_SEARCH_BOOSTS = exports.ORGANISM_SEARCH_STORE_FIELDS = exports.ORGANISM_SEARCH_FIELDS = exports.ORGANISM_VALUE_KINDS = exports.ORGANISM_COLUMN_ROLES = void 0;
exports.isOrganismColumnRole = isOrganismColumnRole;
exports.isOrganismValueKind = isOrganismValueKind;
exports.isOrganismAuthoredBy = isOrganismAuthoredBy;
exports.isOrganismRoles = isOrganismRoles;
exports.isOrganismInfo = isOrganismInfo;
exports.includeLowConfidenceMatchesEnabled = includeLowConfidenceMatchesEnabled;
exports.isDataTableOrganismConfig = isDataTableOrganismConfig;
exports.isOrganismResolveConfidence = isOrganismResolveConfidence;
exports.isOrganismCatalogRow = isOrganismCatalogRow;
exports.suggestOrganismColumnRoles = suggestOrganismColumnRoles;
exports.suggestOrganismIdentityColumn = suggestOrganismIdentityColumn;
exports.rolesForColumn = rolesForColumn;
exports.columnsWithRole = columnsWithRole;
exports.uniqueStrings = uniqueStrings;
exports.buildOrganismSearchText = buildOrganismSearchText;
exports.organismIsClassified = organismIsClassified;
exports.organismClassificationCounts = organismClassificationCounts;
exports.catalogRowToSearchDocument = catalogRowToSearchDocument;
exports.organismInfoFromConfig = organismInfoFromConfig;
exports.isLumpedOrganismValue = isLumpedOrganismValue;
exports.genusFromOrganismName = genusFromOrganismName;
exports.ORGANISM_COLUMN_ROLES = [
    "code",
    "scientificName",
    "genus",
    "species",
    "commonName",
    "wormsAphiaId",
    "description",
];
exports.ORGANISM_VALUE_KINDS = [
    "code",
    "scientificName",
    "commonName",
    "mixed",
];
exports.ORGANISM_SEARCH_FIELDS = [
    "value",
    "common_name",
    "scientific_name",
    "common_names",
    "genus",
    "ancestor_names",
    "description",
];
exports.ORGANISM_SEARCH_STORE_FIELDS = [
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
];
exports.ORGANISM_SEARCH_BOOSTS = {
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
exports.ORGANISM_SEARCH_INDEX_OPTIONS = {
    fields: [...exports.ORGANISM_SEARCH_FIELDS],
    storeFields: [...exports.ORGANISM_SEARCH_STORE_FIELDS],
    idField: "id",
    searchOptions: {
        boost: Object.assign({}, exports.ORGANISM_SEARCH_BOOSTS),
        prefix: true,
        combineWith: "AND",
        fuzzy: false,
    },
};
exports.ORGANISM_SIDECAR_FILES = {
    catalog: "organism-catalog.parquet",
    searchIndex: "organism-search.json",
    preview: "organism-preview.json",
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}
function isOrganismColumnRole(value) {
    return (typeof value === "string" &&
        exports.ORGANISM_COLUMN_ROLES.indexOf(value) !== -1);
}
function isOrganismValueKind(value) {
    return (typeof value === "string" &&
        exports.ORGANISM_VALUE_KINDS.indexOf(value) !== -1);
}
function isOrganismAuthoredBy(value) {
    return (value === "ingest" || value === "admin" || value === "heuristic");
}
function isOrganismRoleAssignment(value) {
    if (isOrganismColumnRole(value))
        return true;
    return Array.isArray(value) && value.length > 0 && value.every(isOrganismColumnRole);
}
function isOrganismRoles(value) {
    if (!isRecord(value))
        return false;
    for (const key of Object.keys(value)) {
        if (!isNonEmptyString(key))
            return false;
        if (!isOrganismRoleAssignment(value[key]))
            return false;
    }
    return true;
}
function isOrganismInfo(value) {
    if (!isRecord(value))
        return false;
    if (value.version !== 1)
        return false;
    if (!isNonEmptyString(value.column))
        return false;
    if (!isOrganismValueKind(value.valueKind))
        return false;
    if (!isOrganismRoles(value.roles))
        return false;
    if (value.authoredBy !== undefined && !isOrganismAuthoredBy(value.authoredBy)) {
        return false;
    }
    if (!isOptionalBoolean(value.includeLowConfidenceMatches))
        return false;
    if (!isOptionalNonNegativeInt(value.valueCount))
        return false;
    if (!isOptionalNonNegativeInt(value.classifiedCount))
        return false;
    return true;
}
function isOptionalBoolean(value) {
    return value === undefined || typeof value === "boolean";
}
function isOptionalNonNegativeInt(value) {
    return (value === undefined ||
        (typeof value === "number" && Number.isInteger(value) && value >= 0));
}
function includeLowConfidenceMatchesEnabled(value) {
    return (value === null || value === void 0 ? void 0 : value.includeLowConfidenceMatches) === true;
}
function isDataTableOrganismConfig(value) {
    if (!isRecord(value))
        return false;
    if (!isNonEmptyString(value.column))
        return false;
    if (!isOrganismValueKind(value.valueKind))
        return false;
    if (!isOptionalBoolean(value.includeLowConfidenceMatches))
        return false;
    return isOrganismRoles(value.roles);
}
function isOrganismResolveConfidence(value) {
    return value === "high" || value === "low" || value === "unresolved";
}
function isOrganismCatalogRow(value) {
    if (!isRecord(value))
        return false;
    if (!isNonEmptyString(value.value))
        return false;
    if (value.scientific_name !== null && typeof value.scientific_name !== "string") {
        return false;
    }
    if (value.common_name !== null && typeof value.common_name !== "string") {
        return false;
    }
    if (!Array.isArray(value.common_names) ||
        !value.common_names.every((item) => typeof item === "string")) {
        return false;
    }
    if (value.genus !== null && typeof value.genus !== "string")
        return false;
    if (value.family !== null && typeof value.family !== "string")
        return false;
    if (!Array.isArray(value.ancestor_names) ||
        !value.ancestor_names.every((item) => typeof item === "string")) {
        return false;
    }
    if (value.description !== null && typeof value.description !== "string") {
        return false;
    }
    if (value.inat_taxon_id !== null &&
        (typeof value.inat_taxon_id !== "number" ||
            !Number.isInteger(value.inat_taxon_id) ||
            value.inat_taxon_id <= 0)) {
        return false;
    }
    if (value.worms_aphia_id !== null &&
        (typeof value.worms_aphia_id !== "number" ||
            !Number.isInteger(value.worms_aphia_id) ||
            value.worms_aphia_id <= 0)) {
        return false;
    }
    if (typeof value.search_text !== "string")
        return false;
    if (value.occurrence_count !== null &&
        (typeof value.occurrence_count !== "number" ||
            !Number.isFinite(value.occurrence_count) ||
            value.occurrence_count < 0)) {
        return false;
    }
    return isOrganismResolveConfidence(value.confidence);
}
const ROLE_HEURISTICS = [
    { role: "wormsAphiaId", pattern: /(aphia|worms|taxanomic_id|taxonomic_id)/i },
    { role: "scientificName", pattern: /(scientific[_\s]?name|scientificname|binomial)/i },
    { role: "commonName", pattern: /(common[_\s]?name|commonname|vernacular)/i },
    { role: "description", pattern: /(definition|description|notes|comment)/i },
    { role: "genus", pattern: /^genus$/i },
    { role: "species", pattern: /^species$/i },
    { role: "code", pattern: /(classcode|species[_\s]?code|^code$)/i },
];
const IDENTITY_COLUMN_HEURISTICS = [
    { kind: "code", pattern: /(classcode|species[_\s]?code|^code$)/i },
    { kind: "scientificName", pattern: /(scientific[_\s]?name|scientificname|binomial)/i },
    { kind: "commonName", pattern: /(common[_\s]?name|commonname)/i },
];
/**
 * Suggest roles from column names. Admin UI must confirm; do not persist
 * without confirmation.
 */
function suggestOrganismColumnRoles(columnNames) {
    if (!Array.isArray(columnNames))
        return {};
    const roles = {};
    for (const raw of columnNames) {
        if (!isNonEmptyString(raw))
            continue;
        const matched = [];
        for (const heuristic of ROLE_HEURISTICS) {
            if (heuristic.pattern.test(raw)) {
                matched.push(heuristic.role);
            }
        }
        if (matched.length === 1) {
            roles[raw] = matched[0];
        }
        else if (matched.length > 1) {
            roles[raw] = matched;
        }
    }
    return roles;
}
function suggestOrganismIdentityColumn(columnNames) {
    if (!Array.isArray(columnNames))
        return null;
    for (const heuristic of IDENTITY_COLUMN_HEURISTICS) {
        for (const raw of columnNames) {
            if (!isNonEmptyString(raw))
                continue;
            if (heuristic.pattern.test(raw)) {
                return { column: raw, valueKind: heuristic.kind };
            }
        }
    }
    return null;
}
function rolesForColumn(roles, columnName) {
    const assigned = roles[columnName];
    if (!assigned)
        return [];
    return Array.isArray(assigned) ? assigned : [assigned];
}
function columnsWithRole(roles, role) {
    return Object.keys(roles).filter((column) => rolesForColumn(roles, column).includes(role));
}
function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    for (const value of values) {
        if (typeof value !== "string")
            continue;
        const trimmed = value.trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}
function buildOrganismSearchText(row) {
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
function organismIsClassified(row, includeLowConfidenceMatches = false) {
    if (row.confidence === "high")
        return true;
    return row.confidence === "low" && includeLowConfidenceMatches;
}
function organismClassificationCounts(rows, includeLowConfidenceMatches = false) {
    let classifiedCount = 0;
    for (const row of rows) {
        if (organismIsClassified(row, includeLowConfidenceMatches)) {
            classifiedCount += 1;
        }
    }
    return { valueCount: rows.length, classifiedCount };
}
function catalogRowToSearchDocument(row, column, includeLowConfidenceMatches = false) {
    const useInatId = row.confidence === "high" ||
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
function organismInfoFromConfig(config, authoredBy = "admin", counts) {
    return Object.assign({ version: 1, column: config.column, valueKind: config.valueKind, roles: config.roles, authoredBy, includeLowConfidenceMatches: includeLowConfidenceMatchesEnabled(config) }, (counts
        ? {
            valueCount: counts.valueCount,
            classifiedCount: counts.classifiedCount,
        }
        : {}));
}
const LUMP_RE = /\bspp\.?$/i;
function isLumpedOrganismValue(value) {
    if (typeof value !== "string")
        return false;
    return LUMP_RE.test(value.trim());
}
/** Best-effort genus from a lump (`Sebastes spp.`) or binomial. */
function genusFromOrganismName(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const withoutSpp = trimmed.replace(LUMP_RE, "").trim();
    const first = withoutSpp.split(/\s+/)[0];
    if (!first || !/^[A-Z][a-z]+$/.test(first))
        return null;
    return first;
}
//# sourceMappingURL=organism.js.map