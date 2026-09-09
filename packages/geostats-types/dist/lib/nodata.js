"use strict";
/**
 * Data Table no-data sentinels. Empty / SQL NULL cells are always treated as
 * missing. Admins can add extra values (for example -88 or "NA") that ingest
 * rewrites to NULL in parquet so the query engine stays simple.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DATA_TABLE_NODATA_VALUES = void 0;
exports.isDataTableNodataValue = isDataTableNodataValue;
exports.isDataTableNodataConfig = isDataTableNodataConfig;
exports.normalizeNodataValues = normalizeNodataValues;
exports.nodataValuesEqual = nodataValuesEqual;
exports.nodataValueMatches = nodataValueMatches;
exports.MAX_DATA_TABLE_NODATA_VALUES = 20;
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isDataTableNodataValue(value) {
    if (typeof value === "number") {
        return Number.isFinite(value);
    }
    return typeof value === "string" && value.length > 0;
}
function isDataTableNodataConfig(value) {
    if (!isRecord(value))
        return false;
    if (!Array.isArray(value.values))
        return false;
    if (value.values.length > exports.MAX_DATA_TABLE_NODATA_VALUES)
        return false;
    return value.values.every(isDataTableNodataValue);
}
/**
 * Normalize a stored jsonb array or config object into unique sentinels.
 * Numbers win when the same token appears as both -88 and "-88".
 */
function normalizeNodataValues(value) {
    const raw = Array.isArray(value)
        ? value
        : isRecord(value) && Array.isArray(value.values)
            ? value.values
            : [];
    const numbers = new Set();
    const strings = new Set();
    for (const item of raw) {
        if (!isDataTableNodataValue(item))
            continue;
        if (typeof item === "number") {
            numbers.add(item);
        }
        else {
            strings.add(item);
        }
    }
    const out = [];
    for (const n of numbers) {
        out.push(n);
        strings.delete(String(n));
    }
    for (const s of strings) {
        const asNumber = Number(s);
        if (s.trim() !== "" && Number.isFinite(asNumber) && numbers.has(asNumber)) {
            continue;
        }
        out.push(s);
    }
    return out.slice(0, exports.MAX_DATA_TABLE_NODATA_VALUES);
}
function nodataValuesEqual(a, b) {
    const left = normalizeNodataValues(a);
    const right = normalizeNodataValues(b);
    if (left.length !== right.length)
        return false;
    const key = (value) => typeof value === "number" ? `n:${value}` : `s:${value}`;
    const rightSet = new Set(right.map(key));
    return left.every((value) => rightSet.has(key(value)));
}
function numericCellNumber(cell) {
    if (typeof cell === "number") {
        return Number.isFinite(cell) ? cell : null;
    }
    if (typeof cell === "bigint") {
        const n = Number(cell);
        return Number.isFinite(n) ? n : null;
    }
    if (typeof cell === "string") {
        const trimmed = cell.trim();
        if (trimmed === "")
            return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
/** True when a non-null cell matches a configured sentinel. */
function nodataValueMatches(cell, values) {
    if (cell === null || cell === undefined)
        return false;
    const cellNumber = numericCellNumber(cell);
    const cellString = typeof cell === "string" ? cell : String(cell);
    for (const value of values) {
        if (typeof value === "number") {
            if (cellNumber === value)
                return true;
            continue;
        }
        if (cellString === value)
            return true;
    }
    return false;
}
//# sourceMappingURL=nodata.js.map