"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLabelsLayer = addLabelsLayer;
const geostats_types_1 = require("@seasketch/geostats-types");
function addLabelsLayer(layers, geostats, aiDataAnalystNotes) {
    if ((0, geostats_types_1.isRasterInfo)(geostats)) {
        throw new Error("Labels not supported for raster layers");
    }
    if (!(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.best_label_column) ||
        !(aiDataAnalystNotes === null || aiDataAnalystNotes === void 0 ? void 0 : aiDataAnalystNotes.show_labels)) {
        return;
    }
    layers.push({
        type: "symbol",
        layout: Object.assign({ "text-field": ["get", aiDataAnalystNotes.best_label_column], "text-size": 13 }, (geostats.geometry === "Point" || geostats.geometry === "MultiPoint"
            ? {
                visibility: "visible",
                "text-anchor": "left",
                "text-offset": [0.5, 0.5],
                "symbol-placement": "point",
            }
            : {})),
        paint: {
            "text-color": "#000000",
            "text-halo-color": "rgba(255, 255, 255, 0.9)",
            "text-halo-width": 1.3,
        },
        minzoom: aiDataAnalystNotes.labels_min_zoom || 12,
    });
}
//# sourceMappingURL=labels.js.map