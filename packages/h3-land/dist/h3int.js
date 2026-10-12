"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cellToInt = cellToInt;
exports.intToCell = intToCell;
exports.asCellInt = asCellInt;
/**
 * H3 indexes fit in the low 63 bits, so SQLite's signed INTEGER can store
 * them without a transform. `cellToInt` / `intToCell` are the raw form.
 */
function cellToInt(index) {
    return BigInt(`0x${index}`);
}
function intToCell(value) {
    return value.toString(16).padStart(15, "0");
}
function asCellInt(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) {
        return BigInt(value);
    }
    throw new Error("expected an H3 integer column");
}
//# sourceMappingURL=h3int.js.map