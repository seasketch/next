"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeostatsLayer = getGeostatsLayer;
exports.findOverlayAttribute = findOverlayAttribute;
exports.validateJoinColumnChoice = validateJoinColumnChoice;
exports.inferGeostatsType = inferGeostatsType;
exports.sqlStringLiteral = sqlStringLiteral;
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
function validateJoinColumnChoice(headers, joinColumn, overlayJoinColumn, layer, joinValues) {
    if (!headers.includes(joinColumn)) {
        throw new Error(`Join column "${joinColumn}" not found in CSV headers`);
    }
    const overlayAttr = findOverlayAttribute(layer, overlayJoinColumn);
    const overlayKeys = new Set(Object.keys(overlayAttr.values || {}));
    let matchedRows = 0;
    for (const v of joinValues) {
        if (overlayKeys.has(v)) {
            matchedRows++;
        }
    }
    const unmatchedRows = joinValues.size - matchedRows;
    if (matchedRows === 0) {
        throw new Error("No values in the join column match overlay feature identifiers");
    }
    if (unmatchedRows > 0) {
        throw new Error(`${unmatchedRows} value(s) in the join column are not present in the overlay layer`);
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
    };
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
function sqlStringLiteral(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
