"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classTableJoinColumn = classTableJoinColumn;
exports.classRowForValue = classRowForValue;
exports.resolveInputFromValue = resolveInputFromValue;
exports.joinOrganismCatalogRows = joinOrganismCatalogRows;
exports.enrichOrganismValues = enrichOrganismValues;
exports.serializeOrganismSearchIndex = serializeOrganismSearchIndex;
exports.previewPayloadFromCatalog = previewPayloadFromCatalog;
exports.searchDocumentsFromCatalog = searchDocumentsFromCatalog;
const geostats_types_1 = require("@seasketch/geostats-types");
const minisearch_1 = __importDefault(require("minisearch"));
const taxonomyApis_1 = require("./taxonomyApis");
function cellText(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return String(value);
}
function cellInt(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    const text = cellText(value);
    if (!text || !/^\d+$/.test(text))
        return null;
    const n = parseInt(text, 10);
    return n > 0 ? n : null;
}
function classTableJoinColumn(config, classHeaders) {
    if (typeof config.classJoinColumn === "string" &&
        classHeaders.includes(config.classJoinColumn)) {
        return config.classJoinColumn;
    }
    return null;
}
function firstRoleText(row, config, role) {
    if (!row)
        return null;
    for (const column of (0, geostats_types_1.columnsWithRole)(config.roles, role)) {
        const text = cellText(row[column]);
        if (text)
            return text;
    }
    return null;
}
function allRoleTexts(row, config, role) {
    if (!row)
        return [];
    return (0, geostats_types_1.uniqueStrings)((0, geostats_types_1.columnsWithRole)(config.roles, role).map((column) => cellText(row[column])));
}
function classRowForValue(value, classRows, joinColumn) {
    if (!joinColumn)
        return undefined;
    const needle = value.trim().toLowerCase();
    return classRows.find((row) => cellText(row[joinColumn])?.toLowerCase() === needle);
}
function resolveInputFromValue(value, config, classRow) {
    const genusFromRole = firstRoleText(classRow, config, "genus");
    const species = firstRoleText(classRow, config, "species");
    const scientificFromParts = genusFromRole && species ? `${genusFromRole} ${species}` : null;
    const scientific = firstRoleText(classRow, config, "scientificName") ||
        scientificFromParts ||
        (config.valueKind === "scientificName" ? value : null);
    const genus = genusFromRole || (0, geostats_types_1.genusFromOrganismName)(scientific);
    const commonName = firstRoleText(classRow, config, "commonName") ||
        (config.valueKind === "commonName" ? value : null);
    const wormsAphiaId = (() => {
        if (!classRow)
            return null;
        for (const column of (0, geostats_types_1.columnsWithRole)(config.roles, "wormsAphiaId")) {
            const id = cellInt(classRow[column]);
            if (id)
                return id;
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
/** Class-table / identity join only. Used for admin draft preview. */
function joinOrganismCatalogRows(options) {
    if (!(0, geostats_types_1.isDataTableOrganismConfig)(options.config)) {
        throw new Error("Invalid organism_config");
    }
    const classRows = options.classRows || [];
    const headers = classRows[0] ? Object.keys(classRows[0]) : [];
    const joinColumn = classTableJoinColumn(options.config, headers);
    return options.values.map((item) => {
        const classRow = classRowForValue(item.value, classRows, joinColumn);
        const input = resolveInputFromValue(item.value, options.config, classRow);
        const description = allRoleTexts(classRow, options.config, "description").join(" ") || null;
        const row = {
            value: item.value,
            scientific_name: input.scientificName,
            common_name: input.commonName,
            common_names: (0, geostats_types_1.uniqueStrings)([
                input.commonName,
                ...(input.extraNames || []),
            ]),
            genus: input.genus,
            family: null,
            ancestor_names: [],
            description,
            inat_taxon_id: null,
            worms_aphia_id: input.wormsAphiaId,
            search_text: "",
            occurrence_count: item.occurrenceCount,
            confidence: "unresolved",
        };
        row.search_text = (0, geostats_types_1.buildOrganismSearchText)(row);
        return row;
    });
}
async function enrichOrganismValues(options) {
    if (!(0, geostats_types_1.isDataTableOrganismConfig)(options.config)) {
        throw new Error("Invalid organism_config");
    }
    const classRows = options.classRows || [];
    const headers = classRows[0] ? Object.keys(classRows[0]) : [];
    const joinColumn = classTableJoinColumn(options.config, headers);
    const inputs = [];
    const descriptions = [];
    const resolveIndexes = [];
    const resolvedByIndex = new Array(options.values.length).fill(null);
    for (let i = 0; i < options.values.length; i++) {
        const item = options.values[i];
        const classRow = classRowForValue(item.value, classRows, joinColumn);
        const input = resolveInputFromValue(item.value, options.config, classRow);
        descriptions[i] =
            allRoleTexts(classRow, options.config, "description").join(" ") || null;
        const hasTaxonSignal = Boolean(input.wormsAphiaId ||
            input.scientificName ||
            (input.genus && input.species) ||
            input.commonName);
        if (hasTaxonSignal) {
            resolveIndexes.push(i);
            inputs.push(input);
        }
        else {
            resolvedByIndex[i] = {
                scientificName: input.scientificName || null,
                commonName: input.commonName || null,
                commonNames: (0, geostats_types_1.uniqueStrings)([input.commonName, ...(input.extraNames || [])]),
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
    console.log(`[data-tables-handler] organism resolve ${inputs.length}/${options.values.length} values` +
        (joinColumn ? ` (class join ${joinColumn})` : " (no class join)"));
    if (inputs.length > 0) {
        const resolved = await (0, taxonomyApis_1.resolveOrganismTaxa)(options.clients, inputs, options.onProgress);
        for (let r = 0; r < resolved.length; r++) {
            resolvedByIndex[resolveIndexes[r]] = resolved[r];
        }
    }
    else if (options.onProgress) {
        await options.onProgress({ phase: "wikidata", done: 1, total: 1 });
    }
    const rows = options.values.map((item, i) => {
        const resolved = resolvedByIndex[i];
        const row = {
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
        row.search_text = (0, geostats_types_1.buildOrganismSearchText)(row);
        return row;
    });
    return rows;
}
function serializeOrganismSearchIndex(rows, column, includeLowConfidenceMatches = false) {
    const mini = new minisearch_1.default(geostats_types_1.ORGANISM_SEARCH_INDEX_OPTIONS);
    mini.addAll(rows.map((row) => (0, geostats_types_1.catalogRowToSearchDocument)(row, column, includeLowConfidenceMatches)));
    return JSON.stringify(mini);
}
function previewPayloadFromCatalog(rows, config) {
    const includeLow = (0, geostats_types_1.includeLowConfidenceMatchesEnabled)(config);
    return {
        column: config.column,
        includeLowConfidenceMatches: includeLow,
        ...(0, geostats_types_1.organismClassificationCounts)(rows, includeLow),
        rows,
    };
}
function searchDocumentsFromCatalog(rows, column, includeLowConfidenceMatches = false) {
    return rows.map((row) => (0, geostats_types_1.catalogRowToSearchDocument)(row, column, includeLowConfidenceMatches));
}
