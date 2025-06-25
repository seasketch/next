"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = worker;
const overlay_engine_1 = require("overlay-engine");
async function performClipping(data) {
    try {
        // Convert the polygons array to an async iterable
        const polygonSource = (async function* () {
            for (const polygon of data.polygons) {
                yield polygon;
            }
        })();
        const result = await (0, overlay_engine_1.clipSketchToPolygons)(data.preparedSketch, data.op, data.cql2Query, polygonSource);
        return result;
    }
    catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error));
    }
}
// Export the function for tinypool
async function worker(data) {
    return performClipping(data);
}
//# sourceMappingURL=clippingWorker.js.map