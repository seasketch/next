"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEST_LAYER_TITLE_MAX_LEN = exports.AI_CARTOGRAPHER_RATIONALE_MAX_LEN = exports.VISUALIZATION_TYPES = void 0;
exports.clampBestLayerTitle = clampBestLayerTitle;
exports.parseColumnIntelligenceResponse = parseColumnIntelligenceResponse;
exports.derivePresentationColumnForStorage = derivePresentationColumnForStorage;
exports.filterPresentationType = filterPresentationType;
exports.sanitizeColumnFields = sanitizeColumnFields;
const geostats_types_1 = require("@seasketch/geostats-types");
/** Re-export for callers that need the id list (same source as prompts). */
exports.VISUALIZATION_TYPES = (0, geostats_types_1.visualizationTypeIds)();
const VISUALIZATION_SET = new Set((0, geostats_types_1.visualizationTypeIds)());
function isVisualizationType(s) {
    return typeof s === "string" && VISUALIZATION_SET.has(s);
}
function optString(v) {
    if (v === null || v === undefined) {
        return v;
    }
    if (typeof v === "string") {
        return v;
    }
    return undefined;
}
/** Max stored length for LLM rationale (Postgres `text` is unbounded; cap for safety). */
exports.AI_CARTOGRAPHER_RATIONALE_MAX_LEN = 8000;
/** Max length for human-friendly layer title from column intelligence. */
exports.BEST_LAYER_TITLE_MAX_LEN = 200;
function clampBestLayerTitle(s) {
    if (s == null || typeof s !== "string") {
        return null;
    }
    const t = s.trim();
    if (t.length === 0) {
        return null;
    }
    if (t.length <= exports.BEST_LAYER_TITLE_MAX_LEN) {
        return t;
    }
    return t.slice(0, exports.BEST_LAYER_TITLE_MAX_LEN);
}
function clampRationale(s) {
    if (s == null || s === "") {
        return null;
    }
    if (s.length <= exports.AI_CARTOGRAPHER_RATIONALE_MAX_LEN) {
        return s;
    }
    return s.slice(0, exports.AI_CARTOGRAPHER_RATIONALE_MAX_LEN);
}
/**
 * Parse and validate LLM JSON (no zod — keeps api install working where private packages block npm i).
 */
function parseColumnIntelligenceResponse(parsed) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)) {
        return null;
    }
    const o = parsed;
    const junkRaw = o.junk_columns;
    const junk_columns = Array.isArray(junkRaw)
        ? junkRaw.filter((x) => typeof x === "string")
        : [];
    const pres = (_a = o.chosen_presentation_type) !== null && _a !== void 0 ? _a : o.best_presentation_type;
    let chosen_presentation_type = null;
    if (pres === null || pres === undefined) {
        chosen_presentation_type = null;
    }
    else if (isVisualizationType(pres)) {
        chosen_presentation_type = pres;
    }
    return {
        best_label_column: (_b = optString(o.best_label_column)) !== null && _b !== void 0 ? _b : null,
        best_category_column: (_c = optString(o.best_category_column)) !== null && _c !== void 0 ? _c : null,
        best_numeric_column: (_d = optString(o.best_numeric_column)) !== null && _d !== void 0 ? _d : null,
        best_date_column: (_e = optString(o.best_date_column)) !== null && _e !== void 0 ? _e : null,
        best_popup_description_column: (_f = optString(o.best_popup_description_column)) !== null && _f !== void 0 ? _f : null,
        best_id_column: (_g = optString(o.best_id_column)) !== null && _g !== void 0 ? _g : null,
        junk_columns,
        chosen_presentation_type,
        chosen_presentation_column: (_h = optString(o.chosen_presentation_column)) !== null && _h !== void 0 ? _h : null,
        ai_cartographer_rationale: clampRationale((_j = optString(o.ai_cartographer_rationale)) !== null && _j !== void 0 ? _j : null),
        best_layer_title: clampBestLayerTitle((_k = optString(o.best_layer_title)) !== null && _k !== void 0 ? _k : null),
    };
}
function normalizeColumnName(name, allowed) {
    if (name == null || name === "") {
        return null;
    }
    if (allowed.has(name)) {
        return name;
    }
    const lower = name.toLowerCase();
    for (const c of allowed) {
        if (c.toLowerCase() === lower) {
            return c;
        }
    }
    return null;
}
/**
 * After sanitization and geometry/raster filtering, choose the attribute column
 * that drives the presentation style (LLM may omit; use sensible fallbacks).
 */
