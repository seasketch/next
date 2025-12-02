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
        log: helpers?.log || (() => { }),
        progress: helpers?.progress || (async () => { }),
        logFeature: helpers?.logFeature,
        time: helpers?.time || (() => { }),
        timeEnd: helpers?.timeEnd || (() => { }),
    };
}
//# sourceMappingURL=helpers.js.map