"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveReverseNamedPalette = effectiveReverseNamedPalette;
/**
 * Whether to reverse a named d3 palette for styling. The model may only suggest
 * reversal with a non-empty `palette` and without a meaningful `custom_palette`.
 */
function effectiveReverseNamedPalette(notes) {
    if (!(notes === null || notes === void 0 ? void 0 : notes.reverse_palette)) {
        return false;
    }
    const named = typeof notes.palette === "string" && notes.palette.trim().length > 0;
    if (!named) {
        return false;
    }
    const cp = notes.custom_palette;
    const hasCustom = cp != null &&
        (typeof cp === "string"
            ? cp.trim().length > 0
            : typeof cp === "object" &&
                !Array.isArray(cp) &&
                Object.keys(cp).length > 0);
    return !hasCustom;
}
//# sourceMappingURL=reverseNamedPalette.js.map