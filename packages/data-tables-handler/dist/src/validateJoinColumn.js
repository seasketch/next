"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_UNMATCHED_RECORD_FRACTION = void 0;
exports.getGeostatsLayer = getGeostatsLayer;
exports.findOverlayAttribute = findOverlayAttribute;
exports.validateJoinColumnChoice = validateJoinColumnChoice;
exports.assertUnmatchedRecordFractionAllowed = assertUnmatchedRecordFractionAllowed;
exports.inferGeostatsType = inferGeostatsType;
function getGeostatsLayer(overlayGeostats) {
    const data = overlayGeostats;
    const layer = data?.layers?.[0];
    if (!layer?.attributes) {
        throw new Error("Overlay geostats missing layer attributes");
    }
    return layer;
}
function findOverlayAttribute(layer, attributeName) {
    const attr = layer.attributes.find((a) => a.attribute === attributeName);
    if (!attr) {
        throw new Error(`Overlay attribute "${attributeName}" not found in geostats`);
    }
    return attr;
}
/** Fail the upload when this fraction (or more) of table rows cannot join. */
exports.MAX_UNMATCHED_RECORD_FRACTION = 0.25;
/**
 * Validates that distinct values in the table's join column exist among the
 * overlay layer's feature identifiers (from geostats). Comparison is an
 * exact string match — join keys must match the overlay attribute exactly,
 * as they would in any other analysis tooling.
 *
 * Geostats attribute `values` histograms are truncated (top ~500 keys), so
 * when the overlay attribute has more distinct values than the histogram
 * holds, unmatched CSV values are reported in the stats but are not treated
 * as missing. With a complete histogram, unmatched values are returned so
 * the upload can drop those rows instead of failing — unless they make up
 * {@link MAX_UNMATCHED_RECORD_FRACTION} or more of the table rows.
 *
 * The upload still fails if *no* join values match the overlay.
 *
 * Note: despite the names (kept for compatibility with the stored
 * column-stats.json format), matchedRows/unmatchedRows count *distinct join
 * values*, not table rows.
 */
function validateJoinColumnChoice(headers, joinColumn, overlayJoinColumn, layer, joinValues) {
    if (!headers.includes(joinColumn)) {
        throw new Error(`Join column "${joinColumn}" not found in CSV headers`);
    }
    const overlayAttr = findOverlayAttribute(layer, overlayJoinColumn);
    const overlayKeys = new Set(Object.keys(overlayAttr.values || {}));
    const histogramComplete = typeof overlayAttr.countDistinct !== "number" ||
        overlayAttr.countDistinct <= overlayKeys.size;
    const matchedJoinValues = [];
    const unmatchedJoinValues = [];
    for (const v of joinValues) {
        if (overlayKeys.has(v)) {
            matchedJoinValues.push(v);
        }
        else {
            unmatchedJoinValues.push(v);
        }
    }
    const matchedRows = matchedJoinValues.length;
    const unmatchedRows = unmatchedJoinValues.length;
    if (matchedRows === 0) {
        throw new Error("No values in the join column match overlay feature identifiers");
    }
    let unmatchedOverlayValues = 0;
    for (const k of overlayKeys) {
        if (!joinValues.has(k)) {
            unmatchedOverlayValues++;
        }
    }
    const matchRate = joinValues.size > 0 ? matchedRows / joinValues.size : 0;
    return {
        overlayAttr,
        matchRate,
        matchedRows,
        unmatchedRows,
        unmatchedOverlayValues,
        matchedJoinValues,
        unmatchedJoinValues,
        histogramComplete,
    };
}
/**
 * Throws when unmatched rows are too large a share of the table. Below this
 * threshold, those rows can be dropped and the upload can continue.
 */
function assertUnmatchedRecordFractionAllowed(unmatchedRowCount, totalRowCount, unmatchedJoinValues) {
    if (totalRowCount <= 0 || unmatchedRowCount <= 0) {
        return;
    }
    if (unmatchedRowCount / totalRowCount < exports.MAX_UNMATCHED_RECORD_FRACTION) {
        return;
    }
    const percent = Math.round((unmatchedRowCount / totalRowCount) * 100);
    const shown = [...unmatchedJoinValues].sort((a, b) => a.localeCompare(b)).slice(0, 15);
    const extra = unmatchedJoinValues.length - shown.length;
    const sites = extra > 0 ? `${shown.join(", ")}, and ${extra} more` : shown.join(", ");
    const siteSuffix = sites.length > 0 ? ` Missing sites: ${sites}` : "";
    throw new Error(`${percent}% of rows (${unmatchedRowCount} of ${totalRowCount}) have join values that are not present in the overlay layer.${siteSuffix}`);
}
function inferGeostatsType(duckDbType) {
    const t = duckDbType.toUpperCase();
    if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL|HUGEINT/.test(t)) {
        return "number";
    }
    if (/BOOL/.test(t)) {
        return "boolean";
    }
    return "string";
}
