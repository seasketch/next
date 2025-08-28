"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guaranteeHelpers = guaranteeHelpers;
/**
 * Transforms optional helpers into guaranteed interface with no-op functions for log and progress.
 * This ensures that log and progress can always be called, while preserving the optional nature
 * of logFeature for conditional usage.
 */
function guaranteeHelpers(helpers) {
    return {
        log: (helpers === null || helpers === void 0 ? void 0 : helpers.log) || (() => { }),
        progress: (helpers === null || helpers === void 0 ? void 0 : helpers.progress) || (() => { }),
        logFeature: helpers === null || helpers === void 0 ? void 0 : helpers.logFeature,
    };
}
//# sourceMappingURL=helpers.js.map