function derivePresentationColumnForStorage(presentation, parsed, isRaster) {
    var _a, _b, _c;
    if (isRaster || presentation == null) {
        return null;
    }
    const chosen = parsed.chosen_presentation_column;
    if (chosen) {
        return chosen;
    }
    switch (presentation) {
        case "CONTINUOUS_POLYGON":
        case "CONTINUOUS_POINT":
        case "CONTINUOUS_RASTER":
        case "PROPORTIONAL_SYMBOL":
            return (_a = parsed.best_numeric_column) !== null && _a !== void 0 ? _a : null;
        case "CATEGORICAL_POLYGON":
        case "CATEGORICAL_POINT":
        case "CATEGORICAL_RASTER":
            return (_b = parsed.best_category_column) !== null && _b !== void 0 ? _b : null;
        case "HEATMAP":
            return (_c = parsed.best_numeric_column) !== null && _c !== void 0 ? _c : null;
        default:
            return null;
    }
}
const RASTER_TYPES = new Set((0, geostats_types_1.visualizationTypeIds)().filter((id) => (0, geostats_types_1.isRasterPresentationTypeId)(id)));
const POINT_TYPES = new Set([
    "SIMPLE_POINT",
    "MARKER_IMAGE",
    "CATEGORICAL_POINT",
    "PROPORTIONAL_SYMBOL",
    "CONTINUOUS_POINT",
    "HEATMAP",
]);
const POLYGON_LINE_TYPES = new Set([
    "SIMPLE_POLYGON",
    "CATEGORICAL_POLYGON",
    "CONTINUOUS_POLYGON",
]);
function geometryBucket(geometry) {
    if (!geometry) {
        return "unknown";
    }
    const g = geometry.toLowerCase();
    if (g.includes("point")) {
        return "point";
    }
    if (g.includes("polygon") ||
        g.includes("line") ||
        g === "geometrycollection") {
        return "polygonLine";
    }
    return "unknown";
}
/**
 * Keep presentation only if it matches dataset kind (raster vs vector geometry).
 */
function filterPresentationType(presentation, opts) {
    if (presentation == null) {
        return null;
    }
    if (opts.isRaster) {
        return RASTER_TYPES.has(presentation) ? presentation : null;
    }
    if (RASTER_TYPES.has(presentation)) {
        return null;
    }
    const bucket = geometryBucket(opts.primaryGeometry);
    if (bucket === "point") {
        return POINT_TYPES.has(presentation) ? presentation : null;
    }
    if (bucket === "polygonLine") {
        return POLYGON_LINE_TYPES.has(presentation) ? presentation : null;
    }
    if (POINT_TYPES.has(presentation) ||
        POLYGON_LINE_TYPES.has(presentation)) {
        return presentation;
    }
    return null;
}
/**
 * Restrict column names to known attributes; drop unknowns with no fuzzy match.
 */
function sanitizeColumnFields(parsed, allowedColumns) {
    var _a, _b, _c;
    const allowed = new Set((allowedColumns || []).filter((c) => c && c.length > 0));
    if (allowed.size === 0) {
        return {
            ...parsed,
            best_label_column: null,
            best_category_column: null,
            best_numeric_column: null,
            best_date_column: null,
            best_popup_description_column: null,
            best_id_column: null,
            junk_columns: [],
            chosen_presentation_type: null,
            chosen_presentation_column: null,
            ai_cartographer_rationale: (_a = parsed.ai_cartographer_rationale) !== null && _a !== void 0 ? _a : null,
            best_layer_title: clampBestLayerTitle(parsed.best_layer_title),
        };
    }
    const junk = (parsed.junk_columns || [])
        .map((j) => normalizeColumnName(j, allowed))
        .filter((j) => j != null);
    return {
        best_label_column: normalizeColumnName(parsed.best_label_column, allowed),
        best_category_column: normalizeColumnName(parsed.best_category_column, allowed),
        best_numeric_column: normalizeColumnName(parsed.best_numeric_column, allowed),
        best_date_column: normalizeColumnName(parsed.best_date_column, allowed),
        best_popup_description_column: normalizeColumnName(parsed.best_popup_description_column, allowed),
        best_id_column: normalizeColumnName(parsed.best_id_column, allowed),
        junk_columns: [...new Set(junk)],
        chosen_presentation_type: (_b = parsed.chosen_presentation_type) !== null && _b !== void 0 ? _b : null,
        chosen_presentation_column: normalizeColumnName(parsed.chosen_presentation_column, allowed),
        ai_cartographer_rationale: (_c = parsed.ai_cartographer_rationale) !== null && _c !== void 0 ? _c : null,
        best_layer_title: clampBestLayerTitle(parsed.best_layer_title),
    };
}
//# sourceMappingURL=validation.js.map