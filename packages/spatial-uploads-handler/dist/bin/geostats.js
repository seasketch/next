"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Calculates geostats or rasterInfo for a given dataset. For debugging
 * Usage:
 *
 * ts-node bin/geostats.ts <path-to-spatial-data> [output-file]
 */
const rasterInfoForBands_1 = require("../src/rasterInfoForBands");
const geostatsForVectorLayer_1 = require("../src/geostatsForVectorLayer");
const fs = __importStar(require("fs"));
const filePath = process.argv[2];
const outputFile = process.argv[3];
if (!filePath) {
    console.error("Usage: ts-node bin/geostats.ts <path-to-spatial-data> [output-file]");
    process.exit(1);
}
async function run() {
    let stats;
    if (filePath.endsWith(".shp") ||
        filePath.endsWith(".geojson") ||
        filePath.endsWith(".json") ||
        filePath.endsWith(".fgb")) {
        stats = await (0, geostatsForVectorLayer_1.geostatsForVectorLayers)(filePath);
    }
    else if (filePath.endsWith(".tif") || filePath.endsWith(".nc")) {
        stats = await (0, rasterInfoForBands_1.rasterInfoForBands)(filePath);
    }
    else {
        console.error("Unsupported file type");
        process.exit(1);
    }
    const statsJson = JSON.stringify(stats, null, 2);
    if (outputFile) {
        fs.writeFileSync(outputFile, statsJson);
        console.log(`Stats written to ${outputFile}`);
    }
    else {
        console.log(statsJson);
    }
}
run();
//# sourceMappingURL=geostats.js.map