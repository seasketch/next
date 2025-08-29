"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleFgbWriter = void 0;
const fs_1 = require("fs");
class SimpleFgbWriter {
    constructor(outputPath, fields = []) {
        this.features = [];
        this.outputPath = outputPath;
        this.fieldDefinitions = fields;
    }
    addFeature(feature) {
        this.features.push(feature);
    }
    async close() {
        // For now, we'll just write the features as a simple JSON file
        // This avoids the complexity of the flatgeobuf library while still
        // providing the debugging functionality
        const output = {
            type: "FeatureCollection",
            features: this.features,
            properties: {
                fieldDefinitions: this.fieldDefinitions,
                featureCount: this.features.length,
            },
        };
        (0, fs_1.writeFileSync)(this.outputPath, JSON.stringify(output, null, 2));
    }
    getStats() {
        return {
            featureCount: this.features.length,
            fieldCount: this.fieldDefinitions.length,
        };
    }
}
exports.SimpleFgbWriter = SimpleFgbWriter;
//# sourceMappingURL=simpleFgbWriter.js.map